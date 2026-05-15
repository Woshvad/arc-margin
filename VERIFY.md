# ArcMargin Verification Report

Verified on May 15, 2026 from `C:\Users\woshv\Desktop\arc agent`.

## Verdict

PASS. ArcMargin has a working real-on-chain-first proof path: the backend agent signs through the Circle developer-controlled wallet path, calls `PolicyContract.evaluateAction()` on Arc testnet, stores the resulting receipt, and the React frontend displays an ArcScan link for that receipt.

Representative final browser proof:

- Tx hash: `0x718f3faa63abc7271484e78d0c8c287bb83856a053e1d72e870e1ec7b5dbbf0c`
- ArcScan: https://testnet.arcscan.app/tx/0x718f3faa63abc7271484e78d0c8c287bb83856a053e1d72e870e1ec7b5dbbf0c
- Contract: `0xbA2EA3F3a28767Ed569bB0F36E3153c60d338334`
- Agent wallet: `0xC16dce447f17d413a2a4F1eA6C99CEA096550656`
- Signing mode: `circle-native`
- On-chain status: `Blocked`
- Telegram: `unconfigured`

## Commands Run

| Check | Status | Evidence |
|---|---|---|
| `cd contracts && npm run compile` | PASS | Hardhat reported `Nothing to compile`. |
| `cd contracts && npm test` | PASS | `7 passing`; policy constructor, owner/agent controls, approvals, blocks, and simulated statuses covered. |
| `cd contracts && npm run verify:deployment` | PASS | Verified Arc deployment, owner, authorized agent, policy values, and remaining daily cap. |
| `cd agent && npm run check` | PASS | TypeScript `tsc --noEmit` passed. |
| `cd agent && npm run build` | PASS | TypeScript build passed. |
| `cd frontend && npm run build` | PASS | `tsc -b && vite build` passed; Vite built 57 modules. |
| `cd agent && npm run smoke` | PASS | Backend health, state, shock, cycle, policy export, reset, and no-secret response checks passed. |

## Contract Deployment Proof

`contracts/deployments/arc-testnet-latest.json` records:

| Field | Value |
|---|---|
| Contract | `PolicyContract` |
| Address | `0xbA2EA3F3a28767Ed569bB0F36E3153c60d338334` |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Deployment tx | `0x02d72dbfe0c513ff41efa992c688d9837df4a06511edf2143cfc8cbe9b48640e` |
| Deployment ArcScan | https://testnet.arcscan.app/tx/0x02d72dbfe0c513ff41efa992c688d9837df4a06511edf2143cfc8cbe9b48640e |
| Owner | `0xDa8c5726f596E8dae99e6dDEBa8AEa1c8bE9A4a5` |
| Authorized agent | `0xC16dce447f17d413a2a4F1eA6C99CEA096550656` |

`npm run verify:deployment` confirmed the deployed contract returns the expected owner, agent, Balanced policy profile, unpaused state, and daily spend cap.

## Circle Wallet and Identity Proof

Backend `/api/state` reported:

| Field | Value |
|---|---|
| Circle wallet integration | `ready` |
| Signing mode | `circle-native` |
| Fallback signing | `false` |
| Agent wallet | `0xC16dce447f17d413a2a4F1eA6C99CEA096550656` |
| ERC-8004 status | `registered` |
| ERC-8004 agent ID | `11576` |
| Identity tx | `0xd16a3889b92b45ad6e422b4a4fe441c9da7dc6df7bf028510d557c84ad22b223` |
| Identity ArcScan | https://testnet.arcscan.app/tx/0xd16a3889b92b45ad6e422b4a4fe441c9da7dc6df7bf028510d557c84ad22b223 |

The backend balance status was `fresh` and displayed `0` USDC while policy transactions still succeeded. This is documented as a balance-display/reporting nuance rather than a policy execution blocker.

## Backend API Proof

Backend health:

```json
{
  "ok": true,
  "service": "arcmargin-agent",
  "chainId": 5042002,
  "contractAddress": "0xbA2EA3F3a28767Ed569bB0F36E3153c60d338334"
}
```

`npm run smoke` returned:

```json
{
  "ok": true,
  "signingMode": "circle-native",
  "circleWalletStatus": "ready",
  "balanceStatus": "fresh",
  "identityStatus": "registered",
  "telegramStatus": "unconfigured",
  "cycleTxHash": "0x67d63a5fc16171131f2d024bc4b14b032e09c219a136545e0ef72c18a24f623b",
  "receiptCountAfterReset": 2
}
```

Live frontend interaction later produced fresher receipts:

| Source | Tx hash | Result |
|---|---|---|
| Desktop `Run Cycle` click | `0x09a58969d9894befc6eafbfe18a52848c176ff58da379b6b0fe605f0881947dc` | Receipt contained ArcScan proof link. |
| Desktop `Start Demo Mode` click | `0x718f3faa63abc7271484e78d0c8c287bb83856a053e1d72e870e1ec7b5dbbf0c` | Final representative proof used in README. |

Latest receipt sample:

```json
{
  "id": "receipt-15-718f3faa",
  "txHash": "0x718f3faa63abc7271484e78d0c8c287bb83856a053e1d72e870e1ec7b5dbbf0c",
  "explorerUrl": "https://testnet.arcscan.app/tx/0x718f3faa63abc7271484e78d0c8c287bb83856a053e1d72e870e1ec7b5dbbf0c",
  "action": "add-collateral",
  "venue": "GMX",
  "pair": "SOL-PERP",
  "status": "blocked",
  "onChainStatus": "Blocked",
  "executionDisclosure": "Policy receipt is real on Arc testnet.",
  "signingMode": "circle-native",
  "blockNumber": 42381734
}
```

## Frontend Browser Proof

Desktop Playwright check at `1440x1000`:

| Interaction | Status | Evidence |
|---|---|---|
| Live shell/status | PASS | Page showed `ARC TESTNET - LIVE`, chain `5042002`, Circle agent wallet, `circle-native`, and `No browser wallet signing`. |
| Simulate shock | PASS | UI action completed before cycle. |
| Run cycle | PASS | Produced tx `0x09a58969d9894befc6eafbfe18a52848c176ff58da379b6b0fe605f0881947dc`. |
| Receipt detail drawer | PASS | Drawer exposed ArcScan links whose `href` contained the tx hash. |
| Adapter health drawer | PASS | Drawer text included simulated venue execution disclosure. |
| Export JSON | PASS | UI produced policy copied/downloaded feedback. |
| Start Demo Mode | PASS | Button re-enabled after completion and backend produced tx `0x718f3faa63abc7271484e78d0c8c287bb83856a053e1d72e870e1ec7b5dbbf0c`. |
| Reset button | PASS | Reset path completed with visible UI feedback. |
| Keyboard `R` | PASS | Keyboard reset path completed with visible UI feedback. |
| Console errors | PASS | No browser console errors or page errors were captured. |

Mobile Playwright check at `390x844`:

| Check | Status | Evidence |
|---|---|---|
| No horizontal page overflow | PASS | `documentElement.scrollWidth` and `clientWidth` were both `390`. |
| Receipt drawer | PASS | `role="dialog"` drawer opened at `390x844`. |
| Drawer scrollability | PASS | Drawer had `overflow-y: auto`. |
| ArcScan link | PASS | Mobile drawer included links to the final tx on ArcScan. |
| Console errors | PASS | No browser console errors or page errors were captured. |

## Fallback and Demo Disclosure

The frontend keeps a local fallback path for demos when the backend is unavailable. That fallback is labeled as demo/simulated state and does not present seeded or local-only receipts as Arc proof. The real proof path requires a receipt with both a transaction hash and an ArcScan URL.

## Real vs Simulated Truth Table

| Area | Status | Notes |
|---|---|---|
| Arc testnet contract | Real | Deployed and verified by Hardhat script. |
| Circle-native signing | Real | Backend reports `circle-native`; EOA fallback inactive. |
| Policy receipts | Real when tx hash exists | Latest proof tx is visible on ArcScan. |
| ERC-8004 identity | Real | Agent ID `11576` registered. |
| REST API | Real local backend | Fastify API powers frontend interactions. |
| Frontend dashboard | Real UI over backend state | Polls backend and has labeled local fallback. |
| Venue position data | Simulated | Representative risk state, not live user portfolio data. |
| Hyperliquid/dYdX/GMX/Vertex execution | Simulated | Adapter drawer labels venue execution as simulated. |
| CCTP/Gateway collateral movement | Simulated/architecture-ready | Current demo does not move funds cross-chain. |
| Paymaster | Architecture-ready/gated | Not claimed as live production paymaster execution. |
| Telegram | Optional/unconfigured | Status reported as `unconfigured`. |

## Secret and Overclaim Scan

Scans run against `README.md`, `VERIFY.md`, and package env examples:

- Secret-like assignments for Circle API key, entity secret, private keys, and Telegram token: no filled secrets.
- Stale placeholders and URLs: root README no longer contains `<set after deployment>` or `Woshvad/arcmargin`.
- Overclaim terms: any "live production" occurrences are explicit negative disclosures, not claims of production execution.

## Known Limitations

- The market positions are representative simulated positions.
- Venue execution adapters are simulated, even when the policy receipt is real.
- CCTP/Gateway movement is modeled for the product story but not live-bridged in this version.
- Paymaster behavior is not a live production paymaster integration.
- Telegram notifications are optional and currently unconfigured.
- The backend reports a fresh `0` USDC balance while transactions still succeed; reviewers should rely on ArcScan tx proof for policy execution.

## Reproduction Steps

1. Install dependencies in `contracts/`, `agent/`, and `frontend/`.
2. Configure `agent/.env` with Circle API key, Entity Secret, wallet ID/address, and deployed policy contract address.
3. Run `cd contracts && npm run verify:deployment`.
4. Run `cd agent && npm run dev`.
5. Run `cd frontend && npm run dev`.
6. Open the Vite URL and follow the 90-second proof path in `README.md`.
7. Confirm the newest receipt drawer contains a transaction hash and ArcScan link.
