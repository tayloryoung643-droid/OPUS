import { googleAuth } from './googleAuth';
import { storage } from '../storage';
import type { GoogleIntegration } from '@shared/schema';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  location?: string;
  organizer?: {
    email: string;
    displayName?: string;
  };
  htmlLink?: string;
}

export class GoogleCalendarService {
  // Get upcoming calendar events for a user
  async getUpcomingEvents(userId: string, maxResults = 10): Promise<CalendarEvent[]> {
    try {
      const googleIntegration = await storage.getGoogleIntegration(userId);
      if (!googleIntegration || !googleIntegration.isActive) {
        return [];
      }

      // Check if we need to refresh the token
      if (this.isTokenExpired(googleIntegration)) {
        await this.refreshTokenIfNeeded(userId, googleIntegration);
      }

      const calendar = googleAuth.createCalendarClient({
        access_token: googleIntegration.accessToken,
        refresh_token: googleIntegration.refreshToken
      });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = (response.data.items || [])
        .filter(event => !!event?.id);
      
      console.log('DEBUG getCalendarEvents - Total events found:', events.length);
      events.forEach((event, i) => {
        console.log(`DEBUG All Events ${i}:`, {
          id: event.id,
          summary: event.summary,
          startDateTime: event.start?.dateTime,
          startDate: event.start?.date,
          endDateTime: event.end?.dateTime,
          endDate: event.end?.date
        });
      });

      return events.map(event => this.mapGoogleEvent(event));

    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  // Get today's events for dashboard display
  async getTodaysEvents(userId: string): Promise<CalendarEvent[]> {
    try {
      const googleIntegration = await storage.getGoogleIntegration(userId);
      if (!googleIntegration || !googleIntegration.isActive) {
        return [];
      }

      // Check if we need to refresh the token
      if (this.isTokenExpired(googleIntegration)) {
        await this.refreshTokenIfNeeded(userId, googleIntegration);
      }

      const calendar = googleAuth.createCalendarClient({
        access_token: googleIntegration.accessToken,
        refresh_token: googleIntegration.refreshToken
      });

      const today = new Date();
      // Expand date range to account for all possible timezones (UTC-12 to UTC+14)
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12, 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 14, 0, 0, 0);

      console.log('DEBUG getTodaysEvents - Today:', today.toISOString());
      console.log('DEBUG getTodaysEvents - StartOfDay (timezone-aware):', startOfDay.toISOString());
      console.log('DEBUG getTodaysEvents - EndOfDay (timezone-aware):', endOfDay.toISOString());

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      console.log('DEBUG getTodaysEvents - Raw events found:', response.data.items?.length || 0);
      
      // Filter events to only include those that are actually "today"
      // Use Pacific Time (user's timezone) for comparison, not server UTC
      const pacificTime = new Date(today.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
      const todayString = pacificTime.getFullYear() + '-' + 
                         String(pacificTime.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(pacificTime.getDate()).padStart(2, '0');
      
      console.log('DEBUG - Local today date string:', todayString);
      
      const filteredEvents = (response.data.items || [])
        .filter(event => {
          if (!event?.id) return false;
          
          // Handle events with dateTime (specific times) 
          if (event.start?.dateTime) {
            // Extract date part from the original timestamp (preserves timezone)
            const eventDateString = event.start.dateTime.split('T')[0];
            console.log(`DEBUG - Event ${event.summary} dateTime: ${event.start.dateTime}, extracted date: ${eventDateString}`);
            return eventDateString === todayString;
          }
          
          // Handle all-day events with date only
          if (event.start?.date) {
            console.log(`DEBUG - Event ${event.summary} date: ${event.start.date}`);
            return event.start.date === todayString;
          }
          
          return false;
        });

      console.log('DEBUG getTodaysEvents - Events filtered for today:', filteredEvents.length);
      filteredEvents.forEach((event, i) => {
        console.log(`DEBUG Today Event ${i}:`, {
          id: event.id,
          summary: event.summary,
          startDateTime: event.start?.dateTime,
          startDate: event.start?.date,
          endDateTime: event.end?.dateTime,
          endDate: event.end?.date
        });
      });

      return filteredEvents.map(event => this.mapGoogleEvent(event));

    } catch (error) {
      console.error('Error fetching today\'s calendar events:', error);
      return [];
    }
  }

  async getEventById(userId: string, eventId: string): Promise<CalendarEvent | null> {
    try {
      const googleIntegration = await storage.getGoogleIntegration(userId);
      if (!googleIntegration || !googleIntegration.isActive) {
        return null;
      }

      if (this.isTokenExpired(googleIntegration)) {
        await this.refreshTokenIfNeeded(userId, googleIntegration);
      }

      const calendar = googleAuth.createCalendarClient({
        access_token: googleIntegration.accessToken,
        refresh_token: googleIntegration.refreshToken
      });

      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });

      const event = response.data;
      if (!event?.id) {
        return null;
      }

      return this.mapGoogleEvent(event);
    } catch (error) {
      console.error('Error fetching calendar event:', error);
      return null;
    }
  }

  private isTokenExpired(googleIntegration: GoogleIntegration): boolean {
    if (!googleIntegration.tokenExpiry) return false;
    
    const expiryTime = new Date(googleIntegration.tokenExpiry);
    const now = new Date();
    // Refresh if token expires within 5 minutes
    return expiryTime.getTime() - now.getTime() < 5 * 60 * 1000;
  }

  private async refreshTokenIfNeeded(userId: string, googleIntegration: GoogleIntegration): Promise<void> {
    if (!googleIntegration.refreshToken) {
      console.error('No refresh token available for user', userId);
      return;
    }

    try {
      const newTokens = await googleAuth.refreshTokens(googleIntegration.refreshToken);
      
      await storage.updateGoogleIntegration(userId, {
        accessToken: newTokens.access_token!,
        tokenExpiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : undefined,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error refreshing Google tokens:', error);
      // Optionally deactivate the integration if refresh fails
      await storage.updateGoogleIntegration(userId, {
        isActive: false,
        updatedAt: new Date()
      });
    }
  }

  private mapGoogleEvent(event: any): CalendarEvent {
    return {
      id: event.id!,
      summary: event.summary || 'No Title',
      description: event.description ?? undefined,
      start: {
        dateTime: event.start?.dateTime ?? undefined,
        date: event.start?.date ?? undefined
      },
      end: {
        dateTime: event.end?.dateTime ?? undefined,
        date: event.end?.date ?? undefined
      },
      attendees: event.attendees?.map((attendee: any) => ({
        email: attendee.email!,
        displayName: attendee.displayName ?? undefined,
        responseStatus: attendee.responseStatus ?? undefined
      })),
      location: event.location ?? undefined,
      organizer: event.organizer
        ? {
            email: event.organizer.email!,
            displayName: event.organizer.displayName ?? undefined,
          }
        : undefined,
      htmlLink: event.htmlLink ?? undefined,
    };
  }
}

export const googleCalendarService = new GoogleCalendarService();