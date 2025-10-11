import { Router } from 'express';
import { storage } from '../storage';
import { ENV } from '../config/env';

const router = Router();

/**
 * Server-to-server token provider endpoint
 * Used by MCP service to fetch OAuth tokens for a given user
 * 
 * Request body: { userId: "test-user" } OR { email: "me@domain.com" }
 * Response: { "google": { "access_token": "...", "refresh_token": "...", "expiry_date": 1731234567890 } }
 * If not connected: { "google": null }
 * 
 * Security: Requires Authorization: Bearer <MCP_TOKEN_PROVIDER_SECRET>
 * NEVER expose this endpoint to browsers (no CORS, server-only)
 */
router.post('/integrations/tokens', async (req, res) => {
  const startTime = Date.now();
  const rid = (req as any).rid || 'unknown';

  try {
    // Validate bearer token
    const authHeader = req.header('authorization');
    const expectedAuth = `Bearer ${ENV.MCP_TOKEN_PROVIDER_SECRET}`;
    
    if (!ENV.MCP_TOKEN_PROVIDER_SECRET || authHeader !== expectedAuth) {
      console.log(JSON.stringify({
        rid,
        route: 'POST /internal/integrations/tokens',
        status: 401,
        ms: Date.now() - startTime,
        error: 'Unauthorized - missing or invalid bearer token'
      }));
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract userId or email from request body
    const { userId, email } = req.body || {};
    const userIdentifierRaw = (userId || email || '').trim();

    // Validate user identifier
    if (!userIdentifierRaw) {
      console.log(JSON.stringify({
        rid,
        route: 'POST /internal/integrations/tokens',
        status: 400,
        ms: Date.now() - startTime,
        error: 'Missing userId or email in request body'
      }));
      return res.status(400).json({ error: 'Missing userId or email in request body' });
    }

    let resolvedUserId: string | undefined = userIdentifierRaw;
    let resolvedEmail: string | undefined;

    // If email provided, resolve to userId
    if (userIdentifierRaw.includes('@')) {
      const userRecord = await storage.getUserByEmail(userIdentifierRaw);

      if (!userRecord) {
        console.log(JSON.stringify({
          rid,
          route: 'POST /internal/integrations/tokens',
          identifier: userIdentifierRaw,
          status: 200,
          ms: Date.now() - startTime,
          result: 'user_not_found',
          hasGoogle: false
        }));

        // User doesn't exist - return null for google
        return res.json({ google: null });
      }

      resolvedUserId = userRecord.id;
      resolvedEmail = userRecord.email || userIdentifierRaw;
    }

    // Fetch Google tokens from database (already decrypted by storage methods)
    const googleIntegration = resolvedUserId 
      ? await storage.getGoogleIntegration(resolvedUserId)
      : undefined;

    // Build response object in exact format required
    const response: { google: { access_token: string; refresh_token: string; expiry_date: number } | null } = {
      google: null
    };

    if (googleIntegration && googleIntegration.accessToken) {
      response.google = {
        access_token: googleIntegration.accessToken,
        refresh_token: googleIntegration.refreshToken || '',
        expiry_date: googleIntegration.tokenExpiry 
          ? googleIntegration.tokenExpiry.getTime() 
          : Date.now() + 3600000 // Default 1 hour from now
      };
    }

    // Log successful token fetch (no token values in logs)
    console.log(JSON.stringify({
      rid,
      route: 'POST /internal/integrations/tokens',
      identifier: userIdentifierRaw,
      resolvedUserId,
      resolvedEmail: resolvedEmail || null,
      status: 200,
      ms: Date.now() - startTime,
      hasGoogle: !!googleIntegration
    }));

    return res.json(response);

  } catch (error) {
    console.error('Error fetching tokens for MCP:', error);
    console.log(JSON.stringify({
      rid,
      route: 'POST /internal/integrations/tokens',
      status: 500,
      ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Debug endpoint to test token resolution (development only)
 * 
 * Request body: { userId: "test-user" } OR { email: "me@domain.com" }
 * Response: { resolvedUserId: "...", email: "...", hasGoogleTokens: true/false }
 * 
 * NO SECRETS IN LOGS - only returns metadata about token existence
 */
router.post('/debug/tokens/echo', async (req, res) => {
  if (ENV.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const startTime = Date.now();
  const rid = (req as any).rid || 'unknown';

  try {
    const { userId, email } = req.body || {};
    const userIdentifierRaw = (userId || email || '').trim();

    if (!userIdentifierRaw) {
      return res.status(400).json({ 
        error: 'Missing userId or email in request body',
        example: { userId: "test-user" } 
      });
    }

    let resolvedUserId: string | undefined = userIdentifierRaw;
    let resolvedEmail: string | undefined;
    let userFound = true;

    // If email provided, resolve to userId
    if (userIdentifierRaw.includes('@')) {
      const userRecord = await storage.getUserByEmail(userIdentifierRaw);
      
      if (!userRecord) {
        userFound = false;
        resolvedUserId = undefined;
        resolvedEmail = userIdentifierRaw;
      } else {
        resolvedUserId = userRecord.id;
        resolvedEmail = userRecord.email || userIdentifierRaw;
      }
    }

    // Fetch Google integration (if user exists)
    const googleIntegration = resolvedUserId 
      ? await storage.getGoogleIntegration(resolvedUserId)
      : undefined;

    const response = {
      debug: true,
      input: {
        userId: userId || null,
        email: email || null
      },
      resolution: {
        userFound,
        resolvedUserId: resolvedUserId || null,
        resolvedEmail: resolvedEmail || null
      },
      tokens: {
        hasGoogleTokens: !!googleIntegration,
        hasAccessToken: !!(googleIntegration?.accessToken),
        hasRefreshToken: !!(googleIntegration?.refreshToken),
        tokenExpiry: googleIntegration?.tokenExpiry 
          ? googleIntegration.tokenExpiry.toISOString() 
          : null
      },
      ms: Date.now() - startTime
    };

    console.log(JSON.stringify({
      rid,
      route: 'POST /debug/tokens/echo',
      ...response
    }));

    return res.json(response);

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      ms: Date.now() - startTime
    });
  }
});

export default router;
