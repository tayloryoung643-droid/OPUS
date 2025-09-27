import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import OpusTopNav from "../components/Opus/TopNav";
import OpusHeroGreeting from "../components/Opus/HeroGreeting";
import OpusAgendaList from "../components/Opus/AgendaList";
import OpusPrepSheet from "../components/Opus/PrepSheet";
import OpusInsights from "../components/Opus/Insights";
import OpusRhythm from "../components/Opus/Rhythm";

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

export default function OpusAgenda() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [viewMode, setViewMode] = useState<"GREETING" | "AGENDA">("GREETING");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const onAgendaTabClick = () => setViewMode("AGENDA");
  const onSelectEvent = (ev: CalendarEvent, prepData?: any) => {
    setViewMode("AGENDA");
    setSelectedEvent(ev);
    // TODO: Use prepData to enhance the prep sheet when available
  };

  const firstName = useMemo(() => {
    return (user as any)?.claims?.first_name || (user as any)?.firstName || "Taylor";
  }, [user]);

  // Show landing page if not authenticated
  if (isLoading || !isAuthenticated) {
    return <Landing />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-indigo-900/80 to-violet-900/60 text-white antialiased">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <OpusTopNav active="Agenda" onAgendaClick={onAgendaTabClick} />

        {/* Greeting hides once Agenda is clicked */}
        {viewMode === "GREETING" && (
          <OpusHeroGreeting firstName={firstName} />
        )}

        {/* Main Dashboard Cards */}
        {viewMode === "AGENDA" && (
          <div className="mb-8">
            <div className="rounded-2xl bg-white/5 hover:bg-white/8 transition p-6">
              <OpusPrepSheet event={selectedEvent} />
            </div>
          </div>
        )}

        {/* Bottom Section: Three Cards Layout */}
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
      </div>
    </div>
  );
}