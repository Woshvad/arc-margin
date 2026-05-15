# ArcMargin Frontend

Vite + React + TypeScript dashboard for the ArcMargin backend agent.

For the full judge handoff, setup, proof path, and limitations, see the root `README.md` and `VERIFY.md`.

## Run

```bash
npm install
npm run dev
```

By default the app calls the backend on the same hostname at port `3001`.
Set `VITE_AGENT_API_URL=http://localhost:3001` if you want to override it.

## Modes

- `Arc Testnet - Live`: backend polling is working and state is live.
- `Reconnecting`: the app keeps the last live backend state while a poll/action is failing.
- `Demo Mode`: local fallback state is shown because no backend state has loaded.

Venue adapter execution is simulated unless the backend explicitly reports otherwise. Arc policy receipts are real only when a receipt includes a tx hash or ArcScan URL.
