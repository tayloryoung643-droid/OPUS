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

    // Use proper protocol for redirect URI - match Salesforce implementation
    const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || 'localhost:5000';
    const isLocalhost = replitDomain.includes('localhost');
    const protocol = isLocalhost ? 'http' : 'https';
    this.redirectUri = `${protocol}://${replitDomain}/api/integrations/google/callback`;
    
    this.oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      this.redirectUri
    );
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