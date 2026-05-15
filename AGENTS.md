<!-- GSD:project-start source:PROJECT.md -->
## Project

**ArcMargin**

ArcMargin is a hackathon-ready Arc testnet product for perpetual futures traders who need autonomous liquidation protection. It monitors leveraged positions, evaluates risk, routes permitted actions through an on-chain Arc policy contract, and shows judges a live dashboard where backend state, policy decisions, and Arc testnet receipts are visible and testable.

This is not a UI-only demo. The product must prove that a real agent can make a policy-gated decision, write the decision to Arc testnet, and surface that verifiable receipt in the frontend.

**Core Value:** ArcMargin must produce a real, verifiable Arc testnet policy receipt for an autonomous margin-protection decision and display that receipt in the user-facing dashboard.

### Constraints

- **Priority**: Real on-chain first - every core phase should bias toward verifiable Arc testnet behavior before UI-only polish.
- **Architecture**: Contracts, agent, and frontend must stay as separate directories with separate package files.
- **Frontend**: Preserve the existing frontend visual identity and product feel; do not replace it with a fresh generic design.
- **Dependencies**: Do not introduce dependencies outside the specs without flagging them first.
- **Truthfulness**: Simulated venue adapters must be labeled honestly in the UI and README.
- **State visibility**: State changes must be visible in the UI, not only in logs or console output.
- **Testability**: Every interaction must be testable by clicking in the UI or calling an API endpoint.
- **README**: Use `ARCMARGIN_README.md` as the final README template, updating only implementation-specific facts where necessary.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22+ preferred, 20+ acceptable if dependencies support it | Runtime for agent and frontend tooling | Circle's current dev-controlled wallet quickstart asks for Node.js 22+, while project specs allow 20+. Use 22+ when possible to reduce SDK friction. |
| Solidity | 0.8.24 | Policy contract | Matches contract spec and modern Hardhat/viem workflows. |
| Hardhat | latest compatible | Contract compile/deploy | The contract spec requires Hardhat + TypeScript + viem; keep this package isolated in `contracts/`. |
| viem | latest compatible | Arc RPC reads/writes and ABI encoding | Good fit for typed EVM chains, event decoding, and contract calls. |
| TypeScript | latest stable | Backend and frontend correctness | Needed across all three packages for API shape and contract interaction safety. |
| Fastify | latest compatible | REST API | Minimal, fast server for the polling dashboard and clickable/API-testable interactions. |
| Vite + React | latest stable | Frontend app | Required by specs and appropriate for preserving the existing static UI in a typed app. |
| Zustand | latest stable | Frontend state | Required by specs; simple enough for connected/demo dual-mode state. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@circle-fin/developer-controlled-wallets` | latest | Circle wallet creation, balance, transfers, contract execution path research | Required for Circle developer-controlled wallet story. |
| `better-sqlite3` | latest compatible | Local receipt persistence | Required for backend persistence across restarts. |
| `@fastify/cors` | latest compatible | Browser API access from Vite dev server | Spec code imports it; dependency must be explicitly added because install list omitted it. |
| `dotenv` | latest | Env loading | Required for all three packages. |
| `tsx` | latest | TypeScript dev runner | Required by backend setup/dev commands. |
| `grammy` | latest | Optional Telegram notifications | Include only in `agent/` per spec. |
| Tailwind CSS + PostCSS + Autoprefixer | latest stable | Frontend styling system | Required by frontend spec, while preserving custom CSS variables. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| ArcScan | Verify deployed contract and transaction receipts | Real demo proof depends on explorer links. |
| Circle Faucet | Fund Arc testnet wallets with USDC | Needed before deploys or transactions. |
| GSD | Phase planning and verification | Use `.planning/` artifacts as local execution control plane. |
## Installation Shape
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hardhat + viem | Foundry | Foundry is excellent, but specs require Hardhat and TypeScript deployment. |
| Fastify | Express | Express is fine, but Fastify is already specified and keeps API code compact. |
| Zustand | Redux Toolkit | Redux is unnecessary for this local dashboard state. |
| Circle-native contract execution | Raw private key viem signing | Raw key may be a temporary fallback for real receipts, but Circle-native signing must be revisited. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| One combined monorepo package | Violates specs and blurs contract/agent/frontend ownership | Three independent package roots. |
| UI-only simulated receipts as the main demo | Fails the "real on-chain first" core value | Backend must write real Arc transactions when configured. |
| Unlabeled simulated adapters | Undermines judge trust | Visible "simulated execution adapter" labels. |
| Mixing Arc native USDC 18-decimal gas values with ERC-20 USDC 6-decimal values | Arc docs call out distinct precision models | Use ERC-20 interface for balances/transfers and explicit conversions. |
## Version Compatibility
| Package / Platform | Compatible With | Notes |
|--------------------|-----------------|-------|
| Arc Testnet | EVM tooling with chain ID `5042002` | RPC `https://rpc.testnet.arc.network`; explorer `https://testnet.arcscan.app`. |
| Circle Wallets | `ARC-TESTNET` | Circle docs list Arc Testnet support for EOA, SCA, and MSCA account types. |
| Circle contract execution | `ARC-TESTNET` | Circle API reference lists `ARC-TESTNET` among allowed blockchains for contract execution. |
| Arc USDC ERC-20 interface | `0x3600000000000000000000000000000000000000` | Uses 6 decimals; native gas balance uses 18 decimals. |
## Sources
- https://docs.arc.network/integrate/connect-to-arc - verified Arc testnet RPC, chain ID, explorer, faucet, and USDC gas.
- https://docs.arc.network/arc/references/contract-addresses - verified Arc USDC, Gateway, CCTP addresses and decimal warning.
- https://developers.circle.com/wallets/supported-blockchains - verified Circle Wallets `ARC-TESTNET` support.
- https://codegen.circle.com/api-reference/wallets/developer-controlled-wallets/create-developer-transaction-contract-execution - verified Circle contract execution endpoint and `ARC-TESTNET` support.
- https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet - verified dev-controlled wallet setup on Arc Testnet and Node.js guidance.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
