import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { getAddress, isAddress } from "viem";

const ARC_CHAIN_ID = 5042002;
const EXPLORER_ADDRESS_BASE = "https://testnet.arcscan.app/address";

function readDeploymentAddress(): string {
  const envAddress = process.env.POLICY_CONTRACT_ADDRESS?.trim();
  if (envAddress) {
    if (!isAddress(envAddress)) {
      throw new Error("POLICY_CONTRACT_ADDRESS is set but is not a valid EVM address.");
    }
    return getAddress(envAddress);
  }

  const latestPath = path.resolve(process.cwd(), "deployments", "arc-testnet-latest.json");
  if (!fs.existsSync(latestPath)) {
    throw new Error(
      "No deployment address found. Set POLICY_CONTRACT_ADDRESS or run npm run deploy:arc after funding Arc testnet credentials.",
    );
  }

  const artifact = JSON.parse(fs.readFileSync(latestPath, "utf8")) as {
    contractAddress?: string;
  };
  if (!artifact.contractAddress || !isAddress(artifact.contractAddress)) {
    throw new Error(
      "No deployed PolicyContract address exists in deployments/arc-testnet-latest.json.",
    );
  }
  return getAddress(artifact.contractAddress);
}

async function main() {
  const address = readDeploymentAddress();
  const publicClient = await hre.viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  if (chainId !== ARC_CHAIN_ID) {
    throw new Error(`Expected Arc testnet chain ${ARC_CHAIN_ID}, got ${chainId}`);
  }

  const artifact = await hre.artifacts.readArtifact("PolicyContract");
  const owner = await publicClient.readContract({
    address,
    abi: artifact.abi,
    functionName: "owner",
  });
  const agent = await publicClient.readContract({
    address,
    abi: artifact.abi,
    functionName: "getAgent",
  });
  const policy = await publicClient.readContract({
    address,
    abi: artifact.abi,
    functionName: "getPolicy",
  });
  const dailyCapRemaining = await publicClient.readContract({
    address,
    abi: artifact.abi,
    functionName: "getDailyCapRemaining",
  });

  console.log("PolicyContract deployment verified.");
  console.log(`Address: ${address}`);
  console.log(`ArcScan: ${EXPLORER_ADDRESS_BASE}/${address}`);
  console.log(`Owner: ${owner}`);
  console.log(`Agent: ${agent}`);
  console.log(`Policy: ${JSON.stringify(policy, (_, value) => (typeof value === "bigint" ? value.toString() : value))}`);
  console.log(`Daily cap remaining: ${dailyCapRemaining}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
