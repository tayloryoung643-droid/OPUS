import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * OpusCoachPanel.jsx
 * One-file mock you can drop into your app to preview the new landing experience:
 * - Removes legacy “AI Sales Coach” modal/bubble (handled by Agent 3 prompt)
 * - Uses the Opus Orb as the ONLY coach affordance (pinned on the right)
 * - Renders the bullet list and an inline chat panel the user can type into
 * - Local, functioning chat loop (stubbed). Swap the stub for your API later.
 *
 * Styling: TailwindCSS.
 */

const bullets = [
  "I reviewed your pipeline — we'll need to do some prospecting today to stay on pace for target",
  "Drafted 4 follow-up emails — please review and send",
  "Produced 5 call prep sheets",
  "Heads up: 1-1 with Director today — I drafted a prep sheet and your accomplishments for the quarter",
  "Just tap me if you need help on a call — I'll nudge you in the right direction.",
  "We got this!",
];

        

// --- Simple chat stub ----------------------------------------------------------
function useStubbedChat() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Hi! I’m Opus. Ask me anything — objection handling, call prep, or next-step strategy." },
  ]);
  const [pending, setPending] = useState(false);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setPending(true);

    // Swap this block with your real API call later.
    await new Promise((r) => setTimeout(r, 650));
    const reply = `Got it. Here’s a quick suggestion: ${trimmed.includes("objection") ? "Acknowledge, ask a calibrating question, then reframe with quantified value." : "Lead with an agenda, confirm success criteria, and secure a time-bound next step."}`;

    setMessages((m) => [...m, { role: "assistant", text: reply }]);
    setPending(false);
  };

  return { messages, send, pending } as const;
}

// --- Chat UI -------------------------------------------------------------------
function ChatPanel() {
  const { messages, send, pending } = useStubbedChat();
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput("");
    send(text);
  };

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 md:p-5 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
      <div className="text-sm text-white/70 mb-3 italic">Chat with Opus</div>
      <div className="max-h-72 overflow-y-auto pr-1 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2 text-[0.95rem] leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-white/10 text-white ring-1 ring-white/15"
                : "bg-black/60 text-white ring-1 ring-white/10"
            }`}>{m.text}</div>
          </div>
        ))}
        {pending && (
          <div className="text-white/60 text-sm">Opus is thinking…</div>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Opus anything…"
          className="flex-1 bg-black/50 text-white placeholder-white/40 rounded-xl px-3 py-2 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-white/25"
        />
        <button
          type="submit"
          className="rounded-xl px-4 py-2 bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// --- Bullet list ---------------------------------------------------------------
function OpusBullets() {
  return (
    <div className="mt-6 space-y-3">
      <div className="text-white/60 text-sm italic">Opus → Taylor</div>
      {bullets.map((b, i) => (
        <div key={i} className="relative rounded-2xl bg-black/60 ring-1 ring-white/10 text-white p-4">
          <span className="absolute left-2 top-1.5 inline-block h-2 w-2 rounded-full bg-white/90 animate-pulse" />
          <div className="pl-3">{b}</div>
        </div>
      ))}
    </div>
  );
}

// --- Whole section -------------------------------------------------------------
export default function OpusCoachPanel() {
  return (
    <div className="relative min-h-[80vh] w-full bg-black text-white">
      {/* Background sheen */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_30%_20%,rgba(168,85,247,0.15),transparent_60%),radial-gradient(40%_30%_at_70%_70%,rgba(59,130,246,0.12),transparent_60%)]" />

      {/* Content */}
      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-12">
        {/* Big orb hero (hover glow) */}
        <div className="mx-auto h-64 w-64 rounded-full relative group cursor-pointer">
          <div className="absolute inset-0 rounded-full bg-black ring-1 ring-white/15 transition-all duration-300 group-hover:ring-white/40 group-hover:scale-[1.02]" />
          <div className="absolute -inset-6 rounded-full blur-3xl bg-fuchsia-500/10 animate-pulse transition-opacity duration-300 group-hover:opacity-80" />
          {/* extra glow on hover */}
          <div className="absolute -inset-10 rounded-full blur-[44px] bg-gradient-to-br from-fuchsia-500/20 via-indigo-500/15 to-cyan-400/15 opacity-0 transition-opacity duration-300 group-hover:opacity-70" />
        </div>

        {/* Bullets then Chat */}
        <OpusBullets />
        <ChatPanel />
      </div>

      
    </div>
  );
}
