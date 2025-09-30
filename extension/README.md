# Opus Orb Chrome Extension

The Opus Orb Chrome Extension provides contextual meeting preparation and live coaching directly in your browser. The extension displays a persistent orb on all web pages, detects when you're in meetings, and provides relevant sales insights and coaching in real-time.

## Features

- **Always-Visible Orb**: Pinned orb on all web pages for instant access to Opus
- **Meeting Detection**: Automatically detects Google Meet, Zoom, and Teams meetings
- **Pre-Call Prep**: Shows upcoming meeting context and preparation tips
- **Live Coaching**: Provides real-time sales insights during active calls
- **Secure Authentication**: JWT-based authentication with automatic token refresh
- **Real-Time Data**: Access to live calendar events and CRM data through MCP integration

## Installation

### Prerequisites

1. **Opus Web Application**: Must be running on `http://localhost:5000` (development) or your production domain
2. **User Account**: Must be logged into the Opus web application
3. **Integrations**: Google Calendar and/or Salesforce CRM integrations should be configured for full functionality

### Installation Steps

1. **Open Chrome Extensions Page**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load Extension**
   - Click "Load unpacked"
   - Navigate to and select the `extension` folder in your Opus project

4. **Verify Installation**
   - The extension should appear in your extensions list
   - Pin the extension to your toolbar (optional)

### Authentication Setup

The extension automatically authenticates with your Opus web application:

1. **Log into Opus Web App**
   - Open `http://localhost:5000` (or your production URL)
   - Sign in with your Google account

2. **Automatic Token Handshake**
   - The web app automatically sends authentication tokens to the extension
   - Tokens refresh every 25 minutes to maintain connectivity
   - No manual setup required once logged in

## Usage

### Basic Operation

1. **Orb Visibility**
   - The Opus Orb appears on all web pages as a purple glowing orb
   - Located on the right side of the screen, vertically centered
   - Click to open the contextual panel

2. **States and Visual Indicators**

   - **Idle State** (Purple with pulse): Default state when no meetings are detected
   - **Pre-Call State** (Orange/Amber): Appears 30 minutes before scheduled meetings
   - **Live Call State** (Green): Active during detected meetings on supported platforms

### Meeting Detection

The extension automatically detects meetings on:

- **Google Meet**: `https://meet.google.com/*`
- **Zoom**: `https://*.zoom.us/j/*` and `https://*.zoom.us/wc/*`
- **Microsoft Teams**: `https://teams.microsoft.com/*`

### Contextual Information

#### Pre-Call Mode (30-minute window before meetings)
- Meeting title and time
- Participant list
- Quick preparation notes
- Account and opportunity context (if available)

#### Live Call Mode (during active meetings)
- Real-time meeting information
- Account details from CRM
- Opportunity amount and stage
- Key talking points and objection handling

### Panel Features

- **Contextual Tips**: Relevant sales insights based on meeting context
- **Quick Questions**: Ask Opus questions directly from the panel
- **Real-Time Updates**: Information updates automatically as context changes

## Testing

### Manual Testing Steps

1. **Authentication Test**
   ```
   1. Open Opus web app and log in
   2. Navigate to any website
   3. Verify Opus Orb appears
   4. Check browser console for token handshake messages
   ```

2. **Meeting Detection Test**
   ```
   1. Navigate to https://meet.google.com/new
   2. Verify orb changes to green (Live Call state)
   3. Open orb panel and check for live meeting context
   4. Navigate away and verify orb returns to idle state
   ```

3. **Pre-Call Test**
   ```
   1. Schedule a meeting in Google Calendar within 30 minutes
   2. Refresh any web page
   3. Verify orb changes to orange (Pre-Call state)
   4. Open panel to see meeting preparation information
   ```

4. **Context API Test**
   ```
   1. Open browser developer tools
   2. Navigate to Extensions > Opus Orb > Service Worker
   3. Check console logs for API calls and responses
   4. Verify no authentication errors (401/403)
   ```

### Troubleshooting

#### Orb Not Appearing
- Verify extension is installed and enabled
- Check if content script is blocked by page CSP
- Refresh the page and check browser console for errors

#### No Context Data
- Ensure you're logged into the Opus web app
- Verify Google Calendar/Salesforce integrations are connected
- Check browser console for API authentication errors
- Confirm backend endpoints are responding (`/api/orb/*`)

#### Meeting Detection Issues
- Verify URL patterns match supported meeting platforms
- Check browser console for meeting detection logs
- Ensure background script is running (check `chrome://extensions/`)

#### Authentication Problems
- Log out and back into the Opus web app
- Clear browser storage and reload extension
- Check network tab for `/api/auth/extension-token` requests
- Verify JWT token format in browser storage

### Browser Console Debugging

Open browser developer tools and check these sources:

1. **Page Console**: Token handshake messages and content script logs
2. **Extension Service Worker**: Background script logs and API calls
3. **Network Tab**: API requests to `/api/orb/*` endpoints
4. **Application Tab**: Stored extension tokens and settings

### API Endpoint Testing

Test backend endpoints directly:

```bash
# Get extension token (requires web app session)
curl -X POST http://localhost:5000/api/auth/extension-token \
  -H "Content-Type: application/json" \
  -b "session-cookie-value"

# Test next event endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/orb/next-event?window=30m

# Test context endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/orb/context?tabUrl=https://meet.google.com/abc-defg-hij"
```

## Architecture

### Components

- **manifest.json**: Chrome MV3 extension configuration
- **background.js**: Service worker handling API calls and meeting detection
- **content.js**: UI overlay with orb and panel components
- **panel/index.html**: Chrome side panel (optional interface)

### Communication Flow

1. **Web App → Extension**: Token handshake via `postMessage`
2. **Background → Content**: State updates and context data
3. **Background → API**: Authenticated requests to Opus backend
4. **Content → Background**: User interactions and Q&A requests

### Security

- **JWT Authentication**: Temporary tokens with 30-minute expiration
- **Origin Validation**: Only accepts messages from same origin
- **Shadow DOM**: UI isolation prevents page style conflicts
- **HTTPS Required**: Production deployment requires secure connections

## Development

### Local Development

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click "Reload" button for Opus Orb extension
4. Test changes on any web page

### Production Deployment

1. Update `OPUS_API` URL in `background.js`
2. Package extension for Chrome Web Store (if distributing)
3. Update manifest version for updates
4. Test with production Opus backend

## Support

For issues or feature requests:

1. Check browser console for error messages
2. Verify backend API endpoints are accessible
3. Test with minimal setup (logged in, no special configurations)
4. Check Chrome extension permissions and settings

## Version History

- **v0.1.0**: Initial release with meeting detection, contextual panels, and JWT authentication