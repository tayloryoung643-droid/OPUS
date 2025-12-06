import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CONFIG } from "@/config";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Sparkles } from "lucide-react";

// ===== Helpers (small components) =====
function Section({ title, children }) {
  return (
    <div className="py-4">
      <h3 className="px-4 pb-2 text-xs uppercase tracking-wider text-zinc-500">{title}</h3>
      <div className="px-2">{children}</div>
    </div>
  );
}

function CallItem({ title, subtitle, time, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl px-3 py-3 mb-2 border transition ${
        active
          ? "bg-purple-600/20 border-purple-900/60"
          : "bg-zinc-950/60 border-zinc-900/70 hover:bg-zinc-900/40"
      }`}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-zinc-400">{subtitle}</div>
      <div className="text-[11px] text-zinc-500 mt-1">{time}</div>
    </button>
  );
}

function Card({ title, children, full = false, right = null }) {
  return (
    <div className={`${full ? "lg:col-span-2" : ""} rounded-2xl border border-zinc-900/70 bg-black/60 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        {right}
      </div>
      {children}
    </div>
  );
}

function List({ bullets = [] }) {
  if (!bullets.length) return <div className="text-zinc-500 text-sm">—</div>;
  return (
    <ul className="space-y-2 text-sm text-zinc-300">
      {bullets.map((b, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-500" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-zinc-900/70 bg-black/60 p-4">
          <div className="h-4 w-40 bg-zinc-800 rounded mb-4" />
          <div className="space-y-2">
            <div className="h-3 bg-zinc-800 rounded" />
            <div className="h-3 bg-zinc-800 rounded w-2/3" />
            <div className="h-3 bg-zinc-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Editable list (one bullet per line)
function EditableList({ value = [], onChange, placeholder = "Type one line per bullet…" }) {
  return (
    <textarea
      value={value.join("\n")}
      onChange={(e) => onChange(
        e.target.value
          .split("\n")
          .map((s) => s)
          .filter((s) => s !== "")
      )}
      placeholder={placeholder}
      className="w-full min-h-[120px] rounded-lg bg-black/60 border border-zinc-900/70 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
    />
  );
}

// Editable key-value for MEDDIC
const MEDDIC_KEYS = ["Metrics", "EconomicBuyer", "DecisionCriteria", "DecisionProcess", "IdentifyPain", "Champion"];
function EditableKeyValue({ kv = {}, onChange }) {
  return (
    <div className="space-y-2 text-sm">
      {MEDDIC_KEYS.map((k) => (
        <div key={k} className="flex items-center gap-3">
          <span className="text-zinc-400 w-40 shrink-0">{k}</span>
          <input
            value={kv[k] || ""}
            onChange={(e) => onChange({ ...kv, [k]: e.target.value })}
            className="flex-1 rounded-lg bg-black/60 border border-zinc-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600"
            placeholder={`Add ${k}…`}
          />
        </div>
      ))}
    </div>
  );
}

// Editable Objections (Q/A pairs)
function EditableObjections({ items = [], onChange }) {
  const update = (idx, field, val) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [field]: val } : it));
    onChange(next);
  };
  const add = () => onChange([...(items || []), { q: "", a: "" }]);
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  return (
    <div className="space-y-3">
      {(items.length ? items : [{ q: "", a: "" }]).map((o, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={o.q}
            onChange={(e) => update(i, "q", e.target.value)}
            placeholder="Question…"
            className="rounded-lg bg-black/60 border border-zinc-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600"
          />
          <div className="flex gap-2">
            <input
              value={o.a}
              onChange={(e) => update(i, "a", e.target.value)}
              placeholder="Answer…"
              className="flex-1 rounded-lg bg-black/60 border border-zinc-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600"
            />
            <button onClick={() => remove(i)} className="px-2 rounded-lg border border-zinc-800 text-xs text-zinc-300">–</button>
          </div>
        </div>
      ))}
      <button onClick={add} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-300">+ Add row</button>
    </div>
  );
}

export default function OpusAgendaMock() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch real Google Calendar events
  const { data: calendarEvents, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ['/api/calendar/events'],
    staleTime: 60_000
  });

  // Mock data fallback (only when USE_MOCKS is true)
  const mockAgenda = useMemo(
    () => CONFIG.USE_MOCKS ? ({
      upcoming: [
        {
          id: "call_001",
          title: "Discovery — DataFlow Systems",
          company: "DataFlow Systems",
          time: "Today • 9:30 AM",
          attendees: ["jennifer.white@dataflow.com", "ops@dataflow.com"],
        },
        {
          id: "call_002",
          title: "Demo — CloudScale",
          company: "CloudScale",
          time: "Today • 1:00 PM",
          attendees: ["mike@cloudscale.ai"],
        },
      ],
      previous: [
        { id: "call_990", title: "QBR — TechCorp", company: "TechCorp", time: "Yesterday • 3:00 PM" },
        { id: "call_989", title: "Security Review — InnovateLabs", company: "InnovateLabs", time: "Tue • 11:00 AM" },
      ],
    }) : { upcoming: [], previous: [] },
    []
  );

  // Helper function to format event time - handles both timed and all-day events
  const formatEventTime = (event) => {
    // Get the start time from either start.dateTime (timed) or start.date (all-day)
    const startTimeStr = event?.start?.dateTime || event?.start?.date;
    
    if (!startTimeStr) return "—";
    
    const eventDate = new Date(startTimeStr);
    
    // Check if date is valid
    if (isNaN(eventDate.getTime())) return "—";
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    // If it's an all-day event (has start.date instead of start.dateTime)
    if (event?.start?.date && !event?.start?.dateTime) {
      if (eventDateOnly.getTime() === today.getTime()) {
        return "Today (All-day)";
      } else if (eventDateOnly.getTime() === yesterday.getTime()) {
        return "Yesterday (All-day)";
      } else {
        return eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + " (All-day)";
      }
    }

    // For timed events
    const timeStr = eventDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    if (eventDateOnly.getTime() === today.getTime()) {
      return `Today • ${timeStr}`;
    } else if (eventDateOnly.getTime() === yesterday.getTime()) {
      return `Yesterday • ${timeStr}`;
    } else {
      const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'short' });
      return `${dayName} • ${timeStr}`;
    }
  };

  // Process real calendar events into agenda format
  const processedAgenda = useMemo(() => {
    if (CONFIG.USE_MOCKS) return mockAgenda;

    if (!calendarEvents || !Array.isArray(calendarEvents)) {
      console.log('[Agenda] No calendar events:', calendarEvents);
      return { upcoming: [], previous: [] };
    }

    const now = new Date();
    const events = calendarEvents.map(event => ({
      id: event.id,
      title: event.summary || 'Untitled Event',
      company: event.location || '',
      time: formatEventTime(event),
      attendees: event.attendees?.map((a: any) => a.email).filter(Boolean) || [],
      originalEvent: event
    }));

    const upcoming = events.filter(event => {
      const startTime = event.originalEvent.start?.dateTime || event.originalEvent.start?.date;
      if (!startTime) return false;
      return new Date(startTime) >= now;
    });
    
    const previous = events.filter(event => {
      const startTime = event.originalEvent.start?.dateTime || event.originalEvent.start?.date;
      if (!startTime) return false;
      return new Date(startTime) < now;
    });

    return { upcoming, previous };
  }, [calendarEvents, mockAgenda]);

  // ===== State =====
  const [selectedId, setSelectedId] = useState(null);
  const [prep, setPrep] = useState(null); // outline or full
  const [notes, setNotes] = useState<Record<string, string>>({}); // Store notes per event: { [eventId]: "notes text" }
  const [loading, setLoading] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [showSaved, setShowSaved] = useState(false);

  // Chat history per call
  const [chatByCall, setChatByCall] = useState({});
  const [chatDraft, setChatDraft] = useState("");

  const chatInputRef = useRef(null);

  // Generate AI prep mutation
  const generatePrepMutation = useMutation({
    mutationFn: async (calendarEventId: string) => {
      // First, ensure a call record exists for this calendar event
      const ensureResponse = await apiRequest("POST", `/api/calendar/events/${calendarEventId}/ensure-call`);
      const { call } = await ensureResponse.json();
      
      if (!call?.id) {
        throw new Error("Failed to create call record");
      }
      
      // Now generate prep using the call ID
      const prepResponse = await apiRequest("POST", `/api/calls/${call.id}/generate-prep`);
      return prepResponse.json();
    },
    onSuccess: () => {
      toast({
        title: "AI prep generated",
        description: "Your call preparation sheet has been updated with AI insights.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate AI preparation: " + (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    setSavedAt(new Date());
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 900);
  };

  const selected =
    processedAgenda.upcoming.find((c) => c.id === selectedId) ||
    processedAgenda.previous.find((c) => c.id === selectedId) ||
    processedAgenda.upcoming[0];

  // Select first upcoming on mount
  useEffect(() => {
    if (!selectedId && processedAgenda.upcoming.length) setSelectedId(processedAgenda.upcoming[0].id);
  }, [processedAgenda, selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        const search = document.querySelector('input[placeholder="Search calls…"]');
        search?.focus();
        e.preventDefault();
      }
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        chatInputRef.current?.focus();
        e.preventDefault();
      }
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "s") {
        handleSave();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Outline-only when call changes (Calendar info only)
  useEffect(() => {
    if (!selected) return;
    // skeletal outline with just calendar-derived bits
    const stakeholders = selected.attendees?.map((e) => ({ email: e, role: "" })) || [];
    setEventTitle(selected.title || "");
    setEventTime(selected.time || "");
    setPrep({
      company: selected.company,
      title: selected.title,
      stakeholders,
      agendaBullets: [],
      goalsPain: [],
      methodology: { MEDDIC: {}, Challenger: [] },
      objections: [],
      previousComms: [],
      competitors: [],
      opusSummary: null,
      nextSteps: [],
    });
  }, [selectedId]);

  // Generate full mock from MCP/integrations (simulated)
  const generatePrep = () => {
    if (!selected) return;
    setLoading(true);
    setTimeout(() => {
      setPrep({
        company: selected.company,
        title: selected.title,
        stakeholders: selected.attendees?.map((e) => ({ email: e, role: "TBD" })) || [],
        agendaBullets: [
          "Introductions & goals",
          "Current workflow & gaps",
          "Show how Opus reduces prep time",
          "Agree on next steps",
        ],
        goalsPain: [
          "Reduce manual prep time",
          "Improve objection handling",
          "Consolidate CRM, Gmail, Calendar context",
        ],
        methodology: {
          MEDDIC: {
            Metrics: "Time saved/meeting, cycle time",
            EconomicBuyer: "Ops Director (confirm)",
            DecisionCriteria: "Security, time-to-value, GCal/Gmail sync",
            DecisionProcess: "Pilot → Security → Legal",
            IdentifyPain: "Fragmented prep, misses context",
            Champion: "RevOps Manager (potential)",
          },
          Challenger: ["Teach: time drain", "Tailor: their data", "Take control: timeline"],
        },
        objections: [
          { q: "Security/compliance?", a: "SOC2, data minimization, OAuth scopes" },
          { q: "Will reps use it?", a: "Auto-prep + notes carry-over; minimal clicks" },
        ],
        previousComms: [
          { source: "Gmail", when: "Sep 23 • 2:14 PM", summary: "Prospect asked for SOC2 + redlines ETA. You proposed a 2‑week pilot starting Oct 1." },
          { source: "Salesforce (Notes)", when: "Sep 19", summary: "Identified pain: manual prep across Gmail/Calendar/CRM. Decision maker likely Ops Director." },
          { source: "Gong", when: "Sep 12 • 29m call", summary: "Security concerns and change management flagged. Next step was to invite RevOps." },
        ],
        competitors: [
          { name: "Competitor A", context: "Lightweight call notes tool", counters: ["We're end‑to‑end: agenda → live‑coach → recap"], traps: ["They push templates; doesn't auto‑enrich from CRM/Gmail"], ripcord: ["Time‑to‑value: 1‑click auto‑prep from your calendar"] },
          { name: "Competitor B", context: "Enterprise suite add‑on", counters: ["Opus deploys without admin lift; OAuth scopes only"], traps: ["Locked behind full suite; slow procurement"], ripcord: ["Pilot in days, not quarters"] },
        ],
        opusSummary: {
          headline: "What matters most and how to win this call",
          bullets: [
            "Primary outcome: secure 2-week pilot starting Oct 1 with clear success metrics.",
            "Lead with quantified time-saved: translate to weekly AE capacity gains.",
            "Confirm EB path: identify Ops Director; recruit RevOps as Champion live.",
            "Preempt security: mention SOC2 + least-privilege OAuth up front.",
            "Close with a Mutual Action Plan and calendar hold for next step.",
          ],
        },
        nextSteps: ["Pilot (2 weeks)", "Access scopes list", "Security review docs"],
      });
      setLoading(false);
      handleSave();
    }, 500);
  };

  // Chat helpers
  const thread = chatByCall[selected?.id] || [];
  const pushChat = (role, text) => {
    if (!selected?.id) return;
    const next = { ...(chatByCall || {}) };
    next[selected.id] = [...(next[selected.id] || []), { role, text }];
    setChatByCall(next);
  };

  const sendChat = () => {
    if (!chatDraft.trim() || !selected?.id) return;
    pushChat("user", chatDraft.trim());
    setChatDraft("");
    setTimeout(() => {
      pushChat("opus", "Got it — I'll watch for spots to suggest bigger impact.");
    }, 300);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-zinc-900/60 sticky top-0 bg-black/70 backdrop-blur z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 select-none">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500 grid place-items-center">
              <div className="h-3 w-3 rounded-sm bg-black/60" />
            </div>
            <span className="text-lg font-semibold">Opus</span>
          </div>
          <span className="text-sm text-zinc-400">Agenda</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {["Overview", "Agenda"].map((tab) => (
            <button 
              key={tab} 
              onClick={() => {
                if (tab === "Overview") navigate("/overview");
                else if (tab === "Agenda") navigate("/agenda");
              }}
              className={`relative ${tab === "Agenda" ? "text-white font-semibold" : "text-zinc-400 hover:text-white cursor-pointer"}`}
              data-testid={`nav-${tab.toLowerCase()}`}
            >
              {tab}
              {tab === "Agenda" && <span className="absolute left-0 -bottom-1 h-0.5 w-full bg-purple-500 animate-pulse rounded-full" />}
            </button>
          ))}
        </nav>
        <button 
          onClick={() => navigate("/settings")}
          className="text-sm px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300"
          data-testid="button-settings"
        >
          Settings
        </button>
      </header>

      {/* Body grid */}
      <main className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">
        {/* Left rail */}
        <aside className="border-r border-zinc-900/60 min-h-[calc(100vh-57px)]">
          <div className="p-4 border-b border-zinc-900/60">
            <input placeholder="Search calls…" className="w-full rounded-xl bg-zinc-950/60 border border-zinc-900/70 px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
          </div>

          <Section title="Upcoming">
            {eventsLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse px-3 py-3 mb-2">
                  <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                </div>
              ))
            ) : eventsError ? (
              <div className="px-3 py-6 text-center">
                <div className="text-zinc-500 text-sm mb-2">Unable to load calendar events</div>
                <button className="text-purple-400 hover:text-purple-300 text-sm" onClick={() => window.location.reload()}>
                  Reconnect Google Calendar
                </button>
              </div>
            ) : processedAgenda.upcoming.length > 0 ? (
              processedAgenda.upcoming.map((c) => (
                <CallItem key={c.id} active={selected?.id === c.id} title={c.title} subtitle={c.company} time={c.time} onClick={() => setSelectedId(c.id)} />
              ))
            ) : (
              <div className="px-3 py-4 text-center text-zinc-500 text-sm">
                No upcoming events
              </div>
            )}
          </Section>

          <div className="h-px bg-zinc-900/60 mx-4" />

          <Section title="Previous">
            {eventsLoading ? (
              [...Array(2)].map((_, i) => (
                <div key={i} className="animate-pulse px-3 py-3 mb-2">
                  <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                </div>
              ))
            ) : processedAgenda.previous.length > 0 ? (
              processedAgenda.previous.map((c) => (
                <CallItem key={c.id} active={selected?.id === c.id} title={c.title} subtitle={c.company} time={c.time} onClick={() => setSelectedId(c.id)} />
              ))
            ) : (
              <div className="px-3 py-4 text-center text-zinc-500 text-sm">
                No previous events
              </div>
            )}
          </Section>
        </aside>

        {/* Right: Prep sheet */}
        <section className="relative p-6 md:p-8">
          {/* Orb - removed */}

          {/* Floating actions beside the Orb (desktop) - removed */}

          {/* Chat box - removed */}

          {/* Save toast */}
          {showSaved && (
            <div className="fixed right-6 top-[calc(64px+16px)] z-[60] px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-200">
              ✓ Saved {savedAt ? savedAt.toLocaleTimeString() : ""}
            </div>
          )}

          {/* Event header card */}
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" fill="none" />
                  <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
                  <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
                  <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
                </svg>
                <h2 className="text-base font-semibold text-white">Event</h2>
              </div>
              
              {/* Generate Prep Button - Top Right */}
              <button
                onClick={() => selected?.id && generatePrepMutation.mutate(selected.id)}
                disabled={generatePrepMutation.isPending || !selected?.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-all"
                data-testid="button-generate-prep"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{generatePrepMutation.isPending ? "Generating..." : "Generate Prep"}</span>
              </button>
            </div>

            {/* Event name and Date/Time side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Event name</label>
                <input
                  type="text"
                  value={selected?.summary || selected?.title || ""}
                  onChange={(e) => setEventTitle(e.target.value)}
                  onBlur={handleSave}
                  placeholder="e.g., Product Demo — DataFlow"
                  className="w-full rounded-lg bg-black/60 border border-zinc-900/70 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                  data-testid="input-event-name"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Date & time</label>
                <input
                  type="text"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  onBlur={handleSave}
                  placeholder="Oct 12, 2025 • 11:00–11:30"
                  className="w-full rounded-lg bg-black/60 border border-zinc-900/70 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                  data-testid="input-event-datetime"
                />
              </div>
            </div>

            {/* Attendees section */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-zinc-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <label className="text-sm font-medium text-white">Attendees (emails)</label>
              </div>
              <div className="flex flex-wrap gap-2">
                {prep?.stakeholders?.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-3 py-1 rounded-md bg-zinc-800/60 text-sm text-zinc-200"
                    data-testid={`badge-attendee-${i}`}
                  >
                    {s.email}
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Add attendee..."
                  className="inline-flex px-3 py-1 rounded-md bg-transparent border border-zinc-800 text-sm text-zinc-400 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-600 min-w-[140px]"
                  data-testid="input-add-attendee"
                />
              </div>
            </div>
          </div>

          {/* Notes section */}
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-5 mb-6">
            <textarea
              value={notes[selected?.id] || ""}
              onChange={(e) => setNotes({ ...notes, [selected?.id]: e.target.value })}
              onBlur={handleSave}
              placeholder="Notes (optional, personal scratchpad)"
              className="w-full min-h-[96px] rounded-lg bg-transparent border-0 px-0 py-0 text-sm text-white placeholder:text-zinc-500 focus:outline-none resize-none"
              data-testid="textarea-notes"
            />
          </div>

          {/* Open call-prep canvas */}
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-5">
            <h3 className="text-base font-semibold text-white mb-3">Open call-prep canvas</h3>
            <textarea
              placeholder="Type only what we *know for sure*...

Suggestions:
• Attendees + roles (facts only)
• Last email: short snippet + date
• CRM facts: stage, amount, close date, owner

Keep bullets tight. Avoid repetition."
              className="w-full min-h-[320px] rounded-lg bg-black/60 border border-zinc-900/70 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-600 resize-none"
              data-testid="textarea-prep-canvas"
            />
          </div>
        </section>
      </main>
    </div>
    </ErrorBoundary>
  );
}