import fs from "node:fs";
import path from "node:path";
import { appConfig } from "./config.js";
import type { Address, Hex } from "./types.js";

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
  const dir = path.join(appConfig.agentRoot, "artifacts");
  fs.mkdirSync(dir, { recursive: true });

  const stamped = `fallback-agent-${artifact.timestamp.replace(/[:.]/g, "-")}.json`;
  const payload = `${JSON.stringify(artifact, null, 2)}\n`;
  fs.writeFileSync(path.join(dir, stamped), payload);
  fs.writeFileSync(path.join(dir, "fallback-agent-latest.json"), payload);
}
