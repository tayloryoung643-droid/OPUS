export const CONFIG = {
  DEMO_MODE: import.meta.env.VITE_DEMO_MODE === "true" || new URLSearchParams(window.location.search).get("demo") === "1",
  USE_MOCKS: false, // Default OFF - no mock data in production
};