export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type ActionType = "hold" | "add-collateral" | "deleverage" | "hedge" | "block";
export type ActionStatus = "settled" | "blocked" | "simulated";
export type OnChainStatus = "Approved" | "Blocked" | "Simulated";
export type RiskProfile = "Conservative" | "Balanced" | "Advanced";
export type Venue = "Hyperliquid" | "dYdX" | "GMX" | "Vertex";
export type SigningMode = "circle-native" | "eoa-fallback" | "unconfigured";
export type BalanceStatus = "fresh" | "stale" | "error" | "unconfigured";
export type CircleWalletSetupStatus = "ready" | "unconfigured" | "mismatch" | "error";
export type IdentityStatus = "registered" | "pending" | "blocked" | "unconfigured" | "configured";
export type TelegramStatus = "configured" | "unconfigured";

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
  balanceStatus: BalanceStatus;
  balanceError: string | null;
  agentErc8004Id: string;
}

export interface CircleWalletIntegrationStatus {
  status: CircleWalletSetupStatus;
  configured: boolean;
  walletId: string | null;
  address: Address | null;
  walletSetId: string | null;
  blockchain: string | null;
  accountType: string | null;
  walletState: string | null;
  artifactPath: string | null;
  contractAgentAddress: Address | null;
  matchesPolicyAgent: boolean | null;
  message: string;
  checkedAt: string | null;
}

export interface BalanceIntegrationStatus {
  status: BalanceStatus;
  usdcBalance: number;
  updatedAt: string | null;
  error: string | null;
  ttlMs: number;
}

export interface IdentityIntegrationStatus {
  status: IdentityStatus;
  agentId: string | null;
  registryAddress: Address;
  agentAddress: Address | null;
  metadataUri: string | null;
  metadataHash: Hex | null;
  txHash: Hex | null;
  circleTransactionId: string | null;
  explorerUrl: string | null;
  signerMode: "circle-native" | "owner-fallback" | "env-only" | "none";
  blocker: string | null;
  updatedAt: string | null;
}

export interface TelegramIntegrationStatus {
  status: TelegramStatus;
  configured: boolean;
  disclosure: string;
}

export interface IntegrationStatus {
  circleWallet: CircleWalletIntegrationStatus;
  balance: BalanceIntegrationStatus;
  identity: IdentityIntegrationStatus;
  telegram: TelegramIntegrationStatus;
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

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
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
  integrations: IntegrationStatus;
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

export interface ActionResponse {
  ok: boolean;
  state: AgentState;
  receipt?: Receipt;
  onChain?: boolean;
}

export interface PolicyExport {
  exportedAt: string;
  policy: Policy;
  chain: ChainState;
  signing: SigningModeMetadata;
  adapters: AdapterMetadata[];
}
