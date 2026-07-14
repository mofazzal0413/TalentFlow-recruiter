import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { WorkflowProvider } from "./context/WorkflowContext";
import "./index.css";
import "./styles/animations.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <WorkflowProvider>
        <App />
      </WorkflowProvider>
    </BrowserRouter>
  </StrictMode>,
);
