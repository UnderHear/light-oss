import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { SettingsPage } from "./SettingsPage";
import { renderWithApp } from "../test/test-utils";

describe("SettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("switches locale and theme with persistence", async () => {
    renderWithApp(
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>,
      {
        route: "/settings",
        preferences: {
          locale: "en-US",
          theme: "light",
        },
      },
    );

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Change language" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "简体中文" }));

    expect(await screen.findByRole("heading", { name: "设置" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "切换主题" }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(window.localStorage.getItem("light-oss-preferences")).toContain(
        "\"locale\":\"zh-CN\"",
      );
      expect(window.localStorage.getItem("light-oss-preferences")).toContain(
        "\"theme\":\"dark\"",
      );
    });
  });

  it("saves connection settings to localStorage", async () => {
    renderWithApp(
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>,
      { route: "/settings" },
    );

    const apiInput = screen.getByLabelText("API base URL");
    const tokenInput = screen.getByLabelText("Bearer token");

    await userEvent.clear(apiInput);
    await userEvent.type(apiInput, "http://localhost:9090");
    await userEvent.clear(tokenInput);
    await userEvent.type(tokenInput, "next-token");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("light-oss-settings")).toContain(
        "\"apiBaseUrl\":\"http://localhost:9090\"",
      );
      expect(window.localStorage.getItem("light-oss-settings")).toContain(
        "\"bearerToken\":\"next-token\"",
      );
    });
  });
});
