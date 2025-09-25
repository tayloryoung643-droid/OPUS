import { BaseIntegrationService, IntegrationConfig, OAuthCredentials, SyncResult } from "./base";
import { OAuthHandler, OAuthConfig } from "./oauth";
import { storage } from "../../storage";
import { Integration, InsertIntegration } from "@shared/schema";
import { CryptoService } from "../crypto";
import { SalesforceService } from "./salesforce";

export class IntegrationManager {
  private services: Map<string, BaseIntegrationService> = new Map();
  private oauthHandlers: Map<string, OAuthHandler> = new Map();
  private stateToIntegration: Map<string, string> = new Map(); // state -> integrationId mapping

  async createIntegration(
    name: string,
    type: string,
    config: IntegrationConfig
  ): Promise<Integration> {
    const insertData: InsertIntegration = {
      name,
      type,
      status: "inactive",
      config: config as Record<string, any>,
      credentials: {}
    };

    return await storage.createIntegration(insertData);
  }

  async updateIntegrationCredentials(
    integrationId: string,
    credentials: OAuthCredentials
  ): Promise<Integration> {
    // Encrypt credentials before storing
    const encryptedCredentials = CryptoService.encryptCredentials(credentials);
    
    return await storage.updateIntegration(integrationId, {
      credentials: encryptedCredentials,
      status: "active",
      lastSyncAt: new Date()
    });
  }

  async getIntegration(id: string): Promise<Integration | undefined> {
    return await storage.getIntegration(id);
  }

  async getAllIntegrations(): Promise<Integration[]> {
    return await storage.getAllIntegrations();
  }

  async deleteIntegration(id: string): Promise<void> {
    // Clean up any stored services and handlers
    this.services.delete(id);
    this.oauthHandlers.delete(id);
    
    await storage.deleteIntegration(id);
  }

  async getActiveIntegrationsByType(type: string): Promise<Integration[]> {
    const allIntegrations = await this.getAllIntegrations();
    return allIntegrations.filter(
      integration => integration.type === type && integration.status === "active"
    );
  }

  async initiateOAuthFlow(integrationId: string): Promise<{ authUrl: string }> {
    const integration = await storage.getIntegration(integrationId);
    if (!integration) {
      throw new Error("Integration not found");
    }

    const oauthConfig = this.buildOAuthConfig(integration);
    const oauthHandler = new OAuthHandler(oauthConfig);
    
    // Store handler for later use
    this.oauthHandlers.set(integrationId, oauthHandler);
    
    const authUrl = oauthHandler.generateAuthorizationUrl(integrationId);
    
    return { authUrl };
  }

  async completeOAuthFlow(code: string, state: string): Promise<Integration> {
    // Try to find the matching OAuth handler that can handle this state
    let oauthHandler: OAuthHandler | undefined;
    let integrationId: string | undefined;
    let exchangeResult: { tokens: OAuthCredentials; integrationId: string } | undefined;

    // Try each handler until we find one that can handle this state
    for (const [id, handler] of this.oauthHandlers.entries()) {
      try {
        exchangeResult = await handler.exchangeCodeForTokens(code, state);
        oauthHandler = handler;
        integrationId = exchangeResult.integrationId;
        break;
      } catch (error) {
        // This handler doesn't own this state, continue trying others
        continue;
      }
    }

    if (!oauthHandler || !exchangeResult || !integrationId) {
      throw new Error("Invalid OAuth callback - no matching handler found for this state");
    }
    
    // Update integration with credentials
    const updatedIntegration = await this.updateIntegrationCredentials(integrationId, exchangeResult.tokens);
    
    // Clean up OAuth handler
    this.oauthHandlers.delete(integrationId);
    
    return updatedIntegration;
  }

  async syncIntegration(integrationId: string): Promise<SyncResult> {
    const integration = await storage.getIntegration(integrationId);
    if (!integration) {
      throw new Error("Integration not found");
    }

    if (integration.status !== "active") {
      throw new Error("Integration is not active");
    }

    const service = this.getOrCreateService(integration);
    
    try {
      // Test connection first
      const isHealthy = await service.testConnection();
      if (!isHealthy) {
        await storage.updateIntegration(integrationId, {
          status: "error",
          errorMessage: "Connection test failed"
        });
        throw new Error("Integration connection test failed");
      }

      // Perform sync based on integration type
      let result: SyncResult;
      switch (integration.type) {
        case "crm":
          result = await this.syncCrmData(service);
          break;
        case "calendar":
          result = await this.syncCalendarData(service);
          break;
        case "email":
          result = await this.syncEmailData(service);
          break;
        default:
          throw new Error(`Unsupported integration type: ${integration.type}`);
      }

      // Update integration status
      await storage.updateIntegration(integrationId, {
        status: "active",
        lastSyncAt: new Date(),
        errorMessage: null
      });

      return result;
    } catch (error) {
      await storage.updateIntegration(integrationId, {
        status: "error",
        errorMessage: (error as Error).message
      });
      throw error;
    }
  }

  private async syncCrmData(service: BaseIntegrationService): Promise<SyncResult> {
    const results: SyncResult[] = [];
    
    // Sync companies and contacts first
    results.push(await service.syncCompanies());
    results.push(await service.syncContacts());
    
    // Sync opportunities if available (for Salesforce)
    if ((service as any).syncOpportunities) {
      results.push(await (service as any).syncOpportunities());
    }
    
    // Sync meetings last (depends on companies and opportunities)
    results.push(await service.syncMeetings());

    return {
      success: results.every(r => r.success),
      recordsUpdated: results.reduce((sum, r) => sum + r.recordsUpdated, 0),
      recordsCreated: results.reduce((sum, r) => sum + r.recordsCreated, 0),
      errors: results.flatMap(r => r.errors)
    };
  }

  private async syncCalendarData(service: BaseIntegrationService): Promise<SyncResult> {
    return await service.syncMeetings();
  }

  private async syncEmailData(service: BaseIntegrationService): Promise<SyncResult> {
    // Email sync would be implemented based on specific service
    return {
      success: true,
      recordsUpdated: 0,
      recordsCreated: 0,
      errors: []
    };
  }

  private getOrCreateService(integration: Integration): BaseIntegrationService {
    let service = this.services.get(integration.id);
    
    if (!service) {
      service = this.createServiceForIntegration(integration);
      if (service) {
        this.services.set(integration.id, service);
      }
    }

    if (!service) {
      throw new Error(`No service implementation for integration type: ${integration.type}`);
    }

    service.setIntegration(integration);
    
    // Decrypt credentials for use
    const decryptedCredentials = CryptoService.decryptCredentials(integration.credentials as Record<string, any>);
    service.setCredentials(decryptedCredentials as OAuthCredentials);
    
    return service;
  }

  private createServiceForIntegration(integration: Integration): BaseIntegrationService | undefined {
    // Match by type and provider pattern, not exact name
    if (integration.type === 'crm') {
      if (integration.name.toLowerCase().includes('salesforce') || 
          integration.config?.provider === 'salesforce') {
        return new SalesforceService(integration.config as IntegrationConfig);
      }
      if (integration.name.toLowerCase().includes('hubspot') || 
          integration.config?.provider === 'hubspot') {
        return new StubCrmService(integration.config as IntegrationConfig);
      }
    }
    
    if (integration.type === 'calendar') {
      if (integration.name.toLowerCase().includes('google') || 
          integration.config?.provider === 'google') {
        return new StubCalendarService(integration.config as IntegrationConfig);
      }
      if (integration.name.toLowerCase().includes('outlook') || 
          integration.config?.provider === 'outlook') {
        return new StubCalendarService(integration.config as IntegrationConfig);
      }
    }
    
    console.warn(`No service implementation for integration: ${integration.name} (type: ${integration.type})`);
    return undefined;
  }

  private buildOAuthConfig(integration: Integration): OAuthConfig {
    const config = integration.config || {};
    
    // Base configurations for known providers
    const providerConfigs: Record<string, Partial<OAuthConfig>> = {
      salesforce: {
        authorizationUrl: "https://login.salesforce.com/services/oauth2/authorize",
        tokenUrl: "https://login.salesforce.com/services/oauth2/token",
        scopes: ["full", "refresh_token"]
      },
      hubspot: {
        authorizationUrl: "https://app.hubspot.com/oauth/authorize",
        tokenUrl: "https://api.hubapi.com/oauth/v1/token",
        scopes: ["contacts", "companies", "deals", "timeline"]
      },
      google_calendar: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"]
      },
      outlook: {
        authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        scopes: ["https://graph.microsoft.com/calendars.read", "https://graph.microsoft.com/mail.read"]
      }
    };

    const baseConfig = providerConfigs[integration.name] || {};
    
    return {
      clientId: config.clientId || process.env[`${integration.name.toUpperCase()}_CLIENT_ID`] || "",
      clientSecret: config.clientSecret || process.env[`${integration.name.toUpperCase()}_CLIENT_SECRET`] || "",
      redirectUri: config.redirectUri || `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/api/integrations/oauth/callback`,
      authorizationUrl: baseConfig.authorizationUrl || "",
      tokenUrl: baseConfig.tokenUrl || "",
      scopes: baseConfig.scopes || []
    };
  }
}

// Stub service implementations for testing
class StubCrmService extends BaseIntegrationService {
  generateAuthUrl(): string {
    return "https://example.com/oauth/authorize";
  }
  
  async exchangeCodeForTokens(code: string): Promise<OAuthCredentials> {
    return { accessToken: "stub-token", refreshToken: "stub-refresh" };
  }
  
  async refreshAccessToken(): Promise<OAuthCredentials> {
    return { accessToken: "refreshed-stub-token", refreshToken: "stub-refresh" };
  }
  
  async syncCompanies(): Promise<SyncResult> {
    return { success: true, recordsUpdated: 0, recordsCreated: 0, errors: [] };
  }
  
  async syncContacts(): Promise<SyncResult> {
    return { success: true, recordsUpdated: 0, recordsCreated: 0, errors: [] };
  }
  
  async syncMeetings(): Promise<SyncResult> {
    return { success: true, recordsUpdated: 0, recordsCreated: 0, errors: [] };
  }
  
  protected async performHealthCheck(): Promise<void> {
    // Stub health check
    return Promise.resolve();
  }
}

class StubCalendarService extends BaseIntegrationService {
  generateAuthUrl(): string {
    return "https://example.com/oauth/authorize";
  }
  
  async exchangeCodeForTokens(code: string): Promise<OAuthCredentials> {
    return { accessToken: "stub-token", refreshToken: "stub-refresh" };
  }
  
  async refreshAccessToken(): Promise<OAuthCredentials> {
    return { accessToken: "refreshed-stub-token", refreshToken: "stub-refresh" };
  }
  
  async syncCompanies(): Promise<SyncResult> {
    return { success: true, recordsUpdated: 0, recordsCreated: 0, errors: [] };
  }
  
  async syncContacts(): Promise<SyncResult> {
    return { success: true, recordsUpdated: 0, recordsCreated: 0, errors: [] };
  }
  
  async syncMeetings(): Promise<SyncResult> {
    return { success: true, recordsUpdated: 0, recordsCreated: 0, errors: [] };
  }
  
  protected async performHealthCheck(): Promise<void> {
    // Stub health check
    return Promise.resolve();
  }
}

export const integrationManager = new IntegrationManager();