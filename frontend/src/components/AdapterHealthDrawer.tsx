import { DrawerShell } from "./DrawerShell";
import { fmtDateTime } from "../lib/format";
import type { AdapterMetadata, AgentState } from "../types/agent";

interface AdapterHealthDrawerProps {
  state: AgentState;
  open: boolean;
  onClose: () => void;
}

function riskFeed(adapter: AdapterMetadata): string {
  if (adapter.status === "live") return "live";
  if (adapter.status === "offline") return "offline";
  return "simulated";
}

function executionStatus(adapter: AdapterMetadata): string {
  return adapter.status === "live" ? "live adapter reported" : "simulated execution adapter";
}

export function AdapterHealthDrawer({ state, open, onClose }: AdapterHealthDrawerProps) {
  return (
    <DrawerShell open={open} eyebrow="Adapter health" title="Venue adapter status" onClose={onClose} className="adapter-drawer">
      <p className="drawer-copy">
        Arc policy receipts can be real on testnet. Perp venue execution remains simulated unless a backend adapter explicitly reports live execution.
      </p>

      <div className="adapter-rows">
        {state.adapters.map((adapter) => (
          <div key={adapter.id} className="adapter-row">
            <div className="adapter-row-head">
              <div className="venue-name">{adapter.name}</div>
              <span className={"venue-tag " + (adapter.status === "live" ? "live" : "sim")}>{adapter.status}</span>
            </div>
            <div className="venue-row">
              <span>Risk feed</span>
              <span>{riskFeed(adapter)}</span>
            </div>
            <div className="venue-row">
              <span>Execution adapter</span>
              <span>{executionStatus(adapter)}</span>
            </div>
            <div className="venue-row">
              <span>Settlement mode</span>
              <span>Arc Testnet policy receipt</span>
            </div>
            <div className="venue-row">
              <span>Last checked</span>
              <span>{adapter.lastActionAt ? fmtDateTime(adapter.lastActionAt) : state.lastCycleAt ? fmtDateTime(state.lastCycleAt) : "Awaiting action"}</span>
            </div>
            <span className="mini-pill warn">Simulated execution adapter</span>
            <p className="receipt-reason">{adapter.disclosure}</p>
          </div>
        ))}
      </div>
    </DrawerShell>
  );
}
