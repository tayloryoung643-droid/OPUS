export default function OpusHeroGreeting({ firstName }: { firstName: string }) {
  return (
    <section className="my-6 rounded-2xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
            Good morning,<br />{firstName}
          </h1>
          <p className="mt-3 text-slate-300/80">
            Review your agenda and jump into prep when you're ready.
          </p>
        </div>
        {/* decorative gradient ring */}
        <div className="hidden md:block">
          <div
            className="h-36 w-36 rounded-full bg-opus-conic animate-spin-slow"
            style={{
              filter: "blur(0.3px)"
            }}
          />
        </div>
      </div>
    </section>
  );
}