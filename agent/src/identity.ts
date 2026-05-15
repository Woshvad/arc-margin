import { createWalletClient, encodeFunctionData, getAddress, http, keccak256, parseEventLogs, toBytes, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET, explorerTxUrl, publicClient } from "./arc.js";
import { appConfig } from "./config.js";
import { submitContractExecutionViaCircle } from "./circle.js";
import { writeIdentityProof, safeErrorMessage } from "./artifacts.js";
import { AgentError } from "./errors.js";
import type { Address, Hex } from "./types.js";

export const identityRegistryAbi = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

interface AgentMetadata {
  name: string;
  description: string;
  agent_type: string;
  capabilities: string[];
  version: string;
  hackathon: string;
  chain_id: number;
  agent_wallet: Address | null;
  policy_contract: Address;
}

export interface IdentityRegistrationResult {
  status: "registered" | "blocked";
  agentId: string | null;
  txHash: Hex | null;
  circleTransactionId: string | null;
  explorerUrl: string | null;
  signerMode: "circle-native" | "owner-fallback" | "none";
  metadataUri: string;
  metadataHash: Hex;
  blocker: string | null;
  artifactPath: string;
}

export function buildAgentMetadata(): AgentMetadata {
  return {
    name: "ArcMargin Risk Agent v1.0",
    description:
      "Autonomous liquidation protection and collateral routing agent for perp traders. Acts only within user-defined policy constraints on Arc testnet.",
    agent_type: "risk-management",
    capabilities: [
      "liquidation_protection",
      "collateral_routing",
      "policy_enforcement",
      "deleverage_execution",
      "hedge_management",
    ],
    version: "1.0.0",
    hackathon: "Agora Agents Hackathon - Canteen x Circle x Arc",
    chain_id: appConfig.arc.chainId,
    agent_wallet: appConfig.circle.walletAddress,
    policy_contract: appConfig.deployment.contractAddress,
  };
}

export function buildMetadataUri(): { metadataUri: string; metadataHash: Hex } {
  if (appConfig.identity.metadataUriOverride) {
    return {
      metadataUri: appConfig.identity.metadataUriOverride,
      metadataHash: keccak256(toBytes(appConfig.identity.metadataUriOverride)),
    };
  }
  const json = JSON.stringify(buildAgentMetadata());
  return {
    metadataUri: `data:application/json;base64,${Buffer.from(json, "utf8").toString("base64")}`,
    metadataHash: keccak256(toBytes(json)),
  };
}

function extractMintedAgentId(logs: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>["logs"], agentAddress: Address | null): string {
  const parsed = parseEventLogs({
    abi: identityRegistryAbi,
    eventName: "Transfer",
    logs: [...logs],
  });
  const mint = parsed.find((event) => {
    const args = event.args as { from?: Address; to?: Address; tokenId?: bigint };
    return (
      args.from?.toLowerCase() === zeroAddress.toLowerCase() &&
      (!agentAddress || args.to?.toLowerCase() === agentAddress.toLowerCase()) &&
      args.tokenId !== undefined
    );
  });
  if (!mint) {
    throw new AgentError("erc8004_agent_id_missing", "IdentityRegistry transaction did not emit an ERC-721 mint Transfer event.", 502);
  }
  return ((mint.args as { tokenId: bigint }).tokenId).toString();
}

async function waitForIdentityReceipt(params: {
  txHash: Hex;
  signerMode: "circle-native" | "owner-fallback";
  metadataUri: string;
  metadataHash: Hex;
  circleTransactionId?: string | null;
}): Promise<IdentityRegistrationResult> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: params.txHash });
  if (receipt.status !== "success") {
    throw new AgentError("erc8004_registration_failed", "ERC-8004 registration transaction reverted or failed.", 502, {
      txHash: params.txHash,
    });
  }
  const agentId = extractMintedAgentId(receipt.logs, appConfig.circle.walletAddress);
  const now = new Date().toISOString();
  const artifactPath = writeIdentityProof({
    kind: "erc8004-identity-proof",
    status: "registered",
    agentId,
    registryAddress: appConfig.identity.identityRegistryAddress,
    agentAddress: appConfig.circle.walletAddress,
    metadataUri: params.metadataUri,
    metadataHash: params.metadataHash,
    txHash: params.txHash,
    circleTransactionId: params.circleTransactionId ?? null,
    explorerUrl: explorerTxUrl(params.txHash),
    signerMode: params.signerMode,
    blocker: null,
    updatedAt: now,
  });

  return {
    status: "registered",
    agentId,
    txHash: params.txHash,
    circleTransactionId: params.circleTransactionId ?? null,
    explorerUrl: explorerTxUrl(params.txHash),
    signerMode: params.signerMode,
    metadataUri: params.metadataUri,
    metadataHash: params.metadataHash,
    blocker: null,
    artifactPath,
  };
}

function writeBlockedIdentityProof(params: {
  metadataUri: string;
  metadataHash: Hex;
  signerMode: "circle-native" | "owner-fallback" | "none";
  blocker: string;
}): IdentityRegistrationResult {
  const now = new Date().toISOString();
  const artifactPath = writeIdentityProof({
    kind: "erc8004-identity-proof",
    status: "blocked",
    agentId: null,
    registryAddress: appConfig.identity.identityRegistryAddress,
    agentAddress: appConfig.circle.walletAddress,
    metadataUri: params.metadataUri,
    metadataHash: params.metadataHash,
    txHash: null,
    circleTransactionId: null,
    explorerUrl: null,
    signerMode: params.signerMode,
    blocker: params.blocker,
    updatedAt: now,
  });

  return {
    status: "blocked",
    agentId: null,
    txHash: null,
    circleTransactionId: null,
    explorerUrl: null,
    signerMode: params.signerMode,
    metadataUri: params.metadataUri,
    metadataHash: params.metadataHash,
    blocker: params.blocker,
    artifactPath,
  };
}

async function registerViaOwner(callData: Hex, metadataUri: string, metadataHash: Hex): Promise<IdentityRegistrationResult> {
  if (!appConfig.identity.allowOwnerFallback || !appConfig.fallback.ownerPrivateKey) {
    throw new AgentError(
      "identity_owner_fallback_disabled",
      "ERC-8004 owner fallback is disabled. Set ALLOW_IDENTITY_OWNER_FALLBACK=true and POLICY_OWNER_PRIVATE_KEY to use it.",
      503,
    );
  }
  const account = privateKeyToAccount(appConfig.fallback.ownerPrivateKey);
  const client = createWalletClient({
    account,
    chain: ARC_TESTNET,
    transport: http(appConfig.arc.rpcUrl),
  });
  const txHash = await client.sendTransaction({
    account,
    chain: ARC_TESTNET,
    to: appConfig.identity.identityRegistryAddress,
    data: callData,
  });
  return waitForIdentityReceipt({ txHash, signerMode: "owner-fallback", metadataUri, metadataHash });
}

export async function registerAgentIdentity(): Promise<IdentityRegistrationResult> {
  if (!appConfig.circle.walletAddress) {
    const { metadataUri, metadataHash } = buildMetadataUri();
    return writeBlockedIdentityProof({
      metadataUri,
      metadataHash,
      signerMode: "none",
      blocker: "Circle agent wallet address is not configured.",
    });
  }

  const { metadataUri, metadataHash } = buildMetadataUri();
  const callData = encodeFunctionData({
    abi: identityRegistryAbi,
    functionName: "register",
    args: [metadataUri],
  });

  if (appConfig.circle.configured) {
    try {
      const circle = await submitContractExecutionViaCircle({
        callData,
        contractAddress: appConfig.identity.identityRegistryAddress,
        refId: `arcmargin-erc8004-${Date.now()}`,
        timeoutMs: appConfig.runtime.contractCallTimeoutMs,
      });
      return waitForIdentityReceipt({
        txHash: circle.txHash,
        signerMode: "circle-native",
        metadataUri,
        metadataHash,
        circleTransactionId: circle.circleTransactionId,
      });
    } catch (error) {
      if (appConfig.identity.allowOwnerFallback && appConfig.fallback.ownerPrivateKey) {
        return registerViaOwner(callData, metadataUri, metadataHash);
      }
      const blocker = safeErrorMessage(error);
      return writeBlockedIdentityProof({
        metadataUri,
        metadataHash,
        signerMode: "circle-native",
        blocker,
      });
    }
  }

  if (appConfig.identity.allowOwnerFallback && appConfig.fallback.ownerPrivateKey) {
    return registerViaOwner(callData, metadataUri, metadataHash);
  }

  return writeBlockedIdentityProof({
    metadataUri,
    metadataHash,
    signerMode: "none",
    blocker: "Circle credentials are not configured and owner fallback is disabled.",
  });
}
