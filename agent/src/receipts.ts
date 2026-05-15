import type { PolicyActionEvent, Receipt, RiskAction, SigningModeMetadata } from "./types.js";
import { explorerTxUrl, randomTxId, txDisplayId } from "./arc.js";
import type { Hex } from "./types.js";

export function receiptFromPolicyEvent(params: {
  action: RiskAction;
  event: PolicyActionEvent;
  txHash: Hex;
  blockNumber?: number;
  blockHash?: Hex;
  signing: SigningModeMetadata;
}): Receipt {
  const policyMismatch = params.action.predictedStatus !== params.event.status;
  return {
    id: `receipt-${params.event.receiptId}-${params.txHash.slice(2, 10)}`,
    receiptId: params.event.receiptId,
    txHash: params.txHash,
    explorerUrl: explorerTxUrl(params.txHash),
    time: params.event.timestamp,
    action: params.event.action,
    title: params.action.title,
    venue: params.event.venue,
    pair: params.event.pair,
    amount: params.event.amount > 0 ? params.event.amount : undefined,
    bufferBefore: params.event.bufferBefore,
    bufferAfter: params.event.bufferAfter,
    status: params.event.status,
    primitive: params.action.primitive,
    reason: params.event.reason,
    txId: txDisplayId(params.txHash),
    seeded: false,
    predictedStatus: params.action.predictedStatus,
    onChainStatus: params.event.onChainStatus,
    policyMismatch,
    executionDisclosure:
      params.event.status === "simulated"
        ? "Policy receipt is real on Arc; venue execution adapter is simulated."
        : "Policy receipt is real on Arc testnet.",
    signingMode: params.signing.mode,
    blockNumber: params.blockNumber,
    blockHash: params.blockHash,
  };
}

export function localAutopilotReceipt(action: RiskAction): Receipt {
  const now = Date.now();
  return {
    id: `local-autopilot-${now}`,
    receiptId: 0,
    time: new Date(now).toISOString(),
    action: action.action,
    title: `Autopilot dry run - ${action.title}`,
    venue: action.venue,
    pair: action.pair,
    amount: action.amount || undefined,
    bufferBefore: action.bufferBefore,
    bufferAfter: action.bufferAfter,
    status: "simulated",
    primitive: action.primitive,
    reason: "Autopilot is enabled, but ENABLE_AUTOPILOT_WRITES is false. No Arc transaction was broadcast.",
    txId: randomTxId(now),
    seeded: false,
    predictedStatus: action.predictedStatus,
    executionDisclosure: "Autopilot local dry run only; no txHash means no on-chain policy receipt for this row.",
  };
}
