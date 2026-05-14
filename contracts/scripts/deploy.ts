import { spawnSync } from "node:child_process";
import hre from "hardhat";
import { createPublicClient, formatEther, getAddress, http, isAddress, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  explorerAddressUrl,
  explorerTxUrl,
  type ReadinessArtifact,
  type ValidationCheck,
  writeDeploymentArtifacts,
  writeReadinessArtifacts,
} from "./lib/deploymentArtifacts";

const ARC_CHAIN_ID = 5042002;
const DEFAULT_RPC_URL = "https://rpc.testnet.arc.network";

interface AgentResolution {
  agent: Address;
  temporaryAgent: boolean;
  requiresSetAgent: boolean;
  envPassed: boolean;
  missing: string[];
  nextActions: string[];
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function normalizeEnvAddress(name: string): Address | undefined {
  const value = readEnv(name);
  if (!value) return undefined;
  if (!isAddress(value)) {
    throw new Error(`${name} is set but is not a valid EVM address`);
  }
  return getAddress(value);
}

function normalizePrivateKey(value: string): `0x${string}` {
  const privateKey = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key.");
  }
  return privateKey as `0x${string}`;
}

function configuredDeployerAddress(fallback: Address): Address {
  const privateKey = readEnv("DEPLOYER_PRIVATE_KEY");
  if (!privateKey) return fallback;
  return getAddress(privateKeyToAccount(normalizePrivateKey(privateKey)).address);
}

async function getArcNativeBalance(address: Address): Promise<bigint | null> {
  try {
    const client = createPublicClient({
      transport: http(readEnv("ARC_RPC_URL") ?? DEFAULT_RPC_URL),
    });
    return await client.getBalance({ address });
  } catch {
    return null;
  }
}

function runNpmTest(): ValidationCheck {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm test"] : ["test"];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status === 0) {
    return {
      status: "passed",
      detail: "npm test exited 0",
    };
  }

  const detail = `${result.error?.message || result.stderr || result.stdout || "npm test failed"}`.trim();
  return {
    status: "failed",
    detail: detail.slice(0, 500),
  };
}

function resolveAgent(deployer: Address): AgentResolution {
  const realAgent = normalizeEnvAddress("AGENT_WALLET_ADDRESS");
  if (realAgent) {
    return {
      agent: realAgent,
      temporaryAgent: false,
      requiresSetAgent: false,
      envPassed: true,
      missing: [],
      nextActions: [
        "Fund deployer with Arc testnet USDC gas before broadcast",
        "Run npm run deploy:arc only after approving the broadcast",
      ],
    };
  }

  if (process.env.ALLOW_TEMP_AGENT !== "true") {
    return {
      agent: deployer,
      temporaryAgent: false,
      requiresSetAgent: false,
      envPassed: false,
      missing: [
        "AGENT_WALLET_ADDRESS is required by default",
        "Set ALLOW_TEMP_AGENT=true only for an explicit temporary deployment",
      ],
      nextActions: [
        "Set AGENT_WALLET_ADDRESS to the Circle agent wallet address",
        "Or set ALLOW_TEMP_AGENT=true and optionally TEMP_AGENT_ADDRESS for temporary mode",
      ],
    };
  }

  const tempAgent = normalizeEnvAddress("TEMP_AGENT_ADDRESS");
  const agent = tempAgent ?? deployer;
  if (!tempAgent) {
    console.warn(
      "WARNING: ALLOW_TEMP_AGENT=true but TEMP_AGENT_ADDRESS is unset; using deployer as temporary agent.",
    );
  }

  return {
    agent,
    temporaryAgent: true,
    requiresSetAgent: true,
    envPassed: true,
    missing: ["Real AGENT_WALLET_ADDRESS is not configured"],
    nextActions: [
      "Call setAgent(realAgent) before backend integration",
      "Record the final Circle agent wallet address in AGENT_WALLET_ADDRESS",
    ],
  };
}

function externalPrerequisites(agentResolution: AgentResolution, deployerBalance: bigint | null) {
  const missing = [...agentResolution.missing];
  if (!readEnv("DEPLOYER_PRIVATE_KEY")) {
    missing.push("DEPLOYER_PRIVATE_KEY with funded Arc testnet USDC gas");
  }
  if (deployerBalance === null) {
    missing.push("Arc faucet funding could not be verified from the configured RPC");
  } else if (deployerBalance === 0n) {
    missing.push("Arc faucet funding for deployer is required; current native gas balance is 0");
  }
  return missing;
}

function createReadiness(
  deployer: Address,
  resolution: AgentResolution,
  tests: ValidationCheck,
  deployerBalance: bigint | null,
): ReadinessArtifact {
  const envCheck: ValidationCheck = resolution.envPassed
    ? {
        status: "passed",
        detail: resolution.temporaryAgent
          ? "Temporary agent mode explicitly enabled with ALLOW_TEMP_AGENT=true"
          : "AGENT_WALLET_ADDRESS configured",
      }
    : {
        status: "failed",
        detail:
          "Missing AGENT_WALLET_ADDRESS. Set ALLOW_TEMP_AGENT=true only for explicit temporary mode.",
      };

  return {
    contractName: "PolicyContract",
    status: resolution.envPassed && tests.status === "passed" ? "ready_to_deploy" : "blocked",
    chainId: ARC_CHAIN_ID,
    rpcUrl: readEnv("ARC_RPC_URL") ?? DEFAULT_RPC_URL,
    deployer,
    agent: resolution.envPassed ? resolution.agent : null,
    temporaryAgent: resolution.temporaryAgent,
    requiresSetAgent: resolution.requiresSetAgent,
    timestamp: new Date().toISOString(),
    validation: {
      compile: {
        status: "passed",
        detail: "Hardhat compile completed before deploy script execution",
      },
      tests,
      env: envCheck,
    },
    missingPrerequisites: externalPrerequisites(resolution, deployerBalance),
    nextActions: [
      ...resolution.nextActions,
      ...(deployerBalance === 0n
        ? [`Fund deployer ${deployer} with Arc testnet USDC gas from the Circle faucet`]
        : []),
    ],
  };
}

async function getDeployer(): Promise<Address> {
  const [deployer] = await hre.viem.getWalletClients();
  if (!deployer?.account?.address) {
    throw new Error(
      "No deployer account available. Set DEPLOYER_PRIVATE_KEY before broadcasting to Arc testnet.",
    );
  }
  return getAddress(deployer.account.address);
}

async function main() {
  const validateOnly = process.env.DEPLOY_VALIDATE_ONLY === "true" || hre.network.name === "hardhat";
  const walletClientDeployer = await getDeployer();
  const deployer = validateOnly ? configuredDeployerAddress(walletClientDeployer) : walletClientDeployer;
  const resolution = resolveAgent(deployer);

  if (validateOnly) {
    const tests = runNpmTest();
    const deployerBalance = await getArcNativeBalance(deployer);
    const readiness = createReadiness(deployer, resolution, tests, deployerBalance);
    const paths = writeReadinessArtifacts(readiness);

    console.log("Arc testnet deployment validation complete.");
    console.log(`Readiness JSON: ${paths.readinessJson}`);
    console.log(`Readiness Markdown: ${paths.readinessMarkdown}`);

    if (!resolution.envPassed) {
      throw new Error(
        "Missing AGENT_WALLET_ADDRESS. Set AGENT_WALLET_ADDRESS or set ALLOW_TEMP_AGENT=true for explicit temporary mode.",
      );
    }
    if (tests.status !== "passed") {
      throw new Error(`Contract tests failed during deploy validation: ${tests.detail}`);
    }
    return;
  }

  const publicClient = await hre.viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  if (chainId !== ARC_CHAIN_ID) {
    throw new Error(`Refusing to deploy: expected Arc testnet chain ${ARC_CHAIN_ID}, got ${chainId}`);
  }
  if (!readEnv("DEPLOYER_PRIVATE_KEY")) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required before broadcasting to Arc testnet.");
  }
  if (!resolution.envPassed) {
    throw new Error(
      "Missing AGENT_WALLET_ADDRESS. Set AGENT_WALLET_ADDRESS or set ALLOW_TEMP_AGENT=true for explicit temporary mode.",
    );
  }

  console.log("Deploying PolicyContract to Arc testnet");
  console.log(`Deployer: ${deployer}`);
  console.log(`Agent: ${resolution.agent}`);
  if (resolution.temporaryAgent) {
    console.warn("WARNING: Temporary agent mode is active. Call setAgent(realAgent) before backend integration.");
  }

  const { contract, deploymentTransaction } = await hre.viem.sendDeploymentTransaction(
    "PolicyContract",
    [resolution.agent],
  );
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deploymentTransaction.hash,
  });
  const contractAddress = getAddress(receipt.contractAddress ?? contract.address);
  const txHash = deploymentTransaction.hash;
  const deploymentNextActions = [
    `Set POLICY_CONTRACT_ADDRESS=${contractAddress} in agent/.env`,
    `Set AGENT_WALLET_ADDRESS=${resolution.agent} in agent/.env`,
    "Run npm run verify:deployment any time you need to re-check deployed contract state",
    ...(resolution.temporaryAgent
      ? ["Call setAgent(realAgent) before backend integration"]
      : []),
  ];

  const artifact = {
    contractName: "PolicyContract" as const,
    contractAddress,
    chainId: ARC_CHAIN_ID as const,
    rpcUrl: readEnv("ARC_RPC_URL") ?? DEFAULT_RPC_URL,
    explorerAddressUrl: explorerAddressUrl(contractAddress),
    explorerTxUrl: explorerTxUrl(txHash),
    deployer,
    agent: resolution.agent,
    temporaryAgent: resolution.temporaryAgent,
    requiresSetAgent: resolution.requiresSetAgent,
    transactionHash: txHash,
    timestamp: new Date().toISOString(),
    nextActions: deploymentNextActions,
  };
  const paths = writeDeploymentArtifacts(artifact);

  console.log(`PolicyContract deployed to: ${contractAddress}`);
  console.log(`ArcScan address: ${artifact.explorerAddressUrl}`);
  console.log(`ArcScan transaction: ${artifact.explorerTxUrl}`);
  console.log(`Deployment JSON: ${paths.latestJson}`);
  console.log(`Deployment Markdown: ${paths.latestMarkdown}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
