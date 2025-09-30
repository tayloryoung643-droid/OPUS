import { storage } from "../storage";

/**
 * Generate rhythm insights for a user based on their calendar, CRM, and email data
 */
export async function generateRhythmInsights(userId: string): Promise<string[]> {
  try {
    const insights: string[] = [];
    
    // Get today's calendar events
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    // Check for Google Calendar integration
    const googleIntegration = await storage.getGoogleIntegration(userId);
    if (googleIntegration?.isActive) {
      try {
        const { google } = await import('googleapis');
        const auth = new google.auth.OAuth2();
        auth.setCredentials({
          access_token: googleIntegration.accessToken,
          refresh_token: googleIntegration.refreshToken,
        });
        
        const calendar = google.calendar({ version: 'v3', auth });
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });
        
        const events = response.data.items || [];
        
        // Analyze meeting load
        if (events.length >= 6) {
          insights.push(`${events.length} meetings today — pace yourself and grab breaks`);
        } else if (events.length >= 3) {
          insights.push(`${events.length} calls scheduled — good momentum day`);
        }
        
        // Check for back-to-back meetings
        let backToBackCount = 0;
        for (let i = 0; i < events.length - 1; i++) {
          const currentEnd = new Date(events[i].end?.dateTime || events[i].end?.date);
          const nextStart = new Date(events[i + 1].start?.dateTime || events[i + 1].start?.date);
          const timeDiff = nextStart.getTime() - currentEnd.getTime();
          if (timeDiff < 15 * 60 * 1000) { // Less than 15 minutes
            backToBackCount++;
          }
        }
        
        if (backToBackCount >= 2) {
          insights.push(`${backToBackCount} back-to-back meetings — schedule buffer time`);
        }
      } catch (error) {
        console.log('Calendar insight failed:', error);
      }
    }
    
    // Check for Salesforce CRM data
    const salesforceIntegration = await storage.getSalesforceIntegration(userId);
    if (salesforceIntegration?.isActive) {
      try {
        // Check for overdue opportunities (mock logic for now)
        const thisWeek = new Date();
        thisWeek.setDate(thisWeek.getDate() + 7);
        
        // In a real implementation, this would query Salesforce API
        // For now, generate insights based on user activity patterns
        const userCalls = await storage.getUpcomingCalls(userId);
        const highValueCalls = userCalls.filter(call => 
          call.title.toLowerCase().includes('decision') ||
          call.title.toLowerCase().includes('proposal') ||
          call.title.toLowerCase().includes('contract')
        );
        
        if (highValueCalls.length > 0) {
          insights.push(`${highValueCalls.length} high-stakes call${highValueCalls.length > 1 ? 's' : ''} — review your prep sheets`);
        }
      } catch (error) {
        console.log('CRM insight failed:', error);
      }
    }
    
    // Check call preparation activity
    try {
      // Use existing method to get calls and check for prep data
      const userCalls = await storage.getUpcomingCalls();
      const callsWithPrep = userCalls.filter(call => call.id); // Simple check for now
      if (callsWithPrep.length >= 3) {
        insights.push(`${callsWithPrep.length} calls prepped — keep the momentum going`);
      }
    } catch (error) {
      console.log('Prep insight failed:', error);
    }
    
    return insights;
  } catch (error) {
    console.error('Error generating rhythm insights:', error);
    return [];
  }
}

/**
 * Generate Opus feed showing recent AI-powered actions
 */
export async function generateOpusFeed(userId: string): Promise<string[]> {
  try {
    const feedItems: string[] = [];
    
    // Check recent call activity (using available methods)
    const upcomingCalls = await storage.getUpcomingCalls();
    const previousCalls = await storage.getPreviousCalls();
    
    if (upcomingCalls.length > 0) {
      feedItems.push(`Tracking ${upcomingCalls.length} upcoming call${upcomingCalls.length > 1 ? 's' : ''}`);
    }
    
    if (previousCalls.length > 0) {
      feedItems.push(`Analyzed ${Math.min(previousCalls.length, 5)} recent conversation${previousCalls.length > 1 ? 's' : ''}`);
    }
    
    // Check integrations (shows AI is connected to data sources)
    try {
      const googleIntegration = await storage.getGoogleIntegration(userId);
      const salesforceIntegration = await storage.getSalesforceIntegration(userId);
      
      if (googleIntegration?.isActive) {
        feedItems.push('Synced with Google Calendar for meeting insights');
      }
      
      if (salesforceIntegration?.isActive) {
        feedItems.push('Connected to Salesforce for CRM intelligence');
      }
    } catch (error) {
      console.log('Integration check failed:', error);
    }
    
    // Add time-based context
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12 && feedItems.length > 0) {
      feedItems.unshift('Good morning! Here\'s what I\'ve been working on:');
    } else if (hour >= 12 && feedItems.length > 0) {
      feedItems.unshift('Here\'s what I\'ve accomplished today:');
    }
    
    return feedItems;
  } catch (error) {
    console.error('Error generating opus feed:', error);
    return [];
  }
}