import type { ActionStatus, Policy, Position, RiskAction } from "./types.js";

export function findRiskiestPosition(positions: Position[]): Position {
  const position = [...positions].sort((a, b) => a.buffer - b.buffer)[0];
  if (!position) throw new Error("No positions available for agent cycle.");
  return position;
}

function predictedPolicyStatus(action: RiskAction, policy: Policy): ActionStatus {
  if (policy.paused) return "blocked";
  if (action.action === "add-collateral" && policy.spentToday + action.amount > policy.dailySpendCap) return "blocked";
  if (action.action === "add-collateral" && action.amount > policy.maxEmergencySpend) return "blocked";
  if (action.leverage > policy.maxLeverage) return "blocked";
  if (action.action === "deleverage" || action.action === "hedge") return "simulated";
  return "settled";
}

export function evaluatePosition(position: Position, policy: Policy): RiskAction {
  let action: Omit<RiskAction, "predictedStatus">;

  if (policy.paused) {
    action = {
      action: "hold",
      positionId: position.id,
      pair: position.symbol,
      venue: position.venue,
      amount: 0,
      leverage: position.leverage,
      bufferBefore: position.buffer,
      bufferAfter: position.buffer,
      primitive: "Policy Contract",
      reason: "Agent is paused. No actions taken.",
      title: "Agent paused - hold",
    };
  } else if (position.buffer < policy.minBuffer && position.funding <= 0.01 && policy.spentToday < policy.dailySpendCap) {
    const amount = Math.min(policy.maxEmergencySpend, policy.dailySpendCap - policy.spentToday);
    const bufferIncrease = (amount / position.notional) * 100 * position.leverage;
    action = {
      action: "add-collateral",
      positionId: position.id,
      pair: position.symbol,
      venue: position.venue,
      amount,
      leverage: position.leverage,
      bufferBefore: position.buffer,
      bufferAfter: Number((position.buffer + bufferIncrease).toFixed(1)),
      primitive: "Gateway + CCTP",
      reason: "Buffer fell below policy floor. Funding acceptable. Collateral routed through Arc policy.",
      title: `${amount.toFixed(0)} USDC collateral top-up`,
    };
  } else if (position.leverage > policy.maxLeverage && position.volatility > 0.5) {
    action = {
      action: "deleverage",
      positionId: position.id,
      pair: position.symbol,
      venue: position.venue,
      amount: 0,
      leverage: position.leverage,
      bufferBefore: position.buffer,
      bufferAfter: Number((position.buffer + 4.2).toFixed(1)),
      primitive: "Arc Receipt",
      reason: "Leverage exceeded policy cap during high volatility. Position partially closed.",
      title: `Deleverage ${position.symbol} from ${position.leverage.toFixed(1)}x`,
    };
  } else if (position.leverage > policy.maxLeverage) {
    action = {
      action: "block",
      positionId: position.id,
      pair: position.symbol,
      venue: position.venue,
      amount: 0,
      leverage: position.leverage,
      bufferBefore: position.buffer,
      bufferAfter: position.buffer,
      primitive: "Policy Contract",
      reason: `Requested leverage exceeds ${policy.profile} policy cap of ${policy.maxLeverage}x.`,
      title: `Blocked ${position.leverage.toFixed(1)}x leverage on ${position.symbol}`,
    };
  } else if (position.buffer < policy.minBuffer && policy.autoHedge) {
    action = {
      action: "hedge",
      positionId: position.id,
      pair: position.symbol,
      venue: position.venue,
      amount: 0,
      leverage: position.leverage,
      bufferBefore: position.buffer,
      bufferAfter: Number((position.buffer + 2).toFixed(1)),
      primitive: "Paymaster",
      reason: "Buffer thin. Auto-hedge enabled. Protective hedge opened after policy evaluation.",
      title: `Hedge opened for ${position.symbol}`,
    };
  } else {
    action = {
      action: "hold",
      positionId: position.id,
      pair: position.symbol,
      venue: position.venue,
      amount: 0,
      leverage: position.leverage,
      bufferBefore: position.buffer,
      bufferAfter: position.buffer,
      primitive: "Risk Oracle",
      reason: "Position within policy envelope. No action required.",
      title: `Hold - ${position.symbol} within policy`,
    };
  }

  const fullAction = action as RiskAction;
  fullAction.predictedStatus = predictedPolicyStatus(fullAction, policy);
  return fullAction;
}
