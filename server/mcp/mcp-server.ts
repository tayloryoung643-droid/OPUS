import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { 
  MCP_TOOL_DEFINITIONS, 
  type MCPToolContext, 
  type MCPToolName 
} from './types/mcp-types.js';
import { MCP_TOOL_HANDLERS } from './tools/index.js';
import { ENV } from '../config/env.js';

/**
 * Model Context Protocol Server for Momentum AI
 * Enables dynamic data access during AI call preparation generation
 */
export class MomentumMCPServer {
  private server: Server;
  private context: MCPToolContext;

  constructor(context: MCPToolContext) {
    this.context = context;
    
    // Initialize MCP server
    this.server = new Server(
      { 
        name: 'momentum-ai-mcp', 
        version: '1.0.0' 
      },
      { 
        capabilities: { 
          tools: {},
          resources: {} 
        } 
      }
    );

    this.setupToolHandlers();
  }

  /**
   * Set up tool handlers for all MCP tools
   */
  private setupToolHandlers(): void {
    try {
      // Register tools list handler
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.log('[MCP-Server] Listing available tools');
        return {
          tools: Object.values(MCP_TOOL_DEFINITIONS)
        };
      });

      // Register tool call handler
      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        try {
          const toolName = request.params?.name;
          if (!toolName) {
            throw new Error('Tool name not provided');
          }

          console.log(`[MCP-Server] Executing tool: ${toolName}`);
          
          const handler = MCP_TOOL_HANDLERS[toolName as MCPToolName];
          if (!handler) {
            throw new Error(`Tool handler not found: ${toolName}`);
          }

          const result = await handler(request.params?.arguments || {}, this.context);
          
          console.log(`[MCP-Server] Tool ${toolName} completed successfully`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error) {
          console.error(`[MCP-Server] Tool execution failed:`, error);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : 'Unknown error'
                })
              }
            ],
            isError: true
          };
        }
      });

      console.log('[MCP-Server] Tool handlers setup completed');
    } catch (error) {
      console.error('[MCP-Server] Error setting up tool handlers:', error);
      throw error;
    }
  }

  /**
   * Get OpenAI function definitions for all MCP tools
   */
  getOpenAIFunctions(): any[] {
    return Object.values(MCP_TOOL_DEFINITIONS);
  }

  /**
   * Execute a tool by name with arguments
   */
  async executeTool(toolName: MCPToolName, args: unknown): Promise<any> {
    try {
      console.log(`[MCP-Server] Direct execution of tool: ${toolName}`);
      
      const handler = MCP_TOOL_HANDLERS[toolName];
      if (!handler) {
        throw new Error(`Tool handler not found: ${toolName}`);
      }

      const result = await handler(args, this.context);
      
      console.log(`[MCP-Server] Direct execution of ${toolName} completed`);
      return result;
    } catch (error) {
      console.error(`[MCP-Server] Direct execution of ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Update the context (e.g., when user changes)
   */
  updateContext(newContext: MCPToolContext): void {
    this.context = newContext;
    console.log(`[MCP-Server] Context updated for user: ${newContext.userId}`);
  }

  /**
   * Get the underlying MCP server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Check if integrations are available for the user
   */
  async checkIntegrationStatus(): Promise<{
    google: boolean;
    salesforce: boolean;
  }> {
    try {
      const storage = this.context.storage;
      
      const googleIntegration = await storage.getGoogleIntegration(this.context.userId);
      const salesforceIntegration = await storage.getSalesforceIntegration(this.context.userId);
      
      return {
        google: !!googleIntegration?.isActive,
        salesforce: !!salesforceIntegration?.isActive
      };
    } catch (error) {
      console.error('[MCP-Server] Error checking integration status:', error);
      return {
        google: false,
        salesforce: false
      };
    }
  }
}

/**
 * Remote MCP Client Wrapper
 * Wraps HTTP calls to the opus-mcp service to match MomentumMCPServer interface
 */
class RemoteMCPClient {
  private context: MCPToolContext;
  private baseUrl: string;
  private authToken: string;

  constructor(context: MCPToolContext, baseUrl: string, authToken: string) {
    this.context = context;
    this.baseUrl = baseUrl;
    this.authToken = authToken;
    console.log(`[MCP-Remote] Creating remote MCP client for user: ${context.userId}, baseUrl: ${baseUrl}`);
  }

  getOpenAIFunctions(): any[] {
    return Object.values(MCP_TOOL_DEFINITIONS);
  }

  async executeTool(toolName: MCPToolName, args: unknown): Promise<any> {
    const requestId = Math.random().toString(36).substring(2, 8);
    console.log(`[MCP-Remote] ${toolName} [${requestId}]`);

    try {
      const url = `${this.baseUrl}/tools/${toolName}`;
      
      // Build request body with userId last to prevent spoofing
      const requestBody = {
        ...(args && typeof args === 'object' ? args : {}),
        userId: this.context.userId  // Always use context userId, prevent override
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: { message: response.statusText } 
        }));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log(`[MCP-Remote] ${toolName} [${requestId}] SUCCESS`);
      return result;
    } catch (error) {
      console.error(`[MCP-Remote] ${toolName} [${requestId}] FAILED:`, error);
      throw error;
    }
  }

  updateContext(newContext: MCPToolContext): void {
    this.context = newContext;
    console.log(`[MCP-Remote] Context updated for user: ${newContext.userId}`);
  }

  getServer(): Server | null {
    // Return null instead of throwing to prevent crashes
    // Remote mode doesn't have a local server instance
    return null as any;
  }

  async checkIntegrationStatus(): Promise<{ google: boolean; salesforce: boolean }> {
    try {
      const storage = this.context.storage;
      const googleIntegration = await storage.getGoogleIntegration(this.context.userId);
      const salesforceIntegration = await storage.getSalesforceIntegration(this.context.userId);
      
      return {
        google: !!googleIntegration?.isActive,
        salesforce: !!salesforceIntegration?.isActive
      };
    } catch (error) {
      console.error('[MCP-Remote] Error checking integration status:', error);
      return { google: false, salesforce: false };
    }
  }
}

/**
 * Factory function to create MCP server instance
 * Uses remote HTTP service when MCP_REMOTE_ENABLED is true
 */
export function createMCPServer(context: MCPToolContext): MomentumMCPServer | RemoteMCPClient {
  const isRemoteEnabled = ENV.MCP_REMOTE_ENABLED;
  
  if (isRemoteEnabled) {
    const baseUrl = ENV.MCP_BASE_URL;
    const authToken = ENV.MCP_SERVICE_TOKEN;
    
    // Validate required config for remote mode
    if (!authToken) {
      console.warn('[MCP] MCP_REMOTE_ENABLED is true but MCP_SERVICE_TOKEN is missing, falling back to local mode');
      return new MomentumMCPServer(context);
    }
    
    if (!baseUrl || !baseUrl.trim()) {
      console.warn('[MCP] MCP_REMOTE_ENABLED is true but MCP_BASE_URL is missing, falling back to local mode');
      return new MomentumMCPServer(context);
    }
    
    console.log(`[MCP] Using REMOTE mode: ${baseUrl}`);
    return new RemoteMCPClient(context, baseUrl, authToken) as any;
  }
  
  console.log(`[MCP] Using LOCAL mode`);
  return new MomentumMCPServer(context);
}