import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import OpusTopNav from "../components/Opus/TopNav";
import OpusHeroGreeting from "../components/Opus/HeroGreeting";
import OpusAgendaList from "../components/Opus/AgendaList";
import OpusPrepSheet from "../components/Opus/PrepSheet";
import OpusInsights from "../components/Opus/Insights";
import OpusRhythm from "../components/Opus/Rhythm";
import CalendarView from "../components/CalendarView";
import PrepSheetView from "../components/PrepSheetView";

export type CalendarEvent = {
  id: string;
  title: string;
  company?: string;
  start: string; // ISO
  end?: string;
  attendees?: string[];
  location?: string;
  notes?: string;
};

interface CallWithCompany {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  callType?: string;
  stage?: string;
  source?: "database" | "calendar";
  calendarEventId?: string;
  company: {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
  };
}

export default function OpusAgenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"GREETING" | "AGENDA">("GREETING");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallWithCompany | null>(null);

  // Fetch upcoming calls to auto-select the first one when Agenda tab is active
  const { data: upcomingCalls = [] } = useQuery<CallWithCompany[]>({
    queryKey: ["/api/calls/upcoming"],
    enabled: viewMode === "AGENDA"
  });

  // Fetch Google Calendar events
  const { data: calendarEvents } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events"],
    enabled: viewMode === "AGENDA",
    retry: false
  });

  // Ensure call mutation for calendar events
  const ensureCalendarCallMutation = useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      const response = await fetch(`/api/calendar/events/${eventId}/ensure-call`, {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Failed to ensure call");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedCall(data.call);
    },
    onError: (error) => {
      console.error("Failed to ensure call:", error);
      toast({
        title: "Error",
        description: "Failed to prepare call. Please try selecting again.",
        variant: "destructive",
      });
    }
  });

  const onAgendaTabClick = () => {
    setViewMode("AGENDA");
  };

  const onSelectEvent = (ev: CalendarEvent, prepData?: any) => {
    setViewMode("AGENDA");
    setSelectedEvent(ev);
    // TODO: Use prepData to enhance the prep sheet when available
  };

  // Handle call selection from CalendarView
  const handleSelectCall = async (call: CallWithCompany) => {
    if (call.source === "calendar" && call.calendarEventId) {
      // For calendar events, ensure a database call exists
      ensureCalendarCallMutation.mutate({ eventId: call.calendarEventId });
    } else {
      // For database calls, select directly
      setSelectedCall(call);
    }
  };

  // Auto-select first upcoming call when entering Agenda mode
  useEffect(() => {
    if (viewMode === "AGENDA" && !selectedCall && upcomingCalls.length > 0) {
      setSelectedCall(upcomingCalls[0]);
    }
  }, [viewMode, selectedCall, upcomingCalls]);

  const firstName = useMemo(() => {
    return (user as any)?.claims?.first_name || (user as any)?.firstName || "Taylor";
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-indigo-900/80 to-violet-900/60 text-white antialiased">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <OpusTopNav active="Agenda" onAgendaClick={onAgendaTabClick} />

        {/* Greeting hides once Agenda is clicked */}
        {viewMode === "GREETING" && (
          <OpusHeroGreeting firstName={firstName} />
        )}

        {/* Agenda Mode: Calendar + Prep Sheet Layout */}
        {viewMode === "AGENDA" && (
          <div className="flex gap-6 h-[calc(100vh-200px)]">
            {/* Left Sidebar: Calendar View */}
            <div className="w-80 flex-shrink-0">
              <div className="rounded-2xl bg-white/5 p-4 h-full overflow-hidden">
                <CalendarView onSelectEvent={handleSelectCall} />
              </div>
            </div>

            {/* Main Content: Prep Sheet */}
            <div className="flex-1">
              <div className="rounded-2xl bg-white/5 p-6 h-full overflow-auto">
                {selectedCall ? (
                  <PrepSheetView event={selectedCall} />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300/70">
                    <div className="text-center">
                      <div className="text-xl font-semibold mb-2">Select a call to begin</div>
                      <p className="text-sm">Choose a call from your calendar to generate prep materials and insights.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Default Mode: Three Cards Layout (only show when not in Agenda mode) */}
        {viewMode === "GREETING" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Today's Agenda */}
            <div className="space-y-4">
              <OpusAgendaList onSelect={onSelectEvent} />
            </div>

            {/* Rhythm */}
            <div className="space-y-4">
              <OpusRhythm />
            </div>

            {/* Quarter Insights */}  
            <div className="space-y-4">
              <OpusInsights />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}