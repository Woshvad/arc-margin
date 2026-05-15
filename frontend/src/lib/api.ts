import type { ActionResponse, AgentState, PolicyExport, RiskProfile } from "../types/agent";

const defaultApiUrl = `${window.location.protocol}//${window.location.hostname || "localhost"}:3001`;
const API_URL = (import.meta.env.VITE_AGENT_API_URL ?? defaultApiUrl).replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers =
    init?.body === undefined
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        };

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      message = payload.error?.message ?? message;
    } catch {
      // Keep the HTTP status message when the backend does not return JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function postAction(path: string, body?: unknown): Promise<ActionResponse> {
  return request<ActionResponse>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const agentApi = {
  url: API_URL,
  getState: () => request<AgentState>("/api/state"),
  runCycle: () => postAction("/api/cycle"),
  shock: () => postAction("/api/shock"),
  reset: () => postAction("/api/reset"),
  setAutopilot: (on: boolean) => postAction("/api/autopilot", { on }),
  setPaused: (paused: boolean) => postAction("/api/pause", { paused }),
  setProfile: (profile: RiskProfile) => postAction("/api/profile", { profile }),
  setAutoHedge: (on: boolean) => postAction("/api/autohedge", { on }),
  exportPolicy: () => request<PolicyExport>("/api/policy/export"),
};
