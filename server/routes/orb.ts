import { Router } from 'express';
import { verifyOrbTokenMiddleware } from '../middleware/verifyOrbToken.js';
import { googleCalendarService } from '../services/googleCalendar.js';
import { salesforceCrmService } from '../services/salesforceCrm.js';
import { storage } from '../storage.js';

const router = Router();

// Apply orb token verification to all routes in this router
router.use(verifyOrbTokenMiddleware);

/**
 * GET /orb/next-event?window=30m
 * Returns next calendar event within the specified time window
 */
router.get('/next-event', async (req, res) => {
  try {
    const userId = req.orbToken!.userId;
    const windowParam = req.query.window as string || '30m';
    
    // Parse time window (only support minutes for now: "30m", "60m", etc)
    const windowMatch = windowParam.match(/^(\d+)m$/);
    if (!windowMatch) {
      return res.status(400).json({ error: 'Invalid time window format. Use format like "30m"' });
    }
    
    const windowMinutes = parseInt(windowMatch[1]);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + (windowMinutes * 60 * 1000));
    
    console.log(`[Orb] Getting next event for user ${userId} within ${windowMinutes} minutes`);
    
    // Get upcoming calendar events
    const events = await googleCalendarService.getUpcomingEvents(userId, 10);
    
    // Find the next event that starts within the window
    const nextEvent = events.find(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date!);
      return eventStart >= now && eventStart <= windowEnd;
    });
    
    if (!nextEvent) {
      return res.json({ startsAtSoon: false });
    }
    
    // Format the response
    const eventStart = new Date(nextEvent.start.dateTime || nextEvent.start.date!);
    const participants = (nextEvent.attendees || []).map(a => a.email).filter(Boolean);
    
    // Generate quick notes from event details
    const quickNotes: string[] = [];
    if (nextEvent.summary) {
      quickNotes.push(`Meeting: ${nextEvent.summary}`);
    }
    if (nextEvent.location) {
      quickNotes.push(`Location: ${nextEvent.location}`);
    }
    if (participants.length > 0) {
      quickNotes.push(`Participants: ${participants.slice(0, 3).join(', ')}${participants.length > 3 ? '...' : ''}`);
    }
    if (nextEvent.description) {
      // Add first line of description as a note
      const firstLine = nextEvent.description.split('\n')[0].trim();
      if (firstLine && firstLine.length < 100) {
        quickNotes.push(`Notes: ${firstLine}`);
      }
    }
    
    const response = {
      startsAtSoon: true,
      startLocal: eventStart.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      title: nextEvent.summary || 'Untitled Meeting',
      participants,
      quickNotes
    };
    
    console.log('[Orb] Next event response:', response);
    res.json(response);
    
  } catch (error) {
    console.error('[Orb] Error getting next event:', error);
    res.status(500).json({ 
      error: 'Failed to get next event',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /orb/context?tabUrl=ENCODED_URL
 * Returns meeting context based on the current tab URL
 */
router.get('/context', async (req, res) => {
  try {
    const userId = req.orbToken!.userId;
    const tabUrl = req.query.tabUrl as string;
    
    if (!tabUrl) {
      return res.status(400).json({ error: 'tabUrl parameter is required' });
    }
    
    const decodedUrl = decodeURIComponent(tabUrl);
    console.log(`[Orb] Getting context for user ${userId}, URL: ${decodedUrl}`);
    
    // Extract meeting info from URL patterns
    let meetingId: string | null = null;
    let vendor: string | null = null;
    
    if (decodedUrl.includes('meet.google.com/')) {
      vendor = 'google_meet';
      const match = decodedUrl.match(/meet\.google\.com\/([a-z-]+)/);
      meetingId = match ? match[1] : null;
    } else if (decodedUrl.includes('.zoom.us/j/')) {
      vendor = 'zoom';
      const match = decodedUrl.match(/zoom\.us\/j\/(\d+)/);
      meetingId = match ? match[1] : null;
    } else if (decodedUrl.includes('teams.microsoft.com/')) {
      vendor = 'teams';
      // Teams URLs are more complex, extract what we can
      meetingId = 'teams-meeting';
    }
    
    // Try to find matching calendar event
    const events = await googleCalendarService.getUpcomingEvents(userId, 10);
    const now = new Date();
    
    // Look for an event happening now or very soon (within 10 minutes)
    const currentEvent = events.find(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date!);
      const eventEnd = event.end ? new Date(event.end.dateTime || event.end.date!) : new Date(eventStart.getTime() + 60 * 60 * 1000); // Default 1 hour
      const tenMinutesBefore = new Date(eventStart.getTime() - 10 * 60 * 1000);
      
      return now >= tenMinutesBefore && now <= eventEnd;
    });
    
    let context: any = {
      title: 'Live Meeting',
      participants: [],
      account: null,
      oppAmount: null,
      stage: null,
      keyPoints: []
    };
    
    if (currentEvent) {
      context.title = currentEvent.summary || 'Live Meeting';
      context.participants = (currentEvent.attendees || []).map(a => a.email).filter(Boolean);
      
      // Extract account/company name from meeting title or participants
      const title = currentEvent.summary || '';
      const accountMatch = title.match(/^([^—-]+)(?:\s*[—-]\s*)?/);
      if (accountMatch && accountMatch[1].trim().length > 0) {
        context.account = accountMatch[1].trim();
      }
      
      // Try to get CRM context if we have Salesforce integration
      try {
        const salesforceIntegration = await storage.getSalesforceIntegration(userId);
        if (salesforceIntegration?.isActive) {
          // Search for opportunities related to this account/meeting
          const opportunities = await salesforceCrmService.getOpportunities(userId);
          
          if (context.account && opportunities.length > 0) {
            const relatedOpp = opportunities.find(opp => 
              opp.Account?.Name?.toLowerCase().includes(context.account.toLowerCase()) ||
              context.account.toLowerCase().includes(opp.Account?.Name?.toLowerCase() || '')
            );
            
            if (relatedOpp) {
              context.oppAmount = relatedOpp.Amount;
              context.stage = relatedOpp.StageName;
              
              // Generate key points from opportunity data
              context.keyPoints = [];
              if (relatedOpp.StageName) {
                context.keyPoints.push(`Stage: ${relatedOpp.StageName}`);
              }
              if (relatedOpp.Amount) {
                context.keyPoints.push(`Amount: $${relatedOpp.Amount.toLocaleString()}`);
              }
              if (relatedOpp.CloseDate) {
                const closeDate = new Date(relatedOpp.CloseDate);
                context.keyPoints.push(`Close Date: ${closeDate.toLocaleDateString()}`);
              }
              if (relatedOpp.NextStep) {
                context.keyPoints.push(`Next Step: ${relatedOpp.NextStep}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('[Orb] Error getting Salesforce context:', error);
        // Continue without CRM context
      }
      
      // Add general meeting context
      if (context.keyPoints.length === 0) {
        if (context.participants.length > 0) {
          context.keyPoints.push(`${context.participants.length} participant${context.participants.length > 1 ? 's' : ''}`);
        }
        if (currentEvent.location) {
          context.keyPoints.push(`Location: ${currentEvent.location}`);
        }
        context.keyPoints.push('Live meeting in progress');
      }
    } else {
      // No matching calendar event, provide generic context
      context.keyPoints = [
        'Live meeting detected',
        'No calendar context available',
        'Tap me if you need help'
      ];
    }
    
    console.log('[Orb] Context response:', context);
    res.json(context);
    
  } catch (error) {
    console.error('[Orb] Error getting context:', error);
    res.status(500).json({ 
      error: 'Failed to get meeting context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;