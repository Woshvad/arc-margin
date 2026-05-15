import { createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET, publicClient } from "./arc.js";
import { appConfig } from "./config.js";
import { AgentError } from "./errors.js";
import { policyContractAbi } from "./policyAbi.js";
import { writeFallbackArtifact } from "./artifacts.js";
import type { Address, Hex } from "./types.js";

export async function executeViaFallback(params: {
  contractAddress: Address;
  functionName: "evaluateAction";
  args: readonly unknown[];
}): Promise<{ txHash: Hex; fallbackAgentAddress: Address; setAgentTxHash: Hex | null }> {
  if (!appConfig.fallback.allowed || !appConfig.fallback.privateKey) {
    throw new AgentError(
      "fallback_disabled",
      "EOA fallback is disabled. Set ALLOW_EOA_FALLBACK=true and FALLBACK_AGENT_PRIVATE_KEY to use it.",
      503,
    );
  }

  const fallbackAccount = privateKeyToAccount(appConfig.fallback.privateKey);
  const fallbackAddress = getAddress(fallbackAccount.address) as Address;
  const currentAgent = await readAuthorizedAgent(params.contractAddress);
  let setAgentTxHash: Hex | null = null;

  if (getAddress(currentAgent) !== fallbackAddress) {
    if (!appConfig.fallback.ownerPrivateKey) {
      throw new AgentError(
        "owner_signer_unavailable",
        "Fallback needs setAgent(), but POLICY_OWNER_PRIVATE_KEY is not configured.",
        503,
      );
    }

    const owner = privateKeyToAccount(appConfig.fallback.ownerPrivateKey);
    const ownerClient = createWalletClient({
      account: owner,
      chain: ARC_TESTNET,
      transport: http(appConfig.arc.rpcUrl),
    });

    setAgentTxHash = await ownerClient.writeContract({
      address: params.contractAddress,
      abi: policyContractAbi,
      functionName: "setAgent",
      args: [fallbackAddress],
    });
    await publicClient.waitForTransactionReceipt({ hash: setAgentTxHash });

    writeFallbackArtifact({
      kind: "fallback-agent-authorization",
      contractAddress: params.contractAddress,
      previousCircleAgent: appConfig.circle.walletAddress,
      previousAuthorizedAgent: currentAgent,
      fallbackAgent: fallbackAddress,
      setAgentTxHash,
      timestamp: new Date().toISOString(),
      restore: {
        instruction: appConfig.circle.walletAddress
          ? `Call setAgent(${appConfig.circle.walletAddress}) with the policy owner signer to restore Circle-native authorization.`
          : "Call setAgent(circleAgentAddress) with the policy owner signer once Circle authorization is known.",
        targetAgent: appConfig.circle.walletAddress,
      },
    });
  }

  const fallbackClient = createWalletClient({
    account: fallbackAccount,
    chain: ARC_TESTNET,
    transport: http(appConfig.arc.rpcUrl),
  });

  const txHash = await fallbackClient.writeContract({
    address: params.contractAddress,
    abi: policyContractAbi,
    functionName: params.functionName,
    args: params.args as never,
  });

  return { txHash, fallbackAgentAddress: fallbackAddress, setAgentTxHash };
}

export async function readAuthorizedAgent(contractAddress: Address): Promise<Address> {
  const result = await publicClient.readContract({
    address: contractAddress,
    abi: policyContractAbi,
    functionName: "getAgent",
  });
  return getAddress(result as string) as Address;
}
