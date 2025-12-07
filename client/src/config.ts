// Check if we're in demo mode from localStorage or URL parameter
const isDemoMode = () => {
  if (typeof window === 'undefined') return false;

  // Check localStorage first
  const storedDemo = localStorage.getItem('opus_demo_mode');
  if (storedDemo === 'true') {
    console.log('Demo mode active from localStorage');
    return true;
  }

  // Check URL parameter
  const urlDemo = new URLSearchParams(window.location.search).get("demo");
  if (urlDemo === "1") {
    console.log('Demo mode active from URL');
    return true;
  }

  // Check environment variable
  if (import.meta.env.VITE_DEMO_MODE === "true") {
    console.log('Demo mode active from env');
    return true;
  }

  return false;
};

const demoMode = isDemoMode();
console.log('CONFIG initialized - Demo mode:', demoMode);

export const CONFIG = {
  DEMO_MODE: demoMode,
  USE_MOCKS: demoMode, // Enable mocks when in demo mode
};