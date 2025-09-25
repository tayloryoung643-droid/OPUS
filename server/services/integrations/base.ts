import { Integration, InsertIntegration } from "@shared/schema";

export interface IntegrationConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  apiVersion?: string;
  baseUrl?: string;
}

export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export interface SyncResult {
  success: boolean;
  recordsUpdated: number;
  recordsCreated: number;
  errors: string[];
}

export abstract class BaseIntegrationService {
  protected config: IntegrationConfig;
  protected credentials: OAuthCredentials | null = null;
  protected integration: Integration | null = null;

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  // OAuth flow methods
  abstract generateAuthUrl(): string;
  abstract exchangeCodeForTokens(code: string): Promise<OAuthCredentials>;
  abstract refreshAccessToken(): Promise<OAuthCredentials>;

  // Data sync methods
  abstract syncCompanies(): Promise<SyncResult>;
  abstract syncContacts(): Promise<SyncResult>;
  abstract syncMeetings(): Promise<SyncResult>;

  // Credential management
  setCredentials(credentials: OAuthCredentials): void {
    this.credentials = credentials;
  }

  setIntegration(integration: Integration): void {
    this.integration = integration;
  }

  protected async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.credentials?.accessToken) {
      throw new Error("No access token available");
    }

    // Check if token is expired and refresh if needed
    if (this.credentials.expiresAt && new Date() >= this.credentials.expiresAt) {
      await this.refreshAccessToken();
    }

    const headers = {
      'Authorization': `Bearer ${this.credentials.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be invalid, try refreshing
        await this.refreshAccessToken();
        headers.Authorization = `Bearer ${this.credentials.accessToken}`;
        
        const retryResponse = await fetch(url, {
          ...options,
          headers,
        });
        
        if (!retryResponse.ok) {
          throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}`);
        }
        
        return retryResponse;
      }
      
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  protected generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  // Health check for integration
  async testConnection(): Promise<boolean> {
    try {
      if (!this.credentials?.accessToken) {
        return false;
      }
      
      // Each service will implement their own test endpoint
      await this.performHealthCheck();
      return true;
    } catch (error) {
      console.error('Integration health check failed:', error);
      return false;
    }
  }

  protected abstract performHealthCheck(): Promise<void>;
}

export interface IntegrationServiceFactory {
  createService(type: string, config: IntegrationConfig): BaseIntegrationService | null;
}