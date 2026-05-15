import { encodeFunctionData, parseEventLogs } from "viem";
import type { Log } from "viem";
import type { ActionType, Hex, OnChainStatus, PolicyActionEvent, RiskAction } from "./types.js";
import { fromPolicyAmount, fromScaledTenths, toPolicyAmount, toScaledTenths } from "./arc.js";

export const policyContractAbi = [
  {
    name: "evaluateAction",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "req",
        type: "tuple",
        components: [
          { name: "action", type: "uint8" },
          { name: "leverage", type: "uint256" },
          { name: "buffer", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "pair", type: "string" },
          { name: "venue", type: "string" },
        ],
      },
      { name: "bufferBefore", type: "uint256" },
      { name: "bufferAfter", type: "uint256" },
    ],
    outputs: [
      { name: "approved", type: "bool" },
      { name: "receiptId", type: "uint256" },
    ],
  },
  {
    name: "setProfile",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_profile", type: "uint8" }],
    outputs: [],
  },
  {
    name: "setPaused",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_paused", type: "bool" }],
    outputs: [],
  },
  {
    name: "setAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_agent", type: "address" }],
    outputs: [],
  },
  {
    name: "setAutoHedge",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_autoHedge", type: "bool" }],
    outputs: [],
  },
  {
    name: "getPolicy",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "profile", type: "uint8" },
          { name: "maxLeverage", type: "uint256" },
          { name: "minBuffer", type: "uint256" },
          { name: "maxEmergencySpend", type: "uint256" },
          { name: "dailySpendCap", type: "uint256" },
          { name: "spentToday", type: "uint256" },
          { name: "lastResetTimestamp", type: "uint256" },
          { name: "autoHedge", type: "bool" },
          { name: "paused", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getDailyCapRemaining",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "agent",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "PolicyActionExecuted",
    type: "event",
    inputs: [
      { name: "receiptId", type: "uint256", indexed: true },
      { name: "action", type: "uint8", indexed: false },
      { name: "status", type: "uint8", indexed: false },
      { name: "pair", type: "string", indexed: false },
      { name: "venue", type: "string", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "bufferBefore", type: "uint256", indexed: false },
      { name: "bufferAfter", type: "uint256", indexed: false },
      { name: "reason", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

const actionToContract: Record<ActionType, number> = {
  hold: 0,
  "add-collateral": 1,
  deleverage: 2,
  hedge: 3,
  block: 4,
};

export function actionFromContract(value: number): ActionType {
  return (["hold", "add-collateral", "deleverage", "hedge", "block"][value] ?? "hold") as ActionType;
}

export function statusFromContract(value: number): OnChainStatus {
  return (["Approved", "Blocked", "Simulated"][value] ?? "Blocked") as OnChainStatus;
}

export function receiptStatusFromOnChain(status: OnChainStatus): "settled" | "blocked" | "simulated" {
  if (status === "Blocked") return "blocked";
  if (status === "Simulated") return "simulated";
  return "settled";
}

export function profileToContract(profile: "Conservative" | "Balanced" | "Advanced"): number {
  if (profile === "Conservative") return 0;
  if (profile === "Advanced") return 2;
  return 1;
}

export function encodeEvaluateAction(action: RiskAction): Hex {
  return encodeFunctionData({
    abi: policyContractAbi,
    functionName: "evaluateAction",
    args: [
      {
        action: actionToContract[action.action],
        leverage: toScaledTenths(action.leverage),
        buffer: toScaledTenths(action.bufferBefore),
        amount: toPolicyAmount(action.amount),
        pair: action.pair,
        venue: action.venue,
      },
      toScaledTenths(action.bufferBefore),
      toScaledTenths(action.bufferAfter),
    ],
  });
}

export function parsePolicyActionEvent(logs: readonly Log[]): PolicyActionEvent {
  const parsed = parseEventLogs({
    abi: policyContractAbi,
    eventName: "PolicyActionExecuted",
    logs: [...logs],
  });

  const event = parsed[0];
  if (!event) {
    throw new Error("PolicyActionExecuted event not found in transaction receipt.");
  }

  const args = event.args as unknown as {
    receiptId: bigint;
    action: number;
    status: number;
    pair: string;
    venue: string;
    amount: bigint;
    bufferBefore: bigint;
    bufferAfter: bigint;
    reason: string;
    timestamp: bigint;
  };
  const onChainStatus = statusFromContract(Number(args.status));

  return {
    receiptId: Number(args.receiptId),
    action: actionFromContract(Number(args.action)),
    onChainStatus,
    status: receiptStatusFromOnChain(onChainStatus),
    pair: args.pair,
    venue: args.venue,
    amount: fromPolicyAmount(args.amount),
    bufferBefore: fromScaledTenths(args.bufferBefore),
    bufferAfter: fromScaledTenths(args.bufferAfter),
    reason: args.reason,
    timestamp: new Date(Number(args.timestamp) * 1000).toISOString(),
  };
}
