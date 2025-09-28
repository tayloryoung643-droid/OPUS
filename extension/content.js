// content.js - Opus Orb UI overlay with shadow DOM
(() => {
  if (window.__OPUS_ORB__) return;
  window.__OPUS_ORB__ = true;

  console.log('[OpusOrb] Content script loaded on:', window.location.href);

  // --- Host + Shadow DOM ---
  const host = document.createElement('div');
  host.id = 'opus-orb-host';
  Object.assign(host.style, { 
    position: 'fixed', 
    top: '50%', 
    right: '16px', 
    zIndex: 2147483647,
    pointerEvents: 'none'
  });
  
  // Wait for DOM to be ready before appending
  function appendHost() {
    if (document.documentElement) {
      document.documentElement.appendChild(host);
    } else {
      setTimeout(appendHost, 10);
    }
  }
  appendHost();
  
  const shadow = host.attachShadow({ mode: 'open' });

  // --- Styles (minimal, dark, subtle glow) ---
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .wrap { 
      position: relative; 
      transform: translateY(-50%); 
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      pointer-events: auto;
    }
    .orb { 
      width: 48px; 
      height: 48px; 
      border-radius: 50%; 
      cursor: pointer;
      background: radial-gradient(circle at 30% 30%, #a78bfa, #4c1d95);
      box-shadow: 0 0 16px rgba(120, 80, 255, 0.5); 
      transition: all 0.15s ease; 
      border: none;
      outline: none;
      position: relative;
      overflow: hidden;
    }
    .orb:hover { 
      transform: scale(1.06); 
      box-shadow: 0 0 20px rgba(120, 80, 255, 0.8);
    }
    .orb:active {
      transform: scale(0.98);
    }
    .orb.pulse { 
      animation: pulse 2s infinite; 
    }
    .orb.live {
      background: radial-gradient(circle at 30% 30%, #10b981, #065f46);
      box-shadow: 0 0 16px rgba(16, 185, 129, 0.6);
    }
    .orb.pre-call {
      background: radial-gradient(circle at 30% 30%, #f59e0b, #92400e);
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.6);
    }
    .orb::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 16px;
      height: 16px;
      background: white;
      border-radius: 50%;
      opacity: 0.9;
    }
    @keyframes pulse { 
      0%{box-shadow:0 0 8px rgba(120,80,255,.4);} 
      50%{box-shadow:0 0 18px rgba(120,80,255,.9);} 
      100%{box-shadow:0 0 8px rgba(120,80,255,.4);} 
    }

    .panel { 
      position: fixed; 
      top: 50%; 
      right: 72px; 
      transform: translateY(-50%);
      width: 360px; 
      height: 520px; 
      border-radius: 16px; 
      overflow: hidden;
      background: #0b0b12; 
      color: #f7f7ff; 
      box-shadow: 0 20px 60px rgba(0,0,0,.7);
      display: none; 
      flex-direction: column;
      border: 1px solid rgba(255,255,255,.1);
      backdrop-filter: blur(20px);
    }
    .panel.open { 
      display: flex; 
      animation: slideIn 0.2s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-50%) translateX(20px); }
      to { opacity: 1; transform: translateY(-50%) translateX(0); }
    }
    .hdr { 
      display:flex; 
      align-items:center; 
      justify-content:space-between; 
      padding:12px 14px; 
      border-bottom:1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.02);
    }
    .tag { 
      font-size:11px; 
      opacity:.8; 
      padding:4px 8px; 
      border:1px solid rgba(255,255,255,.15); 
      border-radius:999px; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }
    .tag.idle { 
      border-color: rgba(120, 80, 255, .3); 
      background: rgba(120, 80, 255, .1); 
      color: #a78bfa;
    }
    .tag.pre-call { 
      border-color: rgba(245, 158, 11, .4); 
      background: rgba(245, 158, 11, .1); 
      color: #f59e0b;
    }
    .tag.live-call { 
      border-color: rgba(16, 185, 129, .4); 
      background: rgba(16, 185, 129, .1); 
      color: #10b981;
    }
    .title { 
      font-weight:600; 
      font-size: 16px;
      color: white;
    }
    .body { 
      padding:12px 14px; 
      gap:8px; 
      display:flex; 
      flex-direction:column; 
      overflow:auto; 
      flex: 1;
    }
    .bullet { 
      font-size:13px; 
      line-height: 1.4;
      opacity:.95; 
      background:rgba(255,255,255,.04); 
      border:1px solid rgba(255,255,255,.06); 
      padding:10px 12px; 
      border-radius:10px;
      margin-bottom: 6px;
    }
    .bullet:last-child { margin-bottom: 0; }
    .foot { 
      margin-top:auto; 
      padding:12px 14px; 
      border-top:1px solid rgba(255,255,255,.08); 
      display:flex; 
      gap:8px;
      background: rgba(255,255,255,.02);
    }
    .in { 
      flex:1; 
      border-radius:10px; 
      border:1px solid rgba(255,255,255,.12); 
      background:rgba(255,255,255,.03); 
      color:#fff; 
      padding:10px 12px; 
      outline: none;
      font-size: 13px;
    }
    .in:focus {
      border-color: rgba(120, 80, 255, .4);
      background: rgba(255,255,255,.05);
    }
    .in::placeholder {
      color: rgba(255,255,255,.4);
    }
    .btn { 
      border-radius:10px; 
      border:1px solid rgba(166, 108, 255, .3); 
      background:rgba(166, 108, 255, .2); 
      color:#fff; 
      padding:10px 12px; 
      cursor:pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s ease;
      outline: none;
    }
    .btn:hover {
      background:rgba(166, 108, 255, .3);
      border-color: rgba(166, 108, 255, .5);
    }
    .btn:active {
      transform: scale(0.98);
    }
    .subtle { 
      font-size:12px; 
      opacity:.7; 
      text-align: center;
      padding: 16px;
      color: rgba(255,255,255,.5);
    }
    .close-btn {
      background: none;
      border: none;
      color: rgba(255,255,255,.6);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 18px;
      line-height: 1;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .close-btn:hover {
      background: rgba(255,255,255,.1);
      color: rgba(255,255,255,.9);
    }
  `;
  shadow.appendChild(style);

  // --- DOM ---
  const wrap = document.createElement('div'); 
  wrap.className = 'wrap';
  
  const orb = document.createElement('button'); 
  orb.className = 'orb pulse'; 
  orb.title = 'Opus - Your AI Sales Partner';
  orb.setAttribute('aria-label', 'Open Opus assistant');
  
  const panel = document.createElement('div'); 
  panel.className = 'panel';

  // Panel structure
  panel.innerHTML = `
    <div class="hdr">
      <div class="title">Opus</div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="tag idle" id="stateTag">idle</div>
        <button class="close-btn" id="closeBtn" aria-label="Close panel">×</button>
      </div>
    </div>
    <div class="body" id="body">
      <div class="subtle">I'm pinned here. Click me if you need help.</div>
    </div>
    <div class="foot">
      <input id="q" class="in" placeholder="Ask Opus…" />
      <button id="send" class="btn">Send</button>
    </div>
  `;

  wrap.appendChild(orb);
  shadow.appendChild(wrap);
  shadow.appendChild(panel);

  let currentState = "idle";
  let currentContext = null;
  const stateTag = panel.querySelector('#stateTag');
  const body = panel.querySelector('#body');
  const closeBtn = panel.querySelector('#closeBtn');

  function setState(state, context) {
    currentState = state;
    currentContext = context || null;
    
    // Update tag
    stateTag.textContent = state.replace('-', ' ');
    stateTag.className = `tag ${state}`;
    
    // Update orb appearance
    orb.className = `orb ${state}`;
    if (state === 'idle') {
      orb.className += ' pulse';
    }

    // Render content
    body.innerHTML = "";
    
    if (state === "pre-call" && context) {
      addBullet(`📅 Upcoming: ${context.title || 'Meeting'}`);
      if (context.startLocal) {
        addBullet(`🕐 Time: ${context.startLocal}`);
      }
      if (context.participants?.length) {
        const participantText = context.participants.slice(0, 2).join(', ');
        const extra = context.participants.length > 2 ? ` +${context.participants.length - 2} more` : '';
        addBullet(`👥 With: ${participantText}${extra}`);
      }
      (context.quickNotes || []).forEach(note => addBullet(note));
      if (!context.quickNotes?.length) {
        addSubtle("Tap me if you need help preparing.");
      }
    } else if (state === "live-call" && context) {
      addBullet(`🔴 Live: ${context.title || 'Meeting'}`);
      if (context.account) {
        addBullet(`🏢 Account: ${context.account}`);
      }
      if (context.oppAmount) {
        addBullet(`💰 Opportunity: $${context.oppAmount.toLocaleString()}`);
      }
      if (context.stage) {
        addBullet(`📈 Stage: ${context.stage}`);
      }
      if (context.participants?.length) {
        const participantText = context.participants.slice(0, 2).join(', ');
        const extra = context.participants.length > 2 ? ` +${context.participants.length - 2} more` : '';
        addBullet(`👥 Participants: ${participantText}${extra}`);
      }
      (context.keyPoints || []).forEach(point => addBullet(point));
      if (!context.keyPoints?.length) {
        addSubtle("Live meeting detected. Tap me if you need help.");
      }
    } else {
      addSubtle("I'm pinned here. Click me if you need help.");
    }

    console.log('[OpusOrb] State updated:', { state, context: !!context });
  }

  function addBullet(text) {
    const div = document.createElement('div');
    div.className = 'bullet';
    div.textContent = text;
    body.appendChild(div);
  }
  
  function addSubtle(text) {
    const div = document.createElement('div');
    div.className = 'subtle';
    div.textContent = text;
    body.appendChild(div);
  }

  // Toggle panel
  orb.addEventListener('click', (e) => { 
    e.preventDefault();
    e.stopPropagation();
    panel.classList.toggle('open'); 
    console.log('[OpusOrb] Panel toggled:', panel.classList.contains('open'));
  });

  // Close panel
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    panel.classList.remove('open');
  });

  // Handle simple Q&A (send to background for forwarding)
  const sendBtn = panel.querySelector('#send');
  const input = panel.querySelector('#q');
  
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    addBullet(`You: ${text}`);
    
    // Send to background script
    chrome.runtime.sendMessage({ type: "OPUS_ASK", text }, (response) => {
      if (response?.ok) {
        addBullet(`Opus: I received your message. This feature is coming soon!`);
      }
    });
  }
  
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Receive state from background script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "OPUS_STATE") {
      console.log('[OpusOrb] Received state update:', msg);
      setState(msg.state, msg.context);
    }
  });

  // Token handshake for web app (postMessage -> content -> background)
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin and same window for security
    if (event.source !== window || event.origin !== window.location.origin) return;
    
    const { type, opusToken } = event.data || {};
    if (type === 'OPUS_TOKEN_HANDSHAKE' && opusToken) {
      console.log('[OpusOrb] Received token handshake from web app');
      chrome.runtime.sendMessage({ type: "SET_TOKEN", token: opusToken }, (response) => {
        if (response?.ok) {
          console.log('[OpusOrb] Token successfully stored');
        } else {
          console.error('[OpusOrb] Failed to store token:', response);
        }
      });
    }
  });

  // Initialize with default state
  setState("idle", null);
  
  console.log('[OpusOrb] Content script initialized');
})();