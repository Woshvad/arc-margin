import type { AgentState, Receipt, RiskProfile } from "../types/agent";
import { demoState } from "./demoState";
import { weakestPosition } from "./risk";

function clone(state: AgentState): AgentState {
  return structuredClone(state);
}

function syncTopLevel(state: AgentState): AgentState {
  return {
    ...state,
    liquidationsPrevented: state.metrics.liquidationsPrevented,
    actionsBlocked: state.metrics.actionsBlocked,
    usdcRouted: state.metrics.usdcRouted,
    sessionReceiptsCount: state.metrics.sessionReceiptsCount,
    walletConnected: state.wallet.connected,
    walletAddress: state.wallet.address,
    usdcBalance: state.wallet.usdcBalance,
    agentErc8004Id: state.wallet.agentErc8004Id,
    lastCycleAt: state.runtime.lastCycleAt,
  };
}

function demoReceipt(base: Omit<Receipt, "id" | "receiptId" | "time" | "txId">): Receipt {
  const timestamp = Date.now();
  return {
    ...base,
    id: `demo-${timestamp}`,
    receiptId: 0,
    time: new Date(timestamp).toISOString(),
    txId: `DEMO-${timestamp.toString(16).toUpperCase()}`,
    executionDisclosure: base.executionDisclosure ?? "Local fallback receipt. No Arc transaction was broadcast.",
  };
}

export function resetLocal(): AgentState {
  return clone(demoState);
}

export function applyLocalShock(current: AgentState): AgentState {
  const state = clone(current);
  state.positions = state.positions.map((position, index) => ({
    ...position,
    buffer: Number(Math.max(2, position.buffer * (0.62 + index * 0.03)).toFixed(1)),
    volatility: Number(Math.min(1, position.volatility + 0.22 + index * 0.03).toFixed(2)),
    leverage: Number((position.leverage + (index % 2 === 0 ? 0.6 : 1.1)).toFixed(1)),
    pnl: Math.round(position.pnl - position.notional * (0.012 + index * 0.004)),
  }));
  state.shockActive = true;
  state.runtime.lastError = {
    code: "LOCAL_FALLBACK",
    message: "Backend action failed; shock was simulated locally.",
  };
  return syncTopLevel(state);
}

export function runLocalCycle(current: AgentState): AgentState {
  const state = clone(current);
  const target = weakestPosition(state.positions);
  const policy = state.policy;
  const blocked = target.leverage > policy.maxLeverage;
  const gap = target.bufferTarget - target.buffer;

  let receipt: Receipt;
  if (blocked) {
    receipt = demoReceipt({
      action: "block",
      title: `Blocked ${target.leverage.toFixed(1)}x ${target.symbol} leverage breach`,
      venue: target.venue,
      pair: target.symbol,
      bufferBefore: target.buffer,
      bufferAfter: target.buffer,
      status: "blocked",
      primitive: "Policy Contract",
      reason: `Local fallback: ${target.leverage.toFixed(1)}x exceeds ${policy.profile} cap of ${policy.maxLeverage}x.`,
    });
    state.metrics.actionsBlocked += 1;
  } else if (gap > 0) {
    const amount = Math.min(policy.maxEmergencySpend, Math.max(50, Math.round(target.notional * (gap / 100) * 0.6)));
    const nextBuffer = Number(Math.min(40, target.buffer + gap + 1.2).toFixed(1));
    receipt = demoReceipt({
      action: "add-collateral",
      title: `Simulated ${amount} USDC collateral top-up`,
      venue: target.venue,
      pair: target.symbol,
      amount,
      bufferBefore: target.buffer,
      bufferAfter: nextBuffer,
      status: "simulated",
      primitive: "Gateway + CCTP",
      reason: `Local fallback: buffer fell below ${policy.profile} floor. No Arc transaction was broadcast.`,
    });
    state.positions = state.positions.map((position) =>
      position.id === target.id
        ? { ...position, margin: position.margin + amount, buffer: nextBuffer }
        : position,
    );
    state.metrics.usdcRouted += amount;
    state.metrics.liquidationsPrevented += 1;
    state.policy.spentToday += amount;
  } else {
    receipt = demoReceipt({
      action: "hold",
      title: "Simulated cycle complete - no action required",
      venue: "Portfolio",
      pair: "All positions",
      bufferBefore: target.buffer,
      bufferAfter: target.buffer,
      status: "simulated",
      primitive: "Risk Oracle",
      reason: `Local fallback: every position sits above ${policy.profile} policy floor.`,
    });
  }

  state.metrics.sessionReceiptsCount += 1;
  state.receipts = [receipt, ...state.receipts];
  state.newestReceiptId = receipt.id;
  state.runtime.lastCycleAt = receipt.time;
  state.runtime.lastError = {
    code: "LOCAL_FALLBACK",
    message: "Backend action failed; cycle was simulated locally.",
  };
  return syncTopLevel(state);
}

export function setLocalProfile(current: AgentState, profile: RiskProfile): AgentState {
  const state = clone(current);
  const settings = {
    Conservative: { maxLeverage: 5, minBuffer: 15, maxEmergencySpend: 300, dailySpendCap: 800 },
    Balanced: { maxLeverage: 8, minBuffer: 10, maxEmergencySpend: 500, dailySpendCap: 1500 },
    Advanced: { maxLeverage: 12, minBuffer: 6, maxEmergencySpend: 1000, dailySpendCap: 3000 },
  }[profile];
  state.policy = { ...state.policy, profile, ...settings };
  return syncTopLevel(state);
}

export function setLocalPaused(current: AgentState, paused: boolean): AgentState {
  const state = clone(current);
  state.policy.paused = paused;
  return syncTopLevel(state);
}

export function setLocalAutopilot(current: AgentState, on: boolean): AgentState {
  const state = clone(current);
  state.autopilot = on;
  return syncTopLevel(state);
}

export function setLocalAutoHedge(current: AgentState, on: boolean): AgentState {
  const state = clone(current);
  state.policy.autoHedge = on;
  return syncTopLevel(state);
}
