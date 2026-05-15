import { appConfig } from "./config.js";
import { runCycle } from "./agent.js";
import { getApiState } from "./state.js";

let timer: NodeJS.Timeout | null = null;

export function startAutopilotLoop(intervalMs = 30_000): void {
  if (timer) return;
  timer = setInterval(async () => {
    const state = getApiState();
    if (!state.autopilot) return;
    if (state.runtime.cycleInProgress) return;

    try {
      await runCycle({
        source: "autopilot",
        broadcast: appConfig.runtime.autopilotWritesEnabled,
      });
    } catch {
      // The cycle itself persists structured runtime error state.
    }
  }, intervalMs);
}

export function stopAutopilotLoop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
