// content.js - Inject shared Opus Orb bundle on allowed pages
(() => {
  // Prevent duplicate injection
  if (window.__OPUS_ORB_INJECTED__) return;
  window.__OPUS_ORB_INJECTED__ = true;

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
   * Create persistence adapter for extension
   * @param {Object} config - Bootstrap configuration
   * @returns {Object} Persistence adapter instance
   */
  function createExtensionPersistence(config) {
    return {
      async createSession() {
        try {
          const response = await fetch(`${config.apiBaseUrl}/chat/session`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.jwt}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            return data.conversationId;
          }
        } catch (error) {
          console.warn('[OpusOrb] Server session failed:', error);
        }
        
        // Fallback to local UUID
        return crypto.randomUUID();
      },

      async loadMessages(conversationId) {
        try {
          // Try server first
          const response = await fetch(`${config.apiBaseUrl}/chat/history?conversationId=${conversationId}`, {
            headers: {
              'Authorization': `Bearer ${config.jwt}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.messages?.length > 0) {
              // Cache locally
              await this.saveToLocal(conversationId, data.messages);
              return data.messages;
            }
          }
        } catch (error) {
          console.warn('[OpusOrb] Server load failed:', error);
        }

        // Fallback to local storage
        return await this.loadFromLocal(conversationId);
      },

      async saveMessages(conversationId, messages) {
        // Save to both server and local
        await Promise.allSettled([
          this.saveToServer(conversationId, messages),
          this.saveToLocal(conversationId, messages)
        ]);
      },

      async saveToServer(conversationId, messages) {
        try {
          await fetch(`${config.apiBaseUrl}/chat/events`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.jwt}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              conversationId,
              messages: messages.slice(-50)
            })
          });
        } catch (error) {
          console.warn('[OpusOrb] Server save failed:', error);
        }
      },

      async loadFromLocal(conversationId) {
        try {
          const key = `opus:chat:${config.user.id}:${conversationId}`;
          const result = await new Promise((resolve) => {
            chrome.storage.local.get([key], resolve);
          });
          return result[key] || [];
        } catch (error) {
          console.error('[OpusOrb] Local load error:', error);
          return [];
        }
      },

      async saveToLocal(conversationId, messages) {
        try {
          const key = `opus:chat:${config.user.id}:${conversationId}`;
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
        } catch (error) {
          console.error('[OpusOrb] Local save error:', error);
        }
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

      // Create persistence adapter
      const persistence = createExtensionPersistence(bootstrapData);

      // Mount the Orb
      orbMountInstance = window.OpusOrb.mount('#opus-orb-root', {
        jwt: bootstrapData.jwt,
        apiBaseUrl: bootstrapData.apiBaseUrl,
        mcpWsUrl: bootstrapData.mcpWsUrl,
        conversationId: await persistence.createSession(),
        persistence: persistence,
        userId: bootstrapData.user.id,
        userName: bootstrapData.user.name
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
      window.open('http://localhost:5000', '_blank');
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
   * Initialize when DOM is ready
   */
  function initialize() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
      return;
    }

    console.log('[OpusOrb] Initializing on:', window.location.href);
    
    // Small delay to ensure page is settled
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