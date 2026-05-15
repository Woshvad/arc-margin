export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type ActionType =
  | "hold"
  | "add-collateral"
  | "deleverage"
  | "hedge"
  | "block";

export type ActionStatus = "settled" | "blocked" | "simulated";
export type OnChainStatus = "Approved" | "Blocked" | "Simulated";
export type RiskProfile = "Conservative" | "Balanced" | "Advanced";
export type Venue = "Hyperliquid" | "dYdX" | "GMX" | "Vertex";
export type SigningMode = "circle-native" | "eoa-fallback" | "unconfigured";

export interface Position {
  id: string;
  symbol: string;
  venue: Venue;
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
  contractAddress: Address;
}

export interface Metrics {
  liquidationsPrevented: number;
  actionsBlocked: number;
  usdcRouted: number;
  sessionReceiptsCount: number;
}

export interface WalletState {
  connected: boolean;
  address: Address | "";
  walletId: string | null;
  usdcBalance: number;
  balanceUpdatedAt: string | null;
  agentErc8004Id: string;
}

export interface ChainState {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  gasToken: "USDC";
  nativeDecimals: 18;
  policyAmountDecimals: 6;
}

export interface RuntimeState {
  startedAt: string;
  lastCycleAt: string | null;
  lastError: ApiErrorPayload | null;
  cycleInProgress: boolean;
  autopilotWritesEnabled: boolean;
  autopilotTickCount: number;
  lastPolicySyncTxHash: Hex | null;
  lastPolicySyncAt: string | null;
}

export interface AdapterMetadata {
  id: string;
  name: string;
  status: "simulated" | "live" | "offline";
  disclosure: string;
  lastActionAt: string | null;
}

export interface SigningModeMetadata {
  mode: SigningMode;
  primary: "Circle developer-controlled wallet" | "EOA fallback" | "none";
  fallbackActive: boolean;
  contractAddress: Address;
  authorizedAgentAddress: Address | null;
  circleAgentAddress: Address | null;
  fallbackAgentAddress: Address | null;
  disclosure: string;
  lastTxHash: Hex | null;
  lastCircleTransactionId: string | null;
}

export interface Receipt {
  id: string;
  receiptId: number;
  txHash?: Hex;
  explorerUrl?: string;
  time: string;
  action: ActionType;
  title: string;
  venue: string;
  pair: string;
  amount?: number;
  bufferBefore?: number;
  bufferAfter?: number;
  status: ActionStatus;
  primitive: "Gateway + CCTP" | "Policy Contract" | "Paymaster" | "Arc Receipt" | "Risk Oracle";
  reason: string;
  txId: string;
  seeded?: boolean;
  predictedStatus?: ActionStatus;
  onChainStatus?: OnChainStatus;
  policyMismatch?: boolean;
  executionDisclosure?: string;
  signingMode?: SigningMode;
  blockNumber?: number;
  blockHash?: Hex;
}

export interface AppSnapshot {
  positions: Position[];
  policy: Policy;
  autopilot: boolean;
  shockActive: boolean;
  metrics: Metrics;
  wallet: WalletState;
  chain: ChainState;
  runtime: RuntimeState;
  adapters: AdapterMetadata[];
  signing: SigningModeMetadata;
  newestReceiptId: string | null;
}

export interface AgentState extends AppSnapshot {
  receipts: Receipt[];
  liquidationsPrevented: number;
  actionsBlocked: number;
  usdcRouted: number;
  sessionReceiptsCount: number;
  walletConnected: boolean;
  walletAddress: Address | "";
  usdcBalance: number;
  agentErc8004Id: string;
  lastCycleAt: string | null;
}

export interface RiskAction {
  action: ActionType;
  positionId: string;
  pair: string;
  venue: string;
  amount: number;
  leverage: number;
  bufferBefore: number;
  bufferAfter: number;
  primitive: Receipt["primitive"];
  reason: string;
  title: string;
  predictedStatus: ActionStatus;
}

export interface PolicyActionEvent {
  receiptId: number;
  action: ActionType;
  onChainStatus: OnChainStatus;
  status: ActionStatus;
  pair: string;
  venue: string;
  amount: number;
  bufferBefore: number;
  bufferAfter: number;
  reason: string;
  timestamp: string;
}

export interface PolicyExecutionResult {
  txHash: Hex;
  blockNumber?: number;
  blockHash?: Hex;
  event: PolicyActionEvent;
  signing: SigningModeMetadata;
}

export interface PolicySyncResult {
  txHash: Hex;
  explorerUrl: string;
  functionName: "setProfile" | "setPaused" | "setAutoHedge";
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}
