// ArcMargin — interactive prototype
const { useState, useEffect, useMemo, useRef } = React;

// ---------- Initial state ----------

const INITIAL_POSITIONS = [
{
  id: "eth",
  symbol: "ETH-PERP",
  venue: "dYdX",
  chain: "Base",
  side: "LONG",
  leverage: 6.8,
  notional: 142500,
  buffer: 12.6,
  funding: 0.0094,
  pnl: 3420,
  bufferTarget: 12
},
{
  id: "btc",
  symbol: "BTC-PERP",
  venue: "Hyperliquid",
  chain: "Arbitrum",
  side: "LONG",
  leverage: 4.2,
  notional: 218000,
  buffer: 21.3,
  funding: 0.0042,
  pnl: 7820,
  bufferTarget: 15
},
{
  id: "sol",
  symbol: "SOL-PERP",
  venue: "GMX",
  chain: "Avalanche",
  side: "SHORT",
  leverage: 7.4,
  notional: 86400,
  buffer: 9.1,
  funding: -0.0118,
  pnl: -1240,
  bufferTarget: 12
}];


const POLICY_PROFILES = {
  Conservative: {
    maxLev: 4,
    minBuffer: 18,
    maxEmergency: 500,
    dailyCap: 2000,
    autoHedge: true,
    venues: ["dYdX", "Hyperliquid"]
  },
  Balanced: {
    maxLev: 8,
    minBuffer: 12,
    maxEmergency: 1500,
    dailyCap: 6000,
    autoHedge: true,
    venues: ["dYdX", "Hyperliquid", "GMX", "Vertex"]
  },
  Advanced: {
    maxLev: 15,
    minBuffer: 6,
    maxEmergency: 5000,
    dailyCap: 20000,
    autoHedge: false,
    venues: ["dYdX", "Hyperliquid", "GMX", "Vertex"]
  }
};

const INITIAL_RECEIPTS = [
{
  id: "r3",
  time: "14:42:08",
  title: "Settled 250 USDC collateral top-up",
  titleClass: "green",
  venue: "dYdX · ETH-PERP",
  primitive: "Gateway + CCTP",
  bufferBefore: 8.4,
  bufferAfter: 12.6,
  amount: 250,
  reason: "Buffer fell below policy floor while funding remained acceptable. Routed USDC from Base via Gateway.",
  status: "settled"
},
{
  id: "r2",
  time: "14:38:51",
  title: "Blocked 9.4× SOL leverage increase",
  titleClass: "red",
  venue: "GMX · SOL-PERP",
  primitive: "Policy Contract",
  bufferBefore: null,
  bufferAfter: null,
  amount: null,
  reason: "Requested leverage exceeded Balanced policy cap of 8×. Action denied before broadcast.",
  status: "blocked"
},
{
  id: "r1",
  time: "14:31:14",
  title: "Reduced ETH exposure by 18%",
  titleClass: "amber",
  venue: "dYdX · ETH-PERP",
  primitive: "Agent Receipt",
  bufferBefore: 11.2,
  bufferAfter: 14.8,
  amount: null,
  reason: "Volatility spiked above 38th percentile. Defending the position became inefficient versus deleveraging.",
  status: "settled"
}];


// ---------- Helpers ----------

const fmt = (n, d = 2) =>
Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtMoney = (n) => "$" + Math.round(n).toLocaleString("en-US");

const fmtSigned = (n, prefix = "$") =>
(n >= 0 ? "+" : "−") + prefix + Math.round(Math.abs(n)).toLocaleString("en-US");

const bufferState = (buffer, target) => {
  if (buffer <= target * 0.85) return "danger";
  if (buffer <= target * 1.15) return "watch";
  return "healthy";
};

const now = () => {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].
  map((n) => String(n).padStart(2, "0")).
  join(":");
};

// ---------- Top Nav ----------

function Nav({ section, setSection, onRunCycle }) {
  const items = ["Dashboard", "Policy", "Arc Layer", "Demo"];
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand">
          <div className="nav-brand-mark"></div>
          ArcMargin
        </div>
        {items.map((it) =>
        <button
          key={it}
          className={"pill" + (section === it ? " is-active" : "")}
          onClick={() => {
            setSection(it);
            const el = document.getElementById("sec-" + it.toLowerCase().replace(" ", "-"));
            if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
          }}>
          
            {it}
          </button>
        )}
        <button className="pill gold nav-actions-desktop" onClick={onRunCycle}>
          Run Agent Cycle
        </button>
      </div>
    </nav>);

}

// ---------- Hero ----------

function Hero({ portfolio, weakest, onRunCycle, onShock }) {
  const meterPct = Math.min(100, Math.max(8, weakest.buffer * 4));
  const meterDanger = weakest.buffer < weakest.bufferTarget;
  return (
    <section className="hero wrap">
      <div className="hero-eyebrow-row">
        <hr className="dotted" />
        <span className="eyebrow">Arc Testnet · Liquidation Protection</span>
        <hr className="dotted" />
      </div>

      <h1 className="display hero-headline">Stay&nbsp;Solvent</h1>

      <p className="hero-sub">
        Autonomous collateral routing and risk enforcement for perp traders.
        ArcMargin watches every leveraged position you hold and acts inside the
        policy you signed — before the funding cliff finds you.
      </p>

      <div className="hero-ctas">
        <button className="cta cta-primary" onClick={onRunCycle}>
          ▶ Run Agent Cycle
        </button>
        <button className="cta cta-secondary" onClick={onShock}>
          ⚡ Simulate Market Shock
        </button>
      </div>

      <div className="centerpiece-wrap">
        {/* Floating risk chips */}
        <div className="chip chip-1">
          <span className="chip-label">ETH-PERP Buffer</span>
          <span className={"chip-value " + (meterDanger ? "red" : "gold")}>
            {fmt(weakest.buffer, 1)}%
          </span>
        </div>
        <div className="chip chip-2 delay-1">
          <span className="chip-label">Agent Action</span>
          <span className="chip-value">+250 USDC</span>
        </div>
        <div className="chip chip-3 delay-2">
          <div className="chip-row">
            <span className="chip-dot"></span>
            <span className="chip-label">Policy Status</span>
          </div>
          <span className="chip-value green">Allowed</span>
        </div>
        <div className="chip chip-4 delay-3">
          <span className="chip-label">Arc Receipt</span>
          <span className="chip-value green">Settled</span>
        </div>
        <div className="chip chip-5 delay-1">
          <div className="chip-row">
            <span className={"chip-dot " + (meterDanger ? "amber" : "")}></span>
            <span className="chip-label">Notional Guarded</span>
          </div>
          <span className="chip-value">{fmtMoney(portfolio.notional)}</span>
        </div>
        <div className="chip chip-6 delay-2">
          <span className="chip-label">Avg Leverage</span>
          <span className="chip-value gold">{fmt(portfolio.avgLev, 1)}×</span>
        </div>

        {/* Centerpiece vault */}
        <div className="centerpiece">
          <div className="vault">
            <div className="vault-cap">
              <span>ARC-VAULT · 0x91fC</span>
              <div className="vault-cap-dots">
                <span className="live"></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div className="vault-screen">
              <span className="vault-label">Guarded Notional</span>
              <span className="vault-value">{fmt(portfolio.notional / 1000, 1)}K</span>
              <div style={{ marginTop: 14, fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(242,229,210,0.5)", textTransform: "uppercase" }}>
                Weakest Buffer · {fmt(weakest.buffer, 1)}%
              </div>
              <div className="vault-meter">
                <div
                  className={"vault-meter-fill" + (meterDanger ? " danger" : "")}
                  style={{ width: meterPct + "%" }}>
                </div>
              </div>
            </div>
            <div className="vault-base">
              <div className="usdc-stack">
                {[0, 1, 2, 3, 4, 5].map((i) =>
                <div key={i} className="usdc-coin">
                    <span>USDC</span>
                    <span>{fmt(portfolio.margin / 6 || 0, 0)}</span>
                  </div>
                )}
              </div>
              <div className="vault-foot">
                <span>Collateral Engine</span>
                <span>Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>);

}

// ---------- Risk Command Center ----------

function PortfolioStrip({ portfolio, weakest }) {
  const weakestState = bufferState(weakest.buffer, weakest.bufferTarget);
  return (
    <div className="portfolio-strip">
      <div className="portfolio-cell">
        <span className="portfolio-cell-label">Notional Guarded</span>
        <span className="portfolio-cell-value">{fmtMoney(portfolio.notional)}</span>
        <span className="portfolio-cell-delta">across {portfolio.count} positions</span>
      </div>
      <div className="portfolio-cell">
        <span className="portfolio-cell-label">Arc USDC Margin</span>
        <span className="portfolio-cell-value gold">{fmtMoney(portfolio.margin)}</span>
        <span className="portfolio-cell-delta">deployable via Gateway</span>
      </div>
      <div className="portfolio-cell">
        <span className="portfolio-cell-label">Average Leverage</span>
        <span className="portfolio-cell-value">{fmt(portfolio.avgLev, 1)}×</span>
        <span className="portfolio-cell-delta">weighted by notional</span>
      </div>
      <div className="portfolio-cell">
        <span className="portfolio-cell-label">Weakest Buffer</span>
        <span className={"portfolio-cell-value " + (weakestState === "danger" ? "red" : weakestState === "watch" ? "amber" : "green")}>
          {fmt(weakest.buffer, 1)}%
        </span>
        <span className="portfolio-cell-delta">{weakest.symbol} · {weakest.venue}</span>
      </div>
    </div>);

}

function PositionCard({ p, profile }) {
  const state = bufferState(p.buffer, p.bufferTarget);
  const stateLabels = { danger: "Near Liq", watch: "Watch", healthy: "Healthy" };
  const action = (() => {
    if (state === "danger")
    return `Add ${Math.round((p.bufferTarget - p.buffer) * (p.notional / 100) * 0.6)} USDC or deleverage ${Math.round((p.bufferTarget - p.buffer) * 1.4)}%`;
    if (state === "watch") return `Hold. Auto-hedge primed for next ${profile === "Conservative" ? "1.5%" : "3%"} drift.`;
    return "No action. Buffer above policy.";
  })();
  const bufferPct = Math.min(100, p.buffer * 4);
  const targetPct = Math.min(100, p.bufferTarget * 4);
  return (
    <div className={"pos-card state-" + state}>
      <div className="pos-head">
        <div>
          <div className="pos-symbol">{p.symbol}</div>
          <div className="pos-venue">
            <span>{p.venue}</span> · <span>{p.chain}</span>
          </div>
        </div>
        <div className={"pos-state " + state}>{stateLabels[state]}</div>
      </div>

      <div className="pos-grid">
        <div>
          <div className="pos-stat-label">Side / Leverage</div>
          <div className="pos-stat-value">
            {p.side} · {fmt(p.leverage, 1)}×
          </div>
        </div>
        <div>
          <div className="pos-stat-label">Notional</div>
          <div className="pos-stat-value">{fmtMoney(p.notional)}</div>
        </div>
        <div>
          <div className="pos-stat-label">Funding (8h)</div>
          <div className={"pos-stat-value " + (p.funding < 0 ? "red" : "green")}>
            {p.funding * 100 >= 0 ? "+" : ""}{fmt(p.funding * 100, 4)}%
          </div>
        </div>
        <div>
          <div className="pos-stat-label">Unrealized PnL</div>
          <div className={"pos-stat-value " + (p.pnl >= 0 ? "green" : "red")}>
            {fmtSigned(p.pnl)}
          </div>
        </div>
      </div>

      <div className="buffer-block">
        <div className="pos-stat-label">
          <span>Liquidation Buffer</span>
          <span style={{ color: "var(--cream)" }}>{fmt(p.buffer, 1)}%</span>
        </div>
        <div className="buffer-bar">
          <div
            className={"buffer-bar-fill " + state}
            style={{ width: bufferPct + "%" }}>
          </div>
          <div className="buffer-bar-tick" style={{ left: targetPct + "%" }}></div>
        </div>
        <div style={{ marginTop: 6, fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.12em", color: "var(--cream-dim)" }}>
          POLICY FLOOR · {p.bufferTarget}%
        </div>
      </div>

      <div className="pos-action">
        <div className="pos-action-label">Recommended Action</div>
        <div className="pos-action-text">{action}</div>
      </div>
    </div>);

}

// ---------- Policy ----------

function Policy({ profile, setProfile, autopilot, setAutopilot }) {
  const cfg = POLICY_PROFILES[profile];
  return (
    <div className="policy-grid">
      <div className="policy-card">
        <div className="policy-profiles">
          {Object.keys(POLICY_PROFILES).map((p) =>
          <button
            key={p}
            className={"profile-btn" + (profile === p ? " active" : "")}
            onClick={() => setProfile(p)}>
            
              {p}
            </button>
          )}
        </div>

        <div className="policy-rules">
          <div className="rule">
            <span className="rule-label">Max Leverage</span>
            <span className="rule-value">{cfg.maxLev}×</span>
          </div>
          <div className="rule">
            <span className="rule-label">Min Liquidation Buffer</span>
            <span className="rule-value gold">{cfg.minBuffer}%</span>
          </div>
          <div className="rule">
            <span className="rule-label">Max USDC / Emergency</span>
            <span className="rule-value">${cfg.maxEmergency.toLocaleString()}</span>
          </div>
          <div className="rule">
            <span className="rule-label">Daily Spend Cap</span>
            <span className="rule-value">${cfg.dailyCap.toLocaleString()}</span>
          </div>
          <div className="rule">
            <span className="rule-label">Allowed Venues</span>
            <span className="rule-value sm">{cfg.venues.join(" · ")}</span>
          </div>
          <div className="rule" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span className="rule-label" style={{ display: "block" }}>Auto-Hedge</span>
              <span className="rule-value sm">{cfg.autoHedge ? "Enabled" : "Off"}</span>
            </div>
            <button
              className={"toggle" + (autopilot ? " on" : "")}
              onClick={() => setAutopilot(!autopilot)}
              aria-label="Autopilot">
            </button>
          </div>
        </div>

        <div className="policy-contract">
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-dim)", textTransform: "uppercase", marginBottom: 4 }}>
              Policy Contract
            </div>
            <span className="policy-contract-addr">0xArc7…91fC</span>
          </div>
          <span style={{ color: "var(--green)" }}>● ACTIVE ON ARC TESTNET</span>
        </div>
      </div>

      <aside className="policy-side">
        <div className="policy-side-quote">
          The agent can act <span className="accent">fast</span>, but only inside your policy.
        </div>

        <div className="permissions">
          <div className="perm-row">
            <span className="perm-icon ok">✓</span>
            <span className="perm-label">Top up USDC collateral up to policy cap</span>
          </div>
          <div className="perm-row">
            <span className="perm-icon ok">✓</span>
            <span className="perm-label">Deleverage positions under volatility stress</span>
          </div>
          <div className="perm-row">
            <span className="perm-icon ok">✓</span>
            <span className="perm-label">Open hedges on whitelisted venues</span>
          </div>
          <div className="perm-row">
            <span className="perm-icon no">×</span>
            <span className="perm-label">Move funds off your wallet</span>
          </div>
          <div className="perm-row">
            <span className="perm-icon no">×</span>
            <span className="perm-label">Open new directional exposure</span>
          </div>
          <div className="perm-row">
            <span className="perm-icon no">×</span>
            <span className="perm-label">Exceed daily spend or emergency caps</span>
          </div>
        </div>
      </aside>
    </div>);

}

// ---------- Arc primitives ----------

const PRIMITIVES = [
{
  n: "01",
  name: "USDC Gas",
  desc: "Pay for emergency actions in USDC. No gas-token juggling while a position is bleeding.",
  icon:
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="11" stroke="#FFA319" strokeWidth="1.5" />
        <text x="14" y="18" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" fill="#FFA319">$</text>
      </svg>

},
{
  n: "02",
  name: "Gateway",
  desc: "One unified USDC balance across every chain the agent monitors. Liquidity always within reach.",
  icon:
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="3" y="3" width="22" height="22" rx="5" stroke="#FFA319" strokeWidth="1.5" />
        <path d="M3 14 H25 M14 3 V25" stroke="#FFA319" strokeWidth="1.5" />
      </svg>

},
{
  n: "03",
  name: "CCTP",
  desc: "Native USDC movement between ecosystems — no wrapped detours, no bridge counterparty risk.",
  icon:
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="8" cy="14" r="4" stroke="#FFA319" strokeWidth="1.5" />
        <circle cx="20" cy="14" r="4" stroke="#FFA319" strokeWidth="1.5" />
        <path d="M12 14 H16" stroke="#FFA319" strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>

},
{
  n: "04",
  name: "Paymaster",
  desc: "Smoother user-funded execution. The agent transacts; your wallet stays a clean ledger.",
  icon:
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M5 8 H23 V20 H5 Z" stroke="#FFA319" strokeWidth="1.5" />
        <circle cx="14" cy="14" r="3" stroke="#FFA319" strokeWidth="1.5" />
      </svg>

},
{
  n: "05",
  name: "Policy Contracts",
  desc: "Hard, on-chain limits before the agent ever signs. Permissions are scoped, not implicit.",
  icon:
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 3 L23 7 V14 C23 19 19 23 14 25 C9 23 5 19 5 14 V7 L14 3 Z" stroke="#FFA319" strokeWidth="1.5" />
        <path d="M10 14 L13 17 L18 11" stroke="#FFA319" strokeWidth="1.5" />
      </svg>

},
{
  n: "06",
  name: "Receipts",
  desc: "Every agent decision lands on Arc testnet as an auditable receipt. No black-box behaviour.",
  icon:
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M7 3 H21 V25 L18 22 L14 25 L10 22 L7 25 Z" stroke="#FFA319" strokeWidth="1.5" />
        <path d="M11 10 H17 M11 14 H17 M11 18 H15" stroke="#FFA319" strokeWidth="1.5" />
      </svg>

}];


function ArcLayer() {
  return (
    <div className="primitives">
      {PRIMITIVES.map((p) =>
      <div key={p.n} className="prim">
          <div className="prim-num">{p.n}</div>
          <div className="prim-icon">{p.icon}</div>
          <div className="prim-name">{p.name}</div>
          <div className="prim-desc">{p.desc}</div>
        </div>
      )}
    </div>);

}

// ---------- Receipts ----------

function ReceiptsList({ receipts, newId }) {
  return (
    <div className="receipts">
      {receipts.map((r) =>
      <div key={r.id} className={"receipt" + (r.id === newId ? " is-new" : "")}>
          <div className="receipt-time mono">{r.time}</div>
          <div>
            <div className={"receipt-title " + (r.titleClass || "")}>{r.title}</div>
            <div className="receipt-meta">
              <span>{r.venue}</span>
              <span>· {r.primitive}</span>
              {r.amount != null && <span>· {r.amount} USDC</span>}
            </div>
            <div className="receipt-reason" style={{ marginTop: 8 }}>{r.reason}</div>
          </div>
          <div className="receipt-buffer">
            {r.bufferBefore != null ?
          <>
                Buffer{" "}
                <span className={r.bufferBefore < 10 ? "red" : ""}>{fmt(r.bufferBefore, 1)}%</span>
                <span className="arrow">→</span>
                <span className={r.bufferAfter > r.bufferBefore ? "green" : "red"}>
                  {fmt(r.bufferAfter, 1)}%
                </span>
              </> :

          <span style={{ color: "var(--cream-dim)" }}>Pre-trade gate</span>
          }
          </div>
          <div className={"receipt-status " + r.status}>{r.status}</div>
        </div>
      )}
    </div>);

}

// ---------- Demo strip ----------

const DEMO_STEPS = [
{ title: "Market shock hits", desc: "Spot drifts 4–8%; perp funding inverts on momentum venues." },
{ title: "Buffer falls", desc: "Liquidation buffer crosses your policy floor on at least one position." },
{ title: "Agent evaluates", desc: "Rescue with USDC top-up vs. deleverage. Cheapest defence wins." },
{ title: "Policy decides", desc: "Policy Contract approves inside scope or denies and emits a block." },
{ title: "Arc receipt", desc: "Action settles on Arc testnet. Receipt published. State recomputed." }];


function DemoStrip({ active }) {
  return (
    <div className="demo-strip">
      {DEMO_STEPS.map((s, i) =>
      <div key={i} className={"demo-step" + (active === i ? " active" : "")}>
          <div className="demo-step-num">{String(i + 1).padStart(2, "0")}</div>
          <div className="demo-step-title">{s.title}</div>
          <div className="demo-step-desc">{s.desc}</div>
          {i < DEMO_STEPS.length - 1 && <div className="demo-arrow">→</div>}
        </div>
      )}
    </div>);

}

// ---------- Venues ----------

const VENUES = [
{ name: "Hyperliquid", state: "live", chain: "Arbitrum", markets: 86, label: "Live risk feed" },
{ name: "dYdX", state: "live", chain: "Cosmos", markets: 64, label: "Live risk feed" },
{ name: "GMX", state: "sim", chain: "Arbitrum / Avalanche", markets: 38, label: "Simulated adapter" },
{ name: "Vertex", state: "sim", chain: "Arbitrum", markets: 42, label: "Simulated adapter" }];


function Venues() {
  return (
    <div className="venues">
      {VENUES.map((v) =>
      <div key={v.name} className="venue">
          <div className="venue-head">
            <div className="venue-name">{v.name}</div>
            <span className={"venue-tag " + v.state}>{v.label}</span>
          </div>
          <div className="venue-row"><span>Chain</span><span>{v.chain}</span></div>
          <div className="venue-row"><span>Markets</span><span>{v.markets}</span></div>
          <div className="venue-row">
            <span>Settlement</span>
            <span style={{ color: "var(--gold-hot)" }}>Arc Testnet</span>
          </div>
        </div>
      )}
    </div>);

}

// ---------- Footer marquee ----------

function Marquee() {
  const items = [
  "Stay Solvent", "Margin Never Sleeps", "Keep The Trade Alive",
  "Autonomous Margin Defense", "Leverage With A Safety Net"];

  return (
    <div className="marquee">
      <div className="marquee-track">
        {[0, 1].map((k) =>
        <span key={k}>
            {items.map((it, i) =>
          <React.Fragment key={i}>
                {it}
                <span className="dot"></span>
              </React.Fragment>
          )}
          </span>
        )}
      </div>
    </div>);

}

// ---------- App ----------

function App() {
  const [positions, setPositions] = useState(INITIAL_POSITIONS);
  const [receipts, setReceipts] = useState(INITIAL_RECEIPTS);
  const [profile, setProfile] = useState("Balanced");
  const [autopilot, setAutopilot] = useState(true);
  const [marginPool, setMarginPool] = useState(42500);
  const [shocked, setShocked] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [section, setSection] = useState("Dashboard");
  const [newReceiptId, setNewReceiptId] = useState(null);

  // Apply policy floors when profile changes
  useEffect(() => {
    const floor = POLICY_PROFILES[profile].minBuffer;
    setPositions((ps) => ps.map((p) => ({ ...p, bufferTarget: floor })));
  }, [profile]);

  // Derived: portfolio + weakest position
  const portfolio = useMemo(() => {
    const notional = positions.reduce((s, p) => s + p.notional, 0);
    const lev = positions.reduce((s, p) => s + p.leverage * p.notional, 0) / (notional || 1);
    return { notional, margin: marginPool, avgLev: lev, count: positions.length };
  }, [positions, marginPool]);

  const weakest = useMemo(
    () => [...positions].sort((a, b) => a.buffer / a.bufferTarget - b.buffer / b.bufferTarget)[0],
    [positions]
  );

  // ---------- Actions ----------

  const runStep = async (n) => {
    setActiveStep(n);
    await new Promise((r) => setTimeout(r, 600));
  };

  const shock = async () => {
    setShocked(true);
    await runStep(0);
    setPositions((ps) =>
    ps.map((p) => ({
      ...p,
      buffer: Math.max(1.5, p.buffer - (4 + Math.random() * 5)),
      pnl: Math.round(p.pnl - p.notional * (0.015 + Math.random() * 0.03)),
      funding: p.funding + (Math.random() - 0.3) * 0.008
    }))
    );
    await runStep(1);
    setActiveStep(-1);
  };

  const runCycle = async () => {
    const cfg = POLICY_PROFILES[profile];
    await runStep(2);

    // Pick the weakest position
    const target = [...positions].sort((a, b) => a.buffer / a.bufferTarget - b.buffer / b.bufferTarget)[0];
    if (!target) return;

    await runStep(3);

    // Policy decision
    const bufferGap = target.bufferTarget - target.buffer;
    const blocked = target.leverage > cfg.maxLev;
    const t = now();
    const id = "r" + Date.now();

    if (blocked) {
      setReceipts((r) => [
      {
        id,
        time: t,
        title: `Blocked ${fmt(target.leverage, 1)}× ${target.symbol.split("-")[0]} leverage breach`,
        titleClass: "red",
        venue: `${target.venue} · ${target.symbol}`,
        primitive: "Policy Contract",
        bufferBefore: null,
        bufferAfter: null,
        amount: null,
        reason: `Position leverage exceeds ${profile} policy cap of ${cfg.maxLev}×. Agent denied before broadcast.`,
        status: "blocked"
      },
      ...r]
      );
    } else if (bufferGap > 0) {
      // Need to act
      const topupAmount = Math.min(
        cfg.maxEmergency,
        Math.round(target.notional * (bufferGap / 100) * 0.6)
      );
      const deleverage = topupAmount >= cfg.maxEmergency * 0.95;
      const newBuffer = Math.min(40, target.buffer + bufferGap + (deleverage ? 0.4 : 1.2));

      setPositions((ps) =>
      ps.map((p) =>
      p.id === target.id ?
      { ...p, buffer: newBuffer, leverage: deleverage ? Math.max(2, p.leverage * 0.82) : p.leverage } :
      p
      )
      );
      setMarginPool((m) => m - topupAmount);

      setReceipts((r) => [
      {
        id,
        time: t,
        title: deleverage ?
        `Reduced ${target.symbol.split("-")[0]} exposure by 18%` :
        `Settled ${topupAmount} USDC collateral top-up`,
        titleClass: deleverage ? "amber" : "green",
        venue: `${target.venue} · ${target.symbol}`,
        primitive: deleverage ? "Agent Receipt" : "Gateway + CCTP",
        bufferBefore: target.buffer,
        bufferAfter: newBuffer,
        amount: deleverage ? null : topupAmount,
        reason: deleverage ?
        `Top-up beyond emergency cap. Deleverage chosen as cheaper defence.` :
        `Buffer fell below ${profile} floor of ${cfg.minBuffer}%. USDC routed via Gateway and CCTP.`,
        status: "settled"
      },
      ...r]
      );
    } else {
      setReceipts((r) => [
      {
        id,
        time: t,
        title: `Cycle complete · No action required`,
        titleClass: "green",
        venue: `Portfolio scan`,
        primitive: "Agent Receipt",
        bufferBefore: target.buffer,
        bufferAfter: target.buffer,
        amount: null,
        reason: `All positions sit above policy floor of ${cfg.minBuffer}%. Watching funding and volatility.`,
        status: "settled"
      },
      ...r]
      );
    }

    setNewReceiptId(id);
    await runStep(4);
    setActiveStep(-1);
    setTimeout(() => setNewReceiptId(null), 800);
  };

  const reset = () => {
    setPositions(INITIAL_POSITIONS.map((p) => ({ ...p, bufferTarget: POLICY_PROFILES[profile].minBuffer })));
    setReceipts(INITIAL_RECEIPTS);
    setMarginPool(42500);
    setShocked(false);
    setActiveStep(-1);
  };

  return (
    <>
      <Nav section={section} setSection={setSection} onRunCycle={runCycle} />

      <Hero portfolio={portfolio} weakest={weakest} onRunCycle={runCycle} onShock={shock} />

      {/* Risk Command Center */}
      <section id="sec-dashboard" className="section wrap" data-screen-label="Risk Command Center">
        <hr className="dotted" />
        <div className="section-header" style={{ marginTop: 36 }}>
          <div>
            <div className="section-num">// 01 — Risk Command Center</div>
            <h2 className="display section-title" style={{ marginTop: 12 }}>
              Every Position. <span className="accent">One Console.</span>
            </h2>
          </div>
          <div className="section-kicker">
            Live across venues. Buffers, funding, PnL and policy fit — surfaced
            before they matter.
          </div>
          <div style={{ display: "flex", gap: 8, paddingBottom: 8 }}>
            <button className="pill outline" onClick={shock}>⚡ Simulate Shock</button>
            <button className="pill gold" onClick={runCycle}>▶ Run Cycle</button>
            <button className="pill ghost" onClick={reset}>↺ Reset</button>
          </div>
        </div>

        <PortfolioStrip portfolio={portfolio} weakest={weakest} />

        <div className="positions">
          {positions.map((p) =>
          <PositionCard key={p.id} p={p} profile={profile} />
          )}
        </div>
      </section>

      {/* Policy */}
      <section id="sec-policy" className="section wrap" data-screen-label="Policy Contract">
        <hr className="dotted" />
        <div className="section-header" style={{ marginTop: 36 }}>
          <div>
            <div className="section-num">// 02 — Policy Contract</div>
            <h2 className="display section-title" style={{ marginTop: 12 }}>
              Scoped. <span className="stroke">Signed.</span> Enforced.
            </h2>
          </div>
          <div className="section-kicker">
            The agent ships with a leash. Edit the policy here; the contract on
            Arc testnet decides what passes.
          </div>
        </div>

        <Policy
          profile={profile}
          setProfile={setProfile}
          autopilot={autopilot}
          setAutopilot={setAutopilot} />
        
      </section>

      {/* Arc Layer */}
      <section id="sec-arc-layer" className="section wrap" data-screen-label="Arc Layer">
        <hr className="dotted" />
        <div className="section-header" style={{ marginTop: 36 }}>
          <div>
            <div className="section-num">// 03 — What Keeps You Solvent</div>
            <h2 className="display section-title" style={{ marginTop: 12, padding: "0px", margin: "3px 0px 0px" }}>
              Built on <span className="accent">Arc</span> primitives.
            </h2>
          </div>
          <div className="section-kicker">
            ArcMargin is thin glue over Circle/Arc rails. Every emergency action
            uses native USDC, scoped policy, and verifiable receipts.
          </div>
        </div>

        <ArcLayer />
      </section>

      {/* Receipts */}
      <section className="section wrap" data-screen-label="Receipt Trail">
        <hr className="dotted" />
        <div className="section-header" style={{ marginTop: 36 }}>
          <div>
            <div className="section-num">// 04 — Agent Receipt Trail</div>
            <h2 className="display section-title" style={{ marginTop: 12 }}>
              Nothing happens <span className="accent">off-record.</span>
            </h2>
          </div>
          <div className="section-kicker">
            Each agent decision lands as an Arc receipt — settled, blocked or
            simulated. Run a cycle to write a new one.
          </div>
        </div>

        <ReceiptsList receipts={receipts} newId={newReceiptId} />
      </section>

      {/* Demo */}
      <section id="sec-demo" className="section wrap" data-screen-label="Demo Flow">
        <hr className="dotted" />
        <div className="section-header" style={{ marginTop: 36 }}>
          <div>
            <div className="section-num">// 05 — Demo Flow</div>
            <h2 className="display section-title" style={{ marginTop: 12 }}>
              Ten <span className="accent">seconds.</span> Five steps.
            </h2>
          </div>
          <div className="section-kicker">
            What judges will see when the buttons get pressed. Each step
            highlights as the agent moves through it.
          </div>
          <div style={{ display: "flex", gap: 8, paddingBottom: 8 }}>
            <button className="pill outline" onClick={shock}>⚡ Trigger Shock</button>
            <button className="pill gold" onClick={runCycle}>▶ Run Cycle</button>
          </div>
        </div>

        <DemoStrip active={activeStep} />
      </section>

      {/* Venues */}
      <section className="section wrap" data-screen-label="Venues">
        <hr className="dotted" />
        <div className="section-header" style={{ marginTop: 36 }}>
          <div>
            <div className="section-num">// 06 — Venue Adapters</div>
            <h2 className="display section-title" style={{ marginTop: 12 }}>
              Wherever the <span className="accent">trade</span> is open.
            </h2>
          </div>
          <div className="section-kicker">
            ArcMargin reads from every perp venue you trust. Some are live risk
            feeds; the rest are simulated until production hooks ship.
          </div>
        </div>

        <Venues />

        <div className="honest">
          <div className="honest-mark">!</div>
          <div className="honest-text">
            <b>ArcMargin runs on Arc public testnet.</b> Perp venue actions are
            demonstrated through adapters and simulations until production
            integrations are available. Mainnet-ready architecture; no real
            funds are protected today.
          </div>
        </div>
      </section>

      <Marquee />

      <footer className="footer">
        <div className="wrap">
          <div className="footer-inner">
            <div>
              <div className="footer-brand-name">
                Arc<span className="accent">Margin</span>
              </div>
              <div className="footer-tag">
                An Arc testnet liquidation-protection and collateral-routing
                agent. Built for the hackathon. Wired for production.
              </div>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Product</div>
              <ul>
                <li><a href="#">Risk Command Center</a></li>
                <li><a href="#">Policy Contracts</a></li>
                <li><a href="#">Receipt Explorer</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Stack</div>
              <ul>
                <li><a href="#">Arc Testnet</a></li>
                <li><a href="#">USDC / CCTP</a></li>
                <li><a href="#">Gateway · Paymaster</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Demo</div>
              <ul>
                <li><a href="#" onClick={(e) => {e.preventDefault();runCycle();}}>Run Agent Cycle</a></li>
                <li><a href="#" onClick={(e) => {e.preventDefault();shock();}}>Simulate Shock</a></li>
                <li><a href="#" onClick={(e) => {e.preventDefault();reset();}}>Reset Scenario</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>ArcMargin · v0.1 testnet</span>
            <span>0xArc7…91fC · Hackathon Build · {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </>);

}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);