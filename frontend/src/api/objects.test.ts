import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../lib/settings";
import { buildPublicObjectURL, deleteFolder, updateObjectVisibility, uploadObject } from "./objects";

const request = vi.fn();
const apiRequestMock = vi.fn();

vi.mock("./client", () => ({
  ApiError: class ApiError extends Error {},
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  createApiClient: vi.fn(() => ({
    request,
  })),
}));

const settings: AppSettings = {
  apiBaseUrl: "https://oss.underhear.cn",
  bearerToken: "dev-token",
};

describe("objects api helpers", () => {
  beforeEach(() => {
    request.mockReset();
    apiRequestMock.mockReset();
    request.mockResolvedValue({
      data: {
        data: {
          id: 1,
        },
      },
    });
    apiRequestMock.mockResolvedValue({
      id: 1,
    });
  });

  it("encodes dots in object keys for upload requests", async () => {
    const file = new File(["sql"], "underhear.postgresql.sql", {
      type: "application/sql",
    });

    await uploadObject(settings, {
      bucket: "demo",
      objectKey: "docs/underhear.postgresql.sql",
      file,
      visibility: "private",
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/buckets/demo/objects/docs/underhear%2Epostgresql%2Esql",
      }),
    );
  });

  it("encodes dots when building a public object URL", () => {
    expect(
      buildPublicObjectURL(
        "https://oss.underhear.cn/",
        "demo",
        "docs/underhear.postgresql.sql",
      ),
    ).toBe(
      "https://oss.underhear.cn/api/v1/buckets/demo/objects/docs/underhear%2Epostgresql%2Esql",
    );
  });

  it("calls visibility update endpoint with encoded object key", async () => {
    await updateObjectVisibility(settings, {
      bucket: "demo",
      objectKey: "docs/underhear.postgresql.sql",
      visibility: "public",
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      settings,
      expect.objectContaining({
        method: "PATCH",
        url: "/api/v1/buckets/demo/objects/visibility/docs/underhear%2Epostgresql%2Esql",
        data: { visibility: "public" },
      }),
    );
  });

  it("passes recursive deletion to the folder endpoint when requested", async () => {
    await deleteFolder(settings, "demo", "docs/", { recursive: true });

    expect(apiRequestMock).toHaveBeenCalledWith(
      settings,
      expect.objectContaining({
        method: "DELETE",
        url: "/api/v1/buckets/demo/folders",
        params: {
          path: "docs/",
          recursive: true,
        },
      }),
    );
  });
});
