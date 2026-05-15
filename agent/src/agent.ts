import { executePolicyAction } from "./contract.js";
import { findRiskiestPosition, evaluatePosition } from "./decision.js";
import { cycleInProgressError, toErrorPayload } from "./errors.js";
import { localAutopilotReceipt, receiptFromPolicyEvent } from "./receipts.js";
import {
  getApiState,
  hardReset,
  insertReceipt,
  loadSnapshot,
  resetScenario,
  saveSnapshot,
  setRuntimeError,
  updateSnapshot,
} from "./state.js";
import { profileSettings } from "./fixtures.js";
import type { AgentState, AppSnapshot, Receipt, RiskAction, RiskProfile } from "./types.js";

let cycleInProgress = false;

export function getState(): AgentState {
  return getApiState();
}

function updateAdapter(snapshot: AppSnapshot, venue: string, timestamp: string): void {
  snapshot.adapters = snapshot.adapters.map((adapter) =>
    adapter.name === venue ? { ...adapter, lastActionAt: timestamp } : adapter,
  );
}

function applyReceiptEffects(snapshot: AppSnapshot, receipt: Receipt, action: RiskAction): void {
  const position = snapshot.positions.find((item) => item.id === action.positionId);
  if (!position) return;

  snapshot.metrics.sessionReceiptsCount += 1;
  snapshot.newestReceiptId = receipt.id;
  snapshot.runtime.lastCycleAt = receipt.time;

  if (receipt.status === "blocked") {
    snapshot.metrics.actionsBlocked += 1;
    return;
  }

  if (action.action === "add-collateral" && receipt.status === "settled") {
    position.margin = Number((position.margin + action.amount).toFixed(2));
    position.buffer = receipt.bufferAfter ?? position.buffer;
    snapshot.policy.spentToday = Number((snapshot.policy.spentToday + action.amount).toFixed(2));
    snapshot.metrics.usdcRouted = Number((snapshot.metrics.usdcRouted + action.amount).toFixed(2));
    if ((receipt.bufferAfter ?? 0) > (receipt.bufferBefore ?? 0)) {
      snapshot.metrics.liquidationsPrevented += 1;
    }
    updateAdapter(snapshot, action.venue, receipt.time);
    return;
  }

  if (action.action === "deleverage" && receipt.status === "simulated") {
    position.leverage = Number(Math.max(1, position.leverage - 1.25).toFixed(1));
    position.notional = Number((position.notional * 0.86).toFixed(2));
    position.buffer = receipt.bufferAfter ?? position.buffer;
    updateAdapter(snapshot, action.venue, receipt.time);
    return;
  }

  if (action.action === "hedge" && receipt.status === "simulated") {
    position.buffer = receipt.bufferAfter ?? position.buffer;
    updateAdapter(snapshot, action.venue, receipt.time);
  }
}

function beginCycle(): void {
  if (cycleInProgress) throw cycleInProgressError();
  cycleInProgress = true;
  updateSnapshot((snapshot) => {
    snapshot.runtime.cycleInProgress = true;
    snapshot.runtime.lastError = null;
  });
}

function endCycle(): void {
  cycleInProgress = false;
  updateSnapshot((snapshot) => {
    snapshot.runtime.cycleInProgress = false;
  });
}

export async function runCycle(options: { source?: "manual" | "autopilot"; broadcast?: boolean } = {}) {
  beginCycle();
  try {
    const snapshot = loadSnapshot();
    const riskiest = findRiskiestPosition(snapshot.positions);
    const action = evaluatePosition(riskiest, snapshot.policy);
    const shouldBroadcast = options.broadcast ?? true;

    if (!shouldBroadcast) {
      const receipt = localAutopilotReceipt(action);
      insertReceipt(receipt);
      applyReceiptEffects(snapshot, receipt, action);
      snapshot.runtime.autopilotTickCount += 1;
      saveSnapshot(snapshot);
      return { receipt, state: getApiState(), onChain: false };
    }

    const execution = await executePolicyAction(action);
    const receipt = receiptFromPolicyEvent({
      action,
      event: execution.event,
      txHash: execution.txHash,
      blockHash: execution.blockHash,
      blockNumber: execution.blockNumber,
      signing: execution.signing,
    });

    insertReceipt(receipt);
    applyReceiptEffects(snapshot, receipt, action);
    snapshot.signing = execution.signing;
    snapshot.runtime.lastError = null;
    if (options.source === "autopilot") snapshot.runtime.autopilotTickCount += 1;
    saveSnapshot(snapshot);

    return { receipt, state: getApiState(), onChain: true };
  } catch (error) {
    const payload = toErrorPayload(error);
    setRuntimeError({ code: payload.code, message: payload.message, details: payload.details });
    throw error;
  } finally {
    endCycle();
  }
}

export function applyShock(): AgentState {
  updateSnapshot((snapshot) => {
    snapshot.positions = snapshot.positions.map((position, index) => ({
      ...position,
      buffer: Number(Math.max(2, position.buffer * (0.62 + index * 0.03)).toFixed(1)),
      volatility: Number(Math.min(1, position.volatility + 0.22 + index * 0.03).toFixed(2)),
      leverage: Number((position.leverage + (index % 2 === 0 ? 0.6 : 1.1)).toFixed(1)),
    }));
    snapshot.shockActive = true;
    snapshot.runtime.lastError = null;
  });
  return getApiState();
}

export function resetState(options: { hard?: boolean } = {}): AgentState {
  return options.hard ? hardReset() : resetScenario();
}

export function setAutopilot(on: boolean): AgentState {
  updateSnapshot((snapshot) => {
    snapshot.autopilot = on;
  });
  return getApiState();
}

export function setPaused(paused: boolean): AgentState {
  updateSnapshot((snapshot) => {
    snapshot.policy.paused = paused;
  });
  return getApiState();
}

export function setAutoHedge(on: boolean): AgentState {
  updateSnapshot((snapshot) => {
    snapshot.policy.autoHedge = on;
  });
  return getApiState();
}

export function setProfile(profile: RiskProfile): AgentState {
  updateSnapshot((snapshot) => {
    snapshot.policy = {
      ...snapshot.policy,
      profile,
      ...profileSettings(profile),
    };
  });
  return getApiState();
}
