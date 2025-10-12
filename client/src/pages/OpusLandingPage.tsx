import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { CONFIG } from "@/config";

interface CalendarEvent {
  id?: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}

interface AgendaItem {
  time: string;
  title: string;
  subtitle: string;
}

export default function OpusLandingPage() {
  const navigate = useNavigate();
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark');

  const { user } = useAuth();
  const userId = (user as any)?.claims?.sub;

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = !savedTheme || savedTheme === 'dark';
    setCurrentTheme(isDark ? 'dark' : 'light');
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    const handleThemeChange = (e: CustomEvent) => {
      const newTheme = e.detail.theme;
      setCurrentTheme(newTheme);
      
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        const newTheme = e.newValue;
        const isDark = !newTheme || newTheme === 'dark';
        setCurrentTheme(isDark ? 'dark' : 'light');
        
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    window.addEventListener('themeChange', handleThemeChange as EventListener);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const { data: todaysEvents } = useQuery({
    queryKey: ['/api/calendar/today'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/today');
      if (!response.ok) throw new Error('Failed to fetch calendar events');
      return response.json();
    },
    staleTime: 60_000,
  });

  const { data: integrations } = useQuery({
    queryKey: ["/api/integrations/status"],
    queryFn: async () => {
      const response = await fetch("/api/integrations/status");
      if (!response.ok) throw new Error("Failed to fetch integration status");
      return response.json();
    },
  });

  const { data: rhythmData } = useQuery({
    queryKey: ['/api/insights/rhythm'],
    queryFn: async () => {
      const response = await fetch('/api/insights/rhythm');
      if (!response.ok) throw new Error('Failed to fetch rhythm insights');
      return response.json();
    },
    staleTime: 300_000,
  });

  const mockAgenda = CONFIG.USE_MOCKS ? [
    { time: "8:15 PM", title: "Innovate Labs", subtitle: "" },
    { time: "9:00 PM", title: "Precision Manufacturing – Add-On Business", subtitle: "" },
    { time: "11:00 PM", title: "Momentum AI | Ramp: Discovery Call", subtitle: "" },
  ] : [];

  const agenda = CONFIG.USE_MOCKS ? mockAgenda : (todaysEvents || []).map((event: CalendarEvent) => {
    const startTime = event.start?.dateTime || event.start?.date;
    let time = 'All Day';

    if (startTime) {
      try {
        const eventDate = new Date(startTime);
        if (!isNaN(eventDate.getTime())) {
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
        time = 'All Day';
      }
    }

    return {
      time,
      title: event.summary || 'Untitled Event',
      subtitle: event.location || '',
    };
  });

  const rhythmItems = CONFIG.USE_MOCKS ? [
    "Pipeline review complete — 3 new opportunities identified",
    "Call prep ready for Discovery calls",
    "Click the Opus orb for voice chat or assistance"
  ] : (rhythmData?.items || []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/overview")}
            className="flex items-center gap-3 focus:outline-none"
            data-testid="brand-logo"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
              O
            </div>
          </button>
          <nav className="flex items-center gap-6 text-sm">
            <button
              onClick={() => navigate("/overview")}
              className="text-foreground font-semibold"
              data-testid="nav-overview"
            >
              Overview
            </button>
            <button
              onClick={() => navigate("/agenda")}
              className="text-muted-foreground hover:text-foreground"
              data-testid="nav-agenda"
            >
              Agenda
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground" data-testid="theme-indicator">
            Theme: {currentTheme === 'light' ? 'Light' : 'Dark'} (Preview)
          </div>
          <button
            onClick={() => navigate("/settings")}
            className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-foreground"
            data-testid="button-settings"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 md:px-10 py-6 max-w-7xl mx-auto">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Good morning, Taylor
          </h1>
          <p className="text-muted-foreground mt-2">
            Let's prep for success.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Upcoming Agenda */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-5">Upcoming Agenda</h2>
            <div className="space-y-4">
              {agenda.map((item: AgendaItem, idx: number) => (
                <div key={idx} className="flex justify-between items-start" data-testid={`agenda-item-${idx}`}>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{item.title}</div>
                    {item.subtitle && <div className="text-sm text-muted-foreground mt-0.5">{item.subtitle}</div>}
                  </div>
                  <div className="text-sm text-muted-foreground ml-4">{item.time}</div>
                </div>
              ))}
              {!CONFIG.USE_MOCKS && (!todaysEvents || todaysEvents.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No calls scheduled for today
                </div>
              )}
            </div>
          </div>

          {/* Today's Focus */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-5">Today's Focus</h2>
            <ul className="space-y-4">
              {CONFIG.USE_MOCKS ? (
                <>
                  <li className="flex items-start gap-3" data-testid="focus-item-0">
                    <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="text-foreground">Prepare for Innovate Labs</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="focus-item-1">
                    <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="text-foreground">Prepare for Precision Manufacturing – Add-On Business</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="focus-item-2">
                    <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span className="text-foreground">Prepare for Momentum AI | Ramp: Discovery Call</span>
                  </li>
                </>
              ) : (
                (todaysEvents?.slice(0, 3) || []).map((event: CalendarEvent, idx: number) => (
                  <li key={idx} className="flex items-start gap-3" data-testid={`focus-item-${idx}`}>
                    <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="text-foreground">Prepare for {event.summary}</span>
                  </li>
                ))
              )}
              {!CONFIG.USE_MOCKS && (!todaysEvents || todaysEvents.length === 0) && (
                <div className="text-center py-4 text-muted-foreground">
                  No focus items for today
                </div>
              )}
            </ul>
          </div>
        </div>

        {/* Second Row: Opus Insights and Momentum */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Opus Insights */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-5">Opus Insights</h3>
            <div className="space-y-4">
              {rhythmItems.map((item: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3" data-testid={`insight-item-${idx}`}>
                  <span className={`mt-2 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${idx % 2 === 0 ? 'bg-cyan-400' : 'bg-purple-400'}`} />
                  <span className="text-foreground text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Momentum */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-5">Momentum</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex items-center justify-between" data-testid="momentum-winrate">
                <span className="text-foreground">Win rate (QTD)</span>
                <span className="text-foreground font-medium">28%</span>
              </li>
              <li className="flex items-center justify-between" data-testid="momentum-cycle">
                <span className="text-foreground">Avg. cycle length</span>
                <span className="text-foreground font-medium">32 days</span>
              </li>
              <li className="flex items-center justify-between" data-testid="momentum-recommendations">
                <span className="text-foreground">Next step recommendations</span>
                <span className="text-foreground font-medium">2 ready</span>
              </li>
            </ul>
            <div className="mt-5 text-xs text-muted-foreground">
              Curated by Opus from CRM + calendar signals
            </div>
          </div>
        </div>

        {/* Quarter Overview */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quarter Overview</h3>
          <div className="text-3xl font-bold text-foreground">
            $480K <span className="text-muted-foreground text-base font-normal">/ $1M target</span>
          </div>
          <div className="mt-5 h-2 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-fuchsia-600" 
              style={{ width: "48%" }}
            />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-6 text-sm">
            <div data-testid="quarter-segment">
              <div className="text-foreground font-semibold">20%</div>
              <div className="text-muted-foreground mt-0.5">Segment rank</div>
            </div>
            <div data-testid="quarter-opps">
              <div className="text-foreground font-semibold">7</div>
              <div className="text-muted-foreground mt-0.5">Active opps</div>
            </div>
            <div data-testid="quarter-pipeline">
              <div className="text-foreground font-semibold">$1.9M</div>
              <div className="text-muted-foreground mt-0.5">Pipeline</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
