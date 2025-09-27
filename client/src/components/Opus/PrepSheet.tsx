import { useMemo } from "react";
import type { CalendarEvent } from "../../pages/OpusAgenda";
import PrepSheetView from "../PrepSheetView";

export default function OpusPrepSheet({ event }: { event: CalendarEvent | null }) {
  // Transform the CalendarEvent to match the expected interface for PrepSheetView
  const transformedEvent = useMemo(() => {
    if (!event) return null;

    return {
      id: event.id,
      title: event.title,
      scheduledAt: event.start,
      status: "upcoming" as const,
      callType: "discovery", // Default type
      stage: "prospecting", // Default stage
      source: "calendar" as const,
      calendarEventId: event.id,
      company: {
        id: `company-${event.id}`,
        name: event.company || "Unknown Company",
        domain: event.company ? `${event.company.toLowerCase().replace(/\s/g, '')}.com` : undefined,
        industry: undefined,
      },
    };
  }, [event]);

  // Empty state before selection
  if (!event) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-300/70">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Select an event to begin</div>
          <p className="text-sm">Choose a call from your agenda to generate prep materials and insights.</p>
        </div>
      </div>
    );
  }

  // Use the existing PrepSheetView component
  return (
    <div className="opus-prep-wrapper">
      <PrepSheetView event={transformedEvent} />
    </div>
  );
}