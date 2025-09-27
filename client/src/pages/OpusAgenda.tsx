import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import OpusTopNav from "../components/Opus/TopNav";
import OpusHeroGreeting from "../components/Opus/HeroGreeting";
import OpusAgendaList from "../components/Opus/AgendaList";
import OpusPrepSheet from "../components/Opus/PrepSheet";
import OpusInsights from "../components/Opus/Insights";
import OpusPartnerCircle from "../components/Opus/PartnerCircle";

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
  const onSelectEvent = (ev: CalendarEvent) => {
    setViewMode("AGENDA");
    setSelectedEvent(ev);
  };

  const firstName = useMemo(() => {
    return (user as any)?.claims?.first_name || (user as any)?.firstName || "Taylor";
  }, [user]);

  // Show landing page if not authenticated
  if (isLoading || !isAuthenticated) {
    return <Landing />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <OpusTopNav active="Agenda" onAgendaClick={onAgendaTabClick} />

        {/* Greeting hides once Agenda is clicked */}
        {viewMode === "GREETING" && (
          <OpusHeroGreeting firstName={firstName} />
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-start">
          {/* Left: Agenda (always pinned) */}
          <aside className="md:col-span-4">
            <div className="sticky top-4 space-y-4">
              <OpusAgendaList onSelect={onSelectEvent} />
            </div>
          </aside>

          {/* Center: Prep sheet when an event is selected, else placeholder */}
          <main className="md:col-span-6">
            <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 backdrop-blur shadow-card">
              <OpusPrepSheet event={selectedEvent} />
            </div>
          </main>

          {/* Right: Insights + Partner circle (always visible) */}
          <aside className="md:col-span-2">
            <div className="sticky top-4 space-y-4">
              <OpusInsights />
              <OpusPartnerCircle />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}