import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getAddress, isAddress } from "viem";
import type { Address, Hex } from "./types.js";

interface DeploymentArtifact {
  contractAddress?: string;
  chainId?: number;
  rpcUrl?: string;
  explorerAddressUrl?: string;
  deployer?: string;
  agent?: string;
}

interface LocalCircleWallet {
  wallet?: {
    id?: string;
    address?: string;
    blockchain?: string;
    accountType?: string;
    state?: string;
  };
  walletSetId?: string;
}

export interface AppConfig {
  projectRoot: string;
  agentRoot: string;
  server: {
    port: number;
    corsOrigin: string;
  };
  arc: {
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
  };
  deployment: {
    contractAddress: Address;
    ownerAddress: Address | null;
    agentAddress: Address | null;
    artifactPath: string | null;
  };
  circle: {
    apiKey: string | null;
    entitySecret: string | null;
    walletId: string | null;
    walletAddress: Address | null;
    walletSetId: string | null;
    configured: boolean;
  };
  fallback: {
    allowed: boolean;
    privateKey: Hex | null;
    ownerPrivateKey: Hex | null;
  };
  runtime: {
    dbPath: string;
    contractCallTimeoutMs: number;
    autopilotWritesEnabled: boolean;
    agentErc8004Id: string;
  };
}

function discoverProjectRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, path.dirname(cwd)];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, ".planning")) || fs.existsSync(path.join(candidate, "contracts"))) {
      return candidate;
    }
  }
  return cwd;
}

const projectRoot = discoverProjectRoot();
const agentRoot = fs.existsSync(path.join(projectRoot, "agent")) ? path.join(projectRoot, "agent") : projectRoot;

function loadEnvFile(filePath: string, override = false): void {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override, quiet: true });
  }
}

loadEnvFile(path.join(projectRoot, "contracts", ".env"));
loadEnvFile(path.join(projectRoot, ".circle.local.env"));
loadEnvFile(path.join(agentRoot, ".env"), true);

function readJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function findDeploymentArtifact(): { artifact: DeploymentArtifact | null; filePath: string | null } {
  const candidates = [
    path.join(projectRoot, "contracts", "deployments", "arc-testnet-latest.json"),
    path.join(agentRoot, "..", "contracts", "deployments", "arc-testnet-latest.json"),
  ];
  for (const filePath of candidates) {
    const artifact = readJson<DeploymentArtifact>(filePath);
    if (artifact?.contractAddress) return { artifact, filePath };
  }
  return { artifact: null, filePath: null };
}

function findCircleWallet(): LocalCircleWallet | null {
  const candidates = [
    path.join(projectRoot, ".circle-local", "wallet.json"),
    path.join(agentRoot, "..", ".circle-local", "wallet.json"),
  ];
  for (const filePath of candidates) {
    const wallet = readJson<LocalCircleWallet>(filePath);
    if (wallet?.wallet?.id || wallet?.wallet?.address) return wallet;
  }
  return null;
}

function asAddress(value: string | null | undefined): Address | null {
  if (!value || !isAddress(value)) return null;
  return getAddress(value) as Address;
}

function asHex(value: string | null | undefined): Hex | null {
  if (!value) return null;
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  return /^0x[0-9a-fA-F]+$/.test(prefixed) ? (prefixed as Hex) : null;
}

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : null;
}

function envNumber(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string, fallback = false): boolean {
  const raw = env(name);
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

const { artifact: deployment, filePath: deploymentArtifactPath } = findDeploymentArtifact();
const circleWallet = findCircleWallet();

const contractAddress =
  asAddress(env("POLICY_CONTRACT_ADDRESS")) ??
  asAddress(deployment?.contractAddress) ??
  null;

if (!contractAddress) {
  throw new Error("POLICY_CONTRACT_ADDRESS is not configured and no deployment artifact was found.");
}

const circleWalletAddress =
  asAddress(env("CIRCLE_AGENT_WALLET_ADDRESS")) ??
  asAddress(env("AGENT_WALLET_ADDRESS")) ??
  asAddress(circleWallet?.wallet?.address) ??
  asAddress(deployment?.agent);

const circleWalletId =
  env("CIRCLE_AGENT_WALLET_ID") ??
  env("AGENT_WALLET_ID") ??
  circleWallet?.wallet?.id ??
  null;

const ownerPrivateKey = asHex(env("POLICY_OWNER_PRIVATE_KEY") ?? env("DEPLOYER_PRIVATE_KEY"));
const fallbackAllowed = envBool("ALLOW_EOA_FALLBACK", false);

export const appConfig: AppConfig = {
  projectRoot,
  agentRoot,
  server: {
    port: envNumber("PORT", 3001),
    corsOrigin: env("CORS_ORIGIN") ?? "*",
  },
  arc: {
    chainId: envNumber("ARC_CHAIN_ID", deployment?.chainId ?? 5042002),
    rpcUrl: env("ARC_RPC_URL") ?? deployment?.rpcUrl ?? "https://rpc.testnet.arc.network",
    explorerUrl: env("ARC_EXPLORER_URL") ?? "https://testnet.arcscan.app",
  },
  deployment: {
    contractAddress,
    ownerAddress: asAddress(deployment?.deployer),
    agentAddress: asAddress(deployment?.agent),
    artifactPath: deploymentArtifactPath,
  },
  circle: {
    apiKey: env("CIRCLE_API_KEY"),
    entitySecret: env("CIRCLE_ENTITY_SECRET"),
    walletId: circleWalletId,
    walletAddress: circleWalletAddress,
    walletSetId: env("AGENT_WALLET_SET_ID") ?? circleWallet?.walletSetId ?? null,
    configured: Boolean(env("CIRCLE_API_KEY") && env("CIRCLE_ENTITY_SECRET") && circleWalletId),
  },
  fallback: {
    allowed: fallbackAllowed,
    privateKey: asHex(env("FALLBACK_AGENT_PRIVATE_KEY")) ?? (fallbackAllowed ? ownerPrivateKey : null),
    ownerPrivateKey,
  },
  runtime: {
    dbPath: path.resolve(agentRoot, env("AGENT_DB_PATH") ?? "./arcmargin.sqlite"),
    contractCallTimeoutMs: envNumber("CONTRACT_CALL_TIMEOUT_MS", 180_000),
    autopilotWritesEnabled: envBool("ENABLE_AUTOPILOT_WRITES", false),
    agentErc8004Id: env("AGENT_ERC8004_ID") ?? "pending",
  },
};
