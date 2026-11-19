import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./api-url.css";
import "./generate-button.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
