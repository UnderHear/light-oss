import type { HealthStatusResult } from "@/api/types";

export type ConnectionHealthBadgeState =
  | "ok"
  | "error"
  | "token_error"
  | "checking"
  | "unconfigured"
  | "unreachable"
  | "unknown";

export interface ConnectionHealthStates {
  service: ConnectionHealthBadgeState;
  database: ConnectionHealthBadgeState;
}

export function resolveConnectionHealthStates({
  isConfigured,
  isPending,
  error,
  data,
}: {
  isConfigured: boolean;
  isPending: boolean;
  error: unknown;
  data?: HealthStatusResult;
}): ConnectionHealthStates {
  if (!isConfigured) {
    return {
      service: "unconfigured",
      database: "unconfigured",
    };
  }

  if (isPending) {
    return {
      service: "checking",
      database: "checking",
    };
  }

  if (isUnauthorizedHealthError(error)) {
    return {
      service: "token_error",
      database: "token_error",
    };
  }

  if (error || !data) {
    return {
      service: "unreachable",
      database: "unknown",
    };
  }

  return {
    service: data.status.service,
    database: data.status.db,
  };
}

export function createCheckingConnectionHealthStates(): ConnectionHealthStates {
  return {
    service: "checking",
    database: "checking",
  };
}

export function isUnauthorizedHealthError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const status =
    "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;
  const code =
    "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;

  return status === 401 || code === "unauthorized";
}
