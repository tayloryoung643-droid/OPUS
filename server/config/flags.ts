/**
 * Feature flags for controlling application behavior
 * These flags help control mock data, demo modes, and other toggleable features
 */

export const FLAGS = {
  // Mock data control - should be false in production
  USE_MOCKS: process.env.USE_MOCKS === "true",
  
  // Demo mode control - enables sample data displays
  DEMO_MODE: process.env.DEMO_MODE === "true",
  
  // Development flags
  DEBUG_MCP: process.env.DEBUG_MCP === "true",
  VERBOSE_LOGGING: process.env.NODE_ENV === "development" || process.env.VERBOSE_LOGGING === "true"
};

/**
 * Log current flag status for debugging
 */
export function logFlags() {
  if (FLAGS.VERBOSE_LOGGING) {
    console.log('[Config] Feature flags:', FLAGS);
  }
}

/**
 * Validate that production-safe flags are set correctly
 */
export function validateProductionFlags() {
  if (process.env.NODE_ENV === "production") {
    if (FLAGS.USE_MOCKS) {
      console.warn('[Config] WARNING: USE_MOCKS is enabled in production!');
    }
    if (FLAGS.DEMO_MODE) {
      console.warn('[Config] WARNING: DEMO_MODE is enabled in production!');
    }
  }
}