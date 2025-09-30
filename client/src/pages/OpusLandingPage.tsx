import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import SettingsModal from "@/components/SettingsModal";
import { useAuth } from "@/hooks/useAuth";
import { CONFIG } from "@/config";

export default function OpusLandingPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  
  // Get current user for voice recording
  const { user } = useAuth();
  const userId = (user as any)?.claims?.sub;

  // Fetch today's calendar events only
  const { data: todaysEvents, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ['/api/calendar/today'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/today');
      if (!response.ok) throw new Error('Failed to fetch calendar events');
      return response.json();
    },
    staleTime: 60_000,
  });

  // Fetch integration status to properly show connection state
  const { data: integrations } = useQuery({
    queryKey: ["/api/integrations/status"],
    queryFn: async () => {
      const response = await fetch("/api/integrations/status");
      if (!response.ok) throw new Error("Failed to fetch integration status");
      return response.json();
    },
  });

  // Fetch rhythm insights
  const { data: rhythmData } = useQuery({
    queryKey: ['/api/insights/rhythm'],
    queryFn: async () => {
      const response = await fetch('/api/insights/rhythm');
      if (!response.ok) throw new Error('Failed to fetch rhythm insights');
      return response.json();
    },
    staleTime: 300_000, // 5 minutes
  });

  // Mock data fallback (only when USE_MOCKS is true)
  const mockAgenda = CONFIG.USE_MOCKS ? [
    { time: "9:00 AM", title: "Momentum AI", subtitle: "Discovery call" },
    { time: "11:45 AM", title: "Jamie's Birthday", subtitle: "Jamie's Birthday" },
    { time: "3:00 PM", title: "Orthodontist", subtitle: "Orthodontist" },
  ] : [];

  // Process today's real events into agenda format
  const agenda = CONFIG.USE_MOCKS ? mockAgenda : (todaysEvents || []).map(event => {
    // Handle the nested start time structure
    const startTime = event.start?.dateTime || event.start?.date;
    let time = 'All Day';
    
    if (startTime) {
      try {
        const eventDate = new Date(startTime);
        // Guard against invalid dates
        if (!isNaN(eventDate.getTime())) {
          // For all-day events (date only, no time), just show "All Day"
          if (event.start?.date && !event.start?.dateTime) {
            time = 'All Day';
          } else {
            time = eventDate.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
          }
        }
      } catch (err) {
        console.error('Error formatting event time:', err);
        time = 'All Day';
      }
    }

    return {
      time,
      title: event.summary || 'Untitled Event',
      subtitle: event.location || '',
    };
  }); // Show all today's events (no limit)

  // Find current active calendar event for voice recording
  const currentEvent = React.useMemo(() => {
    if (CONFIG.USE_MOCKS || !todaysEvents) return null;
    
    const now = new Date();
    return todaysEvents.find(event => {
      if (!event.start?.dateTime || !event.end?.dateTime) return false;
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      return now >= start && now <= end;
    });
  }, [todaysEvents]);

  const rhythmItems = CONFIG.USE_MOCKS ? [
    "Back-to-back meetings from 10–4 — grab a snack before",
    "3 calls prepped — keep the streak alive", 
    "1 high-stakes deal at 2 PM — review the risk questions"
  ] : (rhythmData?.items || []);


  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-zinc-900/60 sticky top-0 bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-black/60 z-40">
        <div className="flex items-center gap-3">
          {/* Brand logo using crisp SVG wordmark */}
          <img
            src="/opus-logo.svg"
            alt="Opus"
            className="h-9 w-auto select-none pointer-events-none"
            draggable={false}
          />
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-300">
          {["Overview", "Agenda", "Pipeline", "Tasks", "Coach", "Insights"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                if (tab === "Overview") navigate("/overview");
                else if (tab === "Agenda") navigate("/agenda");
                // Other tabs are disabled for now
              }}
              disabled={!["Overview", "Agenda"].includes(tab)}
              className={`relative ${tab === "Overview" ? "text-white font-semibold" : !["Overview", "Agenda"].includes(tab) ? "text-zinc-600 cursor-not-allowed" : "hover:text-white cursor-pointer"}`}
              data-testid={`nav-${tab.toLowerCase()}`}
            >
              {tab}
              {tab === "Overview" && (
                <span className="absolute left-0 -bottom-1 h-0.5 w-full bg-purple-500 animate-pulse rounded-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => setSettingsOpen(true)}
            className="text-sm px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300"
            data-testid="button-settings"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Hero grid */}
      <main className="px-6 md:px-16 lg:px-20 py-2 md:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-6 items-start">
          {/* Left: Greeting, Agenda, Rhythm */}
          <section className="space-y-3 lg:space-y-4">
            {/* Greeting */}
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight font-sans">
                Good morning,
                <br />
                Taylor
              </h1>
              <p className="text-zinc-400 mt-1.5 md:mt-2 text-base md:text-lg font-medium font-sans">
                Let's set the rhythm for your day.
              </p>
            </div>

            {/* Cards row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Agenda */}
              <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Upcoming Agenda</h2>
                {eventsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, idx) => (
                      <div key={idx} className="flex items-start gap-4 animate-pulse">
                        <div className="w-16 h-4 bg-zinc-800 rounded"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : eventsError ? (
                  <div className="text-center py-6">
                    <div className="text-zinc-500 text-sm mb-2">Unable to load calendar events</div>
                    <button 
                      className="text-purple-400 hover:text-purple-300 text-sm"
                      onClick={() => window.location.href = '/settings'}
                    >
                      Check Google Calendar Connection
                    </button>
                  </div>
                ) : agenda.length > 0 ? (
                  <div className="space-y-4">
                    {agenda.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-4">
                        <div className="w-16 text-zinc-400 font-medium mt-0.5">{item.time}</div>
                        <div>
                          <div className="font-medium text-zinc-100">{item.title}</div>
                          <div className="text-sm text-zinc-500">{item.subtitle}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="text-zinc-500 text-sm mb-2">No events scheduled for today</div>
                    <div className="text-zinc-600 text-xs">
                      {integrations?.googleCalendar?.connected ? (
                        "Google Calendar connected • Check upcoming events in Agenda"
                      ) : (
                        <>
                          <button 
                            className="text-purple-400 hover:text-purple-300"
                            onClick={() => setSettingsOpen(true)}
                          >
                            Connect Google Calendar
                          </button>
                          {" • Enable calendar sync in Settings"}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Rhythm */}
              {(rhythmItems?.length ?? 0) > 0 && (
                <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-lg">
                  <h2 className="text-xl font-semibold mb-4">Rhythm</h2>
                  <ul className="space-y-3 text-zinc-300">
                    {rhythmItems.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-zinc-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Right: Opus insights and content now that global OpusDock handles interaction */}
          <aside className="space-y-6">
            {/* Global OpusDock handles all Opus interaction now */}
            <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-zinc-200 mb-4">Today's Focus</h3>
              <div className="space-y-3 text-zinc-300 text-sm">
                <div className="flex items-start gap-3">
                  <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span>Pipeline review complete — 3 new opportunities identified</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
                  <span>Call prep ready for Discovery calls</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span>Click the Opus orb for voice chat or assistance</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Refined bottom strip: Elegant insights */}
        <section className="-mt-8 md:-mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-full overflow-hidden">
          {/* Quarter Overview */}
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-lg min-w-0">
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">Quarter Overview</h3>
            <div className="text-3xl font-light tracking-tight">
              $480K <span className="text-zinc-500 text-base">/ $1M target</span>
            </div>
            <div className="mt-4 h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-600 to-fuchsia-600" style={{ width: "48%" }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm text-zinc-400">
              <div>
                <div className="text-zinc-200 font-medium">20%</div>
                <div className="mt-0.5">Segment rank</div>
              </div>
              <div>
                <div className="text-zinc-200 font-medium">7</div>
                <div className="mt-0.5">Active opps</div>
              </div>
              <div>
                <div className="text-zinc-200 font-medium">$1.9M</div>
                <div className="mt-0.5">Pipeline</div>
              </div>
            </div>
          </div>

          {/* Momentum (less gamey, more elegant) */}
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-lg min-w-0">
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">Momentum</h3>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li className="flex items-center justify-between">
                <span>Win rate (QTD)</span>
                <span className="text-zinc-100 font-medium">28%</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Avg. cycle length</span>
                <span className="text-zinc-100 font-medium">32 days</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Next step recommendations</span>
                <span className="text-zinc-100 font-medium">2 ready</span>
              </li>
            </ul>
            <div className="mt-4 text-xs text-zinc-500">Curated by Opus from CRM + calendar signals</div>
          </div>
        </section>
      </main>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />
    </div>
  );
}