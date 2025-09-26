// Export all MCP tools
import { 
  salesforceContactLookup, 
  salesforceOpportunityLookup, 
  salesforceAccountLookup 
} from './salesforce-tools.js';

import { 
  calendarMeetingContext, 
  calendarAttendeeHistory 
} from './calendar-tools.js';

import { 
  prepNotesSearch, 
  callHistoryLookup 
} from './database-tools.js';

export {
  salesforceContactLookup, 
  salesforceOpportunityLookup, 
  salesforceAccountLookup,
  calendarMeetingContext, 
  calendarAttendeeHistory,
  prepNotesSearch, 
  callHistoryLookup
};

// Tool execution mapping
export const MCP_TOOL_HANDLERS = {
  salesforce_contact_lookup: salesforceContactLookup,
  salesforce_opportunity_lookup: salesforceOpportunityLookup,
  salesforce_account_lookup: salesforceAccountLookup,
  calendar_meeting_context: calendarMeetingContext,
  calendar_attendee_history: calendarAttendeeHistory,
  prep_notes_search: prepNotesSearch,
  call_history_lookup: callHistoryLookup
} as const;