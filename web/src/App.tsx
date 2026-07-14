import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AgencyDashboardPage } from "./pages/AgencyDashboardPage";
import { WorkflowPage } from "./pages/WorkflowPage";

function AppRoutes() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="screen-transition">
      <Routes location={location}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<AgencyDashboardPage />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return <AppRoutes />;
}
