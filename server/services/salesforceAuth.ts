import axios from 'axios';

// Salesforce OAuth configuration
export class SalesforceAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly loginUrl: string;

  constructor() {
    // Trim environment variables to remove any accidental whitespace
    this.clientId = process.env.SALESFORCE_CLIENT_ID?.trim() || '';
    this.clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim() || '';
    
    // Support different Salesforce environments (production, sandbox, My Domain)
    this.loginUrl = process.env.SALESFORCE_LOGIN_URL?.trim() || 'https://login.salesforce.com';
    
    if (!this.clientId || !this.clientSecret) {
      console.warn('Salesforce OAuth credentials not configured. Salesforce integrations will not work.');
    }

    // Use proper protocol for redirect URI
    const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || 'localhost:5000';
    const isLocalhost = replitDomain.includes('localhost');
    const protocol = isLocalhost ? 'http' : 'https';
    this.redirectUri = `${protocol}://${replitDomain}/api/integrations/salesforce/callback`;
  }

  // Check if Salesforce OAuth is properly configured
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // Generate Salesforce OAuth URL for CRM access
  getAuthUrl(state?: string): string {
    if (!this.isConfigured()) {
      throw new Error('Salesforce OAuth not configured');
    }

    const scopes = [
      'api',          // Access to Salesforce APIs
      'refresh_token' // Offline access
    ].join(' ');

    const authUrl = new URL(`${this.loginUrl}/services/oauth2/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('prompt', 'consent');
    
    // Add CSRF protection state if provided
    if (state) {
      authUrl.searchParams.set('state', state);
    }

    return authUrl.toString();
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    if (!this.isConfigured()) {
      throw new Error('Salesforce OAuth not configured');
    }

    try {
      const response = await axios.post(`${this.loginUrl}/services/oauth2/token`, new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: code
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Validate and normalize instance URL
      const instanceUrl = this.validateInstanceUrl(response.data.instance_url);
      
      // Compute token expiry (Salesforce tokens typically last 2 hours)
      const tokenExpiry = response.data.issued_at 
        ? new Date(parseInt(response.data.issued_at) + (2 * 60 * 60 * 1000)) // 2 hours from issued_at
        : new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 hours from now

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        instance_url: instanceUrl,
        token_type: response.data.token_type,
        scope: response.data.scope,
        token_expiry: tokenExpiry
      };
    } catch (error: any) {
      console.error('Error exchanging Salesforce code for tokens:', this.sanitizeError(error));
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  // Refresh access token using refresh token
  async refreshTokens(refreshToken: string, instanceUrl: string) {
    if (!this.isConfigured()) {
      throw new Error('Salesforce OAuth not configured');
    }

    // Validate instance URL to prevent SSRF
    const validatedInstanceUrl = this.validateInstanceUrl(instanceUrl);

    try {
      // Use login URL for token refresh, not instance URL
      const response = await axios.post(`${this.loginUrl}/services/oauth2/token`, new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Compute token expiry
      const tokenExpiry = response.data.issued_at 
        ? new Date(parseInt(response.data.issued_at) + (2 * 60 * 60 * 1000))
        : new Date(Date.now() + (2 * 60 * 60 * 1000));

      return {
        access_token: response.data.access_token,
        refresh_token: refreshToken, // Keep existing refresh token
        instance_url: validatedInstanceUrl,
        token_type: response.data.token_type,
        scope: response.data.scope,
        token_expiry: tokenExpiry
      };
    } catch (error: any) {
      console.error('Error refreshing Salesforce tokens:', this.sanitizeError(error));
      if (error.response?.status === 400) {
        throw new Error('REFRESH_TOKEN_INVALID');
      }
      throw new Error('Failed to refresh Salesforce tokens');
    }
  }

  // Make authenticated API call to Salesforce
  async makeApiCall(endpoint: string, accessToken: string, instanceUrl: string, method: 'GET' | 'POST' = 'GET', data?: any) {
    // Validate instance URL to prevent SSRF
    const validatedInstanceUrl = this.validateInstanceUrl(instanceUrl);
    
    try {
      const response = await axios({
        method,
        url: `${validatedInstanceUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data
      });

      return response.data;
    } catch (error: any) {
      console.error('Salesforce API call failed:', this.sanitizeError(error));
      if (error.response?.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }
      throw error;
    }
  }

  // Test API connection
  async testConnection(accessToken: string, instanceUrl: string) {
    try {
      const response = await this.makeApiCall('/services/data/v58.0/', accessToken, instanceUrl);
      return { success: true, data: response };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Validate and normalize instance URL to prevent SSRF attacks
  private validateInstanceUrl(instanceUrl: string): string {
    if (!instanceUrl) {
      throw new Error('Instance URL is required');
    }

    try {
      const url = new URL(instanceUrl);
      
      // Ensure HTTPS protocol
      if (url.protocol !== 'https:') {
        throw new Error('Instance URL must use HTTPS');
      }

      // Validate Salesforce domains - must be *.salesforce.com or known My Domain patterns
      const hostname = url.hostname.toLowerCase();
      if (!hostname.endsWith('.salesforce.com') && 
          !hostname.endsWith('.my.salesforce.com') &&
          !hostname.endsWith('.lightning.force.com')) {
        throw new Error('Invalid Salesforce instance URL domain');
      }

      // Return normalized URL (protocol + hostname)
      return `${url.protocol}//${url.hostname}`;
    } catch (error: any) {
      throw new Error(`Invalid instance URL: ${error.message}`);
    }
  }

  // Sanitize error objects for logging to prevent secret leakage
  private sanitizeError(error: any): any {
    if (!error) return error;

    // For axios errors, only log safe fields
    if (error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        message: error.message,
        url: error.config?.url ? new URL(error.config.url).pathname : undefined
      };
    }

    // For general errors, only log message and code
    return {
      message: error.message,
      code: error.code,
      name: error.name
    };
  }
}

export const salesforceAuth = new SalesforceAuthService();