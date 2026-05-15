import type { ChainState, Receipt } from "../types/agent";

export function sortedReceipts(receipts: Receipt[]): Receipt[] {
  return [...receipts].sort((a, b) => {
    const aTime = Date.parse(a.time);
    const bTime = Date.parse(b.time);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) return bTime - aTime;
    return (b.receiptId ?? 0) - (a.receiptId ?? 0);
  });
}

export function receiptTitleClass(receipt: Receipt): string {
  if (receipt.status === "blocked") return "red";
  if (receipt.status === "simulated") return "amber";
  return "green";
}

export function explorerUrl(receipt: Receipt, chain: ChainState): string | null {
  if (receipt.explorerUrl) return receipt.explorerUrl;
  if (!receipt.txHash) return null;
  return `${chain.explorerUrl.replace(/\/$/, "")}/tx/${receipt.txHash}`;
}

export function statusText(receipt: Receipt): string {
  if (receipt.txHash || receipt.explorerUrl) return receipt.status;
  if (receipt.status === "simulated") return "simulated";
  if (receipt.seeded) return "demo";
  return receipt.status;
}
