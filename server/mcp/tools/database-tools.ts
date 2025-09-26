import {
  prepNotesSearchSchema,
  callHistoryLookupSchema,
  type CallHistory,
  type PrepNote,
  type MCPToolContext
} from '../types/mcp-types.js';

/**
 * Prep Notes Search Tool
 * Searches previous call preparation notes from the database
 */
export async function prepNotesSearch(
  args: unknown, 
  context: MCPToolContext
): Promise<{ notes: PrepNote[]; query: string; total: number }> {
  try {
    const params = prepNotesSearchSchema.parse(args);
    
    // Search notes in the database
    // For now, we'll implement a simple text search through existing storage
    const storage = context.storage;
    
    // Get all prep notes (we'll need to add this method to storage)
    let allNotes: any[] = [];
    
    try {
      // This is a placeholder - we'd need to implement searchPrepNotes in storage
      // For now, let's simulate with a basic search
      const query = `
        SELECT id, user_id, event_id, text, updated_at 
        FROM prep_notes 
        WHERE text ILIKE '%${params.query}%' 
        ${params.userId ? `AND user_id = '${params.userId}'` : ''}
        ORDER BY updated_at DESC 
        LIMIT ${params.limit}
      `;
      
      // Execute direct SQL query since storage might not have this method yet
      const { sql } = await import('drizzle-orm');
      const { db } = await import('../../db.js');
      
      const results = await db.execute(sql.raw(query));
      allNotes = results.rows || [];
      
    } catch (error) {
      console.warn('[MCP-Database] Direct query failed, falling back to empty results:', error);
      allNotes = [];
    }
    
    // Transform to standardized format
    const transformedNotes: PrepNote[] = allNotes.map((note: any) => ({
      id: note.id,
      userId: note.user_id,
      eventId: note.event_id,
      text: note.text,
      updatedAt: new Date(note.updated_at)
    }));
    
    console.log(`[MCP-Database] Found ${transformedNotes.length} prep notes for query: "${params.query}"`);
    
    return {
      notes: transformedNotes,
      query: params.query,
      total: transformedNotes.length
    };
  } catch (error) {
    console.error('[MCP-Database] Prep notes search error:', error);
    
    // Return graceful fallback
    return {
      notes: [],
      query: typeof args === 'object' && args && 'query' in args ? String(args.query) : '',
      total: 0
    };
  }
}

/**
 * Call History Lookup Tool
 * Gets historical call data for contacts or companies from the database
 */
export async function callHistoryLookup(
  args: unknown, 
  context: MCPToolContext
): Promise<{ calls: CallHistory[]; searchCriteria: string; total: number }> {
  try {
    const params = callHistoryLookupSchema.parse(args);
    
    const storage = context.storage;
    
    // Calculate the date range for lookback
    const now = new Date();
    const lookbackDate = new Date(now.getTime() - (params.lookbackDays * 24 * 60 * 60 * 1000));
    
    let calls: any[] = [];
    let searchCriteria = '';
    
    try {
      if (params.contactEmail) {
        // Search by contact email through company/contact relationships
        searchCriteria = `contact email: ${params.contactEmail}`;
        
        // Get companies that have contacts with this email
        const companies = await storage.getCompaniesByContactEmail(params.contactEmail);
        const companyIds = companies.map((c: any) => c.id);
        
        if (companyIds.length > 0) {
          calls = await storage.getCallsByCompanyIds(companyIds, lookbackDate, params.maxResults);
        }
        
      } else if (params.companyName) {
        // Search by company name
        searchCriteria = `company name: ${params.companyName}`;
        
        const companies = await storage.getCompaniesByName(params.companyName);
        const companyIds = companies.map((c: any) => c.id);
        
        if (companyIds.length > 0) {
          calls = await storage.getCallsByCompanyIds(companyIds, lookbackDate, params.maxResults);
        }
        
      } else if (params.companyDomain) {
        // Search by company domain
        searchCriteria = `company domain: ${params.companyDomain}`;
        
        const company = await storage.getCompanyByDomain(params.companyDomain);
        if (company) {
          calls = await storage.getCallsByCompanyIds([company.id], lookbackDate, params.maxResults);
        }
      }
      
    } catch (error) {
      console.warn('[MCP-Database] Storage query failed, using fallback approach:', error);
      
      // Fallback: get recent calls and filter
      const recentCalls = await storage.getPreviousCalls();
      calls = recentCalls.filter((call: any) => {
        const callDate = new Date(call.scheduledAt);
        return callDate >= lookbackDate;
      }).slice(0, params.maxResults);
    }
    
    // Transform to standardized format with additional details
    const transformedCalls: CallHistory[] = await Promise.all(
      calls.map(async (call: any) => {
        // Get additional call details
        const company = call.companyId ? await storage.getCompany(call.companyId) : null;
        const contacts = call.companyId ? await storage.getContactsByCompany(call.companyId) : [];
        const callPrep = await storage.getCallPrep(call.id);
        const notes = await storage.getPrepNotes(call.id);
        
        return {
          id: call.id,
          title: call.title,
          scheduledAt: new Date(call.scheduledAt),
          status: call.status,
          companyName: company?.name,
          contactEmails: contacts.map((c: any) => c.email).filter(Boolean),
          callPrep: callPrep ? {
            executiveSummary: callPrep.executiveSummary,
            conversationStrategy: callPrep.conversationStrategy
          } : undefined,
          notes: notes?.text
        };
      })
    );
    
    console.log(`[MCP-Database] Found ${transformedCalls.length} call history records for ${searchCriteria}`);
    
    return {
      calls: transformedCalls,
      searchCriteria,
      total: transformedCalls.length
    };
  } catch (error) {
    console.error('[MCP-Database] Call history lookup error:', error);
    
    // Return graceful fallback
    return {
      calls: [],
      searchCriteria: 'unknown',
      total: 0
    };
  }
}