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
  const startTime = Date.now();
  console.log('[MCP-Calendar] calendarMeetingContext called with args:', JSON.stringify(args));
  
  try {
    const params = calendarMeetingContextSchema.parse(args);
    console.log('[MCP-Calendar] Parsed params:', params);
    
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
      // Get events in specific time range using the dedicated range method
      // This properly handles past events (e.g., morning meetings when asked at 3pm)
      console.log('[MCP-Calendar] Time range query:', {
        start: params.timeRange.start,
        end: params.timeRange.end
      });
      
      // Use the new getEventsInRange method that fetches directly from Google Calendar API
      // without filtering by "now", so it includes past events in the range
      events = await googleCalendarService.getEventsInRange(
        context.userId,
        params.timeRange.start,
        params.timeRange.end
      );
      
      console.log('[MCP-Calendar] getEventsInRange found', events.length, 'events');
    } else {
      // Default: get more events and filter intelligently
      // Fetch 200 events to account for recurring birthdays
      const allEvents = await googleCalendarService.getUpcomingEvents(context.userId, 200);
      
      // Filter to only include events with actual times (exclude all-day birthdays)
      // and events happening within the next 24 hours
      const now = new Date();
      const next24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000));
      
      events = allEvents.filter(event => {
        // Normalize event start: use dateTime or convert all-day date to midnight UTC
        const eventStartStr = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00Z` : null);
        if (!eventStartStr) return false;
        
        // Exclude all-day events (birthdays, holidays) - they only have .date, not .dateTime
        if (!event.start?.dateTime) return false;
        
        const eventTime = new Date(eventStartStr);
        
        // Include events in the next 24 hours
        return eventTime <= next24Hours;
      });
      
      // Limit to 10 most relevant events
      events = events.slice(0, 10);
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
    
    const duration = Date.now() - startTime;
    console.log(`[MCP-Calendar] ✅ SUCCESS: Found ${transformedEvents.length} events in ${duration}ms`);
    
    return {
      events: transformedEvents,
      total: transformedEvents.length
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[MCP-Calendar] ❌ ERROR after ${duration}ms:`, error);
    console.error('[MCP-Calendar] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: context.userId,
      args
    });
    
    // THROW the error instead of returning empty array
    throw new Error(`Calendar meeting context failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  const startTime = Date.now();
  console.log('[MCP-Calendar] calendarAttendeeHistory called with args:', JSON.stringify(args));
  
  try {
    const params = calendarAttendeeHistorySchema.parse(args);
    console.log('[MCP-Calendar] Parsed params:', params);
    
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
      // Normalize event start: use dateTime or convert all-day date to midnight UTC
      const eventStartStr = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00Z` : null);
      if (!eventStartStr) return false;
      
      const eventDate = new Date(eventStartStr);
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
    
    const duration = Date.now() - startTime;
    console.log(`[MCP-Calendar] ✅ SUCCESS: Found ${transformedEvents.length} historical events in ${duration}ms`);
    
    return {
      events: transformedEvents,
      attendeeEmail: params.attendeeEmail,
      lookbackDays: params.lookbackDays
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[MCP-Calendar] ❌ ERROR after ${duration}ms:`, error);
    console.error('[MCP-Calendar] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: context.userId,
      args
    });
    
    // THROW the error instead of returning empty array
    throw new Error(`Calendar attendee history failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}