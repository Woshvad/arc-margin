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
  | "demo"
  | null;
export type SectionHighlight = "risk" | "policy" | "receipts" | "demo" | "wallet" | null;

interface StoreState {
  state: AgentState;
  connectionMode: ConnectionMode;
  backendConnected: boolean;
  lastServerAt: string | null;
  lastError: string | null;
  pendingAction: PendingAction;
  selectedReceipt: Receipt | null;
  adapterHealthOpen: boolean;
  demoRunning: boolean;
  demoStep: number;
  demoStepLoading: boolean;
  demoError: string | null;
  walletProofVisible: boolean;
  walletProofTouched: boolean;
  resetStatus: string | null;
  sectionHighlight: SectionHighlight;
  policyExportStatus: string | null;
  setServerState: (state: AgentState) => void;
  markPollFailure: (error: string) => void;
  setPendingAction: (action: PendingAction) => void;
  setSelectedReceipt: (receipt: Receipt | null) => void;
  setAdapterHealthOpen: (open: boolean) => void;
  setDemoRunning: (running: boolean) => void;
  setDemoStep: (step: number) => void;
  setDemoStepLoading: (loading: boolean) => void;
  setDemoError: (error: string | null) => void;
  connectWalletProof: () => void;
  disconnectWalletProof: () => void;
  setResetStatus: (status: string | null) => void;
  setSectionHighlight: (highlight: SectionHighlight) => void;
  setPolicyExportStatus: (status: string | null) => void;
  clearTransientUi: () => void;
  finishResetFeedback: () => void;
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

export const useStore = create<StoreState>()((set) => ({
  state: demoState,
  connectionMode: "demo",
  backendConnected: false,
  lastServerAt: null,
  lastError: null,
  pendingAction: null,
  selectedReceipt: null,
  adapterHealthOpen: false,
  demoRunning: false,
  demoStep: -1,
  demoStepLoading: false,
  demoError: null,
  walletProofVisible: false,
  walletProofTouched: false,
  resetStatus: null,
  sectionHighlight: null,
  policyExportStatus: null,

  setServerState: (state) =>
    set((current) => ({
      state: mergeServerState(current.state, state),
      connectionMode: "live",
      backendConnected: true,
      lastServerAt: new Date().toISOString(),
      lastError: state.runtime.lastError?.message ?? null,
      walletProofVisible: current.walletProofTouched ? current.walletProofVisible : state.wallet.connected,
    })),

  markPollFailure: (error) =>
    set((current) => ({
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      state: current.backendConnected ? current.state : demoState,
      lastError: error,
      walletProofVisible: current.backendConnected ? current.walletProofVisible : false,
    })),

  setPendingAction: (action) => set({ pendingAction: action }),
  setSelectedReceipt: (receipt) => set({ selectedReceipt: receipt }),
  setAdapterHealthOpen: (open) => set({ adapterHealthOpen: open }),
  setDemoRunning: (running) => set({ demoRunning: running }),
  setDemoStep: (step) => set({ demoStep: step }),
  setDemoStepLoading: (loading) => set({ demoStepLoading: loading }),
  setDemoError: (error) => set({ demoError: error }),
  connectWalletProof: () => set({ walletProofVisible: true, walletProofTouched: true, sectionHighlight: "wallet" }),
  disconnectWalletProof: () => set({ walletProofVisible: false, walletProofTouched: true, sectionHighlight: "wallet" }),
  setResetStatus: (status) => set({ resetStatus: status }),
  setSectionHighlight: (highlight) => set({ sectionHighlight: highlight }),
  setPolicyExportStatus: (status) => set({ policyExportStatus: status }),
  clearTransientUi: () =>
    set({
      selectedReceipt: null,
      adapterHealthOpen: false,
      demoRunning: false,
      demoStep: -1,
      demoStepLoading: false,
      demoError: null,
      sectionHighlight: null,
    }),
  finishResetFeedback: () =>
    set({
      pendingAction: null,
      selectedReceipt: null,
      adapterHealthOpen: false,
      demoRunning: false,
      demoStep: -1,
      demoStepLoading: false,
      demoError: null,
      resetStatus: "Scenario reset",
      sectionHighlight: "risk",
    }),

  applyFallbackShock: (error) =>
    set((current) => ({
      state: applyLocalShock(current.state),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
      sectionHighlight: "risk",
    })),

  applyFallbackCycle: (error) =>
    set((current) => {
      const next = runLocalCycle(current.state);
      return {
        state: next,
        connectionMode: current.backendConnected ? "reconnecting" : "demo",
        lastError: error,
        selectedReceipt: next.receipts.find((receipt) => receipt.id === next.newestReceiptId) ?? current.selectedReceipt,
        sectionHighlight: "receipts",
      };
    }),

  applyFallbackReset: (error) =>
    set((current) => ({
      state: resetLocal(),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      backendConnected: current.backendConnected,
      lastError: error,
      selectedReceipt: null,
      adapterHealthOpen: false,
      demoRunning: false,
      demoStep: -1,
      demoStepLoading: false,
      demoError: null,
      resetStatus: "Scenario reset",
      sectionHighlight: "risk",
    })),

  applyFallbackProfile: (profile, error) =>
    set((current) => ({
      state: setLocalProfile(current.state, profile),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
      sectionHighlight: "policy",
    })),

  applyFallbackPaused: (paused, error) =>
    set((current) => ({
      state: setLocalPaused(current.state, paused),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
      sectionHighlight: "policy",
    })),

  applyFallbackAutopilot: (on, error) =>
    set((current) => ({
      state: setLocalAutopilot(current.state, on),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
      sectionHighlight: "risk",
    })),

  applyFallbackAutoHedge: (on, error) =>
    set((current) => ({
      state: setLocalAutoHedge(current.state, on),
      connectionMode: current.backendConnected ? "reconnecting" : "demo",
      lastError: error,
      sectionHighlight: "policy",
    })),
}));

export { errorMessage };
