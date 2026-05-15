import { fmtDateTime } from "../lib/format";
import type { AgentState } from "../types/agent";

export function VenueAdapters({ state }: { state: AgentState }) {
  return (
    <section className="section wrap" data-screen-label="Venues">
      <hr className="dotted" />
      <div className="section-header" style={{ marginTop: 36 }}>
        <div>
          <div className="section-num">// 06 - Venue Adapters</div>
          <h2 className="display section-title" style={{ marginTop: 12 }}>
            Wherever the <span className="accent">trade</span> is open.
          </h2>
        </div>
        <div className="section-kicker">
          Adapter state comes from the backend. Simulated venue execution remains explicit in every card.
        </div>
      </div>

      <div className="venues">
        {state.adapters.map((adapter) => (
          <div key={adapter.id} className="venue">
            <div className="venue-head">
              <div className="venue-name">{adapter.name}</div>
              <span className={"venue-tag " + (adapter.status === "live" ? "live" : "sim")}>{adapter.status}</span>
            </div>
            <div className="venue-row">
              <span>Execution</span>
              <span>{adapter.status === "live" ? "Live" : "Simulated"}</span>
            </div>
            <div className="venue-row">
              <span>Last Action</span>
              <span>{adapter.lastActionAt ? fmtDateTime(adapter.lastActionAt) : "None"}</span>
            </div>
            <div className="venue-row">
              <span>Settlement</span>
              <span style={{ color: "var(--gold-hot)" }}>Arc Testnet policy</span>
            </div>
            <p className="receipt-reason">{adapter.disclosure}</p>
          </div>
        ))}
      </div>

      <div className="honest adapter-disclosure">
        <div className="honest-mark">!</div>
        <div className="honest-text">
          <b>Truth boundary:</b> Arc policy receipts and Circle-native signing are real when the backend returns tx
          hashes. Perp venue execution is simulated in this v1 build unless a backend adapter explicitly says live.
        </div>
      </div>
    </section>
  );
}
