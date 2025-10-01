# MCP Remote Service Setup

This guide explains how to enable the remote opus-mcp service in the web app.

## Environment Variables

Add these environment variables to enable remote MCP mode:

```bash
# Enable remote MCP service
MCP_REMOTE_ENABLED=true

# MCP service URL (opus-mcp service)
MCP_BASE_URL=http://localhost:4000

# MCP service authentication token (must match opus-mcp service token)
MCP_SERVICE_TOKEN=your-secret-token-here
```

## How It Works

### When `MCP_REMOTE_ENABLED=true`:
- All MCP tool calls are sent to the opus-mcp service via HTTP
- Each request is logged with format: `[MCP-Remote] <toolName> [<6-char-id>]`
- Authentication uses Bearer token from `MCP_SERVICE_TOKEN`
- No local tool execution happens

### When `MCP_REMOTE_ENABLED=false` (or not set):
- MCP tools execute locally using `MomentumMCPServer`
- No HTTP requests to opus-mcp service
- Original behavior is preserved (no regressions)

## Request Logging

All HTTP requests to the opus-mcp service are logged to the console:

```
[MCP-Remote] calendar.next_events.v1 [a3f9b2]
[MCP-Remote] calendar.next_events.v1 [a3f9b2] SUCCESS
```

Failed requests show error details:
```
[MCP-Remote] salesforce.lookup_account.v1 [x7k4m1] FAILED: Connect Salesforce to access CRM data
```

## Testing

1. Start the opus-mcp service:
   ```bash
   cd opus-mcp
   export PORT=4000
   export MCP_SERVICE_TOKEN="test-token-123"
   npm run dev
   ```

2. Enable remote mode in the web app:
   ```bash
   export MCP_REMOTE_ENABLED=true
   export MCP_BASE_URL=http://localhost:4000
   export MCP_SERVICE_TOKEN="test-token-123"  # Must match opus-mcp token
   ```

3. Restart the web app and watch the logs for `[MCP-Remote]` messages

## Security Notes

- The `MCP_SERVICE_TOKEN` must be kept secret
- Token must match between web app and opus-mcp service
- Use different tokens for dev/staging/production environments
- The opus-mcp service validates bearer tokens on all requests

## Implementation Details

### Modified Files

1. **shared/mcpClient.ts**
   - Added `httpCall()` method logging with 6-char request IDs
   - Logs format: `[MCP-Remote] <toolName> [<requestId>]`

2. **server/mcp/mcp-server.ts**
   - Created `RemoteMCPClient` class for HTTP-based tool execution
   - Updated `createMCPServer()` factory to check `MCP_REMOTE_ENABLED` flag
   - Automatic fallback to local mode if token is missing

3. **server/config/env.ts** (already configured)
   - Added `MCP_REMOTE_ENABLED`, `MCP_BASE_URL`, `MCP_SERVICE_TOKEN` to EnvConfig

### Backward Compatibility

✅ No changes required to existing code
✅ All tool calls work identically in both modes
✅ Same error handling and responses
✅ Zero breaking changes
