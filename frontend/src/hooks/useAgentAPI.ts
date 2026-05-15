import { useCallback, useEffect } from "react";
import { agentApi } from "../lib/api";
import type { ActionResponse, RiskProfile } from "../types/agent";
import { errorMessage, useStore } from "../store/useStore";

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
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
  const setDemoStep = useStore((state) => state.setDemoStep);
  const setPolicyExportStatus = useStore((state) => state.setPolicyExportStatus);
  const applyFallbackShock = useStore((state) => state.applyFallbackShock);
  const applyFallbackCycle = useStore((state) => state.applyFallbackCycle);
  const applyFallbackReset = useStore((state) => state.applyFallbackReset);
  const applyFallbackProfile = useStore((state) => state.applyFallbackProfile);
  const applyFallbackPaused = useStore((state) => state.applyFallbackPaused);
  const applyFallbackAutopilot = useStore((state) => state.applyFallbackAutopilot);
  const applyFallbackAutoHedge = useStore((state) => state.applyFallbackAutoHedge);

  const applyResponse = useCallback(
    (response: ActionResponse) => {
      setServerState(response.state);
    },
    [setServerState],
  );

  const runShock = useCallback(async () => {
    setPendingAction("shock");
    setDemoStep(0);
    try {
      applyResponse(await agentApi.shock());
      await wait(250);
      setDemoStep(1);
    } catch (error) {
      applyFallbackShock(errorMessage(error));
    } finally {
      window.setTimeout(() => setDemoStep(-1), 900);
      setPendingAction(null);
    }
  }, [applyFallbackShock, applyResponse, setDemoStep, setPendingAction]);

  const runCycle = useCallback(async () => {
    setPendingAction("cycle");
    setDemoStep(2);
    try {
      const response = await agentApi.runCycle();
      applyResponse(response);
      setDemoStep(4);
    } catch (error) {
      setDemoStep(3);
      applyFallbackCycle(errorMessage(error));
      window.setTimeout(() => setDemoStep(4), 350);
    } finally {
      window.setTimeout(() => setDemoStep(-1), 1200);
      setPendingAction(null);
    }
  }, [applyFallbackCycle, applyResponse, setDemoStep, setPendingAction]);

  const reset = useCallback(async () => {
    setPendingAction("reset");
    try {
      applyResponse(await agentApi.reset());
    } catch (error) {
      applyFallbackReset(errorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }, [applyFallbackReset, applyResponse, setPendingAction]);

  const setProfile = useCallback(
    async (profile: RiskProfile) => {
      setPendingAction("profile");
      try {
        applyResponse(await agentApi.setProfile(profile));
      } catch (error) {
        applyFallbackProfile(profile, errorMessage(error));
      } finally {
        setPendingAction(null);
      }
    },
    [applyFallbackProfile, applyResponse, setPendingAction],
  );

  const setPaused = useCallback(
    async (paused: boolean) => {
      setPendingAction("pause");
      try {
        applyResponse(await agentApi.setPaused(paused));
      } catch (error) {
        applyFallbackPaused(paused, errorMessage(error));
      } finally {
        setPendingAction(null);
      }
    },
    [applyFallbackPaused, applyResponse, setPendingAction],
  );

  const setAutopilot = useCallback(
    async (on: boolean) => {
      setPendingAction("autopilot");
      try {
        applyResponse(await agentApi.setAutopilot(on));
      } catch (error) {
        applyFallbackAutopilot(on, errorMessage(error));
      } finally {
        setPendingAction(null);
      }
    },
    [applyFallbackAutopilot, applyResponse, setPendingAction],
  );

  const setAutoHedge = useCallback(
    async (on: boolean) => {
      setPendingAction("autohedge");
      try {
        applyResponse(await agentApi.setAutoHedge(on));
      } catch (error) {
        applyFallbackAutoHedge(on, errorMessage(error));
      } finally {
        setPendingAction(null);
      }
    },
    [applyFallbackAutoHedge, applyResponse, setPendingAction],
  );

  const exportPolicy = useCallback(async () => {
    setPendingAction("export");
    try {
      const exported = await agentApi.exportPolicy();
      await navigator.clipboard?.writeText(JSON.stringify(exported, null, 2));
      setPolicyExportStatus(`Policy exported at ${new Date(exported.exportedAt).toLocaleTimeString("en-US")}`);
    } catch (error) {
      setPolicyExportStatus(`Export unavailable: ${errorMessage(error)}`);
    } finally {
      window.setTimeout(() => setPolicyExportStatus(null), 3000);
      setPendingAction(null);
    }
  }, [setPendingAction, setPolicyExportStatus]);

  return {
    runShock,
    runCycle,
    reset,
    setProfile,
    setPaused,
    setAutopilot,
    setAutoHedge,
    exportPolicy,
  };
}
