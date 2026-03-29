import { apiEnvelopeRequest } from "./client";
import type { HealthStatusResult } from "./types";
import type { AppSettings } from "../lib/settings";

export async function getHealthStatus(settings: AppSettings) {
  const envelope = await apiEnvelopeRequest<HealthStatusResult>(settings, {
    method: "GET",
    url: "/api/v1/healthz",
    validateStatus: (status) => status === 200 || status === 503,
  });

  return envelope.data;
}
