import { fmtMoney, shortAddress } from "../lib/format";
import type { PendingAction } from "../store/useStore";
import type { AgentState, RiskProfile } from "../types/agent";

interface PolicySectionProps {
  state: AgentState;
  pendingAction: PendingAction;
  demoRunning: boolean;
  highlighted: boolean;
  exportStatus: string | null;
  onProfile: (profile: RiskProfile) => void;
  onAutoHedge: (on: boolean) => void;
  onPaused: (paused: boolean) => void;
  onAutopilot: (on: boolean) => void;
  onExport: () => void;
}

const profiles: RiskProfile[] = ["Conservative", "Balanced", "Advanced"];

export function PolicySection({
  state,
  pendingAction,
  demoRunning,
  highlighted,
  exportStatus,
  onProfile,
  onAutoHedge,
  onPaused,
  onAutopilot,
  onExport,
}: PolicySectionProps) {
  const policy = state.policy;
  const capRemaining = Math.max(0, policy.dailySpendCap - policy.spentToday);
  const busy = pendingAction !== null || demoRunning;

  return (
    <section id="sec-policy" className={"section wrap" + (highlighted ? " section-highlight" : "")} data-screen-label="Policy Contract">
      <hr className="dotted" />
      <div className="section-header" style={{ marginTop: 36 }}>
        <div>
          <div className="section-num">// 02 - Policy Contract</div>
          <h2 className="display section-title" style={{ marginTop: 12 }}>
            Scoped. <span className="stroke">Signed.</span> Enforced.
          </h2>
        </div>
        <div className="section-kicker">
          The agent can move quickly, but only inside the policy profile returned by the backend.
        </div>
      </div>

      <div className="policy-grid">
        <div className="policy-card">
          <div className="policy-profiles">
            {profiles.map((profile) => (
              <button
                key={profile}
                className={"profile-btn" + (policy.profile === profile ? " active" : "")}
                onClick={() => onProfile(profile)}
                disabled={busy}
              >
                {profile}
              </button>
            ))}
          </div>

          <div className="policy-rules">
            <div className="rule">
              <span className="rule-label">Max Leverage</span>
              <span className="rule-value">{policy.maxLeverage}x</span>
            </div>
            <div className="rule">
              <span className="rule-label">Min Liquidation Buffer</span>
              <span className="rule-value gold">{policy.minBuffer}%</span>
            </div>
            <div className="rule">
              <span className="rule-label">Max USDC / Emergency</span>
              <span className="rule-value">{fmtMoney(policy.maxEmergencySpend)}</span>
            </div>
            <div className="rule">
              <span className="rule-label">Daily Spend Cap</span>
              <span className="rule-value">{fmtMoney(policy.dailySpendCap)}</span>
            </div>
            <div className="rule">
              <span className="rule-label">Daily Cap Remaining</span>
              <span className="rule-value green">{fmtMoney(capRemaining)}</span>
            </div>
            <div className="rule">
              <span className="rule-label">Spent Today</span>
              <span className="rule-value">{fmtMoney(policy.spentToday)}</span>
            </div>
            <div className="rule">
              <span className="rule-label">Allowed Venues</span>
              <span className="rule-value sm">{policy.allowedVenues.join(" / ") || "None"}</span>
            </div>
            <div className="rule">
              <span className="rule-label">Allowed Chains</span>
              <span className="rule-value sm">{policy.allowedChains.join(" / ") || "None"}</span>
            </div>
          </div>

          <div className="policy-actions">
            <button className={"pill outline" + (policy.autoHedge ? " is-active" : "")} onClick={() => onAutoHedge(!policy.autoHedge)} disabled={busy}>
              Auto-Hedge {policy.autoHedge ? "On" : "Off"}
            </button>
            <button className={"pill outline" + (state.autopilot ? " is-active" : "")} onClick={() => onAutopilot(!state.autopilot)} disabled={busy}>
              Autopilot {state.autopilot ? "On" : "Off"}
            </button>
            <button className={policy.paused ? "pill gold" : "pill danger"} onClick={() => onPaused(!policy.paused)} disabled={busy}>
              {policy.paused ? "Resume Agent" : "Pause Agent"}
            </button>
            <button className="pill ghost" onClick={onExport} disabled={busy}>
              {pendingAction === "export" ? "Exporting" : "Export JSON"}
            </button>
            {pendingAction && <span className="mini-pill warn">Updating {pendingAction}</span>}
            {exportStatus && <span className="mini-pill good">{exportStatus}</span>}
          </div>

          <div className="policy-contract">
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                Policy Contract
              </div>
              <span className="policy-contract-addr">{shortAddress(policy.contractAddress)}</span>
            </div>
            <span style={{ color: policy.paused ? "var(--amber)" : "var(--green)" }}>
              {policy.paused ? "PAUSED" : "ACTIVE ON ARC TESTNET"}
            </span>
          </div>
        </div>

        <aside className="policy-side">
          <div className="policy-side-quote">
            The agent can act <span className="accent">fast</span>, but only inside your policy.
          </div>

          <div className="permissions">
            <div className="perm-row">
              <span className="perm-icon ok">OK</span>
              <span className="perm-label">Top up USDC collateral up to policy cap</span>
            </div>
            <div className="perm-row">
              <span className="perm-icon ok">OK</span>
              <span className="perm-label">Deleverage positions under volatility stress</span>
            </div>
            <div className="perm-row">
              <span className="perm-icon ok">OK</span>
              <span className="perm-label">Open hedges only on whitelisted venues</span>
            </div>
            <div className="perm-row">
              <span className="perm-icon no">NO</span>
              <span className="perm-label">Move funds off policy scope</span>
            </div>
            <div className="perm-row">
              <span className="perm-icon no">NO</span>
              <span className="perm-label">Open new directional exposure</span>
            </div>
            <div className="perm-row">
              <span className="perm-icon no">NO</span>
              <span className="perm-label">Exceed daily spend or emergency caps</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
