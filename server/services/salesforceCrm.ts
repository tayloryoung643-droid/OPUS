import { storage } from '../storage';
import { salesforceAuth } from './salesforceAuth';

interface SalesforceRecord {
  Id: string;
  [key: string]: any;
}

interface Lead extends SalesforceRecord {
  FirstName?: string;
  LastName: string;
  Company: string;
  Email?: string;
  Phone?: string;
  Status: string;
  CreatedDate: string;
  LeadSource?: string;
}

interface Contact extends SalesforceRecord {
  FirstName?: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  Account?: {
    Name: string;
  };
  CreatedDate: string;
  Title?: string;
}

interface Opportunity extends SalesforceRecord {
  Name: string;
  Amount?: number;
  StageName: string;
  CloseDate: string;
  CreatedDate: string;
  Account?: {
    Name: string;
  };
  Probability?: number;
  Type?: string;
}

class SalesforceCrmService {
  private async makeAuthenticatedRequest(userId: string, endpoint: string): Promise<any> {
    // Get the user's Salesforce integration
    const integration = await storage.getSalesforceIntegration(userId);
    if (!integration) {
      throw new Error('Salesforce integration not found for user');
    }

    if (!integration.instanceUrl || !integration.accessToken) {
      throw new Error('Salesforce integration not properly configured');
    }

    try {
      const response = await fetch(`${integration.instanceUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.status === 401) {
        // Token expired, try to refresh
        if (!integration.refreshToken) {
          throw new Error('Access token expired and no refresh token available');
        }

        console.log('Access token expired, refreshing...');
        const refreshedTokens = await salesforceAuth.refreshTokens(
          integration.refreshToken,
          integration.instanceUrl
        );

        // Update the tokens in storage
        await storage.updateSalesforceIntegration(userId, {
          accessToken: refreshedTokens.access_token,
          tokenExpiry: refreshedTokens.token_expiry
        });

        // Retry the request with new token
        const retryResponse = await fetch(`${integration.instanceUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${refreshedTokens.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!retryResponse.ok) {
          throw new Error(`Salesforce API error after token refresh: ${retryResponse.status} ${retryResponse.statusText}`);
        }

        return retryResponse.json();
      }

      if (!response.ok) {
        throw new Error(`Salesforce API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error making authenticated Salesforce request:', error);
      throw error;
    }
  }

  async getLeads(userId: string, limit: number = 50): Promise<Lead[]> {
    try {
      const soqlQuery = `SELECT Id, FirstName, LastName, Company, Email, Phone, Status, CreatedDate, LeadSource FROM Lead ORDER BY CreatedDate DESC LIMIT ${limit}`;
      const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(soqlQuery)}`;
      
      const result = await this.makeAuthenticatedRequest(userId, endpoint);
      return result.records || [];
    } catch (error) {
      console.error('Error fetching Salesforce leads:', error);
      throw new Error('Failed to fetch leads from Salesforce');
    }
  }

  async getContacts(userId: string, limit: number = 50): Promise<Contact[]> {
    try {
      const soqlQuery = `SELECT Id, FirstName, LastName, Email, Phone, Account.Name, CreatedDate, Title FROM Contact ORDER BY CreatedDate DESC LIMIT ${limit}`;
      const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(soqlQuery)}`;
      
      const result = await this.makeAuthenticatedRequest(userId, endpoint);
      return result.records || [];
    } catch (error) {
      console.error('Error fetching Salesforce contacts:', error);
      throw new Error('Failed to fetch contacts from Salesforce');
    }
  }

  async getOpportunities(userId: string, limit: number = 50): Promise<Opportunity[]> {
    try {
      const soqlQuery = `SELECT Id, Name, Amount, StageName, CloseDate, CreatedDate, Account.Name, Probability, Type FROM Opportunity ORDER BY CreatedDate DESC LIMIT ${limit}`;
      const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(soqlQuery)}`;
      
      const result = await this.makeAuthenticatedRequest(userId, endpoint);
      return result.records || [];
    } catch (error) {
      console.error('Error fetching Salesforce opportunities:', error);
      throw new Error('Failed to fetch opportunities from Salesforce');
    }
  }

  async getAccountById(userId: string, accountId: string): Promise<any> {
    try {
      const endpoint = `/services/data/v59.0/sobjects/Account/${accountId}`;
      return await this.makeAuthenticatedRequest(userId, endpoint);
    } catch (error) {
      console.error('Error fetching Salesforce account:', error);
      throw new Error('Failed to fetch account from Salesforce');
    }
  }

  async searchRecords(userId: string, searchTerm: string, objectTypes: string[] = ['Account', 'Contact', 'Lead']): Promise<any> {
    try {
      const objectList = objectTypes.join(', ');
      const searchQuery = `FIND {${searchTerm}} IN ALL FIELDS RETURNING ${objectList}`;
      const endpoint = `/services/data/v59.0/search/?q=${encodeURIComponent(searchQuery)}`;
      
      const result = await this.makeAuthenticatedRequest(userId, endpoint);
      return result.searchRecords || [];
    } catch (error) {
      console.error('Error searching Salesforce records:', error);
      throw new Error('Failed to search Salesforce records');
    }
  }
}

export const salesforceCrmService = new SalesforceCrmService();