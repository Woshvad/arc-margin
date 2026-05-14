# Arc Testnet Deployment Proof

PolicyContract is deployed on Arc testnet.

| Field | Value |
|-------|-------|
| Contract | PolicyContract |
| Address | 0xbA2EA3F3a28767Ed569bB0F36E3153c60d338334 |
| Chain ID | 5042002 |
| Deployer | 0xDa8c5726f596E8dae99e6dDEBa8AEa1c8bE9A4a5 |
| Agent | 0xC16dce447f17d413a2a4F1eA6C99CEA096550656 |
| Temporary Agent | no |
| Requires setAgent | no |
| Transaction | 0x02d72dbfe0c513ff41efa992c688d9837df4a06511edf2143cfc8cbe9b48640e |
| Timestamp | 2026-05-14T22:17:13.316Z |

- ArcScan address: https://testnet.arcscan.app/address/0xbA2EA3F3a28767Ed569bB0F36E3153c60d338334
- ArcScan transaction: https://testnet.arcscan.app/tx/0x02d72dbfe0c513ff41efa992c688d9837df4a06511edf2143cfc8cbe9b48640e

## Next Actions

- Set POLICY_CONTRACT_ADDRESS=0xbA2EA3F3a28767Ed569bB0F36E3153c60d338334 in agent/.env
- Set AGENT_WALLET_ADDRESS=0xC16dce447f17d413a2a4F1eA6C99CEA096550656 in agent/.env
- Run npm run verify:deployment any time you need to re-check deployed contract state
