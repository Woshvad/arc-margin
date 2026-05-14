# Arc Testnet Deployment Readiness

PolicyContract has not been broadcast by this artifact. This file records readiness and missing external prerequisites.

| Field | Value |
|-------|-------|
| Status | ready_to_deploy |
| Chain ID | 5042002 |
| RPC URL | https://rpc.testnet.arc.network |
| Deployer | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 |
| Agent | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 |
| Temporary Agent | yes |
| Requires setAgent | yes |
| Timestamp | 2026-05-14T21:10:15.624Z |

## Validation

| Check | Status | Detail |
|-------|--------|--------|
| Compile | passed | Hardhat compile completed before deploy script execution |
| Tests | passed | npm test exited 0 |
| Env | passed | Temporary agent mode explicitly enabled with ALLOW_TEMP_AGENT=true |

## Missing Prerequisites

- Real AGENT_WALLET_ADDRESS is not configured
- DEPLOYER_PRIVATE_KEY with funded Arc testnet USDC gas
- Arc faucet funding must be verified outside this script

## Next Actions

- Call setAgent(realAgent) before backend integration
- Record the final Circle agent wallet address in AGENT_WALLET_ADDRESS
