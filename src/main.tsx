import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Hide the initial splash screen once the app has mounted.
requestAnimationFrame(() => {
  const splash = document.getElementById("app-splash");
  if (splash) {
    splash.classList.add("is-hidden");
    setTimeout(() => splash.remove(), 500);
  }
});
