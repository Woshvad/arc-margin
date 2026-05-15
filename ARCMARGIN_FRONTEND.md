# ArcMargin — Frontend Spec

## What Changed From Static Design

The frontend is NOT a standalone demo anymore. It is a dashboard over a real backend agent.

- All state comes from `GET /api/state` polled every 5 seconds
- All interactions POST to the backend API
- Receipts reference real Arc testnet tx hashes with explorer links
- Demo mode uses local simulation as an offline fallback only

---

## Stack

```
Vite + React + TypeScript
Zustand (state)
Tailwind CSS + CSS variables
No additional dependencies without flagging
```

---

## Setup

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## Palette and Typography

```css
:root {
  --color-bg:     #1a1108;
  --color-gold:   #d4a017;
  --color-cream:  #f5f0e8;
  --color-red:    #dc2626;
  --color-green:  #16a34a;
  --color-amber:  #d97706;
  --color-muted:  #6b5e4e;
  --color-border: #2d2218;
  --color-card:   #221508;
}
```

---

## hooks/useAgentAPI.ts

```typescript
import { useEffect } from "react";
import { useStore } from "../store/useStore";

const API = import.meta.env.VITE_AGENT_API_URL ?? "http://localhost:3001";

export function useAgentAPI() {
  const setServerState = useStore((s) => s.setServerState);

  // Poll backend every 5 seconds
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`${API}/api/state`);
        const data = await res.json();
        setServerState(data);
      } catch {
        // Backend offline — frontend operates in demo-only mode
      }
    };

    fetchState();
    const id = setInterval(fetchState, 5000);
    return () => clearInterval(id);
  }, []);
}

export const api = {
  runCycle:     () => fetch(`${API}/api/cycle`,   { method: "POST" }),
  shock:        () => fetch(`${API}/api/shock`,   { method: "POST" }),
  reset:        () => fetch(`${API}/api/reset`,   { method: "POST" }),
  autopilot:    (on: boolean) => fetch(`${API}/api/autopilot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) }),
  pause:        (p: boolean)  => fetch(`${API}/api/pause`,     { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: p }) }),
  profile:      (p: string)   => fetch(`${API}/api/profile`,   { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: p }) }),
  autoHedge:    (on: boolean) => fetch(`${API}/api/autohedge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) }),
  exportPolicy: () => fetch(`${API}/api/policy/export`).then((r) => r.json()),
};
```

---

## store/useStore.ts

```typescript
import { create } from "zustand";

// Types mirror the backend AgentState exactly
interface StoreState {
  // Server-synced state
  positions:             any[];
  policy:                any;
  receipts:              any[];
  autopilot:             boolean;
  shockActive:           boolean;
  liquidationsPrevented: number;
  actionsBlocked:        number;
  usdcRouted:            number;
  sessionReceiptsCount:  number;
  walletAddress:         string;
  usdcBalance:           number;
  agentErc8004Id:        string;
  lastCycleAt:           string | null;

  // Local UI state
  backendConnected:      boolean;
  selectedReceipt:       any | null;
  adapterHealthOpen:     boolean;
  demoMode:              boolean;
  demoStep:              number;
  walletConnected:       boolean;
  newestReceiptId:       string | null;

  // Actions
  setServerState:        (state: any) => void;
  setSelectedReceipt:    (r: any | null) => void;
  setAdapterHealthOpen:  (open: boolean) => void;
  startDemoMode:         () => void;
  connectWallet:         () => void;
  disconnectWallet:      () => void;
  applyLocalShock:       () => void;  // offline fallback
  runLocalCycle:         () => void;  // offline fallback
  resetLocal:            () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  // Initial state
  positions:             [],
  policy:                { profile: "Balanced", maxLeverage: 8, minBuffer: 10, maxEmergencySpend: 500, dailySpendCap: 1500, spentToday: 0, allowedVenues: [], allowedChains: [], autoHedge: false, paused: false, contractAddress: "0xPending" },
  receipts:              [],
  autopilot:             false,
  shockActive:           false,
  liquidationsPrevented: 0,
  actionsBlocked:        0,
  usdcRouted:            0,
  sessionReceiptsCount:  0,
  walletAddress:         "",
  usdcBalance:           0,
  agentErc8004Id:        "",
  lastCycleAt:           null,
  backendConnected:      false,
  selectedReceipt:       null,
  adapterHealthOpen:     false,
  demoMode:              false,
  demoStep:              0,
  walletConnected:       false,
  newestReceiptId:       null,

  setServerState: (data) => set({ ...data, backendConnected: true }),

  setSelectedReceipt:   (r)    => set({ selectedReceipt: r }),
  setAdapterHealthOpen: (open) => set({ adapterHealthOpen: open }),

  connectWallet:    () => set({ walletConnected: true,  walletAddress: "0x7f3A...c91B" }),
  disconnectWallet: () => set({ walletConnected: false, walletAddress: "" }),

  startDemoMode: () => {
    // Auto-sequence: shock → cycle → policy gate → receipt → metrics
    set({ demoMode: true, demoStep: 0 });

    setTimeout(() => {
      set({ demoStep: 1 });
      get().applyLocalShock();
    }, 1500);

    setTimeout(() => {
      set({ demoStep: 2 });
    }, 3500);

    setTimeout(() => {
      set({ demoStep: 3 });
      get().runLocalCycle();
    }, 5500);

    setTimeout(() => {
      set({ demoStep: 4 });
    }, 7500);

    setTimeout(() => {
      set({ demoStep: 5 });
    }, 9000);

    setTimeout(() => {
      set({ demoMode: false, demoStep: 0 });
    }, 11000);
  },

  applyLocalShock: () => set((s) => ({
    shockActive: true,
    positions: s.positions.map((p) => ({
      ...p,
      buffer:     p.buffer    * (1 - (0.30 + Math.random() * 0.15)),
      volatility: Math.min(p.volatility + 0.2 + Math.random() * 0.2, 1.0),
      leverage:   Math.random() > 0.5 ? p.leverage + 1 + Math.random() : p.leverage,
    })),
  })),

  runLocalCycle: () => set((s) => {
    const riskiest = [...s.positions].sort((a, b) => a.buffer - b.buffer)[0];
    if (!riskiest) return s;

    const bufferBefore = riskiest.buffer;
    const isBelow = riskiest.buffer < s.policy.minBuffer;
    const action = isBelow ? "add-collateral" : riskiest.leverage > s.policy.maxLeverage ? "block" : "hold";
    const bufferAfter = action === "add-collateral" ? riskiest.buffer + 4 : riskiest.buffer;
    const id = `local-${Date.now()}`;

    const newReceipt = {
      id,
      receiptId: s.receipts.length + 1,
      time:      new Date().toLocaleTimeString("en-US", { hour12: false }),
      action,
      title:     action === "add-collateral" ? `${s.policy.maxEmergencySpend} USDC collateral top-up` : action === "block" ? `Blocked ${riskiest.leverage.toFixed(1)}x on ${riskiest.symbol}` : `Hold — ${riskiest.symbol}`,
      venue:     riskiest.venue,
      pair:      riskiest.symbol,
      amount:    action === "add-collateral" ? s.policy.maxEmergencySpend : undefined,
      bufferBefore,
      bufferAfter,
      status:    action === "block" ? "blocked" : "simulated",
      primitive: action === "add-collateral" ? "Gateway + CCTP" : action === "block" ? "Policy Contract" : "Risk Oracle",
      reason:    action === "add-collateral" ? "Buffer fell below policy floor. Collateral routed via Arc Gateway." : action === "block" ? "Leverage exceeds policy cap. Action denied." : "Position within policy envelope.",
      txId:      `ARC-${Math.random().toString(16).slice(2, 10)}`,
    };

    return {
      receipts:              [newReceipt, ...s.receipts],
      newestReceiptId:       id,
      sessionReceiptsCount:  s.sessionReceiptsCount + 1,
      liquidationsPrevented: action === "add-collateral" ? s.liquidationsPrevented + 1 : s.liquidationsPrevented,
      actionsBlocked:        action === "block" ? s.actionsBlocked + 1 : s.actionsBlocked,
      usdcRouted:            action === "add-collateral" ? s.usdcRouted + s.policy.maxEmergencySpend : s.usdcRouted,
      positions: s.positions.map((p) => p.id === riskiest.id ? { ...p, buffer: bufferAfter } : p),
    };
  }),

  resetLocal: () => set((s) => ({
    shockActive:           false,
    receipts:              [],
    liquidationsPrevented: 0,
    actionsBlocked:        0,
    usdcRouted:            0,
    sessionReceiptsCount:  0,
    newestReceiptId:       null,
    positions: s.positions.map((p) => ({
      ...p,
      buffer:     p.bufferTarget + 2 + Math.random() * 5,
      volatility: 0.3  + Math.random() * 0.3,
      leverage:   Math.max(p.leverage * 0.8, 3),
    })),
  })),
}));
```

---

## Keyboard Shortcut

In `App.tsx`, add a global keydown listener:

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "r" || e.key === "R") {
      // Call API reset if backend connected, otherwise local reset
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

---

## Backend-Connected vs Demo Mode

The frontend should work in two modes transparently:

| Condition | Mode | What happens |
|---|---|---|
| Backend running | Connected | All state from API, receipts have real tx hashes, explorer links are real |
| Backend offline | Demo | Local Zustand simulation, receipts show `simulated` status, no explorer links |

Show a small "Arc Testnet · Live" or "Demo Mode" badge in the nav to indicate which mode is active.

---

## Receipt Explorer Link

When a receipt has a real `txHash`, render it as a link:

```tsx
{r.txHash && (
  <a
    href={`https://testnet.arcscan.app/tx/${r.txHash}`}
    target="_blank"
    rel="noopener noreferrer"
    className="text-gold text-xs underline"
  >
    View on Arc Explorer →
  </a>
)}
```

---

## Page Sections

See ARCMARGIN_SPEC.md for the full section-by-section UI spec. The only addition here is:

- Every action button (`Run Agent Cycle`, `Simulate Market Shock`, `Reset`) calls the API first, falls back to local action if API fails
- Receipts with real txHash show explorer links
- Nav badge shows connection status

---

## Adapter Status (static for frontend)

```typescript
export const ADAPTERS = [
  { venue: "Hyperliquid", riskFeed: "live",      executionAdapter: "simulated", settlementMode: "testnet",        lastChecked: "2 min ago" },
  { venue: "dYdX",        riskFeed: "live",      executionAdapter: "simulated", settlementMode: "testnet",        lastChecked: "2 min ago" },
  { venue: "GMX",         riskFeed: "simulated", executionAdapter: "simulated", settlementMode: "mainnet-ready",  lastChecked: "5 min ago" },
  { venue: "Vertex",      riskFeed: "simulated", executionAdapter: "simulated", settlementMode: "mainnet-ready",  lastChecked: "5 min ago" },
];
```

---

## Acceptance Criteria

- [ ] `useAgentAPI` hook polls backend, updates store every 5 seconds
- [ ] All buttons call API first, fallback to local if offline
- [ ] Receipts with txHash render Arc explorer links
- [ ] Nav shows "Arc Testnet · Live" when backend connected
- [ ] Nav shows "Demo Mode" when backend offline
- [ ] All interactions from ARCMARGIN_SPEC.md work in both modes
- [ ] Mobile layout passes the ARCMARGIN_SPEC.md mobile requirements
