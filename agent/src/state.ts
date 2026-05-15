import type { AgentState, ApiErrorPayload, AppSnapshot, BalanceStatus, IdentityIntegrationStatus, Receipt } from "./types.js";
import { appConfig } from "./config.js";
import { createInitialSnapshot, initialIntegrations, seedReceipts } from "./fixtures.js";
import { getDb } from "./db.js";
import { getAgentUsdcBalance } from "./circle.js";
import { readCircleWalletProof, readIdentityProof, safeErrorMessage } from "./artifacts.js";
import { telegramStatus } from "./telegram.js";

const SNAPSHOT_KEY = "snapshot";

interface ReceiptRow {
  json: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isFresh(updatedAt: string | null, ttlMs: number): boolean {
  if (!updatedAt) return false;
  const age = Date.now() - Date.parse(updatedAt);
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
}

function identityFromProof(): IdentityIntegrationStatus {
  const proof = readIdentityProof();
  if (proof) {
    return {
      status: proof.status,
      agentId: proof.agentId,
      registryAddress: proof.registryAddress,
      agentAddress: proof.agentAddress,
      metadataUri: proof.metadataUri,
      metadataHash: proof.metadataHash,
      txHash: proof.txHash,
      circleTransactionId: proof.circleTransactionId,
      explorerUrl: proof.explorerUrl,
      signerMode: proof.signerMode,
      blocker: proof.blocker,
      updatedAt: proof.updatedAt,
    };
  }

  const envId = appConfig.runtime.agentErc8004Id;
  if (envId && envId !== "pending") {
    return {
      status: "configured",
      agentId: envId,
      registryAddress: appConfig.identity.identityRegistryAddress,
      agentAddress: appConfig.circle.walletAddress,
      metadataUri: null,
      metadataHash: null,
      txHash: null,
      circleTransactionId: null,
      explorerUrl: null,
      signerMode: "env-only",
      blocker: null,
      updatedAt: null,
    };
  }

  return {
    status: appConfig.circle.walletAddress ? "pending" : "unconfigured",
    agentId: null,
    registryAddress: appConfig.identity.identityRegistryAddress,
    agentAddress: appConfig.circle.walletAddress,
    metadataUri: null,
    metadataHash: null,
    txHash: null,
    circleTransactionId: null,
    explorerUrl: null,
    signerMode: "none",
    blocker: appConfig.circle.walletAddress ? null : "Circle agent wallet address is not configured.",
    updatedAt: null,
  };
}

function applyDerivedStatus(snapshot: AppSnapshot): AppSnapshot {
  const baseIntegrations = {
    ...initialIntegrations(appConfig),
    ...snapshot.integrations,
  };
  const identity = identityFromProof();
  const walletProof = readCircleWalletProof();
  const localWallet = appConfig.circle.localWallet?.wallet;
  const matchesPolicyAgent =
    appConfig.circle.walletAddress && appConfig.deployment.agentAddress
      ? appConfig.circle.walletAddress.toLowerCase() === appConfig.deployment.agentAddress.toLowerCase()
      : null;

  const balanceStatus = (snapshot.wallet.balanceStatus ?? baseIntegrations.balance.status) as BalanceStatus;
  return {
    ...snapshot,
    wallet: {
      ...snapshot.wallet,
      walletId: appConfig.circle.walletId,
      address: snapshot.wallet.address || appConfig.circle.walletAddress || "",
      connected: Boolean(snapshot.wallet.address || appConfig.circle.walletAddress),
      usdcBalance: Number.isFinite(snapshot.wallet.usdcBalance) ? snapshot.wallet.usdcBalance : 0,
      balanceUpdatedAt: snapshot.wallet.balanceUpdatedAt ?? null,
      balanceStatus,
      balanceError: snapshot.wallet.balanceError ?? baseIntegrations.balance.error,
      agentErc8004Id: identity.agentId ?? appConfig.runtime.agentErc8004Id,
    },
    policy: {
      ...snapshot.policy,
      contractAddress: appConfig.deployment.contractAddress,
    },
    chain: {
      ...snapshot.chain,
      chainId: appConfig.arc.chainId,
      rpcUrl: appConfig.arc.rpcUrl,
      explorerUrl: appConfig.arc.explorerUrl,
    },
    integrations: {
      ...baseIntegrations,
      circleWallet: {
        ...baseIntegrations.circleWallet,
        status: walletProof?.status ?? (appConfig.circle.walletId && appConfig.circle.walletAddress ? matchesPolicyAgent === false ? "mismatch" : "ready" : "unconfigured"),
        configured: appConfig.circle.configured,
        walletId: appConfig.circle.walletId,
        address: appConfig.circle.walletAddress,
        walletSetId: appConfig.circle.walletSetId,
        blockchain: localWallet?.blockchain ?? walletProof?.blockchain ?? null,
        accountType: localWallet?.accountType ?? walletProof?.accountType ?? null,
        walletState: localWallet?.state ?? walletProof?.walletState ?? null,
        artifactPath: appConfig.circle.walletArtifactPath,
        contractAgentAddress: walletProof?.contractAgentAddress ?? appConfig.deployment.agentAddress,
        matchesPolicyAgent: walletProof?.matchesPolicyAgent ?? matchesPolicyAgent,
        message: walletProof
          ? walletProof.status === "ready"
            ? "Circle wallet validation proof is present."
            : "Circle wallet validation proof reports an issue."
          : appConfig.circle.walletId && appConfig.circle.walletAddress
            ? "Circle ARC-TESTNET wallet metadata is available."
            : "Circle wallet metadata is not configured.",
        checkedAt: walletProof?.timestamp ?? baseIntegrations.circleWallet.checkedAt,
      },
      balance: {
        status: balanceStatus,
        usdcBalance: Number.isFinite(snapshot.wallet.usdcBalance) ? snapshot.wallet.usdcBalance : 0,
        updatedAt: snapshot.wallet.balanceUpdatedAt ?? null,
        error: snapshot.wallet.balanceError ?? null,
        ttlMs: appConfig.runtime.circleBalanceTtlMs,
      },
      identity,
      telegram: telegramStatus(),
    },
  };
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
  return applyDerivedStatus(parsed);
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

export async function refreshCircleBalanceIfNeeded(): Promise<void> {
  const snapshot = loadSnapshot();
  if (!appConfig.circle.configured || !appConfig.circle.walletId) {
    snapshot.wallet.balanceStatus = "unconfigured";
    snapshot.wallet.balanceError = "Circle credentials or wallet ID are not configured.";
    saveSnapshot(snapshot);
    return;
  }

  if (snapshot.wallet.balanceStatus === "fresh" && isFresh(snapshot.wallet.balanceUpdatedAt, appConfig.runtime.circleBalanceTtlMs)) {
    return;
  }

  try {
    const balance = await getAgentUsdcBalance();
    snapshot.wallet.usdcBalance = balance ?? 0;
    snapshot.wallet.balanceUpdatedAt = nowIso();
    snapshot.wallet.balanceStatus = "fresh";
    snapshot.wallet.balanceError = null;
    saveSnapshot(snapshot);
  } catch (error) {
    snapshot.wallet.balanceStatus = snapshot.wallet.balanceUpdatedAt ? "stale" : "error";
    snapshot.wallet.balanceError = safeErrorMessage(error);
    saveSnapshot(snapshot);
  }
}

export async function getFreshApiState(): Promise<AgentState> {
  await refreshCircleBalanceIfNeeded();
  return getApiState();
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
