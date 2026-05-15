# ArcMargin

Autonomous liquidation protection and collateral routing for perp traders.
Built on Arc testnet, powered by Circle developer-controlled wallets, and submitted to the Agora Agents Hackathon.

ArcMargin is not a browser-wallet demo. The backend agent calls a real Solidity policy contract on Arc testnet, receives a real transaction hash, stores the receipt, and the frontend shows that proof to the reviewer.

## Quick Proof

| Proof item | Value |
|---|---|
| Arc chain | Arc testnet, chain ID `5042002` |
| PolicyContract | `0xbA2EA3F3a28767Ed569bB0F36E3153c60d338334` |
| Authorized Circle agent wallet | `0xC16dce447f17d413a2a4F1eA6C99CEA096550656` |
| ERC-8004 agent ID | `11576` |
| Representative policy tx | `0x718f3faa63abc7271484e78d0c8c287bb83856a053e1d72e870e1ec7b5dbbf0c` |
| ArcScan proof | https://testnet.arcscan.app/tx/0x718f3faa63abc7271484e78d0c8c287bb83856a053e1d72e870e1ec7b5dbbf0c |
| Full audit report | [VERIFY.md](VERIFY.md) |

## What It Does

Perp traders lose money not only because they are wrong, but because they cannot monitor leverage, funding, collateral, and liquidation risk across venues 24/7.

ArcMargin is an autonomous risk agent that:

- Tracks representative leveraged positions across Hyperliquid, dYdX, GMX, and Vertex.
- Detects liquidation threats before they execute.
- Chooses a protective action such as add collateral, deleverage, hedge, or block.
- Enforces every action against a user-defined `PolicyContract` deployed on Arc testnet.
- Records each policy decision as an auditable Arc testnet receipt.
- Shows that receipt in a React dashboard with an ArcScan link.

The agent can act fast, but only inside policy. No unrestricted browser-wallet signing, no unlimited wallet access, and no hidden venue execution. Every real agent decision goes through Arc policy first.

## Arc Integration Story

ArcMargin uses Arc as the policy and audit layer, not as decoration.

| Arc or Circle primitive | How ArcMargin uses it |
|---|---|
| `PolicyContract` | Real Solidity contract deployed on Arc testnet. The agent calls `evaluateAction()` for policy enforcement. |
| Agent receipts | Real `PolicyActionExecuted` events are emitted on Arc when a policy transaction is submitted. |
| USDC gas | Arc testnet uses USDC as gas, so the agent does not need ETH for policy execution. |
| Circle Wallets | Backend uses Circle developer-controlled wallet signing for the agent wallet. |
| ERC-8004 | Agent identity is registered on Arc testnet with agent ID `11576`. |
| Gateway | Architecture-ready collateral routing primitive; current demo does not move live cross-chain funds. |
| CCTP | Simulated routing adapter in this version; no live bridge transfer is executed. |
| Paymaster | Architecture-ready/gated behavior; not presented as live production paymaster execution. |

## Architecture

```text
Representative venue state
        |
        v
TypeScript agent loop / API action
        |
        v
Deterministic risk decision
        |
        v
PolicyContract.evaluateAction() on Arc testnet
        |
        v
PolicyActionExecuted event + tx hash
        |
        v
SQLite receipt store
        |
        v
Fastify REST API
        |
        v
Vite + React dashboard polling backend state
```

### Components

- `contracts/` - Solidity `PolicyContract`, Hardhat scripts, Arc testnet deployment verification.
- `agent/` - TypeScript backend agent, Circle Wallets signing, Fastify REST API, SQLite state, ERC-8004 setup.
- `frontend/` - Vite + React dashboard that polls the backend and displays live state, receipts, and simulated adapter labels.

Each component has its own `package.json`. They are intentionally separate packages.

## Setup

### Prerequisites

- Node.js 20 or newer.
- Circle Developer Console account: https://console.circle.com
- Circle API key and registered Entity Secret.
- Arc testnet USDC for the Circle agent wallet: https://faucet.circle.com
- Optional ARC CLI: `uv tool install git+https://github.com/the-canteen-dev/ARC-cli`

### 1. Clone and install

```bash
git clone https://github.com/Woshvad/arc-margin
cd arc-margin

cd contracts && npm install
cd ../agent && npm install
cd ../frontend && npm install
```

### 2. Configure package environments

Copy only the package-level examples you need. There is no root env file.

```bash
cd contracts
cp .env.example .env

cd ../agent
cp .env.example .env

cd ../frontend
cp .env.example .env
```

Minimum live setup:

- `contracts/.env`: `DEPLOYER_PRIVATE_KEY` and `AGENT_WALLET_ADDRESS` if redeploying the policy contract.
- `agent/.env`: `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_AGENT_WALLET_ID`, `CIRCLE_AGENT_WALLET_ADDRESS`, and `POLICY_CONTRACT_ADDRESS`.
- `frontend/.env`: optional `VITE_AGENT_API_URL`; the default is `http://localhost:3001`.

Never commit `.env` files or private keys.

### 3. Create or verify the Circle agent wallet

```bash
cd agent
npm run setup:wallet
npm run verify:wallet
```

For the deployed policy contract in this repo, the authorized agent wallet address is:

```text
0xC16dce447f17d413a2a4F1eA6C99CEA096550656
```

Fund that wallet with Arc testnet USDC before running a fresh on-chain cycle.

### 4. Deploy or verify the policy contract

The committed deployment is already on Arc testnet:

```text
PolicyContract: 0xbA2EA3F3a28767Ed569bB0F36E3153c60d338334
Deployment tx: 0x02d72dbfe0c513ff41efa992c688d9837df4a06511edf2143cfc8cbe9b48640e
```

To verify the deployed contract:

```bash
cd contracts
npm run compile
npm run verify:deployment
```

To redeploy:

```bash
cd contracts
npm run deploy:arc
```

### 5. Verify or register ERC-8004 identity

```bash
cd agent
npm run verify:identity
```

If using a new agent wallet:

```bash
cd agent
npm run setup:identity
```

### 6. Run locally

```bash
# Terminal 1 - backend
cd agent
npm run dev

# Terminal 2 - frontend
cd frontend
npm run dev
```

Open the Vite URL printed by the frontend, usually `http://localhost:5173`.

## API

The frontend uses these same endpoints, so every interaction is testable by click or API call.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Backend health and deployed contract address. |
| `GET /api/state` | Current positions, policy, wallet, integration status, and receipts. |
| `POST /api/shock` | Applies a representative market shock. |
| `POST /api/cycle` | Runs one agent decision and policy evaluation. |
| `POST /api/reset` | Resets the scenario. |
| `POST /api/profile` | Changes risk profile. |
| `POST /api/autopilot` | Toggles autopilot state. |
| `POST /api/pause` | Pauses or resumes the agent. |
| `POST /api/autohedge` | Toggles auto-hedge policy state. |
| `GET /api/policy/export` | Exports the current policy JSON. |

## Demo Script

### 90-second proof path for judges

1. Start the backend and confirm `GET http://127.0.0.1:3001/health` returns `ok: true`.
2. Start the frontend and open the Vite URL.
3. Click `Simulate Market Shock`.
4. Click `Run Agent Cycle`.
5. Open the newest receipt details.
6. Click the ArcScan proof link and confirm the transaction exists on Arc testnet.
7. Show the dashboard's Circle agent wallet and ERC-8004 identity proof.
8. Click `Export Policy` and confirm visible copy/download feedback.
9. Click `Reset` or press `R`.

The backup path is `Start Demo Mode`, which runs the same frontend story automatically. If the backend is unavailable, the UI clearly labels demo/fallback receipts as simulated and does not present them as Arc proof.

## Testnet Limitations

ArcMargin is honest about what is real and what is simulated:

| Component | Status |
|---|---|
| PolicyContract on Arc testnet | Real: deployed, callable, and verified by script. |
| Agent wallet signing | Real: Circle developer-controlled wallet path is the primary signing path. |
| ERC-8004 identity | Real: agent ID `11576` registered on Arc testnet. |
| Arc policy receipts | Real only when a receipt contains a transaction hash and ArcScan URL. |
| Frontend dashboard | Real backend polling when connected; local fallback is labeled as demo mode. |
| Market positions | Simulated representative positions, not a live user portfolio. |
| Hyperliquid and dYdX feeds | Not claimed as live in this submission; adapter status is surfaced honestly. |
| GMX and Vertex execution | Simulated adapter execution. |
| CCTP/Gateway collateral movement | Simulated/architecture-ready; no live bridge call in this version. |
| Paymaster behavior | Architecture-ready/gated; not live production paymaster execution. |
| Telegram notifications | Optional and unconfigured unless the local `.env` supplies credentials. |

This version proves the on-chain agent policy spine first. Venue execution and live position ingestion are the next production integrations.

## Why This Can Win

ArcMargin combines the pieces hackathon judges usually have to inspect separately:

- A real deployed Arc testnet contract.
- Circle-native agent signing rather than a browser wallet shortcut.
- A user-facing receipt trail with ArcScan links.
- A policy firewall between autonomous decisions and execution.
- A clear truth table that separates live proof from simulated adapters.
- A dashboard where every state change is visible and click-testable.

It is scoped for a hackathon, but the core claim is real: an autonomous agent can make a margin-protection decision, enforce policy on Arc, and show the receipt in the product UI.

## Contract Addresses

| Contract or registry | Address |
|---|---|
| PolicyContract | `0xbA2EA3F3a28767Ed569bB0F36E3153c60d338334` |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

Arc Testnet Explorer: https://testnet.arcscan.app

## Team

Built by Woshvad for the Agora Agents Hackathon (Canteen x Circle x Arc), May 2026.
