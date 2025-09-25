import crypto from 'crypto';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: Date;
  scope?: string;
  tokenType?: string;
}

export class OAuthHandler {
  private config: OAuthConfig;
  private stateStore: Map<string, { timestamp: number; integrationId: string }> = new Map();

  constructor(config: OAuthConfig) {
    this.config = config;
    
    // Clean up expired state tokens every 10 minutes
    setInterval(() => {
      this.cleanupExpiredStates();
    }, 10 * 60 * 1000);
  }

  generateAuthorizationUrl(integrationId: string): string {
    const state = this.generateSecureState();
    
    // Store state with timestamp for validation
    this.stateStore.set(state, {
      timestamp: Date.now(),
      integrationId
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: state,
      access_type: 'offline', // For refresh tokens
      prompt: 'consent' // Force consent to get refresh token
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, state: string): Promise<{ tokens: OAuthTokens; integrationId: string }> {
    // Validate state
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new Error('Invalid or expired state parameter');
    }

    // Check if state is not too old (10 minutes max)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      this.stateStore.delete(state);
      throw new Error('State parameter has expired');
    }

    // Clean up used state
    this.stateStore.delete(state);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code: code
    });

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    
    const tokens: OAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      expiresAt: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined,
      scope: tokenData.scope,
      tokenType: tokenData.token_type || 'Bearer'
    };

    return {
      tokens,
      integrationId: stateData.integrationId
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken
    });

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // Some APIs don't return new refresh token
      expiresIn: tokenData.expires_in,
      expiresAt: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined,
      scope: tokenData.scope,
      tokenType: tokenData.token_type || 'Bearer'
    };
  }

  private generateSecureState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    const expiredStates: string[] = [];
    
    this.stateStore.forEach((data, state) => {
      if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
        expiredStates.push(state);
      }
    });
    
    expiredStates.forEach(state => this.stateStore.delete(state));
  }
}