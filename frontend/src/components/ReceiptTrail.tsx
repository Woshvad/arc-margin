import { ReceiptCard } from "./ReceiptCard";
import { fmtDateTime, shortAddress } from "../lib/format";
import { sortedReceipts } from "../lib/receipts";
import type { AgentState, Receipt } from "../types/agent";

interface ReceiptTrailProps {
  state: AgentState;
  selectedReceipt: Receipt | null;
  onDetails: (receipt: Receipt) => void;
  onCloseDetails: () => void;
}

export function ReceiptTrail({ state, selectedReceipt, onDetails, onCloseDetails }: ReceiptTrailProps) {
  const receipts = sortedReceipts(state.receipts);

  return (
    <section className="section wrap" data-screen-label="Receipt Trail">
      <hr className="dotted" />
      <div className="section-header" style={{ marginTop: 36 }}>
        <div>
          <div className="section-num">// 04 - Agent Receipt Trail</div>
          <h2 className="display section-title" style={{ marginTop: 12 }}>
            Nothing happens <span className="accent">off-record.</span>
          </h2>
        </div>
        <div className="section-kicker">
          Real tx receipts get ArcScan links. Local fallback and seeded rows stay labeled as simulated.
        </div>
      </div>

      <div className="receipts">
        {receipts.map((receipt) => (
          <ReceiptCard
            key={receipt.id}
            receipt={receipt}
            state={state}
            isNewest={receipt.id === state.newestReceiptId}
            onDetails={onDetails}
          />
        ))}
      </div>

      {selectedReceipt && (
        <div className="receipt-detail-panel">
          <div className="section-num">Receipt details</div>
          <div className="receipt-title" style={{ marginTop: 8 }}>{selectedReceipt.title}</div>
          <div className="receipt-detail-grid">
            <div>
              <div className="agent-status-label">Action</div>
              <div className="agent-status-value">{selectedReceipt.action}</div>
            </div>
            <div>
              <div className="agent-status-label">Venue / Pair</div>
              <div className="agent-status-value">
                {selectedReceipt.venue} / {selectedReceipt.pair}
              </div>
            </div>
            <div>
              <div className="agent-status-label">Tx Hash</div>
              <div className="agent-status-value">{shortAddress(selectedReceipt.txHash ?? selectedReceipt.txId)}</div>
            </div>
            <div>
              <div className="agent-status-label">Time</div>
              <div className="agent-status-value">{fmtDateTime(selectedReceipt.time)}</div>
            </div>
          </div>
          <p className="receipt-reason">{selectedReceipt.executionDisclosure ?? selectedReceipt.reason}</p>
          <button className="pill ghost" onClick={onCloseDetails}>
            Close Details
          </button>
        </div>
      )}
    </section>
  );
}
