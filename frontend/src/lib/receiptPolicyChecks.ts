import type { AgentState, Receipt } from "../types/agent";

export type PolicyCheckStatus = "pass" | "fail" | "warn" | "info";

export interface PolicyCheckRow {
  label: string;
  status: PolicyCheckStatus;
  detail: string;
}

function findReceiptPosition(state: AgentState, receipt: Receipt) {
  const pair = receipt.pair.toLowerCase();
  return state.positions.find((position) => pair.includes(position.symbol.toLowerCase()) || position.symbol.toLowerCase().includes(pair));
}

export function receiptPolicyChecks(receipt: Receipt, state: AgentState): PolicyCheckRow[] {
  const policy = state.policy;
  const position = findReceiptPosition(state, receipt);
  const bufferValue = receipt.bufferAfter ?? receipt.bufferBefore;
  const venue = receipt.venue.toLowerCase();
  const allowedVenue = policy.allowedVenues.some((item) => item.toLowerCase() === venue);
  const remaining = Math.max(0, policy.dailySpendCap - policy.spentToday);

  return [
    position
      ? {
          label: "Leverage cap",
          status: position.leverage <= policy.maxLeverage ? "pass" : "fail",
          detail: `${position.leverage.toFixed(1)}x position leverage vs ${policy.maxLeverage}x ${policy.profile} cap.`,
        }
      : {
          label: "Leverage cap",
          status: "info",
          detail: "Receipt does not expose enough position leverage data for a direct check.",
        },
    bufferValue == null
      ? {
          label: "Minimum buffer",
          status: "info",
          detail: `No buffer value on this receipt. Active ${policy.profile} floor is ${policy.minBuffer}%.`,
        }
      : {
          label: "Minimum buffer",
          status: bufferValue >= policy.minBuffer ? "pass" : "fail",
          detail: `${bufferValue.toFixed(1)}% receipt buffer vs ${policy.minBuffer}% policy floor.`,
        },
    {
      label: "Daily cap",
      status: policy.spentToday <= policy.dailySpendCap ? "pass" : "fail",
      detail: `${remaining.toLocaleString("en-US")} USDC remaining of ${policy.dailySpendCap.toLocaleString("en-US")} USDC cap.`,
    },
    venue === "portfolio" || venue === "all positions"
      ? {
          label: "Allowed venue",
          status: "info",
          detail: "Portfolio-wide receipt; no single venue whitelist check applies.",
        }
      : {
          label: "Allowed venue",
          status: allowedVenue ? "pass" : "fail",
          detail: `${receipt.venue} ${allowedVenue ? "is" : "is not"} in the active policy whitelist.`,
        },
    {
      label: "Pause state",
      status: policy.paused ? "warn" : "pass",
      detail: policy.paused ? "Policy is currently paused; actions should be blocked or held." : "Policy is active.",
    },
    {
      label: "Action status",
      status: receipt.policyMismatch ? "fail" : receipt.status === "simulated" ? "warn" : receipt.status === "blocked" ? "info" : "pass",
      detail: receipt.onChainStatus
        ? `Receipt status ${receipt.status}; on-chain event status ${receipt.onChainStatus}.`
        : `Receipt status ${receipt.status}${receipt.txHash ? " with Arc tx proof." : " without Arc tx proof."}`,
    },
  ];
}
