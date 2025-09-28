// Persistence adapter for chat history - supports server-backed and local fallback

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface PersistenceAdapter {
  loadMessages(conversationId: string): Promise<ChatMessage[]>;
  saveMessages(conversationId: string, messages: ChatMessage[]): Promise<void>;
  createSession(): Promise<string>;
  syncAcrossTabs?: boolean;
}

// Server-backed persistence adapter
export class ServerPersistenceAdapter implements PersistenceAdapter {
  constructor(
    private apiBaseUrl: string,
    private jwt: string
  ) {}

  async createSession(): Promise<string> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/chat/session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const data = await response.json();
      return data.conversationId;
    } catch (error) {
      console.warn('[Persistence] Failed to create server session:', error);
      // Fallback to local UUID
      return crypto.randomUUID();
    }
  }

  async loadMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/chat/history?conversationId=${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('[Persistence] Failed to load server history:', response.status);
        return [];
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.warn('[Persistence] Error loading server history:', error);
      return [];
    }
  }

  async saveMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/chat/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId,
          messages: messages.slice(-50) // Keep last 50 messages
        })
      });

      if (!response.ok) {
        console.warn('[Persistence] Failed to save to server:', response.status);
      }
    } catch (error) {
      console.warn('[Persistence] Error saving to server:', error);
    }
  }
}

// Chrome extension persistence adapter with local storage fallback
export class ExtensionPersistenceAdapter implements PersistenceAdapter {
  private serverAdapter: ServerPersistenceAdapter;
  private activeConversationId: string | null = null;
  syncAcrossTabs = true;

  constructor(
    private apiBaseUrl: string,
    private jwt: string,
    private userId: string
  ) {
    this.serverAdapter = new ServerPersistenceAdapter(apiBaseUrl, jwt);
    this.setupStorageSync();
  }

  private setupStorageSync() {
    // Listen for storage changes from other tabs
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
          for (const key in changes) {
            if (key.startsWith(`opus:chat:${this.userId}:`)) {
              // Notify about cross-tab sync
              window.dispatchEvent(new CustomEvent('opus-chat-sync', {
                detail: { conversationId: key.split(':').pop(), messages: changes[key].newValue }
              }));
            }
          }
        }
      });
    }
  }

  async createSession(): Promise<string> {
    // Check if we already have an active conversation ID
    if (this.activeConversationId) {
      return this.activeConversationId;
    }

    // Try to load existing active conversation ID
    const activeKey = `opus:activeConversationId:${this.userId}`;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await new Promise<any>((resolve) => {
          chrome.storage.local.get([activeKey], resolve);
        });
        if (result[activeKey]) {
          this.activeConversationId = result[activeKey];
          return this.activeConversationId;
        }
      } else {
        const stored = localStorage.getItem(activeKey);
        if (stored) {
          this.activeConversationId = stored;
          return this.activeConversationId;
        }
      }
    } catch (error) {
      console.warn('[Persistence] Failed to load active conversation ID:', error);
    }

    // Create new conversation ID
    try {
      // Try server first
      this.activeConversationId = await this.serverAdapter.createSession();
    } catch (error) {
      console.warn('[Persistence] Server session failed, using local UUID');
      this.activeConversationId = crypto.randomUUID();
    }

    // Store the active conversation ID
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await new Promise<void>((resolve, reject) => {
          chrome.storage.local.set({ [activeKey]: this.activeConversationId }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      } else {
        localStorage.setItem(activeKey, this.activeConversationId);
      }
    } catch (error) {
      console.error('[Persistence] Failed to store active conversation ID:', error);
    }

    return this.activeConversationId;
  }

  async loadMessages(conversationId: string): Promise<ChatMessage[]> {
    // Try server first
    try {
      const serverMessages = await this.serverAdapter.loadMessages(conversationId);
      if (serverMessages.length > 0) {
        // Cache locally for offline access
        await this.saveToLocal(conversationId, serverMessages);
        return serverMessages;
      }
    } catch (error) {
      console.warn('[Persistence] Server load failed, trying local:', error);
    }

    // Fallback to local storage
    return await this.loadFromLocal(conversationId);
  }

  async saveMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    // Save to both server and local
    await Promise.allSettled([
      this.serverAdapter.saveMessages(conversationId, messages),
      this.saveToLocal(conversationId, messages)
    ]);
  }

  private async loadFromLocal(conversationId: string): Promise<ChatMessage[]> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Chrome extension storage
        const key = `opus:chat:${this.userId}:${conversationId}`;
        const result = await new Promise<any>((resolve) => {
          chrome.storage.local.get([key], resolve);
        });
        return result[key] || [];
      } else {
        // Regular localStorage
        const key = `opus:chat:${this.userId}:${conversationId}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
      }
    } catch (error) {
      console.error('[Persistence] Local load error:', error);
      return [];
    }
  }

  private async saveToLocal(conversationId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const key = `opus:chat:${this.userId}:${conversationId}`;
      const messagesToSave = messages.slice(-50); // Keep last 50 messages

      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Chrome extension storage
        await new Promise<void>((resolve, reject) => {
          chrome.storage.local.set({ [key]: messagesToSave }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Regular localStorage
        localStorage.setItem(key, JSON.stringify(messagesToSave));
      }
    } catch (error) {
      console.error('[Persistence] Local save error:', error);
    }
  }
}

// Factory function to create appropriate adapter
export function createPersistenceAdapter(
  apiBaseUrl: string,
  jwt: string,
  userId: string,
  isExtension = false
): PersistenceAdapter {
  if (isExtension) {
    return new ExtensionPersistenceAdapter(apiBaseUrl, jwt, userId);
  } else {
    return new ServerPersistenceAdapter(apiBaseUrl, jwt);
  }
}