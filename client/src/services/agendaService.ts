import { CONFIG } from "@/config";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  conference_url?: string;
  attendees: Array<{ name: string; email: string }>;
  notes?: string;
  linked_account_id?: string;
  linked_opportunity_id?: string;
}

export async function getMockAgenda(): Promise<CalendarEvent[]> {
  if (!CONFIG.DEMO_MODE && !CONFIG.USE_MOCKS) return [];
  
  // Return mock agenda data - in a real app this would come from mockDataService
  return [
    {
      id: "mock-event-1",
      title: "Discovery Call - DataFlow Systems",
      start: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      end: new Date(Date.now() + 86400000 + 3600000).toISOString(), // Tomorrow + 1 hour
      location: "Zoom",
      attendees: [
        { name: "Sarah Chen", email: "sarah.chen@dataflow.com" },
        { name: "Mike Rodriguez", email: "mike.r@dataflow.com" }
      ],
      notes: "Initial discovery call to understand their data pipeline needs"
    },
    {
      id: "mock-event-2", 
      title: "Follow-up - CloudScale",
      start: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
      end: new Date(Date.now() + 172800000 + 3600000).toISOString(),
      location: "Teams",
      attendees: [
        { name: "Alex Thompson", email: "alex@cloudscale.io" }
      ],
      notes: "Follow-up on pricing discussion"
    }
  ];
}

export async function getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  // Add demo header if in demo mode
  if (CONFIG.DEMO_MODE || CONFIG.USE_MOCKS) {
    headers['x-demo'] = '1';
  }
  
  const response = await fetch("/api/calendar/events", { 
    credentials: "include",
    headers
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch calendar events");
  }
  
  return response.json();
}

export async function loadAgenda(userId: string): Promise<CalendarEvent[]> {
  if (CONFIG.DEMO_MODE || CONFIG.USE_MOCKS) {
    return getMockAgenda();
  }
  
  try {
    return await getCalendarEvents(userId);
  } catch (error) {
    console.warn("Failed to load calendar events:", error);
    return [];
  }
}