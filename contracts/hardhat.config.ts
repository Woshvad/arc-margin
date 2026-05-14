import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";

dotenv.config();

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY
  ? process.env.DEPLOYER_PRIVATE_KEY.startsWith("0x")
    ? process.env.DEPLOYER_PRIVATE_KEY
    : `0x${process.env.DEPLOYER_PRIVATE_KEY}`
  : undefined;

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    arcTestnet: {
      url: process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
      gasPrice: "auto",
    },
  },
};

export default config;
