export type SerializedError = {
  name: string;
  message: string;
  code?: string;
  status?: number;
  type?: string;
};

export class ModerationRejectedError extends Error {
  constructor(message = "The uploaded image was blocked by moderation.") {
    super(message);
    this.name = "ModerationRejectedError";
  }
}

export class AttemptFailedError extends Error {
  readonly retryCount: number;
  readonly latencyMs: number;
  readonly serializedError: SerializedError;

  constructor(
    message: string,
    retryCount: number,
    latencyMs: number,
    serializedError: SerializedError
  ) {
    super(message);
    this.name = "AttemptFailedError";
    this.retryCount = retryCount;
    this.latencyMs = latencyMs;
    this.serializedError = serializedError;
  }
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const candidate = error as Error & {
      code?: unknown;
      status?: unknown;
      type?: unknown;
    };
    return {
      name: error.name,
      message: error.message,
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      status:
        typeof candidate.status === "number"
          ? candidate.status
          : undefined,
      type:
        typeof candidate.type === "string"
          ? candidate.type
          : undefined
    };
  }

  return {
    name: "Error",
    message: "Unknown error"
  };
}

export function isTransientAIError(error: unknown) {
  const serialized = serializeError(error);
  return Boolean(
    serialized.status &&
      [408, 409, 425, 429, 500, 502, 503, 504].includes(serialized.status) ||
      serialized.code === "rate_limit_exceeded" ||
      serialized.code === "server_error" ||
      serialized.code === "timeout"
  );
}
