import { fmt, fmtMoney, fmtSigned } from "../lib/format";
import { bufferState, recommendedAction, riskLabel } from "../lib/risk";
import type { Policy, Position } from "../types/agent";

interface PositionCardProps {
  position: Position;
  policy: Policy;
}

export function PositionCard({ position, policy }: PositionCardProps) {
  const state = bufferState(position.buffer, position.bufferTarget);
  const bufferPct = Math.min(100, position.buffer * 4);
  const targetPct = Math.min(100, position.bufferTarget * 4);

  return (
    <div className={`pos-card state-${state}`}>
      <div className="pos-head">
        <div>
          <div className="pos-symbol">{position.symbol}</div>
          <div className="pos-venue">
            <span>{position.venue}</span> - <span>{position.chain}</span>
          </div>
        </div>
        <div className={`pos-state ${state}`}>{riskLabel(state)}</div>
      </div>

      <div className="pos-grid">
        <div>
          <div className="pos-stat-label">Side / Leverage</div>
          <div className="pos-stat-value">
            {position.side} - {fmt(position.leverage, 1)}x
          </div>
        </div>
        <div>
          <div className="pos-stat-label">Notional</div>
          <div className="pos-stat-value">{fmtMoney(position.notional)}</div>
        </div>
        <div>
          <div className="pos-stat-label">Margin</div>
          <div className="pos-stat-value">{fmtMoney(position.margin)}</div>
        </div>
        <div>
          <div className="pos-stat-label">Funding (8h)</div>
          <div className={"pos-stat-value " + (position.funding < 0 ? "red" : "green")}>
            {position.funding * 100 >= 0 ? "+" : ""}
            {fmt(position.funding * 100, 4)}%
          </div>
        </div>
        <div>
          <div className="pos-stat-label">Unrealized PnL</div>
          <div className={"pos-stat-value " + (position.pnl >= 0 ? "green" : "red")}>{fmtSigned(position.pnl)}</div>
        </div>
        <div>
          <div className="pos-stat-label">Volatility</div>
          <div className="pos-stat-value">{fmt(position.volatility * 100, 0)}%</div>
        </div>
      </div>

      <div className="buffer-block">
        <div className="pos-stat-label">
          <span>Liquidation Buffer</span>
          <span style={{ color: "var(--cream)" }}>{fmt(position.buffer, 1)}%</span>
        </div>
        <div className="buffer-bar">
          <div className={`buffer-bar-fill ${state}`} style={{ width: `${bufferPct}%` }} />
          <div className="buffer-bar-tick" style={{ left: `${targetPct}%` }} />
        </div>
        <div className="mono" style={{ marginTop: 6, fontSize: 10, letterSpacing: "0.12em", color: "var(--cream-dim)" }}>
          POLICY FLOOR - {position.bufferTarget}%
        </div>
      </div>

      <div className="pos-action">
        <div className="pos-action-label">Recommended Action</div>
        <div className="pos-action-text">{recommendedAction(position, policy)}</div>
      </div>
    </div>
  );
}
