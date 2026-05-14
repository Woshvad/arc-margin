# Arc Testnet Deployment Readiness

PolicyContract has not been broadcast by this artifact. This file records readiness and missing external prerequisites.

| Field | Value |
|-------|-------|
| Status | ready_to_deploy |
| Chain ID | 5042002 |
| RPC URL | https://rpc.testnet.arc.network |
| Deployer | 0xDa8c5726f596E8dae99e6dDEBa8AEa1c8bE9A4a5 |
| Agent | 0xC16dce447f17d413a2a4F1eA6C99CEA096550656 |
| Temporary Agent | no |
| Requires setAgent | no |
| Timestamp | 2026-05-14T22:16:53.540Z |

## Validation

| Check | Status | Detail |
|-------|--------|--------|
| Compile | passed | Hardhat compile completed before deploy script execution |
| Tests | passed | npm test exited 0 |
| Env | passed | AGENT_WALLET_ADDRESS configured |

## Missing Prerequisites

- None

## Next Actions

- Fund deployer with Arc testnet USDC gas before broadcast
- Run npm run deploy:arc only after approving the broadcast
