import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { appConfig } from "./config.js";

let db: BetterSqliteDatabase | null = null;

export function getDb(): BetterSqliteDatabase {
  if (db) return db;

  fs.mkdirSync(path.dirname(appConfig.runtime.dbPath), { recursive: true });
  db = new Database(appConfig.runtime.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      receipt_id INTEGER NOT NULL,
      tx_hash TEXT,
      status TEXT NOT NULL,
      action TEXT NOT NULL,
      seeded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_receipts_tx_hash ON receipts(tx_hash);
  `);

  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
