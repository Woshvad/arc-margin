import { createPublicClient, defineChain, formatUnits, http, parseUnits } from "viem";
import type { Address, Hex } from "./types.js";
import { appConfig } from "./config.js";

export const ARC_TESTNET = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

export const publicClient = createPublicClient({
  chain: ARC_TESTNET,
  transport: http(appConfig.arc.rpcUrl),
});

export function explorerTxUrl(hash: Hex): string {
  return `${appConfig.arc.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}

export function explorerAddressUrl(address: Address): string {
  return `${appConfig.arc.explorerUrl.replace(/\/$/, "")}/address/${address}`;
}

export function randomTxId(seed = Date.now()): string {
  return `ARC-${Math.abs(seed).toString(16).padStart(8, "0").slice(-8).toUpperCase()}`;
}

export function txDisplayId(hash: Hex): string {
  return `ARC-${hash.slice(2, 10).toUpperCase()}`;
}

export function toPolicyAmount(amountUsdc: number): bigint {
  return parseUnits(amountUsdc.toFixed(6), 6);
}

export function fromPolicyAmount(amount: bigint): number {
  return Number(formatUnits(amount, 6));
}

export function toNativeGasAmount(amount: bigint): number {
  return Number(formatUnits(amount, 18));
}

export function toScaledTenths(value: number): bigint {
  return BigInt(Math.max(0, Math.round(value * 10)));
}

export function fromScaledTenths(value: bigint): number {
  return Number(value) / 10;
}

export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
