import type { AgentState } from "../types/agent";

interface Primitive {
  n: string;
  name: string;
  desc: string;
  signal: (state: AgentState) => string;
}

const primitives: Primitive[] = [
  {
    n: "01",
    name: "USDC Gas",
    desc: "Arc uses USDC as the gas token, so emergency policy actions do not require ETH juggling.",
    signal: (state) => `${state.chain.gasToken} native gas`,
  },
  {
    n: "02",
    name: "Gateway",
    desc: "Gateway-style liquidity routing is represented honestly in v1 while policy receipts remain on-chain.",
    signal: () => "Simulated adapter",
  },
  {
    n: "03",
    name: "CCTP",
    desc: "Native USDC movement is part of the intended route; v1 venue movement is simulated.",
    signal: (state) => `${state.chain.policyAmountDecimals} decimal policy amounts`,
  },
  {
    n: "04",
    name: "Paymaster",
    desc: "Paymaster behavior is shown as an Arc primitive, not claimed as live venue settlement.",
    signal: () => "Testnet primitive",
  },
  {
    n: "05",
    name: "Policy Contracts",
    desc: "Hard on-chain limits run before the agent records an approved or blocked action.",
    signal: (state) => state.policy.paused ? "Paused" : "Enforcing",
  },
  {
    n: "06",
    name: "Agent Receipts",
    desc: "Every real backend cycle can surface a tx hash and ArcScan link when broadcast succeeds.",
    signal: (state) => `${state.receipts.length} receipts`,
  },
];

export function ArcLayer({ state }: { state: AgentState }) {
  return (
    <section id="sec-arc-layer" className="section wrap" data-screen-label="Arc Layer">
      <hr className="dotted" />
      <div className="section-header" style={{ marginTop: 36 }}>
        <div>
          <div className="section-num">// 03 - What Keeps You Solvent</div>
          <h2 className="display section-title" style={{ marginTop: 12 }}>
            Built on <span className="accent">Arc</span> primitives.
          </h2>
        </div>
        <div className="section-kicker">
          ArcMargin is thin glue over Circle and Arc rails: native USDC, scoped policy, and verifiable receipts.
        </div>
      </div>

      <div className="primitives">
        {primitives.map((primitive) => (
          <div key={primitive.n} className="prim">
            <div className="prim-num">{primitive.n}</div>
            <div className="prim-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="4" width="20" height="20" rx="6" stroke="#FFA319" strokeWidth="1.5" />
                <path d="M9 14h10M14 9v10" stroke="#FFA319" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="prim-name">{primitive.name}</div>
            <div className="prim-desc">{primitive.desc}</div>
            <span className="mini-pill good">{primitive.signal(state)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
