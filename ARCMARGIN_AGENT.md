# ArcMargin — Agent Backend Spec

## What This Is

A TypeScript/Node.js backend that:
1. Registers an ERC-8004 agent identity on Arc testnet
2. Holds a Circle developer-controlled wallet with testnet USDC
3. Runs a 30-second agent loop evaluating simulated position risk
4. Calls `PolicyContract.evaluateAction()` on Arc testnet for every decision
5. Listens for `PolicyActionExecuted` events and stores them in SQLite
6. Exposes a Fastify REST API the frontend polls every 5 seconds

---

## Stack

```
Node.js 20+
TypeScript
Fastify           → REST API
viem              → Arc testnet contract interaction
@circle-fin/developer-controlled-wallets → agent wallet
better-sqlite3    → SQLite state
grammy            → Telegram notifications
dotenv
```

---

## Setup

```bash
cd agent
npm init -y
npm pkg set type=module
npm install fastify viem @circle-fin/developer-controlled-wallets better-sqlite3 grammy dotenv
npm install --save-dev typescript tsx @types/node @types/better-sqlite3
```

---

## src/types.ts

```typescript
export type ActionType = "hold" | "add-collateral" | "deleverage" | "hedge" | "block";
export type ActionStatus = "settled" | "blocked" | "simulated";
export type RiskProfile = "Conservative" | "Balanced" | "Advanced";

export interface Position {
  id: string;
  symbol: string;
  venue: "Hyperliquid" | "dYdX" | "GMX" | "Vertex";
  chain: string;
  side: "LONG" | "SHORT";
  leverage: number;
  notional: number;
  margin: number;
  buffer: number;
  funding: number;
  pnl: number;
  bufferTarget: number;
  volatility: number;
}

export interface Policy {
  profile: RiskProfile;
  maxLeverage: number;
  minBuffer: number;
  maxEmergencySpend: number;
  dailySpendCap: number;
  spentToday: number;
  allowedVenues: string[];
  allowedChains: string[];
  autoHedge: boolean;
  paused: boolean;
  contractAddress: string;
}

export interface Receipt {
  id: string;
  receiptId: number;       // on-chain receipt counter
  txHash?: string;         // Arc testnet tx hash
  time: string;
  action: ActionType;
  title: string;
  venue: string;
  pair: string;
  amount?: number;
  bufferBefore?: number;
  bufferAfter?: number;
  status: ActionStatus;
  primitive: string;
  reason: string;
  txId: string;            // ARC-xxxxxxxx display ID
}

export interface AgentState {
  positions: Position[];
  policy: Policy;
  receipts: Receipt[];
  autopilot: boolean;
  shockActive: boolean;
  liquidationsPrevented: number;
  actionsBlocked: number;
  usdcRouted: number;
  sessionReceiptsCount: number;
  walletAddress: string;
  usdcBalance: number;
  agentErc8004Id: string;
  lastCycleAt: string | null;
}
```

---

## src/arc.ts

```typescript
import { createPublicClient, createWalletClient, http, webSocket } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public:  { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
} as const;

export const publicClient = createPublicClient({
  chain: ARC_TESTNET,
  transport: http(process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"),
});

export function explorerTxUrl(hash: string): string {
  return `https://testnet.arcscan.app/tx/${hash}`;
}

export function randomTxId(): string {
  const hex = [...Array(8)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
  return `ARC-${hex}`;
}
```

---

## src/circle.ts

```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey:       process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

/**
 * Create agent wallet set and two wallets on Arc testnet.
 * Run once, then set AGENT_WALLET_ID and OWNER_WALLET_ID in .env.
 */
export async function createAgentWallets() {
  const walletSet = await circleClient.createWalletSet({ name: "ArcMargin Agent" });
  const res = await circleClient.createWallets({
    blockchains: ["ARC-TESTNET"],
    count: 2,
    walletSetId: walletSet.data?.walletSet?.id ?? "",
    accountType: "SCA",
  });

  const wallets = res.data?.wallets ?? [];
  console.log("Agent wallet:  ", wallets[0]?.address);
  console.log("Owner wallet:  ", wallets[1]?.address);
  console.log("Agent wallet ID:", wallets[0]?.id);
  console.log("Owner wallet ID:", wallets[1]?.id);
  console.log("\nSet these in agent/.env and then run the deploy script.");
  return wallets;
}

/**
 * Get USDC balance of the agent wallet on Arc testnet.
 */
export async function getAgentUsdcBalance(walletId: string): Promise<number> {
  const res = await circleClient.getWalletTokenBalance({ walletId });
  const balances = res.data?.tokenBalances ?? [];
  const usdc = balances.find((b) => b.token?.symbol === "USDC");
  return parseFloat(usdc?.amount ?? "0");
}

/**
 * Send USDC from agent wallet (simulated collateral add).
 * On Arc testnet this is a real USDC transfer.
 */
export async function sendUsdc(
  walletId: string,
  destinationAddress: string,
  amountUsdc: number
): Promise<string> {
  const res = await circleClient.createTransaction({
    walletId,
    amounts:             [amountUsdc.toFixed(6)],
    destinationAddress,
    tokenAddress:        "0x...", // USDC on Arc testnet — fetch from contract-addresses doc
    blockchain:          "ARC-TESTNET",
    fee:                 { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  return res.data?.transaction?.id ?? "pending";
}
```

---

## src/identity.ts

```typescript
import { publicClient } from "./arc.js";
import { circleClient } from "./circle.js";
import { createWalletClient, http } from "viem";
import { ARC_TESTNET } from "./arc.js";

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;

const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "getAgent",
    type: "function",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "metadataURI", type: "string" },
      { name: "registeredAt", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

// Agent metadata — upload to IPFS or use inline URI
const AGENT_METADATA = {
  name: "ArcMargin Risk Agent v1.0",
  description: "Autonomous liquidation protection and collateral routing agent for perp traders. Acts only within user-defined policy constraints on Arc testnet.",
  agent_type: "risk-management",
  capabilities: [
    "liquidation_protection",
    "collateral_routing",
    "policy_enforcement",
    "deleverage_execution",
    "hedge_management",
  ],
  version: "1.0.0",
  hackathon: "Agora Agents Hackathon — Canteen × Circle × Arc",
};

/**
 * Register the agent on ERC-8004 IdentityRegistry.
 * Run once. Stores the agent ID in .env.
 * Uses the pre-bundled IPFS URI for hackathon speed — replace with real IPFS upload if time allows.
 */
export async function registerAgentIdentity(agentAddress: string): Promise<bigint> {
  // For hackathon: use the example URI from Arc docs as placeholder
  // Ideally: upload AGENT_METADATA to IPFS via Pinata and use real URI
  const metadataURI = "ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei";

  console.log("Registering agent identity on ERC-8004...");
  console.log("Agent address:", agentAddress);
  console.log("Metadata URI:", metadataURI);

  // This requires the deployer wallet to sign — use viem walletClient with deployer private key
  // or use Circle Wallets to sign the transaction
  // Implementation: call register() on IdentityRegistry
  // Returns agentId (uint256) — store as AGENT_ERC8004_ID in .env

  console.log("Set AGENT_ERC8004_ID in agent/.env after registration.");
  return 0n; // replace with actual returned agentId
}
```

---

## src/contract.ts

```typescript
import { publicClient, ARC_TESTNET } from "./arc.js";
import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Position, Policy, Receipt, ActionType } from "./types.js";

export const POLICY_CONTRACT_ABI = [
  {
    name: "evaluateAction",
    type: "function",
    inputs: [
      {
        name: "req",
        type: "tuple",
        components: [
          { name: "action",   type: "uint8"   },
          { name: "leverage", type: "uint256" },
          { name: "buffer",   type: "uint256" },
          { name: "amount",   type: "uint256" },
          { name: "pair",     type: "string"  },
          { name: "venue",    type: "string"  },
        ],
      },
      { name: "bufferBefore", type: "uint256" },
      { name: "bufferAfter",  type: "uint256" },
    ],
    outputs: [
      { name: "approved",  type: "bool"    },
      { name: "receiptId", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    name: "setProfile",
    type: "function",
    inputs: [{ name: "_profile", type: "uint8" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "setPaused",
    type: "function",
    inputs: [{ name: "_paused", type: "bool" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getDailyCapRemaining",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "getPolicy",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "profile",            type: "uint8"   },
          { name: "maxLeverage",        type: "uint256" },
          { name: "minBuffer",          type: "uint256" },
          { name: "maxEmergencySpend",  type: "uint256" },
          { name: "dailySpendCap",      type: "uint256" },
          { name: "spentToday",         type: "uint256" },
          { name: "lastResetTimestamp", type: "uint256" },
          { name: "autoHedge",          type: "bool"    },
          { name: "paused",             type: "bool"    },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    name: "PolicyActionExecuted",
    type: "event",
    inputs: [
      { name: "receiptId",    type: "uint256", indexed: true },
      { name: "action",       type: "uint8",   indexed: false },
      { name: "status",       type: "uint8",   indexed: false },
      { name: "pair",         type: "string",  indexed: false },
      { name: "venue",        type: "string",  indexed: false },
      { name: "amount",       type: "uint256", indexed: false },
      { name: "bufferBefore", type: "uint256", indexed: false },
      { name: "bufferAfter",  type: "uint256", indexed: false },
      { name: "reason",       type: "string",  indexed: false },
      { name: "timestamp",    type: "uint256", indexed: false },
    ],
  },
] as const;

const ACTION_TYPE_MAP: Record<ActionType, number> = {
  "hold":           0,
  "add-collateral": 1,
  "deleverage":     2,
  "hedge":          3,
  "block":          4,
};

/**
 * Call PolicyContract.evaluateAction() on Arc testnet.
 * Returns the tx hash and whether the action was approved.
 */
export async function callEvaluateAction(params: {
  contractAddress: `0x${string}`;
  agentPrivateKey: `0x${string}`;
  action: ActionType;
  position: Position;
  amount: number;
  bufferBefore: number;
  bufferAfter: number;
}): Promise<{ txHash: string; approved: boolean; receiptId: number }> {
  const account = privateKeyToAccount(params.agentPrivateKey);

  const walletClient = createWalletClient({
    account,
    chain: ARC_TESTNET,
    transport: http(process.env.ARC_RPC_URL),
  });

  const txHash = await walletClient.writeContract({
    address: params.contractAddress,
    abi: POLICY_CONTRACT_ABI,
    functionName: "evaluateAction",
    args: [
      {
        action:   ACTION_TYPE_MAP[params.action],
        leverage: BigInt(Math.round(params.position.leverage * 10)),
        buffer:   BigInt(Math.round(params.bufferBefore * 10)),
        amount:   parseUnits(params.amount.toString(), 6),
        pair:     params.position.symbol,
        venue:    params.position.venue,
      },
      BigInt(Math.round(params.bufferBefore * 10)),
      BigInt(Math.round(params.bufferAfter * 10)),
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Parse logs to get approved and receiptId
  // For hackathon speed: read from transaction receipt logs
  // Full implementation: decode PolicyActionExecuted event from receipt.logs

  return {
    txHash,
    approved: true,   // replace with decoded log value
    receiptId: 0,     // replace with decoded log value
  };
}

/**
 * Read current on-chain policy state.
 */
export async function readOnChainPolicy(contractAddress: `0x${string}`) {
  const result = await publicClient.readContract({
    address: contractAddress,
    abi: POLICY_CONTRACT_ABI,
    functionName: "getPolicy",
  });
  return result;
}

/**
 * Read daily cap remaining.
 */
export async function readDailyCapRemaining(contractAddress: `0x${string}`): Promise<number> {
  const raw = await publicClient.readContract({
    address: contractAddress,
    abi: POLICY_CONTRACT_ABI,
    functionName: "getDailyCapRemaining",
  });
  return Number(raw) / 1_000_000; // convert from 6 decimals to USDC float
}
```

---

## src/decision.ts

```typescript
import type { Position, Policy, ActionType } from "./types.js";

export interface Decision {
  action: ActionType;
  amount: number;
  bufferAfter: number;
  primitive: string;
  reason: string;
  title: string;
}

/**
 * Deterministic risk decision engine.
 * Returns a decision for the riskiest position (lowest buffer).
 */
export function evaluatePosition(position: Position, policy: Policy): Decision {

  if (policy.paused) {
    return {
      action:      "hold",
      amount:      0,
      bufferAfter: position.buffer,
      primitive:   "Policy Contract",
      reason:      "Agent is paused. No actions taken.",
      title:       "Agent paused — hold",
    };
  }

  const spendRemaining = policy.dailySpendCap - policy.spentToday;

  // Collateral add
  if (
    position.buffer < policy.minBuffer &&
    position.funding <= 0.01 &&
    spendRemaining > 0
  ) {
    const amount = Math.min(policy.maxEmergencySpend, spendRemaining);
    const bufferIncrease = (amount / position.notional) * 100 * position.leverage;
    return {
      action:      "add-collateral",
      amount,
      bufferAfter: position.buffer + bufferIncrease,
      primitive:   "Gateway + CCTP",
      reason:      "Buffer fell below policy floor. Funding acceptable. Collateral routed via Arc Gateway.",
      title:       `${amount.toFixed(0)} USDC collateral top-up`,
    };
  }

  // Deleverage
  if (position.leverage > policy.maxLeverage && position.volatility > 0.5) {
    const leverageReduction = 1.5 + Math.random();
    const bufferGain = 3 + Math.random() * 2;
    return {
      action:      "deleverage",
      amount:      0,
      bufferAfter: position.buffer + bufferGain,
      primitive:   "Arc Receipt",
      reason:      "Leverage exceeded policy cap during high volatility. Position partially closed.",
      title:       `Deleverage ${position.symbol} from ${position.leverage.toFixed(1)}x`,
    };
  }

  // Block
  if (position.leverage > policy.maxLeverage) {
    return {
      action:      "block",
      amount:      0,
      bufferAfter: position.buffer,
      primitive:   "Policy Contract",
      reason:      `Requested leverage exceeds ${policy.profile} policy cap of ${policy.maxLeverage}x.`,
      title:       `Blocked ${position.leverage.toFixed(1)}x leverage on ${position.symbol}`,
    };
  }

  // Hedge
  if (position.buffer < policy.minBuffer && policy.autoHedge) {
    return {
      action:      "hedge",
      amount:      0,
      bufferAfter: position.buffer + 2,
      primitive:   "Paymaster",
      reason:      "Buffer thin. Auto-hedge enabled. Protective hedge opened via Paymaster.",
      title:       `Hedge opened for ${position.symbol}`,
    };
  }

  // Hold
  return {
    action:      "hold",
    amount:      0,
    bufferAfter: position.buffer,
    primitive:   "Risk Oracle",
    reason:      "Position within policy envelope. No action required.",
    title:       `Hold — ${position.symbol} within policy`,
  };
}

/**
 * Find the riskiest position (lowest liquidation buffer).
 */
export function findRiskiestPosition(positions: Position[]): Position {
  return [...positions].sort((a, b) => a.buffer - b.buffer)[0];
}
```

---

## src/db.ts

```typescript
import Database from "better-sqlite3";
import type { Receipt, Position, Policy } from "./types.js";

const db = new Database("arcmargin.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS receipts (
    id           TEXT PRIMARY KEY,
    receipt_id   INTEGER,
    tx_hash      TEXT,
    time         TEXT,
    action       TEXT,
    title        TEXT,
    venue        TEXT,
    pair         TEXT,
    amount       REAL,
    buffer_before REAL,
    buffer_after  REAL,
    status       TEXT,
    primitive    TEXT,
    reason       TEXT,
    tx_id        TEXT,
    created_at   INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS session_metrics (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO session_metrics VALUES ('liquidations_prevented', '0');
  INSERT OR IGNORE INTO session_metrics VALUES ('actions_blocked', '0');
  INSERT OR IGNORE INTO session_metrics VALUES ('usdc_routed', '0');
`);

export function insertReceipt(r: Receipt) {
  db.prepare(`
    INSERT OR REPLACE INTO receipts
    (id, receipt_id, tx_hash, time, action, title, venue, pair, amount, buffer_before, buffer_after, status, primitive, reason, tx_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    r.id, r.receiptId, r.txHash ?? null, r.time, r.action, r.title,
    r.venue, r.pair, r.amount ?? null, r.bufferBefore ?? null,
    r.bufferAfter ?? null, r.status, r.primitive, r.reason, r.txId
  );
}

export function getReceipts(limit = 20): Receipt[] {
  return db.prepare(`SELECT * FROM receipts ORDER BY created_at DESC LIMIT ?`).all(limit) as unknown as Receipt[];
}

export function getMetric(key: string): number {
  const row = db.prepare(`SELECT value FROM session_metrics WHERE key = ?`).get(key) as { value: string } | undefined;
  return parseFloat(row?.value ?? "0");
}

export function incrementMetric(key: string, by: number = 1) {
  db.prepare(`UPDATE session_metrics SET value = CAST(CAST(value AS REAL) + ? AS TEXT) WHERE key = ?`).run(by, key);
}

export function resetMetrics() {
  db.prepare(`UPDATE session_metrics SET value = '0'`).run();
  db.prepare(`DELETE FROM receipts`).run();
}
```

---

## src/telegram.ts

```typescript
import { Bot } from "grammy";
import type { Receipt } from "./types.js";

const bot = process.env.TELEGRAM_BOT_TOKEN
  ? new Bot(process.env.TELEGRAM_BOT_TOKEN)
  : null;

export async function notifyReceipt(r: Receipt) {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;

  const emoji = r.status === "settled" ? "✅" : r.status === "blocked" ? "🚫" : "🔄";
  const msg = [
    `${emoji} *ArcMargin Agent Cycle*`,
    `Action: ${r.title}`,
    `Pair: ${r.pair} @ ${r.venue}`,
    `Status: ${r.status.toUpperCase()}`,
    r.txHash ? `[View on Arc Explorer](https://testnet.arcscan.app/tx/${r.txHash})` : `TX: ${r.txId}`,
    `_${r.reason}_`,
  ].join("\n");

  await bot.api.sendMessage(process.env.TELEGRAM_CHAT_ID, msg, {
    parse_mode: "Markdown",
  });
}
```

---

## src/agent.ts

```typescript
import { findRiskiestPosition, evaluatePosition } from "./decision.js";
import { callEvaluateAction } from "./contract.js";
import { getAgentUsdcBalance } from "./circle.js";
import { insertReceipt, incrementMetric, getMetric } from "./db.js";
import { notifyReceipt } from "./telegram.js";
import { randomTxId } from "./arc.js";
import type { AgentState } from "./types.js";

let state: AgentState = {
  positions: [
    { id: "pos-1", symbol: "ETH-PERP",  venue: "dYdX",        chain: "Ethereum",       side: "LONG",  leverage: 7.2, notional: 18400, margin: 2555, buffer: 14.2, funding: -0.012, pnl: 340,  bufferTarget: 15, volatility: 0.42 },
    { id: "pos-2", symbol: "SOL-PERP",  venue: "GMX",         chain: "Arbitrum",       side: "LONG",  leverage: 9.1, notional: 11200, margin: 1230, buffer: 8.4,  funding: 0.008,  pnl: -120, bufferTarget: 12, volatility: 0.68 },
    { id: "pos-3", symbol: "BTC-PERP",  venue: "Hyperliquid", chain: "Hyperliquid L1", side: "SHORT", leverage: 4.5, notional: 32000, margin: 7111, buffer: 22.1, funding: 0.003,  pnl: 880,  bufferTarget: 18, volatility: 0.31 },
    { id: "pos-4", symbol: "ARB-PERP",  venue: "Vertex",      chain: "Arbitrum",       side: "LONG",  leverage: 6.0, notional: 5400,  margin: 900,  buffer: 11.7, funding: -0.005, pnl: 60,   bufferTarget: 12, volatility: 0.55 },
  ],
  policy: {
    profile:           "Balanced",
    maxLeverage:       8,
    minBuffer:         10,
    maxEmergencySpend: 500,
    dailySpendCap:     1500,
    spentToday:        0,
    allowedVenues:     ["Hyperliquid", "dYdX", "GMX", "Vertex"],
    allowedChains:     ["Ethereum", "Arbitrum", "Hyperliquid L1"],
    autoHedge:         false,
    paused:            false,
    contractAddress:   process.env.POLICY_CONTRACT_ADDRESS ?? "0xPending",
  },
  receipts:              [],
  autopilot:             false,
  shockActive:           false,
  liquidationsPrevented: 0,
  actionsBlocked:        0,
  usdcRouted:            0,
  sessionReceiptsCount:  0,
  walletAddress:         process.env.AGENT_WALLET_ADDRESS ?? "0x0000",
  usdcBalance:           0,
  agentErc8004Id:        process.env.AGENT_ERC8004_ID ?? "pending",
  lastCycleAt:           null,
};

export function getState(): AgentState {
  return state;
}

export function applyShock() {
  state.positions = state.positions.map((p) => ({
    ...p,
    buffer:     p.buffer    * (1 - (0.30 + Math.random() * 0.15)),
    volatility: Math.min(p.volatility + 0.2 + Math.random() * 0.2, 1.0),
    leverage:   Math.random() > 0.5 ? p.leverage + 1 + Math.random() : p.leverage,
  }));
  state.shockActive = true;
}

export function resetState() {
  state.shockActive = false;
  state.positions   = state.positions.map((p) => ({
    ...p,
    buffer:     p.bufferTarget + 2 + Math.random() * 5,
    volatility: 0.3 + Math.random() * 0.3,
    leverage:   Math.max(p.leverage * 0.8, 3),
  }));
  state.receipts             = [];
  state.liquidationsPrevented = 0;
  state.actionsBlocked        = 0;
  state.usdcRouted            = 0;
  state.sessionReceiptsCount  = 0;
  state.policy.spentToday     = 0;
}

export function setAutopilot(on: boolean)    { state.autopilot      = on; }
export function setPaused(paused: boolean)   { state.policy.paused  = paused; }
export function setAutoHedge(on: boolean)    { state.policy.autoHedge = on; }

export function setProfile(profile: "Conservative" | "Balanced" | "Advanced") {
  state.policy.profile = profile;
  if (profile === "Conservative") {
    Object.assign(state.policy, { maxLeverage: 5, minBuffer: 15, maxEmergencySpend: 300, dailySpendCap: 800 });
  } else if (profile === "Balanced") {
    Object.assign(state.policy, { maxLeverage: 8, minBuffer: 10, maxEmergencySpend: 500, dailySpendCap: 1500 });
  } else {
    Object.assign(state.policy, { maxLeverage: 12, minBuffer: 6, maxEmergencySpend: 1000, dailySpendCap: 3000 });
  }
}

/**
 * Core agent cycle — runs every 30s in autopilot, or on demand.
 * Calls PolicyContract on Arc testnet for every decision.
 */
export async function runCycle(): Promise<void> {
  const riskiest  = findRiskiestPosition(state.positions);
  const decision  = evaluatePosition(riskiest, state.policy);
  const bufferBefore = riskiest.buffer;
  let txHash: string | undefined;
  let receiptId = 0;

  // Call the real policy contract on Arc testnet
  const contractAddress = state.policy.contractAddress as `0x${string}`;
  const agentKey        = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;

  if (agentKey && contractAddress !== "0xPending") {
    try {
      const result = await callEvaluateAction({
        contractAddress,
        agentPrivateKey: agentKey,
        action:          decision.action,
        position:        riskiest,
        amount:          decision.amount,
        bufferBefore,
        bufferAfter:     decision.bufferAfter,
      });
      txHash    = result.txHash;
      receiptId = result.receiptId;
    } catch (err) {
      console.error("Contract call failed:", err);
      // Continue with simulated receipt if contract call fails
    }
  }

  // Build receipt
  const receipt = {
    id:           `receipt-${Date.now()}`,
    receiptId,
    txHash,
    time:         new Date().toLocaleTimeString("en-US", { hour12: false }),
    action:       decision.action,
    title:        decision.title,
    venue:        riskiest.venue,
    pair:         riskiest.symbol,
    amount:       decision.amount || undefined,
    bufferBefore,
    bufferAfter:  decision.bufferAfter,
    status:       (decision.action === "block" ? "blocked" : txHash ? "settled" : "simulated") as any,
    primitive:    decision.primitive,
    reason:       decision.reason,
    txId:         txHash ? `ARC-${txHash.slice(2, 10)}` : randomTxId(),
  };

  // Update local state
  state.receipts.unshift(receipt);
  if (state.receipts.length > 50) state.receipts.pop();

  // Update position buffer
  const posIdx = state.positions.findIndex((p) => p.id === riskiest.id);
  if (posIdx !== -1) {
    state.positions[posIdx].buffer = decision.bufferAfter;
    if (decision.amount) state.positions[posIdx].margin += decision.amount;
    state.policy.spentToday += decision.amount;
  }

  // Update metrics
  state.sessionReceiptsCount++;
  state.lastCycleAt = new Date().toISOString();
  if (decision.action === "add-collateral" && decision.bufferAfter > bufferBefore) {
    state.liquidationsPrevented++;
    state.usdcRouted += decision.amount;
  }
  if (decision.action === "block") state.actionsBlocked++;

  // Persist
  insertReceipt(receipt);
  if (decision.action === "add-collateral") incrementMetric("liquidations_prevented");
  if (decision.action === "block")          incrementMetric("actions_blocked");
  if (decision.amount > 0)                 incrementMetric("usdc_routed", decision.amount);

  // Notify
  await notifyReceipt(receipt);

  // Refresh USDC balance
  if (process.env.AGENT_WALLET_ID) {
    state.usdcBalance = await getAgentUsdcBalance(process.env.AGENT_WALLET_ID);
  }
}

/**
 * Autopilot loop — runs every 30 seconds when autopilot is on.
 */
export function startAutopilotLoop() {
  setInterval(async () => {
    if (state.autopilot && !state.policy.paused) {
      await runCycle();
    }
  }, 30_000);
}
```

---

## src/index.ts

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { getState, runCycle, applyShock, resetState, setAutopilot, setPaused, setProfile, setAutoHedge, startAutopilotLoop } from "./agent.js";

const server = Fastify({ logger: true });
await server.register(cors, { origin: "*" });

// GET /api/state — frontend polls this every 5 seconds
server.get("/api/state", async () => getState());

// POST /api/cycle — run one agent cycle
server.post("/api/cycle", async () => {
  await runCycle();
  return getState();
});

// POST /api/shock — simulate market shock
server.post("/api/shock", async () => {
  applyShock();
  return getState();
});

// POST /api/reset — reset to initial state
server.post("/api/reset", async () => {
  resetState();
  return getState();
});

// POST /api/autopilot — toggle autopilot
server.post<{ Body: { on: boolean } }>("/api/autopilot", async (req) => {
  setAutopilot(req.body.on);
  return getState();
});

// POST /api/pause — toggle agent pause
server.post<{ Body: { paused: boolean } }>("/api/pause", async (req) => {
  setPaused(req.body.paused);
  return getState();
});

// POST /api/profile — change risk profile
server.post<{ Body: { profile: "Conservative" | "Balanced" | "Advanced" } }>("/api/profile", async (req) => {
  setProfile(req.body.profile);
  return getState();
});

// POST /api/autohedge — toggle auto-hedge
server.post<{ Body: { on: boolean } }>("/api/autohedge", async (req) => {
  setAutoHedge(req.body.on);
  return getState();
});

// GET /api/policy/export — export policy JSON
server.get("/api/policy/export", async () => {
  return getState().policy;
});

// Start
startAutopilotLoop();
await server.listen({ port: parseInt(process.env.PORT ?? "3001"), host: "0.0.0.0" });
console.log("ArcMargin agent running on port", process.env.PORT ?? "3001");
```

---

## One-Time Setup Script

Run this once before starting the agent for the first time:

```bash
# 1. Create wallets
npx tsx src/setup.ts create-wallets
# → set AGENT_WALLET_ID, AGENT_WALLET_ADDRESS, OWNER_WALLET_ID in .env

# 2. Fund agent wallet from faucet
# → go to https://faucet.circle.com, select Arc Testnet, paste AGENT_WALLET_ADDRESS

# 3. Deploy contract (from contracts/ directory)
cd ../contracts && npx hardhat run scripts/deploy.ts --network arcTestnet
# → set POLICY_CONTRACT_ADDRESS in agent/.env

# 4. Register ERC-8004 identity
cd ../agent && npx tsx src/setup.ts register-identity
# → set AGENT_ERC8004_ID in .env

# 5. Start agent
npm run dev
```

---

## package.json scripts

```json
{
  "scripts": {
    "dev":   "tsx --env-file=.env src/index.ts",
    "start": "node --env-file=.env dist/index.js",
    "build": "tsc"
  }
}
```

---

## Acceptance Criteria

- [ ] Agent starts with `npm run dev` without errors
- [ ] `GET /api/state` returns valid JSON with positions, policy, receipts
- [ ] `POST /api/shock` mutates buffer values in state
- [ ] `POST /api/cycle` adds a new receipt and updates position
- [ ] Agent calls `PolicyContract.evaluateAction()` — tx visible on testnet.arcscan.app
- [ ] Telegram notification fires on each cycle (if configured)
- [ ] SQLite persists receipts across agent restarts
- [ ] USDC balance updates from Circle Wallets API
- [ ] `/api/policy/export` returns valid JSON policy
