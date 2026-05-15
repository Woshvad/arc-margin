# ArcMargin

**Autonomous liquidation protection and collateral routing for perp traders.**  
Built on Arc testnet · Powered by Circle · Submitted to the Agora Agents Hackathon

---

## What It Does

Perp traders lose money not only because they are wrong, but because they cannot monitor leverage, funding, collateral, and liquidation risk across venues 24/7.

ArcMargin is an AI risk agent that:

- Watches leveraged positions across Hyperliquid, dYdX, GMX, and Vertex
- Detects liquidation threats before they execute
- Automatically adds collateral, deleverages, hedges, or blocks unsafe trades
- Enforces every action against a user-defined policy contract deployed on Arc testnet
- Records every decision as an auditable receipt on Arc — a permanent, verifiable action trail

The agent can act fast, but only inside your policy. No unlimited wallet access. No unrestricted trading. Every action passes policy first.

---

## Arc Integration Story

ArcMargin uses Arc as the policy, settlement, and audit layer — not as decoration.

| Arc Primitive | How ArcMargin Uses It |
|---|---|
| **PolicyContract** | Deployed on Arc testnet. Every agent action calls `evaluateAction()` — on-chain policy enforcement |
| **Agent Receipts** | Every decision emits a `PolicyActionExecuted` event on Arc — the auditable receipt trail |
| **USDC Gas** | Agent pays gas in USDC on Arc. No ETH required, no gas token juggling during emergencies |
| **Gateway** | Unified USDC balance tracking across chains — collateral pool available wherever needed |
| **CCTP** | Cross-chain collateral routing between Arbitrum and Arc (simulated adapter, mainnet-ready architecture) |
| **Paymaster** | Auto-hedge and edge-case execution with USDC gas abstraction |
| **ERC-8004** | Agent registered with on-chain identity and reputation on Arc testnet |
| **Circle Wallets** | Developer-controlled agent wallet holds and routes testnet USDC |

---

## Architecture

```
Simulated Venue Risk Data
        ↓
   Agent Loop (30s / on-demand)
        ↓
   Decision Engine (deterministic rules)
        ↓
   PolicyContract.evaluateAction()  ←  Arc testnet tx
        ↓                ↓
   Action executed    Action blocked
        ↓                ↓
   PolicyActionExecuted event on Arc testnet
        ↓
   SQLite receipt store
        ↓
   Fastify REST API  →  Frontend (polled every 5s)
```

### Components

- `contracts/` — Solidity PolicyContract deployed on Arc testnet
- `agent/` — TypeScript backend: agent loop, Circle Wallets, contract calls, Fastify API
- `frontend/` — Vite + React dashboard: real-time state from backend, Arc explorer links

---

## Setup

### Prerequisites

- Node.js 20+
- Circle Developer Console account: https://console.circle.com
- Arc testnet USDC from faucet: https://faucet.circle.com
- ARC CLI (optional, recommended): `uv tool install git+https://github.com/the-canteen-dev/ARC-cli`

### 1. Clone and Install

```bash
git clone https://github.com/Woshvad/arcmargin
cd arcmargin

cd contracts && npm install
cd ../agent   && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# contracts/.env
ARC_RPC_URL=https://rpc.testnet.arc.network
DEPLOYER_PRIVATE_KEY=your_deployer_key

# agent/.env — see agent/.env.example
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret
```

### 3. Create Agent Wallets

```bash
cd agent
npx tsx src/setup.ts create-wallets
# Copy AGENT_WALLET_ID and AGENT_WALLET_ADDRESS to agent/.env
```

Fund the agent wallet at: https://faucet.circle.com (select Arc Testnet)

### 4. Deploy Policy Contract

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network arcTestnet
# Copy POLICY_CONTRACT_ADDRESS to agent/.env
```

### 5. Register Agent Identity (ERC-8004)

```bash
cd agent
npx tsx src/setup.ts register-identity
# Copy AGENT_ERC8004_ID to agent/.env
```

### 6. Run

```bash
# Terminal 1 — Agent backend
cd agent && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev

# Open http://localhost:5173
```

---

## Demo Script (For Judges)

Run this sequence to see the full ArcMargin story in 90 seconds:

1. **Open the app** — observe the live risk dashboard. Note the connected Arc testnet status and agent wallet USDC balance.

2. **Click "Simulate Market Shock"** — liquidation buffers drop, danger states appear on position cards. SOL-PERP enters the red zone.

3. **Click "Run Agent Cycle"** — the agent evaluates the riskiest position (SOL-PERP), calls the on-chain policy contract, and adds collateral or blocks the action based on the current policy.

4. **View the new receipt** — click "View Details" on the receipt that just appeared. Note the Arc testnet transaction hash. Click "View on Arc Explorer" to see the real on-chain `PolicyActionExecuted` event.

5. **Change Risk Profile to Conservative** — switch to Conservative policy. Run another cycle. The tighter leverage cap triggers a "Block" action.

6. **Click "Export Policy"** — the current policy JSON appears. This is what would be signed and stored for a production deployment.

7. **Click "Start Demo Mode"** — the full sequence runs automatically for judges who want to see it without clicking.

8. **Press R** — resets all positions and receipts to initial state.

---

## Testnet Limitations

ArcMargin is honest about what is real and what is simulated:

| Component | Status |
|---|---|
| PolicyContract on Arc testnet | **Real** — deployed, callable, emitting events |
| Agent wallet on Arc testnet | **Real** — funded with testnet USDC |
| ERC-8004 agent identity | **Real** — registered on Arc testnet |
| Arc testnet receipts | **Real** — every cycle writes a verifiable on-chain event |
| Hyperliquid risk feed | **Live read** — risk data pulled from public API |
| dYdX risk feed | **Live read** — risk data pulled from public API |
| GMX execution | **Simulated** — adapter architecture is mainnet-ready |
| Vertex execution | **Simulated** — adapter architecture is mainnet-ready |
| CCTP cross-chain moves | **Simulated** — correct routing logic, no live bridge call |
| Market position data | **Simulated** — representative positions, not live wallet |

This architecture is mainnet-ready once venue integrations and real position data are wired in.

---

## Why This Can Win

Prior winning hackathon patterns that ArcMargin combines:

- **AgentFabric** won by giving agents programmable money movement
- **CRE Risk Router** won by routing autonomous actions through risk checks
- **Aegis Protocol V5** stood out as an execution firewall for AI agents
- **OpenAlice** won as a configurable trading agent

ArcMargin combines all of these: trading-agent context, liquidation protection, scoped agent permissions, USDC settlement, risk routing, and auditable receipts — as a native Arc testnet product.

---

## Contract Addresses

| Contract | Address |
|---|---|
| PolicyContract | `<set after deployment>` |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

Arc Testnet Explorer: https://testnet.arcscan.app

---

## Team

Built by Woshvad for the Agora Agents Hackathon (Canteen × Circle × Arc) · May 2026
