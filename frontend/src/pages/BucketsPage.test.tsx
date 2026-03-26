import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { BucketsPage } from "./BucketsPage";
import { renderWithApp } from "../test/test-utils";

vi.mock("../api/buckets", () => ({
  listBuckets: vi.fn(),
}));

import { listBuckets } from "../api/buckets";

describe("BucketsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bucket list without overview controls", async () => {
    vi.mocked(listBuckets).mockResolvedValueOnce({
      items: [
        {
          id: 1,
          name: "alpha",
          created_at: "2026-03-25T00:00:00Z",
          updated_at: "2026-03-25T00:00:00Z",
        },
      ],
    });

    renderWithApp(
      <Routes>
        <Route path="/buckets" element={<BucketsPage />} />
      </Routes>,
      { route: "/buckets" },
    );

    expect(
      await screen.findByRole("heading", { name: "Buckets" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "alpha" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create bucket" }),
    ).not.toBeInTheDocument();
  });
});
