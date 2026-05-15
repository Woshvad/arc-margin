import { createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET, explorerTxUrl, publicClient } from "./arc.js";
import { appConfig } from "./config.js";
import { AgentError } from "./errors.js";
import { executeViaFallback, readAuthorizedAgent } from "./fallback.js";
import {
  encodeEvaluateAction,
  parsePolicyActionEvent,
  policyContractAbi,
  profileToContract,
} from "./policyAbi.js";
import { submitContractExecutionViaCircle } from "./circle.js";
import type {
  Address,
  Hex,
  PolicyExecutionResult,
  PolicySyncResult,
  RiskAction,
  SigningModeMetadata,
} from "./types.js";

function signingMetadata(params: {
  mode: "circle-native" | "eoa-fallback";
  fallbackActive: boolean;
  authorizedAgentAddress: Address | null;
  fallbackAgentAddress?: Address | null;
  txHash?: Hex | null;
  circleTransactionId?: string | null;
}): SigningModeMetadata {
  return {
    mode: params.mode,
    primary: params.mode === "circle-native" ? "Circle developer-controlled wallet" : "EOA fallback",
    fallbackActive: params.fallbackActive,
    contractAddress: appConfig.deployment.contractAddress,
    authorizedAgentAddress: params.authorizedAgentAddress,
    circleAgentAddress: appConfig.circle.walletAddress,
    fallbackAgentAddress: params.fallbackAgentAddress ?? null,
    disclosure:
      params.mode === "circle-native"
        ? "Policy transaction was submitted through the Circle developer-controlled wallet."
        : "Policy transaction used explicit EOA fallback; Circle-native execution is not being claimed.",
    lastTxHash: params.txHash ?? null,
    lastCircleTransactionId: params.circleTransactionId ?? null,
  };
}

async function waitForPolicyReceipt(txHash: Hex, signing: SigningModeMetadata): Promise<PolicyExecutionResult> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new AgentError("arc_transaction_failed", "Arc transaction reverted or failed.", 502, { txHash, receipt });
  }
  const event = parsePolicyActionEvent(receipt.logs);
  return {
    txHash,
    blockNumber: Number(receipt.blockNumber),
    blockHash: receipt.blockHash,
    event,
    signing: {
      ...signing,
      lastTxHash: txHash,
    },
  };
}

export async function getPolicyMetadata(): Promise<{
  owner: Address | null;
  authorizedAgentAddress: Address | null;
  dailyCapRemaining: number | null;
}> {
  const contractAddress = appConfig.deployment.contractAddress;
  const [owner, agent, dailyCapRemaining] = await Promise.allSettled([
    publicClient.readContract({ address: contractAddress, abi: policyContractAbi, functionName: "owner" }),
    readAuthorizedAgent(contractAddress),
    publicClient.readContract({ address: contractAddress, abi: policyContractAbi, functionName: "getDailyCapRemaining" }),
  ]);

  return {
    owner: owner.status === "fulfilled" ? (getAddress(owner.value as string) as Address) : null,
    authorizedAgentAddress: agent.status === "fulfilled" ? agent.value : null,
    dailyCapRemaining: dailyCapRemaining.status === "fulfilled" ? Number(dailyCapRemaining.value as bigint) / 1_000_000 : null,
  };
}

export async function executePolicyAction(action: RiskAction): Promise<PolicyExecutionResult> {
  const contractAddress = appConfig.deployment.contractAddress;
  const callData = encodeEvaluateAction(action);
  const authorizedAgentAddress = await readAuthorizedAgent(contractAddress).catch(() => appConfig.deployment.agentAddress);

  if (appConfig.circle.configured) {
    try {
      const circle = await submitContractExecutionViaCircle({
        callData,
        contractAddress,
        refId: `arcmargin-${action.action}-${Date.now()}`,
        timeoutMs: appConfig.runtime.contractCallTimeoutMs,
      });
      return waitForPolicyReceipt(
        circle.txHash,
        signingMetadata({
          mode: "circle-native",
          fallbackActive: false,
          authorizedAgentAddress,
          txHash: circle.txHash,
          circleTransactionId: circle.circleTransactionId,
        }),
      );
    } catch (error) {
      if (!appConfig.fallback.allowed) throw error;
    }
  }

  if (!appConfig.fallback.allowed) {
    throw new AgentError(
      "signer_unavailable",
      "No usable signing path is configured. Circle execution failed/unavailable and EOA fallback is disabled.",
      503,
    );
  }

  const args = [
    {
      action: action.action === "hold" ? 0 : action.action === "add-collateral" ? 1 : action.action === "deleverage" ? 2 : action.action === "hedge" ? 3 : 4,
      leverage: BigInt(Math.max(0, Math.round(action.leverage * 10))),
      buffer: BigInt(Math.max(0, Math.round(action.bufferBefore * 10))),
      amount: BigInt(Math.round(action.amount * 1_000_000)),
      pair: action.pair,
      venue: action.venue,
    },
    BigInt(Math.max(0, Math.round(action.bufferBefore * 10))),
    BigInt(Math.max(0, Math.round(action.bufferAfter * 10))),
  ] as const;

  const fallback = await executeViaFallback({
    contractAddress,
    functionName: "evaluateAction",
    args,
  });

  return waitForPolicyReceipt(
    fallback.txHash,
    signingMetadata({
      mode: "eoa-fallback",
      fallbackActive: true,
      authorizedAgentAddress: fallback.fallbackAgentAddress,
      fallbackAgentAddress: fallback.fallbackAgentAddress,
      txHash: fallback.txHash,
    }),
  );
}

export async function writeOwnerContract(params: {
  functionName: "setProfile" | "setPaused" | "setAutoHedge";
  args: readonly unknown[];
}): Promise<PolicySyncResult> {
  if (!appConfig.fallback.ownerPrivateKey) {
    throw new AgentError("owner_signer_unavailable", "POLICY_OWNER_PRIVATE_KEY is not configured.", 503);
  }

  const account = privateKeyToAccount(appConfig.fallback.ownerPrivateKey);
  const client = createWalletClient({
    account,
    chain: ARC_TESTNET,
    transport: http(appConfig.arc.rpcUrl),
  });

  const txHash = await client.writeContract({
    address: appConfig.deployment.contractAddress,
    abi: policyContractAbi,
    functionName: params.functionName,
    args: params.args as never,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    explorerUrl: explorerTxUrl(txHash),
    functionName: params.functionName,
  };
}

export function profileSyncArgs(profile: "Conservative" | "Balanced" | "Advanced"): readonly [number] {
  return [profileToContract(profile)];
}
