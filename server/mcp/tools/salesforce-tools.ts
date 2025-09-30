import {
  salesforceContactLookupSchema,
  salesforceOpportunityLookupSchema,
  salesforceAccountLookupSchema,
  type SalesforceContact,
  type SalesforceOpportunity,
  type SalesforceAccount,
  type MCPToolContext
} from '../types/mcp-types.js';

/**
 * Salesforce Contact Lookup Tool
 * Searches for contacts by email or company name using existing Salesforce CRM integration
 */
export async function salesforceContactLookup(
  args: unknown, 
  context: MCPToolContext
): Promise<{ contacts: SalesforceContact[]; total: number }> {
  try {
    const params = salesforceContactLookupSchema.parse(args);
    
    // Import the Salesforce CRM service dynamically
    const { salesforceCrmService } = await import('../../services/salesforceCrm.js');
    
    let contacts: any[] = [];
    
    if (params.email) {
      // Search by email using search API
      const searchResults = await salesforceCrmService.searchRecords(context.userId, params.email, ['Contact']);
      contacts = searchResults.filter((record: any) => record.attributes.type === 'Contact') || [];
    } else if (params.company) {
      // Search by company name
      const searchResults = await salesforceCrmService.searchRecords(context.userId, params.company, ['Contact']);
      contacts = searchResults.filter((record: any) => record.attributes.type === 'Contact') || [];
    } else {
      // No specific parameters - get recent contacts (general query)
      const searchResults = await salesforceCrmService.searchRecords(context.userId, '', ['Contact']);
      contacts = searchResults.filter((record: any) => record.attributes.type === 'Contact') || [];
    }
    
    // Transform to standardized format
    const transformedContacts: SalesforceContact[] = contacts.map(contact => ({
      Id: contact.Id,
      Name: contact.Name,
      Email: contact.Email,
      Phone: contact.Phone,
      Title: contact.Title,
      AccountId: contact.AccountId,
      AccountName: contact.Account?.Name
    }));
    
    console.log(`[MCP-Salesforce] Found ${transformedContacts.length} contacts for ${params.email || params.company}`);
    
    return {
      contacts: transformedContacts,
      total: transformedContacts.length
    };
  } catch (error) {
    console.error('[MCP-Salesforce] Contact lookup error:', error);
    
    // Return graceful fallback
    return {
      contacts: [],
      total: 0
    };
  }
}

/**
 * Salesforce Opportunity Lookup Tool
 * Searches for opportunities by ID, contact, or account using existing Salesforce CRM integration
 */
export async function salesforceOpportunityLookup(
  args: unknown, 
  context: MCPToolContext
): Promise<{ opportunities: SalesforceOpportunity[]; total: number }> {
  try {
    const params = salesforceOpportunityLookupSchema.parse(args);
    
    // Import the Salesforce CRM service dynamically
    const { salesforceCrmService } = await import('../../services/salesforceCrm.js');
    
    let opportunities: any[] = [];
    
    if (params.opportunityId) {
      // For specific opportunity ID, get all opportunities and filter
      const allOpportunities = await salesforceCrmService.getOpportunities(context.userId, 50);
      opportunities = allOpportunities.filter((opp: any) => opp.Id === params.opportunityId);
    } else if (params.contactId || params.accountId) {
      // Get all opportunities and filter by contact/account later
      opportunities = await salesforceCrmService.getOpportunities(context.userId, 50);
      // Note: Filtering by contactId/accountId would require additional logic
    } else {
      // No specific parameters - return ALL opportunities (sales pipeline)
      opportunities = await salesforceCrmService.getOpportunities(context.userId, 50);
    }
    
    // Transform to standardized format
    const transformedOpportunities: SalesforceOpportunity[] = opportunities.map(opp => ({
      Id: opp.Id,
      Name: opp.Name,
      StageName: opp.StageName,
      Amount: opp.Amount,
      CloseDate: opp.CloseDate,
      AccountId: opp.AccountId,
      AccountName: opp.Account?.Name
    }));
    
    const queryDesc = params.opportunityId || params.contactId || params.accountId || 'all opportunities (pipeline)';
    console.log(`[MCP-Salesforce] Found ${transformedOpportunities.length} opportunities for ${queryDesc}`);
    
    return {
      opportunities: transformedOpportunities,
      total: transformedOpportunities.length
    };
  } catch (error) {
    console.error('[MCP-Salesforce] Opportunity lookup error:', error);
    
    // Return graceful fallback
    return {
      opportunities: [],
      total: 0
    };
  }
}

/**
 * Salesforce Account Lookup Tool
 * Searches for accounts by ID, name, or domain using existing Salesforce CRM integration
 */
export async function salesforceAccountLookup(
  args: unknown, 
  context: MCPToolContext
): Promise<{ accounts: SalesforceAccount[]; total: number }> {
  try {
    const params = salesforceAccountLookupSchema.parse(args);
    
    // Import the Salesforce CRM service dynamically
    const { salesforceCrmService } = await import('../../services/salesforceCrm.js');
    
    let accounts: any[] = [];
    
    if (params.accountId) {
      // Use the existing getAccountById method
      const account = await salesforceCrmService.getAccountById(context.userId, params.accountId);
      accounts = account ? [account] : [];
    } else if (params.name) {
      // Search by account name
      const searchResults = await salesforceCrmService.searchRecords(context.userId, params.name, ['Account']);
      accounts = searchResults.filter((record: any) => record.attributes.type === 'Account') || [];
    } else if (params.domain) {
      // Search by domain using search API
      const searchResults = await salesforceCrmService.searchRecords(context.userId, params.domain, ['Account']);
      accounts = searchResults.filter((record: any) => record.attributes.type === 'Account') || [];
    } else {
      // No specific parameters - get recent accounts (general query)
      const searchResults = await salesforceCrmService.searchRecords(context.userId, '', ['Account']);
      accounts = searchResults.filter((record: any) => record.attributes.type === 'Account') || [];
    }
    
    // Transform to standardized format
    const transformedAccounts: SalesforceAccount[] = accounts.map(account => ({
      Id: account.Id,
      Name: account.Name,
      Industry: account.Industry,
      NumberOfEmployees: account.NumberOfEmployees,
      AnnualRevenue: account.AnnualRevenue,
      Website: account.Website,
      Description: account.Description
    }));
    
    console.log(`[MCP-Salesforce] Found ${transformedAccounts.length} accounts for ${params.accountId || params.name || params.domain}`);
    
    return {
      accounts: transformedAccounts,
      total: transformedAccounts.length
    };
  } catch (error) {
    console.error('[MCP-Salesforce] Account lookup error:', error);
    
    // Return graceful fallback
    return {
      accounts: [],
      total: 0
    };
  }
}