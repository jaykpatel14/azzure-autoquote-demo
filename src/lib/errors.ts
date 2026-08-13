export type AppError = {
  code: string;
  userMessage: string;
  statusCode: number;
  cause?: unknown;
};

export type AppResult<T> = { data: T } | { error: AppError };

export const NotFoundError = (resource: string, cause?: unknown): AppError => ({
  code: "NOT_FOUND",
  userMessage: `${resource} not found`,
  statusCode: 404,
  cause
});

export const ForbiddenError = (cause?: unknown): AppError => ({
  code: "FORBIDDEN",
  userMessage: "You do not have permission to do that",
  statusCode: 403,
  cause
});

export const ValidationError = (message: string, cause?: unknown): AppError => ({
  code: "VALIDATION_ERROR",
  userMessage: message,
  statusCode: 400,
  cause
});

export const PlanError = (feature: string, cause?: unknown): AppError => ({
  code: "PLAN_INSUFFICIENT",
  userMessage: `${feature} is not available on your current plan. Upgrade to access it.`,
  statusCode: 403,
  cause
});

export const UsageLimitError = (cause?: unknown): AppError => ({
  code: "USAGE_LIMIT_REACHED",
  userMessage: "You have reached your monthly quote limit. Upgrade your plan or wait for the next billing period.",
  statusCode: 429,
  cause
});

export const ExternalServiceError = (service: string, cause?: unknown): AppError => ({
  code: "EXTERNAL_SERVICE_ERROR",
  userMessage: `We could not reach ${service} right now. Please try again.`,
  statusCode: 502,
  cause
});

export const ConflictError = (message: string, cause?: unknown): AppError => ({
  code: "CONFLICT",
  userMessage: message,
  statusCode: 409,
  cause
});

