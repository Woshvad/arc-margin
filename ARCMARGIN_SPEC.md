# ArcMargin — Codex Build Spec

## What You Are Building

ArcMargin is a hackathon-ready Arc testnet product. It is a liquidation protection and collateral routing agent for perp traders. It monitors leveraged positions, detects liquidation risk, evaluates whether to add collateral, deleverage, hedge, or block a risky action, then routes the permitted action through Arc testnet as the policy, settlement, and receipt layer.

The finished app must feel like a real product a hackathon judge can open, interact with, and understand in under 10 seconds — not a prototype, not a landing page, not a generic DeFi dashboard.

The existing design lives at `C:\Users\woshv\Downloads\ArcMargin` (files: `ArcMargin.html`, `app.jsx`, `styles.css`). Preserve the visual identity. Fix the product gaps.

---

## Stack

- **Framework**: Vite + React + TypeScript
- **State**: Zustand (single store)
- **Styling**: Tailwind CSS + custom CSS variables for the existing palette
- **No additional dependencies** without flagging in a comment

---

## Palette and Typography

```css
--color-bg: #1a1108;           /* dark roasted background */
--color-gold: #d4a017;         /* headline gold */
--color-cream: #f5f0e8;        /* body text */
--color-red: #dc2626;          /* danger / liquidation */
--color-green: #16a34a;        /* settled / healthy */
--color-muted: #6b5e4e;        /* secondary labels */
--color-border: #2d2218;       /* dotted separators */
```

- Display/hero type: chunky serif or condensed display (match existing design)
- Label/data type: compact monospace or sans
- Pill buttons throughout
- Dotted separators between sections

---

## TypeScript Types

These are the exact types. Do not modify them.

```ts
type Position = {
  id: string;
  symbol: string;
  venue: "Hyperliquid" | "dYdX" | "GMX" | "Vertex";
  chain: string;
  side: "LONG" | "SHORT";
  leverage: number;
  notional: number;
  margin: number;
  buffer: number;          // liquidation buffer %
  funding: number;         // funding rate %
  pnl: number;
  bufferTarget: number;
  volatility: number;
};

type Policy = {
  profile: "Conservative" | "Balanced" | "Advanced";
  maxLeverage: number;
  minBuffer: number;
  maxEmergencySpend: number;
  dailySpendCap: number;
  spentToday: number;
  allowedVenues: string[];
  allowedChains: string[];
  autoHedge: boolean;
  paused: boolean;
  contractAddress: string;
};

type Receipt = {
  id: string;
  time: string;
  action: "hold" | "add-collateral" | "deleverage" | "hedge" | "block";
  title: string;
  venue: string;
  pair: string;
  amount?: number;
  bufferBefore?: number;
  bufferAfter?: number;
  status: "settled" | "blocked" | "simulated";
  primitive: "Gateway + CCTP" | "Policy Contract" | "Paymaster" | "Arc Receipt" | "Risk Oracle";
  reason: string;
  txId: string;
};

type AdapterStatus = {
  venue: string;
  riskFeed: "live" | "simulated" | "offline";
  executionAdapter: "simulated" | "offline";
  settlementMode: "testnet" | "mainnet-ready";
  lastChecked: string;
};

type AppState = {
  positions: Position[];
  policy: Policy;
  receipts: Receipt[];
  adapters: AdapterStatus[];
  autopilot: boolean;
  shockActive: boolean;
  liquidationsPrevented: number;
  actionsBlocked: number;
  usdcRouted: number;
  sessionReceiptsCount: number;
  walletConnected: boolean;
  walletAddress: string;
  usdcBalance: number;
  demoMode: boolean;
  demoStep: number;
};
```

---

## Initial State

```ts
const initialPositions: Position[] = [
  {
    id: "pos-1",
    symbol: "ETH-PERP",
    venue: "dYdX",
    chain: "Ethereum",
    side: "LONG",
    leverage: 7.2,
    notional: 18400,
    margin: 2555,
    buffer: 14.2,
    funding: -0.012,
    pnl: 340,
    bufferTarget: 15,
    volatility: 0.42,
  },
  {
    id: "pos-2",
    symbol: "SOL-PERP",
    venue: "GMX",
    chain: "Arbitrum",
    side: "LONG",
    leverage: 9.1,
    notional: 11200,
    margin: 1230,
    buffer: 8.4,
    funding: 0.008,
    pnl: -120,
    bufferTarget: 12,
    volatility: 0.68,
  },
  {
    id: "pos-3",
    symbol: "BTC-PERP",
    venue: "Hyperliquid",
    chain: "Hyperliquid L1",
    side: "SHORT",
    leverage: 4.5,
    notional: 32000,
    margin: 7111,
    buffer: 22.1,
    funding: 0.003,
    pnl: 880,
    bufferTarget: 18,
    volatility: 0.31,
  },
  {
    id: "pos-4",
    symbol: "ARB-PERP",
    venue: "Vertex",
    chain: "Arbitrum",
    side: "LONG",
    leverage: 6.0,
    notional: 5400,
    margin: 900,
    buffer: 11.7,
    funding: -0.005,
    pnl: 60,
    bufferTarget: 12,
    volatility: 0.55,
  },
];

const initialPolicy: Policy = {
  profile: "Balanced",
  maxLeverage: 8,
  minBuffer: 10,
  maxEmergencySpend: 500,
  dailySpendCap: 1500,
  spentToday: 0,
  allowedVenues: ["Hyperliquid", "dYdX", "GMX", "Vertex"],
  allowedChains: ["Ethereum", "Arbitrum", "Hyperliquid L1"],
  autoHedge: false,
  paused: false,
  contractAddress: "0xArc...91fC",
};

const initialAdapters: AdapterStatus[] = [
  { venue: "Hyperliquid", riskFeed: "live", executionAdapter: "simulated", settlementMode: "testnet", lastChecked: "2 min ago" },
  { venue: "dYdX", riskFeed: "live", executionAdapter: "simulated", settlementMode: "testnet", lastChecked: "2 min ago" },
  { venue: "GMX", riskFeed: "simulated", executionAdapter: "simulated", settlementMode: "mainnet-ready", lastChecked: "5 min ago" },
  { venue: "Vertex", riskFeed: "simulated", executionAdapter: "simulated", settlementMode: "mainnet-ready", lastChecked: "5 min ago" },
];
```

---

## Store Actions

Implement these actions in Zustand:

### `simulateMarketShock()`
- Reduce `buffer` on all positions by 30–45% (random per position, seeded so it's reproducible)
- Increase `volatility` on all positions by 0.2–0.4
- Increase `leverage` on 2 positions by 1.0–2.0
- Set `shockActive: true`
- Do not change receipts

### `runAgentCycle()`
- Find the position with the lowest `buffer`
- Apply deterministic decision logic (see Agent Logic below)
- Push a new `Receipt` to `receipts[]`
- Update the position's `buffer`, `leverage`, or `pnl` to reflect the action
- Update session metrics: `liquidationsPrevented`, `usdcRouted`, `spentToday`, `sessionReceiptsCount`
- Mark the newest receipt as `isNew: true` for 2 seconds (for animation), then clear

### `changeRiskProfile(profile: "Conservative" | "Balanced" | "Advanced")`
- Conservative: `maxLeverage: 5`, `minBuffer: 15`, `maxEmergencySpend: 300`, `dailySpendCap: 800`
- Balanced: `maxLeverage: 8`, `minBuffer: 10`, `maxEmergencySpend: 500`, `dailySpendCap: 1500`
- Advanced: `maxLeverage: 12`, `minBuffer: 6`, `maxEmergencySpend: 1000`, `dailySpendCap: 3000`

### `toggleAutopilot()`
- Toggle `autopilot` boolean

### `togglePause()`
- Toggle `policy.paused`

### `toggleAutoHedge()`
- Toggle `policy.autoHedge`

### `resetScenario()`
- Reset entire store to initial state
- Clear all receipts except 2 seed receipts (see Seed Receipts below)

### `connectWallet()` / `disconnectWallet()`
- Toggle `walletConnected`
- Set `walletAddress` to `"0x7f3A...c91B"` when connected

### `startDemoMode()`
- Set `demoMode: true`, `demoStep: 0`
- Auto-sequence: wait 1.5s → `simulateMarketShock` → wait 2s → `runAgentCycle` → wait 2s → show policy gate step → wait 1.5s → show receipt → wait 1s → update metrics → set `demoMode: false`

### `exportPolicy()`
- Returns the active `Policy` object as a formatted JSON string for download/copy

---

## Agent Logic

Used inside `runAgentCycle()`. Evaluate the riskiest position (lowest buffer), then:

```
if (policy.paused):
  action = "hold"
  reason = "Agent is paused. No actions taken."
  status = "blocked"
  primitive = "Policy Contract"

else if (position.buffer < policy.minBuffer AND position.funding <= 0.01 AND policy.spentToday < policy.dailySpendCap):
  action = "add-collateral"
  amount = min(policy.maxEmergencySpend, policy.dailySpendCap - policy.spentToday)
  bufferAfter = position.buffer + (amount / position.notional * 100 * position.leverage)
  status = "settled"
  primitive = "Gateway + CCTP"
  reason = "Buffer fell below policy floor. Funding acceptable. Collateral routed via Arc Gateway."

else if (position.leverage > policy.maxLeverage AND position.volatility > 0.5):
  action = "deleverage"
  reduce leverage by 1.5–2.5 on that position
  bufferAfter = position.buffer + 3–5
  status = "simulated"
  primitive = "Arc Receipt"
  reason = "Leverage exceeded policy cap during high volatility. Position partially closed."

else if (position.leverage > policy.maxLeverage):
  action = "block"
  status = "blocked"
  primitive = "Policy Contract"
  reason = "Requested leverage exceeds policy cap. Action denied."

else if (position.buffer < policy.minBuffer AND policy.autoHedge):
  action = "hedge"
  status = "simulated"
  primitive = "Paymaster"
  reason = "Buffer thin. Auto-hedge enabled. Protective hedge opened via Paymaster."

else:
  action = "hold"
  status = "settled"
  primitive = "Risk Oracle"
  reason = "Position within policy envelope. No action required."
```

Generate a `txId` for every receipt: `"ARC-" + random 8-char hex`.

---

## Seed Receipts

Pre-populate `receipts` with these 2 on initial load:

```ts
[
  {
    id: "seed-1",
    time: "14:32",
    action: "add-collateral",
    title: "250 USDC collateral top-up",
    venue: "dYdX",
    pair: "ETH-PERP",
    amount: 250,
    bufferBefore: 8.4,
    bufferAfter: 12.6,
    status: "settled",
    primitive: "Gateway + CCTP",
    reason: "Buffer fell below policy floor while funding remained acceptable.",
    txId: "ARC-a1b2c3d4",
  },
  {
    id: "seed-2",
    time: "14:19",
    action: "block",
    title: "Blocked 9.4x SOL leverage increase",
    venue: "GMX",
    pair: "SOL-PERP",
    status: "blocked",
    primitive: "Policy Contract",
    reason: "Requested leverage exceeded Balanced policy cap of 8x.",
    txId: "ARC-e5f6a7b8",
  },
]
```

---

## Page Structure

Seven sections in order. Every section must be built, not stubbed.

---

### Section 1 — Hero / First Viewport

**Must include all of the following:**

- Sticky pill nav: `Risk Command | Policy | Arc Layer | Receipts | Demo`
- Eyebrow label: `ARC TESTNET · LIQUIDATION PROTECTION`
- Huge hero headline: `STAY SOLVENT`
- Subline: `Autonomous collateral routing and risk enforcement for perp traders. ArcMargin watches every leveraged position and acts inside the policy you signed before liquidation catches you.`
- Two primary CTAs: `Run Agent Cycle` and `Simulate Market Shock` — pill buttons, gold
- Arc vault centerpiece (preserve from existing design)
- Floating risk chips around vault: `Buffer: 8.4%`, `Leverage: 9.1x`, `Funding: -0.012%`, `Volatility: HIGH`, `Policy: Balanced`
- Compact Arc primitive chip row below vault: `USDC Gas · Gateway · CCTP · Paymaster · Policy Contracts · Arc Receipts`
- Testnet notice (muted, below hero): `ArcMargin runs on Arc public testnet. Perp venue execution is demonstrated through verified simulation adapters until production integrations are available.`
- Top-right wallet connect state: pill showing `0x7f3A...c91B · Arc Testnet · 2,400 USDC` when connected, or `Connect Wallet` when not
- Liquidations Prevented metric: large gold number visible in first viewport

---

### Section 2 — Risk Command Center

**Portfolio metrics bar:**
- Total Notional
- Portfolio PnL
- Positions at Risk (count with buffer < minBuffer)
- Autopilot toggle (pill, active/inactive state obvious)

**Position cards** (one per position):
- Symbol + venue + chain
- Side badge (LONG/SHORT)
- Leverage, Notional, Margin
- Liquidation buffer gauge (visual bar, colored by risk: green > 15%, amber 10–15%, red < 10%)
- Funding rate
- PnL
- Recommended action label (from agent logic preview, recalculated live)
- Risk state badge: HEALTHY / WATCH / DANGER

**Session impact block:**
- Liquidations Prevented
- Risky Actions Blocked
- USDC Routed
- Receipts This Session
- Daily Cap Remaining (meter/bar)

---

### Section 3 — Policy Contract

- Profile selector: `Conservative | Balanced | Advanced` (pill tabs, changes policy via `changeRiskProfile`)
- Policy rules grid:
  - Max Leverage
  - Min Liquidation Buffer
  - Max Emergency Spend
  - Daily Spend Cap
  - Allowed Venues
  - Allowed Chains
  - Auto-Hedge toggle
- Contract address: `0xArc...91fC` (monospace, copy button)
- Copy block: `The agent can act fast, but only inside your policy. No unlimited wallet access. No unrestricted trading. Every action passes policy first.`
- Kill switch: `Pause Agent` button (toggles `policy.paused`, changes button to `Resume Agent` when paused)
- Daily cap remaining meter (visual progress bar)
- Export Policy JSON button: copies or downloads the active policy as formatted JSON

---

### Section 4 — Arc Layer (Ingredient Cards)

Six cards, ingredient-card style, dark surface, gold accent:

| Card | Description |
|---|---|
| USDC Gas | No gas-token juggling during emergencies. Fees paid in USDC. |
| Gateway | Unified USDC balance across chains. One pool, any venue. |
| CCTP | Native USDC movement between ecosystems without bridging risk. |
| Paymaster | Smoother user-funded execution. Gas abstracted. |
| Policy Contracts | Hard limits enforced on-chain before the agent acts. |
| Agent Receipts | Auditable action trail. Every decision recorded on Arc testnet. |

---

### Section 5 — Receipt Trail

- Chronological list, newest first
- Each receipt card shows: time, action title, venue + pair, USDC amount (if applicable), buffer before/after, primitive used, status badge (Settled / Blocked / Simulated)
- Status colors: green = settled, red = blocked, amber = simulated
- `View Details` button on each receipt — opens Receipt Detail Drawer
- Newest receipt animates in (slide + fade from top, ~400ms)
- Adapter Health button opens Adapter Health Panel

---

### Section 6 — Demo Flow

Five-step visual sequence (numbered, horizontal on desktop, vertical on mobile):

1. Market shock hits
2. Liquidation buffer falls
3. Agent evaluates rescue vs deleverage
4. Policy contract approves or blocks
5. Arc testnet receipt settles the action

`Start Demo Mode` button below the steps — auto-runs the full sequence via `startDemoMode()`.

Demo mode progress: show which step is active with a highlight state while running.

---

### Section 7 — Venue Adapters (Adapter Health Panel)

Displayed as an overlay/drawer triggered from Receipt Trail section.

Four adapter rows (Hyperliquid, dYdX, GMX, Vertex):
- Risk feed status badge
- Execution adapter status badge
- Settlement mode
- Last checked timestamp
- Honest label: `Simulated execution adapter` where applicable

Close button to dismiss.

---

## Required Modals and Drawers

### Receipt Detail Drawer

Triggered by `View Details` on any receipt card. Slides in from right.

Must show:
- Action (large)
- Pair and venue
- Buffer before → after (with arrow)
- Policy checks: list of rules evaluated (pass/fail)
- Arc primitive used
- Simulated tx ID (`ARC-xxxxxxxx`)
- Reasoning summary
- Status badge
- Testnet/simulation disclosure: `This action was processed through Arc public testnet with a simulated venue adapter.`

Close button. Click-outside closes.

---

## Interactions Checklist

Every interaction must produce a visible UI change. None of these can be no-ops.

| Interaction | Expected Result |
|---|---|
| Simulate Market Shock | Buffers drop, danger badges appear, floating chips update, red states visible |
| Run Agent Cycle | New receipt animates in, position state updates, metrics update |
| Change Risk Profile | Policy values update immediately, position recommended actions may change |
| Toggle Autopilot | Autopilot pill changes to active state (glowing or colored) |
| Pause Agent | Policy paused state visible, kill switch button changes label |
| Reset Scenario | All positions and metrics return to initial state, receipts reset to 2 seeds |
| Keyboard `R` | Triggers Reset Scenario |
| View Receipt Details | Drawer opens with full detail |
| Export Policy JSON | JSON copied to clipboard or downloaded as `.json` file |
| Start Demo Mode | Auto-sequence runs with visible step highlights |
| Open Adapter Health | Overlay opens showing venue statuses |
| Connect / Disconnect Wallet | Wallet state changes in nav and hero |

---

## Mobile Requirements

- Nav: collapses to horizontally scrollable pill row, no overflow
- Hero headline: scales down, wraps intentionally, no clipping
- Floating chips: visible within viewport (reduce to 3 chips on mobile if needed)
- Arc vault: scales to fit, centered
- Position cards: full width, stacked
- Buttons: full width or stacked, all tap targets minimum 44px
- Drawers: full-screen on mobile
- No text overlap anywhere

---

## Footer

- `ArcMargin · Arc Testnet · Built for autonomous margin protection`
- `Press R to reset scenario`
- No food, tiger, or sauce references anywhere in the app

---

## README Requirements

The README must include:

1. **Product**: what ArcMargin does, who it is for
2. **Setup**: `npm install` + `npm run dev`, Node version requirement
3. **Demo script**: exact click sequence a judge should follow
4. **Architecture**: how state, agent logic, policy, and receipts connect
5. **Arc integration story**: what each Arc primitive does in the product
6. **Testnet limitations**: honest disclosure of what is simulated vs live
7. **Why it can win**: reference the agent/risk routing hackathon pattern

---

## Acceptance Criteria

The build is complete only when every item on this list is true:

- [ ] App runs with `npm run dev` without errors
- [ ] First viewport communicates the product before scrolling
- [ ] Arc primitives visible in first viewport
- [ ] Testnet/simulation notice visible
- [ ] Simulate Market Shock visibly changes risk state
- [ ] Run Agent Cycle creates a new receipt and updates position state
- [ ] Risk profile changes affect policy values and recommended actions
- [ ] At least one blocked action is demonstrated in the receipt trail
- [ ] Receipt detail drawer opens with full information
- [ ] Demo mode auto-steps through all five steps
- [ ] Liquidations Prevented appears near top-level metrics
- [ ] Daily cap remaining meter visible in policy section
- [ ] Mock wallet connect state visible and toggleable
- [ ] Policy JSON exports from the UI (copy or download)
- [ ] Adapter health panel opens and shows per-venue status
- [ ] Session impact block updates after agent cycles
- [ ] Reset works from UI button and keyboard `R`
- [ ] Mobile layout has no clipped text, overflow, or broken nav
- [ ] Desktop layout feels premium and editorial
- [ ] No Hungry Tiger assets, names, food imagery, or copied branding
- [ ] README is complete
