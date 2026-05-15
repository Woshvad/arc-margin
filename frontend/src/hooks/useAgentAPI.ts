import { useCallback, useEffect } from "react";
import { agentApi } from "../lib/api";
import type { ActionResponse, PolicyExport, RiskProfile } from "../types/agent";
import { errorMessage, useStore, type SectionHighlight } from "../store/useStore";

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

function actionBlocked(): boolean {
  const state = useStore.getState();
  return state.demoRunning || state.pendingAction !== null;
}

function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useAgentAPI() {
  const setServerState = useStore((state) => state.setServerState);
  const markPollFailure = useStore((state) => state.markPollFailure);

  useEffect(() => {
    let cancelled = false;

    async function fetchState() {
      try {
        const data = await agentApi.getState();
        if (!cancelled) setServerState(data);
      } catch (error) {
        if (!cancelled) markPollFailure(errorMessage(error));
      }
    }

    void fetchState();
    const timer = window.setInterval(fetchState, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [markPollFailure, setServerState]);
}

export function useAgentActions() {
  const setServerState = useStore((state) => state.setServerState);
  const setPendingAction = useStore((state) => state.setPendingAction);
  const setDemoRunning = useStore((state) => state.setDemoRunning);
  const setDemoStep = useStore((state) => state.setDemoStep);
  const setDemoStepLoading = useStore((state) => state.setDemoStepLoading);
  const setDemoError = useStore((state) => state.setDemoError);
  const connectWalletProof = useStore((state) => state.connectWalletProof);
  const disconnectWalletProof = useStore((state) => state.disconnectWalletProof);
  const setResetStatus = useStore((state) => state.setResetStatus);
  const setSectionHighlight = useStore((state) => state.setSectionHighlight);
  const setPolicyExportStatus = useStore((state) => state.setPolicyExportStatus);
  const finishResetFeedback = useStore((state) => state.finishResetFeedback);
  const applyFallbackShock = useStore((state) => state.applyFallbackShock);
  const applyFallbackCycle = useStore((state) => state.applyFallbackCycle);
  const applyFallbackReset = useStore((state) => state.applyFallbackReset);
  const applyFallbackProfile = useStore((state) => state.applyFallbackProfile);
  const applyFallbackPaused = useStore((state) => state.applyFallbackPaused);
  const applyFallbackAutopilot = useStore((state) => state.applyFallbackAutopilot);
  const applyFallbackAutoHedge = useStore((state) => state.applyFallbackAutoHedge);

  const applyResponse = useCallback(
    (response: ActionResponse, highlight?: SectionHighlight) => {
      setServerState(response.state);
      if (highlight) setSectionHighlight(highlight);
    },
    [setSectionHighlight, setServerState],
  );

  const clearHighlightSoon = useCallback(() => {
    window.setTimeout(() => setSectionHighlight(null), 1800);
  }, [setSectionHighlight]);

  const runShockAction = useCallback(
    async (forDemo = false): Promise<boolean> => {
      if (!forDemo && actionBlocked()) return false;
      if (!forDemo) {
        setPendingAction("shock");
        setDemoStep(0);
      }
      setSectionHighlight("risk");
      try {
        applyResponse(await agentApi.shock(), "risk");
        await wait(250);
        if (!forDemo) setDemoStep(1);
        return false;
      } catch (error) {
        const message = errorMessage(error);
        applyFallbackShock(message);
        if (forDemo) setDemoError(`Backend shock failed; local simulated shock continued. ${message}`);
        return true;
      } finally {
        if (!forDemo) {
          window.setTimeout(() => setDemoStep(-1), 900);
          setPendingAction(null);
          clearHighlightSoon();
        }
      }
    },
    [applyFallbackShock, applyResponse, clearHighlightSoon, setDemoError, setDemoStep, setPendingAction, setSectionHighlight],
  );

  const runCycleAction = useCallback(
    async (forDemo = false): Promise<boolean> => {
      if (!forDemo && actionBlocked()) return false;
      if (!forDemo) {
        setPendingAction("cycle");
        setDemoStep(2);
      }
      setSectionHighlight("receipts");
      try {
        const response = await agentApi.runCycle();
        applyResponse(response, "receipts");
        setDemoStep(4);
        return false;
      } catch (error) {
        const message = errorMessage(error);
        setDemoStep(3);
        applyFallbackCycle(message);
        if (forDemo) setDemoError(`Backend cycle failed; local simulated receipt continued. ${message}`);
        window.setTimeout(() => setDemoStep(4), 350);
        return true;
      } finally {
        if (!forDemo) {
          window.setTimeout(() => setDemoStep(-1), 1200);
          setPendingAction(null);
          clearHighlightSoon();
        }
      }
    },
    [applyFallbackCycle, applyResponse, clearHighlightSoon, setDemoError, setDemoStep, setPendingAction, setSectionHighlight],
  );

  const reset = useCallback(async () => {
    if (actionBlocked()) return;
    setPendingAction("reset");
    setSectionHighlight("risk");
    try {
      applyResponse(await agentApi.reset(), "risk");
    } catch (error) {
      applyFallbackReset(errorMessage(error));
    } finally {
      finishResetFeedback();
      window.setTimeout(() => setResetStatus(null), 2600);
      window.setTimeout(() => setSectionHighlight(null), 1800);
    }
  }, [applyFallbackReset, applyResponse, finishResetFeedback, setPendingAction, setResetStatus, setSectionHighlight]);

  const setProfile = useCallback(
    async (profile: RiskProfile) => {
      if (actionBlocked()) return;
      setPendingAction("profile");
      setSectionHighlight("policy");
      try {
        applyResponse(await agentApi.setProfile(profile), "policy");
      } catch (error) {
        applyFallbackProfile(profile, errorMessage(error));
      } finally {
        setPendingAction(null);
        clearHighlightSoon();
      }
    },
    [applyFallbackProfile, applyResponse, clearHighlightSoon, setPendingAction, setSectionHighlight],
  );

  const setPaused = useCallback(
    async (paused: boolean) => {
      if (actionBlocked()) return;
      setPendingAction("pause");
      setSectionHighlight("policy");
      try {
        applyResponse(await agentApi.setPaused(paused), "policy");
      } catch (error) {
        applyFallbackPaused(paused, errorMessage(error));
      } finally {
        setPendingAction(null);
        clearHighlightSoon();
      }
    },
    [applyFallbackPaused, applyResponse, clearHighlightSoon, setPendingAction, setSectionHighlight],
  );

  const setAutopilot = useCallback(
    async (on: boolean) => {
      if (actionBlocked()) return;
      setPendingAction("autopilot");
      setSectionHighlight("risk");
      try {
        applyResponse(await agentApi.setAutopilot(on), "risk");
      } catch (error) {
        applyFallbackAutopilot(on, errorMessage(error));
      } finally {
        setPendingAction(null);
        clearHighlightSoon();
      }
    },
    [applyFallbackAutopilot, applyResponse, clearHighlightSoon, setPendingAction, setSectionHighlight],
  );

  const setAutoHedge = useCallback(
    async (on: boolean) => {
      if (actionBlocked()) return;
      setPendingAction("autohedge");
      setSectionHighlight("policy");
      try {
        applyResponse(await agentApi.setAutoHedge(on), "policy");
      } catch (error) {
        applyFallbackAutoHedge(on, errorMessage(error));
      } finally {
        setPendingAction(null);
        clearHighlightSoon();
      }
    },
    [applyFallbackAutoHedge, applyResponse, clearHighlightSoon, setPendingAction, setSectionHighlight],
  );

  const exportPolicy = useCallback(async () => {
    if (actionBlocked()) return;
    setPendingAction("export");
    setSectionHighlight("policy");
    try {
      let exported: PolicyExport;
      let localFallback = false;
      try {
        exported = await agentApi.exportPolicy();
      } catch {
        const current = useStore.getState().state;
        exported = {
          exportedAt: new Date().toISOString(),
          policy: current.policy,
          chain: current.chain,
          signing: current.signing,
          adapters: current.adapters,
        };
        localFallback = true;
      }

      const json = JSON.stringify(exported, null, 2);
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(json);
        setPolicyExportStatus(`${localFallback ? "Local policy copied" : "Policy copied"} at ${new Date(exported.exportedAt).toLocaleTimeString("en-US")}`);
      } catch {
        downloadJson("arcmargin-policy.json", json);
        setPolicyExportStatus(`${localFallback ? "Local policy downloaded" : "Policy downloaded"} as JSON`);
      }
    } catch (error) {
      setPolicyExportStatus(`Export unavailable: ${errorMessage(error)}`);
    } finally {
      window.setTimeout(() => setPolicyExportStatus(null), 3000);
      setPendingAction(null);
      clearHighlightSoon();
    }
  }, [clearHighlightSoon, setPendingAction, setPolicyExportStatus, setSectionHighlight]);

  const startDemoMode = useCallback(async () => {
    if (actionBlocked()) return;
    setPendingAction("demo");
    setDemoRunning(true);
    setDemoError(null);
    setDemoStepLoading(false);
    setSectionHighlight("demo");
    try {
      setDemoStep(0);
      await wait(1400);
      setDemoStep(1);
      setDemoStepLoading(true);
      await runShockAction(true);
      setDemoStepLoading(false);
      await wait(1400);
      setDemoStep(2);
      await wait(1300);
      setDemoStep(3);
      setDemoStepLoading(true);
      await runCycleAction(true);
      setDemoStepLoading(false);
      setDemoStep(4);
      await wait(1600);
    } finally {
      setDemoRunning(false);
      setDemoStepLoading(false);
      setPendingAction(null);
      window.setTimeout(() => {
        setDemoStep(-1);
        setSectionHighlight(null);
      }, 900);
    }
  }, [
    runCycleAction,
    runShockAction,
    setDemoError,
    setDemoRunning,
    setDemoStep,
    setDemoStepLoading,
    setPendingAction,
    setSectionHighlight,
  ]);

  return {
    runShock: () => runShockAction(false),
    runCycle: () => runCycleAction(false),
    reset,
    setProfile,
    setPaused,
    setAutopilot,
    setAutoHedge,
    exportPolicy,
    startDemoMode,
    connectWallet: connectWalletProof,
    disconnectWallet: disconnectWalletProof,
  };
}
