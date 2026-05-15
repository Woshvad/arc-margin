import type { AgentState, ApiErrorPayload, AppSnapshot, Receipt } from "./types.js";
import { appConfig } from "./config.js";
import { createInitialSnapshot, seedReceipts } from "./fixtures.js";
import { getDb } from "./db.js";

const SNAPSHOT_KEY = "snapshot";

interface ReceiptRow {
  json: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function loadSnapshot(): AppSnapshot {
  const row = getDb()
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .get(SNAPSHOT_KEY) as { value: string } | undefined;

  if (!row) {
    const snapshot = createInitialSnapshot(appConfig);
    saveSnapshot(snapshot);
    ensureSeedReceipts();
    return snapshot;
  }

  const parsed = JSON.parse(row.value) as AppSnapshot;
  return {
    ...parsed,
    policy: {
      ...parsed.policy,
      contractAddress: appConfig.deployment.contractAddress,
    },
    chain: {
      ...parsed.chain,
      chainId: appConfig.arc.chainId,
      rpcUrl: appConfig.arc.rpcUrl,
      explorerUrl: appConfig.arc.explorerUrl,
    },
    wallet: {
      ...parsed.wallet,
      walletId: appConfig.circle.walletId,
      address: parsed.wallet.address || appConfig.circle.walletAddress || "",
      connected: Boolean(parsed.wallet.address || appConfig.circle.walletAddress),
      agentErc8004Id: appConfig.runtime.agentErc8004Id,
    },
  };
}

export function saveSnapshot(snapshot: AppSnapshot): void {
  getDb()
    .prepare(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    .run(SNAPSHOT_KEY, JSON.stringify(snapshot), nowIso());
}

export function updateSnapshot(mutator: (snapshot: AppSnapshot) => void): AppSnapshot {
  const snapshot = loadSnapshot();
  mutator(snapshot);
  saveSnapshot(snapshot);
  return snapshot;
}

export function insertReceipt(receipt: Receipt): void {
  getDb()
    .prepare(`
      INSERT OR REPLACE INTO receipts
      (id, receipt_id, tx_hash, status, action, seeded, created_at, json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      receipt.id,
      receipt.receiptId,
      receipt.txHash ?? null,
      receipt.status,
      receipt.action,
      receipt.seeded ? 1 : 0,
      receipt.time,
      JSON.stringify(receipt),
    );
}

export function listReceipts(limit = 50): Receipt[] {
  const rows = getDb()
    .prepare(`
      SELECT json FROM receipts
      ORDER BY
        CASE
          WHEN tx_hash IS NOT NULL THEN 0
          WHEN seeded = 0 THEN 1
          ELSE 2
        END ASC,
        datetime(created_at) DESC
      LIMIT ?
    `)
    .all(limit) as ReceiptRow[];

  return rows.map((row) => JSON.parse(row.json) as Receipt);
}

export function ensureSeedReceipts(): void {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM receipts").get() as { count: number };
  if (row.count > 0) return;
  for (const receipt of seedReceipts()) insertReceipt(receipt);
}

export function clearReceipts(): void {
  getDb().prepare("DELETE FROM receipts").run();
}

export function resetScenario(): AgentState {
  clearReceipts();
  const fresh = createInitialSnapshot(appConfig);
  saveSnapshot(fresh);
  ensureSeedReceipts();
  return getApiState();
}

export function hardReset(): AgentState {
  getDb().prepare("DELETE FROM app_state").run();
  clearReceipts();
  return resetScenario();
}

export function setRuntimeError(error: ApiErrorPayload | null): void {
  updateSnapshot((snapshot) => {
    snapshot.runtime.lastError = error;
  });
}

export function getApiState(): AgentState {
  ensureSeedReceipts();
  const snapshot = loadSnapshot();
  const receipts = listReceipts();

  return {
    ...snapshot,
    receipts,
    liquidationsPrevented: snapshot.metrics.liquidationsPrevented,
    actionsBlocked: snapshot.metrics.actionsBlocked,
    usdcRouted: snapshot.metrics.usdcRouted,
    sessionReceiptsCount: snapshot.metrics.sessionReceiptsCount,
    walletConnected: snapshot.wallet.connected,
    walletAddress: snapshot.wallet.address,
    usdcBalance: snapshot.wallet.usdcBalance,
    agentErc8004Id: snapshot.wallet.agentErc8004Id,
    lastCycleAt: snapshot.runtime.lastCycleAt,
  };
}
