import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout";
import { ConsolePage } from "../pages/ConsolePage";
import { BucketsPage } from "../pages/BucketsPage";
import { BucketObjectsPage } from "../pages/BucketObjectsPage";
import { SettingsPage } from "../pages/SettingsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate replace to="/console" />} />
        <Route path="/console" element={<ConsolePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/buckets" element={<BucketsPage />} />
        <Route path="/buckets/:bucket" element={<BucketObjectsPage />} />
      </Route>
    </Routes>
  );
}
