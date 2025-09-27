import type { MCPToolContext } from '../types/mcp-types.js';
import { listRecentThreads, readThread, extractMessageParts } from '../../services/gmail.js';
import { storage } from '../../storage.js';

export async function gmailSearchThreads(args: any, context: MCPToolContext) {
  try {
    const userId = context.user?.claims?.sub;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Get Google tokens from storage
    const googleIntegration = await storage.getGoogleIntegration(userId);
    if (!googleIntegration?.accessToken) {
      throw new Error('Google integration not found - user needs to connect Google first');
    }

    const tokens = {
      access_token: googleIntegration.accessToken,
      refresh_token: googleIntegration.refreshToken,
      expiry_date: googleIntegration.tokenExpiry?.getTime()
    };

    const q = args?.q || "newer_than:7d";
    const threads = await listRecentThreads(tokens, q);
    
    return {
      content: threads?.map(t => ({ id: t.id, historyId: t.historyId })) || []
    };
  } catch (error: any) {
    console.error('[MCP] Gmail search threads error:', error);
    throw new Error(`Gmail search failed: ${error.message}`);
  }
}

export async function gmailReadThread(args: any, context: MCPToolContext) {
  try {
    const userId = context.user?.claims?.sub;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (!args?.threadId) {
      throw new Error('threadId is required');
    }

    // Get Google tokens from storage
    const googleIntegration = await storage.getGoogleIntegration(userId);
    if (!googleIntegration?.accessToken) {
      throw new Error('Google integration not found - user needs to connect Google first');
    }

    const tokens = {
      access_token: googleIntegration.accessToken,
      refresh_token: googleIntegration.refreshToken,
      expiry_date: googleIntegration.tokenExpiry?.getTime()
    };

    const thread = await readThread(tokens, args.threadId);
    const messages = (thread.messages || []).map(m => {
      const parts = extractMessageParts(m);
      return {
        id: parts.id,
        date: parts.headers["date"],
        from: parts.headers["from"],
        to: parts.headers["to"],
        subject: parts.headers["subject"],
        snippet: parts.snippet,
        body: parts.body
      };
    });

    return {
      content: [{ type: "json", data: { threadId: thread.id, messages } }]
    };
  } catch (error: any) {
    console.error('[MCP] Gmail read thread error:', error);
    throw new Error(`Gmail read failed: ${error.message}`);
  }
}