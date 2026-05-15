import { Bot } from "grammy";
import { appConfig } from "./config.js";
import type { Receipt, TelegramIntegrationStatus } from "./types.js";

let bot: Bot | null = null;

export function telegramStatus(): TelegramIntegrationStatus {
  return {
    status: appConfig.telegram.configured ? "configured" : "unconfigured",
    configured: appConfig.telegram.configured,
    disclosure: appConfig.telegram.configured
      ? "Telegram receipt notifications are configured."
      : "Telegram receipt notifications are optional and not configured.",
  };
}

function getBot(): Bot | null {
  if (!appConfig.telegram.configured || !appConfig.telegram.botToken) return null;
  if (!bot) bot = new Bot(appConfig.telegram.botToken);
  return bot;
}

function sanitizeTelegramError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown Telegram error";
  let safe = raw.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[redacted]");
  if (appConfig.telegram.botToken) safe = safe.split(appConfig.telegram.botToken).join("[redacted-token]");
  if (appConfig.telegram.chatId) safe = safe.split(appConfig.telegram.chatId).join("[redacted-chat]");
  return safe;
}

function receiptMessage(receipt: Receipt): string {
  const lines = [
    "ArcMargin receipt",
    `${receipt.title}`,
    `Status: ${receipt.status}`,
    `Action: ${receipt.action}`,
    `Market: ${receipt.venue} / ${receipt.pair}`,
    `Signing: ${receipt.signingMode ?? "unconfigured"}`,
  ];

  if (receipt.txHash) lines.push(`ArcScan: ${receipt.explorerUrl ?? receipt.txHash}`);
  if (receipt.status !== "settled") lines.push(`Disclosure: ${receipt.executionDisclosure ?? "No live venue execution was claimed."}`);
  if (receipt.amount !== undefined) lines.push(`Amount: ${receipt.amount} USDC`);

  return lines.join("\n");
}

export async function notifyReceipt(receipt: Receipt): Promise<void> {
  if (receipt.seeded) return;
  const activeBot = getBot();
  if (!activeBot || !appConfig.telegram.chatId) return;

  try {
    await activeBot.api.sendMessage(appConfig.telegram.chatId, receiptMessage(receipt));
  } catch (error) {
    console.warn(`Telegram receipt notification failed: ${sanitizeTelegramError(error)}`);
  }
}
