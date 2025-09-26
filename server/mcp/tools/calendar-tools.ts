import {
  calendarMeetingContextSchema,
  calendarAttendeeHistorySchema,
  type CalendarEvent,
  type MCPToolContext
} from '../types/mcp-types.js';

/**
 * Google Calendar Meeting Context Tool
 * Gets details about upcoming or recent meetings from Google Calendar
 */
export async function calendarMeetingContext(
  args: unknown, 
  context: MCPToolContext
): Promise<{ events: CalendarEvent[]; total: number }> {
  try {
    const params = calendarMeetingContextSchema.parse(args);
    
    // Import the Google Calendar service dynamically
    const { googleCalendarService } = await import('../../services/googleCalendar.js');
    
    let events: any[] = [];
    
    if (params.eventId) {
      // Get specific event by ID
      const event = await googleCalendarService.getEventById(context.userId, params.eventId);
      if (event) {
        events = [event];
      }
    } else if (params.contactEmail) {
      // Search for events with specific attendee
      const allEvents = await googleCalendarService.getUpcomingEvents(context.userId, 50);
      events = allEvents.filter(event => {
        if (!event.attendees) return false;
        return event.attendees.some((attendee: any) => 
          attendee.email === params.contactEmail
        );
      });
    } else if (params.timeRange) {
      // Get events in specific time range
      const startTime = new Date(params.timeRange.start);
      const endTime = new Date(params.timeRange.end);
      
      // Use the time range to filter events
      const allEvents = await googleCalendarService.getUpcomingEvents(context.userId, 100);
      events = allEvents.filter(event => {
        if (!event.start?.dateTime) return false;
        const eventTime = new Date(event.start.dateTime);
        return eventTime >= startTime && eventTime <= endTime;
      });
    } else {
      // Default: get recent and upcoming events
      events = await googleCalendarService.getUpcomingEvents(context.userId, 10);
    }
    
    // Transform to standardized format
    const transformedEvents: CalendarEvent[] = events.map(event => ({
      id: event.id,
      summary: event.summary || 'No Title',
      start: event.start,
      end: event.end,
      attendees: params.includeAttendees ? event.attendees?.map((attendee: any) => ({
        email: attendee.email,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus
      })) : undefined,
      description: event.description,
      location: event.location
    }));
    
    console.log(`[MCP-Calendar] Found ${transformedEvents.length} events for ${params.eventId || params.contactEmail || 'time range'}`);
    
    return {
      events: transformedEvents,
      total: transformedEvents.length
    };
  } catch (error) {
    console.error('[MCP-Calendar] Meeting context error:', error);
    
    // Return graceful fallback
    return {
      events: [],
      total: 0
    };
  }
}

/**
 * Google Calendar Attendee History Tool
 * Finds previous meetings with specific attendees
 */
export async function calendarAttendeeHistory(
  args: unknown, 
  context: MCPToolContext
): Promise<{ events: CalendarEvent[]; attendeeEmail: string; lookbackDays: number }> {
  try {
    const params = calendarAttendeeHistorySchema.parse(args);
    
    // Import the Google Calendar service dynamically
    const { googleCalendarService } = await import('../../services/googleCalendar.js');
    
    // Calculate the date range for lookback
    const now = new Date();
    const lookbackDate = new Date(now.getTime() - (params.lookbackDays * 24 * 60 * 60 * 1000));
    
    // Get events from the lookback period (we'll need to implement a date range method)
    // For now, we'll get recent events and filter
    const allEvents = await googleCalendarService.getUpcomingEvents(context.userId, 200);
    
    // Filter for events with the specific attendee and within date range
    const matchingEvents = allEvents.filter(event => {
      // Check if event has the attendee
      const hasAttendee = event.attendees?.some((attendee: any) => 
        attendee.email === params.attendeeEmail
      );
      
      if (!hasAttendee) return false;
      
      // Check if event is within date range
      if (!event.start?.dateTime) return false;
      const eventDate = new Date(event.start.dateTime);
      return eventDate >= lookbackDate && eventDate <= now;
    }).slice(0, params.maxResults);
    
    // Transform to standardized format
    const transformedEvents: CalendarEvent[] = matchingEvents.map(event => ({
      id: event.id,
      summary: event.summary || 'No Title',
      start: event.start,
      end: event.end,
      attendees: event.attendees?.map((attendee: any) => ({
        email: attendee.email,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus
      })),
      description: event.description,
      location: event.location
    }));
    
    console.log(`[MCP-Calendar] Found ${transformedEvents.length} historical events with ${params.attendeeEmail} in last ${params.lookbackDays} days`);
    
    return {
      events: transformedEvents,
      attendeeEmail: params.attendeeEmail,
      lookbackDays: params.lookbackDays
    };
  } catch (error) {
    console.error('[MCP-Calendar] Attendee history error:', error);
    
    // Return graceful fallback
    return {
      events: [],
      attendeeEmail: typeof args === 'object' && args && 'attendeeEmail' in args ? String(args.attendeeEmail) : '',
      lookbackDays: 90
    };
  }
}