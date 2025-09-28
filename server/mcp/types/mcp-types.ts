import { z } from 'zod';

// MCP Tool Schemas for OpenAI function calling

// Salesforce tool schemas
export const salesforceContactLookupSchema = z.object({
  email: z.string().email().optional(),
  company: z.string().optional(),
  fields: z.array(z.string()).optional().default([
    'Id', 'Name', 'Email', 'Phone', 'Title', 'AccountId', 'Account.Name'
  ])
});

export const salesforceOpportunityLookupSchema = z.object({
  opportunityId: z.string().optional(),
  contactId: z.string().optional(),
  accountId: z.string().optional(),
  fields: z.array(z.string()).optional().default([
    'Id', 'Name', 'StageName', 'Amount', 'CloseDate', 'AccountId', 'Account.Name'
  ])
});

export const salesforceAccountLookupSchema = z.object({
  accountId: z.string().optional(),
  name: z.string().optional(),
  domain: z.string().optional(),
  fields: z.array(z.string()).optional().default([
    'Id', 'Name', 'Industry', 'NumberOfEmployees', 'AnnualRevenue', 'Website', 'Description'
  ])
});

// Google Calendar tool schemas
export const calendarMeetingContextSchema = z.object({
  eventId: z.string().optional(),
  contactEmail: z.string().email().optional(),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional(),
  includeAttendees: z.boolean().default(true)
}).refine(data => data.eventId || data.contactEmail || data.timeRange, {
  message: "At least one search criteria must be provided"
});

export const calendarAttendeeHistorySchema = z.object({
  attendeeEmail: z.string().email(),
  lookbackDays: z.number().min(1).max(365).default(90),
  maxResults: z.number().min(1).max(50).default(10)
});

// Database tool schemas
export const prepNotesSearchSchema = z.object({
  query: z.string().min(1),
  userId: z.string().optional(),
  limit: z.number().min(1).max(50).default(10)
});

export const callHistoryLookupSchema = z.object({
  contactEmail: z.string().email().optional(),
  companyName: z.string().optional(),
  companyDomain: z.string().optional(),
  lookbackDays: z.number().min(1).max(365).default(180),
  maxResults: z.number().min(1).max(20).default(10)
}).refine(data => data.contactEmail || data.companyName || data.companyDomain, {
  message: "At least one search criteria must be provided"
});

// Gmail tool schemas
export const gmailSearchThreadsSchema = z.object({
  q: z.string().optional().default("newer_than:7d")
});

export const gmailReadThreadSchema = z.object({
  threadId: z.string()
});

// Tool result types
export interface SalesforceContact {
  Id: string;
  Name: string;
  Email?: string;
  Phone?: string;
  Title?: string;
  AccountId?: string;
  AccountName?: string;
}

export interface SalesforceOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount?: number;
  CloseDate?: string;
  AccountId?: string;
  AccountName?: string;
}

export interface SalesforceAccount {
  Id: string;
  Name: string;
  Industry?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  Website?: string;
  Description?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  description?: string;
  location?: string;
}

export interface CallHistory {
  id: string;
  title: string;
  scheduledAt: Date;
  status: string;
  companyName?: string;
  contactEmails: string[];
  callPrep?: {
    executiveSummary?: string;
    conversationStrategy?: string;
  };
  notes?: string;
}

export interface PrepNote {
  id: string;
  userId: string;
  eventId: string;
  text: string;
  updatedAt: Date;
}

export interface GmailThread {
  id: string;
  historyId?: string;
}

export interface GmailMessage {
  id: string;
  date?: string;
  from?: string;
  to?: string;
  subject?: string;
  snippet: string;
  body: string;
}

// Tool execution context
export interface MCPToolContext {
  userId: string;
  storage: any; // Storage interface
  googleCalendarService?: any;
  salesforceCrmService?: any;
  user?: any; // User object with claims
}

// Tool definitions for OpenAI function calling
export const MCP_TOOL_DEFINITIONS = {
  salesforce_contact_lookup: {
    name: "salesforce_contact_lookup",
    description: "Look up contact details from Salesforce CRM. Can search by email, company name, or call without parameters to get recent contacts. Returns contact information including name, title, phone, and account details.",
    parameters: {
      type: "object",
      properties: {
        email: { 
          type: "string", 
          format: "email",
          description: "Contact email address to search for" 
        },
        company: { 
          type: "string", 
          description: "Company name to search contacts for" 
        },
        fields: { 
          type: "array", 
          items: { type: "string" },
          description: "Specific Salesforce fields to retrieve",
          default: ["Id", "Name", "Email", "Phone", "Title", "AccountId", "Account.Name"]
        }
      }
    }
  },
  
  salesforce_opportunity_lookup: {
    name: "salesforce_opportunity_lookup",
    description: "Get opportunity details from Salesforce. Can search by specific ID, contact, account, OR call without parameters to get ALL opportunities in the sales pipeline. Perfect for 'show me my pipeline' queries. Returns opportunity information including stage, amount, close date, and account details.",
    parameters: {
      type: "object",
      properties: {
        opportunityId: { 
          type: "string", 
          description: "Salesforce opportunity ID" 
        },
        contactId: { 
          type: "string", 
          description: "Salesforce contact ID to find related opportunities" 
        },
        accountId: { 
          type: "string", 
          description: "Salesforce account ID to find opportunities" 
        },
        fields: { 
          type: "array", 
          items: { type: "string" },
          description: "Specific Salesforce fields to retrieve",
          default: ["Id", "Name", "StageName", "Amount", "CloseDate", "AccountId", "Account.Name"]
        }
      }
    }
  },
  
  salesforce_account_lookup: {
    name: "salesforce_account_lookup",
    description: "Retrieve account information from Salesforce. Can search by ID, name, domain, or call without parameters to get recent accounts. Returns account details including industry, size, revenue, and description.",
    parameters: {
      type: "object",
      properties: {
        accountId: { 
          type: "string", 
          description: "Salesforce account ID" 
        },
        name: { 
          type: "string", 
          description: "Company/Account name to search for" 
        },
        domain: { 
          type: "string", 
          description: "Company domain (e.g., example.com)" 
        },
        fields: { 
          type: "array", 
          items: { type: "string" },
          description: "Specific Salesforce fields to retrieve",
          default: ["Id", "Name", "Industry", "NumberOfEmployees", "AnnualRevenue", "Website", "Description"]
        }
      }
    }
  },
  
  calendar_meeting_context: {
    name: "calendar_meeting_context",
    description: "Get details about upcoming or recent meetings from Google Calendar. Provide event ID, contact email, or time range. Includes meeting information, attendees, and context for call preparation.",
    parameters: {
      type: "object",
      properties: {
        eventId: { 
          type: "string", 
          description: "Specific Google Calendar event ID" 
        },
        contactEmail: { 
          type: "string", 
          format: "email",
          description: "Email of meeting attendee to find related meetings" 
        },
        timeRange: {
          type: "object",
          properties: {
            start: { type: "string", format: "date-time" },
            end: { type: "string", format: "date-time" }
          },
          description: "Time range to search for meetings"
        },
        includeAttendees: { 
          type: "boolean", 
          default: true,
          description: "Whether to include attendee information" 
        }
      }
    }
  },
  
  calendar_attendee_history: {
    name: "calendar_attendee_history",
    description: "Find previous meetings with specific attendees from Google Calendar. Useful for understanding meeting history and relationship context.",
    parameters: {
      type: "object",
      properties: {
        attendeeEmail: { 
          type: "string", 
          format: "email",
          description: "Email address of the attendee to search meeting history for" 
        },
        lookbackDays: { 
          type: "number", 
          minimum: 1, 
          maximum: 365, 
          default: 90,
          description: "Number of days to look back for meeting history" 
        },
        maxResults: { 
          type: "number", 
          minimum: 1, 
          maximum: 50, 
          default: 10,
          description: "Maximum number of meetings to return" 
        }
      },
      required: ["attendeeEmail"]
    }
  },
  
  prep_notes_search: {
    name: "prep_notes_search",
    description: "Search previous call preparation notes from the database. Helps find insights and context from past call preparations.",
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          minLength: 1,
          description: "Search query to find relevant preparation notes" 
        },
        userId: { 
          type: "string", 
          description: "User ID to limit search to specific user's notes" 
        },
        limit: { 
          type: "number", 
          minimum: 1, 
          maximum: 50, 
          default: 10,
          description: "Maximum number of notes to return" 
        }
      },
      required: ["query"]
    }
  },
  
  call_history_lookup: {
    name: "call_history_lookup",
    description: "Get historical call data for contacts or companies from the database. Provide contact email, company name, or company domain. Provides context on past interactions and call outcomes.",
    parameters: {
      type: "object",
      properties: {
        contactEmail: { 
          type: "string", 
          format: "email",
          description: "Email address of contact to find call history for" 
        },
        companyName: { 
          type: "string", 
          description: "Company name to find related calls" 
        },
        companyDomain: { 
          type: "string", 
          description: "Company domain to find related calls" 
        },
        lookbackDays: { 
          type: "number", 
          minimum: 1, 
          maximum: 365, 
          default: 180,
          description: "Number of days to look back for call history" 
        },
        maxResults: { 
          type: "number", 
          minimum: 1, 
          maximum: 20, 
          default: 10,
          description: "Maximum number of calls to return" 
        }
      }
    }
  },

  gmail_search_threads: {
    name: "gmail_search_threads",
    description: "Search recent Gmail threads with a Gmail query (e.g., 'from:prospect@acme.com newer_than:14d'). Returns thread IDs that can be read with gmail_read_thread.",
    parameters: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description: "Gmail search query. Examples: 'from:prospect@acme.com', 'newer_than:14d', 'subject:proposal'",
          default: "newer_than:7d"
        }
      }
    }
  },

  gmail_read_thread: {
    name: "gmail_read_thread",
    description: "Read a Gmail thread by ID and return normalized headers and text bodies. Use after gmail_search_threads to get specific thread content.",
    parameters: {
      type: "object",
      properties: {
        threadId: {
          type: "string",
          description: "Gmail thread ID obtained from gmail_search_threads"
        }
      },
      required: ["threadId"]
    }
  }
} as const;

export type MCPToolName = keyof typeof MCP_TOOL_DEFINITIONS;