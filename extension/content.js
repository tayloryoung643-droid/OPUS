// content.js - Inject shared Opus Orb bundle on allowed pages
(() => {
  // Prevent duplicate injection
  if (window.__OPUS_ORB_INJECTED__) return;
  window.__OPUS_ORB_INJECTED__ = true;

  const CONFIG = {
  APP_ORIGIN: 'http://localhost:5000',
  API_ORIGIN: 'http://localhost:5000'
};

  console.log('[OpusOrb] Content script loaded on:', window.location.href);

  let orbMountInstance = null;
  let retryCount = 0;
  const maxRetries = 3;

  /**
   * Check if Orb is already present (from main app)
   * @returns {boolean} True if Orb already exists
   */
  function isOrbAlreadyPresent() {
    // Check for existing Orb elements
    const existingOrb = document.querySelector('#opus-orb-root, [data-testid="button-opus-orb-global"]');
    return !!existingOrb;
  }

  /**
   * Load the shared Orb bundle
   * @returns {Promise<void>}
   */
  function loadOrbBundle() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.OpusOrb?.mount) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      // Use packaged bundle from extension instead of remote URL
      script.src = chrome.runtime.getURL('opus-orb.js');
      script.onload = () => {
        console.log('[OpusOrb] Bundle loaded successfully');
        resolve();
      };
      script.onerror = (error) => {
        console.error('[OpusOrb] Failed to load bundle:', error);
        reject(new Error('Bundle load failed'));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Secure network call proxy that keeps JWT in content script
   * @param {string} jwt - JWT token (stays in content script)
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Response promise
   */
  async function secureNetworkCall(jwt, url, options = {}) {
    const secureOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    };
    
    return fetch(url, secureOptions);
  }

  /**
   * Message bridge for secure RPC between page and content script
   */
  const messageBridge = {
    pendingRequests: new Map(),
    requestId: 0,

    /**
     * Setup message listeners for RPC communication
     */
    setup(jwt, apiBaseUrl, userId) {
      // Listen for messages from page script
      window.addEventListener('message', async (event) => {
        if (event.source !== window || !event.data.type?.startsWith('OPUS_RPC_')) return;

        const { type, requestId, operation, payload } = event.data;

        if (type === 'OPUS_RPC_REQUEST') {
          try {
            let result;
            
            // Validate event origin for security
            if (event.origin !== window.location.origin) {
              throw new Error('Unauthorized origin');
            }

            switch (operation) {
              case 'createSession':
                result = await this.handleCreateSession(jwt, apiBaseUrl, userId);
                break;
              case 'loadMessages':
                result = await this.handleLoadMessages(jwt, apiBaseUrl, userId, payload.conversationId);
                break;
              case 'saveMessage':
                result = await this.handleSaveMessage(jwt, apiBaseUrl, userId, payload.conversationId, payload.message);
                break;
              // REMOVED: Dangerous generic secureNetworkCall operation
              // This prevented JWT exfiltration via arbitrary URL requests
              default:
                throw new Error(`Unknown operation: ${operation}`);
            }

            // Send success response with proper origin targeting
            window.postMessage({
              type: 'OPUS_RPC_RESPONSE',
              requestId,
              success: true,
              result
            }, window.location.origin);

          } catch (error) {
            // Send error response with proper origin targeting
            window.postMessage({
              type: 'OPUS_RPC_RESPONSE',
              requestId,
              success: false,
              error: error.message
            }, window.location.origin);
          }
        }
      });
    },

    /**
     * Handle session creation with stable conversation ID
     */
    async handleCreateSession(jwt, apiBaseUrl, userId) {
      const activeKey = `opus:activeConversationId:${userId}`;
      
      try {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get([activeKey], resolve);
        });
        
        if (result[activeKey]) {
          console.log('[OpusOrb] Reusing existing conversation ID:', result[activeKey]);
          return result[activeKey];
        }
      } catch (error) {
        console.warn('[OpusOrb] Failed to load existing conversation ID:', error);
      }
      
      // Create new conversation ID (try server first)
      let conversationId;
      try {
        const response = await secureNetworkCall(jwt, `${apiBaseUrl}/chat/session`, {
          method: 'POST'
        });

        if (response.ok) {
          const data = await response.json();
          conversationId = data.conversationId;
        } else {
          throw new Error('Server session failed');
        }
      } catch (error) {
        console.warn('[OpusOrb] Server session failed:', error);
        conversationId = crypto.randomUUID();
      }
      
      // Store the stable conversation ID
      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [activeKey]: conversationId }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
        console.log('[OpusOrb] Created new stable conversation ID:', conversationId);
      } catch (error) {
        console.error('[OpusOrb] Failed to store conversation ID:', error);
      }
      
      return conversationId;
    },

    /**
     * Handle loading messages from storage/server
     */
    async handleLoadMessages(jwt, apiBaseUrl, userId, conversationId) {
      try {
        // Try server first
        const response = await secureNetworkCall(jwt, `${apiBaseUrl}/chat/history?conversationId=${conversationId}`);

        if (response.ok) {
          const data = await response.json();
          if (data.messages?.length > 0) {
            // Cache locally
            await this.saveToLocal(userId, conversationId, data.messages);
            return data.messages;
          }
        }
      } catch (error) {
        console.warn('[OpusOrb] Server load failed:', error);
      }

      // Fallback to local storage
      return await this.loadFromLocal(userId, conversationId);
    },

    /**
     * Handle saving a message
     */
    async handleSaveMessage(jwt, apiBaseUrl, userId, conversationId, message) {
      // Load existing messages, add new one, save both locally and to server
      const messages = await this.loadFromLocal(userId, conversationId);
      messages.push(message);
      
      await Promise.allSettled([
        this.saveToServer(jwt, apiBaseUrl, conversationId, messages),
        this.saveToLocal(userId, conversationId, messages)
      ]);
    },

    /**
     * Load messages from local storage
     */
    async loadFromLocal(userId, conversationId) {
      try {
        const key = `opus:chat:${userId}:${conversationId}`;
        const result = await new Promise((resolve) => {
          chrome.storage.local.get([key], resolve);
        });
        const messages = result[key] || [];
        console.log(`[OpusOrb] Loaded ${messages.length} messages for conversation ${conversationId}`);
        return messages;
      } catch (error) {
        console.error('[OpusOrb] Local load error:', error);
        return [];
      }
    },

    /**
     * Save messages to local storage
     */
    async saveToLocal(userId, conversationId, messages) {
      try {
        const key = `opus:chat:${userId}:${conversationId}`;
        const messagesToSave = messages.slice(-50);
        
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [key]: messagesToSave }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
        console.log(`[OpusOrb] Saved ${messagesToSave.length} messages locally for conversation ${conversationId}`);
      } catch (error) {
        console.error('[OpusOrb] Local save error:', error);
      }
    },

    /**
     * Save messages to server
     */
    async saveToServer(jwt, apiBaseUrl, conversationId, messages) {
      try {
        await secureNetworkCall(jwt, `${apiBaseUrl}/chat/events`, {
          method: 'POST',
          body: JSON.stringify({
            conversationId,
            messages: messages.slice(-50)
          })
        });
      } catch (error) {
        console.warn('[OpusOrb] Server save failed:', error);
      }
    }
  };

  /**
   * Create RPC-based persistence adapter for page script
   * @returns {Object} Persistence adapter that uses postMessage RPC
   */
  function createRPCPersistenceAdapter() {
    return {
      syncAcrossTabs: true,
      
      async createSession() {
        return await this.makeRPCCall('createSession');
      },
      
      async loadMessages(conversationId) {
        return await this.makeRPCCall('loadMessages', { conversationId });
      },
      
      async saveMessage(conversationId, message) {
        return await this.makeRPCCall('saveMessage', { conversationId, message });
      },

      /**
       * Make RPC call to content script via postMessage
       */
      makeRPCCall(operation, payload = {}) {
        return new Promise((resolve, reject) => {
          const requestId = `rpc_${Date.now()}_${Math.random()}`;
          
          // Send request to content script
          window.postMessage({
            type: 'OPUS_RPC_REQUEST',
            requestId,
            operation,
            payload
          }, '*');
          
          // Listen for response
          const handler = (event) => {
            if (event.source !== window || 
                event.data.type !== 'OPUS_RPC_RESPONSE' || 
                event.data.requestId !== requestId) {
              return;
            }
            
            window.removeEventListener('message', handler);
            
            if (event.data.success) {
              resolve(event.data.result);
            } else {
              reject(new Error(event.data.error));
            }
          };
          
          window.addEventListener('message', handler);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error('RPC timeout'));
          }, 10000);
        });
      }
    };
  }

  /**
   * Mount the Opus Orb on the page
   * @param {Object} bootstrapData - Configuration from background script
   */
  async function mountOrb(bootstrapData) {
    try {
      // Don't inject if Orb already exists
      if (isOrbAlreadyPresent()) {
        console.log('[OpusOrb] Orb already present, skipping injection');
        return;
      }

      // Load the bundle if needed
      await loadOrbBundle();

      // Create mount point
      const mountPoint = document.createElement('div');
      mountPoint.id = 'opus-orb-root';
      mountPoint.style.cssText = 'position: fixed; top: 0; left: 0; pointer-events: none; z-index: 2147483647;';
      document.documentElement.appendChild(mountPoint);

      // Set up secure message bridge (keeps JWT in content script)
      const userId = bootstrapData.user?.sub || bootstrapData.user?.id || 'anonymous';
      messageBridge.setup(bootstrapData.jwt, bootstrapData.apiBaseUrl, userId);

      // Create RPC-based persistence adapter for page script
      const rpcPersistence = createRPCPersistenceAdapter();

      // Get initial conversation ID
      const conversationId = await messageBridge.handleCreateSession(
        bootstrapData.jwt, 
        bootstrapData.apiBaseUrl, 
        userId
      );

      // Mount the Orb WITHOUT exposing JWT to page context
      orbMountInstance = window.OpusOrb.mount('#opus-orb-root', {
        // DO NOT PASS JWT - security risk eliminated
        apiBaseUrl: bootstrapData.apiBaseUrl,
        mcpWsUrl: bootstrapData.mcpWsUrl,
        conversationId: conversationId,
        persistence: rpcPersistence,
        userId: userId,
        userName: bootstrapData.user.name
        // REMOVED: secureNetworkProxy to prevent JWT exfiltration
        // The Orb bundle should only use persistence operations, not arbitrary network calls
      });

      console.log('[OpusOrb] Successfully mounted on page');

      // Listen for cross-tab chat sync
      window.addEventListener('opus-chat-sync', (event) => {
        console.log('[OpusOrb] Cross-tab chat sync:', event.detail);
      });

    } catch (error) {
      console.error('[OpusOrb] Mount failed:', error);
      
      // Retry logic
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`[OpusOrb] Retrying mount (${retryCount}/${maxRetries})...`);
        setTimeout(() => mountOrb(bootstrapData), 2000 * retryCount);
      }
    }
  }

  /**
   * Unmount the Opus Orb
   */
  function unmountOrb() {
    if (orbMountInstance) {
      try {
        orbMountInstance.unmount();
        orbMountInstance = null;
      } catch (error) {
        console.error('[OpusOrb] Unmount error:', error);
      }
    }

    const mountPoint = document.getElementById('opus-orb-root');
    if (mountPoint) {
      mountPoint.remove();
    }
  }

  /**
   * Show sign-in CTA when not authenticated
   */
  function showSignInCTA() {
    const existingCTA = document.getElementById('opus-signin-cta');
    if (existingCTA) return;

    const cta = document.createElement('div');
    cta.id = 'opus-signin-cta';
    cta.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: linear-gradient(135deg, #0891b2, #8b5cf6);
      color: white;
      padding: 12px 16px;
      border-radius: 12px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      cursor: pointer;
      z-index: 2147483647;
      transition: transform 0.2s ease;
    `;
    
    cta.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; background: white; border-radius: 50%; opacity: 0.9;"></div>
        <span>Sign in to Opus</span>
      </div>
    `;

    cta.addEventListener('mouseenter', () => {
      cta.style.transform = 'scale(1.05)';
    });

    cta.addEventListener('mouseleave', () => {
      cta.style.transform = 'scale(1)';
    });

    cta.addEventListener('click', () => {
      window.open(`${CONFIG.APP_ORIGIN}/login?source=extension`, '_blank');
    });

    document.documentElement.appendChild(cta);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      cta.remove();
    }, 10000);
  }

  /**
   * Handle bootstrap response from background script
   * @param {Object} response - Bootstrap response
   */
  function handleBootstrap(response) {
    if (response.ok) {
      console.log('[OpusOrb] Bootstrap successful, mounting Orb');
      mountOrb(response);
    } else {
      console.warn('[OpusOrb] Bootstrap failed:', response.error);
      
      if (response.needsAuth) {
        console.log('[OpusOrb] User needs to sign in');
        showSignInCTA();
      }
    }
  }

  /**
   * Request bootstrap from background script with retry
   */
  function requestBootstrap() {
    chrome.runtime.sendMessage({ type: "OPUS_GET_BOOTSTRAP" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[OpusOrb] Runtime error:', chrome.runtime.lastError.message);
        return;
      }

      handleBootstrap(response || { ok: false, error: 'No response' });
    });
  }

  /**
   * Listen for messages from background script
   */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[OpusOrb] Received message:', msg.type);

    if (msg.type === 'OPUS_BOOTSTRAP') {
      handleBootstrap({ ok: true, ...msg.data });
      sendResponse({ success: true });
      return false;
    }

    if (msg.type === 'OPUS_REFRESH') {
      console.log('[OpusOrb] Refreshing Orb');
      unmountOrb();
      setTimeout(requestBootstrap, 1000);
      sendResponse({ success: true });
      return false;
    }

    return false;
  });

  /**
   * Listen for session offers from web app
   */
  function setupSessionOfferListener() {
    window.addEventListener('message', async (event) => {
      // Only accept messages from same origin (the web app we're on)
      if (event.origin !== window.location.origin) {
        return;
      }

      const { type, code } = event.data;

      if (type === 'OPUS_SESSION_OFFER' && code) {
        console.log('[OpusOrb] Received session offer from web app');
        
        try {
          // Check if we already have a valid token
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(['opus.auth'], resolve);
          });
          
          const storedAuth = result['opus.auth'];
          if (storedAuth && storedAuth.jwt && storedAuth.expiresAt > Date.now()) {
            console.log('[OpusOrb] Already have valid token, skipping exchange');
            return;
          }

          // Exchange the code for a JWT
          chrome.runtime.sendMessage({ 
            type: 'OPUS_EXCHANGE_CODE', 
            code 
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('[OpusOrb] Code exchange error:', chrome.runtime.lastError.message);
              return;
            }

            if (response?.success) {
              console.log('[OpusOrb] Successfully exchanged code for token');
              // Trigger bootstrap now that we have a token
              setTimeout(requestBootstrap, 500);
            } else {
              console.warn('[OpusOrb] Code exchange failed:', response?.error);
            }
          });

        } catch (error) {
          console.error('[OpusOrb] Session offer handling error:', error);
        }
      }
    });
  }

  /**
   * Initialize when DOM is ready
   */
  function initialize() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
      return;
    }

    console.log('[OpusOrb] Initializing on:', window.location.href);
    
    // Always set up session offer listener
    setupSessionOfferListener();
    
    // Check if we're on the main app domain
    const isMainApp = window.location.origin === CONFIG.APP_ORIGIN;
    
    if (isMainApp) {
      console.log('[OpusOrb] On main app domain - session handshake only mode');
      // On main app: Only handle session offers, don't mount orb (main app has its own)
      return;
    }
    
    // On external sites: Normal orb operation
    console.log('[OpusOrb] On external site - attempting to mount orb');
    
    // Small delay to ensure page is settled, then try bootstrap
    setTimeout(() => {
      requestBootstrap();
    }, 500);
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    unmountOrb();
  });

  // Start initialization
  initialize();
})();