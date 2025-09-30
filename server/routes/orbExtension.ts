import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage.js';
import { isAuthenticated } from '../replitAuth.js';
import { ENV } from '../config/env.js';

const router = Router();

/**
 * POST /orb/extension/bootstrap
 * Returns configuration for Chrome extension including JWT, MCP WebSocket URL, and user info
 */
router.post('/bootstrap', isAuthenticated, async (req, res) => {
  try {
    const user = req.user!;
    const userId = user.claims?.sub || user.sub || user.id;

    console.log(`[OrbExtension] Bootstrap request for user ${userId}`);

    // Generate JWT token for extension (30 minutes)
    const extensionJwt = jwt.sign(
      {
        userId,
        scope: 'orb:read',
        type: 'extension'
      },
      process.env.OPUS_JWT_SECRET!,
      { expiresIn: '30m' }
    );

    // Get user information
    const userName = user.name || user.claims?.name || user.email?.split('@')[0] || 'User';
    const userEmail = user.email || user.claims?.email;

    // Check integration status for MCP availability
    const googleIntegration = await storage.getGoogleIntegration(userId);
    const salesforceIntegration = await storage.getSalesforceIntegration(userId);

    const response = {
      jwt: extensionJwt,
      apiBaseUrl: `${ENV.API_ORIGIN}/api`,
      mcpWsUrl: ENV.API_ORIGIN.replace('http://', 'ws://').replace('https://', 'wss://') + '/mcp',
      user: {
        id: userId,
        name: userName,
        email: userEmail
      },
      integrations: {
        google: {
          connected: googleIntegration?.isActive || false,
          scopes: googleIntegration?.isActive ? ['calendar', 'gmail'] : []
        },
        salesforce: {
          connected: salesforceIntegration?.isActive || false,
          scopes: salesforceIntegration?.isActive ? ['accounts', 'contacts', 'opportunities'] : []
        }
      }
    };

    console.log(`[OrbExtension] Bootstrap successful for user ${userId}`, {
      googleConnected: response.integrations.google.connected,
      salesforceConnected: response.integrations.salesforce.connected
    });

    res.json(response);

  } catch (error) {
    console.error('[OrbExtension] Bootstrap error:', error);
    res.status(500).json({
      error: 'Failed to bootstrap extension',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;