import { explorerTxUrl } from "./arc.js";
import { profileSyncArgs, writeOwnerContract } from "./contract.js";
import { setAutoHedge, setPaused, setProfile } from "./agent.js";
import { updateSnapshot } from "./state.js";
import type { PolicySyncResult, RiskProfile } from "./types.js";

function recordSync(result: PolicySyncResult): void {
  updateSnapshot((snapshot) => {
    snapshot.runtime.lastPolicySyncTxHash = result.txHash;
    snapshot.runtime.lastPolicySyncAt = new Date().toISOString();
  });
}

export async function syncProfile(profile: RiskProfile): Promise<PolicySyncResult> {
  setProfile(profile);
  const result = await writeOwnerContract({ functionName: "setProfile", args: profileSyncArgs(profile) });
  recordSync(result);
  return { ...result, explorerUrl: explorerTxUrl(result.txHash) };
}

export async function syncPaused(paused: boolean): Promise<PolicySyncResult> {
  setPaused(paused);
  const result = await writeOwnerContract({ functionName: "setPaused", args: [paused] });
  recordSync(result);
  return { ...result, explorerUrl: explorerTxUrl(result.txHash) };
}

export async function syncAutoHedge(on: boolean): Promise<PolicySyncResult> {
  setAutoHedge(on);
  const result = await writeOwnerContract({ functionName: "setAutoHedge", args: [on] });
  recordSync(result);
  return { ...result, explorerUrl: explorerTxUrl(result.txHash) };
}
