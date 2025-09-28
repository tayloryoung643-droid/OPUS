// background.js - Chrome extension service worker for Opus Orb (rewritten for MCP)
let bootstrapData = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 3;

// Host allowlist - don't inject on these domains
const BLOCKED_HOSTS = [
  'localhost:5000',
  'your-domain.com', // Replace with your production domain
  'opus.dev',
  'opus.ai'
];

/**
 * Get bootstrap configuration from server
 * @returns {Promise<Object>} Bootstrap data with JWT, MCP config, etc.
 */
async function getBootstrap() {
  try {
    const response = await fetch("http://localhost:5000/api/orb/extension/bootstrap", {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Bootstrap failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('[OpusOrb] Bootstrap successful:', {
      userId: data.user?.id,
      googleConnected: data.integrations?.google?.connected,
      salesforceConnected: data.integrations?.salesforce?.connected
    });

    return data;
  } catch (error) {
    console.error('[OpusOrb] Bootstrap error:', error);
    throw error;
  }
}

/**
 * Check if we should inject on this URL
 * @param {string} url - The URL to check
 * @returns {boolean} True if we should inject
 */
function shouldInject(url) {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const host = urlObj.host;
    
    // Don't inject on blocked hosts
    if (BLOCKED_HOSTS.some(blockedHost => host.includes(blockedHost))) {
      console.log('[OpusOrb] Blocked injection on:', host);
      return false;
    }
    
    // Don't inject on chrome:// pages
    if (urlObj.protocol === 'chrome:' || urlObj.protocol === 'chrome-extension:') {
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('[OpusOrb] Invalid URL for injection check:', url);
    return false;
  }
}

/**
 * Send bootstrap data to content script
 * @param {number} tabId - Chrome tab ID
 */
async function sendBootstrapToTab(tabId) {
  if (!tabId) return;
  
  try {
    // Get fresh bootstrap data if needed
    if (!bootstrapData) {
      bootstrapData = await getBootstrap();
      reconnectAttempts = 0;
    }
    
    // Send to content script
    chrome.tabs.sendMessage(tabId, {
      type: 'OPUS_BOOTSTRAP',
      data: bootstrapData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[OpusOrb] Content script not ready yet:', chrome.runtime.lastError.message);
      } else if (response?.success) {
        console.log('[OpusOrb] Bootstrap sent successfully to tab:', tabId);
      }
    });
    
  } catch (error) {
    console.error('[OpusOrb] Failed to send bootstrap to tab:', error);
    
    // Clear bootstrap data on auth errors
    if (error.message.includes('401') || error.message.includes('403')) {
      bootstrapData = null;
    }
  }
}

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[OpusOrb] Received message:', msg.type);
  
  if (msg.type === "OPUS_GET_BOOTSTRAP") {
    getBootstrap()
      .then(data => {
        bootstrapData = data;
        sendResponse({ ok: true, ...data });
      })
      .catch(error => {
        console.error('[OpusOrb] Bootstrap request failed:', error);
        sendResponse({ 
          ok: false, 
          error: error.message,
          needsAuth: error.message.includes('401') || error.message.includes('403')
        });
      });
    
    return true; // Keep message channel open for async response
  }
  
  if (msg.type === "OPUS_PING") {
    sendResponse({ ok: true, timestamp: Date.now() });
    return false;
  }
  
  if (msg.type === "OPUS_CHAT_MESSAGE") {
    // Handle chat messages if needed
    console.log('[OpusOrb] Chat message:', msg.message);
    sendResponse({ ok: true });
    return false;
  }
});

/**
 * When active tab changes
 */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && shouldInject(tab.url)) {
      console.log('[OpusOrb] Tab activated, sending bootstrap:', tab.url);
      // Delay to ensure content script is loaded
      setTimeout(() => sendBootstrapToTab(tabId), 1000);
    }
  } catch (error) {
    console.log('[OpusOrb] Error handling tab activation:', error.message);
  }
});

/**
 * When tab finishes loading
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && shouldInject(tab.url)) {
    console.log('[OpusOrb] Tab updated, sending bootstrap:', tab.url);
    // Delay to ensure content script is loaded
    setTimeout(() => sendBootstrapToTab(tabId), 1000);
  }
});

/**
 * Periodic refresh of bootstrap data
 */
chrome.alarms.create("refreshBootstrap", { periodInMinutes: 25 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "refreshBootstrap") {
    console.log('[OpusOrb] Refreshing bootstrap data');
    try {
      bootstrapData = await getBootstrap();
      
      // Send updated data to all active tabs
      const tabs = await chrome.tabs.query({ active: true });
      for (const tab of tabs) {
        if (tab.id && tab.url && shouldInject(tab.url)) {
          sendBootstrapToTab(tab.id);
        }
      }
    } catch (error) {
      console.error('[OpusOrb] Bootstrap refresh failed:', error);
      
      // Clear data on auth errors
      if (error.message.includes('401') || error.message.includes('403')) {
        bootstrapData = null;
      }
    }
  }
});

/**
 * Extension startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('[OpusOrb] Extension started');
  bootstrapData = null; // Clear cache on startup
});

/**
 * Extension install/update
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[OpusOrb] Extension installed/updated');
  bootstrapData = null; // Clear cache on install
});