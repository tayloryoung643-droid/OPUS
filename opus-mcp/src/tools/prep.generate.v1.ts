import { z } from 'zod';
import { type MCPToolContext } from '../contracts/index.js';

export const name = 'prep.generate.v1';
export const version = 'v1';
export const inputSchema = z.object({
  userId: z.string(),
  eventId: z.string(),
  context: z.object({
    companyDomain: z.string().optional(),
    contactEmail: z.string().optional(),
    notes: z.string().optional()
  }).optional()
});
export const description = 'Generate call preparation materials using AI';

export async function handler(
  args: unknown,
  context: MCPToolContext
): Promise<any> {
  console.log(`[MCP-Tool:${name}] called with args:`, JSON.stringify(args));

  try {
    const params = inputSchema.parse(args);
    const { userId, eventId } = params;

    // Import services
    const { googleCalendarService } = await import('../../../server/services/googleCalendar.js');
    const { gmailService } = await import('../../../server/services/gmail.js');
    const { salesforceCrmService } = await import('../../../server/services/salesforceCrm.js');

    // Check integrations
    const googleIntegration = await context.storage.getGoogleIntegration(userId);
    const salesforceIntegration = await context.storage.getSalesforceIntegration(userId);

    // Fetch calendar event
    let meeting = null;
    let attendees: any[] = [];
    
    if (googleIntegration?.isActive) {
      try {
        const event = await googleCalendarService.getEventById(userId, eventId);
        if (event) {
          meeting = {
            id: event.id,
            title: event.summary || 'Untitled Meeting',
            start: event.start?.dateTime || event.start?.date || '',
            end: event.end?.dateTime || event.end?.date || '',
          };
          attendees = (event.attendees || []).map((a: any) => ({
            email: a.email,
            displayName: a.displayName || a.email.split('@')[0],
          }));
        }
      } catch (error) {
        console.error(`[MCP-Tool:${name}] Error fetching calendar event:`, error);
      }
    }

    // Fetch Gmail threads for attendees
    const gmail: any[] = [];
    if (googleIntegration?.isActive && attendees.length > 0) {
      try {
        const attendeeEmails = attendees.map((a) => a.email);
        const query = `from:(${attendeeEmails.join(' OR ')}) OR to:(${attendeeEmails.join(' OR ')})`;
        
        const threads = await gmailService.searchThreads(userId, query, 5);
        
        for (const thread of threads) {
          if (thread.messages && thread.messages.length > 0) {
            const lastMessage = thread.messages[thread.messages.length - 1];
            gmail.push({
              id: lastMessage.id,
              date: lastMessage.date || new Date().toISOString(),
              from: lastMessage.from || '',
              to: lastMessage.to || '',
              subject: lastMessage.subject || 'No subject',
              snippet: lastMessage.snippet || lastMessage.body?.substring(0, 500) || '',
            });
          }
        }
      } catch (error) {
        console.error(`[MCP-Tool:${name}] Error fetching Gmail:`, error);
      }
    }

    // Fetch Salesforce data
    let salesforce = null;
    if (salesforceIntegration?.isActive && attendees.length > 0) {
      try {
        // Try to find opportunity by attendee email
        const attendeeEmail = attendees[0]?.email;
        if (attendeeEmail) {
          const opportunities = await salesforceCrmService.findOpportunitiesByContact(
            userId,
            attendeeEmail
          );
          
          if (opportunities && opportunities.length > 0) {
            const opp = opportunities[0];
            salesforce = {
              accountName: opp.Account?.Name,
              stageName: opp.StageName,
              amount: opp.Amount,
              closeDate: opp.CloseDate,
              ownerName: opp.Owner?.Name,
            };
          }
        }
      } catch (error) {
        console.error(`[MCP-Tool:${name}] Error fetching Salesforce:`, error);
      }
    }

    // Return MinimalPrepV1 format
    return {
      meeting: meeting || {
        id: eventId,
        title: 'Event',
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      },
      attendees,
      gmail: gmail.length > 0 ? gmail : undefined,
      salesforce: salesforce || undefined,
    };
  } catch (error) {
    console.error(`[MCP-Tool:${name}] ERROR:`, error);
    throw error;
  }
}
