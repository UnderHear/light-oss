import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SettingsProvider } from "./lib/settings";
import { PreferencesProvider } from "./lib/preferences";
import { ToastProvider } from "./components/ToastProvider";
import { TooltipProvider } from "./components/ui/tooltip";
import "./styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <PreferencesProvider>
          <ToastProvider>
            <TooltipProvider delayDuration={150}>
              <BrowserRouter
                future={{
                  v7_relativeSplatPath: true,
                  v7_startTransition: true,
                }}
              >
                <App />
              </BrowserRouter>
            </TooltipProvider>
          </ToastProvider>
        </PreferencesProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
