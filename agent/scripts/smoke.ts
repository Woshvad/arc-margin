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
  wallet: {
    usdcBalance: number;
    balanceUpdatedAt: string | null;
    balanceStatus: string;
    balanceError: string | null;
  };
  integrations: {
    circleWallet: { status: string; configured: boolean };
    balance: { status: string; usdcBalance: number; updatedAt: string | null; error: string | null };
    identity: { status: string; registryAddress: string; signerMode: string; txHash: string | null; explorerUrl: string | null };
    telegram: { status: string; configured: boolean };
  };
}

function assertNoSecrets(state: StateResponse): void {
  const serialized = JSON.stringify(state);
  const forbidden = [
    "CIRCLE_API_KEY",
    "CIRCLE_ENTITY_SECRET",
    "entitySecret",
    "apiKey",
    "botToken",
    "chatId",
    "privateKey",
    "POLICY_OWNER_PRIVATE_KEY",
  ];
  const leaked = forbidden.find((token) => serialized.includes(token));
  if (leaked) throw new Error(`State response appears to expose secret field ${leaked}.`);
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
if (!initial.integrations?.circleWallet?.status) throw new Error("Circle wallet integration status missing.");
if (!initial.integrations?.balance?.status) throw new Error("Balance integration status missing.");
if (!initial.integrations?.identity?.status) throw new Error("Identity integration status missing.");
if (!initial.integrations?.telegram?.status) throw new Error("Telegram integration status missing.");
if (!["fresh", "stale", "error", "unconfigured"].includes(initial.wallet.balanceStatus)) {
  throw new Error(`Unexpected wallet balance status ${initial.wallet.balanceStatus}.`);
}
if (initial.integrations.identity.registryAddress && !initial.integrations.identity.registryAddress.startsWith("0x")) {
  throw new Error("Identity registry address is not an EVM address.");
}
assertNoSecrets(initial);

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
assertNoSecrets(finalState);

console.log(
  JSON.stringify(
    {
      ok: true,
      signingMode: initial.signing.mode,
      circleWalletStatus: initial.integrations.circleWallet.status,
      balanceStatus: initial.wallet.balanceStatus,
      identityStatus: initial.integrations.identity.status,
      telegramStatus: initial.integrations.telegram.status,
      cycleTxHash: cycle.receipt.txHash ?? null,
      receiptCountAfterReset: finalState.receipts.length,
    },
    null,
    2,
  ),
);
