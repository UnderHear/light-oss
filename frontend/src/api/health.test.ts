import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../lib/settings";
import { getHealthStatus } from "./health";

const apiEnvelopeRequestMock = vi.fn();

vi.mock("./client", () => ({
  apiEnvelopeRequest: (...args: unknown[]) => apiEnvelopeRequestMock(...args),
}));

const settings: AppSettings = {
  apiBaseUrl: "http://localhost:8080",
  bearerToken: "dev-token",
};

describe("health api helper", () => {
  beforeEach(() => {
    apiEnvelopeRequestMock.mockReset();
  });

  it("parses successful health responses", async () => {
    apiEnvelopeRequestMock.mockResolvedValueOnce({
      request_id: "req_1",
      data: {
        status: {
          service: "ok",
          db: "ok",
        },
        version: "mvp",
      },
    });

    await expect(getHealthStatus(settings)).resolves.toEqual({
      status: {
        service: "ok",
        db: "ok",
      },
      version: "mvp",
    });

    expect(apiEnvelopeRequestMock).toHaveBeenCalledWith(
      settings,
      expect.objectContaining({
        method: "GET",
        url: "/api/v1/healthz",
        validateStatus: expect.any(Function),
      }),
    );

    const request = apiEnvelopeRequestMock.mock.calls[0]?.[1];
    expect(request?.validateStatus?.(200)).toBe(true);
    expect(request?.validateStatus?.(503)).toBe(true);
    expect(request?.validateStatus?.(500)).toBe(false);
  });

  it("returns degraded health payloads from 503 responses", async () => {
    apiEnvelopeRequestMock.mockResolvedValueOnce({
      request_id: "req_2",
      data: {
        status: {
          service: "ok",
          db: "error",
        },
        version: "mvp",
      },
    });

    await expect(getHealthStatus(settings)).resolves.toEqual({
      status: {
        service: "ok",
        db: "error",
      },
      version: "mvp",
    });
  });

  it("rethrows normalized network errors", async () => {
    const networkError = Object.assign(new Error("Network Error"), {
      status: 500,
    });

    apiEnvelopeRequestMock.mockRejectedValueOnce(
      networkError,
    );

    await expect(getHealthStatus(settings)).rejects.toMatchObject({
      message: "Network Error",
      status: 500,
    });
  });

  it("rethrows unauthorized token errors", async () => {
    const tokenError = Object.assign(new Error("missing or invalid bearer token"), {
      status: 401,
      code: "unauthorized",
    });

    apiEnvelopeRequestMock.mockRejectedValueOnce(tokenError);

    await expect(getHealthStatus(settings)).rejects.toMatchObject({
      message: "missing or invalid bearer token",
      status: 401,
      code: "unauthorized",
    });
  });
});
