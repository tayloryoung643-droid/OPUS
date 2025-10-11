# Momentum AI - Sales Call Preparation Platform

A comprehensive sales call preparation platform that helps sales teams research prospects, analyze conversations, and prepare personalized strategies using AI.

## Architecture

This application operates in **MCP-only mode** - all AI prep generation is handled by a remote MCP (Model Context Protocol) service. The Express backend serves as the web interface and token provider for the MCP service.

## MCP Token Provider Integration

The application exposes a secure token provider endpoint that allows the MCP service to fetch real Google OAuth tokens for authenticated users.

### Endpoint: POST /internal/integrations/tokens

**Security:** Requires `Authorization: Bearer <MCP_TOKEN_PROVIDER_SECRET>` header

**Request Body:**
```json
{
  "userId": "45677158"
}
```

OR

```json
{
  "email": "user@example.com"
}
```

**Response (user connected):**
```json
{
  "google": {
    "access_token": "ya29.a0AfB_byD...",
    "refresh_token": "1//05abc...",
    "expiry_date": 1731234567890
  }
}
```

**Response (user not connected):**
```json
{
  "google": null
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid bearer token
- `400 Bad Request` - Missing userId or email in request body
- `500 Internal Server Error` - Server error during token retrieval

### Environment Variables

Configure these environment variables for MCP integration:

```bash
# MCP Service Configuration
ORCHESTRATOR=mcp                           # Set to 'mcp' for MCP-only mode
MCP_BASE_URL=https://mcp-service.com       # Base URL of your MCP service
MCP_SERVICE_TOKEN=<service-token>          # Token for authenticating to MCP endpoints
MCP_TOKEN_PROVIDER_SECRET=<random-secret>  # Secret for MCP to authenticate when fetching tokens

# Token Provider URL (configure on MCP side)
# MCP_TOKEN_PROVIDER_URL=https://your-app.replit.app/internal/integrations/tokens
```

**Generate a secure MCP_TOKEN_PROVIDER_SECRET:**
```bash
# Generate a cryptographically secure random string (32+ characters)
openssl rand -base64 32
```

### Testing the Token Provider

Use the debug endpoint to test user resolution and token availability (development only):

**Endpoint:** POST /debug/tokens/echo

**Example:**
```bash
curl -X POST https://your-app.replit.app/debug/tokens/echo \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Response:**
```json
{
  "debug": true,
  "input": {
    "userId": null,
    "email": "user@example.com"
  },
  "resolution": {
    "userFound": true,
    "resolvedUserId": "45677158",
    "resolvedEmail": "user@example.com"
  },
  "tokens": {
    "hasGoogleTokens": true,
    "hasAccessToken": true,
    "hasRefreshToken": true,
    "tokenExpiry": "2025-10-12T03:24:18.000Z"
  },
  "ms": 145
}
```

**Note:** The debug endpoint is disabled in production and does NOT expose actual token values.

### curl Examples for MCP Service

**Fetch tokens by userId:**
```bash
curl -X POST https://your-app.replit.app/internal/integrations/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-mcp-token-provider-secret" \
  -d '{"userId": "45677158"}'
```

**Fetch tokens by email:**
```bash
curl -X POST https://your-app.replit.app/internal/integrations/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-mcp-token-provider-secret" \
  -d '{"email": "user@example.com"}'
```

**Expected response:**
```json
{
  "google": {
    "access_token": "ya29.a0AfB_byD...",
    "refresh_token": "1//05abc...",
    "expiry_date": 1731234567890
  }
}
```

### MCP Service Implementation Notes

1. **Authentication:** Always include the `Authorization: Bearer <secret>` header
2. **User Resolution:** MCP can identify users by either `userId` (internal ID) or `email`
3. **Email Lookup:** If email is provided, the endpoint automatically resolves to the internal userId
4. **Null Response:** If user doesn't exist or hasn't connected Google, `{ "google": null }` is returned
5. **Token Security:** All tokens are encrypted at rest using AES-256-GCM
6. **Token Decryption:** Tokens are automatically decrypted by the endpoint before being returned
7. **Expiry Format:** `expiry_date` is Unix timestamp in milliseconds (not seconds)

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (create `.env` file):
```bash
SESSION_SECRET=your-session-secret
OPUS_JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=your-32-char-encryption-key
MCP_TOKEN_PROVIDER_SECRET=your-mcp-secret
```

3. Run the application:
```bash
npm run dev
```

## API Endpoints

### Public Endpoints
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/calendar/today` - Get today's calendar events
- `GET /api/calendar/events` - Get all calendar events
- `POST /api/generate-prep` - Generate AI prep (forwards to MCP)
- `GET /api/recent-prep` - Get recent prep history (from MCP)

### Internal Endpoints (Server-to-Server Only)
- `POST /internal/integrations/tokens` - Token provider for MCP service
- `POST /debug/tokens/echo` - Debug endpoint for testing (dev only)

## Security

- **Token Encryption:** All OAuth tokens are encrypted at rest using AES-256-GCM
- **Bearer Authentication:** All internal endpoints require bearer token authentication
- **No CORS:** Internal endpoints are server-to-server only, no browser access
- **Secure Secrets:** Use environment variables for all secrets, never commit to git
- **Logging:** No secrets are logged, only metadata about token existence

## License

MIT
