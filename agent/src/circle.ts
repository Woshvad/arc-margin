import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { appConfig } from "./config.js";
import { AgentError } from "./errors.js";
import type { Hex } from "./types.js";

let client: CircleDeveloperControlledWalletsClient | null = null;

export function getCircleClient(): CircleDeveloperControlledWalletsClient {
  if (client) return client;
  if (!appConfig.circle.apiKey || !appConfig.circle.entitySecret) {
    throw new AgentError("circle_unconfigured", "Circle API key or entity secret is not configured.", 503);
  }
  client = initiateDeveloperControlledWalletsClient({
    apiKey: appConfig.circle.apiKey,
    entitySecret: appConfig.circle.entitySecret,
  });
  return client;
}

export async function getAgentUsdcBalance(): Promise<number | null> {
  if (!appConfig.circle.walletId || !appConfig.circle.configured) return null;

  const response = await getCircleClient().getWalletTokenBalance({
    id: appConfig.circle.walletId,
  } as never);

  const data = response.data as unknown as {
    tokenBalances?: Array<{ token?: { symbol?: string }; amount?: string }>;
  };
  const usdc = data.tokenBalances?.find((balance) => balance.token?.symbol === "USDC");
  if (!usdc?.amount) return 0;
  const parsed = Number(usdc.amount);
  if (!Number.isFinite(parsed)) {
    throw new AgentError("circle_balance_parse_failed", "Circle returned a non-numeric USDC balance.", 502);
  }
  return parsed;
}

export interface CircleExecutionResult {
  circleTransactionId: string;
  txHash: Hex;
  state: string;
}

export async function submitContractExecutionViaCircle(params: {
  callData: Hex;
  contractAddress: string;
  refId: string;
  timeoutMs: number;
}): Promise<CircleExecutionResult> {
  if (!appConfig.circle.walletId || !appConfig.circle.configured) {
    throw new AgentError("circle_unconfigured", "Circle wallet execution is not configured.", 503);
  }

  const created = await getCircleClient().createContractExecutionTransaction({
    walletId: appConfig.circle.walletId,
    contractAddress: params.contractAddress,
    callData: params.callData,
    refId: params.refId,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const createdData = created.data as unknown as { id?: string; transaction?: { id?: string } };
  const transactionId = createdData.id ?? createdData.transaction?.id;
  if (!transactionId) {
    throw new AgentError("circle_submit_failed", "Circle did not return a transaction id.", 502, created.data);
  }

  const started = Date.now();
  let lastState = "INITIATED";
  while (Date.now() - started < params.timeoutMs) {
    const current = await getCircleClient().getTransaction({ id: transactionId });
    const transaction = (current.data as unknown as { transaction?: { state?: string; txHash?: Hex; errorReason?: string; errorDetails?: string } }).transaction;
    lastState = transaction?.state ?? lastState;

    if ((lastState === "COMPLETE" || lastState === "CONFIRMED") && transaction?.txHash) {
      return { circleTransactionId: transactionId, txHash: transaction.txHash, state: lastState };
    }

    if (["FAILED", "DENIED", "CANCELLED"].includes(lastState)) {
      throw new AgentError("circle_transaction_failed", `Circle transaction ended in ${lastState}.`, 502, transaction);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new AgentError("circle_transaction_timeout", "Timed out waiting for Circle contract execution txHash.", 504, {
    transactionId,
    lastState,
  });
}
