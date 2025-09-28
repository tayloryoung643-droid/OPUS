export default function OpusHeroGreeting({ firstName }: { firstName: string }) {
  return (
    <section className="my-6 rounded-2xl bg-white/5 hover:bg-white/8 transition p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-6xl leading-[1.05] font-bold text-white">
            Good morning,<br />{firstName}
          </h1>
          <p className="mt-2 text-lg text-white/90 font-medium">
            Opus... Your AI Sales Partner
          </p>
          <p className="mt-3 text-white/70">
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