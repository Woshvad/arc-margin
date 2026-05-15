import { PortfolioStrip } from "./PortfolioStrip";
import { PositionCard } from "./PositionCard";
import type { PortfolioStats } from "../lib/risk";
import type { AgentState, Position } from "../types/agent";

interface RiskCommandCenterProps {
  state: AgentState;
  stats: PortfolioStats;
  weakest: Position;
  onShock: () => void;
  onRunCycle: () => void;
  onReset: () => void;
}

export function RiskCommandCenter({ state, stats, weakest, onShock, onRunCycle, onReset }: RiskCommandCenterProps) {
  return (
    <section id="sec-dashboard" className="section wrap" data-screen-label="Risk Command Center">
      <hr className="dotted" />
      <div className="section-header" style={{ marginTop: 36 }}>
        <div>
          <div className="section-num">// 01 - Risk Command Center</div>
          <h2 className="display section-title" style={{ marginTop: 12 }}>
            Every Position. <span className="accent">One Console.</span>
          </h2>
        </div>
        <div className="section-kicker">
          Live backend state first. Buffers, funding, PnL, policy fit, and Arc receipt truth surface before they matter.
        </div>
        <div className="section-actions">
          <button className="pill outline" onClick={onShock}>
            Simulate Shock
          </button>
          <button className="pill gold" onClick={onRunCycle}>
            Run Cycle
          </button>
          <button className="pill ghost" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      <PortfolioStrip state={state} stats={stats} weakest={weakest} />

      <div className="positions">
        {state.positions.map((position) => (
          <PositionCard key={position.id} position={position} policy={state.policy} />
        ))}
      </div>
    </section>
  );
}
