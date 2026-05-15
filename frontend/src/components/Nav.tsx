import { fmtMoney, shortAddress } from "../lib/format";
import type { ConnectionMode, PendingAction } from "../store/useStore";
import type { AgentState } from "../types/agent";

interface NavProps {
  section: string;
  setSection: (section: string) => void;
  onRunCycle: () => void;
  connectionMode: ConnectionMode;
  state: AgentState;
  pendingAction: PendingAction;
  walletProofVisible: boolean;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
}

const items = [
  { label: "Risk Command", section: "Dashboard", id: "sec-dashboard" },
  { label: "Policy", section: "Policy", id: "sec-policy" },
  { label: "Arc Layer", section: "Arc Layer", id: "sec-arc-layer" },
  { label: "Receipts", section: "Receipts", id: "sec-receipts" },
  { label: "Demo", section: "Demo", id: "sec-demo" },
];

function label(mode: ConnectionMode): string {
  if (mode === "live") return "Arc Testnet - Live";
  if (mode === "reconnecting") return "Reconnecting";
  return "Demo Mode";
}

export function Nav({
  section,
  setSection,
  onRunCycle,
  connectionMode,
  state,
  pendingAction,
  walletProofVisible,
  onConnectWallet,
  onDisconnectWallet,
}: NavProps) {
  const walletAddress = state.wallet.address || state.integrations.circleWallet.address || "";

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand">
          <div className="nav-brand-mark" />
          ArcMargin
        </div>
        {items.map((item) => (
          <button
            key={item.section}
            className={"pill" + (section === item.section ? " is-active" : "")}
            onClick={() => {
              setSection(item.section);
              const el = document.getElementById(item.id);
              if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
            }}
          >
            {item.label}
          </button>
        ))}
        <div className="nav-status">
          <span className={`mode-badge ${connectionMode}`}>{label(connectionMode)}</span>
          {walletProofVisible ? (
            <button className="pill outline nav-wallet" onClick={onDisconnectWallet} title="No browser wallet signing. This shows the backend Circle agent wallet.">
              Circle agent wallet - {shortAddress(walletAddress)} - {fmtMoney(state.wallet.usdcBalance, 2)}
            </button>
          ) : (
            <button className="pill outline nav-wallet" onClick={onConnectWallet}>
              Connect Wallet
            </button>
          )}
          <button className="pill gold nav-actions-desktop" onClick={onRunCycle} disabled={pendingAction !== null}>
            {pendingAction === "cycle" ? "Running" : "Run Agent Cycle"}
          </button>
        </div>
      </div>
    </nav>
  );
}
