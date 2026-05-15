import { fmt, fmtMoney, fmtSigned } from "../lib/format";
import { bufferState, type PortfolioStats } from "../lib/risk";
import type { AgentState, Position } from "../types/agent";

interface PortfolioStripProps {
  state: AgentState;
  stats: PortfolioStats;
  weakest: Position;
}

export function PortfolioStrip({ state, stats, weakest }: PortfolioStripProps) {
  const weakestState = bufferState(weakest.buffer, weakest.bufferTarget);

  return (
    <>
      <div className="portfolio-strip">
        <div className="portfolio-cell">
          <span className="portfolio-cell-label">Notional Guarded</span>
          <span className="portfolio-cell-value">{fmtMoney(stats.notional)}</span>
          <span className="portfolio-cell-delta">across {stats.count} positions</span>
        </div>
        <div className="portfolio-cell">
          <span className="portfolio-cell-label">Arc USDC Margin</span>
          <span className="portfolio-cell-value gold">{fmtMoney(stats.margin)}</span>
          <span className="portfolio-cell-delta">gas token: {state.chain.gasToken}</span>
        </div>
        <div className="portfolio-cell">
          <span className="portfolio-cell-label">Average Leverage</span>
          <span className="portfolio-cell-value">{fmt(stats.avgLev, 1)}x</span>
          <span className="portfolio-cell-delta">weighted by notional</span>
        </div>
        <div className="portfolio-cell">
          <span className="portfolio-cell-label">Weakest Buffer</span>
          <span className={"portfolio-cell-value " + (weakestState === "danger" ? "red" : weakestState === "watch" ? "amber" : "green")}>
            {fmt(weakest.buffer, 1)}%
          </span>
          <span className="portfolio-cell-delta">
            {weakest.symbol} - {weakest.venue}
          </span>
        </div>
      </div>

      <div className="metrics-ribbon">
        <div className="metric-mini">
          <div className="metric-mini-label">Portfolio PnL</div>
          <div className={"metric-mini-value " + (stats.pnl >= 0 ? "green" : "red")}>{fmtSigned(stats.pnl)}</div>
        </div>
        <div className="metric-mini">
          <div className="metric-mini-label">Positions At Risk</div>
          <div className="metric-mini-value">{stats.positionsAtRisk}</div>
        </div>
        <div className="metric-mini">
          <div className="metric-mini-label">USDC Routed</div>
          <div className="metric-mini-value">{fmtMoney(state.metrics.usdcRouted)}</div>
        </div>
        <div className="metric-mini">
          <div className="metric-mini-label">Daily Cap Remaining</div>
          <div className="metric-mini-value">{fmtMoney(stats.dailyCapRemaining)}</div>
        </div>
      </div>
    </>
  );
}
