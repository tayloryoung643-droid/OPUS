// background.js - Chrome extension service worker for Opus Orb
const OPUS_API = "http://localhost:5000/api"; // Update this for production
let opusToken = null;

// Load token at startup
chrome.storage.sync.get(["opusToken"], ({ opusToken: t }) => { 
  opusToken = t || null; 
  console.log('[OpusOrb] Loaded token from storage:', !!opusToken);
});

// Accept token via messages (from content script or side panel)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SET_TOKEN" && msg.token) {
    opusToken = msg.token;
    chrome.storage.sync.set({ opusToken });
    console.log('[OpusOrb] Token updated and stored');
    sendResponse({ ok: true });
  }

  if (msg.type === "OPUS_ASK" && msg.text) {
    // Handle Q&A from panel - could forward to chat endpoint
    console.log('[OpusOrb] Q&A request:', msg.text);
    // For now, just log it
    sendResponse({ ok: true });
  }
});

/**
 * Lightweight URL-based meeting detection
 * @param {string} url - The tab URL to check
 * @returns {Object|null} Meeting info or null
 */
function detectMeeting(url) {
  if (!url) return null;
  if (url.startsWith("https://meet.google.com/")) {
    return { vendor: "google_meet" };
  }
  if (url.includes(".zoom.us/j/") || url.includes(".zoom.us/wc/")) {
    return { vendor: "zoom" };
  }
  if (url.startsWith("https://teams.microsoft.com/")) {
    return { vendor: "teams" };
  }
  return null;
}

/**
 * Push state and context to a tab
 * @param {number} tabId - Chrome tab ID
 * @param {string} url - Tab URL
 */
async function pushContext(tabId, url) {
  if (!tabId || !url) return;

  let state = "idle";
  let context = null;

  try {
    if (opusToken) {
      const meeting = detectMeeting(url);

      if (meeting) {
        // Live call state - fetch context
        state = "live-call";
        console.log('[OpusOrb] Fetching live call context for:', url);
        
        try {
          const response = await fetch(`${OPUS_API}/orb/context?tabUrl=${encodeURIComponent(url)}`, {
            headers: { 
              Authorization: `Bearer ${opusToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            context = await response.json();
            console.log('[OpusOrb] Live call context received:', context);
          } else {
            console.warn('[OpusOrb] Failed to fetch live call context:', response.status);
          }
        } catch (error) {
          console.error('[OpusOrb] Error fetching live call context:', error);
        }
      } else {
        // Check for upcoming events in pre-call window
        console.log('[OpusOrb] Checking for upcoming events');
        
        try {
          const response = await fetch(`${OPUS_API}/orb/next-event?window=30m`, {
            headers: { 
              Authorization: `Bearer ${opusToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const next = await response.json();
            if (next && next.startsAtSoon) {
              state = "pre-call";
              context = next;
              console.log('[OpusOrb] Pre-call context received:', context);
            }
          } else {
            console.warn('[OpusOrb] Failed to fetch next event:', response.status);
          }
        } catch (error) {
          console.error('[OpusOrb] Error fetching next event:', error);
        }
      }
    } else {
      console.log('[OpusOrb] No token available, staying in idle state');
    }
  } catch (e) {
    console.error('[OpusOrb] Error in pushContext:', e);
  }

  // Send state to content script
  try {
    chrome.tabs.sendMessage(tabId, { type: "OPUS_STATE", state, context });
    console.log(`[OpusOrb] Sent state to tab ${tabId}:`, { state, context: !!context });
  } catch (error) {
    // Tab might not be ready yet or content script not injected
    console.log('[OpusOrb] Failed to send message to tab:', error.message);
  }
}

// When active tab changes or finishes loading
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) {
      console.log('[OpusOrb] Tab activated:', tab.url);
      pushContext(tabId, tab.url);
    }
  } catch (error) {
    console.log('[OpusOrb] Error handling tab activation:', error.message);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    console.log('[OpusOrb] Tab updated:', tab.url);
    pushContext(tabId, tab.url);
  }
});

// Periodic check for pre-call window updates
chrome.alarms.create("refreshContext", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "refreshContext") return;
  
  console.log('[OpusOrb] Periodic context refresh');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && tab.url) {
      pushContext(tab.id, tab.url);
    }
  } catch (error) {
    console.log('[OpusOrb] Error in periodic refresh:', error.message);
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[OpusOrb] Extension started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[OpusOrb] Extension installed/updated');
});