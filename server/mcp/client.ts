import { googleCalendarService } from '../services/googleCalendar.js';
import { gmailService } from '../services/gmail.js';
import { salesforceCrmService } from '../services/salesforceCrm.js';

export type McpContext = {
  gcal: typeof googleCalendarService;
  gmail: typeof gmailService;
  sf: typeof salesforceCrmService;
  userId: string;
};

/**
 * Creates MCP context with all integrated services for a voice session
 * This provides the same data access as the chat endpoint but for WebSocket voice mode
 */
export async function createMcpContext(userId: string): Promise<McpContext> {
  // The services are already configured to handle user-specific authentication
  // via stored encrypted tokens in the database
  
  return {
    gcal: googleCalendarService,
    gmail: gmailService,
    sf: salesforceCrmService,
    userId
  };
}

/**
 * Check if user has the required integrations connected
 */
export async function validateUserIntegrations(userId: string): Promise<{
  hasGoogle: boolean;
  hasSalesforce: boolean;
  hasGmail: boolean;
}> {
  try {
    // Import storage dynamically to avoid circular dependencies
    const { storage } = await import('../storage.js');
    
    // Check if user has encrypted tokens stored
    const user = await storage.getUserById(userId);
    
    return {
      hasGoogle: !!(user?.googleCalendarTokens?.encryptedAccessToken),
      hasSalesforce: !!(user?.salesforceTokens?.encryptedAccessToken),
      hasGmail: !!(user?.gmailTokens?.encryptedAccessToken || user?.googleCalendarTokens?.encryptedAccessToken) // Gmail uses same Google OAuth
    };
  } catch (error) {
    console.error('[MCP-Client] Error validating integrations:', error);
    return {
      hasGoogle: false,
      hasSalesforce: false,
      hasGmail: false
    };
  }
}