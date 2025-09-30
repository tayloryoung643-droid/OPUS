import { MCPToolContext, MCPToolName } from './types/mcp-types.js';
import { MCP_TOOL_HANDLERS } from './tools/index.js';
import { createMcpContext, validateUserIntegrations } from './client.js';
import { storage } from '../storage.js';

/**
 * Unified MCP Context Resolver
 * 
 * This class provides a unified interface for routing all data access through MCP tools
 * instead of direct API calls. It can be used by both chat endpoints and voice sessions
 * to ensure consistent data access patterns and eliminate sample data fallbacks.
 */
export class UnifiedMCPContextResolver {
  private mcpContext: MCPToolContext | null = null;
  private mcpServices: any = null;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Initialize the MCP context for this user
   * This sets up all the integrated services and validates connectivity
   */
  async initialize(): Promise<void> {
    try {
      // Create MCP services context 
      this.mcpServices = await createMcpContext(this.userId);
      
      // Create MCP tool context with all required dependencies
      this.mcpContext = {
        userId: this.userId,
        storage: storage,
        googleCalendarService: this.mcpServices.gcal,
        salesforceCrmService: this.mcpServices.sf,
        user: { id: this.userId } // Basic user object
      };

      console.log(`[MCP-Resolver] Initialized context for user ${this.userId}`);
    } catch (error) {
      console.error('[MCP-Resolver] Failed to initialize context:', error);
      throw error;
    }
  }

  /**
   * Execute an MCP tool and return the result
   * This is the primary method for routing data access through MCP
   */
  async executeTool(toolName: MCPToolName, args: any = {}): Promise<any> {
    if (!this.mcpContext) {
      await this.initialize();
    }

    try {
      console.log(`[MCP-Resolver] Executing tool: ${toolName} for user ${this.userId}`);
      
      const handler = MCP_TOOL_HANDLERS[toolName];
      if (!handler) {
        throw new Error(`Tool handler not found: ${toolName}`);
      }

      const result = await handler(args, this.mcpContext!);
      
      console.log(`[MCP-Resolver] Tool ${toolName} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[MCP-Resolver] Tool ${toolName} execution failed:`, error);
      // Return graceful fallback instead of throwing
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback: true
      };
    }
  }

  /**
   * Check which integrations are available for this user
   */
  async checkIntegrations(): Promise<{
    hasGoogle: boolean;
    hasSalesforce: boolean;
    hasGmail: boolean;
  }> {
    return await validateUserIntegrations(this.userId);
  }

  /**
   * Get calendar context (events) through MCP
   */
  async getCalendarContext(args: {
    eventId?: string;
    contactEmail?: string;
    timeRange?: { start: string; end: string };
    includeAttendees?: boolean;
  } = {}): Promise<any> {
    return await this.executeTool('calendar_meeting_context', args);
  }

  /**
   * Get attendee history through MCP
   */
  async getAttendeeHistory(args: {
    attendeeEmail: string;
    maxEvents?: number;
  }): Promise<any> {
    return await this.executeTool('calendar_attendee_history', args);
  }

  /**
   * Look up Salesforce contacts through MCP
   */
  async getSalesforceContacts(args: {
    email?: string;
    company?: string;
    fields?: string[];
  } = {}): Promise<any> {
    return await this.executeTool('salesforce_contact_lookup', args);
  }

  /**
   * Look up Salesforce opportunities through MCP
   */
  async getSalesforceOpportunities(args: {
    opportunityId?: string;
    contactId?: string;
    accountId?: string;
    fields?: string[];
  } = {}): Promise<any> {
    return await this.executeTool('salesforce_opportunity_lookup', args);
  }

  /**
   * Look up Salesforce accounts through MCP
   */
  async getSalesforceAccounts(args: {
    accountId?: string;
    accountName?: string;
    fields?: string[];
  } = {}): Promise<any> {
    return await this.executeTool('salesforce_account_lookup', args);
  }

  /**
   * Search prep notes through MCP
   */
  async searchPrepNotes(args: {
    query: string;
    maxResults?: number;
  }): Promise<any> {
    return await this.executeTool('prep_notes_search', args);
  }

  /**
   * Get call history through MCP
   */
  async getCallHistory(args: {
    contactEmail?: string;
    companyName?: string;
    maxResults?: number;
  } = {}): Promise<any> {
    return await this.executeTool('call_history_lookup', args);
  }

  /**
   * Build comprehensive sales context by executing multiple MCP tools
   * This is similar to the existing buildSalesContext but uses MCP tools consistently
   */
  async buildComprehensiveContext(): Promise<{
    integrationStatus: any;
    calendarEvents: any;
    opportunities: any;
    recentContacts: any;
    error?: string;
  }> {
    try {
      // Check integrations first
      const integrationStatus = await this.checkIntegrations();
      
      const context = {
        integrationStatus,
        calendarEvents: { events: [], total: 0 },
        opportunities: { opportunities: [], total: 0 },
        recentContacts: { contacts: [], total: 0 }
      };

      // Load calendar events if Google is connected
      if (integrationStatus.hasGoogle) {
        const calendarResult = await this.getCalendarContext();
        // Only replace if we got a valid result with the expected structure
        if (calendarResult && !calendarResult.fallback && calendarResult.events) {
          context.calendarEvents = calendarResult;
        }
      }

      // Load opportunities if Salesforce is connected
      if (integrationStatus.hasSalesforce) {
        const opportunitiesResult = await this.getSalesforceOpportunities();
        // Only replace if we got a valid result with the expected structure
        if (opportunitiesResult && !opportunitiesResult.fallback && opportunitiesResult.opportunities) {
          context.opportunities = opportunitiesResult;
        }
      }

      // Load recent contacts if Salesforce is connected
      if (integrationStatus.hasSalesforce) {
        const contactsResult = await this.getSalesforceContacts();
        // Only replace if we got a valid result with the expected structure
        if (contactsResult && !contactsResult.fallback && contactsResult.contacts) {
          context.recentContacts = contactsResult;
        }
      }

      console.log(`[MCP-Resolver] Built comprehensive context for user ${this.userId}`);
      return context;
    } catch (error) {
      console.error('[MCP-Resolver] Error building comprehensive context:', error);
      return {
        integrationStatus: { hasGoogle: false, hasSalesforce: false, hasGmail: false },
        calendarEvents: { events: [], total: 0 },
        opportunities: { opportunities: [], total: 0 },
        recentContacts: { contacts: [], total: 0 },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Factory function to create a unified MCP context resolver for a user
 * This is the main entry point for other parts of the application
 */
export async function createUnifiedMCPResolver(userId: string): Promise<UnifiedMCPContextResolver> {
  const resolver = new UnifiedMCPContextResolver(userId);
  await resolver.initialize();
  return resolver;
}