import { BaseIntegrationService, IntegrationConfig, OAuthCredentials, SyncResult } from "./base";
import { storage } from "../../storage";
import { InsertCompany, InsertContact, InsertCall, InsertCrmOpportunity } from "@shared/schema";

interface SalesforceAccount {
  Id: string;
  Name: string;
  Website?: string;
  Industry?: string;
  NumberOfEmployees?: number;
  Description?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingCountry?: string;
  LastModifiedDate: string;
}

interface SalesforceContact {
  Id: string;
  AccountId?: string;
  Email?: string;
  FirstName?: string;
  LastName?: string;
  Title?: string;
  Department?: string;
  LinkedInUrl?: string;
  LastModifiedDate: string;
}

interface SalesforceOpportunity {
  Id: string;
  AccountId: string;
  Name: string;
  StageName: string;
  Amount?: number;
  CloseDate: string;
  Description?: string;
  NextStep?: string;
  LastModifiedDate: string;
}

interface SalesforceEvent {
  Id: string;
  Subject: string;
  StartDateTime: string;
  EndDateTime?: string;
  WhoId?: string; // Contact ID
  WhatId?: string; // Account/Opportunity ID
  Description?: string;
  Type?: string;
  IsAllDayEvent: boolean;
  LastModifiedDate: string;
}

export class SalesforceService extends BaseIntegrationService {
  private baseUrl: string;
  private apiVersion: string = 'v59.0';

  constructor(config: IntegrationConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://login.salesforce.com';
  }

  generateAuthUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId || '',
      redirect_uri: this.config.redirectUri || '',
      scope: this.config.scopes?.join(' ') || 'full refresh_token',
      state: this.generateState()
    });

    return `${this.baseUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthCredentials> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId || '',
      client_secret: this.config.clientSecret || '',
      redirect_uri: this.config.redirectUri || '',
      code: code
    });

    const response = await fetch(`${this.baseUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    
    // Update baseUrl to use instance URL for API calls
    this.baseUrl = tokenData.instance_url;

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined,
      scope: tokenData.scope,
      tokenType: 'Bearer'
    };
  }

  async refreshAccessToken(): Promise<OAuthCredentials> {
    if (!this.credentials?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId || '',
      client_secret: this.config.clientSecret || '',
      refresh_token: this.credentials.refreshToken
    });

    const response = await fetch(`${this.baseUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce token refresh failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();

    const newCredentials: OAuthCredentials = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || this.credentials.refreshToken,
      expiresAt: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined,
      scope: tokenData.scope
    };

    this.setCredentials(newCredentials);
    return newCredentials;
  }

  async syncCompanies(): Promise<SyncResult> {
    try {
      const query = `SELECT Id, Name, Website, Industry, NumberOfEmployees, Description, BillingCity, BillingState, BillingCountry, LastModifiedDate FROM Account WHERE LastModifiedDate >= LAST_N_DAYS:30 ORDER BY LastModifiedDate DESC LIMIT 100`;
      
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/services/data/${this.apiVersion}/query/?q=${encodeURIComponent(query)}`
      );

      const data = await response.json();
      const accounts: SalesforceAccount[] = data.records || [];

      let recordsCreated = 0;
      let recordsUpdated = 0;
      const errors: string[] = [];

      // Prefetch integration data to avoid N+1 queries
      const existingCompanyData = await storage.getIntegrationData(
        this.integration?.id || '',
        'company'
      );
      const companyDataMap = new Map(existingCompanyData.map(d => [d.externalId, d]));

      for (const account of accounts) {
        try {
          const existingCompany = companyDataMap.get(account.Id);

          const companyData: InsertCompany = {
            name: account.Name,
            domain: this.extractDomainFromWebsite(account.Website),
            industry: account.Industry || undefined,
            size: this.mapEmployeeCountToSize(account.NumberOfEmployees),
            description: account.Description || undefined
          };

          if (existingCompany) {
            // Update existing company
            await storage.updateCompany(existingCompany.localId || '', companyData);
            recordsUpdated++;
          } else {
            // Create new company
            const company = await storage.createCompany(companyData);
            
            // Store integration data mapping
            await storage.createIntegrationData({
              integrationId: this.integration?.id || '',
              externalId: account.Id,
              dataType: 'company',
              data: account as Record<string, any>,
              localId: company.id
            });
            
            recordsCreated++;
          }
        } catch (error) {
          errors.push(`Failed to sync account ${account.Name}: ${(error as Error).message}`);
        }
      }

      return {
        success: errors.length === 0,
        recordsCreated,
        recordsUpdated,
        errors
      };
    } catch (error) {
      return {
        success: false,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [`Salesforce company sync failed: ${(error as Error).message}`]
      };
    }
  }

  async syncContacts(): Promise<SyncResult> {
    try {
      const query = `SELECT Id, AccountId, Email, FirstName, LastName, Title, Department, LastModifiedDate FROM Contact WHERE LastModifiedDate >= LAST_N_DAYS:30 ORDER BY LastModifiedDate DESC LIMIT 200`;
      
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/services/data/${this.apiVersion}/query/?q=${encodeURIComponent(query)}`
      );

      const data = await response.json();
      const contacts: SalesforceContact[] = data.records || [];

      let recordsCreated = 0;
      let recordsUpdated = 0;
      const errors: string[] = [];

      // Prefetch integration data to avoid N+1 queries
      const [existingContactData, existingCompanyData] = await Promise.all([
        storage.getIntegrationData(this.integration?.id || '', 'contact'),
        storage.getIntegrationData(this.integration?.id || '', 'company')
      ]);
      
      const contactDataMap = new Map(existingContactData.map(d => [d.externalId, d]));
      const companyDataMap = new Map(existingCompanyData.map(d => [d.externalId, d]));

      for (const contact of contacts) {
        try {
          if (!contact.Email) continue; // Skip contacts without email

          // Find the local company ID from prefetched data
          let localCompanyId: string | undefined;
          if (contact.AccountId) {
            const companyMapping = companyDataMap.get(contact.AccountId);
            localCompanyId = companyMapping?.localId || undefined;
          }

          const existingContact = contactDataMap.get(contact.Id);

          const contactData: InsertContact = {
            companyId: localCompanyId,
            email: contact.Email,
            firstName: contact.FirstName || undefined,
            lastName: contact.LastName || undefined,
            title: contact.Title || undefined,
            role: contact.Department || 'Stakeholder',
            linkedin: undefined // LinkedIn not available in standard Contact fields
          };

          if (existingContact) {
            // Update existing contact
            await storage.updateContact(existingContact.localId || '', contactData);
            recordsUpdated++;
          } else {
            // Create new contact
            const newContact = await storage.createContact(contactData);
            
            // Store integration data mapping
            await storage.createIntegrationData({
              integrationId: this.integration?.id || '',
              externalId: contact.Id,
              dataType: 'contact',
              data: contact as Record<string, any>,
              localId: newContact.id
            });
            
            recordsCreated++;
          }
        } catch (error) {
          errors.push(`Failed to sync contact ${contact.Email}: ${(error as Error).message}`);
        }
      }

      return {
        success: errors.length === 0,
        recordsCreated,
        recordsUpdated,
        errors
      };
    } catch (error) {
      return {
        success: false,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [`Salesforce contact sync failed: ${(error as Error).message}`]
      };
    }
  }

  async syncOpportunities(): Promise<SyncResult> {
    try {
      const query = `SELECT Id, AccountId, Name, StageName, Amount, CloseDate, Description, NextStep, LastModifiedDate FROM Opportunity WHERE LastModifiedDate >= LAST_N_DAYS:30 ORDER BY LastModifiedDate DESC LIMIT 100`;
      
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/services/data/${this.apiVersion}/query/?q=${encodeURIComponent(query)}`
      );

      const data = await response.json();
      const opportunities: SalesforceOpportunity[] = data.records || [];

      let recordsCreated = 0;
      let recordsUpdated = 0;
      const errors: string[] = [];

      // Prefetch integration data to avoid N+1 queries
      const [existingOpportunityData, existingCompanyData] = await Promise.all([
        storage.getIntegrationData(this.integration?.id || '', 'opportunity'),
        storage.getIntegrationData(this.integration?.id || '', 'company')
      ]);
      
      const opportunityDataMap = new Map(existingOpportunityData.map(d => [d.externalId, d]));
      const companyDataMap = new Map(existingCompanyData.map(d => [d.externalId, d]));

      for (const opportunity of opportunities) {
        try {
          // Find the local company ID
          const companyMapping = companyDataMap.get(opportunity.AccountId);
          const localCompanyId = companyMapping?.localId;

          if (!localCompanyId) continue; // Skip opportunities without associated company

          const existingOpportunity = opportunityDataMap.get(opportunity.Id);

          const opportunityData: InsertCrmOpportunity = {
            companyId: localCompanyId,
            name: opportunity.Name,
            stage: opportunity.StageName,
            amount: opportunity.Amount ? opportunity.Amount.toString() : undefined,
            closeDate: opportunity.CloseDate ? opportunity.CloseDate : undefined,
            description: opportunity.Description || undefined,
            nextStep: opportunity.NextStep || undefined
          };

          if (existingOpportunity && existingOpportunity.localId) {
            // Update existing opportunity
            await storage.updateOpportunity(existingOpportunity.localId, opportunityData);
            
            // Update integration data mapping
            await storage.updateIntegrationData(existingOpportunity.id, {
              data: opportunity as Record<string, any>,
              lastSyncAt: new Date()
            });
            recordsUpdated++;
          } else {
            // Create new opportunity
            const newOpportunity = await storage.createOpportunity(opportunityData);
            
            // Store integration data mapping
            await storage.createIntegrationData({
              integrationId: this.integration?.id || '',
              externalId: opportunity.Id,
              dataType: 'opportunity',
              data: opportunity as Record<string, any>,
              localId: newOpportunity.id
            });
            recordsCreated++;
          }
        } catch (error) {
          errors.push(`Failed to sync opportunity ${opportunity.Name}: ${(error as Error).message}`);
        }
      }

      return {
        success: errors.length === 0,
        recordsCreated,
        recordsUpdated,
        errors
      };
    } catch (error) {
      return {
        success: false,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [`Salesforce opportunity sync failed: ${(error as Error).message}`]
      };
    }
  }

  async syncMeetings(): Promise<SyncResult> {
    try {
      // Query for Events (meetings) in Salesforce
      const query = `SELECT Id, Subject, StartDateTime, EndDateTime, WhoId, WhatId, Description, Type, IsAllDayEvent, LastModifiedDate FROM Event WHERE StartDateTime >= LAST_N_DAYS:30 AND StartDateTime <= NEXT_N_DAYS:90 ORDER BY StartDateTime ASC LIMIT 100`;
      
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/services/data/${this.apiVersion}/query/?q=${encodeURIComponent(query)}`
      );

      const data = await response.json();
      const events: SalesforceEvent[] = data.records || [];

      let recordsCreated = 0;
      let recordsUpdated = 0;
      const errors: string[] = [];

      // Prefetch integration data to avoid N+1 queries
      const [existingCallData, existingCompanyData, existingOpportunityData] = await Promise.all([
        storage.getIntegrationData(this.integration?.id || '', 'call'),
        storage.getIntegrationData(this.integration?.id || '', 'company'),
        storage.getIntegrationData(this.integration?.id || '', 'opportunity')
      ]);
      
      const callDataMap = new Map(existingCallData.map(d => [d.externalId, d]));
      const companyDataMap = new Map(existingCompanyData.map(d => [d.externalId, d]));
      const opportunityDataMap = new Map(existingOpportunityData.map(d => [d.externalId, d]));

      for (const event of events) {
        try {
          // Find the local company ID from prefetched data
          let localCompanyId: string | undefined;
          
          if (event.WhatId) {
            // First try direct Account mapping
            const companyMapping = companyDataMap.get(event.WhatId);
            if (companyMapping) {
              localCompanyId = companyMapping.localId;
            } else {
              // Try Opportunity mapping and get AccountId
              const opportunityMapping = opportunityDataMap.get(event.WhatId);
              if (opportunityMapping && opportunityMapping.data) {
                const opportunityData = opportunityMapping.data as SalesforceOpportunity;
                if (opportunityData.AccountId) {
                  const accountMapping = companyDataMap.get(opportunityData.AccountId);
                  localCompanyId = accountMapping?.localId;
                }
              }
            }
          }

          if (!localCompanyId) continue; // Skip events without company association

          const existingCall = callDataMap.get(event.Id);

          const callData: InsertCall = {
            companyId: localCompanyId,
            title: event.Subject || 'Salesforce Meeting',
            scheduledAt: new Date(event.StartDateTime),
            status: new Date(event.StartDateTime) > new Date() ? 'upcoming' : 'completed',
            callType: this.mapEventTypeToCallType(event.Type),
            stage: 'initial_discovery'
          };

          if (existingCall) {
            // Update existing call
            await storage.updateCall(existingCall.localId || '', callData);
            recordsUpdated++;
          } else {
            // Create new call
            const newCall = await storage.createCall(callData);
            
            // Store integration data mapping
            await storage.createIntegrationData({
              integrationId: this.integration?.id || '',
              externalId: event.Id,
              dataType: 'call',
              data: event as Record<string, any>,
              localId: newCall.id
            });
            
            recordsCreated++;
          }
        } catch (error) {
          errors.push(`Failed to sync event ${event.Subject}: ${(error as Error).message}`);
        }
      }

      return {
        success: errors.length === 0,
        recordsCreated,
        recordsUpdated,
        errors
      };
    } catch (error) {
      return {
        success: false,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [`Salesforce meeting sync failed: ${(error as Error).message}`]
      };
    }
  }

  protected async performHealthCheck(): Promise<void> {
    // Test Salesforce API connection
    const response = await this.makeAuthenticatedRequest(
      `${this.baseUrl}/services/data/${this.apiVersion}/sobjects/Account/describe`
    );

    if (!response.ok) {
      throw new Error(`Salesforce health check failed: ${response.status}`);
    }
  }

  // Helper methods for data mapping
  private extractDomainFromWebsite(website?: string): string | undefined {
    if (!website) return undefined;
    
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }

  private mapEmployeeCountToSize(employeeCount?: number): string {
    if (!employeeCount) return 'Unknown';
    
    if (employeeCount < 10) return 'Startup';
    if (employeeCount < 50) return 'Small';
    if (employeeCount < 200) return 'SMB';
    if (employeeCount < 1000) return 'Mid-market';
    return 'Enterprise';
  }

  private mapEventTypeToCallType(eventType?: string): string {
    if (!eventType) return 'discovery';
    
    const type = eventType.toLowerCase();
    if (type.includes('demo')) return 'demo';
    if (type.includes('discovery')) return 'discovery';
    if (type.includes('negotiation')) return 'negotiation';
    if (type.includes('follow')) return 'follow-up';
    
    return 'discovery';
  }
}