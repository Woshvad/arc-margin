# ArcMargin — Master Architecture Spec

## What This Is

ArcMargin is a hackathon submission for the Agora Agents Hackathon (Canteen × Circle × Arc).
It targets RFB 01: Perpetual Futures Trading Agent.

It is NOT a UI demo. It is a real agent with:
- A policy contract deployed on Arc testnet
- An ERC-8004 registered agent identity on Arc testnet
- A Circle developer-controlled wallet holding testnet USDC
- A backend agent loop writing real receipts to Arc testnet
- A frontend dashboard over real on-chain state

---

## Judging Criteria (internalize this)

| Weight | Criterion | How ArcMargin wins |
|---|---|---|
| 30% | Agentic sophistication | Real on-chain decisions, policy enforcement, ERC-8004 agent identity |
| 30% | Traction | Real transactions on Arc testnet during event window |
| 20% | Circle tool usage | Wallets, Gateway, CCTP, Paymaster, Contracts, App Kit |
| 20% | Innovation | Liquidation protection + policy-gated agent + auditable receipts combined |

---

## Repository Structure

```
arcmargin/
├── contracts/                  ← Hardhat project
│   ├── contracts/
│   │   └── PolicyContract.sol
│   ├── scripts/
│   │   └── deploy.ts
│   ├── hardhat.config.ts
│   └── package.json
│
├── agent/                      ← TypeScript backend
│   ├── src/
│   │   ├── index.ts            ← Fastify server + agent loop bootstrap
│   │   ├── agent.ts            ← Core agent loop
│   │   ├── decision.ts         ← Deterministic risk decision engine
│   │   ├── arc.ts              ← Arc testnet / viem client
│   │   ├── circle.ts           ← Circle Wallets SDK wrapper
│   │   ├── contract.ts         ← PolicyContract interaction
│   │   ├── identity.ts         ← ERC-8004 agent registration
│   │   ├── db.ts               ← SQLite state
│   │   ├── telegram.ts         ← Grammy notifications
│   │   └── types.ts            ← Shared types
│   ├── .env.example
│   └── package.json
│
├── frontend/                   ← Vite + React + TypeScript
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── store/
│   │   │   └── useStore.ts     ← Zustand store
│   │   ├── components/
│   │   │   ├── Hero.tsx
│   │   │   ├── RiskCommandCenter.tsx
│   │   │   ├── PolicySection.tsx
│   │   │   ├── ArcLayer.tsx
│   │   │   ├── ReceiptTrail.tsx
│   │   │   ├── DemoFlow.tsx
│   │   │   ├── AdapterHealth.tsx
│   │   │   └── ReceiptDrawer.tsx
│   │   ├── hooks/
│   │   │   └── useAgentAPI.ts  ← Polls backend, syncs to store
│   │   └── lib/
│   │       └── agentLogic.ts   ← Demo mode simulation (offline fallback)
│   ├── index.html
│   └── package.json
│
└── README.md
```

---

## Arc Testnet — Confirmed Network Details

```
Chain ID:   5042002
RPC HTTP:   https://rpc.testnet.arc.network
RPC WSS:    wss://rpc.testnet.arc.network
Gas token:  USDC (18 decimals)
Explorer:   https://testnet.arcscan.app
Faucet:     https://faucet.circle.com
```

---

## ERC-8004 Contract Addresses (Arc Testnet — do not change)

```
IdentityRegistry:   0x8004A818BFB912233c491871b3d84c89A494BD9e
ReputationRegistry: 0x8004B663056A597Dffe9eCcC1965A193B7388713
ValidationRegistry: 0x8004Cb1BF31DAf7788923b405b754f57acEB4272
```

---

## Environment Variables

### agent/.env

```env
# Arc
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
ARC_WSS_URL=wss://rpc.testnet.arc.network

# Circle
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret

# Set after first run of identity.ts
AGENT_WALLET_ID=
AGENT_WALLET_ADDRESS=
OWNER_WALLET_ID=
POLICY_CONTRACT_ADDRESS=
AGENT_ERC8004_ID=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Server
PORT=3001
```

### contracts/.env

```env
ARC_RPC_URL=https://rpc.testnet.arc.network
DEPLOYER_PRIVATE_KEY=your_deployer_private_key
```

### frontend/.env

```env
VITE_AGENT_API_URL=http://localhost:3001
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_ARC_EXPLORER=https://testnet.arcscan.app
```

---

## Claude Code Setup (run before building)

```bash
/plugin marketplace add circlefin/skills
/plugin install circle-skills@circle
```

This gives Claude Code accurate Arc/Circle API context. Run this before any build tasks.

---

## ARC CLI Setup

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
```

Provides Canteen-hosted Arc testnet RPC access and pre-bundled docs as agent context.

---

## Data Flow

```
Simulated Venue Data
        ↓
   Agent Loop (30s)
        ↓
   Decision Engine
        ↓
   PolicyContract.evaluateAction()   ← Arc testnet call
        ↓ approved         ↓ blocked
   USDC tx submitted    Receipt emitted
   via Circle Wallets    (blocked status)
        ↓
   Arc testnet receipt  ←  PolicyActionExecuted event
        ↓
   SQLite state updated
        ↓
   Fastify REST API
        ↓
   Frontend polls /api/state every 5s
        ↓
   Zustand store updates
        ↓
   UI reflects real on-chain state
```

---

## Circle Products Used

| Product | How Used | Real or Simulated |
|---|---|---|
| Developer-Controlled Wallets | Agent wallet on Arc testnet | Real |
| PolicyContract (via Contracts) | Policy enforcement on Arc | Real |
| ERC-8004 Identity | Agent registered on chain | Real |
| Gateway / Unified Balance | USDC balance tracking | Real (read) |
| CCTP | Cross-chain collateral routing | Simulated with honest label |
| Paymaster | Gas abstraction in UI copy | Referenced |
| App Kit | Unified Balance read | Real |

---

## Build Sequence

1. `contracts/` — deploy PolicyContract.sol → get POLICY_CONTRACT_ADDRESS
2. `agent/` — run identity.ts → register ERC-8004 agent → get AGENT_ERC8004_ID
3. `agent/` — start backend, confirm agent loop writes receipts to Arc
4. `frontend/` — build UI, confirm it reflects real backend state
5. Verify full demo flow end to end on desktop + mobile

---

## Acceptance: Is It Real?

The build is a real Arc-native agent (not a demo) when:
- [ ] `PolicyContract` is deployed and visible on testnet.arcscan.app
- [ ] Agent wallet holds testnet USDC (funded from faucet.circle.com)
- [ ] `runAgentCycle()` on backend writes a real transaction to Arc
- [ ] The transaction is visible in the Arc explorer
- [ ] Frontend receipts link to real tx IDs on testnet.arcscan.app
- [ ] ERC-8004 agent identity is registered and visible on chain
