# MCP Token Provider - Setup Complete ✅

## Summary of Changes

The token provider endpoint has been updated to match your exact requirements:

### 1. Updated Endpoint: POST /internal/integrations/tokens

**Changes:**
- ✅ Changed from GET to POST
- ✅ Accepts body params: `{ userId: "..." }` OR `{ email: "..." }`
- ✅ Returns exact format: `{ "google": { "access_token": "...", "refresh_token": "...", "expiry_date": 1731234567890 } }`
- ✅ Returns `{ "google": null }` if user not connected
- ✅ Requires `Authorization: Bearer <MCP_TOKEN_PROVIDER_SECRET>` header
- ✅ Returns 401 if auth missing/invalid

### 2. New Debug Endpoint: POST /debug/tokens/echo

**Features:**
- ✅ Dev-only endpoint (disabled in production)
- ✅ Echoes resolved user and token status
- ✅ NO secrets in logs (only metadata)
- ✅ Useful for testing user resolution from MCP Repl

### 3. Documentation Added

Created comprehensive README.md with:
- MCP integration architecture
- Token provider endpoint documentation
- Required environment variables
- curl examples for testing
- Security best practices

---

## File Diffs

### server/routes/internalTokens.ts

**Key Changes:**
```diff
- router.get('/integrations/tokens', async (req, res) => {
+ router.post('/integrations/tokens', async (req, res) => {

- const userIdentifierRaw = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
+ const { userId, email } = req.body || {};
+ const userIdentifierRaw = (userId || email || '').trim();

- response.google = {
-   accessToken: googleIntegration.accessToken,
-   refreshToken: googleIntegration.refreshToken || undefined,
-   expiry: googleIntegration.tokenExpiry ? Math.floor(googleIntegration.tokenExpiry.getTime() / 1000) : undefined,
-   scopes: googleIntegration.scopes || [...]
- };
+ response.google = {
+   access_token: googleIntegration.accessToken,
+   refresh_token: googleIntegration.refreshToken || '',
+   expiry_date: googleIntegration.tokenExpiry 
+     ? googleIntegration.tokenExpiry.getTime() 
+     : Date.now() + 3600000
+ };

+ // New: Return { google: null } if user not found
+ if (!userRecord) {
+   return res.json({ google: null });
+ }
```

**New Debug Endpoint:**
```typescript
router.post('/debug/tokens/echo', async (req, res) => {
  if (ENV.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Returns user resolution metadata without exposing secrets
  return res.json({
    debug: true,
    input: { userId, email },
    resolution: { userFound, resolvedUserId, resolvedEmail },
    tokens: { hasGoogleTokens, hasAccessToken, hasRefreshToken, tokenExpiry }
  });
});
```

---

## Required Environment Variables

Configure these in your MCP Repl to call the token provider:

```bash
# In your application's .env
MCP_TOKEN_PROVIDER_SECRET=<generate-a-long-random-secret>

# In MCP service's .env
MCP_TOKEN_PROVIDER_URL=https://your-app.replit.app/internal/integrations/tokens
MCP_TOKEN_PROVIDER_SECRET=<same-secret-as-above>
```

**Generate secure secret:**
```bash
openssl rand -base64 32
# Example output: 7kX9mP2nQ5vR8wT1jL4hZ6yU3sB0aE5c
```

---

## curl Examples (Run from MCP Repl Shell)

### 1. Test with Debug Endpoint (No Auth Required in Dev)

```bash
# Test user resolution by email
curl -X POST https://your-app.replit.app/debug/tokens/echo \
  -H "Content-Type: application/json" \
  -d '{"email": "tayloryoung643@gmail.com"}'
```

**Expected Response:**
```json
{
  "debug": true,
  "input": {
    "userId": null,
    "email": "tayloryoung643@gmail.com"
  },
  "resolution": {
    "userFound": true,
    "resolvedUserId": "45677158",
    "resolvedEmail": "tayloryoung643@gmail.com"
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

### 2. Production Endpoint (Requires Auth)

```bash
# Fetch tokens by userId
curl -X POST https://your-app.replit.app/internal/integrations/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MCP_TOKEN_PROVIDER_SECRET" \
  -d '{"userId": "45677158"}'
```

**Expected Response:**
```json
{
  "google": {
    "access_token": "ya29.a0AfB_byD...",
    "refresh_token": "1//05abc...",
    "expiry_date": 1731234567890
  }
}
```

```bash
# Fetch tokens by email
curl -X POST https://your-app.replit.app/internal/integrations/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MCP_TOKEN_PROVIDER_SECRET" \
  -d '{"email": "tayloryoung643@gmail.com"}'
```

**Expected Response (same as above):**
```json
{
  "google": {
    "access_token": "ya29.a0AfB_byD...",
    "refresh_token": "1//05abc...",
    "expiry_date": 1731234567890
  }
}
```

### 3. User Not Connected (Returns Null)

```bash
curl -X POST https://your-app.replit.app/internal/integrations/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MCP_TOKEN_PROVIDER_SECRET" \
  -d '{"email": "nonexistent@example.com"}'
```

**Expected Response:**
```json
{
  "google": null
}
```

### 4. Invalid Auth (Returns 401)

```bash
curl -X POST https://your-app.replit.app/internal/integrations/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong-secret" \
  -d '{"userId": "45677158"}'
```

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

---

## Testing Checklist

From your MCP Repl shell, verify:

- [ ] Debug endpoint resolves email → userId correctly
- [ ] Debug endpoint shows token availability status
- [ ] Production endpoint requires bearer token (401 without it)
- [ ] Production endpoint accepts `userId` in body
- [ ] Production endpoint accepts `email` in body
- [ ] Response format matches exactly: `{ "google": { "access_token", "refresh_token", "expiry_date" } }`
- [ ] Returns `{ "google": null }` for non-existent users
- [ ] No secrets appear in server logs

---

## Security Notes

1. **Never commit secrets to git** - use environment variables
2. **MCP_TOKEN_PROVIDER_SECRET must be the same** in both app and MCP service
3. **All tokens are encrypted at rest** with AES-256-GCM
4. **Tokens are auto-decrypted** before being returned
5. **Debug endpoint is disabled in production** for security
6. **No token values in logs** - only metadata about existence

---

## Integration Flow

```
┌─────────────┐                    ┌──────────────────┐                  ┌─────────────┐
│             │                    │                  │                  │             │
│  MCP Agent  │ ──── Request ────▶ │  Token Provider  │ ──── Query ────▶ │  Database   │
│   (Tools)   │    (userId/email)  │    Endpoint      │  (decrypt tokens)│ (Postgres)  │
│             │                    │                  │                  │             │
│             │ ◀─── Response ──── │                  │ ◀─── Tokens ──── │             │
│             │  (Google tokens)   │                  │                  │             │
└─────────────┘                    └──────────────────┘                  └─────────────┘
```

---

## Next Steps

1. Copy your app URL (e.g., `https://your-app.replit.app`)
2. Set `MCP_TOKEN_PROVIDER_URL` in MCP service env
3. Generate and set `MCP_TOKEN_PROVIDER_SECRET` in both apps
4. Test with debug endpoint first
5. Test production endpoint with real secret
6. Integrate into MCP tools that need Google Calendar/Gmail access

---

✅ **Token provider is ready to use!**
