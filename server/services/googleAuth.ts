import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Google OAuth configuration
export class GoogleAuthService {
  private oauth2Client: OAuth2Client;
  private readonly redirectUri: string;

  constructor() {
    // Trim environment variables to remove any accidental whitespace
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    
    if (!clientId || !clientSecret) {
      console.warn('Google OAuth credentials not configured. Google integrations will not work.');
      // Create a dummy client to prevent errors
      this.oauth2Client = new OAuth2Client();
      this.redirectUri = '';
      return;
    }

    this.redirectUri = this.resolveRedirectUri();

    this.oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      this.redirectUri
    );
  }

  private resolveRedirectUri(): string {
    const explicitRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (explicitRedirectUri) {
      return this.ensureCallbackPath(explicitRedirectUri);
    }

    const normalizedFromEnv = (
      process.env.REPLIT_PUBLIC_URL ||
      process.env.REPLIT_DOMAIN ||
      this.extractFirstDomain(process.env.REPLIT_DOMAINS) ||
      process.env.PUBLIC_SERVER_URL ||
      process.env.PUBLIC_URL ||
      process.env.APP_URL ||
      process.env.BASE_URL ||
      ''
    ).trim();

    if (normalizedFromEnv) {
      return this.ensureCallbackPath(normalizedFromEnv);
    }

    const localhostFallback = process.env.HOST?.trim() || 'localhost:5000';
    const protocol = localhostFallback.includes('localhost') || localhostFallback.includes('127.0.0.1')
      ? 'http'
      : 'https';
    return `${protocol}://${localhostFallback}/api/integrations/google/callback`;
  }

  private extractFirstDomain(domains?: string): string | undefined {
    if (!domains) return undefined;
    const [firstDomain] = domains
      .split(',')
      .map((domain) => domain.trim())
      .filter(Boolean);
    return firstDomain;
  }

  private ensureCallbackPath(baseUrl: string): string {
    let normalizedUrl = baseUrl.trim();

    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      const prefersHttp = normalizedUrl.includes('localhost') || normalizedUrl.includes('127.0.0.1');
      normalizedUrl = `${prefersHttp ? 'http' : 'https'}://${normalizedUrl}`;
    }

    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    if (normalizedUrl.endsWith('/api/integrations/google/callback')) {
      return normalizedUrl;
    }

    return `${normalizedUrl}/api/integrations/google/callback`;
  }

  // Check if Google OAuth is properly configured
  isConfigured(): boolean {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    return !!(clientId && clientSecret);
  }

  // Generate Google OAuth URL for calendar and gmail access
  getAuthUrl(): string {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
      'profile',
      'email'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  // Exchange code for tokens
  async getTokens(code: string) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  // Create authenticated Google API clients
  createCalendarClient(tokens: any) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth not configured');
    }

    this.oauth2Client.setCredentials(tokens);
    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  createGmailClient(tokens: any) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth not configured');
    }

    this.oauth2Client.setCredentials(tokens);
    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  // Refresh access token using refresh token
  async refreshTokens(refreshToken: string) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth not configured');
    }

    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      // Use the supported method to get fresh access token
      const { token } = await this.oauth2Client.getAccessToken();
      
      if (!token) {
        throw new Error('No access token received from refresh');
      }
      
      return {
        access_token: token,
        refresh_token: refreshToken, // Keep existing refresh token
        expiry_date: Date.now() + (3600 * 1000) // 1 hour from now
      };
    } catch (error: any) {
      console.error('Error refreshing Google tokens:', error);
      if (error.message?.includes('invalid_grant') || error.message?.includes('invalid_request')) {
        throw new Error('REFRESH_TOKEN_INVALID');
      }
      throw new Error('Failed to refresh Google tokens');
    }
  }
}

export const googleAuth = new GoogleAuthService();