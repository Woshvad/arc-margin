import type { AgentState, Policy, Position } from "../types/agent";

export type RiskState = "danger" | "watch" | "healthy";

export interface PortfolioStats {
  notional: number;
  margin: number;
  avgLev: number;
  count: number;
  pnl: number;
  positionsAtRisk: number;
  dailyCapRemaining: number;
}

export function bufferState(buffer: number, target: number): RiskState {
  if (buffer <= target * 0.85) return "danger";
  if (buffer <= target * 1.15) return "watch";
  return "healthy";
}

export function riskLabel(state: RiskState): string {
  if (state === "danger") return "Near Liq";
  if (state === "watch") return "Watch";
  return "Healthy";
}

export function weakestPosition(positions: Position[]): Position {
  return [...positions].sort((a, b) => a.buffer / a.bufferTarget - b.buffer / b.bufferTarget)[0];
}

export function portfolioStats(state: AgentState): PortfolioStats {
  const notional = state.positions.reduce((sum, item) => sum + item.notional, 0);
  const margin = state.positions.reduce((sum, item) => sum + item.margin, 0);
  const weightedLev = state.positions.reduce((sum, item) => sum + item.leverage * item.notional, 0);
  const pnl = state.positions.reduce((sum, item) => sum + item.pnl, 0);
  const positionsAtRisk = state.positions.filter((item) => bufferState(item.buffer, item.bufferTarget) !== "healthy").length;
  return {
    notional,
    margin,
    avgLev: weightedLev / (notional || 1),
    count: state.positions.length,
    pnl,
    positionsAtRisk,
    dailyCapRemaining: Math.max(0, state.policy.dailySpendCap - state.policy.spentToday),
  };
}

export function recommendedAction(position: Position, policy: Policy): string {
  const state = bufferState(position.buffer, position.bufferTarget);
  if (position.leverage > policy.maxLeverage) {
    return `Block or deleverage. ${position.leverage.toFixed(1)}x exceeds ${policy.profile} cap of ${policy.maxLeverage}x.`;
  }
  if (state === "danger") {
    const topUp = Math.min(policy.maxEmergencySpend, Math.max(50, position.notional * ((position.bufferTarget - position.buffer) / 100) * 0.6));
    return `Add about ${Math.round(topUp).toLocaleString("en-US")} USDC or deleverage until buffer clears ${policy.minBuffer}%.`;
  }
  if (state === "watch") {
    return `Hold with auto-hedge primed. Buffer is close to the ${policy.profile} floor.`;
  }
  return "No action. Buffer sits above policy.";
}
