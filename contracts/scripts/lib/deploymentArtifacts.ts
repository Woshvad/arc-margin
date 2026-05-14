import fs from "node:fs";
import path from "node:path";

const DEPLOYMENTS_DIR = path.resolve(process.cwd(), "deployments");
const ARC_EXPLORER = "https://testnet.arcscan.app";

export type ValidationStatus = "passed" | "failed" | "not_run";

export interface ValidationCheck {
  status: ValidationStatus;
  detail: string;
}

export interface DeploymentArtifact {
  contractName: "PolicyContract";
  contractAddress: string;
  chainId: 5042002;
  rpcUrl: string;
  explorerAddressUrl: string;
  explorerTxUrl: string;
  deployer: string;
  agent: string;
  temporaryAgent: boolean;
  requiresSetAgent: boolean;
  transactionHash: string;
  timestamp: string;
  nextActions: string[];
}

export interface ReadinessArtifact {
  contractName: "PolicyContract";
  status: "ready_to_deploy" | "blocked";
  chainId: 5042002;
  rpcUrl: string;
  deployer: string;
  agent: string | null;
  temporaryAgent: boolean;
  requiresSetAgent: boolean;
  timestamp: string;
  validation: {
    compile: ValidationCheck;
    tests: ValidationCheck;
    env: ValidationCheck;
  };
  missingPrerequisites: string[];
  nextActions: string[];
}

function ensureDeploymentsDir() {
  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
}

function timestampForFile(timestamp: string): string {
  return timestamp.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
}

function writeJson(fileName: string, payload: unknown) {
  fs.writeFileSync(
    path.join(DEPLOYMENTS_DIR, fileName),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

function writeMarkdown(fileName: string, content: string) {
  fs.writeFileSync(path.join(DEPLOYMENTS_DIR, fileName), content, "utf8");
}

export function explorerAddressUrl(address: string) {
  return `${ARC_EXPLORER}/address/${address}`;
}

export function explorerTxUrl(txHash: string) {
  return `${ARC_EXPLORER}/tx/${txHash}`;
}

export function writeDeploymentArtifacts(artifact: DeploymentArtifact) {
  ensureDeploymentsDir();

  const stamp = timestampForFile(artifact.timestamp);
  writeJson("arc-testnet-latest.json", artifact);
  writeJson(`arc-testnet-${stamp}.json`, artifact);
  writeMarkdown("arc-testnet-latest.md", renderDeploymentMarkdown(artifact));
  writeMarkdown(`arc-testnet-${stamp}.md`, renderDeploymentMarkdown(artifact));

  return {
    latestJson: path.join(DEPLOYMENTS_DIR, "arc-testnet-latest.json"),
    latestMarkdown: path.join(DEPLOYMENTS_DIR, "arc-testnet-latest.md"),
  };
}

export function writeReadinessArtifacts(artifact: ReadinessArtifact) {
  ensureDeploymentsDir();

  writeJson("arc-testnet-readiness.json", artifact);
  writeMarkdown("arc-testnet-readiness.md", renderReadinessMarkdown(artifact));

  return {
    readinessJson: path.join(DEPLOYMENTS_DIR, "arc-testnet-readiness.json"),
    readinessMarkdown: path.join(DEPLOYMENTS_DIR, "arc-testnet-readiness.md"),
  };
}

function renderDeploymentMarkdown(artifact: DeploymentArtifact) {
  return `# Arc Testnet Deployment Proof

PolicyContract is deployed on Arc testnet.

| Field | Value |
|-------|-------|
| Contract | ${artifact.contractName} |
| Address | ${artifact.contractAddress} |
| Chain ID | ${artifact.chainId} |
| Deployer | ${artifact.deployer} |
| Agent | ${artifact.agent} |
| Temporary Agent | ${artifact.temporaryAgent ? "yes" : "no"} |
| Requires setAgent | ${artifact.requiresSetAgent ? "yes" : "no"} |
| Transaction | ${artifact.transactionHash} |
| Timestamp | ${artifact.timestamp} |

- ArcScan address: ${artifact.explorerAddressUrl}
- ArcScan transaction: ${artifact.explorerTxUrl}

## Next Actions

${artifact.nextActions.map((item) => `- ${item}`).join("\n")}
`;
}

function renderReadinessMarkdown(artifact: ReadinessArtifact) {
  return `# Arc Testnet Deployment Readiness

PolicyContract has not been broadcast by this artifact. This file records readiness and missing external prerequisites.

| Field | Value |
|-------|-------|
| Status | ${artifact.status} |
| Chain ID | ${artifact.chainId} |
| RPC URL | ${artifact.rpcUrl} |
| Deployer | ${artifact.deployer} |
| Agent | ${artifact.agent ?? "not configured"} |
| Temporary Agent | ${artifact.temporaryAgent ? "yes" : "no"} |
| Requires setAgent | ${artifact.requiresSetAgent ? "yes" : "no"} |
| Timestamp | ${artifact.timestamp} |

## Validation

| Check | Status | Detail |
|-------|--------|--------|
| Compile | ${artifact.validation.compile.status} | ${artifact.validation.compile.detail} |
| Tests | ${artifact.validation.tests.status} | ${artifact.validation.tests.detail} |
| Env | ${artifact.validation.env.status} | ${artifact.validation.env.detail} |

## Missing Prerequisites

${artifact.missingPrerequisites.length > 0 ? artifact.missingPrerequisites.map((item) => `- ${item}`).join("\n") : "- None"}

## Next Actions

${artifact.nextActions.map((item) => `- ${item}`).join("\n")}
`;
}
