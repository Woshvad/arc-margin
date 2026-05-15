import Fastify from "fastify";
import cors from "@fastify/cors";
import { appConfig } from "./config.js";
import {
  applyShock,
  getState,
  resetState,
  runCycle,
  setAutoHedge,
  setAutopilot,
  setPaused,
  setProfile,
} from "./agent.js";
import { syncAutoHedge, syncPaused, syncProfile } from "./policySync.js";
import { toErrorPayload } from "./errors.js";
import type { AgentState, RiskProfile } from "./types.js";

function boolBody(body: unknown, key: "on" | "paused"): boolean {
  const value = (body as Record<string, unknown> | null)?.[key];
  return value === true || value === "true" || value === 1;
}

function profileBody(body: unknown): RiskProfile {
  const profile = (body as { profile?: RiskProfile } | null)?.profile;
  if (profile === "Conservative" || profile === "Balanced" || profile === "Advanced") return profile;
  return "Balanced";
}

async function getStateAfter(mutator: () => AgentState): Promise<AgentState> {
  mutator();
  return getState();
}

export async function buildServer() {
  const server = Fastify({ logger: true });
  await server.register(cors, {
    origin: appConfig.server.corsOrigin === "*" ? true : appConfig.server.corsOrigin,
  });

  server.setErrorHandler((error, _request, reply) => {
    const payload = toErrorPayload(error);
    reply.code(payload.statusCode).send({
      ok: false,
      error: {
        code: payload.code,
        message: payload.message,
        details: payload.details,
      },
    });
  });

  server.get("/health", async () => ({
    ok: true,
    service: "arcmargin-agent",
    chainId: appConfig.arc.chainId,
    contractAddress: appConfig.deployment.contractAddress,
  }));

  server.get("/api/state", async () => getState());

  server.post("/api/cycle", async () => {
    const result = await runCycle({ source: "manual", broadcast: true });
    return { ok: true, ...result };
  });

  server.post("/api/shock", async () => {
    applyShock();
    return { ok: true, state: await getState() };
  });

  server.post("/api/reset", async (request) => {
    const query = request.query as { hard?: string | boolean } | undefined;
    const hard = query?.hard === true || query?.hard === "true";
    resetState({ hard });
    return { ok: true, state: await getState() };
  });

  server.post("/api/autopilot", async (request) => ({
    ok: true,
    state: await getStateAfter(() => setAutopilot(boolBody(request.body, "on"))),
  }));

  server.post("/api/pause", async (request) => ({
    ok: true,
    state: await getStateAfter(() => setPaused(boolBody(request.body, "paused"))),
  }));

  server.post("/api/profile", async (request) => ({
    ok: true,
    state: await getStateAfter(() => setProfile(profileBody(request.body))),
  }));

  server.post("/api/autohedge", async (request) => ({
    ok: true,
    state: await getStateAfter(() => setAutoHedge(boolBody(request.body, "on"))),
  }));

  server.get("/api/policy/export", async () => {
    const state = await getState();
    return {
      exportedAt: new Date().toISOString(),
      policy: state.policy,
      chain: state.chain,
      signing: state.signing,
      adapters: state.adapters,
    };
  });

  server.post("/api/policy/sync-profile", async (request) => {
    const result = await syncProfile(profileBody(request.body));
    return { ok: true, sync: result, state: await getState() };
  });

  server.post("/api/policy/sync-paused", async (request) => {
    const result = await syncPaused(boolBody(request.body, "paused"));
    return { ok: true, sync: result, state: await getState() };
  });

  server.post("/api/policy/sync-autohedge", async (request) => {
    const result = await syncAutoHedge(boolBody(request.body, "on"));
    return { ok: true, sync: result, state: await getState() };
  });

  return server;
}
