import { Request, Response, NextFunction } from 'express';
import { verifyOrbToken, OrbTokenPayload } from '../auth/extensionToken.js';

// Extend the Request interface to include orbToken
declare global {
  namespace Express {
    interface Request {
      orbToken?: OrbTokenPayload;
    }
  }
}

/**
 * Middleware to verify orb tokens for Chrome extension endpoints
 * Expects Authorization: Bearer <token> header
 * Sets req.orbToken with decoded payload if valid
 */
export function verifyOrbTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Authorization header required',
        message: 'Please provide a valid orb token'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Invalid authorization format',
        message: 'Authorization header must be "Bearer <token>"'
      });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Missing token',
        message: 'Authorization token is required'
      });
    }

    // Verify and decode the token
    const payload = verifyOrbToken(token);
    
    // Attach the payload to the request for use in routes
    req.orbToken = payload;
    
    next();
  } catch (error) {
    console.error('[OrbToken] Verification failed:', error);
    
    return res.status(401).json({ 
      error: 'Invalid token',
      message: error instanceof Error ? error.message : 'Token verification failed'
    });
  }
}