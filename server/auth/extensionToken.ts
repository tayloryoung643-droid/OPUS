import jwt from 'jsonwebtoken';

export interface OrbTokenPayload {
  userId: string;
  scope: 'orb:read';
  iat: number;
  exp: number;
}

/**
 * Mint a short-lived JWT token for Chrome extension access
 * Token expires in 30 minutes and has orb:read scope only
 */
export function mintOrbToken(userId: string): string {
  if (!process.env.OPUS_JWT_SECRET) {
    throw new Error('OPUS_JWT_SECRET environment variable is required');
  }

  const payload: OrbTokenPayload = {
    userId,
    scope: 'orb:read',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
  };

  return jwt.sign(payload, process.env.OPUS_JWT_SECRET, { algorithm: 'HS256' });
}

/**
 * Verify and decode an orb token
 * Returns the payload if valid, throws if invalid/expired
 */
export function verifyOrbToken(token: string): OrbTokenPayload {
  if (!process.env.OPUS_JWT_SECRET) {
    throw new Error('OPUS_JWT_SECRET environment variable is required');
  }

  try {
    const decoded = jwt.verify(token, process.env.OPUS_JWT_SECRET, { 
      algorithms: ['HS256'] 
    }) as jwt.JwtPayload & OrbTokenPayload;
    
    // Verify scope
    if (decoded.scope !== 'orb:read') {
      throw new Error('Invalid token scope');
    }

    return {
      userId: decoded.userId,
      scope: decoded.scope,
      iat: decoded.iat,
      exp: decoded.exp
    };
  } catch (error) {
    throw new Error(`Invalid orb token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}