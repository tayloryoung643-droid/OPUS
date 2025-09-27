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
 * Factory function to create MCP server instance
 */
export function createMCPServer(context: MCPToolContext): MomentumMCPServer {
  console.log(`[MCP-Server] Creating MCP server for user: ${context.userId}`);
  return new MomentumMCPServer(context);
}