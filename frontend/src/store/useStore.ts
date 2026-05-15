import { create } from "zustand";
import type { AgentState, Receipt, RiskProfile } from "../types/agent";
import { demoState } from "../lib/demoState";
import {
  applyLocalShock,
  resetLocal,
  runLocalCycle,
  setLocalAutoHedge,
  setLocalAutopilot,
  setLocalPaused,
  setLocalProfile,
} from "../lib/localActions";

export type ConnectionMode = "live" | "reconnecting" | "demo";
export type PendingAction =
  | "cycle"
  | "shock"
  | "reset"
  | "profile"
  | "autopilot"
  | "pause"
  | "autohedge"
  | "export"
  | null;

interface StoreState {
  state: AgentState;
  connectionMode: ConnectionMode;
  backendConnected: boolean;
  lastServerAt: string | null;
  lastError: string | null;
  pendingAction: PendingAction;
  selectedReceipt: Receipt | null;
  demoStep: number;
  policyExportStatus: string | null;
  setServerState: (state: AgentState) => void;
  markPollFailure: (error: string) => void;
  setPendingAction: (action: PendingAction) => void;
  setSelectedReceipt: (receipt: Receipt | null) => void;
  setDemoStep: (step: number) => void;
  setPolicyExportStatus: (status: string | null) => void;
  applyFallbackShock: (error: string) => void;
  applyFallbackCycle: (error: string) => void;
  applyFallbackReset: (error: string) => void;
  applyFallbackProfile: (profile: RiskProfile, error: string) => void;
  applyFallbackPaused: (paused: boolean, error: string) => void;
  applyFallbackAutopilot: (on: boolean, error: string) => void;
  applyFallbackAutoHedge: (on: boolean, error: string) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function mergeServerState(current: AgentState, incoming: AgentState): AgentState {
  const localFallbacks = current.receipts.filter(
    (receipt) => receipt.id.startsWith("demo-") && !receipt.txHash && !incoming.receipts.some((item) => item.id === receipt.id),
  );
  if (localFallbacks.length === 0) return incoming;
  return {
    ...incoming,
    receipts: [...localFallbacks, ...incoming.receipts],
    newestReceiptId: current.newestReceiptId?.startsWith("demo-") ? current.newestReceiptId : incoming.newestReceiptId,
  };
}

export const useStore = create<StoreState>()((set, get) => ({
  state: demoState,
  connectionMode: "demo",
  backendConnected: false,
  lastServerAt: null,
  lastError: null,
  pendingAction: null,
  selectedReceipt: null,
  demoStep: -1,
  policyExportStatus: null,

  setServerState: (state) =>
    set((current) => ({
      state: mergeServerState(current.state, state),
      connectionMode: "live",
      backendConnected: true,
      lastServerAt: new Date().toISOString(),
      lastError: state.runtime.lastError?.message ?? null,
    })),

  markPollFailure: (error) =>
    set((current) => ({
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      state: current.backendConnected ? current.state : demoState,
      lastError: error,
    })),

  setPendingAction: (action) => set({ pendingAction: action }),
  setSelectedReceipt: (receipt) => set({ selectedReceipt: receipt }),
  setDemoStep: (step) => set({ demoStep: step }),
  setPolicyExportStatus: (status) => set({ policyExportStatus: status }),

  applyFallbackShock: (error) =>
    set((current) => ({
      state: applyLocalShock(current.state),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
    })),

  applyFallbackCycle: (error) =>
    set((current) => {
      const next = runLocalCycle(current.state);
      return {
        state: next,
        connectionMode: current.backendConnected ? "reconnecting" : "demo",
        lastError: error,
        selectedReceipt: next.receipts.find((receipt) => receipt.id === next.newestReceiptId) ?? get().selectedReceipt,
      };
    }),

  applyFallbackReset: (error) =>
    set({
      state: resetLocal(),
      connectionMode: "demo",
      backendConnected: false,
      lastError: error,
      selectedReceipt: null,
    }),

  applyFallbackProfile: (profile, error) =>
    set((current) => ({
      state: setLocalProfile(current.state, profile),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
    })),

  applyFallbackPaused: (paused, error) =>
    set((current) => ({
      state: setLocalPaused(current.state, paused),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
    })),

  applyFallbackAutopilot: (on, error) =>
    set((current) => ({
      state: setLocalAutopilot(current.state, on),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
    })),

  applyFallbackAutoHedge: (on, error) =>
    set((current) => ({
      state: setLocalAutoHedge(current.state, on),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
    })),
}));

export { errorMessage };
