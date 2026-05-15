import { getAddress, isAddress } from "viem";
import { appConfig } from "./config.js";
import { getPolicyMetadata } from "./contract.js";
import { readIdentityProof, writeCircleWalletProof } from "./artifacts.js";
import { registerAgentIdentity } from "./identity.js";
import type { Address } from "./types.js";

type Check = { name: string; ok: boolean; detail: string };

function check(name: string, ok: boolean, detail: string): Check {
  return { name, ok, detail };
}

function checksum(value: string | null | undefined): Address | null {
  return value && isAddress(value) ? (getAddress(value) as Address) : null;
}

async function validateWallet(): Promise<void> {
  const localWallet = appConfig.circle.localWallet?.wallet ?? null;
  const metadata = await getPolicyMetadata();
  const walletAddress = checksum(appConfig.circle.walletAddress);
  const localAddress = checksum(localWallet?.address);
  const contractAgent = metadata.authorizedAgentAddress;
  const now = new Date().toISOString();

  const checks: Check[] = [
    check("local artifact", Boolean(appConfig.circle.walletArtifactPath && localWallet), "Expected .circle-local/wallet.json with wallet metadata."),
    check("wallet id", Boolean(appConfig.circle.walletId), "Expected CIRCLE_AGENT_WALLET_ID or local wallet.id."),
    check("wallet address", Boolean(walletAddress), "Expected a valid Circle agent wallet address."),
    check("local address match", Boolean(!localAddress || !walletAddress || localAddress === walletAddress), "Local wallet address must match configured wallet address."),
    check("blockchain", localWallet?.blockchain === "ARC-TESTNET", `Expected ARC-TESTNET, got ${localWallet?.blockchain ?? "missing"}.`),
    check("wallet state", !localWallet?.state || localWallet.state === "LIVE", `Expected LIVE, got ${localWallet?.state ?? "missing"}.`),
    check("policy agent", Boolean(contractAgent), "PolicyContract.agent() must be readable from Arc testnet."),
    check(
      "policy agent match",
      Boolean(walletAddress && contractAgent && walletAddress === contractAgent),
      `Circle wallet ${walletAddress ?? "missing"} must match PolicyContract.agent() ${contractAgent ?? "missing"}.`,
    ),
  ];

  const ok = checks.every((item) => item.ok);
  const artifactPath = writeCircleWalletProof({
    kind: "circle-wallet-validation",
    status: ok ? "ready" : "mismatch",
    walletId: appConfig.circle.walletId,
    walletAddress,
    walletSetId: appConfig.circle.walletSetId,
    blockchain: localWallet?.blockchain ?? null,
    accountType: localWallet?.accountType ?? null,
    walletState: localWallet?.state ?? null,
    contractAgentAddress: contractAgent,
    matchesPolicyAgent: walletAddress && contractAgent ? walletAddress === contractAgent : null,
    checks,
    envGuidance: {
      CIRCLE_AGENT_WALLET_ID: appConfig.circle.walletId ?? "",
      CIRCLE_AGENT_WALLET_ADDRESS: walletAddress ?? "",
      AGENT_WALLET_ID: appConfig.circle.walletId ?? "",
      AGENT_WALLET_ADDRESS: walletAddress ?? "",
    },
    timestamp: now,
  });

  console.log(JSON.stringify({ ok, artifactPath, checks }, null, 2));
  if (!ok) process.exitCode = 1;
}

async function registerIdentity(): Promise<void> {
  const result = await registerAgentIdentity();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "registered" && result.agentId) {
    console.log(`AGENT_ERC8004_ID=${result.agentId}`);
    return;
  }
  process.exitCode = 1;
}

function verifyIdentity(): void {
  const proof = readIdentityProof();
  const envId = appConfig.runtime.agentErc8004Id;
  const status = proof
    ? proof
    : {
        status: envId && envId !== "pending" ? "configured" : "pending",
        agentId: envId && envId !== "pending" ? envId : null,
        registryAddress: appConfig.identity.identityRegistryAddress,
        agentAddress: appConfig.circle.walletAddress,
        signerMode: envId && envId !== "pending" ? "env-only" : "none",
        blocker: envId && envId !== "pending" ? null : "No ERC-8004 identity proof artifact is present.",
      };

  console.log(JSON.stringify(status, null, 2));
  if (!proof && (!envId || envId === "pending")) process.exitCode = 1;
}

function printUsage(): void {
  console.log(`ArcMargin setup commands:
  wallet | setup:wallet | validate-wallet   Validate canonical Circle ARC-TESTNET wallet
  identity | register-identity              Register ERC-8004 identity or write blocker artifact
  identity-status | verify:identity          Print local ERC-8004 identity status
`);
}

const command = process.argv[2] ?? "wallet";

if (command === "wallet" || command === "setup:wallet" || command === "validate-wallet" || command === "verify-wallet") {
  await validateWallet();
} else if (command === "identity" || command === "register-identity" || command === "setup:identity") {
  await registerIdentity();
} else if (command === "identity-status" || command === "verify:identity") {
  verifyIdentity();
} else {
  printUsage();
  process.exitCode = 1;
}
