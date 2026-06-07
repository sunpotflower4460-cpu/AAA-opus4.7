import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";
import "./phase19.css";
import "./phase21.css";
import "./phase22.css";
import "./phase23.css";
import "./phase24.css";
import "./phase25.css";
import "./phase27.css";
import "./phase28.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error('Root element #root not found in index.html. Ensure the HTML template includes <div id="root"></div>.');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
