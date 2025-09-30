# Momentum AI - Sales Call Preparation Platform

## Overview

Momentum AI is a comprehensive sales call preparation platform that helps sales teams research prospects, analyze conversations, and prepare personalized strategies using AI. The application streamlines the sales process by automatically generating executive summaries, competitive analysis, stakeholder insights, and conversation strategies, reducing preparation time from hours to minutes.

The platform is built as a full-stack web application with a React frontend and Express.js backend, utilizing PostgreSQL for data persistence and OpenAI for AI-powered research generation.

## Recent Changes

**September 28, 2025**
- **🔥 CRITICAL FIX: Voice Mode MCP Integration & Sample Data Elimination**
  - **Problem Resolved**: Voice sessions were using sample data instead of real Salesforce/Calendar data due to MCP disconnection
  - **Fixed Import Error**: Added `GmailService` class and exported `gmailService` instance to resolve voice mode import failures
  - **Blocked Demo Data**: Added USE_MOCKS flag protection to `/api/demo/setup` endpoint preventing sample company creation
  - **Removed Mock Fallbacks**: Eliminated calendar event mock data fallbacks showing "Acme Corp" and similar sample information
  - **Anti-Sample Guardrails**: Added explicit instructions to OpenAI Realtime API to never fabricate or use placeholder data
  - **Voice Token Endpoint**: Fixed `/api/openai/realtime/token` to return 200 with proper MCP context integration
  - **Data Integrity**: Voice mode now accesses real-time Salesforce CRM and Google Calendar data through MCP tools
  - **Test Validation**: Confirmed voice sessions successfully connect to OpenAI Realtime API with real data access

- **🎉 MAJOR UPDATE: Completed OpenAI Realtime Voice Mode Implementation**
  - **Project Pivot**: Transformed Momentum AI into Opus - an emotional, personal AI Partner with real-time voice interaction
  - **Backend**: Implemented secure `/api/openai/realtime/token` endpoint with ephemeral session creation, proper OpenAI-Beta headers, and cache control
  - **Frontend**: Built complete WebRTC helper (`realtimeClient.ts`) with mic capture, SDP negotiation, and audio playback
  - **UI Transformation**: Updated OpusOrb component from Silent Call Recorder to real-time voice mode with state management (inactive/connecting/listening/error)
  - **Critical Fixes**: Added required OpenAI-Beta headers, cache control, and proper WebRTC handshake requirements
  - **Security**: Implemented session-based authentication, encrypted token storage, and proper error handling
  - **Ready for Testing**: Users can now click the Opus Orb to start/stop voice conversations with OpenAI's GPT-4o Realtime model

**September 27, 2025**
- **Fixed Navigation Bug**: Resolved agenda button navigation issue by implementing proper React Router v6 navigation
  - Updated Overview page (OpusLandingPage.tsx) to use useNavigate() instead of hardcoded href="#" links
  - Updated Agenda page (OpusAgendaMock.tsx) to support bidirectional navigation between /overview and /agenda
  - Added proper test IDs and disabled styling for unimplemented tabs (Pipeline, Tasks, Coach, Insights)
  - Verified complete navigation flow: Overview ↔ Agenda ↔ Settings all working correctly

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built using React with TypeScript, implementing a modern component-based architecture:

- **UI Framework**: React with TypeScript for type safety and developer experience
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design system
- **Build Tool**: Vite for fast development and optimized production builds

The application follows a component-driven design with reusable UI components and specific feature components for call preparation sections (executive summary, CRM history, competitive landscape, etc.).

### Backend Architecture
The backend uses Express.js with TypeScript in a RESTful API pattern:

- **Framework**: Express.js with TypeScript for type-safe server-side development
- **Database ORM**: Drizzle ORM for type-safe database interactions
- **API Design**: RESTful endpoints following resource-based URL patterns
- **Middleware**: Custom logging middleware for API request tracking
- **Error Handling**: Centralized error handling with proper HTTP status codes

The server architecture separates concerns through distinct layers for routing, data access (storage), and external service integration.

### Data Storage Solutions
The application uses PostgreSQL as the primary database with Drizzle ORM:

- **Database**: PostgreSQL via Neon serverless for scalability
- **ORM**: Drizzle ORM with schema-first approach for type safety
- **Schema Design**: Relational design with companies, contacts, calls, and call preparations tables
- **Migrations**: Drizzle Kit for database schema management
- **Connection**: Neon serverless with WebSocket support for optimal performance

The database schema supports the core entities: companies (prospect organizations), contacts (stakeholders), calls (scheduled meetings), and call preparations (AI-generated research).

### Authentication and Authorization
The application features comprehensive authentication and integration management:

- **User Authentication**: Google Sign-in via Replit Auth integration using OIDC protocol
- **Session Management**: Secure session handling with PostgreSQL session store
- **User Management**: Automatic user profile creation and updates from OAuth claims
- **Route Protection**: Authenticated routes show home dashboard vs landing page for guests
- **Profile Integration**: User profiles include name, email, and profile images from Google

### Google Calendar Integration
Production-ready Google Calendar integration with enterprise-grade security:

- **OAuth Flow**: Complete Google OAuth 2.0 flow with Calendar and Gmail scopes
- **Token Security**: AES-256-GCM encryption for all OAuth tokens stored in database
- **Real-time Sync**: Fetches actual calendar events and displays them on the dashboard
- **Conditional UI**: Home page dynamically shows calendar data when connected or empty state when not
- **Settings Management**: Full integration lifecycle (connect, status checking, disconnect)
- **Error Handling**: Graceful handling of expired tokens with automatic re-authentication prompts
- **Security Compliance**: Encrypted token storage, secure refresh flows, and proper error handling

### Salesforce CRM Integration
Enterprise-grade Salesforce CRM integration for comprehensive sales data access:

- **OAuth Flow**: Complete Salesforce OAuth 2.0 flow with API and refresh token scopes
- **Connected App Security**: Configured with proper OAuth policies (client secret required, PKCE disabled for compatibility)
- **Token Security**: AES-256-GCM encryption for all Salesforce OAuth tokens stored in database
- **Multi-Environment Support**: Works with production, sandbox, and My Domain Salesforce instances
- **CRM Data Access**: Full API access for accounts, contacts, opportunities, and sales data
- **Settings Management**: Complete integration lifecycle (connect, status checking, disconnect)
- **Error Handling**: Robust handling of token expiration with automatic re-authentication flows
- **Security Compliance**: Enterprise security with encrypted credential storage and SSRF protection

### External Service Integrations
The platform integrates with external services for enhanced functionality:

- **Google Calendar Integration**: Live calendar event fetching, OAuth token management, and real-time sync
- **Salesforce CRM Integration**: Enterprise-grade CRM data access with full OAuth 2.0 security and encrypted token storage
- **OpenAI Integration**: GPT models for generating prospect research, competitive analysis, and conversation strategies
- **AI Research Generation**: Automated creation of executive summaries, CRM history analysis, competitive landscape mapping, and opportunity identification
- **Secure Token Management**: Enterprise-grade encryption for all third-party API credentials
- **Error Handling**: Robust error handling for external API failures with fallback strategies

The integration layer provides secure, encrypted storage of API credentials and implements proper token refresh flows with automatic re-authentication when needed.

## External Dependencies

### Core Technology Stack
- **Frontend Framework**: React 18 with TypeScript
- **Backend Framework**: Express.js with TypeScript
- **Database**: PostgreSQL (via Neon serverless)
- **ORM**: Drizzle ORM with Drizzle Kit for migrations

### AI and Data Processing
- **OpenAI API**: GPT models for AI-powered research generation
- **Zod**: Runtime type validation and schema definition
- **Date-fns**: Date manipulation and formatting utilities

### UI and Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI components for accessibility
- **Shadcn/ui**: Pre-built component library built on Radix UI
- **Lucide React**: Icon library for consistent iconography

### Development and Build Tools
- **Vite**: Fast build tool and development server
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Autoprefixer
- **TypeScript**: Type checking and enhanced developer experience

### State Management and Data Fetching
- **TanStack Query**: Server state management, caching, and synchronization
- **React Hook Form**: Form state management and validation
- **Wouter**: Lightweight client-side routing

### Development Environment
- **Replit Integration**: Development environment with live reloading and error overlays
- **Connect-pg-simple**: PostgreSQL session store for Express sessions
- **WebSocket Support**: Real-time capabilities through Neon's WebSocket constructor