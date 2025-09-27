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

      return (response.data.items || [])
        .filter(event => !!event?.id)
        .map(event => this.mapGoogleEvent(event));

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
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.data.items || [])
        .filter(event => !!event?.id)
        .map(event => this.mapGoogleEvent(event));

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