const CONNECTION_ERROR_PATTERNS = [
  "Can't reach database server",
  "Can't connect to database server",
  "Connection refused",
  "Timed out fetching a new connection from the connection pool",
  "The database server was not reachable"
];

export function isPrismaConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "PrismaClientInitializationError") {
    return true;
  }

  return CONNECTION_ERROR_PATTERNS.some((pattern) => error.message.includes(pattern));
}

