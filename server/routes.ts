import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { isGuestEnabled, isDemoMode, authenticateGuest, createGuestSession, ensureGuestUser, seedGuestData } from "./services/guestAuth";
import { storage } from "./storage";
import { generateProspectResearch, enhanceCompanyData } from "./services/openai";
import { createMCPServer } from "./mcp/mcp-server.js";
import { insertCompanySchema, insertContactSchema, insertCallSchema, insertCallPrepSchema, insertIntegrationSchema, insertCoachSessionSchema, insertCoachTranscriptSchema, insertCoachSuggestionSchema } from "@shared/schema";
import { integrationManager } from "./services/integrations/manager";
import { CryptoService } from "./services/crypto";
import { CoachWebSocketService } from "./services/coachWebSocket";
import { VoiceRecorderWebSocketService } from "./services/voiceRecorderWebSocket";
import { z } from "zod";
import gmailRoutes from "./routes/gmail";
import { generateRhythmInsights, generateOpusFeed } from "./services/insights";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth (Google Sign-in support)
  await setupAuth(app);
  
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

  // Combined integrations status endpoint
  app.get("/api/integrations/status", isAuthenticatedOrGuest, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get Google integration status
      const googleIntegration = await storage.getGoogleIntegration(userId);
      const googleStatus = {
        connected: !!googleIntegration?.isActive,
        scopes: googleIntegration?.scopes || [],
        connectedAt: googleIntegration?.createdAt,
        service: "google"
      };

      // Get Salesforce integration status
      const salesforceIntegration = await storage.getSalesforceIntegration(userId);
      const salesforceStatus = {
        connected: !!salesforceIntegration?.isActive,
        instanceUrl: salesforceIntegration?.instanceUrl,
        connectedAt: salesforceIntegration?.createdAt,
        service: "salesforce"
      };

      // Outlook is always not connected for now
      const outlookStatus = {
        connected: false,
        service: "outlook",
        message: "Outlook integration coming soon"
      };

      res.json({
        googleCalendar: googleStatus,
        salesforce: salesforceStatus,
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
  app.get("/api/integrations/google/auth", isAuthenticatedOrGuest, async (req, res) => {
    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(501).json({
          message: "Google integration not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
          status: "not_configured"
        });
      }

      // Store user ID in session for callback
      (req as any).session.googleUserId = req.user.claims.sub;

      const { googleAuth } = await import('./services/googleAuth');
      const authUrl = googleAuth.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Google auth URL:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/integrations/google/callback", async (req: any, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ message: "Missing authorization code" });
      }

      const { googleAuth } = await import('./services/googleAuth');
      // Get user ID from session
      const userId = (req as any).session.googleUserId;
      if (!userId) {
        return res.status(400).json({ message: "Missing user session" });
      }

      // Clear user ID from session
      delete (req as any).session.googleUserId;

      const tokens = await googleAuth.getTokens(code);
      
      // Check if user already has a Google integration
      const existingIntegration = await storage.getGoogleIntegration(userId);
      
      const googleIntegrationData = {
        userId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scopes: tokens.scope?.split(' ') || [],
        isActive: true
      };

      if (existingIntegration) {
        await storage.updateGoogleIntegration(userId, googleIntegrationData);
      } else {
        await storage.createGoogleIntegration(googleIntegrationData);
      }

      // Redirect back to settings page with success
      res.redirect('/?google_connected=true');
    } catch (error) {
      console.error("Error handling Google OAuth callback:", error);
      res.redirect('/?google_error=true');
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

  // Gmail routes - Mount the Gmail router
  app.use("/api/gmail", isAuthenticatedOrGuest, gmailRoutes);

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
  app.get("/api/integrations/salesforce/auth", isAuthenticatedOrGuest, async (req, res) => {
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
      (req as any).session.salesforceUserId = req.user.claims.sub;
      (req as any).session.salesforceState = state;
      
      const authUrl = salesforceAuth.getAuthUrl(state);
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Salesforce auth URL:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/integrations/salesforce/callback", async (req: any, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return res.status(400).json({ message: "Missing authorization code" });
      }

      // Validate CSRF state
      if (!state || state !== req.session.salesforceState) {
        return res.status(400).json({ message: "Invalid state parameter" });
      }

      // Get user ID from session
      const userId = (req as any).session.salesforceUserId;
      if (!userId) {
        return res.status(400).json({ message: "Missing user session" });
      }

      // Clear state and user ID from session
      delete req.session.salesforceState;
      delete (req as any).session.salesforceUserId;

      const { salesforceAuth } = await import('./services/salesforceAuth');
      const tokens = await salesforceAuth.getTokens(code);
      
      // Check if user already has a Salesforce integration
      const existingIntegration = await storage.getSalesforceIntegration(userId);
      
      const salesforceIntegrationData = {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        instanceUrl: tokens.instance_url,
        tokenExpiry: tokens.token_expiry || null,
        isActive: true
      };

      if (existingIntegration) {
        await storage.updateSalesforceIntegration(userId, salesforceIntegrationData);
      } else {
        await storage.createSalesforceIntegration(salesforceIntegrationData);
      }

      // Redirect back to settings page with success
      res.redirect('/?salesforce_connected=true');
    } catch (error) {
      console.error("Error handling Salesforce OAuth callback:", error);
      res.redirect('/?salesforce_error=true');
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

  // Opus chat endpoint - simple coaching suggestions
  app.post("/api/opus/chat", isAuthenticatedOrGuest, async (req, res) => {
    try {
      const { messages } = req.body;
      const lastMessage = messages?.[messages.length - 1]?.content || "";
      
      // Simple coaching suggestions based on message content
      let suggestion = "Lead with an agenda, confirm success criteria, and secure a time-bound next step.";
      
      if (lastMessage.toLowerCase().includes("objection")) {
        suggestion = "Acknowledge, ask a calibrating question, then reframe with quantified value.";
      } else if (lastMessage.toLowerCase().includes("follow") || lastMessage.toLowerCase().includes("next")) {
        suggestion = "Set clear expectations, confirm decision criteria, and schedule a specific next action.";
      } else if (lastMessage.toLowerCase().includes("price") || lastMessage.toLowerCase().includes("cost")) {
        suggestion = "Focus on value first, break down ROI, and tie pricing to business outcomes they've shared.";
      } else if (lastMessage.toLowerCase().includes("competitor") || lastMessage.toLowerCase().includes("competition")) {
        suggestion = "Acknowledge their research, highlight our unique differentiators, and refocus on their specific needs.";
      } else if (lastMessage.toLowerCase().includes("decision") || lastMessage.toLowerCase().includes("timeline")) {
        suggestion = "Understand their decision process, identify all stakeholders, and align on evaluation criteria.";
      }

      res.json({ 
        reply: `Got it. Here's a quick suggestion: ${suggestion}` 
      });
    } catch (error) {
      console.error("Error in Opus chat:", error);
      res.status(500).json({ reply: "Sorry—chat is unavailable right now." });
    }
  });

  // Create sample data endpoint for demo
  app.post("/api/demo/setup", async (req, res) => {
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

  const httpServer = createServer(app);
  
  // Initialize Coach WebSocket service
  const coachWS = new CoachWebSocketService(httpServer);
  console.log('[Coach] WebSocket service initialized');
  
  // Initialize Voice Recorder WebSocket service for Silent Call Recorder MVP
  const voiceRecorderWS = new VoiceRecorderWebSocketService(httpServer);
  console.log('[Voice-Recorder] WebSocket service initialized');
  
  return httpServer;
}
