import type { ApiErrorPayload } from "./types.js";

export class AgentError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(code: string, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function cycleInProgressError(): AgentError {
  return new AgentError("cycle_in_progress", "An agent cycle is already running.", 409);
}

export function toErrorPayload(error: unknown): ApiErrorPayload & { statusCode: number } {
  if (error instanceof AgentError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      statusCode: error.statusCode,
    };
  }
  if (error instanceof Error) {
    return {
      code: "internal_error",
      message: error.message,
      statusCode: 500,
    };
  }
  return {
    code: "internal_error",
    message: "Unknown error",
    details: error,
    statusCode: 500,
  };
}
