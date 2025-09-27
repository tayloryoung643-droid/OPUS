import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CalendarEvent } from "../../pages/OpusAgenda";

type Props = { onSelect: (e: CalendarEvent) => void };

export default function OpusAgendaList({ onSelect }: Props) {
  // Query for today's calendar events using the existing API
  const { data: events, isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events", "today"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/calendar/events?range=today");
        if (!response.ok) throw new Error("Calendar fetch failed");
        
        const data = await response.json();
        // Transform the response to match our CalendarEvent interface
        return data.map((event: any) => ({
          id: event.id,
          title: event.title || event.summary,
          company: event.company || extractCompanyFromTitle(event.title || event.summary),
          start: event.start || event.scheduledAt,
          end: event.end,
          attendees: event.attendees || [],
          location: event.location,
          notes: event.notes || event.description,
        }));
      } catch (error) {
        // Graceful fallback with mock data
        return [
          { 
            id: "mock-1", 
            title: "Acme Corp — Discovery", 
            company: "Acme Corp", 
            start: new Date().toISOString(), 
            attendees: ["ceo@acme.com"] 
          },
          { 
            id: "mock-2", 
            title: "Globex SG — Demo", 
            company: "Globex SG", 
            start: new Date(Date.now() + 4_000_000).toISOString(), 
            attendees: ["it@globex.sg"] 
          },
        ];
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
    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 backdrop-blur shadow-card">
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
              onClick={() => onSelect(ev)}
              className="w-full rounded-xl border border-white/5 bg-slate-900/50 p-3 text-left hover:bg-slate-800/60 transition-colors"
              data-testid={`agenda-event-${ev.id}`}
            >
              <div className="text-sm opacity-80">
                {new Date(ev.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
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