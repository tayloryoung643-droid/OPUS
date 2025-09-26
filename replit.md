# Momentum AI - Sales Call Preparation Platform

## Overview

Momentum AI is a comprehensive sales call preparation platform that helps sales teams research prospects, analyze conversations, and prepare personalized strategies using AI. The application streamlines the sales process by automatically generating executive summaries, competitive analysis, stakeholder insights, and conversation strategies, reducing preparation time from hours to minutes.

The platform is built as a full-stack web application with a React frontend and Express.js backend, utilizing PostgreSQL for data persistence and OpenAI for AI-powered research generation.

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