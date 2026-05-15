import { DrawerShell } from "./DrawerShell";
import { fmt, fmtDateTime, fmtMoney, shortAddress } from "../lib/format";
import { explorerUrl, statusText } from "../lib/receipts";
import { receiptPolicyChecks } from "../lib/receiptPolicyChecks";
import type { AgentState, Receipt } from "../types/agent";

interface ReceiptDetailDrawerProps {
  state: AgentState;
  receipt: Receipt | null;
  onClose: () => void;
}

function bufferText(receipt: Receipt): string {
  if (receipt.bufferBefore == null || receipt.bufferAfter == null) return "Pre-trade policy gate";
  return `${fmt(receipt.bufferBefore, 1)}% -> ${fmt(receipt.bufferAfter, 1)}%`;
}

export function ReceiptDetailDrawer({ state, receipt, onClose }: ReceiptDetailDrawerProps) {
  if (!receipt) return null;

  const url = explorerUrl(receipt, state.chain);
  const checks = receiptPolicyChecks(receipt, state);
  const hasProof = Boolean(url || receipt.txHash);

  return (
    <DrawerShell open={Boolean(receipt)} eyebrow="Receipt proof" title={receipt.title} onClose={onClose} className="receipt-drawer">
      <div className="proof-card">
        <div className="proof-card-head">
          <span className={`receipt-status ${receipt.status}`}>{statusText(receipt)}</span>
          <span className={hasProof ? "mini-pill good" : "mini-pill warn"}>{hasProof ? "Real Arc tx" : "No Arc tx proof"}</span>
        </div>
        {url ? (
          <a className="proof-link" href={url} target="_blank" rel="noreferrer">
            View transaction on ArcScan
          </a>
        ) : (
          <div className="proof-local-id">Local/demo ID: {receipt.txId}</div>
        )}
        <p className="receipt-disclosure">
          {hasProof
            ? "Policy evaluation was recorded on Arc testnet. Venue execution adapter remains simulated unless the adapter status explicitly says live."
            : "This receipt has no Arc transaction hash. Treat it as seeded or local demo state, not on-chain settlement."}
        </p>
      </div>

      <div className="drawer-grid">
        <div>
          <div className="agent-status-label">Action</div>
          <div className="agent-status-value">{receipt.action}</div>
        </div>
        <div>
          <div className="agent-status-label">Venue / Pair</div>
          <div className="agent-status-value">
            {receipt.venue} / {receipt.pair}
          </div>
        </div>
        <div>
          <div className="agent-status-label">Buffer</div>
          <div className="agent-status-value">{bufferText(receipt)}</div>
        </div>
        <div>
          <div className="agent-status-label">Primitive</div>
          <div className="agent-status-value">{receipt.primitive}</div>
        </div>
        <div>
          <div className="agent-status-label">Amount</div>
          <div className="agent-status-value">{receipt.amount == null ? "Not applicable" : `${fmtMoney(receipt.amount)} USDC`}</div>
        </div>
        <div>
          <div className="agent-status-label">Timestamp</div>
          <div className="agent-status-value">{fmtDateTime(receipt.time)}</div>
        </div>
        <div>
          <div className="agent-status-label">Tx Hash</div>
          <div className="agent-status-value">{shortAddress(receipt.txHash ?? receipt.txId)}</div>
        </div>
        <div>
          <div className="agent-status-label">Signing</div>
          <div className="agent-status-value">{receipt.signingMode ?? state.signing.mode}</div>
        </div>
      </div>

      <div className="drawer-block">
        <div className="drawer-block-title">Policy checks</div>
        <div className="policy-checks">
          {checks.map((check) => (
            <div key={check.label} className={`policy-check ${check.status}`}>
              <span>{check.label}</span>
              <strong>{check.status}</strong>
              <p>{check.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="drawer-block">
        <div className="drawer-block-title">Reason</div>
        <p className="receipt-reason">{receipt.reason}</p>
      </div>

      <div className="drawer-grid compact">
        <div>
          <div className="agent-status-label">On-chain status</div>
          <div className="agent-status-value">{receipt.onChainStatus ?? "Not reported"}</div>
        </div>
        <div>
          <div className="agent-status-label">Block</div>
          <div className="agent-status-value">{receipt.blockNumber ?? "Pending"}</div>
        </div>
        <div>
          <div className="agent-status-label">Block hash</div>
          <div className="agent-status-value">{shortAddress(receipt.blockHash)}</div>
        </div>
        <div>
          <div className="agent-status-label">Mismatch</div>
          <div className="agent-status-value">{receipt.policyMismatch ? "Review needed" : "None"}</div>
        </div>
      </div>

      <div className="honest drawer-honest">
        <div className="honest-mark">!</div>
        <div className="honest-text">
          <b>Truth boundary:</b> Arc policy proof is real only when tx proof is present. Perp venue execution is simulated in this build unless an adapter explicitly reports live execution.
        </div>
      </div>
    </DrawerShell>
  );
}
