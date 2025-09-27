import { useState } from "react";
import SalesCoachModal from "../SalesCoachModal";

export default function OpusPartnerCircle() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI Partner"
        className="grid place-items-center rounded-full h-16 w-16 mx-auto
                   bg-gradient-to-tr from-opus-cyan to-opus-violet shadow-lg
                   ring-2 ring-white/10 hover:scale-105 transition-transform
                   animate-pulse"
        data-testid="partner-circle"
      >
        <span className="text-white text-xl font-bold">🧠</span>
      </button>
      
      {/* Use existing SalesCoachModal in drawer mode */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="fixed right-0 top-0 z-50 h-full w-[360px] bg-slate-900 border-l border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="font-semibold text-white">Opus Coach</div>
              <button 
                onClick={() => setOpen(false)} 
                className="opacity-70 hover:opacity-100 text-white"
                data-testid="close-partner-drawer"
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(100vh-60px)] overflow-hidden">
              <SalesCoachModal 
                isOpen={true} 
                onClose={() => setOpen(false)}
                eventId={undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}