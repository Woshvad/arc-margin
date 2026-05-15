import { appConfig } from "./config.js";
import { buildServer } from "./api.js";
import { startAutopilotLoop, stopAutopilotLoop } from "./autopilot.js";
import { closeDb } from "./db.js";

const server = await buildServer();
startAutopilotLoop();

const shutdown = async () => {
  stopAutopilotLoop();
  await server.close();
  closeDb();
};

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});

await server.listen({ port: appConfig.server.port, host: "0.0.0.0" });
