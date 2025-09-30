import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { safeTimeFormat } from "@/utils/date";

// Helper to detect all-day events
const isAllDayEvent = (start: any) => {
  // All-day events have only date, no dateTime
  if (typeof start === 'object' && start !== null) {
    return start.date && !start.dateTime;
  }
  // Check if string is date-only format (YYYY-MM-DD)
  if (typeof start === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(start);
  }
  return false;
};
import type { CalendarEvent } from "../../pages/OpusAgenda";

type Props = { onSelect: (e: CalendarEvent, prepData?: any) => void };

export default function OpusAgendaList({ onSelect }: Props) {
  const { toast } = useToast();

  // Mutation for generating prep sheet
  const generatePrepMutation = useMutation({
    mutationFn: async (event: CalendarEvent) => {
      const response = await apiRequest('POST', '/api/prep-sheet/generate', {
        source: 'google-calendar',
        event: {
          id: event.id,
          iCalUID: event.id, // Using id as fallback for iCalUID
          title: event.title,
          description: event.notes || '',
          start: event.start,
          end: event.end,
          attendees: (event.attendees || []).map(attendee => ({ 
            email: typeof attendee === 'string' ? attendee : attendee, 
            name: '' 
          }))
        }
      });
      return response.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Prep Generation Failed",
        description: `Could not generate prep sheet: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleEventClick = async (event: CalendarEvent) => {
    try {
      // Always call onSelect to show the event in prep sheet immediately
      onSelect(event);
      
      // Generate prep data in the background
      const prepResult = await generatePrepMutation.mutateAsync(event);
      
      // Update with generated prep data
      onSelect(event, prepResult.prep);
      
      toast({
        title: "Prep Sheet Generated",
        description: "Call preparation materials are ready!",
      });
    } catch (error) {
      // onSelect was already called above to show basic event info
      console.error('Prep generation failed:', error);
    }
  };
  // Query for today's calendar events using the correct API endpoint
  const { data: events, isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/today"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/calendar/today");
        if (!response.ok) throw new Error("Calendar fetch failed");
        
        const data = await response.json();
        // Transform the response to match our CalendarEvent interface
        return data.map((event: any) => {
          // Handle nested start/end time structure - properly extract the actual time string
          const startTime = event.start?.dateTime || event.start?.date || null;
          const endTime = event.end?.dateTime || event.end?.date || null;
          
          return {
            id: event.id,
            title: event.title || event.summary || 'Untitled Event',
            company: event.company || extractCompanyFromTitle(event.title || event.summary || ''),
            start: startTime,  // Now this is properly a string or null, not an object
            end: endTime,      // Same here
            attendees: event.attendees || [],
            location: event.location,
            notes: event.notes || event.description,
            // Keep the original start object for all-day detection
            startObj: event.start,
          };
        });
      } catch (error) {
        console.error('Failed to fetch calendar events:', error);
        // Return empty array instead of mock data - no sample information
        return [];
      }
    },
    staleTime: 300_000, // 5 minutes
  });

  const extractCompanyFromTitle = (title: string) => {
    // Simple extraction logic - company name is usually before " — " or " - "
    const match = title.match(/^([^—-]+)(?:\s*[—-]\s*)?/);
    return match ? match[1].trim() : undefined;
  };

  return (
    <div className="rounded-2xl bg-white/5 hover:bg-white/8 transition p-4">
      <h2 className="mb-3 text-lg font-semibold text-opus-cyan">Today's Agenda</h2>
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
        {isLoading ? (
          <>
            <div className="h-16 animate-pulse rounded-xl bg-white/5" />
            <div className="h-16 animate-pulse rounded-xl bg-white/5" />
            <div className="h-16 animate-pulse rounded-xl bg-white/5" />
          </>
        ) : (
          (events || []).map(ev => (
            <button
              key={ev.id}
              onClick={() => handleEventClick(ev)}
              disabled={generatePrepMutation.isPending}
              className="w-full rounded-xl bg-white/5 hover:bg-white/10 transition p-3 text-left disabled:opacity-50"
              data-testid={`agenda-event-${ev.id}`}
            >
              <div className="text-sm opacity-80">
                {isAllDayEvent(ev.startObj || ev.start) ? "All Day" : (ev.start ? safeTimeFormat(ev.start) : "Time TBD")}
              </div>
              <div className="text-base font-semibold">{ev.title}</div>
              {ev.company && <div className="text-sm opacity-70">{ev.company}</div>}
            </button>
          ))
        )}
        {!isLoading && (!events || events.length === 0) && (
          <div className="text-center py-8 text-slate-400">
            No events scheduled for today
          </div>
        )}
      </div>
    </div>
  );
}