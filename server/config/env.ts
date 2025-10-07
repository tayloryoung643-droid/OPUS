/**
 * Centralized environment variable configuration for Opus
 * Provides consistent domain and origin handling across all services
 */

export interface EnvConfig {
  // Core application domains
  APP_ORIGIN: string;
  API_ORIGIN: string;
  
  // Legacy fallbacks for compatibility
  REPLIT_DOMAIN: string;
  
  // Authentication
  SESSION_SECRET: string;
  OPUS_JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  
  // OAuth credentials
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SALESFORCE_CLIENT_ID?: string;
  SALESFORCE_CLIENT_SECRET?: string;
  
  // Database
  DATABASE_URL: string;
  
  // Feature flags
  NODE_ENV: string;
  USE_MOCKS: boolean;
  DEMO_MODE: boolean;

  // MCP Remote Service
  MCP_REMOTE_ENABLED: boolean;
  MCP_BASE_URL: string;
  MCP_SERVICE_TOKEN: string;
  MCP_TOKEN_PROVIDER_SECRET: string;
  
  // Dev impersonation
  APP_DEV_BYPASS: boolean;
}

/**
 * Resolve the application origin (where the web app is hosted)
 */
function resolveAppOrigin(): string {
  // Explicit APP_ORIGIN takes precedence
  if (process.env.APP_ORIGIN?.trim()) {
    return process.env.APP_ORIGIN.trim();
  }
  
  // For production, require explicit configuration
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_ORIGIN environment variable is required for production deployment');
  }
  
  // Development fallback
  return 'http://localhost:5000';
}

/**
 * Resolve the API origin (where the API is hosted)
 */
function resolveApiOrigin(): string {
  // Explicit API_ORIGIN takes precedence
  if (process.env.API_ORIGIN?.trim()) {
    return process.env.API_ORIGIN.trim();
  }
  
  // For production, require explicit configuration
  if (process.env.NODE_ENV === 'production') {
    throw new Error('API_ORIGIN environment variable is required for production deployment');
  }
  
  // Development fallback
  return 'http://localhost:5000';
}

/**
 * Resolve legacy REPLIT_DOMAIN for backward compatibility
 */
function resolveReplitDomain(): string {
  const appOrigin = resolveAppOrigin();
  
  // Extract domain from APP_ORIGIN URL
  try {
    const url = new URL(appOrigin);
    return url.host; // includes port if present
  } catch (error) {
    console.warn('Invalid APP_ORIGIN URL, falling back to localhost:5000');
    return 'localhost:5000';
  }
}

/**
 * Validate required environment variables
 */
function validateRequiredEnvVars(): void {
  const required = [
    'SESSION_SECRET',
    'OPUS_JWT_SECRET', 
    'DATABASE_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Get consolidated environment configuration
 */
export function getEnvConfig(): EnvConfig {
  validateRequiredEnvVars();
  
  return {
    APP_ORIGIN: resolveAppOrigin(),
    API_ORIGIN: resolveApiOrigin(),
    REPLIT_DOMAIN: resolveReplitDomain(),
    
    SESSION_SECRET: process.env.SESSION_SECRET!,
    OPUS_JWT_SECRET: process.env.OPUS_JWT_SECRET!,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production-32-chars',
    
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.trim(),
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET?.trim(),
    SALESFORCE_CLIENT_ID: process.env.SALESFORCE_CLIENT_ID?.trim(),
    SALESFORCE_CLIENT_SECRET: process.env.SALESFORCE_CLIENT_SECRET?.trim(),
    
    DATABASE_URL: process.env.DATABASE_URL!,
    
    NODE_ENV: process.env.NODE_ENV || 'development',
    USE_MOCKS: process.env.USE_MOCKS === 'true',
    DEMO_MODE: process.env.DEMO_MODE === 'true',

    MCP_REMOTE_ENABLED: process.env.MCP_REMOTE_ENABLED === 'true',
    MCP_BASE_URL: process.env.MCP_BASE_URL || 'http://localhost:4000',
    MCP_SERVICE_TOKEN: process.env.MCP_SERVICE_TOKEN || ''
  };
}

// Export singleton instance
export const ENV = getEnvConfig();

/**
 * Helper functions for common URL construction
 */
export function getCallbackUrl(service: 'google' | 'salesforce'): string {
  return `${ENV.API_ORIGIN}/api/integrations/${service}/callback`;
}

export function getExtensionLoginUrl(): string {
  return `${ENV.APP_ORIGIN}/login?source=extension`;
}

export function getAllowedOrigins(): string[] {
  return [
    ENV.APP_ORIGIN,
    ENV.API_ORIGIN,
    // Add chrome-extension origins (will be configured per installation)
    'chrome-extension://*'
  ];
}