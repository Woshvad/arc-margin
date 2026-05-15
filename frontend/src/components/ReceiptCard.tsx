import { explorerUrl, receiptTitleClass, statusText } from "../lib/receipts";
import { fmt, fmtMoney, fmtTime, receiptTrustLabel } from "../lib/format";
import type { AgentState, Receipt } from "../types/agent";

interface ReceiptCardProps {
  receipt: Receipt;
  state: AgentState;
  isNewest: boolean;
  onDetails: (receipt: Receipt) => void;
}

export function ReceiptCard({ receipt, state, isNewest, onDetails }: ReceiptCardProps) {
  const url = explorerUrl(receipt, state.chain);

  return (
    <div className={"receipt" + (isNewest ? " is-new" : "")}>
      <div className="receipt-time mono">{fmtTime(receipt.time)}</div>
      <div>
        <div className="receipt-title-row">
          <div className={`receipt-title ${receiptTitleClass(receipt)}`}>{receipt.title}</div>
          <span className={url ? "mini-pill good" : "mini-pill warn"}>{receiptTrustLabel(receipt)}</span>
        </div>
        <div className="receipt-meta">
          <span>
            {receipt.venue} - {receipt.pair}
          </span>
          <span>{receipt.primitive}</span>
          {receipt.amount != null && <span>{fmtMoney(receipt.amount)} USDC</span>}
          {receipt.signingMode && <span>{receipt.signingMode}</span>}
        </div>
        <div className="receipt-reason" style={{ marginTop: 8 }}>{receipt.reason}</div>
        {receipt.executionDisclosure && <div className="receipt-disclosure">{receipt.executionDisclosure}</div>}
      </div>
      <div className="receipt-buffer">
        {receipt.bufferBefore != null && receipt.bufferAfter != null ? (
          <>
            Buffer <span className={receipt.bufferBefore < 10 ? "red" : ""}>{fmt(receipt.bufferBefore, 1)}%</span>
            <span className="arrow">-&gt;</span>
            <span className={receipt.bufferAfter >= receipt.bufferBefore ? "green" : "red"}>
              {fmt(receipt.bufferAfter, 1)}%
            </span>
          </>
        ) : (
          <span style={{ color: "var(--cream-dim)" }}>Pre-trade gate</span>
        )}
      </div>
      <div className="receipt-actions">
        <div className={`receipt-status ${receipt.status}`}>{statusText(receipt)}</div>
        {url && (
          <a className="receipt-link" href={url} target="_blank" rel="noreferrer">
            View on ArcScan
          </a>
        )}
        <button className="receipt-detail-btn" onClick={() => onDetails(receipt)}>
          Details
        </button>
      </div>
    </div>
  );
}
