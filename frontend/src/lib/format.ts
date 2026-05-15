import type { Address, Receipt } from "../types/agent";

export function fmt(value: number, digits = 2): string {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtMoney(value: number, digits = 0): string {
  return "$" + Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtSigned(value: number, prefix = "$"): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${prefix}${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

export function shortAddress(address?: Address | string | null): string {
  if (!address) return "Not configured";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return "Pending";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleTimeString("en-US", { hour12: false });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "Pending";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString("en-US");
}

export function receiptTrustLabel(receipt: Receipt): string {
  if (receipt.txHash || receipt.explorerUrl) return "Real Arc tx";
  if (receipt.seeded) return "Seed demo";
  if (receipt.status === "simulated") return "Simulated";
  return "API receipt";
}
