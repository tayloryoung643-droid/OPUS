import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CONFIG } from "@/config";
import ErrorBoundary from "@/components/ErrorBoundary";

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

  // Fetch real Google Calendar events
  const { data: calendarEvents, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ['/api/calendar/events'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/events');
      if (!response.ok) throw new Error('Failed to fetch calendar events');
      return response.json();
    },
    staleTime: 60_000,
    retry: false
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

  // Helper function to format event time - MUST be defined before use
  const formatEventTime = (startTime) => {
    const eventDate = new Date(startTime);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

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

    if (!calendarEvents || !Array.isArray(calendarEvents)) return { upcoming: [], previous: [] };

    const now = new Date();
    const events = calendarEvents.map(event => ({
      id: event.id,
      title: event.summary || 'Untitled Event',
      company: event.location || '',
      time: formatEventTime(event.start),
      attendees: event.attendees?.map(a => a.email).filter(Boolean) || [],
      originalEvent: event
    }));

    const upcoming = events.filter(event => {
      const startTime = event.originalEvent.start?.dateTime || event.originalEvent.start?.date;
      return startTime && new Date(startTime) >= now;
    });
    const previous = events.filter(event => {
      const startTime = event.originalEvent.start?.dateTime || event.originalEvent.start?.date;
      return startTime && new Date(startTime) < now;
    });

    return { upcoming, previous };
  }, [calendarEvents, mockAgenda]);

  // ===== State =====
  const [selectedId, setSelectedId] = useState(null);
  const [prep, setPrep] = useState(null); // outline or full
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [showSaved, setShowSaved] = useState(false);

  // Chat history per call
  const [chatByCall, setChatByCall] = useState({});
  const [chatDraft, setChatDraft] = useState("");

  const chatInputRef = useRef(null);

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
            <img src="/opus-logo.svg" alt="Opus" className="h-7" />
          </div>
          <span className="text-sm text-zinc-400">Agenda</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {["Overview", "Agenda", "Pipeline", "Tasks", "Coach", "Insights"].map((tab) => (
            <button 
              key={tab} 
              onClick={() => {
                if (tab === "Overview") navigate("/overview");
                else if (tab === "Agenda") navigate("/agenda");
                // Other tabs are disabled for now
              }}
              disabled={!["Overview", "Agenda"].includes(tab)}
              className={`relative ${tab === "Agenda" ? "text-white font-semibold" : !["Overview", "Agenda"].includes(tab) ? "text-zinc-600 cursor-not-allowed" : "text-zinc-400 hover:text-white cursor-pointer"}`}
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
          {/* Orb */}
          <div className="hidden lg:block fixed right-6 top-24 z-50">
            <div className="mx-auto h-64 w-64 rounded-full relative group cursor-pointer">
            <div className="absolute inset-0 rounded-full bg-black ring-1 ring-white/15 transition-all duration-300 group-hover:ring-white/40 group-hover:scale-[1.02] shadow-[0_0_60px_rgba(168,85,247,0.5),0_0_120px_rgba(147,51,234,0.4),0_0_200px_rgba(139,92,246,0.3),0_0_280px_rgba(124,58,237,0.2),0_0_220px_rgba(168,85,247,0.35)_inset] hover:shadow-[0_0_80px_rgba(168,85,247,0.7),0_0_160px_rgba(147,51,234,0.55),0_0_240px_rgba(139,92,246,0.45),0_0_320px_rgba(124,58,237,0.35),0_0_280px_rgba(168,85,247,0.5)_inset]" />
            <div className="absolute -inset-6 rounded-full blur-3xl bg-purple-500/20 animate-pulse transition-opacity duration-300 group-hover:opacity-80" />
            {/* extra glow on hover */}
            <div className="absolute -inset-10 rounded-full blur-[44px] bg-gradient-to-br from-purple-500/30 via-indigo-500/25 to-cyan-400/20 opacity-0 transition-opacity duration-300 group-hover:opacity-70" />
          </div>
          </div>

          {/* Floating actions beside the Orb (desktop) */}
          <div className="hidden lg:flex fixed right-[190px] top-28 z-50 gap-2">
            <button onClick={handleSave} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300">Save</button>
            <button onClick={generatePrep} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700">Generate Prep</button>
          </div>

          {/* Chat box */}
          <div className="hidden lg:flex flex-col fixed right-6 top-64 w-[420px] max-w-[50vw] min-h-[260px] rounded-2xl border border-zinc-900/70 bg-black/80 backdrop-blur p-5">
            <div className="text-xs text-zinc-400 mb-2">Opus ↔ Taylor (persists per call)</div>
            <div className="flex-1 overflow-auto space-y-2 text-sm pr-1">
              {thread.length === 0 && (
                <div className="text-zinc-500 text-xs">No messages yet for this call.</div>
              )}
              {thread.map((m, idx) => (
                <div key={idx} className={`max-w-[85%] px-3 py-2 rounded-lg border ${m.role === "opus" ? "self-start bg-zinc-950/60 border-zinc-900/60 italic" : "self-end bg-black/60 border-zinc-800"}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                ref={chatInputRef}
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Ask Opus…"
                className="flex-1 rounded-xl bg-zinc-950/60 border border-zinc-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
              <button onClick={sendChat} className="px-3 py-2 text-sm rounded-xl bg-purple-600 hover:bg-purple-700">Send</button>
            </div>
          </div>

          {/* Save toast */}
          {showSaved && (
            <div className="fixed right-6 top-[calc(64px+16px)] z-[60] px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-200">
              ✓ Saved {savedAt ? savedAt.toLocaleTimeString() : ""}
            </div>
          )}

          {/* Notes */}
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">My Notes</h2>
              <div className="flex items-center gap-2 lg:hidden">
                <button onClick={handleSave} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300">Save</button>
                <button onClick={generatePrep} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700">Generate Prep</button>
              </div>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSave}
              placeholder="Type notes for this call…"
              className="w-full min-h-[96px] rounded-lg bg-black/60 border border-zinc-900/70 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
            />
          </div>

          {/* Prep content */}
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-5">
            {/* Sticky context bar */}
            <div className="flex items-baseline justify-between gap-4 mb-3 sticky top-16 z-10 bg-zinc-950/80 backdrop-blur px-2 py-2 rounded-xl border border-zinc-900/60">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{selected?.title || "—"}</h1>
                  <p className="text-zinc-400">{selected?.time}</p>
                </div>
                <div className="hidden md:flex items-center gap-3 text-xs text-zinc-400">
                  <span className="px-2 py-1 rounded bg-zinc-900/70">Attendees: {prep?.stakeholders?.length || 0}</span>
                  <a href="#" className="px-2 py-1 rounded bg-zinc-900/70 underline">Join link</a>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {['No EB identified','Security review pending','Low stakeholder coverage'].map((r,i)=> (
                  <span key={i} className="px-2 py-1 rounded-full border border-zinc-800 text-zinc-300">{r}</span>
                ))}
              </div>
            </div>

            {loading ? (
              <Skeleton />
            ) : prep ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stakeholders (read-only for now) */}
                <Card title="Stakeholders" right={<button className="text-[11px] text-zinc-400">↻ Regenerate</button>}>
                  {prep.stakeholders?.length ? (
                    <ul className="space-y-3">
                      {prep.stakeholders.map((s, i) => (
                        <li key={i}>
                          <div className="text-sm font-medium">{s.email}</div>
                          <div className="text-xs text-zinc-500">{s.role}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-zinc-500 text-sm">—</div>
                  )}
                </Card>

                {/* Goals & Pain (editable) */}
                <Card title="Goals & Pain" right={<button className="text-[11px] text-zinc-400">↻ Regenerate</button>}>
                  <EditableList value={prep.goalsPain} onChange={(v) => { setPrep({ ...prep, goalsPain: v }); handleSave(); }} />
                </Card>

                {/* Opus Summary */}
                <Card title="Opus Summary (Coach Digest)" right={<button className="text-[11px] text-zinc-400">↻ Regenerate</button>}>
                  <div className="space-y-2">
                    <div className="text-sm text-zinc-300 font-medium">{prep.opusSummary?.headline || 'What matters most for this call'}</div>
                    {prep.opusSummary?.bullets?.length ? (
                      <List bullets={prep.opusSummary.bullets} />
                    ) : (
                      <div className="text-sm text-zinc-500">Generate to see Opus' summary.</div>
                    )}
                  </div>
                </Card>

                {/* Methodology (editable) */}
                <Card title="Methodology (MEDDIC + Challenger)" right={<button className="text-[11px] text-zinc-400">↻ Regenerate</button>}>
                  <EditableKeyValue kv={prep.methodology?.MEDDIC || {}} onChange={(kv) => { setPrep({ ...prep, methodology: { ...prep.methodology, MEDDIC: kv } }); handleSave(); }} />
                  <div className="mt-4">
                    <div className="text-zinc-400 text-xs mb-1">Challenger cues</div>
                    <EditableList value={prep.methodology?.Challenger || []} onChange={(v) => { setPrep({ ...prep, methodology: { ...prep.methodology, Challenger: v } }); handleSave(); }} />
                  </div>
                </Card>

                {/* Suggested Agenda (editable) */}
                <Card title="Suggested Agenda" full right={<button className="text-[11px] text-zinc-400">↻ Regenerate</button>}>
                  <EditableList value={prep.agendaBullets} onChange={(v) => { setPrep({ ...prep, agendaBullets: v }); handleSave(); }} />
                </Card>

                {/* Next Steps (editable) */}
                <Card title="Next Steps" full right={<button className="text-[11px] text-zinc-400">↻ Regenerate</button>}>
                  <EditableList value={prep.nextSteps} onChange={(v) => { setPrep({ ...prep, nextSteps: v }); handleSave(); }} />
                </Card>

                {/* Objections (editable) */}
                <Card title="Objections & Responses" full right={<button className="text-[11px] text-zinc-400">↻ Regenerate</button>}>
                  <EditableObjections items={prep.objections} onChange={(items) => { setPrep({ ...prep, objections: items }); handleSave(); }} />
                </Card>

                {/* Previous Communications */}
                <Card title="Previous Communications" full>
                  {prep.previousComms?.length ? (
                    <div className="space-y-3">
                      {prep.previousComms.map((comm, i) => (
                        <div key={i} className="border border-zinc-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-zinc-300">{comm.source}</span>
                            <span className="text-xs text-zinc-500">{comm.when}</span>
                          </div>
                          <div className="text-sm text-zinc-400">{comm.summary}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-500 text-sm">No previous communications found.</div>
                  )}
                </Card>

                {/* Competitors */}
                <Card title="Competitive Intelligence" full>
                  {prep.competitors?.length ? (
                    <div className="space-y-4">
                      {prep.competitors.map((comp, i) => (
                        <div key={i} className="border border-zinc-800 rounded-lg p-3">
                          <div className="text-sm font-medium text-zinc-200 mb-2">{comp.name}</div>
                          <div className="text-xs text-zinc-400 mb-2">{comp.context}</div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-zinc-400 mb-1">Counters:</div>
                              <ul className="text-zinc-300 space-y-1">
                                {comp.counters?.map((counter, j) => (
                                  <li key={j}>• {counter}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="text-zinc-400 mb-1">Traps:</div>
                              <ul className="text-zinc-300 space-y-1">
                                {comp.traps?.map((trap, j) => (
                                  <li key={j}>• {trap}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="text-zinc-400 mb-1">Ripcord:</div>
                              <ul className="text-zinc-300 space-y-1">
                                {comp.ripcord?.map((rip, j) => (
                                  <li key={j}>• {rip}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-500 text-sm">No competitive intelligence available.</div>
                  )}
                </Card>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-zinc-400 mb-4">Select a call and click "Generate Prep" to get started.</div>
                <button onClick={generatePrep} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700">
                  Generate Prep
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
    </ErrorBoundary>
  );
}