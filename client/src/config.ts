// Check if we're in demo mode from localStorage or URL parameter
const isDemoMode = () => {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem('opus_demo_mode') === 'true' ||
    new URLSearchParams(window.location.search).get("demo") === "1" ||
    import.meta.env.VITE_DEMO_MODE === "true"
  );
};

export const CONFIG = {
  DEMO_MODE: isDemoMode(),
  USE_MOCKS: isDemoMode(), // Enable mocks when in demo mode
};