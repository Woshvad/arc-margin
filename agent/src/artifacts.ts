import fs from "node:fs";
import path from "node:path";
import { appConfig } from "./config.js";
import type { Address, Hex, IdentityIntegrationStatus } from "./types.js";

export interface FallbackArtifact {
  kind: "fallback-agent-authorization";
  contractAddress: Address;
  previousCircleAgent: Address | null;
  previousAuthorizedAgent: Address;
  fallbackAgent: Address;
  setAgentTxHash: Hex;
  timestamp: string;
  restore: {
    instruction: string;
    targetAgent: Address | null;
  };
}

export function writeFallbackArtifact(artifact: FallbackArtifact): void {
  writeJsonArtifact("fallback-agent", artifact, artifact.timestamp);
}

export interface CircleWalletProofArtifact {
  kind: "circle-wallet-validation";
  status: "ready" | "mismatch" | "error";
  walletId: string | null;
  walletAddress: Address | null;
  walletSetId: string | null;
  blockchain: string | null;
  accountType: string | null;
  walletState: string | null;
  contractAgentAddress: Address | null;
  matchesPolicyAgent: boolean | null;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  envGuidance: Record<string, string>;
  timestamp: string;
}

export interface IdentityProofArtifact extends IdentityIntegrationStatus {
  kind: "erc8004-identity-proof";
}

export function artifactsDir(): string {
  return path.join(appConfig.agentRoot, "artifacts");
}

export function artifactPath(name: string): string {
  return path.join(artifactsDir(), name);
}

export function writeJsonArtifact<T extends object>(prefix: string, artifact: T, timestamp = new Date().toISOString()): string {
  const dir = artifactsDir();
  fs.mkdirSync(dir, { recursive: true });

  const stamped = `${prefix}-${timestamp.replace(/[:.]/g, "-")}.json`;
  const payload = `${JSON.stringify(artifact, null, 2)}\n`;
  const stampedPath = path.join(dir, stamped);
  fs.writeFileSync(stampedPath, payload);
  fs.writeFileSync(path.join(dir, `${prefix}-latest.json`), payload);
  return stampedPath;
}

export function readJsonArtifact<T>(name: string): T | null {
  const filePath = artifactPath(name);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function readLatestArtifact<T>(prefix: string): T | null {
  return readJsonArtifact<T>(`${prefix}-latest.json`);
}

export function writeCircleWalletProof(artifact: CircleWalletProofArtifact): string {
  return writeJsonArtifact("circle-wallet", artifact, artifact.timestamp);
}

export function readCircleWalletProof(): CircleWalletProofArtifact | null {
  return readLatestArtifact<CircleWalletProofArtifact>("circle-wallet");
}

export function writeIdentityProof(artifact: IdentityProofArtifact): string {
  return writeJsonArtifact("erc8004-identity", artifact, artifact.updatedAt ?? new Date().toISOString());
}

export function readIdentityProof(): IdentityProofArtifact | null {
  return readLatestArtifact<IdentityProofArtifact>("erc8004-identity");
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}
