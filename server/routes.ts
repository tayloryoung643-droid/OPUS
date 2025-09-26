import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { generateProspectResearch, enhanceCompanyData } from "./services/openai";
import { insertCompanySchema, insertContactSchema, insertCallSchema, insertCallPrepSchema, insertIntegrationSchema } from "@shared/schema";
import { integrationManager } from "./services/integrations/manager";
import { CryptoService } from "./services/crypto";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth (Google Sign-in support)
  await setupAuth(app);
  
  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
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
  app.get("/api/integrations/outlook/setup", isAuthenticated, async (req, res) => {
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

  app.get("/api/integrations/outlook/status", isAuthenticated, async (req, res) => {
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

  app.delete("/api/integrations/outlook", isAuthenticated, async (req, res) => {
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
  
  // Get all calls with company data
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
      const call = await storage.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      const company = call.companyId ? await storage.getCompany(call.companyId) : null;
      const contacts = call.companyId ? await storage.getContactsByCompany(call.companyId) : [];
      const callPrep = await storage.getCallPrep(call.id);

      res.json({
        call,
        company,
        contacts,
        callPrep
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch call details" });
    }
  });

  // Create new company
  app.post("/api/companies", async (req, res) => {
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
  app.post("/api/contacts", async (req, res) => {
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
  app.post("/api/calls", async (req, res) => {
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

  // Generate AI call prep
  app.post("/api/calls/:id/generate-prep", async (req, res) => {
    try {
      const call = await storage.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      const company = call.companyId ? await storage.getCompany(call.companyId) : null;
      const contacts = call.companyId ? await storage.getContactsByCompany(call.companyId) : [];

      if (!company) {
        return res.status(400).json({ message: "Cannot generate prep without company data" });
      }

      // Generate AI-powered research
      const research = await generateProspectResearch({
        companyName: company.name,
        companyDomain: company.domain || undefined,
        industry: company.industry || undefined,
        contactEmails: contacts.map(c => c.email)
      });

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

      res.json({
        call,
        company: { ...company, recentNews: research.recentNews },
        contacts,
        callPrep
      });
    } catch (error) {
      console.error('Failed to generate call prep:', error);
      res.status(500).json({ message: "Failed to generate AI call prep: " + (error as Error).message });
    }
  });

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

  const httpServer = createServer(app);
  return httpServer;
}
