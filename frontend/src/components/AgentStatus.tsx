import { fmtDateTime, fmtMoney, shortAddress } from "../lib/format";
import type { AgentState } from "../types/agent";

interface AgentStatusProps {
  state: AgentState;
  walletProofVisible: boolean;
}

function tone(value: string): "good" | "warn" | "bad" {
  if (["ready", "fresh", "registered", "configured", "circle-native"].includes(value)) return "good";
  if (["stale", "pending", "unconfigured"].includes(value)) return "warn";
  return "bad";
}

export function AgentStatus({ state, walletProofVisible }: AgentStatusProps) {
  const identity = state.integrations.identity;
  const balance = state.integrations.balance;
  const wallet = state.integrations.circleWallet;
  const signing = state.signing;

  return (
    <div className="agent-status" aria-label="Agent status">
      <div className="agent-status-card">
        <div className="agent-status-label">Circle Agent Wallet</div>
        {walletProofVisible ? (
          <>
            <div className={`agent-status-value ${tone(wallet.status)}`}>{wallet.status}</div>
            <div className="agent-status-detail">{shortAddress(wallet.address ?? state.wallet.address)}</div>
            <div className="agent-status-detail">No browser wallet signing</div>
          </>
        ) : (
          <>
            <div className="agent-status-value warn">Proof hidden</div>
            <div className="agent-status-detail">Connect Wallet reveals the backend Circle agent wallet.</div>
          </>
        )}
      </div>
      <div className="agent-status-card">
        <div className="agent-status-label">USDC Balance</div>
        <div className={`agent-status-value ${tone(balance.status)}`}>{fmtMoney(balance.usdcBalance, 2)}</div>
        <div className="agent-status-detail">{balance.updatedAt ? fmtDateTime(balance.updatedAt) : balance.status}</div>
      </div>
      <div className="agent-status-card">
        <div className="agent-status-label">Signing</div>
        <div className={`agent-status-value ${tone(signing.mode)}`}>{signing.mode}</div>
        <div className="agent-status-detail">{signing.fallbackActive ? "Fallback active" : signing.primary}</div>
      </div>
      <div className="agent-status-card">
        <div className="agent-status-label">ERC-8004 Identity</div>
        <div className={`agent-status-value ${tone(identity.status)}`}>
          {identity.agentId ? `ID ${identity.agentId}` : identity.status}
        </div>
        <div className="agent-status-detail">{shortAddress(identity.registryAddress)}</div>
      </div>
    </div>
  );
}
