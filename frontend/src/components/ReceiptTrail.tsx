import { AdapterHealthDrawer } from "./AdapterHealthDrawer";
import { ReceiptCard } from "./ReceiptCard";
import { ReceiptDetailDrawer } from "./ReceiptDetailDrawer";
import { sortedReceipts } from "../lib/receipts";
import type { AgentState, Receipt } from "../types/agent";

interface ReceiptTrailProps {
  state: AgentState;
  selectedReceipt: Receipt | null;
  adapterHealthOpen: boolean;
  onDetails: (receipt: Receipt) => void;
  onCloseDetails: () => void;
  onOpenAdapterHealth: () => void;
  onCloseAdapterHealth: () => void;
  highlighted?: boolean;
}

export function ReceiptTrail({
  state,
  selectedReceipt,
  adapterHealthOpen,
  onDetails,
  onCloseDetails,
  onOpenAdapterHealth,
  onCloseAdapterHealth,
  highlighted = false,
}: ReceiptTrailProps) {
  const receipts = sortedReceipts(state.receipts);

  return (
    <section id="sec-receipts" className={"section wrap" + (highlighted ? " section-highlight" : "")} data-screen-label="Receipt Trail">
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
        <div className="section-actions">
          <button className="pill outline" onClick={onOpenAdapterHealth}>
            Open Adapter Health
          </button>
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

      <ReceiptDetailDrawer state={state} receipt={selectedReceipt} onClose={onCloseDetails} />
      <AdapterHealthDrawer state={state} open={adapterHealthOpen} onClose={onCloseAdapterHealth} />
    </section>
  );
}
