export default function OpusInsights() {
  const attained = 480_000;
  const target = 1_000_000;
  const pct = Math.min(100, Math.round((attained / target) * 100));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 backdrop-blur shadow-card">
        <h3 className="mb-2 text-opus-cyan font-semibold">Quarter insights</h3>
        <div className="text-xl font-bold">
          ${(attained/1000).toFixed(0)}K 
          <span className="text-slate-300/70 text-base"> / $1M target</span>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-white/10">
          <div 
            className="h-2 rounded-full bg-gradient-to-r from-opus-cyan to-opus-violet" 
            style={{ width: `${pct}%` }} 
          />
        </div>
        <div className="mt-2 text-xs text-slate-400">You're top 20% in your segment!</div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 backdrop-blur shadow-card">
        <h3 className="mb-2 text-opus-cyan font-semibold">Streaks</h3>
        <div className="text-sm">3 days in a row</div>
        <div className="text-xs opacity-70 flex items-center gap-1">
          <span className="text-opus-cyan">••</span> Follow-Up Streak
        </div>
      </div>
    </div>
  );
}