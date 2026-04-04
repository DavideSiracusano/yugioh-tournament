import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./components/yugioh-tournament.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
