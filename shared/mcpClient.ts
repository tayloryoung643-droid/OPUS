// MCP (Model Control Protocol) client for WebSocket communication
// Used by both the main app and Chrome extension

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface McpRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface McpResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class McpClient {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<string | number, { resolve: Function; reject: Function }>();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private url: string;
  private jwt: string;
  public onConnectionChange?: (connected: boolean) => void;

  constructor(url: string, jwt: string) {
    this.url = url;
    this.jwt = jwt;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket with JWT in subprotocol or query parameter
        const wsUrl = `${this.url}?token=${encodeURIComponent(this.jwt)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[MCP] Connected to WebSocket');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.onConnectionChange?.(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const response: McpResponse = JSON.parse(event.data);
            this.handleResponse(response);
          } catch (error) {
            console.error('[MCP] Failed to parse message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[MCP] WebSocket closed:', event.code, event.reason);
          this.isConnected = false;
          this.stopHeartbeat();
          this.onConnectionChange?.(false);
          
          // Reject pending requests
          this.pendingRequests.forEach(({ reject }) => {
            reject(new Error('WebSocket connection closed'));
          });
          this.pendingRequests.clear();

          // Attempt to reconnect if not a clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[MCP] WebSocket error:', error);
          this.isConnected = false;
          this.onConnectionChange?.(false);
          reject(new Error('WebSocket connection failed'));
        };

        // Timeout for connection
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`[MCP] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('[MCP] Reconnect failed:', error);
      });
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ping().catch(error => {
          console.warn('[MCP] Heartbeat failed:', error);
        });
      }
    }, 30000); // 30 second heartbeat
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleResponse(response: McpResponse) {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      
      if (response.error) {
        pending.reject(new Error(`MCP Error ${response.error.code}: ${response.error.message}`));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  async call(method: string, params?: any): Promise<any> {
    if (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('MCP WebSocket not connected');
    }

    const id = ++this.requestId;
    const request: McpRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      try {
        this.ws!.send(JSON.stringify(request));
        
        // Request timeout
        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            reject(new Error(`MCP request timeout: ${method}`));
          }
        }, 30000);
        
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  async ping(): Promise<void> {
    await this.call('ping');
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.onConnectionChange?.(false);
  }

  get connected(): boolean {
    return this.isConnected;
  }

  // Google Calendar tools
  google = {
    calendar: {
      getNextEvents: async (limit = 10): Promise<any[]> => {
        const result = await this.call("google.calendar.list", { limit });
        return result || [];
      },
      
      getEvent: async (eventId: string): Promise<any> => {
        return await this.call("google.calendar.get", { eventId });
      }
    },
    
    gmail: {
      searchThreads: async (query: string, limit = 20): Promise<any[]> => {
        const result = await this.call("google.gmail.search_threads", { q: query, limit });
        return result || [];
      },
      
      getThread: async (threadId: string): Promise<any> => {
        return await this.call("google.gmail.get_thread", { id: threadId });
      },
      
      getRecentEmails: async (email: string, days = 30): Promise<any[]> => {
        const query = `to:${email} newer_than:${days}d`;
        return await this.google.gmail.searchThreads(query, 10);
      }
    }
  };

  // Salesforce tools
  salesforce = {
    account: {
      byDomain: async (domain: string): Promise<any> => {
        return await this.call("salesforce.account.by_domain", { domain });
      },
      
      search: async (query: string): Promise<any[]> => {
        const result = await this.call("salesforce.account.search", { query });
        return result || [];
      }
    },
    
    contact: {
      byEmail: async (email: string): Promise<any> => {
        return await this.call("salesforce.contact.by_email", { email });
      },
      
      search: async (query: string): Promise<any[]> => {
        const result = await this.call("salesforce.contact.search", { query });
        return result || [];
      }
    },
    
    opportunity: {
      listOpen: async (): Promise<any[]> => {
        const result = await this.call("salesforce.opportunity.list_open", {});
        return result || [];
      },
      
      byAccount: async (accountId: string): Promise<any[]> => {
        const result = await this.call("salesforce.opportunity.by_account", { accountId });
        return result || [];
      }
    },
    
    notes: {
      forEvent: async (eventId: string): Promise<any[]> => {
        const result = await this.call("salesforce.notes.for_event", { eventId });
        return result || [];
      },
      
      create: async (data: any): Promise<any> => {
        return await this.call("salesforce.notes.create", data);
      }
    }
  };
}