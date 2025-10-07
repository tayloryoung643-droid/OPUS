import { Router } from 'express';
import { storage } from '../storage';
import { ENV } from '../config/env';

const router = Router();

/**
 * Server-to-server token provider endpoint
 * Used by MCP service to fetch OAuth tokens for a given userId
 * 
 * Security: Requires Bearer token authentication (MCP_TOKEN_PROVIDER_SECRET)
 * NEVER expose this endpoint to browsers (no CORS, server-only)
 */
router.get('/integrations/tokens', async (req, res) => {
  const startTime = Date.now();
  const rid = (req as any).rid || 'unknown';
  const userId = req.query.userId as string;

  try {
    // Validate bearer token
    const authHeader = req.header('authorization');
    const expectedAuth = `Bearer ${ENV.MCP_TOKEN_PROVIDER_SECRET}`;
    
    if (!ENV.MCP_TOKEN_PROVIDER_SECRET || authHeader !== expectedAuth) {
      console.log(JSON.stringify({
        rid,
        route: '/internal/integrations/tokens',
        userId: userId || 'none',
        status: 401,
        ms: Date.now() - startTime,
        error: 'Unauthorized'
      }));
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate userId parameter
    if (!userId) {
      console.log(JSON.stringify({
        rid,
        route: '/internal/integrations/tokens',
        userId: 'none',
        status: 400,
        ms: Date.now() - startTime,
        error: 'Missing userId parameter'
      }));
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    // Fetch tokens from database (already decrypted by storage methods)
    const [googleIntegration, salesforceIntegration] = await Promise.all([
      storage.getGoogleIntegration(userId),
      storage.getSalesforceIntegration(userId)
    ]);

    // Build response object
    const response: any = {};

    if (googleIntegration) {
      response.google = {
        accessToken: googleIntegration.accessToken,
        refreshToken: googleIntegration.refreshToken || undefined,
        expiry: googleIntegration.tokenExpiry ? Math.floor(googleIntegration.tokenExpiry.getTime() / 1000) : undefined,
        scopes: googleIntegration.scopes || [
          "https://www.googleapis.com/auth/calendar.readonly",
          "https://www.googleapis.com/auth/gmail.readonly"
        ]
      };
    }

    if (salesforceIntegration) {
      response.salesforce = {
        accessToken: salesforceIntegration.accessToken,
        refreshToken: salesforceIntegration.refreshToken || undefined,
        instanceUrl: salesforceIntegration.instanceUrl
      };
    }

    // Log successful token fetch (no token values)
    console.log(JSON.stringify({
      rid,
      route: '/internal/integrations/tokens',
      userId,
      status: 200,
      ms: Date.now() - startTime,
      hasGoogle: !!googleIntegration,
      hasSalesforce: !!salesforceIntegration
    }));

    return res.json(response);

  } catch (error) {
    console.error('Error fetching tokens for MCP:', error);
    console.log(JSON.stringify({
      rid,
      route: '/internal/integrations/tokens',
      userId: userId || 'none',
      status: 500,
      ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
