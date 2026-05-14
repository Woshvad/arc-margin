# ArcMargin

## What This Is

ArcMargin is a hackathon-ready Arc testnet product for perpetual futures traders who need autonomous liquidation protection. It monitors leveraged positions, evaluates risk, routes permitted actions through an on-chain Arc policy contract, and shows judges a live dashboard where backend state, policy decisions, and Arc testnet receipts are visible and testable.

This is not a UI-only demo. The product must prove that a real agent can make a policy-gated decision, write the decision to Arc testnet, and surface that verifiable receipt in the frontend.

## Core Value

ArcMargin must produce a real, verifiable Arc testnet policy receipt for an autonomous margin-protection decision and display that receipt in the user-facing dashboard.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Solidity `PolicyContract` deploys to Arc testnet and is visible on ArcScan.
- [ ] The backend agent can call `PolicyContract.evaluateAction()` for every decision and receive a real Arc transaction hash.
- [ ] The backend maintains agent state with positions, policy, receipts, metrics, wallet details, and testnet transaction links.
- [ ] Circle developer-controlled wallet integration supports the agent identity, wallet metadata, and USDC balance story.
- [ ] ERC-8004 agent identity is registered or, if blocked, the implementation documents the exact remaining testnet integration gap.
- [ ] Fastify API exposes every interaction needed by the frontend: state, cycle, shock, reset, autopilot, pause, profile, auto-hedge, and policy export.
- [ ] Existing frontend visual identity is preserved while moving to Vite, React, TypeScript, Zustand, and Tailwind/CSS variables.
- [ ] Frontend polls backend state, renders real receipts with Arc explorer links, and clearly falls back to honest demo mode when backend/on-chain data is unavailable.
- [ ] Every interaction listed in `ARCMARGIN_SPEC.md` produces a visible UI change.
- [ ] Simulated venue adapters are labeled honestly and never presented as live execution.
- [ ] README is produced from `ARCMARGIN_README.md` verbatim unless implementation facts require address/status updates.
- [ ] Final app works end to end: contract, agent, API, frontend, receipts, explorer links, demo fallback, reset, policy export, adapter health, and responsive layout.

### Out of Scope

- Mainnet deployment - hackathon target is Arc public testnet.
- Real production perp venue execution - venue execution adapters are simulated unless explicitly implemented later.
- Replacing the existing frontend identity - the existing static ArcMargin frontend is the visual source material and must be preserved/evolved, not discarded.
- Hiding simulated behavior - CCTP, GMX, Vertex, and any other simulated adapters must be labeled honestly.
- Merging contracts, agent, and frontend into one package - they remain separate projects with separate `package.json` files.

## Context

ArcMargin is a submission for the Agora Agents Hackathon from Canteen, Circle, and Arc, targeting RFB 01: Perpetual Futures Trading Agent. The judging story depends on real Arc testnet usage: policy contract deployment, on-chain policy evaluation, Arc receipts, USDC gas, Circle wallet tooling, and ERC-8004 agent identity.

The repo is intended to contain three independent components:

- `contracts/`: Hardhat + TypeScript project containing `PolicyContract.sol` and Arc testnet deployment script.
- `agent/`: TypeScript backend with Fastify API, deterministic agent loop, Circle wallet integration, Arc contract calls through viem, SQLite receipt persistence, and optional Telegram notifications.
- `frontend/`: Vite + React + TypeScript dashboard using Zustand state and Tailwind/CSS variables, preserving the existing static design from `frontend/ArcMargin.html`, `frontend/app.jsx`, and `frontend/styles.css`.

Arc testnet details:

- Chain ID: `5042002`
- RPC HTTP: `https://rpc.testnet.arc.network`
- RPC WSS: `wss://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Faucet: `https://faucet.circle.com`
- Gas token: USDC

Required ERC-8004 registry addresses:

- IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ReputationRegistry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- ValidationRegistry: `0x8004Cb1BF31DAf7788923b405b754f57acEB4272`

The existing specs are authoritative:

- `ARCMARGIN_MASTER.md`: architecture, Arc details, repo shape, data flow
- `ARCMARGIN_CONTRACT.md`: Solidity contract and Hardhat deploy path
- `ARCMARGIN_AGENT.md`: backend agent, Circle, Fastify, SQLite, API
- `ARCMARGIN_FRONTEND.md`: frontend API polling, Zustand store, connected/demo behavior
- `ARCMARGIN_SPEC.md`: full UI and interaction acceptance criteria
- `ARCMARGIN_README.md`: final README template

## Constraints

- **Priority**: Real on-chain first - every core phase should bias toward verifiable Arc testnet behavior before UI-only polish.
- **Architecture**: Contracts, agent, and frontend must stay as separate directories with separate package files.
- **Frontend**: Preserve the existing frontend visual identity and product feel; do not replace it with a fresh generic design.
- **Dependencies**: Do not introduce dependencies outside the specs without flagging them first.
- **Truthfulness**: Simulated venue adapters must be labeled honestly in the UI and README.
- **State visibility**: State changes must be visible in the UI, not only in logs or console output.
- **Testability**: Every interaction must be testable by clicking in the UI or calling an API endpoint.
- **README**: Use `ARCMARGIN_README.md` as the final README template, updating only implementation-specific facts where necessary.

## Known Risks and Ambiguities

- Circle-native signing versus `AGENT_PRIVATE_KEY` for Arc contract writes is unresolved. The project should keep real Arc receipts as the priority while explicitly revisiting Circle-native signing.
- `sendUsdc()` in the backend spec still has a placeholder Arc testnet USDC token address.
- `identity.ts` in the backend spec is placeholder-level and must be completed for real ERC-8004 registration.
- Backend spec imports `@fastify/cors`, but the listed install command does not include it; this dependency must be flagged or added deliberately.
- Backend receipt shape includes `receiptId` and `txHash`, while `ARCMARGIN_SPEC.md` defines a smaller UI receipt type. The implementation should map or extend carefully without losing real explorer links.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Real on-chain first | Hackathon credibility depends on verifiable Arc testnet activity, not just a convincing UI. | Pending |
| Preserve existing frontend | The existing static design is the visual source of truth and should be evolved into the Vite app. | Pending |
| Build everything end to end | The goal is a complete working product: contracts, agent, frontend, API, receipts, explorer links, demo fallback, and responsive UI. | Pending |
| Revisit Circle-native signing | Circle tooling is core to the story, but the fastest reliable real Arc transaction path may be needed first. The gap must stay explicit. | Pending |
| Label simulations honestly | The product should be trusted by judges; simulated venue execution must be clearly disclosed. | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

After each phase transition via GSD:

1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. "What This Is" still accurate? Update if drifted.

After each milestone:

1. Full review of all sections.
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state.

---
*Last updated: 2026-05-14 after initialization*
