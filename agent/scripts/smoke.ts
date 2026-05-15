const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const requireTx = process.env.SMOKE_ALLOW_NO_TX !== "true";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }
  return json as T;
}

interface StateResponse {
  positions: unknown[];
  receipts: Array<{ txHash?: string; explorerUrl?: string }>;
  policy: { contractAddress: string };
  signing: { mode: string };
}

const health = await request<{ ok: boolean }>("/health");
if (!health.ok) throw new Error("Health check did not return ok=true.");

const initial = await request<StateResponse>("/api/state");
if (!Array.isArray(initial.positions) || initial.positions.length === 0) {
  throw new Error("State response does not include positions.");
}
if (!initial.policy.contractAddress?.startsWith("0x")) {
  throw new Error("State response does not include policy contract address.");
}

await request("/api/shock", { method: "POST", body: "{}" });

const cycle = await request<{ receipt?: { txHash?: string; explorerUrl?: string }; state: StateResponse }>("/api/cycle", {
  method: "POST",
  body: "{}",
});

if (!cycle.receipt) throw new Error("Cycle did not return a receipt.");
if (requireTx && !cycle.receipt.txHash) {
  throw new Error("Cycle receipt did not include a real txHash.");
}
if (cycle.receipt.txHash && !cycle.receipt.explorerUrl?.includes(cycle.receipt.txHash)) {
  throw new Error("Cycle receipt did not include a valid explorerUrl.");
}

const policy = await request<{ policy: unknown }>("/api/policy/export");
if (!policy.policy) throw new Error("Policy export did not return policy.");

await request("/api/reset", { method: "POST", body: "{}" });

const finalState = await request<StateResponse>("/api/state");
if (!Array.isArray(finalState.receipts)) throw new Error("Final state receipts missing.");

console.log(
  JSON.stringify(
    {
      ok: true,
      signingMode: initial.signing.mode,
      cycleTxHash: cycle.receipt.txHash ?? null,
      receiptCountAfterReset: finalState.receipts.length,
    },
    null,
    2,
  ),
);
