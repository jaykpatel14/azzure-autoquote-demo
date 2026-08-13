type LogLevel = "debug" | "info" | "warn" | "error";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return error;
}

function write(level: LogLevel, message: string, details?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...details
  };

  const output = JSON.stringify(payload, (_key, value) => {
    if (value instanceof Error) {
      return serializeError(value);
    }

    return value;
  });

  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.log(output);
}

export const logger = {
  debug(message: string, details?: Record<string, unknown>) {
    write("debug", message, details);
  },
  info(message: string, details?: Record<string, unknown>) {
    write("info", message, details);
  },
  warn(message: string, details?: Record<string, unknown>) {
    write("warn", message, details);
  },
  error(message: string, details?: Record<string, unknown>) {
    write("error", message, details);
  }
};
