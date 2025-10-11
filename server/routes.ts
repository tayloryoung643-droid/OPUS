import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { isGuestEnabled, isDemoMode, authenticateGuest, createGuestSession, ensureGuestUser, seedGuestData } from "./services/guestAuth";
import { storage } from "./storage";
import { generateProspectResearch, enhanceCompanyData } from "./services/openai";
import { createMCPServer } from "./mcp/mcp-server.js";
import OpenAI from "openai";
import { insertCompanySchema, insertContactSchema, insertCallSchema, insertCallPrepSchema, insertIntegrationSchema, insertCoachSessionSchema, insertCoachTranscriptSchema, insertCoachSuggestionSchema } from "@shared/schema";
import { integrationManager } from "./services/integrations/manager";
import { CryptoService } from "./services/crypto";
import { CoachWebSocketService } from "./services/coachWebSocket";
import { VoiceRecorderWebSocketService } from "./services/voiceRecorderWebSocket";
import { z } from "zod";
import jwt from "jsonwebtoken";
import gmailRoutes from "./routes/gmail";
import orbRoutes from "./routes/orb";
import orbExtensionRoutes from "./routes/orbExtension";
import internalTokensRoutes from "./routes/internalTokens";
import { generateRhythmInsights, generateOpusFeed } from "./services/insights";

export async function registerRoutes(app: Express): Promise<Server> {
  // Validate critical environment variables at startup
  if (!process.env.OPUS_JWT_SECRET) {
    console.error('FATAL: OPUS_JWT_SECRET environment variable is required');
    process.exit(1);
  }
  
  // Validate encryption key is set for production security
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === 'default-dev-key-change-in-production-32-chars') {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: ENCRYPTION_KEY must be set to a secure value in production');
      process.exit(1);
    } else {
      console.warn('WARNING: Using default encryption key in development. Set ENCRYPTION_KEY for production.');
    }
  }

  // Validate feature flags for production safety  
  const { validateProductionFlags } = await import('./config/flags.js');
  validateProductionFlags();

  // Setup Replit Auth (Google Sign-in support)
  await setupAuth(app);

  // Import ENV for CORS configuration
  const { ENV } = await import('./config/env.js');

  // Centralized CORS middleware for extension origins
  const setCORSHeaders = (req: any, res: any) => {
    const origin = req.headers.origin;
    
    // Allow main app origin
    if (origin === ENV.APP_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      return true;
    }
    
    // Allow chrome-extension origins (with basic validation)
    if (origin && origin.startsWith('chrome-extension://')) {
      // Basic validation - should be a valid chrome extension ID format
      const extensionId = origin.replace('chrome-extension://', '');
      if (/^[a-p]{32}$/.test(extensionId)) { // Chrome extension IDs are 32 chars, a-p only
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        return true;
      }
    }
    
    // Allow common external test origins for development/testing
    const allowedTestOrigins = [
      'https://www.google.com',
      'https://google.com',
      'https://example.com',
      'https://www.example.com'
    ];
    
    if (origin && allowedTestOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      return true;
    }
    
    return false;
  };

  // CORS preflight handler for auth endpoints
  const handleCORSPreflight = (req: any, res: any, next: any) => {
    if (req.method === 'OPTIONS') {
      const validOrigin = setCORSHeaders(req, res);
      
      if (validOrigin) {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        return res.status(200).end();
      } else {
        return res.status(403).end();
      }
    }
    
    // Set CORS headers for actual requests
    setCORSHeaders(req, res);
    next();
  };

  // Apply CORS middleware to auth endpoints BEFORE route registration
  app.use('/api/auth/extension', handleCORSPreflight);
  
  // Initialize guest user and seed data if enabled
  if (isGuestEnabled() || isDemoMode()) {
    await ensureGuestUser();
    await seedGuestData();
  }
  

  // Guest login route
  app.post('/api/auth/guest/login', async (req, res) => {
    try {
      if (!isGuestEnabled()) {
        return res.status(404).json({ message: "Guest login not enabled" });
      }

      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const isValid = await authenticateGuest(email, password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid guest credentials" });
      }

      // Create guest session
      createGuestSession(req);
      
      const user = await storage.getUser("usr_guest_momentum_ai");
      res.json({ user, guestMode: true });
    } catch (error) {
      console.error("Error with guest login:", error);
      res.status(500).json({ message: "Failed to login as guest" });
    }
  });

  // Extension token endpoint for Chrome extension authentication
  app.post('/api/auth/extension-token', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ 
          error: 'User ID not found',
          message: 'Unable to identify user for token generation'
        });
      }

      // Import here to avoid circular dependencies
      const { mintOrbToken } = await import('./auth/extensionToken.js');
      
      // Generate short-lived token for Chrome extension
      const opusToken = mintOrbToken(userId);
      
      console.log(`[ExtensionAuth] Generated token for user: ${userId}`);
      
      res.json({ 
        opusToken,
        expiresIn: '30m',
        scope: 'orb:read'
      });
      
    } catch (error) {
      console.error('[ExtensionAuth] Error generating token:', error);
      res.status(500).json({ 
        error: 'Token generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // In-memory store for one-time session codes (in production, use Redis)
  const sessionCodes = new Map<string, { userId: string; createdAt: number }>();
  
  // Clean up expired codes every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [code, data] of sessionCodes.entries()) {
      if (now - data.createdAt > 5 * 60 * 1000) { // 5 minutes
        sessionCodes.delete(code);
      }
    }
  }, 5 * 60 * 1000);

  // New token mint endpoint for unified session between web app and extension
  app.post('/api/auth/extension/mint', async (req, res) => {
    try {
      let userId: string | undefined;
      
      // Method 1: Try session-based authentication (user logged into web app)
      if (req.isAuthenticated && req.isAuthenticated()) {
        userId = req.user?.claims?.sub;
        console.log(`[ExtensionMint] Session auth for user: ${userId}`);
      }
      
      // Method 2: Try one-time code exchange
      if (!userId && req.body.code) {
        const codeData = sessionCodes.get(req.body.code);
        if (codeData && Date.now() - codeData.createdAt < 5 * 60 * 1000) {
          userId = codeData.userId;
          sessionCodes.delete(req.body.code); // One-time use
          console.log(`[ExtensionMint] Code exchange for user: ${userId}`);
        }
      }
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide valid session cookies or exchange code'
        });
      }

      // Import here to avoid circular dependencies
      const { ENV } = await import('./config/env.js');
      
      // Generate 60-minute JWT with expanded scopes for extension
      const extensionJwt = jwt.sign(
        {
          userId,
          orgId: userId, // For future multi-org support
          scopes: ['chat', 'mcp:calendar', 'mcp:salesforce'],
          type: 'extension',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (60 * 60) // 60 minutes
        },
        process.env.OPUS_JWT_SECRET!,
        { algorithm: 'HS256' }
      );

      console.log(`[ExtensionMint] Generated JWT for user ${userId}`);

      // Set CORS headers for chrome-extension origins
      const origin = req.headers.origin;
      if (origin && (origin.startsWith('chrome-extension://') || origin === ENV.APP_ORIGIN)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      res.json({
        jwt: extensionJwt,
        expiresIn: '60m',
        scopes: ['chat', 'mcp:calendar', 'mcp:salesforce'],
        user: {
          id: userId
        }
      });

    } catch (error) {
      console.error('[ExtensionMint] Error:', error);
      res.status(500).json({
        error: 'Token generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate one-time session codes for extension token exchange
  app.post('/api/auth/extension/session-code', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ 
          error: 'User ID not found',
          message: 'Unable to identify user for code generation'
        });
      }

      // Generate cryptographically secure one-time code
      const crypto = await import('crypto');
      const code = crypto.randomBytes(32).toString('hex');
      
      // Store code with expiration (5 minutes)
      sessionCodes.set(code, {
        userId,
        createdAt: Date.now()
      });
      
      console.log(`[ExtensionMint] Generated session code for user: ${userId}`);
      
      res.json({ 
        code,
        expiresIn: '5m',
        message: 'Use this code to authenticate the extension'
      });
      
    } catch (error) {
      console.error('[ExtensionMint] Session code error:', error);
      res.status(500).json({ 
        error: 'Code generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Enhanced auth middleware that supports both Replit auth and guest users
  const isAuthenticatedOrGuest = (req: any, res: any, next: any) => {
    // Check if this is a guest user session (either by ID or email)
    if (req.user?.claims?.sub === "usr_guest_momentum_ai" || req.user?.claims?.email === "guest@momentum.ai") {
      return next();
    }
    
    // Otherwise use standard authentication
    return isAuthenticated(req, res, next);
  };

  // Read-only middleware for guest users - blocks write operations
  const requireWriteAccess = (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    const userEmail = req.user?.claims?.email;
    
    // Check if this is a guest user (either by ID or email)
    if (userId === "usr_guest_momentum_ai" || userEmail === "guest@momentum.ai") {
      return res.status(403).json({ 
        message: "Demo mode: Write operations are not allowed. Please sign up for full access.",
        readOnly: true 
      });
    }
    
    return next();
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Standard /api/auth/me endpoint - returns 401 when no token
  app.get('/api/auth/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Generate WebSocket authentication token
  app.get('/api/auth/ws-token', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID not found" });
      }
      
      // Generate authentication token for WebSocket connection
      const token = VoiceRecorderWebSocketService.generateAuthToken(userId);
      const now = Date.now();
      const expiresAt = now + (5 * 60 * 1000); // 5 minutes from now
      
      // Security: Prevent token caching
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json({ 
        token,
        userId,
        expiresIn: '5 minutes',
        expiresAt: expiresAt
      });
    } catch (error) {
      console.error("Error generating WebSocket token:", error);
      res.status(500).json({ message: "Failed to generate authentication token" });
    }
  });

  // Debug endpoint - Echo active userId and email as App resolves it
  app.get('/api/debug/me', async (req: any, res) => {
    try {
      // Check if user is authenticated (session-based or JWT)
      const userId = req.user?.claims?.sub || req.user?.sub;
      const email = req.user?.claims?.email || req.user?.email;
      
      // In dev mode, provide dev_user if not authenticated
      const isDev = process.env.NODE_ENV !== 'production' || process.env.APP_DEV_BYPASS === 'true';
      
      const response = {
        userId: userId || (isDev ? 'dev_user' : null),
        email: email || (isDev ? 'dev@example.com' : null),
        authenticated: !!userId,
        devMode: isDev
      };
      
      // Explicitly set content type
      res.setHeader('Content-Type', 'application/json');
      return res.json(response);
    } catch (error) {
      console.error("Error in /api/debug/me:", error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        error: "Failed to resolve user identity",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Debug endpoint - Version and environment info
  app.get('/api/debug/version', async (req: any, res) => {
    try {
      const response = {
        gitSha: process.env.REPL_ID || 'dev',
        buildTime: new Date().toISOString(),
        env: {
          APP_DEV_BYPASS: !!ENV.APP_DEV_BYPASS,
          MCP_TOKEN_PROVIDER_SECRET: !!ENV.MCP_TOKEN_PROVIDER_SECRET
        }
      };
      
      res.setHeader('Content-Type', 'application/json');
      return res.json(response);
    } catch (error) {
      console.error("Error in /api/debug/version:", error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        error: "Failed to get version info",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Debug endpoint - Show integration connection status (NO TOKENS)
  app.get('/api/debug/integrations', async (req: any, res) => {
    try {
      const targetParam = typeof req.query.as === 'string' ? req.query.as.trim() : '';

      if (!targetParam) {
        return res.status(400).json({ error: 'Missing ?as=<email> query parameter' });
      }

      const isEmailLookup = targetParam.includes('@');
      const userRecord = isEmailLookup ? await storage.getUserByEmail(targetParam) : undefined;
      const resolvedUserId = userRecord?.id || (!isEmailLookup ? targetParam : undefined);

      let googleIntegration;
      let salesforceIntegration;

      if (resolvedUserId) {
        [googleIntegration, salesforceIntegration] = await Promise.all([
          storage.getGoogleIntegration(resolvedUserId),
          storage.getSalesforceIntegration(resolvedUserId)
        ]);
      }

      const response = {
        userId: targetParam,
        resolvedUserId: resolvedUserId || null,
        resolvedEmail: userRecord?.email || (isEmailLookup ? targetParam : null),
        google: {
          connected: !!googleIntegration?.isActive,
          scopes: googleIntegration?.scopes || [],
          expiry: googleIntegration?.tokenExpiry ? Math.floor(googleIntegration.tokenExpiry.getTime() / 1000) : null
        },
        salesforce: {
          connected: !!salesforceIntegration?.isActive,
          instanceUrlPresent: !!salesforceIntegration?.instanceUrl
        }
      };

      res.setHeader('Content-Type', 'application/json');
      return res.json(response);
    } catch (error) {
      console.error("Error in /api/debug/integrations:", error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        error: "Failed to check integrations",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // OpenAI Realtime API - Generate ephemeral tokens for WebRTC voice sessions with MCP integration
  app.post('/api/openai/realtime/token', isAuthenticated, async (req: any, res) => {
    try {
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";
      const userId = req.user?.claims?.sub || req.user?.sub;

      if (!OPENAI_API_KEY) {
        console.error('[OpenAI-Realtime] OPENAI_API_KEY environment variable not set');
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }

      // Load MCP context for this user
      const { createMcpContext } = await import('./mcp/client.js');
      const { buildSalesContext, formatContextForModel } = await import('./mcp/contextLoader.js');
      const { MCP_TOOL_DEFINITIONS } = await import('./mcp/types/mcp-types.js');

      console.log(`[OpenAI-Realtime] Building MCP context for user: ${userId}`);
      
      let salesContext = '';
      let tools: any[] = [];
      
      try {
        // Create MCP context and load sales data
        const mcpContext = await createMcpContext(userId);
        const context = await buildSalesContext({ mcp: mcpContext, userId });
        salesContext = formatContextForModel(context);
        
        // Convert MCP tools to OpenAI Realtime format
        tools = Object.values(MCP_TOOL_DEFINITIONS).map(tool => ({
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }));
        
        console.log(`[OpenAI-Realtime] Loaded context with ${tools.length} tools available`);
      } catch (contextError) {
        console.error('[OpenAI-Realtime] Error loading MCP context:', contextError);
        salesContext = 'Note: Some integrations may not be connected. Check Google Calendar and Salesforce connections.';
      }

      // Enhanced instructions with real-time context and anti-sample guardrails
      const instructions = `You are Opus, the ultimate AI sales partner with access to real-time data. 

CURRENT CONTEXT:
${salesContext}

CRITICAL RULES:
🚫 NEVER provide sample, mock, or placeholder data
🚫 NEVER say "Here's a sample..." or give examples as real data
🚫 If you don't have real data, say "I don't have that information right now" instead of making up data
✅ ALWAYS use your available tools to access real information from Google Calendar, Salesforce, and Gmail
✅ Provide specific insights based on actual data from your tools
✅ Be direct and actionable in your recommendations

AVAILABLE TOOLS: You have ${tools.length} tools for accessing real-time calendar events, CRM opportunities, contacts, call history, and email threads.

RESPONSE STYLE: Confident sales expert. Lead with data, follow with actionable recommendations. Keep responses concise for voice interaction.`;

      // Create realtime session with MCP tools and context
      const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "realtime=v1",
        },
        body: JSON.stringify({
          model: REALTIME_MODEL,
          voice: "verse", // Default voice for Opus
          modalities: ["audio", "text"],
          instructions: instructions,
          tools: tools.length > 0 ? tools : undefined // Only include tools if available
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAI-Realtime] Failed to create session:', errorText);
        return res.status(500).json({ 
          error: "Failed to create OpenAI Realtime session", 
          details: errorText 
        });
      }

      const sessionData = await response.json();
      console.log('[OpenAI-Realtime] Session created successfully with MCP integration');
      
      // Security: Prevent token caching
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      // Return the session data including client_secret.value for WebRTC
      res.json(sessionData);
    } catch (error) {
      console.error('[OpenAI-Realtime] Error creating session:', error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Integration routes for Outlook
  app.get("/api/integrations/outlook/setup", isAuthenticatedOrGuest, async (req, res) => {
    try {
      // For now, we'll show a coming soon message for Outlook
      // This would normally redirect to the Outlook OAuth flow
      res.status(501).json({ 
        message: "Outlook integration coming soon! We're working on adding support for Outlook calendar and email sync.",
        status: "coming_soon"
      });
    } catch (error) {
      console.error("Error setting up Outlook integration:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/integrations/outlook/status", isAuthenticatedOrGuest, async (req, res) => {
    try {
      // For now, always return not connected
      res.json({ 
        connected: false,
        service: "outlook"
      });
    } catch (error) {
      console.error("Error checking Outlook integration status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // MCP Proxy Routes - Server-to-server forwarding to MCP service
  // Auth middleware that derives userId from server session (never trusts client)
  const mcpAuthBypass = (req: any, res: any, next: any) => {
    const isDev = process.env.NODE_ENV !== 'production' || process.env.APP_DEV_BYPASS === 'true';
    
    if (isDev) {
      // Dev-only impersonation support
      const impersonateUser = req.headers['x-dev-user'] || req.query.as;
      const sessionUserId = req.user?.claims?.sub;
      
      // Use impersonation if provided, otherwise session user, otherwise default
      const userId = impersonateUser || sessionUserId || 'dev_user';
      
      // Initialize body if needed and OVERWRITE userId (never trust client)
      if (!req.body) req.body = {};
      req.body.userId = userId;
      
      return next();
    }
    
    // Production: require authentication
    return isAuthenticated(req, res, (err?: any) => {
      if (err) return next(err);
      
      // In production, ALWAYS derive userId from session (never trust client)
      const sessionUserId = req.user?.claims?.sub;
      if (!sessionUserId) {
        return res.status(401).json({ 
          error: { code: "UNAUTHORIZED", message: "User not authenticated" }
        });
      }
      
      // Initialize body if needed and OVERWRITE userId
      if (!req.body) req.body = {};
      req.body.userId = sessionUserId;
      
      next();
    });
  };

  // POST /api/mcp/:toolName → forwards to MCP at ${MCP_BASE_URL}/mcp/:toolName
  app.post("/api/mcp/:toolName", mcpAuthBypass, async (req: any, res) => {
    const startMs = Date.now();
    const rid = req.headers['x-request-id'] || `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const toolName = req.params.toolName;
    const route = `/api/mcp/${toolName}`;
    
    // userId is ALWAYS set by mcpAuthBypass middleware (never trust client)
    const userId = req.body.userId;
    
    try {
      if (!ENV.MCP_REMOTE_ENABLED) {
        const status = 503;
        console.log(JSON.stringify({ rid, route, userId, status, ms: Date.now() - startMs }));
        return res.status(status).json({ 
          error: { 
            code: "MCP_DISABLED", 
            message: "MCP service is not enabled" 
          } 
        });
      }

      if (!ENV.MCP_SERVICE_TOKEN) {
        console.error('[MCP-Proxy] MCP_SERVICE_TOKEN not configured');
        const status = 500;
        console.log(JSON.stringify({ rid, route, userId, status, ms: Date.now() - startMs }));
        return res.status(status).json({ 
          error: { 
            code: "CONFIG_ERROR", 
            message: "MCP service not properly configured" 
          } 
        });
      }

      // Normalize MCP_BASE_URL: remove trailing slashes, ensure https in production
      const mcpBaseUrl = ENV.MCP_BASE_URL.replace(/\/+$/, '');
      const url = `${mcpBaseUrl}/mcp/${toolName}`;

      // Forward request to MCP service with 15s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const mcpResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ENV.MCP_SERVICE_TOKEN}`,
            'Content-Type': 'application/json',
            'x-request-id': rid as string,
            'x-effective-user': userId
          },
          body: JSON.stringify(req.body), // userId already set by middleware
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseData = await mcpResponse.json();
        const status = mcpResponse.status;
        
        // Structured logging: {rid, route, userId, status, ms}
        console.log(JSON.stringify({ rid, route, userId, status, ms: Date.now() - startMs }));
        
        // Log errors for debugging
        if (!mcpResponse.ok) {
          console.error(`[MCP-Proxy:${rid}] Error: ${status}`, responseData);
        }

        // Return response with same status code
        res.status(status).json(responseData);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      const mcpBaseUrl = ENV.MCP_BASE_URL.replace(/\/+$/, '');
      const url = `${mcpBaseUrl}/mcp/${toolName}`;
      const status = 502;
      
      console.error(JSON.stringify({ 
        rid, 
        url, 
        mcpBaseUrl, 
        tokenLen: ENV.MCP_SERVICE_TOKEN?.length || 0,
        code: error.code || 'UNKNOWN',
        status: error.response?.status,
        message: error.message 
      }));
      
      // Structured logging for proxy errors
      console.log(JSON.stringify({ rid, route, userId, status, ms: Date.now() - startMs }));
      
      res.status(status).json({ 
        error: { 
          code: "PROXY_ERROR" 
        } 
      });
    }
  });

  // POST /api/agent/act → forwards to ${MCP_BASE_URL}/agent/act
  app.post("/api/agent/act", mcpAuthBypass, async (req: any, res) => {
    const startMs = Date.now();
    const rid = req.headers['x-request-id'] || `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const route = '/api/agent/act';
    
    // userId is ALWAYS set by mcpAuthBypass middleware (never trust client)
    const userId = req.body.userId;
    
    try {
      if (!ENV.MCP_REMOTE_ENABLED) {
        const status = 503;
        console.log(JSON.stringify({ rid, route, userId, status, ms: Date.now() - startMs }));
        return res.status(status).json({ 
          error: { 
            code: "MCP_DISABLED", 
            message: "MCP service is not enabled" 
          } 
        });
      }

      if (!ENV.MCP_SERVICE_TOKEN) {
        console.error('[Agent-Proxy] MCP_SERVICE_TOKEN not configured');
        const status = 500;
        console.log(JSON.stringify({ rid, route, userId, status, ms: Date.now() - startMs }));
        return res.status(status).json({ 
          error: { 
            code: "CONFIG_ERROR", 
            message: "Agent service not properly configured" 
          } 
        });
      }

      // Normalize MCP_BASE_URL: remove trailing slashes
      const mcpBaseUrl = ENV.MCP_BASE_URL.replace(/\/+$/, '');
      const url = `${mcpBaseUrl}/agent/act`;

      // Forward request to MCP agent endpoint with 15s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const mcpResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ENV.MCP_SERVICE_TOKEN}`,
            'Content-Type': 'application/json',
            'x-request-id': rid as string,
            'x-effective-user': userId
          },
          body: JSON.stringify(req.body), // userId already set by middleware
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseData = await mcpResponse.json();
        const status = mcpResponse.status;
        
        // Structured logging: {rid, route, userId, status, ms}
        console.log(JSON.stringify({ rid, route, userId, status, ms: Date.now() - startMs }));
        
        // Log errors for debugging
        if (!mcpResponse.ok) {
          console.error(`[Agent-Proxy:${rid}] Error: ${status}`, responseData);
        }

        // Return response with same status code
        res.status(status).json(responseData);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      const mcpBaseUrl = ENV.MCP_BASE_URL.replace(/\/+$/, '');
      const url = `${mcpBaseUrl}/agent/act`;
      const status = 502;
      
      console.error(JSON.stringify({ 
        rid, 
        url, 
        mcpBaseUrl, 
        tokenLen: ENV.MCP_SERVICE_TOKEN?.length || 0,
        code: error.code || 'UNKNOWN',
        status: error.response?.status,
        message: error.message 
      }));
      
      // Structured logging for proxy errors
      console.log(JSON.stringify({ rid, route, userId, status, ms: Date.now() - startMs }));
      
      res.status(status).json({ 
        error: { 
          code: "PROXY_ERROR" 
        } 
      });
    }
  });

  // Agent Builder integration - Generate sales prep using Agent Builder
  app.post("/api/agent/generate", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      const AGENT_ID = process.env.AGENT_ID;
      const userId = req.user?.claims?.sub;
      
      if (!OPENAI_API_KEY) {
        console.error('[Agent-Generate] OPENAI_API_KEY environment variable not set');
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }
      
      if (!AGENT_ID) {
        console.error('[Agent-Generate] AGENT_ID environment variable not set');
        return res.status(500).json({ error: "Agent ID not configured" });
      }

      const { eventId, timeMin, timeMax } = req.body;
      
      if (!eventId) {
        return res.status(400).json({ error: "eventId is required" });
      }

      console.log(`[Agent-Generate] Triggering Agent Builder for userId=${userId}, eventId=${eventId}`);

      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      
      // Create agent run with instruction to generate and save prep
      const run = await openai.responses.create({
        agent_id: AGENT_ID,
        input: [
          { 
            role: "user", 
            content: `Generate and save a sales prep for event ${eventId}. userId=${userId}. timeMin=${timeMin || new Date().toISOString()}. timeMax=${timeMax || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()}.` 
          }
        ],
        metadata: { userId, eventId, timeMin, timeMax }
      });

      console.log(`[Agent-Generate] Agent run created: ${(run as any).id}`);

      // Return the run ID so UI can track progress or poll for results
      res.json({ 
        runId: (run as any).id || null,
        eventId,
        userId,
        message: "Prep generation started. The agent will call MCP tools and save the prep."
      });
    } catch (error) {
      console.error('[Agent-Generate] Error creating agent run:', error);
      res.status(500).json({ 
        error: "Failed to start prep generation",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Combined integrations status endpoint
  app.get("/api/integrations/status", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      // Support ?as=<email> query param for dev mode
      const APP_DEV_BYPASS = process.env.APP_DEV_BYPASS === 'true';
      const asParamRaw = typeof req.query.as === 'string' ? req.query.as.trim() : '';

      let effectiveUserId: string | undefined = req.user?.claims?.sub;
      let effectiveEmail: string | undefined = req.user?.claims?.email;

      if (APP_DEV_BYPASS && asParamRaw) {
        if (asParamRaw.includes('@')) {
          const impersonatedUser = await storage.getUserByEmail(asParamRaw);

          if (!impersonatedUser) {
            const emptyGoogleStatus = {
              userId: asParamRaw,
              connected: false,
              scopes: [],
              expiry: null,
              service: "google"
            };

            const emptySalesforceStatus = {
              userId: asParamRaw,
              connected: false,
              instanceUrlPresent: false,
              service: "salesforce"
            };

            const outlookStatus = {
              connected: false,
              service: "outlook",
              message: "Outlook integration coming soon"
            };

            return res.json({
              userId: asParamRaw,
              resolvedUserId: null,
              google: emptyGoogleStatus,
              salesforce: emptySalesforceStatus,
              googleCalendar: emptyGoogleStatus,
              outlook: outlookStatus
            });
          }

          effectiveUserId = impersonatedUser.id;
          effectiveEmail = impersonatedUser.email;
        } else {
          effectiveUserId = asParamRaw;
          effectiveEmail = undefined;
        }
      }

      if (!effectiveUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get Google integration status
      const googleIntegration = await storage.getGoogleIntegration(effectiveUserId);
      const googleStatus = {
        userId: effectiveUserId,
        connected: !!(googleIntegration?.accessToken || googleIntegration?.refreshToken),
        scopes: googleIntegration?.scopes || [],
        expiry: googleIntegration?.tokenExpiry,
        service: "google",
        email: effectiveEmail || null
      };

      // Get Salesforce integration status
      const salesforceIntegration = await storage.getSalesforceIntegration(effectiveUserId);
      const salesforceStatus = {
        userId: effectiveUserId,
        connected: !!(salesforceIntegration?.accessToken || salesforceIntegration?.refreshToken),
        instanceUrlPresent: !!salesforceIntegration?.instanceUrl,
        service: "salesforce",
        email: effectiveEmail || null
      };

      // Outlook is always not connected for now
      const outlookStatus = {
        connected: false,
        service: "outlook",
        message: "Outlook integration coming soon"
      };

      res.json({
        userId: APP_DEV_BYPASS && asParamRaw ? asParamRaw : effectiveUserId,
        resolvedUserId: effectiveUserId,
        google: googleStatus,
        salesforce: salesforceStatus,
        googleCalendar: googleStatus, // Keep for backward compatibility
        outlook: outlookStatus
      });
    } catch (error) {
      console.error("Error checking integrations status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/integrations/outlook", isAuthenticatedOrGuest, requireWriteAccess, async (req, res) => {
    try {
      // For now, just return success
      res.json({ 
        message: "Outlook integration disconnected",
        status: "disconnected"
      });
    } catch (error) {
      console.error("Error disconnecting Outlook integration:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Google Calendar and Gmail integration routes
  app.get("/api/integrations/google/auth", async (req, res) => {
    const rid = (req as any).rid || `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const route = "/api/integrations/google/connect";
    
    // Allow bypass with ?as= parameter in dev mode
    const asParam = req.query.as as string;
    const APP_DEV_BYPASS = process.env.APP_DEV_BYPASS === 'true';
    
    if (!asParam || !APP_DEV_BYPASS) {
      // Require authentication if no ?as= parameter or not in dev mode
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }
    }
    
    const userId = asParam || req.user?.claims?.sub;
    
    // Structured logging: connect start
    console.log(JSON.stringify({ rid, route, userId }));
    
    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(501).json({
          message: "Google integration not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
          status: "not_configured"
        });
      }

      // Store user ID in session for callback
      (req as any).session.googleUserId = userId;

      const { googleAuth } = await import('./services/googleAuth');
      const authUrl = googleAuth.getAuthUrl();
      
      // If ?as= parameter is present (from debug page), store it in session and redirect
      if (asParam) {
        (req as any).session.googleDebugAs = asParam;
        return res.redirect(authUrl);
      }
      
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Google auth URL:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/integrations/google/callback", async (req: any, res) => {
    const rid = (req as any).rid || `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const route = "/api/integrations/google/oauth2/callback";
    
    try {
      const { code, as } = req.query;
      if (!code) {
        return res.status(400).json({ message: "Missing authorization code" });
      }

      const { googleAuth } = await import('./services/googleAuth');
      // Get user ID from session
      const sessionUserId = (req as any).session.googleUserId;
      const sessionDebugAs = (req as any).session.googleDebugAs;
      
      // Implement effectiveUserId logic with APP_DEV_BYPASS
      const APP_DEV_BYPASS = process.env.APP_DEV_BYPASS === 'true';
      const effectiveUserId = (APP_DEV_BYPASS && (as || sessionDebugAs)) ? (as || sessionDebugAs) : sessionUserId;
      
      if (!effectiveUserId) {
        return res.status(400).json({ message: "Missing user session" });
      }

      // Clear user ID and debug email from session
      delete (req as any).session.googleUserId;
      delete (req as any).session.googleDebugAs;

      const tokens = await googleAuth.getTokens(code);
      
      // Structured logging: callback with token info (no secrets)
      console.log(JSON.stringify({
        rid,
        route,
        userId: effectiveUserId,
        received: {
          accessToken: !!tokens.access_token,
          refreshToken: !!tokens.refresh_token,
          scopes: tokens.scope?.split(' ') || []
        }
      }));
      
      // Check if user already has a Google integration
      const existingIntegration = await storage.getGoogleIntegration(effectiveUserId);
      
      const googleIntegrationData = {
        userId: effectiveUserId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scopes: tokens.scope?.split(' ') || [],
        isActive: true
      };

      if (existingIntegration) {
        await storage.updateGoogleIntegration(effectiveUserId, googleIntegrationData);
      } else {
        await storage.createGoogleIntegration(googleIntegrationData);
      }

      // Structured logging: callback save result (no secrets)
      console.log(JSON.stringify({
        rid,
        route: 'google/callback',
        userId: effectiveUserId,
        saved: {
          hasAccess: !!tokens.access_token,
          hasRefresh: !!tokens.refresh_token,
          scopesCount: googleIntegrationData.scopes.length,
          hasInstanceUrl: false // Google doesn't use instance URL
        }
      }));

      // Redirect back to appropriate page
      const redirectUrl = as ? `/debug/connect?as=${encodeURIComponent(as)}` : '/?google_connected=true';
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Error handling Google OAuth callback:", error);
      const { as } = req.query;
      const redirectUrl = as ? `/debug/connect?as=${encodeURIComponent(as)}` : '/?google_error=true';
      res.redirect(redirectUrl);
    }
  });

  app.get("/api/integrations/google/status", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const googleIntegration = await storage.getGoogleIntegration(userId);
      
      res.json({
        connected: !!googleIntegration?.isActive,
        scopes: googleIntegration?.scopes || [],
        connectedAt: googleIntegration?.createdAt,
        service: "google"
      });
    } catch (error) {
      console.error("Error checking Google integration status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/integrations/google", isAuthenticatedOrGuest, requireWriteAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteGoogleIntegration(userId);
      
      res.json({
        message: "Google integration disconnected successfully",
        status: "disconnected"
      });
    } catch (error) {
      console.error("Error disconnecting Google integration:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Internal routes - Server-to-server only (NO CORS, uses bearer token auth)
  app.use("/internal", internalTokensRoutes);

  // Gmail routes - Mount the Gmail router
  app.use("/api/gmail", isAuthenticatedOrGuest, gmailRoutes);

  // Orb routes - Chrome extension endpoints (uses own auth middleware)
  app.use("/api/orb", orbRoutes);
  
  // Orb extension bootstrap endpoint
  app.use("/api/orb/extension", orbExtensionRoutes);

  // Import crypto for UUID generation
  const crypto = await import('crypto');

  // Apply CORS middleware to chat endpoints  
  app.use('/api/chat', handleCORSPreflight);

  // Hybrid auth middleware for chat endpoints - supports both session auth and JWT Bearer tokens
  const isAuthenticatedOrJWT = async (req: any, res: any, next: any) => {
    // First try JWT Bearer token authentication (for extension)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyOrbToken } = await import('./auth/extensionToken.js');
        const token = authHeader.slice(7);
        const payload = verifyOrbToken(token);
        
        // Set user claims for compatibility with existing endpoints
        req.user = {
          claims: {
            sub: payload.userId
          }
        };
        req.orbToken = payload;
        return next();
      } catch (error) {
        console.error('[ChatAuth] JWT verification failed:', error);
        return res.status(401).json({ 
          error: 'Invalid token',
          message: 'JWT verification failed'
        });
      }
    }
    
    // Fallback to session-based authentication (for web app)
    return isAuthenticatedOrGuest(req, res, next);
  };

  // Chat session management endpoints for unified Opus chat
  app.post("/api/chat/session", isAuthenticatedOrJWT, requireWriteAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId } = req.body;
      
      if (!conversationId) {
        return res.status(400).json({ error: "conversationId is required" });
      }
      
      // Upsert session (create if doesn't exist, return if exists)
      const session = await storage.upsertChatSession(userId, conversationId);
      
      res.json({ 
        conversationId: session.conversationId,
        sessionId: session.id 
      });
    } catch (error) {
      console.error("Error creating/getting chat session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.get("/api/chat/history", isAuthenticatedOrJWT, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = req.query.conversationId as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500); // Max 500 messages
      const offset = parseInt(req.query.offset as string) || 0;
      
      if (!conversationId) {
        return res.status(400).json({ error: "conversationId is required" });
      }
      
      // Verify user owns this conversation
      const session = await storage.getChatSessionByUserId(userId, conversationId);
      if (!session) {
        return res.json({ messages: [], total: 0, hasMore: false }); // Return empty if session doesn't exist
      }
      
      const total = await storage.getChatMessageCountByConversationId(conversationId);
      const paginatedMessages = await storage.getChatMessagesByConversationId(conversationId, limit, offset);
      
      // Transform to expected format
      const formattedMessages = paginatedMessages.map(msg => ({
        id: msg.messageId,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp).getTime()
      }));
      
      res.json({ 
        messages: formattedMessages,
        total,
        hasMore: offset + limit < total,
        offset,
        limit
      });
    } catch (error) {
      console.error("Error getting chat history:", error);
      res.status(500).json({ error: "Failed to get chat history" });
    }
  });

  app.post("/api/chat/events", isAuthenticatedOrJWT, requireWriteAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId, messages } = req.body;
      
      if (!conversationId || !Array.isArray(messages)) {
        return res.status(400).json({ error: "conversationId and messages array are required" });
      }
      
      // Ensure session exists and user owns it
      const session = await storage.upsertChatSession(userId, conversationId);
      
      // Validate messages array
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages must be a non-empty array" });
      }
      
      if (messages.length > 100) {
        return res.status(400).json({ error: "Too many messages in batch (max 100)" });
      }

      // Transform messages to database format with validation
      const dbMessages = messages.map(msg => {
        // Validate required fields
        if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
          throw new Error(`Invalid role: ${msg.role}`);
        }
        if (!msg.content || typeof msg.content !== 'string') {
          throw new Error('Content is required and must be a string');
        }
        if (msg.content.length > 10000) {
          throw new Error('Message content too long (max 10000 characters)');
        }
        
        return {
          messageId: msg.id || crypto.randomUUID(),
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp || Date.now())
        };
      });
      
      // Save messages to database
      await storage.saveChatMessages(session.id, dbMessages);
      
      res.json({ success: true, saved: messages.length });
    } catch (error) {
      console.error("Error saving chat messages:", error);
      res.status(500).json({ error: "Failed to save chat messages" });
    }
  });

  // GET /api/chat/context - get comprehensive context through MCP
  app.get("/api/chat/context", isAuthenticatedOrJWT, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Import the unified MCP context resolver
      const { createUnifiedMCPResolver } = await import('./mcp/contextResolver.js');
      
      // Create and use the MCP resolver to get context
      const mcpResolver = await createUnifiedMCPResolver(userId);
      const context = await mcpResolver.buildComprehensiveContext();
      
      console.log(`[Chat API] Provided MCP context for user ${userId}`);
      res.json(context);
    } catch (error) {
      console.error('[Chat API] Error fetching MCP context:', error);
      res.status(500).json({ 
        error: 'Failed to fetch context',
        integrationStatus: { hasGoogle: false, hasSalesforce: false, hasGmail: false },
        calendarEvents: { events: [], total: 0 },
        opportunities: { opportunities: [], total: 0 },
        recentContacts: { contacts: [], total: 0 }
      });
    }
  });

  // POST /api/chat - send message and get AI response
  app.post("/api/chat", isAuthenticatedOrJWT, requireWriteAccess, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { message, conversationId } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required and must be a string" });
      }

      if (!conversationId || typeof conversationId !== 'string') {
        return res.status(400).json({ error: "conversationId is required" });
      }

      // Ensure session exists
      const session = await storage.upsertChatSession(userId, conversationId);

      // Get MCP context for the AI
      const { createUnifiedMCPResolver } = await import('./mcp/contextResolver.js');
      const mcpResolver = await createUnifiedMCPResolver(userId);
      const context = await mcpResolver.buildComprehensiveContext();

      // Load existing conversation history
      const existingMessages = await storage.getChatMessagesByConversationId(conversationId, 50, 0);

      // Format messages for OpenAI
      const formattedMessages = existingMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      // Add current user message
      formattedMessages.push({ role: 'user', content: message });

      // Prepare system message with context
      const systemMessage = {
        role: 'system' as const,
        content: `You are Opus, an emotional, personal AI partner. Use the provided context to give helpful, personalized responses.

Integration Status:
- Google Calendar: ${context.integrationStatus.hasGoogle ? 'Connected' : 'Not Connected'}
- Salesforce CRM: ${context.integrationStatus.hasSalesforce ? 'Connected' : 'Not Connected'}  
- Gmail: ${context.integrationStatus.hasGmail ? 'Connected' : 'Not Connected'}

Available Data:
- Calendar Events: ${context.calendarEvents.total} events
- CRM Opportunities: ${context.opportunities.total} opportunities
- Recent Contacts: ${context.recentContacts.total} contacts

IMPORTANT: Only use real data from the context above. Never fabricate or use sample data like "Acme Corp", "DataFlow Systems", etc.`
      };

      // Call OpenAI
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [systemMessage, ...formattedMessages],
        temperature: 0.7,
        max_tokens: 1000
      });

      const assistantMessage = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      // Save both user and assistant messages with proper chronological timestamps
      const userTimestamp = new Date();
      const assistantTimestamp = new Date(userTimestamp.getTime() + 1); // Ensure assistant is 1ms later
      
      const messagesToSave = [
        {
          messageId: crypto.randomUUID(),
          role: 'user' as const,
          content: message,
          timestamp: userTimestamp
        },
        {
          messageId: crypto.randomUUID(),
          role: 'assistant' as const,
          content: assistantMessage,
          timestamp: assistantTimestamp
        }
      ];

      await storage.saveChatMessages(session.id, messagesToSave);

      // Return the AI response
      res.json({
        message: assistantMessage,
        conversationId,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  // Insights routes for Rhythm and Opus feed
  app.get("/api/insights/rhythm", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rhythmItems = await generateRhythmInsights(userId);
      res.json({ items: rhythmItems });
    } catch (error) {
      console.error("Error generating rhythm insights:", error);
      res.json({ items: [] }); // Fail silent as per spec
    }
  });

  app.get("/api/insights/opus-feed", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const opusFeedItems = await generateOpusFeed(userId);
      res.json({ items: opusFeedItems });
    } catch (error) {
      console.error("Error generating opus feed:", error);
      res.json({ items: [] }); // Fail silent as per spec
    }
  });

  // Salesforce CRM integration routes
  app.get("/api/integrations/salesforce/auth", async (req, res) => {
    const rid = (req as any).rid || `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const route = "/api/integrations/salesforce/connect";
    
    // Allow bypass with ?as= parameter in dev mode
    const asParam = req.query.as as string;
    const APP_DEV_BYPASS = process.env.APP_DEV_BYPASS === 'true';
    
    if (!asParam || !APP_DEV_BYPASS) {
      // Require authentication if no ?as= parameter or not in dev mode
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }
    }
    
    const userId = asParam || req.user?.claims?.sub;
    
    // Structured logging: connect start
    console.log(JSON.stringify({ rid, route, userId }));
    
    try {
      if (!process.env.SALESFORCE_CLIENT_ID || !process.env.SALESFORCE_CLIENT_SECRET) {
        return res.status(501).json({
          message: "Salesforce integration not configured. Please set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET environment variables.",
          status: "not_configured"
        });
      }

      const { salesforceAuth } = await import('./services/salesforceAuth');
      const crypto = await import('crypto');
      
      // Generate CSRF state token for security
      const state = crypto.randomBytes(16).toString('hex');
      
      // Store user ID and state in session for callback
      (req as any).session.salesforceUserId = userId;
      (req as any).session.salesforceState = state;
      
      const authUrl = salesforceAuth.getAuthUrl(state);
      
      // If ?as= parameter is present (from debug page), store it in session and redirect
      if (asParam) {
        (req as any).session.salesforceDebugAs = asParam;
        return res.redirect(authUrl);
      }
      
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Salesforce auth URL:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/integrations/salesforce/callback", async (req: any, res) => {
    const rid = (req as any).rid || `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const route = "/api/integrations/salesforce/oauth2/callback";
    
    try {
      const { code, state, as } = req.query;
      
      if (!code) {
        return res.status(400).json({ message: "Missing authorization code" });
      }

      // Validate CSRF state
      if (!state || state !== req.session.salesforceState) {
        return res.status(400).json({ message: "Invalid state parameter" });
      }

      // Get user ID from session
      const sessionUserId = (req as any).session.salesforceUserId;
      const sessionDebugAs = (req as any).session.salesforceDebugAs;
      
      // Implement effectiveUserId logic with APP_DEV_BYPASS
      const APP_DEV_BYPASS = process.env.APP_DEV_BYPASS === 'true';
      const effectiveUserId = (APP_DEV_BYPASS && (as || sessionDebugAs)) ? (as || sessionDebugAs) : sessionUserId;
      
      if (!effectiveUserId) {
        return res.status(400).json({ message: "Missing user session" });
      }

      // Clear state, user ID, and debug email from session
      delete req.session.salesforceState;
      delete (req as any).session.salesforceUserId;
      delete (req as any).session.salesforceDebugAs;

      const { salesforceAuth } = await import('./services/salesforceAuth');
      const tokens = await salesforceAuth.getTokens(code);
      
      // Structured logging: callback with token info (no secrets)
      console.log(JSON.stringify({
        rid,
        route,
        userId: effectiveUserId,
        received: {
          accessToken: !!tokens.access_token,
          refreshToken: !!tokens.refresh_token,
          instanceUrlPresent: !!tokens.instance_url
        }
      }));
      
      // Check if user already has a Salesforce integration
      const existingIntegration = await storage.getSalesforceIntegration(effectiveUserId);
      
      const salesforceIntegrationData = {
        userId: effectiveUserId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        instanceUrl: tokens.instance_url,
        tokenExpiry: tokens.token_expiry || null,
        isActive: true
      };

      if (existingIntegration) {
        await storage.updateSalesforceIntegration(effectiveUserId, salesforceIntegrationData);
      } else {
        await storage.createSalesforceIntegration(salesforceIntegrationData);
      }

      // Structured logging: callback save result (no secrets)
      console.log(JSON.stringify({
        rid,
        route: 'salesforce/callback',
        userId: effectiveUserId,
        saved: {
          hasAccess: !!tokens.access_token,
          hasRefresh: !!tokens.refresh_token,
          scopesCount: 0, // Salesforce doesn't return scopes in token response
          hasInstanceUrl: !!tokens.instance_url
        }
      }));

      // Redirect back to appropriate page
      const redirectUrl = as ? `/debug/connect?as=${encodeURIComponent(as)}` : '/?salesforce_connected=true';
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Error handling Salesforce OAuth callback:", error);
      const { as } = req.query;
      const redirectUrl = as ? `/debug/connect?as=${encodeURIComponent(as)}` : '/?salesforce_error=true';
      res.redirect(redirectUrl);
    }
  });

  app.get("/api/integrations/salesforce/status", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const salesforceIntegration = await storage.getSalesforceIntegration(userId);
      
      res.json({
        connected: !!salesforceIntegration?.isActive,
        instanceUrl: salesforceIntegration?.instanceUrl,
        connectedAt: salesforceIntegration?.createdAt,
        scopes: salesforceIntegration?.scopes || [],
        service: "salesforce"
      });
    } catch (error) {
      console.error("Error checking Salesforce integration status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/integrations/salesforce", isAuthenticatedOrGuest, requireWriteAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteSalesforceIntegration(userId);
      
      res.json({
        message: "Salesforce integration disconnected successfully",
        status: "disconnected"
      });
    } catch (error) {
      console.error("Error disconnecting Salesforce integration:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Salesforce CRM data routes
  app.get("/api/integrations/salesforce/leads", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { salesforceCrmService } = await import('./services/salesforceCrm');
      
      const leads = await salesforceCrmService.getLeads(userId, 50);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching Salesforce leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/integrations/salesforce/opportunities", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { salesforceCrmService } = await import('./services/salesforceCrm');
      
      const opportunities = await salesforceCrmService.getOpportunities(userId, 50);
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching Salesforce opportunities:", error);
      res.status(500).json({ message: "Failed to fetch opportunities" });
    }
  });

  app.get("/api/integrations/salesforce/contacts", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { salesforceCrmService } = await import('./services/salesforceCrm');
      
      const contacts = await salesforceCrmService.getContacts(userId, 50);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching Salesforce contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Google Calendar data routes
  app.get("/api/calendar/events", isAuthenticated, async (req: any, res) => {
    try {
      // Return mock data only if explicitly in demo mode with demo header
      if (process.env.VITE_DEMO_MODE === "true" && req.headers["x-demo"] === "1") {
        const { loadGuestSeedData } = await import('./services/guestAuth');
        try {
          const seedData = loadGuestSeedData();
          return res.json(seedData.calendar.events);
        } catch (error) {
          console.warn("Could not load demo data, falling back to empty array");
          return res.json([]);
        }
      }

      const userId = req.user.claims.sub;
      const { googleCalendarService } = await import('./services/googleCalendar');
      
      const events = await googleCalendarService.getUpcomingEvents(userId, 10);
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  app.get("/api/calendar/today", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { googleCalendarService } = await import('./services/googleCalendar');

      const events = await googleCalendarService.getTodaysEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching today's calendar events:", error);
      res.status(500).json({ message: "Failed to fetch today's events" });
    }
  });

  app.post("/api/calendar/events/:eventId/ensure-call", isAuthenticatedOrGuest, requireWriteAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId } = req.params;
      if (!eventId) {
        return res.status(400).json({ message: "Missing event ID" });
      }

      const { googleCalendarService } = await import('./services/googleCalendar');
      const event = await googleCalendarService.getEventById(userId, eventId);

      if (!event) {
        return res.status(404).json({ message: "Calendar event not found" });
      }

      let integration = await storage.getIntegrationByName("google_calendar");
      if (!integration) {
        integration = await storage.createIntegration({
          name: "google_calendar",
          type: "calendar",
          status: "active",
        });
      }

      const integrationId = integration.id;
      const externalId = `${userId}:${event.id}`;
      const existingMapping = await storage.getIntegrationDataByExternalId(
        integrationId,
        "call",
        externalId
      );

      const eventStart = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(`${event.start.date}T00:00:00Z`)
          : new Date();
      const eventEnd = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(`${event.end.date}T23:59:59Z`)
          : undefined;
      const now = new Date();
      const status = eventEnd && eventEnd.getTime() < now.getTime() ? "completed" : "upcoming";

      let call = existingMapping?.localId
        ? await storage.getCall(existingMapping.localId)
        : undefined;

      const callPayload = {
        title: event.summary || "No Title",
        scheduledAt: eventStart,
        status,
        callType: "meeting",
      };

      if (call) {
        const updates: Record<string, any> = {};
        if (call.title !== callPayload.title) {
          updates.title = callPayload.title;
        }
        const scheduledAtIso =
          call.scheduledAt instanceof Date
            ? call.scheduledAt.toISOString()
            : new Date(call.scheduledAt as any).toISOString();
        if (scheduledAtIso !== eventStart.toISOString()) {
          updates.scheduledAt = eventStart;
        }
        if (call.status !== callPayload.status) {
          updates.status = callPayload.status;
        }
        if (call.callType !== callPayload.callType) {
          updates.callType = callPayload.callType;
        }

        if (Object.keys(updates).length > 0) {
          call = await storage.updateCall(call.id, updates);
        }

        if (existingMapping) {
          await storage.updateIntegrationData(existingMapping.id, {
            localId: call.id,
            data: event as any,
          });
        }
      } else {
        call = await storage.createCall(callPayload);

        if (existingMapping) {
          await storage.updateIntegrationData(existingMapping.id, {
            localId: call.id,
            data: event as any,
          });
        } else {
          await storage.createIntegrationData({
            integrationId,
            externalId,
            dataType: "call",
            data: event as any,
            localId: call.id,
          });
        }
      }

      const callDetails = call ? await buildCallDetails(call.id) : null;
      if (!callDetails) {
        return res.status(404).json({ message: "Call not found" });
      }

      res.json({
        ...callDetails,
        source: "calendar",
        calendarEvent: event,
      });
    } catch (error) {
      console.error("Error ensuring calendar call:", error);
      res.status(500).json({ message: "Failed to open calendar event" });
    }
  });

  // Get all calls with company data
  const buildCallDetails = async (callId: string) => {
    const call = await storage.getCall(callId);
    if (!call) {
      return null;
    }

    const company = call.companyId ? await storage.getCompany(call.companyId) : null;
    const contacts = call.companyId ? await storage.getContactsByCompany(call.companyId) : [];
    const callPrep = await storage.getCallPrep(call.id);

    return {
      call,
      company,
      contacts,
      callPrep,
    };
  };

  app.get("/api/calls", async (req, res) => {
    try {
      const calls = await storage.getCallsWithCompany();
      res.json(calls);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calls" });
    }
  });

  // Get upcoming calls
  app.get("/api/calls/upcoming", async (req, res) => {
    try {
      const calls = await storage.getUpcomingCalls();
      res.json(calls);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch upcoming calls" });
    }
  });

  // Get previous calls
  app.get("/api/calls/previous", async (req, res) => {
    try {
      const calls = await storage.getPreviousCalls();
      res.json(calls);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch previous calls" });
    }
  });

  // Get specific call with full details
  app.get("/api/calls/:id", async (req, res) => {
    try {
      const callDetails = await buildCallDetails(req.params.id);
      if (!callDetails) {
        return res.status(404).json({ message: "Call not found" });
      }

      res.json(callDetails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch call details" });
    }
  });

  // Create new company
  app.post("/api/companies", isAuthenticatedOrGuest, requireWriteAccess, async (req, res) => {
    try {
      const data = insertCompanySchema.parse(req.body);
      
      // Check if company already exists by domain
      if (data.domain) {
        const existing = await storage.getCompanyByDomain(data.domain);
        if (existing) {
          return res.json(existing);
        }
      }

      // Enhance company data with AI
      const enhancedData = await enhanceCompanyData(data.name, data.domain || undefined);
      
      const company = await storage.createCompany({
        ...data,
        industry: data.industry || enhancedData.industry,
        size: data.size || enhancedData.size,
        description: data.description || enhancedData.description,
        recentNews: enhancedData.recentNews
      });

      res.json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid company data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  // Create new contact
  app.post("/api/contacts", isAuthenticatedOrGuest, requireWriteAccess, async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(data);
      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // Create new call
  app.post("/api/calls", isAuthenticatedOrGuest, requireWriteAccess, async (req, res) => {
    try {
      const data = insertCallSchema.parse(req.body);
      const call = await storage.createCall(data);
      res.json(call);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid call data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create call" });
    }
  });

  // Helper function for parsing invite text to bullet points
  function parseInviteToBullets(text: string): string[] {
    return (text || '')
      .split('\n')
      .map(l => l.trim().replace(/^[-*•]\s*/, ''))
      .filter(Boolean)
      .slice(0, 10);
  }

  // Generate AI call prep
  app.post("/api/calls/:id/generate-prep", isAuthenticatedOrGuest, requireWriteAccess, async (req, res) => {
    try {
      console.log(`[MCP-Route] Starting call prep generation for call: ${req.params.id}`);
      
      const call = await storage.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      // Create MCP server with context early for use in both partial and full modes
      let mcpServer = null;
      try {
        const userId = req.user?.claims?.sub;
        if (userId) {
          mcpServer = createMCPServer({
            userId,
            storage,
            googleCalendarService: undefined, // Will be imported dynamically by tools
            salesforceCrmService: undefined   // Will be imported dynamically by tools
          });
          
          console.log('[MCP-Route] Created MCP server for call prep generation');
        } else {
          console.log('[MCP-Route] No user ID found, MCP server not created');
        }
      } catch (mcpError) {
        console.warn('[MCP-Route] Failed to create MCP server, continuing with static generation:', mcpError);
      }

      const company = call.companyId ? await storage.getCompany(call.companyId) : null;
      const contacts = call.companyId ? await storage.getContactsByCompany(call.companyId) : [];

          // If no company found, try to resolve using Account Resolver
      if (!company) {
        const { AccountResolver } = await import('./services/accountResolver');
        const resolver = new AccountResolver(storage);
        
        let candidates: any[] = [];
        let calendarEvent = null;
        
        try {
          // Try to find the original calendar event for this call
          const integration = await storage.getIntegrationByName("google_calendar");
          if (integration && req.user?.claims?.sub) {
            const userId = req.user.claims.sub;
            const externalId = `${userId}:*`; // We'll need to find the right event ID
            
            // Get integration data to find calendar event ID
            const integrationDataList = await storage.getIntegrationData(integration.id, "call");
            const callMapping = integrationDataList.find(data => data.localId === call.id);
            
            if (callMapping) {
              // Extract event ID from external ID format: "userId:eventId" 
              const eventId = callMapping.externalId.split(':')[1];
              console.log(`[AccountResolver] Found calendar event ID: ${eventId} for call ${call.id}`);
              
              // Fetch original calendar event with attendees
              const { googleCalendarService } = await import('./services/googleCalendar');
              calendarEvent = await googleCalendarService.getEventById(userId, eventId);
              
              if (calendarEvent) {
                console.log(`[AccountResolver] Found calendar event: ${calendarEvent.summary}, attendees: ${calendarEvent.attendees?.length || 0}`);
                
                // Use Account Resolver to find matches
                const match = await resolver.resolve(calendarEvent);
                
                if (match.confidence > 0) {
                  candidates = [{
                    company: match.company,
                    contacts: match.contacts,
                    confidence: match.confidence,
                    matchType: match.matchType,
                    matchDetails: match.matchDetails
                  }];
                  console.log(`[AccountResolver] Found ${candidates.length} candidates, top confidence: ${match.confidence}%`);
                }
              }
            }
          }
        } catch (error) {
          console.error('[AccountResolver] Error resolving accounts:', error);
        }

        console.info(`[prepSheet] generation mode: partial, candidates: ${candidates.length}`);
        
        // Generate AI-enhanced prep even for partial mode using MCP tools
        try {
          console.log('[prepSheet] Generating MCP-enhanced prep for partial mode');
          
          const research = await generateProspectResearch({
            companyName: calendarEvent?.summary || call.title || 'Meeting',
            companyDomain: undefined,
            industry: undefined,
            contactName: calendarEvent?.attendees?.[0]?.email?.split('@')[0] || 'Contact',
            contactEmail: calendarEvent?.attendees?.[0]?.email || undefined,
            contactTitle: undefined,
            mcpServer: mcpServer,
            callTitle: calendarEvent?.summary || call.title,
            callDescription: calendarEvent?.description
          });

          console.log('[prepSheet] MCP-enhanced partial mode generation completed');
          
          // Save the generated AI research to prep notes
          const userId = req.user?.claims?.sub;
          const calendarEventId = calendarEvent?.id;
          if (userId && calendarEventId && research) {
            try {
              const prepText = `AI-Generated Call Preparation

Executive Summary:
${research.executiveSummary || 'N/A'}

Conversation Strategy:
${research.conversationStrategy || 'N/A'}

Competitive Landscape:
${research.competitiveLandscape || 'N/A'}

Immediate Opportunities:
${research.immediateOpportunities?.join('\n• ') || 'N/A'}

Deal Risks:
${research.dealRisks?.join('\n• ') || 'N/A'}

Strategic Expansion:
${research.strategicExpansion?.join('\n• ') || 'N/A'}`;

              await storage.upsertPrepNote(userId, calendarEventId, prepText);
              console.log('[prepSheet] Saved AI-generated content to prep notes');
            } catch (error) {
              console.warn('[prepSheet] Failed to save prep notes:', error);
            }
          }
          
          return res.status(200).json({
            mode: 'partial',
            sheet: {
              notesSectionFirst: true,
              banner: candidates.length > 0 
                ? 'Account suggestions found. Link an account to enrich with full prep.' 
                : 'AI-generated prep sheet ready. Link an account for AI insights.',
              eventSummary: { 
                title: call.title, 
                start: call.scheduledAt, 
                end: null, 
                location: null 
              },
              attendees: calendarEvent?.attendees?.map(a => ({
                email: a.email,
                name: a.displayName,
                status: a.responseStatus
              })) || [],
              organizer: calendarEvent?.organizer,
              agendaFromInvite: parseInviteToBullets(calendarEvent?.description || ''),
              actionItems: research?.immediateOpportunities || [],
              risks: research?.dealRisks || [],
              // Add AI-generated sections for partial mode
              partialPrep: {
                executiveSummary: research?.executiveSummary || '',
                conversationStrategy: research?.conversationStrategy || '',
                competitiveLandscape: research?.competitiveLandscape || ''
              }
            },
            needsSelection: candidates.length > 0,
            candidates: candidates
          });
        } catch (error) {
          console.warn('[prepSheet] MCP-enhanced partial generation failed, falling back to basic mode:', error);
          
          return res.status(200).json({
            mode: 'partial',
            sheet: {
              notesSectionFirst: true,
              banner: candidates.length > 0 
                ? 'Account suggestions found. Link an account to enrich with full prep.' 
                : 'Limited context: no account linked yet. Link an account to enrich.',
              eventSummary: { 
                title: call.title, 
                start: call.scheduledAt, 
                end: null, 
                location: null 
              },
              attendees: calendarEvent?.attendees?.map(a => ({
                email: a.email,
                name: a.displayName,
                status: a.responseStatus
              })) || [],
              organizer: calendarEvent?.organizer,
              agendaFromInvite: parseInviteToBullets(calendarEvent?.description || ''),
              actionItems: [],
              risks: []
            },
            needsSelection: candidates.length > 0,
            candidates: candidates
          });
        }
      }

      // Generate AI-powered research with MCP tools for dynamic data access
      const research = await generateProspectResearch({
        companyName: company.name,
        companyDomain: company.domain || undefined,
        industry: company.industry || undefined,
        contactEmails: contacts.map(c => c.email)
      }, mcpServer);

      // Create or update call prep
      const existingPrep = await storage.getCallPrep(call.id);
      
      let callPrep;
      if (existingPrep) {
        callPrep = await storage.updateCallPrep(call.id, {
          executiveSummary: research.executiveSummary,
          crmHistory: research.crmHistory,
          competitiveLandscape: research.competitiveLandscape,
          conversationStrategy: research.conversationStrategy,
          dealRisks: research.dealRisks,
          immediateOpportunities: research.immediateOpportunities,
          strategicExpansion: research.strategicExpansion,
          isGenerated: true
        });
      } else {
        callPrep = await storage.createCallPrep({
          callId: call.id,
          executiveSummary: research.executiveSummary,
          crmHistory: research.crmHistory,
          competitiveLandscape: research.competitiveLandscape,
          conversationStrategy: research.conversationStrategy,
          dealRisks: research.dealRisks,
          immediateOpportunities: research.immediateOpportunities,
          strategicExpansion: research.strategicExpansion,
          isGenerated: true
        });
      }

      // Update company with recent news
      if (company.id && research.recentNews.length > 0) {
        await storage.updateCompany(company.id, {
          recentNews: research.recentNews
        });
      }

      console.info('[prepSheet] generation mode: full, account:', company.id);
      
      res.json({
        mode: 'full',
        sheet: {
          call,
          company: { ...company, recentNews: research.recentNews },
          contacts,
          callPrep,
          salesforceContext: { company, contacts }
        },
        accountId: company.id
      });
    } catch (error) {
      console.error('Failed to generate call prep:', error);
      res.status(500).json({ message: "Failed to generate AI call prep: " + (error as Error).message });
    }
  });

  // Prep notes API endpoints
  app.get("/api/prep-notes", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const eventId = req.query.eventId as string;
      if (!eventId) {
        return res.status(400).json({ message: "eventId parameter required" });
      }

      const userId = req.user.claims.sub;
      const note = await storage.getPrepNote(userId, eventId);
      
      res.json({
        text: note?.text || '',
        updatedAt: note?.updatedAt || null
      });
    } catch (error) {
      console.error('Failed to get prep note:', error);
      res.status(500).json({ message: "Failed to get prep note" });
    }
  });

  app.put("/api/prep-notes", isAuthenticatedOrGuest, requireWriteAccess, async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { eventId, text } = req.body;
      if (!eventId) {
        return res.status(400).json({ message: "eventId is required" });
      }

      const userId = req.user.claims.sub;
      const note = await storage.upsertPrepNote(userId, eventId, text || '');
      
      res.json(note);
    } catch (error) {
      console.error('Failed to save prep note:', error);
      res.status(500).json({ message: "Failed to save prep note" });
    }
  });

  console.log('[prepNotes] routes mounted at /api/prep-notes');

  // Integration management routes
  
  // Get all integrations
  app.get("/api/integrations", async (req, res) => {
    try {
      const integrations = await integrationManager.getAllIntegrations();
      // Remove sensitive credential data from response
      const sanitizedIntegrations = integrations.map(integration => {
        let hasCredentials = false;
        
        if (integration.credentials && Object.keys(integration.credentials).length > 0) {
          try {
            // Try to decrypt credentials to check if they contain valid tokens
            const decryptedCredentials = CryptoService.decryptCredentials(integration.credentials);
            hasCredentials = !!(decryptedCredentials && decryptedCredentials.accessToken);
          } catch (error) {
            // If decryption fails, check if credentials object has any meaningful data
            hasCredentials = !!(integration.credentials as any).accessToken;
          }
        }
        
        return {
          ...integration,
          credentials: { hasCredentials }
        };
      });
      res.json(sanitizedIntegrations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  // Get single integration
  app.get("/api/integrations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const integration = await integrationManager.getIntegration(id);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      // Remove sensitive credential data from response
      let hasCredentials = false;
      
      if (integration.credentials && Object.keys(integration.credentials).length > 0) {
        try {
          const decryptedCredentials = CryptoService.decryptCredentials(integration.credentials);
          hasCredentials = !!(decryptedCredentials && decryptedCredentials.accessToken);
        } catch (error) {
          hasCredentials = !!(integration.credentials as any).accessToken;
        }
      }

      const sanitizedIntegration = {
        ...integration,
        credentials: { hasCredentials }
      };

      res.json(sanitizedIntegration);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch integration" });
    }
  });

  // Create new integration
  app.post("/api/integrations", async (req, res) => {
    try {
      const data = insertIntegrationSchema.parse(req.body);
      const integration = await integrationManager.createIntegration(data.name, data.type, data.config as any);
      res.json(integration);
    } catch (error) {
      res.status(500).json({ message: "Failed to create integration" });
    }
  });

  // Initiate OAuth flow for integration
  app.post("/api/integrations/:id/oauth", async (req, res) => {
    try {
      const { id } = req.params;
      const { authUrl } = await integrationManager.initiateOAuthFlow(id);
      res.json({ authUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to initiate OAuth flow: " + (error as Error).message });
    }
  });

  // Trigger sync for integration
  app.get("/api/integrations/:id/sync", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await integrationManager.syncIntegration(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to sync integration: " + (error as Error).message });
    }
  });

  // OAuth callback endpoint
  app.get("/api/integrations/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).json({ message: "Missing code or state parameter" });
      }
      
      const integration = await integrationManager.completeOAuthFlow(code as string, state as string);
      
      // Redirect to integration management page with success
      res.redirect(`/dashboard?integration_connected=${integration.id}`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`/dashboard?integration_error=${encodeURIComponent((error as Error).message)}`);
    }
  });

  // Sync integration data
  app.post("/api/integrations/:id/sync", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await integrationManager.syncIntegration(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to sync integration: " + (error as Error).message });
    }
  });

  // Delete integration
  app.delete("/api/integrations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await integrationManager.deleteIntegration(id);
      res.json({ message: "Integration deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Sales Coach routes
  // Create a new coach session
  app.post("/api/coach/sessions", isAuthenticatedOrGuest, requireWriteAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionData = insertCoachSessionSchema.parse({
        ...req.body,
        userId
      });

      const session = await storage.createCoachSession(sessionData);
      console.log(`[Coach] Created session ${session.id} for user ${userId}, event ${session.eventId}`);
      
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating coach session:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid session data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create coach session" });
    }
  });

  // Get a specific coach session
  app.get("/api/coach/sessions/:id", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionId = req.params.id;

      const session = await storage.getCoachSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Ensure user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(session);
    } catch (error) {
      console.error("Error fetching coach session:", error);
      res.status(500).json({ message: "Failed to fetch coach session" });
    }
  });

  // Update a coach session (e.g., change status, end session)
  app.patch("/api/coach/sessions/:id", isAuthenticatedOrGuest, requireWriteAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionId = req.params.id;

      const session = await storage.getCoachSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Ensure user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updates = insertCoachSessionSchema.partial().parse(req.body);
      const updatedSession = await storage.updateCoachSession(sessionId, updates);
      
      console.log(`[Coach] Updated session ${sessionId} status: ${updatedSession.status}`);
      res.json(updatedSession);
    } catch (error) {
      console.error("Error updating coach session:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update coach session" });
    }
  });

  // End a coach session (convenience endpoint)
  app.post("/api/coach/sessions/:id/end", isAuthenticatedOrGuest, requireWriteAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionId = req.params.id;

      const session = await storage.getCoachSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Ensure user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedSession = await storage.updateCoachSession(sessionId, {
        status: "ended",
        endedAt: new Date()
      });
      
      console.log(`[Coach] Ended session ${sessionId}`);
      res.json(updatedSession);
    } catch (error) {
      console.error("Error ending coach session:", error);
      res.status(500).json({ message: "Failed to end coach session" });
    }
  });

  // Get transcripts for a session
  app.get("/api/coach/sessions/:id/transcripts", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionId = req.params.id;

      const session = await storage.getCoachSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Ensure user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const transcripts = await storage.getCoachTranscripts(sessionId);
      res.json(transcripts);
    } catch (error) {
      console.error("Error fetching coach transcripts:", error);
      res.status(500).json({ message: "Failed to fetch transcripts" });
    }
  });

  // Get suggestions for a session
  app.get("/api/coach/sessions/:id/suggestions", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionId = req.params.id;

      const session = await storage.getCoachSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Ensure user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const suggestions = await storage.getCoachSuggestions(sessionId);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching coach suggestions:", error);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  // Get or create session for a specific event
  app.get("/api/coach/sessions/event/:eventId", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.eventId;

      const session = await storage.getCoachSessionByUserAndEvent(userId, eventId);
      res.json(session || null);
    } catch (error) {
      console.error("Error fetching coach session by event:", error);
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  // AI Chat endpoint with MCP integration for Opus AI Chat interface
  app.post("/api/coach/chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message, eventId, context } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Valid message is required" });
      }

      console.log(`[Coach-Chat] Processing message for user ${userId}: "${message.substring(0, 50)}..."`);

      // Create MCP server for accessing calendar and Salesforce data
      const mcpServer = await createMCPServer({ userId, storage });

      // Get available MCP tools for OpenAI function calling
      const availableFunctions = mcpServer.getOpenAIFunctions();
      
      // Wrap each function with type property for OpenAI API
      const availableTools = availableFunctions.map(func => ({
        type: "function" as const,
        function: func
      }));

      console.log(`[Coach-Chat] ${availableTools.length} MCP tools available for AI`);

      // Build system prompt with sales coaching context
      const systemPrompt = `You are Opus, an expert AI Sales Coach for Momentum AI. You help sales professionals prepare for calls, analyze their pipeline, and provide strategic guidance.

You have access to the user's:
- Google Calendar events and meeting history
- Salesforce CRM data (opportunities, accounts, contacts)
- Past call preparation notes and history

When users ask about their calendar, meetings, pipeline, opportunities, or deals, use the available tools to fetch real-time data. Always provide specific, actionable advice based on actual data.

Be concise, professional, and focus on helping the user close more deals. Use sales methodologies like MEDDIC, BANT, and SPIN when relevant.`;

      // Initialize OpenAI client
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      // Build conversation messages
      const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ];

      // Make initial request with available MCP tools
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: availableTools.length > 0 ? availableTools : undefined,
        tool_choice: availableTools.length > 0 ? "auto" : undefined,
        temperature: 0.7,
        max_tokens: 1000
      });

      let finalResponse = response;

      // Handle tool calls if the AI wants to use MCP functions
      if (response.choices[0].message.tool_calls) {
        console.log(`[Coach-Chat] AI requested ${response.choices[0].message.tool_calls.length} tool calls`);

        const toolMessages = [...messages, response.choices[0].message];

        // Execute each tool call
        for (const toolCall of response.choices[0].message.tool_calls) {
          try {
            // Type guard for function tool calls
            if (toolCall.type !== 'function' || !('function' in toolCall)) {
              continue;
            }
            
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            
            console.log(`[Coach-Chat] Executing MCP tool: ${toolName} with args:`, toolArgs);
            const toolResult = await mcpServer.executeTool(toolName as any, toolArgs);
            
            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            });

            console.log(`[Coach-Chat] Tool ${toolName} executed successfully`);
          } catch (toolError) {
            console.error(`[Coach-Chat] Tool execution failed:`, toolError);
            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                error: "Tool execution failed", 
                details: (toolError as Error).message 
              })
            });
          }
        }

        // Get final response with tool results
        console.log(`[Coach-Chat] Getting final response with tool results`);
        finalResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: toolMessages,
          temperature: 0.7,
          max_tokens: 1000
        });
      }

      const aiResponse = finalResponse.choices[0].message.content;

      console.log(`[Coach-Chat] Successfully generated response for user ${userId}`);

      res.json({
        response: aiResponse,
        context: context || 'sales_coaching',
        timestamp: new Date().toISOString(),
        toolsUsed: response.choices[0].message.tool_calls?.length || 0
      });

    } catch (error) {
      console.error("[Coach-Chat] Error processing chat message:", error);
      res.status(500).json({ 
        message: "Failed to process chat message",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // WebSocket status endpoint
  app.get("/api/coach/ws/status", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      // This will be available after the server is created
      res.json({
        websocketAvailable: true,
        wsPath: '/ws/coach',
        protocol: req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws',
        host: req.get('host')
      });
    } catch (error) {
      console.error("Error getting WebSocket status:", error);
      res.status(500).json({ message: "Failed to get WebSocket status" });
    }
  });

  // Opus chat endpoint - AI sales partner with real-time data access
  app.post("/api/opus/chat", isAuthenticatedOrGuest, async (req, res) => {
    try {
      const { messages } = req.body;
      const userId = req.user?.claims?.sub || req.user?.sub;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ reply: "Invalid message format" });
      }

      // Import required modules dynamically
      const OpenAI = (await import('openai')).default;
      const { MCP_TOOL_DEFINITIONS } = await import('./mcp/types/mcp-types.js');
      const { MCP_TOOL_HANDLERS } = await import('./mcp/tools/index.js');
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Create MCP context for tool execution
      const mcpContext = {
        userId: userId,
        storage: storage
      };

      // Prepare OpenAI tool definitions from MCP tools - using new tools format
      const tools = Object.values(MCP_TOOL_DEFINITIONS).map(tool => ({
        type: "function",
        function: tool
      }));

      // System prompt for Opus as ultimate sales partner
      const systemPrompt = `You are Opus, the ultimate AI sales partner and coach. You have access to real-time data about:

📅 CALENDAR & MEETINGS: Use calendar_meeting_context to get meeting details, attendees, descriptions. Use calendar_attendee_history for previous meetings.

🏢 CRM & SALESFORCE: Use salesforce_contact_lookup, salesforce_opportunity_lookup, salesforce_account_lookup to get real-time CRM data.

📊 CALL HISTORY & PREP: Use call_history_lookup and prep_notes_search to access previous calls and preparation notes.

📧 EMAIL CONTEXT: Use gmail_search_threads and gmail_read_thread for email context.

PERSONALITY: You're an experienced sales veteran, direct but supportive. You provide specific, actionable insights based on real data. Always use available tools to get current information before giving advice.

CRITICAL RULES:
- NEVER provide sample, mock, or placeholder data
- ALWAYS use available tools to get real information when asked about meetings, contacts, opportunities, or accounts
- If you can't get real data, say "I couldn't access that information right now" instead of making up data
- Provide specific insights based on actual data, not generic advice
- Help with call preparation, objection handling, and sales strategy
- Be proactive - if someone asks about a meeting, look up attendees, company info, and previous interactions
- Use data to give tactical recommendations: "Based on your last 3 calls with this prospect..."

RESPONSE STYLE: Confident, insightful, data-driven. Start with relevant data, then provide actionable recommendations.`;

      // Prepare messages for OpenAI
      const openaiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      console.log('[OpusChat] Processing message with', tools.length, 'available tools');

      // Call OpenAI with NEW tools parameter (not deprecated functions)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: openaiMessages,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1000
      });

      const responseMessage = completion.choices[0]?.message;

      // Handle tool calls (new format)
      if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolCall = responseMessage.tool_calls[0]; // Handle first tool call
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
        
        console.log(`[OpusChat] Executing function: ${functionName}`);
        
        // Execute the MCP tool
        const toolHandler = MCP_TOOL_HANDLERS[functionName as keyof typeof MCP_TOOL_HANDLERS];
        if (toolHandler) {
          try {
            const toolResult = await toolHandler(functionArgs, mcpContext);
            
            // Create follow-up messages with tool result
            const followUpMessages = [
              ...openaiMessages,
              {
                role: 'assistant',
                content: responseMessage.content || '',
                tool_calls: responseMessage.tool_calls
              },
              {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
              }
            ];

            // Get final response with tool data
            const finalCompletion = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 1000
            });

            const finalResponse = finalCompletion.choices[0]?.message?.content || 
              "I have the data but couldn't formulate a response. Please try asking again.";

            res.json({ reply: finalResponse });
            
          } catch (toolError) {
            console.error(`[OpusChat] Tool execution error for ${functionName}:`, toolError);
            res.json({ 
              reply: `I tried to look up that information but encountered an issue. Here's what I can tell you generally: ${responseMessage.content || "Let me know what specific information you need and I'll help you out."}` 
            });
          }
        } else {
          console.error(`[OpusChat] Unknown function: ${functionName}`);
          res.json({ 
            reply: responseMessage.content || "I'm here to help with your sales questions! What would you like to know?"
          });
        }
      } else {
        // Direct response without function call
        const reply = responseMessage?.content || "I'm here to help with your sales strategy! What can I assist you with?";
        res.json({ reply });
      }

    } catch (error) {
      console.error("[OpusChat] Error:", error);
      res.status(500).json({ 
        reply: "I'm having trouble accessing my data sources right now. Please try again in a moment." 
      });
    }
  });

  // Create sample data endpoint for demo (DISABLED - no sample data in production)
  app.post("/api/demo/setup", async (req, res) => {
    // Import FLAGS to check if mocks are enabled
    const { FLAGS } = await import('./config/flags.js');
    
    if (!FLAGS.USE_MOCKS && !FLAGS.DEMO_MODE) {
      return res.status(403).json({ 
        message: "Demo data creation is disabled. Enable USE_MOCKS=true to use sample data." 
      });
    }
    try {
      // Create DataFlow Systems company
      const company = await storage.createCompany({
        name: "DataFlow Systems",
        domain: "dataflow.com",
        industry: "Technology",
        size: "Mid-market",
        description: "Data automation and workflow solutions provider",
        recentNews: [
          "DataFlow Systems continues to expand their market presence",
          "Industry focus on AI and automation solutions",
          "Quarterly results show strong performance"
        ]
      });

      // Create contacts
      const contacts = await Promise.all([
        storage.createContact({
          companyId: company.id,
          email: "jennifer.white@dataflow.com",
          firstName: "Jennifer",
          lastName: "White",
          title: "VP of Operations",
          role: "Stakeholder"
        }),
        storage.createContact({
          companyId: company.id,
          email: "robert.kim@dataflow.com", 
          firstName: "Robert",
          lastName: "Kim",
          title: "CTO",
          role: "Stakeholder"
        }),
        storage.createContact({
          companyId: company.id,
          email: "lisa.thompson@dataflow.com",
          firstName: "Lisa", 
          lastName: "Thompson",
          title: "Director of Technology",
          role: "Stakeholder"
        })
      ]);

      // Create upcoming call
      const upcomingCall = await storage.createCall({
        companyId: company.id,
        title: "Product Demo: DataFlow Systems",
        scheduledAt: new Date("2025-08-10T19:26:00Z"),
        status: "upcoming",
        callType: "demo",
        stage: "initial_discovery"
      });

      // Create some previous calls
      await Promise.all([
        storage.createCall({
          companyId: company.id,
          title: "Discovery Call: DataFlow Systems",
          scheduledAt: new Date("2025-08-04T15:15:00Z"),
          status: "completed",
          callType: "discovery",
          stage: "initial_discovery"
        }),
        // Add more sample companies for previous calls
        storage.createCompany({
          name: "TechCorp Solutions",
          domain: "techcorp.com",
          industry: "Software",
          size: "Enterprise"
        }).then(async (techCorpCompany) => {
          return storage.createCall({
            companyId: techCorpCompany.id,
            title: "Q4 Strategy Review: TechCorp",
            scheduledAt: new Date("2025-08-07T19:26:00Z"),
            status: "completed",
            callType: "follow-up"
          });
        }),
        storage.createCompany({
          name: "InnovateLabs Inc",
          domain: "innovatelabs.com", 
          industry: "Technology",
          size: "Startup"
        }).then(async (innovateCompany) => {
          return storage.createCall({
            companyId: innovateCompany.id,
            title: "Discovery Call: InnovateLabs",
            scheduledAt: new Date("2025-08-06T14:30:00Z"),
            status: "completed",
            callType: "discovery"
          });
        })
      ]);

      res.json({ message: "Demo data created successfully", companyId: company.id, callId: upcomingCall.id });
    } catch (error) {
      console.error('Failed to setup demo data:', error);
      res.status(500).json({ message: "Failed to setup demo data" });
    }
  });

  // Enhanced Methodology-Aware Call Prep Generation
  app.post("/api/calls/:id/generate-enhanced-prep", isAuthenticatedOrGuest, requireWriteAccess, async (req: any, res) => {
    try {
      const callId = req.params.id;
      const userId = req.user.claims.sub;
      
      console.log(`[Enhanced-MCP] Starting enhanced methodology prep for call: ${callId}`);
      
      // Get call and company data
      const call = await storage.getCall(callId);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      const company = await storage.getCompany(call.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Create MCP server with context
      const { createMCPServer } = await import('./mcp/mcp-server.js');
      const mcpServer = await createMCPServer({ userId, storage, callId });
      
      // Get additional context data for methodology analysis
      const contacts = await storage.getContactsByCompany(call.companyId);
      
      // Import the enhanced methodology service
      const { generateMethodologyAwareCallPrep } = await import('./services/methodologyOpenAI');
      
      // Prepare enhanced input
      const enhancedInput = {
        call: { ...call, company },
        calendarEvent: null,
        crmData: {
          contacts: contacts || [],
          account: company,
          opportunity: {
            amount: 100000,
            stage: call.stage
          }
        },
        additionalContext: {
          previousInteractions: [],
          knownPainPoints: [],
          competitorIntel: []
        }
      };

      // Generate methodology-aware call prep
      const enhancedPrep = await generateMethodologyAwareCallPrep(enhancedInput, mcpServer);

      console.log(`[Enhanced-MCP] Enhanced methodology prep completed for call ${callId}`);
      
      // Return the enhanced structured data
      res.json({
        success: true,
        methodologyData: enhancedPrep,
        message: "Enhanced call preparation generated successfully"
      });

    } catch (error) {
      console.error(`[Enhanced-MCP] Error generating enhanced call prep:`, error);
      res.status(500).json({ 
        message: "Failed to generate enhanced call preparation",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Helper functions for robust prep sheet generation
  function buildBasePrep(event: any, attendees: any): any {
    const notesSection = {
      id: "notes",
      title: "Notes",
      type: "notes",
      content: "",
      expanded: true, // Always pinned open
      editable: true
    };

    return {
      meta: {
        title: event.title || "Call",
        time: `${new Date(event.start).toLocaleTimeString()} - ${event.end ? new Date(event.end).toLocaleTimeString() : 'TBD'}`,
        attendees: attendees || [],
        source: "BasePrep"
      },
      sections: [
        notesSection, // GUARANTEED at index 0
        {
          id: "objectives", 
          title: "Call Objectives",
          items: [
            `Discuss: ${event.title || 'meeting topic'}`,
            "Build rapport and understand current situation",
            "Identify pain points and challenges", 
            "Determine next steps and timeline"
          ]
        },
        {
          id: "agenda",
          title: "Suggested Agenda", 
          items: [
            "Opening and introductions (5 min)",
            "Current situation and challenges (15 min)",
            "Exploring potential solutions (20 min)",
            "Next steps and timeline (10 min)"
          ]
        },
        {
          id: "questions",
          title: "Discovery Questions",
          items: [
            "What are your main priorities this quarter?",
            "What challenges are you currently facing with [relevant area]?",
            "How are you handling this today?",
            "What would an ideal solution look like for your team?"
          ]
        },
        {
          id: "next_steps",
          title: "Next Steps",
          items: [
            "Send follow-up email with recap",
            "Schedule next meeting",
            "Prepare relevant resources/demos"
          ]
        }
      ]
    };
  }

  function buildEnrichedPrep(ctx: any): any {
    const basePrep = buildBasePrep(ctx.event, ctx.attendees);
    
    // GUARANTEED Notes section at index 0
    const notesSection = basePrep.sections[0]; // This is always Notes from buildBasePrep
    
    // Enhance sections with CRM data
    return {
      ...basePrep,
      meta: {
        ...basePrep.meta,
        account: ctx.account ? {
          name: ctx.account.name,
          industry: ctx.account.industry,
          website: ctx.account.website
        } : null,
        source: "Enriched"
      },
      sections: [
        notesSection, // GUARANTEED Notes at index 0
        {
          id: "insights",
          title: "CRM Insights",
          items: [
            `Account: ${ctx.account?.name || 'Unknown'}`,
            `Industry: ${ctx.account?.industry || 'Not specified'}`,
            `Previous interactions: ${ctx.contacts?.length || 0} contacts found`,
            ctx.opportunity ? `Opportunity: ${ctx.opportunity.name} (${ctx.opportunity.stage})` : 'No active opportunity found'
          ]
        },
        ...basePrep.sections.slice(1) // Rest of sections
      ]
    };
  }

  function scoreMatch(ctx: any): { score: number; reason: string } {
    let score = 0;
    let reason = "none";
    
    // +40 if attendee email matches CRM Contact email
    if (ctx.crmContacts?.length) {
      score += 40;
      reason = "email_match";
    }
    
    // +25 if calendar title contains exact Account/Opportunity name  
    if (ctx.crmAccounts?.length && ctx.event.title?.toLowerCase().includes(ctx.crmAccounts[0]?.name?.toLowerCase())) {
      score += 25;
      if (reason === "none") reason = "name_match";
    }
    
    // +15 if attendee domain matches Account website domain
    if (ctx.attendeeDomains?.length && ctx.crmAccounts?.some((acc: any) => 
        ctx.attendeeDomains.some((domain: string) => acc.website?.includes(domain)))) {
      score += 15; 
      if (reason === "none") reason = "domain_match";
    }
    
    // +10 if recent email threads found
    if (ctx.emailThreads?.length) {
      score += 10;
    }
    
    // +10 if call history exists
    if (ctx.callHistory?.length) {
      score += 10;
    }
    
    return { score: Math.max(0, Math.min(100, score)), reason };
  }

  // GUARANTEED Prep sheet generation route - NEVER FAILS (200 always) - READ-ONLY
  app.post("/api/prep-sheet/generate", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      // Extract event with fallback to ensure we always have something to work with
      let event = req.body?.event;
      if (!event) {
        event = { 
          title: "Meeting", 
          start: new Date().toISOString(),
          attendees: []
        };
      }

      const userId = req.user?.claims?.sub || 'anonymous';

      // 1) Extract attendees and normalize
      const attendees = (event.attendees || []).map((attendee: any) => {
        if (typeof attendee === 'string') return attendee;
        return attendee.email || attendee.name || attendee;
      });
      
      const attendeeDomains = attendees
        .filter((a: string) => a.includes('@'))
        .map((email: string) => email.split('@')[1])
        .filter(Boolean);

      // 2) Mock CRM data lookup (in real implementation, this would be actual integrations)
      const mockCrmLookup = async () => {
        // Simulate CRM lookup delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Mock some results based on domain
        const hasCommonDomain = attendeeDomains.some(domain => 
          ['gmail.com', 'company.com', 'acme.com'].includes(domain)
        );
        
        return {
          crmContacts: hasCommonDomain ? [{ email: attendees[0], name: 'Mock Contact' }] : [],
          crmAccounts: hasCommonDomain ? [{ name: 'Mock Account', industry: 'Technology' }] : [],
          crmOpps: [],
          emailThreads: hasCommonDomain ? ['Recent email thread found'] : [],
          callHistory: []
        };
      };

      // 3) Attempt data enrichment (non-blocking)
      let crmData;
      try {
        crmData = await mockCrmLookup();
        console.log('CRM lookup completed for:', attendees);
      } catch (error: any) {
        console.log('CRM lookup failed, using base data:', error?.message);
        crmData = { crmContacts: [], crmAccounts: [], crmOpps: [], emailThreads: [], callHistory: [] };
      }

      // 4) Score the match
      const matchContext = {
        event,
        attendees,
        attendeeDomains,
        ...crmData
      };
      
      const { score, reason } = scoreMatch(matchContext);
      const matched = score >= 40;

      // 5) Build prep based on confidence
      let prep;
      if (!matched) {
        prep = buildBasePrep(event, attendees);
      } else {
        prep = buildEnrichedPrep({
          event,
          attendees,
          account: crmData.crmAccounts[0],
          opportunity: crmData.crmOpps[0],
          contacts: crmData.crmContacts
        });
      }

      // 6) Always return success with prep - SPEC COMPLIANT FORMAT
      return res.status(200).json({
        status: "ok",
        prep,
        confidence: score,
        matched,
        matchReason: reason
      });
      
    } catch (error) {
      console.error("prep-generate error", error);
    }

    // ULTIMATE FALLBACK - this code ALWAYS runs if we get here
    const emergencyPrep = {
      meta: { title: "Call", time: "TBD", attendees: [], source: "Emergency" },
      sections: [{
        id: "notes",
        title: "Notes", 
        type: "notes",
        content: "",
        expanded: true,
        editable: true
      }]
    };

    return res.status(200).json({
      status: "ok",
      prep: emergencyPrep,
      confidence: 0,
      matched: false,
      matchReason: "emergency"
    });
  });

  // Dev-only helper endpoint for OAuth testing
  app.get("/debug/connect", async (req, res) => {
    const asEmail = req.query.as as string;
    
    if (!asEmail) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Debug OAuth Connect</title>
            <style>
              body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
              .error { background: #fee; border: 1px solid #f88; padding: 15px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <h1>Debug OAuth Connect</h1>
            <div class="error">
              <strong>Missing email parameter</strong>
              <p>Usage: /debug/connect?as=email@example.com</p>
            </div>
          </body>
        </html>
      `);
    }

    // Fetch current status
    let googleStatus, salesforceStatus;
    try {
      const googleIntegration = await storage.getGoogleIntegration(asEmail);
      googleStatus = {
        connected: !!(googleIntegration?.accessToken || googleIntegration?.refreshToken),
        hasAccessToken: !!googleIntegration?.accessToken,
        hasRefreshToken: !!googleIntegration?.refreshToken,
        scopes: googleIntegration?.scopes || []
      };

      const salesforceIntegration = await storage.getSalesforceIntegration(asEmail);
      salesforceStatus = {
        connected: !!(salesforceIntegration?.accessToken || salesforceIntegration?.refreshToken),
        hasAccessToken: !!salesforceIntegration?.accessToken,
        hasRefreshToken: !!salesforceIntegration?.refreshToken,
        hasInstanceUrl: !!salesforceIntegration?.instanceUrl
      };
    } catch (error) {
      console.error("Error fetching integration status:", error);
      googleStatus = { connected: false, error: true };
      salesforceStatus = { connected: false, error: true };
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Debug OAuth Connect - ${asEmail}</title>
          <style>
            body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #333; }
            .status { margin: 20px 0; padding: 15px; border-radius: 5px; }
            .connected { background: #d4edda; border: 1px solid #c3e6cb; }
            .disconnected { background: #f8d7da; border: 1px solid #f5c6cb; }
            button { padding: 12px 24px; margin: 10px 5px; font-size: 16px; cursor: pointer; border: none; border-radius: 5px; }
            .google-btn { background: #4285f4; color: white; }
            .salesforce-btn { background: #00a1e0; color: white; }
            button:hover { opacity: 0.9; }
            .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>Debug OAuth Connect</h1>
          <div class="info">
            <strong>Testing for:</strong> ${asEmail}
          </div>

          <div class="status ${googleStatus.connected ? 'connected' : 'disconnected'}">
            <h3>Google Integration</h3>
            <p>Status: ${googleStatus.connected ? '✓ Connected' : '✗ Not Connected'}</p>
            ${googleStatus.connected ? `
              <ul>
                <li>Access Token: ${googleStatus.hasAccessToken ? '✓' : '✗'}</li>
                <li>Refresh Token: ${googleStatus.hasRefreshToken ? '✓' : '✗'}</li>
                <li>Scopes: ${(googleStatus.scopes || []).join(', ')}</li>
              </ul>
            ` : ''}
            <button class="google-btn" onclick="window.location.href='/api/integrations/google/auth?as=${encodeURIComponent(asEmail)}'">
              ${googleStatus.connected ? 'Reconnect' : 'Connect'} Google
            </button>
          </div>

          <div class="status ${salesforceStatus.connected ? 'connected' : 'disconnected'}">
            <h3>Salesforce Integration</h3>
            <p>Status: ${salesforceStatus.connected ? '✓ Connected' : '✗ Not Connected'}</p>
            ${salesforceStatus.connected ? `
              <ul>
                <li>Access Token: ${salesforceStatus.hasAccessToken ? '✓' : '✗'}</li>
                <li>Refresh Token: ${salesforceStatus.hasRefreshToken ? '✓' : '✗'}</li>
                <li>Instance URL: ${salesforceStatus.hasInstanceUrl ? '✓' : '✗'}</li>
              </ul>
            ` : ''}
            <button class="salesforce-btn" onclick="window.location.href='/api/integrations/salesforce/auth?as=${encodeURIComponent(asEmail)}'">
              ${salesforceStatus.connected ? 'Reconnect' : 'Connect'} Salesforce
            </button>
          </div>

          <div class="info">
            <strong>Note:</strong> This is a dev-only endpoint for testing OAuth flows with APP_DEV_BYPASS=true
          </div>
        </body>
      </html>
    `);
  });

  // Force reconnect endpoint - ensures clean re-auth with proper scopes
  app.get("/debug/force-reconnect", async (req, res) => {
    const asEmail = req.query.as as string;
    
    if (!asEmail) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Force Reconnect OAuth</title>
            <style>
              body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
              .error { background: #fee; border: 1px solid #f88; padding: 15px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <h1>Force Reconnect OAuth</h1>
            <div class="error">
              <strong>Missing email parameter</strong>
              <p>Usage: /debug/force-reconnect?as=email@example.com</p>
            </div>
          </body>
        </html>
      `);
    }

    // Fetch current status
    let googleStatus, salesforceStatus;
    try {
      const googleIntegration = await storage.getGoogleIntegration(asEmail);
      googleStatus = {
        connected: !!(googleIntegration?.accessToken || googleIntegration?.refreshToken),
        hasAccessToken: !!googleIntegration?.accessToken,
        hasRefreshToken: !!googleIntegration?.refreshToken,
        scopes: googleIntegration?.scopes || []
      };

      const salesforceIntegration = await storage.getSalesforceIntegration(asEmail);
      salesforceStatus = {
        connected: !!(salesforceIntegration?.accessToken || salesforceIntegration?.refreshToken),
        hasAccessToken: !!salesforceIntegration?.accessToken,
        hasRefreshToken: !!salesforceIntegration?.refreshToken,
        hasInstanceUrl: !!salesforceIntegration?.instanceUrl
      };
    } catch (error) {
      console.error("Error fetching integration status:", error);
      googleStatus = { connected: false, error: true };
      salesforceStatus = { connected: false, error: true };
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Force Reconnect OAuth - ${asEmail}</title>
          <style>
            body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #333; }
            .status { margin: 20px 0; padding: 15px; border-radius: 5px; }
            .connected { background: #d4edda; border: 1px solid #c3e6cb; }
            .disconnected { background: #f8d7da; border: 1px solid #f5c6cb; }
            button { padding: 12px 24px; margin: 10px 5px; font-size: 16px; cursor: pointer; border: none; border-radius: 5px; }
            .google-btn { background: #4285f4; color: white; }
            .salesforce-btn { background: #00a1e0; color: white; }
            button:hover { opacity: 0.9; }
            .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; border-radius: 5px; margin: 10px 0; }
            .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>Force Reconnect OAuth</h1>
          <div class="info">
            <strong>Testing for:</strong> ${asEmail}
          </div>
          <div class="warning">
            <strong>⚠️ Force Reconnect Mode</strong>
            <p>This will trigger a clean re-authentication with full consent prompts to ensure all tokens and scopes are properly saved.</p>
          </div>

          <div class="status ${googleStatus.connected ? 'connected' : 'disconnected'}">
            <h3>Google Integration</h3>
            <p>Status: ${googleStatus.connected ? '✓ Connected' : '✗ Not Connected'}</p>
            ${googleStatus.connected ? `
              <ul>
                <li>Access Token: ${googleStatus.hasAccessToken ? '✓' : '✗'}</li>
                <li>Refresh Token: ${googleStatus.hasRefreshToken ? '✓' : '✗'}</li>
                <li>Scopes: ${(googleStatus.scopes || []).join(', ')}</li>
              </ul>
            ` : ''}
            <p><strong>Scopes:</strong> calendar.readonly, gmail.readonly, profile, email</p>
            <p><strong>Params:</strong> access_type=offline, prompt=consent</p>
            <button class="google-btn" onclick="window.location.href='/api/integrations/google/auth?as=${encodeURIComponent(asEmail)}'">
              Reconnect Google (Force Consent)
            </button>
          </div>

          <div class="status ${salesforceStatus.connected ? 'connected' : 'disconnected'}">
            <h3>Salesforce Integration</h3>
            <p>Status: ${salesforceStatus.connected ? '✓ Connected' : '✗ Not Connected'}</p>
            ${salesforceStatus.connected ? `
              <ul>
                <li>Access Token: ${salesforceStatus.hasAccessToken ? '✓' : '✗'}</li>
                <li>Refresh Token: ${salesforceStatus.hasRefreshToken ? '✓' : '✗'}</li>
                <li>Instance URL: ${salesforceStatus.hasInstanceUrl ? '✓' : '✗'}</li>
              </ul>
            ` : ''}
            <p><strong>Scopes:</strong> api, refresh_token</p>
            <p><strong>Params:</strong> prompt=consent</p>
            <button class="salesforce-btn" onclick="window.location.href='/api/integrations/salesforce/auth?as=${encodeURIComponent(asEmail)}'">
              Reconnect Salesforce (Force Consent)
            </button>
          </div>

          <div class="info">
            <strong>Note:</strong> This is a dev-only endpoint for testing OAuth flows with APP_DEV_BYPASS=true
          </div>
        </body>
      </html>
    `);
  });

  const httpServer = createServer(app);
  
  // Initialize Coach WebSocket service
  const coachWS = new CoachWebSocketService(httpServer);
  console.log('[Coach] WebSocket service initialized');
  
  // Initialize Voice Recorder WebSocket service for Silent Call Recorder MVP
  const voiceRecorderWS = new VoiceRecorderWebSocketService(httpServer);
  console.log('[Voice-Recorder] WebSocket service initialized');
  
  return httpServer;
}
