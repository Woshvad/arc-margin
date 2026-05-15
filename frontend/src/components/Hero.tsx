import { AgentStatus } from "./AgentStatus";
import { fmt, fmtMoney, receiptTrustLabel, shortAddress } from "../lib/format";
import type { PortfolioStats } from "../lib/risk";
import type { ConnectionMode } from "../store/useStore";
import type { AgentState, Position } from "../types/agent";

interface HeroProps {
  state: AgentState;
  stats: PortfolioStats;
  weakest: Position;
  connectionMode: ConnectionMode;
  onRunCycle: () => void;
  onShock: () => void;
}

function modeLabel(mode: ConnectionMode): string {
  if (mode === "live") return "Arc Testnet - Live";
  if (mode === "reconnecting") return "Reconnecting";
  return "Demo Mode";
}

export function Hero({ state, stats, weakest, connectionMode, onRunCycle, onShock }: HeroProps) {
  const meterPct = Math.min(100, Math.max(8, weakest.buffer * 4));
  const meterDanger = weakest.buffer < weakest.bufferTarget;
  const newest = state.receipts[0];

  return (
    <section className="hero wrap">
      <div className="hero-eyebrow-row">
        <hr className="dotted" />
        <span className="eyebrow">Arc Testnet - Liquidation Protection</span>
        <hr className="dotted" />
      </div>

      <h1 className="display hero-headline">Stay&nbsp;Solvent</h1>

      <p className="hero-sub">
        Autonomous collateral routing and risk enforcement for perp traders. ArcMargin watches leveraged
        positions and calls the Arc policy contract before risk turns into liquidation.
      </p>

      <div className="hero-proof-row">
        <span className={`mode-badge ${connectionMode}`}>{modeLabel(connectionMode)}</span>
        <span className="status-chip">
          Chain <strong>{state.chain.chainId}</strong>
        </span>
        <span className="status-chip">
          Contract <strong>{shortAddress(state.policy.contractAddress)}</strong>
        </span>
        <span className="status-chip">
          Receipt <strong>{newest ? receiptTrustLabel(newest) : "Pending"}</strong>
        </span>
      </div>

      <p className="live-notice">
        Arc policy receipts are real when a tx hash is present. Venue execution adapters are simulated and labeled
        until production venue integrations ship.
      </p>

      <div className="hero-ctas">
        <button className="cta cta-primary" onClick={onRunCycle}>
          Run Agent Cycle
        </button>
        <button className="cta cta-secondary" onClick={onShock}>
          Simulate Market Shock
        </button>
      </div>

      <div className="centerpiece-wrap">
        <div className="chip chip-1">
          <span className="chip-label">{weakest.symbol} Buffer</span>
          <span className={"chip-value " + (meterDanger ? "red" : "gold")}>{fmt(weakest.buffer, 1)}%</span>
        </div>
        <div className="chip chip-2 delay-1">
          <span className="chip-label">Riskiest Venue</span>
          <span className="chip-value">{weakest.venue}</span>
        </div>
        <div className="chip chip-3 delay-2">
          <div className="chip-row">
            <span className="chip-dot" />
            <span className="chip-label">Policy</span>
          </div>
          <span className="chip-value green">{state.policy.profile}</span>
        </div>
        <div className="chip chip-4 delay-3">
          <span className="chip-label">Newest Receipt</span>
          <span className="chip-value green">{newest ? newest.status : "Pending"}</span>
        </div>
        <div className="chip chip-5 delay-1">
          <div className="chip-row">
            <span className={"chip-dot " + (meterDanger ? "amber" : "")} />
            <span className="chip-label">Prevented</span>
          </div>
          <span className="chip-value">{state.metrics.liquidationsPrevented}</span>
        </div>
        <div className="chip chip-6 delay-2">
          <span className="chip-label">Avg Leverage</span>
          <span className="chip-value gold">{fmt(stats.avgLev, 1)}x</span>
        </div>

        <div className="centerpiece">
          <div className="vault">
            <div className="vault-cap">
              <span>ARC-VAULT - {shortAddress(state.wallet.address || state.policy.contractAddress)}</span>
              <div className="vault-cap-dots">
                <span className="live" />
                <span />
                <span />
              </div>
            </div>
            <div className="vault-screen">
              <span className="vault-label">Guarded Notional</span>
              <span className="vault-value">{fmt(stats.notional / 1000, 1)}K</span>
              <div className="mono" style={{ marginTop: 14, fontSize: 10, letterSpacing: "0.14em", color: "rgba(242,229,210,0.5)", textTransform: "uppercase" }}>
                Weakest Buffer - {fmt(weakest.buffer, 1)}%
              </div>
              <div className="vault-meter">
                <div className={"vault-meter-fill" + (meterDanger ? " danger" : "")} style={{ width: `${meterPct}%` }} />
              </div>
            </div>
            <div className="vault-base">
              <div className="usdc-stack">
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="usdc-coin">
                    <span>USDC</span>
                    <span>{fmt(stats.margin / 6 || 0, 0)}</span>
                  </div>
                ))}
              </div>
              <div className="vault-foot">
                <span>Collateral Engine</span>
                <span>{connectionMode === "live" ? "Live" : "Demo"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AgentStatus state={state} />
    </section>
  );
}
