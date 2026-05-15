import type {
  AdapterMetadata,
  AppSnapshot,
  ChainState,
  Metrics,
  Policy,
  Position,
  Receipt,
  RiskProfile,
  SigningModeMetadata,
  WalletState,
  IntegrationStatus,
} from "./types.js";
import type { AppConfig } from "./config.js";
import { randomTxId } from "./arc.js";

export function profileSettings(profile: RiskProfile): Pick<
  Policy,
  "maxLeverage" | "minBuffer" | "maxEmergencySpend" | "dailySpendCap"
> {
  if (profile === "Conservative") {
    return { maxLeverage: 5, minBuffer: 15, maxEmergencySpend: 300, dailySpendCap: 800 };
  }
  if (profile === "Advanced") {
    return { maxLeverage: 12, minBuffer: 6, maxEmergencySpend: 1000, dailySpendCap: 3000 };
  }
  return { maxLeverage: 8, minBuffer: 10, maxEmergencySpend: 500, dailySpendCap: 1500 };
}

export function initialPositions(): Position[] {
  return [
    {
      id: "pos-1",
      symbol: "ETH-PERP",
      venue: "dYdX",
      chain: "Ethereum",
      side: "LONG",
      leverage: 7.2,
      notional: 18400,
      margin: 2555,
      buffer: 14.2,
      funding: -0.012,
      pnl: 340,
      bufferTarget: 15,
      volatility: 0.42,
    },
    {
      id: "pos-2",
      symbol: "SOL-PERP",
      venue: "GMX",
      chain: "Arbitrum",
      side: "LONG",
      leverage: 9.1,
      notional: 11200,
      margin: 1230,
      buffer: 8.4,
      funding: 0.008,
      pnl: -120,
      bufferTarget: 12,
      volatility: 0.68,
    },
    {
      id: "pos-3",
      symbol: "BTC-PERP",
      venue: "Hyperliquid",
      chain: "Hyperliquid L1",
      side: "SHORT",
      leverage: 4.5,
      notional: 32000,
      margin: 7111,
      buffer: 22.1,
      funding: 0.003,
      pnl: 880,
      bufferTarget: 18,
      volatility: 0.31,
    },
    {
      id: "pos-4",
      symbol: "ARB-PERP",
      venue: "Vertex",
      chain: "Arbitrum",
      side: "LONG",
      leverage: 6.0,
      notional: 5400,
      margin: 900,
      buffer: 11.7,
      funding: -0.005,
      pnl: 60,
      bufferTarget: 12,
      volatility: 0.55,
    },
  ];
}

export function initialPolicy(contractAddress: Policy["contractAddress"]): Policy {
  return {
    profile: "Balanced",
    ...profileSettings("Balanced"),
    spentToday: 0,
    allowedVenues: ["Hyperliquid", "dYdX", "GMX", "Vertex"],
    allowedChains: ["Ethereum", "Arbitrum", "Hyperliquid L1"],
    autoHedge: false,
    paused: false,
    contractAddress,
  };
}

export function initialMetrics(): Metrics {
  return {
    liquidationsPrevented: 0,
    actionsBlocked: 0,
    usdcRouted: 0,
    sessionReceiptsCount: 0,
  };
}

export function initialAdapters(): AdapterMetadata[] {
  return [
    {
      id: "hyperliquid",
      name: "Hyperliquid",
      status: "simulated",
      disclosure: "Venue execution adapter is simulated; Arc policy receipt is real when txHash is present.",
      lastActionAt: null,
    },
    {
      id: "dydx",
      name: "dYdX",
      status: "simulated",
      disclosure: "Venue execution adapter is simulated; Arc policy receipt is real when txHash is present.",
      lastActionAt: null,
    },
    {
      id: "gmx",
      name: "GMX",
      status: "simulated",
      disclosure: "Venue execution adapter is simulated; Arc policy receipt is real when txHash is present.",
      lastActionAt: null,
    },
    {
      id: "vertex",
      name: "Vertex",
      status: "simulated",
      disclosure: "Venue execution adapter is simulated; Arc policy receipt is real when txHash is present.",
      lastActionAt: null,
    },
  ];
}

export function initialChain(config: AppConfig): ChainState {
  return {
    chainId: config.arc.chainId,
    name: "Arc Testnet",
    rpcUrl: config.arc.rpcUrl,
    explorerUrl: config.arc.explorerUrl,
    gasToken: "USDC",
    nativeDecimals: 18,
    policyAmountDecimals: 6,
  };
}

export function initialWallet(config: AppConfig): WalletState {
  return {
    connected: Boolean(config.circle.walletAddress),
    address: config.circle.walletAddress ?? "",
    walletId: config.circle.walletId,
    usdcBalance: 0,
    balanceUpdatedAt: null,
    balanceStatus: config.circle.configured ? "stale" : "unconfigured",
    balanceError: config.circle.configured ? null : "Circle credentials or wallet ID are not configured.",
    agentErc8004Id: config.runtime.agentErc8004Id,
  };
}

export function initialIntegrations(config: AppConfig): IntegrationStatus {
  const localWallet = config.circle.localWallet?.wallet;
  const matchesPolicyAgent =
    config.circle.walletAddress && config.deployment.agentAddress
      ? config.circle.walletAddress.toLowerCase() === config.deployment.agentAddress.toLowerCase()
      : null;
  return {
    circleWallet: {
      status: config.circle.walletId && config.circle.walletAddress ? matchesPolicyAgent === false ? "mismatch" : "ready" : "unconfigured",
      configured: config.circle.configured,
      walletId: config.circle.walletId,
      address: config.circle.walletAddress,
      walletSetId: config.circle.walletSetId,
      blockchain: localWallet?.blockchain ?? null,
      accountType: localWallet?.accountType ?? null,
      walletState: localWallet?.state ?? null,
      artifactPath: config.circle.walletArtifactPath,
      contractAgentAddress: config.deployment.agentAddress,
      matchesPolicyAgent,
      message:
        matchesPolicyAgent === false
          ? "Configured Circle wallet does not match the deployed policy agent."
          : config.circle.walletId && config.circle.walletAddress
            ? "Circle ARC-TESTNET wallet metadata is available."
            : "Circle wallet metadata is not configured.",
      checkedAt: null,
    },
    balance: {
      status: config.circle.configured ? "stale" : "unconfigured",
      usdcBalance: 0,
      updatedAt: null,
      error: config.circle.configured ? null : "Circle credentials or wallet ID are not configured.",
      ttlMs: config.runtime.circleBalanceTtlMs,
    },
    identity: {
      status: config.runtime.agentErc8004Id && config.runtime.agentErc8004Id !== "pending" ? "configured" : "pending",
      agentId: config.runtime.agentErc8004Id && config.runtime.agentErc8004Id !== "pending" ? config.runtime.agentErc8004Id : null,
      registryAddress: config.identity.identityRegistryAddress,
      agentAddress: config.circle.walletAddress,
      metadataUri: null,
      metadataHash: null,
      txHash: null,
      circleTransactionId: null,
      explorerUrl: null,
      signerMode: config.runtime.agentErc8004Id && config.runtime.agentErc8004Id !== "pending" ? "env-only" : "none",
      blocker: null,
      updatedAt: null,
    },
    telegram: {
      status: config.telegram.configured ? "configured" : "unconfigured",
      configured: config.telegram.configured,
      disclosure: config.telegram.configured
        ? "Telegram receipt notifications are configured."
        : "Telegram receipt notifications are optional and not configured.",
    },
  };
}

export function initialSigning(config: AppConfig): SigningModeMetadata {
  const mode = config.circle.configured
    ? "circle-native"
    : config.fallback.allowed
      ? "eoa-fallback"
      : "unconfigured";

  return {
    mode,
    primary:
      mode === "circle-native"
        ? "Circle developer-controlled wallet"
        : mode === "eoa-fallback"
          ? "EOA fallback"
          : "none",
    fallbackActive: mode === "eoa-fallback",
    contractAddress: config.deployment.contractAddress,
    authorizedAgentAddress: config.deployment.agentAddress,
    circleAgentAddress: config.circle.walletAddress,
    fallbackAgentAddress: null,
    disclosure:
      mode === "circle-native"
        ? "Primary signing path uses a Circle developer-controlled wallet on Arc testnet."
        : mode === "eoa-fallback"
          ? "Fallback EOA signing is enabled and must be disclosed; Circle-native execution is not being claimed."
          : "No signing path is configured; manual cycles will return a structured error.",
    lastTxHash: null,
    lastCircleTransactionId: null,
  };
}

export function createInitialSnapshot(config: AppConfig): AppSnapshot {
  return {
    positions: initialPositions(),
    policy: initialPolicy(config.deployment.contractAddress),
    autopilot: false,
    shockActive: false,
    metrics: initialMetrics(),
    wallet: initialWallet(config),
    chain: initialChain(config),
    runtime: {
      startedAt: new Date().toISOString(),
      lastCycleAt: null,
      lastError: null,
      cycleInProgress: false,
      autopilotWritesEnabled: config.runtime.autopilotWritesEnabled,
      autopilotTickCount: 0,
      lastPolicySyncTxHash: null,
      lastPolicySyncAt: null,
    },
    adapters: initialAdapters(),
    signing: initialSigning(config),
    integrations: initialIntegrations(config),
    newestReceiptId: null,
  };
}

export function seedReceipts(now = Date.now()): Receipt[] {
  return [
    {
      id: "seed-receipt-1",
      receiptId: 0,
      time: new Date(now - 12 * 60_000).toISOString(),
      action: "add-collateral",
      title: "Seeded 320 USDC collateral route",
      venue: "dYdX",
      pair: "ETH-PERP",
      amount: 320,
      bufferBefore: 9.6,
      bufferAfter: 13.4,
      status: "simulated",
      primitive: "Gateway + CCTP",
      reason: "Seed demo receipt. No Arc transaction was broadcast for this row.",
      txId: randomTxId(now - 12 * 60_000),
      seeded: true,
      executionDisclosure: "Seeded demo receipt with no txHash.",
    },
    {
      id: "seed-receipt-2",
      receiptId: 0,
      time: new Date(now - 28 * 60_000).toISOString(),
      action: "block",
      title: "Seeded blocked 12.4x leverage request",
      venue: "GMX",
      pair: "SOL-PERP",
      bufferBefore: 8.2,
      bufferAfter: 8.2,
      status: "blocked",
      primitive: "Policy Contract",
      reason: "Seed demo receipt. Requested leverage exceeded the Balanced policy cap.",
      txId: randomTxId(now - 28 * 60_000),
      seeded: true,
      executionDisclosure: "Seeded demo receipt with no txHash.",
    },
  ];
}
