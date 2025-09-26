import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SalesforceService } from './salesforce';
import { storage } from '../../storage';
import { IntegrationConfig, OAuthCredentials } from './base';

// Mock storage methods
vi.mock('../../storage', () => ({
  storage: {
    getIntegrationData: vi.fn(),
    createCompany: vi.fn(),
    updateCompany: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    createCall: vi.fn(),
    updateCall: vi.fn(),
    createOpportunity: vi.fn(),
    updateOpportunity: vi.fn(),
    createIntegrationData: vi.fn(),
    updateIntegrationData: vi.fn(),
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('SalesforceService Integration Tests', () => {
  let salesforceService: SalesforceService;
  let mockConfig: IntegrationConfig;
  let mockCredentials: OAuthCredentials;

  beforeEach(() => {
    mockConfig = {
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['full', 'refresh_token'],
      baseUrl: 'https://test.salesforce.com'
    };

    mockCredentials = {
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
      expiresAt: new Date(Date.now() + 3600000),
      scope: 'full refresh_token'
    };

    salesforceService = new SalesforceService(mockConfig);
    salesforceService.setCredentials(mockCredentials);
    salesforceService.setIntegration({
      id: 'test-integration-id',
      name: 'Test Salesforce',
      type: 'crm',
      status: 'active',
      config: mockConfig as Record<string, any>,
      credentials: mockCredentials as Record<string, any>,
      lastSyncAt: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('syncCompanies', () => {
    it('should create new companies and store integration mappings', async () => {
      // Mock Salesforce API response
      const mockSalesforceAccounts = {
        records: [
          {
            Id: 'SF_ACCOUNT_1',
            Name: 'Acme Corp',
            Website: 'https://acme.com',
            Industry: 'Technology',
            NumberOfEmployees: 150,
            Description: 'Leading tech company',
            LastModifiedDate: '2024-01-01T10:00:00Z'
          },
          {
            Id: 'SF_ACCOUNT_2',
            Name: 'Beta Industries',
            Website: 'https://beta.com',
            Industry: 'Manufacturing',
            NumberOfEmployees: 50,
            Description: 'Manufacturing excellence',
            LastModifiedDate: '2024-01-01T11:00:00Z'
          }
        ]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSalesforceAccounts)
      });

      // Mock no existing integration data (new companies)
      (storage.getIntegrationData as any).mockResolvedValueOnce([]);

      // Mock company creation
      (storage.createCompany as any)
        .mockResolvedValueOnce({ id: 'local-company-1', name: 'Acme Corp' })
        .mockResolvedValueOnce({ id: 'local-company-2', name: 'Beta Industries' });

      // Mock integration data creation
      (storage.createIntegrationData as any).mockResolvedValue({ id: 'integration-data-id' });

      const result = await salesforceService.syncCompanies();

      // Verify API call
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/data/v59.0/query/'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_access_token'
          })
        })
      );

      // Verify prefetch to avoid N+1 queries
      expect(storage.getIntegrationData).toHaveBeenCalledWith('test-integration-id', 'company');

      // Verify companies were created with correct data
      expect(storage.createCompany).toHaveBeenCalledTimes(2);
      expect(storage.createCompany).toHaveBeenCalledWith({
        name: 'Acme Corp',
        domain: 'acme.com',
        industry: 'Technology',
        size: 'SMB',
        description: 'Leading tech company'
      });
      expect(storage.createCompany).toHaveBeenCalledWith({
        name: 'Beta Industries',
        domain: 'beta.com',
        industry: 'Manufacturing',
        size: 'SMB', // 50 employees maps to SMB in implementation
        description: 'Manufacturing excellence'
      });

      // Verify integration data mappings were created
      expect(storage.createIntegrationData).toHaveBeenCalledTimes(2);
      expect(storage.createIntegrationData).toHaveBeenCalledWith({
        integrationId: 'test-integration-id',
        externalId: 'SF_ACCOUNT_1',
        dataType: 'company',
        data: mockSalesforceAccounts.records[0],
        localId: 'local-company-1'
      });

      // Verify result
      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(2);
      expect(result.recordsUpdated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should update existing companies using prefetched data', async () => {
      const mockSalesforceAccounts = {
        records: [{
          Id: 'SF_ACCOUNT_1',
          Name: 'Acme Corp Updated',
          Website: 'https://acme-new.com',
          Industry: 'SaaS',
          NumberOfEmployees: 200,
          Description: 'Updated description',
          LastModifiedDate: '2024-01-02T10:00:00Z'
        }]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSalesforceAccounts)
      });

      // Mock existing integration data
      (storage.getIntegrationData as any).mockResolvedValueOnce([{
        externalId: 'SF_ACCOUNT_1',
        localId: 'local-company-1',
        dataType: 'company'
      }]);

      (storage.updateCompany as any).mockResolvedValueOnce({ id: 'local-company-1' });

      const result = await salesforceService.syncCompanies();

      // Verify update was called instead of create
      expect(storage.updateCompany).toHaveBeenCalledWith('local-company-1', {
        name: 'Acme Corp Updated',
        domain: 'acme-new.com',
        industry: 'SaaS',
        size: 'Mid-market',
        description: 'Updated description'
      });
      expect(storage.createCompany).not.toHaveBeenCalled();
      expect(storage.createIntegrationData).not.toHaveBeenCalled();

      expect(result.recordsUpdated).toBe(1);
      expect(result.recordsCreated).toBe(0);
    });
  });

  describe('syncContacts', () => {
    it('should create contacts with proper company linkage and integration mapping', async () => {
      const mockSalesforceContacts = {
        records: [
          {
            Id: 'SF_CONTACT_1',
            AccountId: 'SF_ACCOUNT_1',
            Email: 'john@acme.com',
            FirstName: 'John',
            LastName: 'Doe',
            Title: 'CEO',
            Department: 'Executive',
            LastModifiedDate: '2024-01-01T10:00:00Z'
          },
          {
            Id: 'SF_CONTACT_2',
            AccountId: 'SF_ACCOUNT_2',
            Email: 'jane@beta.com',
            FirstName: 'Jane',
            LastName: 'Smith',
            Title: 'CTO',
            Department: 'Technology',
            LastModifiedDate: '2024-01-01T11:00:00Z'
          }
        ]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSalesforceContacts)
      });

      // Mock prefetched integration data
      (storage.getIntegrationData as any)
        .mockResolvedValueOnce([]) // No existing contacts
        .mockResolvedValueOnce([ // Existing company mappings
          { externalId: 'SF_ACCOUNT_1', localId: 'local-company-1', dataType: 'company' },
          { externalId: 'SF_ACCOUNT_2', localId: 'local-company-2', dataType: 'company' }
        ]);

      (storage.createContact as any)
        .mockResolvedValueOnce({ id: 'local-contact-1' })
        .mockResolvedValueOnce({ id: 'local-contact-2' });

      const result = await salesforceService.syncContacts();

      // Verify prefetch calls to avoid N+1 queries
      expect(storage.getIntegrationData).toHaveBeenCalledTimes(2);
      expect(storage.getIntegrationData).toHaveBeenCalledWith('test-integration-id', 'contact');
      expect(storage.getIntegrationData).toHaveBeenCalledWith('test-integration-id', 'company');

      // Verify contacts created with proper company linkage
      expect(storage.createContact).toHaveBeenCalledWith({
        companyId: 'local-company-1', // Resolved from SF_ACCOUNT_1
        email: 'john@acme.com',
        firstName: 'John',
        lastName: 'Doe',
        title: 'CEO',
        role: 'Executive',
        linkedin: undefined
      });
      expect(storage.createContact).toHaveBeenCalledWith({
        companyId: 'local-company-2', // Resolved from SF_ACCOUNT_2
        email: 'jane@beta.com',
        firstName: 'Jane',
        lastName: 'Smith',
        title: 'CTO',
        role: 'Technology',
        linkedin: undefined
      });

      // Verify integration data mappings
      expect(storage.createIntegrationData).toHaveBeenCalledTimes(2);
      expect(storage.createIntegrationData).toHaveBeenCalledWith({
        integrationId: 'test-integration-id',
        externalId: 'SF_CONTACT_1',
        dataType: 'contact',
        data: mockSalesforceContacts.records[0],
        localId: 'local-contact-1'
      });

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(2);
    });

    it('should skip contacts without email addresses', async () => {
      const mockSalesforceContacts = {
        records: [
          {
            Id: 'SF_CONTACT_1',
            AccountId: 'SF_ACCOUNT_1',
            Email: null, // No email
            FirstName: 'John',
            LastName: 'Doe',
            LastModifiedDate: '2024-01-01T10:00:00Z'
          }
        ]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSalesforceContacts)
      });

      (storage.getIntegrationData as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await salesforceService.syncContacts();

      // Verify no contact was created
      expect(storage.createContact).not.toHaveBeenCalled();
      expect(storage.createIntegrationData).not.toHaveBeenCalled();
      expect(result.recordsCreated).toBe(0);
    });
  });

  describe('syncMeetings', () => {
    it('should create calls with proper company and opportunity resolution', async () => {
      const mockSalesforceEvents = {
        records: [
          {
            Id: 'SF_EVENT_1',
            Subject: 'Demo Call with Acme',
            StartDateTime: '2025-02-01T10:00:00Z', // Future date for upcoming status
            EndDateTime: '2025-02-01T11:00:00Z',
            WhoId: 'SF_CONTACT_1',
            WhatId: 'SF_ACCOUNT_1', // Direct account reference
            Description: 'Product demo',
            Type: 'Demo',
            IsAllDayEvent: false,
            LastModifiedDate: '2024-01-01T10:00:00Z'
          },
          {
            Id: 'SF_EVENT_2',
            Subject: 'Follow-up Meeting',
            StartDateTime: '2025-02-02T14:00:00Z', // Future date for upcoming status  
            EndDateTime: '2025-02-02T15:00:00Z',
            WhoId: 'SF_CONTACT_2',
            WhatId: 'SF_OPPORTUNITY_1', // Opportunity reference
            Description: 'Follow-up discussion',
            Type: 'Follow-up',
            IsAllDayEvent: false,
            LastModifiedDate: '2024-01-01T11:00:00Z'
          }
        ]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSalesforceEvents)
      });

      // Mock prefetched integration data for performance optimization
      (storage.getIntegrationData as any)
        .mockResolvedValueOnce([]) // No existing calls
        .mockResolvedValueOnce([ // Company mappings
          { externalId: 'SF_ACCOUNT_1', localId: 'local-company-1', dataType: 'company' }
        ])
        .mockResolvedValueOnce([ // Opportunity mappings
          {
            externalId: 'SF_OPPORTUNITY_1',
            localId: 'local-opportunity-1',
            dataType: 'opportunity',
            data: { AccountId: 'SF_ACCOUNT_1' } // Opportunity linked to SF_ACCOUNT_1
          }
        ]);

      (storage.createCall as any)
        .mockResolvedValueOnce({ id: 'local-call-1' })
        .mockResolvedValueOnce({ id: 'local-call-2' });

      const result = await salesforceService.syncMeetings();

      // Verify prefetch calls for performance optimization
      expect(storage.getIntegrationData).toHaveBeenCalledTimes(3);
      expect(storage.getIntegrationData).toHaveBeenCalledWith('test-integration-id', 'call');
      expect(storage.getIntegrationData).toHaveBeenCalledWith('test-integration-id', 'company');
      expect(storage.getIntegrationData).toHaveBeenCalledWith('test-integration-id', 'opportunity');

      const firstCallStatus = new Date('2025-02-01T10:00:00Z') > new Date() ? 'upcoming' : 'completed';
      const secondCallStatus = new Date('2025-02-02T14:00:00Z') > new Date() ? 'upcoming' : 'completed';

      // Verify first call created with direct company linkage
      expect(storage.createCall).toHaveBeenCalledWith({
        companyId: 'local-company-1', // Direct from SF_ACCOUNT_1
        title: 'Demo Call with Acme',
        scheduledAt: new Date('2025-02-01T10:00:00Z'),
        status: firstCallStatus,
        callType: 'demo',
        stage: 'initial_discovery'
      });

      // Verify second call created with opportunity->company resolution
      expect(storage.createCall).toHaveBeenCalledWith({
        companyId: 'local-company-1', // Resolved through SF_OPPORTUNITY_1 -> SF_ACCOUNT_1
        title: 'Follow-up Meeting',
        scheduledAt: new Date('2025-02-02T14:00:00Z'),
        status: secondCallStatus,
        callType: 'follow-up',
        stage: 'initial_discovery'
      });

      // Verify integration data mappings
      expect(storage.createIntegrationData).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(2);
    });

    it('should skip events without company association', async () => {
      const mockSalesforceEvents = {
        records: [{
          Id: 'SF_EVENT_1',
          Subject: 'Internal Meeting',
          StartDateTime: '2024-02-01T10:00:00Z',
          WhatId: null, // No company/opportunity reference
          LastModifiedDate: '2024-01-01T10:00:00Z'
        }]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSalesforceEvents)
      });

      (storage.getIntegrationData as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await salesforceService.syncMeetings();

      // Verify no call was created
      expect(storage.createCall).not.toHaveBeenCalled();
      expect(result.recordsCreated).toBe(0);
    });
  });

  describe('syncOpportunities', () => {
    it('should create opportunities with proper company linkage', async () => {
      const mockSalesforceOpportunities = {
        records: [
          {
            Id: 'SF_OPPORTUNITY_1',
            AccountId: 'SF_ACCOUNT_1',
            Name: 'Acme Enterprise Deal',
            StageName: 'Proposal/Price Quote',
            Amount: 50000,
            CloseDate: '2024-03-01',
            Description: 'Enterprise software deal',
            NextStep: 'Schedule final demo',
            LastModifiedDate: '2024-01-01T10:00:00Z'
          }
        ]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSalesforceOpportunities)
      });

      (storage.getIntegrationData as any)
        .mockResolvedValueOnce([]) // No existing opportunities
        .mockResolvedValueOnce([{ // Company mapping
          externalId: 'SF_ACCOUNT_1',
          localId: 'local-company-1',
          dataType: 'company'
        }]);

      (storage.createOpportunity as any).mockResolvedValueOnce({ id: 'local-opportunity-1' });

      const result = await salesforceService.syncOpportunities();

      // Verify opportunity created with proper data and company linkage
      expect(storage.createOpportunity).toHaveBeenCalledWith({
        companyId: 'local-company-1',
        name: 'Acme Enterprise Deal',
        stage: 'Proposal/Price Quote',
        amount: '50000',
        closeDate: '2024-03-01',
        description: 'Enterprise software deal',
        nextStep: 'Schedule final demo'
      });

      expect(storage.createIntegrationData).toHaveBeenCalledWith({
        integrationId: 'test-integration-id',
        externalId: 'SF_OPPORTUNITY_1',
        dataType: 'opportunity',
        data: mockSalesforceOpportunities.records[0],
        localId: 'local-opportunity-1'
      });

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(1);
    });
  });

  describe('Performance Optimization Tests', () => {
    it('should use prefetched data maps to avoid N+1 queries in all sync methods', async () => {
      // Mock successful API responses for all methods
      (fetch as any)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ records: [] }) }) // companies
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ records: [] }) }) // contacts
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ records: [] }) }) // opportunities
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ records: [] }) }); // meetings

      // Mock storage calls
      (storage.getIntegrationData as any).mockResolvedValue([]);

      // Test all sync methods
      await Promise.all([
        salesforceService.syncCompanies(),
        salesforceService.syncContacts(),
        salesforceService.syncOpportunities(),
        salesforceService.syncMeetings()
      ]);

      // Verify prefetch calls were made for performance optimization
      const getIntegrationDataCalls = (storage.getIntegrationData as any).mock.calls;
      
      // syncCompanies should prefetch company data
      expect(getIntegrationDataCalls).toContainEqual(['test-integration-id', 'company']);
      
      // syncContacts should prefetch contact and company data  
      expect(getIntegrationDataCalls).toContainEqual(['test-integration-id', 'contact']);
      
      // syncOpportunities should prefetch opportunity and company data
      expect(getIntegrationDataCalls).toContainEqual(['test-integration-id', 'opportunity']);
      
      // syncMeetings should prefetch call, company, and opportunity data
      expect(getIntegrationDataCalls).toContainEqual(['test-integration-id', 'call']);

      // Verify total number of prefetch calls (no N+1 queries)
      expect(storage.getIntegrationData).toHaveBeenCalledTimes(8); // 1+2+2+3 prefetch calls total
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await salesforceService.syncCompanies();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Salesforce company sync failed');
    });

    it('should handle individual record errors without failing entire sync', async () => {
      const mockSalesforceAccounts = {
        records: [
          { Id: 'VALID_ACCOUNT', Name: 'Valid Company', LastModifiedDate: '2024-01-01T10:00:00Z' },
          { Id: 'INVALID_ACCOUNT', Name: 'Invalid Company', LastModifiedDate: '2024-01-01T11:00:00Z' }
        ]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSalesforceAccounts)
      });

      (storage.getIntegrationData as any).mockResolvedValueOnce([]);
      (storage.createCompany as any)
        .mockResolvedValueOnce({ id: 'local-company-1' }) // First succeeds
        .mockRejectedValueOnce(new Error('Database error')); // Second fails

      const result = await salesforceService.syncCompanies();

      expect(result.success).toBe(false);
      expect(result.recordsCreated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to sync account Invalid Company');
    });
  });
});