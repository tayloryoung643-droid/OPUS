import React from "react";

// Ensure the Opus Logo asset is placed in /public (e.g. /public/opus-logo.svg)
// Using the SVG wordmark ensures crisp rendering.
export default function OpusLandingPage() {
  // --- Mock data (replace with real services) ---
  const agenda = [
    { time: "9:00 AM", title: "Momentum AI", subtitle: "Discovery call" },
    { time: "11:45 AM", title: "Jamie’s Birthday", subtitle: "Jamie’s Birthday" },
    { time: "3:00 PM", title: "Orthodontist", subtitle: "Orthodontist" },
  ];

  const proactive = [
    "I reviewed your pipeline — we’ll need to do some prospecting today to stay on pace for target",
    "Drafted 4 follow‑up emails — please review and send",
    "Produced 5 call prep sheets",
    "Heads up: 1‑1 with Director today — I drafted a prep sheet and your accomplishments for the quarter",
  ];

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
          {['Overview','Agenda','Pipeline','Tasks','Coach','Insights'].map((tab) => (
            <a
              key={tab}
              href="#"
              className={`relative ${tab==='Overview' ? 'text-white font-semibold' : 'hover:text-white'}`}
            >
              {tab}
              {tab==='Overview' && (
                <span className="absolute left-0 -bottom-1 h-0.5 w-full bg-purple-500 animate-pulse rounded-full"></span>
              )}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3 md:gap-4">
          <button className="text-sm px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300">Settings</button>
        </div>
      </header>

      {/* Hero grid */}
      <main className="px-6 md:px-16 lg:px-20 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12 items-start">
          {/* Left: Greeting, Agenda, Rhythm */}
          <section className="space-y-6 lg:space-y-8">
            {/* Greeting */}
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight font-sans">
                Good morning,
                <br />
                Taylor
              </h1>
              <p className="text-zinc-400 mt-1.5 md:mt-2 text-base md:text-lg font-medium font-sans">Let’s set the rhythm for your day.</p>
            </div>

            {/* Cards row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Agenda */}
              <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Today’s Agenda</h2>
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
              </div>

              {/* Rhythm */}
              <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Rhythm</h2>
                <ul className="space-y-3 text-zinc-300">
                  <li className="flex items-start gap-3"><span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-zinc-500"/><span>Back‑to‑back meetings from 10–4 — grab a snack before</span></li>
                  <li className="flex items-start gap-3"><span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-zinc-500"/><span>3 calls prepped — keep the streak alive</span></li>
                  <li className="flex items-start gap-3"><span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-zinc-500"/><span>1 high‑stakes deal at 2 PM — review the risk questions</span></li>
                </ul>
              </div>
            </div>
          </section>

          {/* Right: Big Orb + Proactive Chat */}
          <aside>
            <div className="mx-auto max-w-lg">
              {/* Slightly smaller Orb */}
              <div className="relative grid place-items-center">
                <div className="h-56 w-56 md:h-72 md:w-72 rounded-full border-2 border-purple-500/70 animate-pulse shadow-[0_0_120px_-20px_rgba(168,85,247,0.7)]" />
              </div>

              {/* Chat box under the orb */}
              <div className="mt-6 rounded-2xl border border-zinc-900/70 bg-black p-5">
                <div className="text-sm text-zinc-400 mb-2">Opus → Taylor</div>
                <div className="space-y-3">
                  {proactive.map((line, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-zinc-900/60 bg-zinc-950/60 px-3 py-2 text-sm italic text-white">
                      <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                      <span>{line}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-900/60 bg-zinc-950/60 px-3 py-2 text-sm italic text-white">
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                    <span>Just tap me if you need help on a call — I’ll nudge you in the right direction.</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-900/60 bg-zinc-950/60 px-3 py-2 text-sm italic text-white">
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                    <span>We got this!</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Refined bottom strip: Elegant insights */}
        <section className="mt-10 md:mt-14 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quarter Overview */}
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">Quarter Overview</h3>
            <div className="text-3xl font-light tracking-tight">$480K <span className="text-zinc-500 text-base">/ $1M target</span></div>
            <div className="mt-4 h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-600 to-fuchsia-600" style={{ width: "48%" }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm text-zinc-400">
              <div><div className="text-zinc-200 font-medium">20%</div><div className="mt-0.5">Segment rank</div></div>
              <div><div className="text-zinc-200 font-medium">7</div><div className="mt-0.5">Active opps</div></div>
              <div><div className="text-zinc-200 font-medium">$1.9M</div><div className="mt-0.5">Pipeline</div></div>
            </div>
          </div>

          {/* Momentum (less gamey, more elegant) */}
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">Momentum</h3>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li className="flex items-center justify-between"><span>Win rate (QTD)</span><span className="text-zinc-100 font-medium">28%</span></li>
              <li className="flex items-center justify-between"><span>Avg. cycle length</span><span className="text-zinc-100 font-medium">32 days</span></li>
              <li className="flex items-center justify-between"><span>Next step recommendations</span><span className="text-zinc-100 font-medium">2 ready</span></li>
            </ul>
            <div className="mt-4 text-xs text-zinc-500">Curated by Opus from CRM + calendar signals</div>
          </div>
        </section>
      </main>
    </div>
  );
}
