export const CONFIG = {
  DEMO_MODE: import.meta.env.VITE_DEMO_MODE === "true" || new URLSearchParams(window.location.search).get("demo") === "1",
  USE_MOCKS: import.meta.env.VITE_USE_MOCKS === "true",
};