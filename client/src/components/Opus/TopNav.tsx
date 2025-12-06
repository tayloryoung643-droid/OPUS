import { useState } from "react";
import SettingsModal from "../SettingsModal";

type Props = { active: "Agenda"; onAgendaClick: () => void };

export default function OpusTopNav({ active, onAgendaClick }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const Tab = ({
    name,
    active,
    onClick,
    disabled,
  }: { name: string; active?: boolean; onClick?: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active ? "text-opus-cyan" : "text-slate-300/80 hover:text-slate-100",
        disabled ? "opacity-40 cursor-not-allowed" : ""
      ].join(" ")}
      data-testid={`tab-${name.toLowerCase()}`}
    >
      {name}
    </button>
  );

  return (
    <header className="flex items-center justify-between py-5">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
            <rect x="8" y="8" width="2" height="8" rx="1" fill="currentColor" />
            <rect x="12" y="4" width="2" height="16" rx="1" fill="currentColor" />
            <rect x="16" y="10" width="2" height="6" rx="1" fill="currentColor" />
          </svg>
        </div>
        <span className="text-xl font-semibold tracking-tight">Opus</span>
      </div>
      <nav className="flex items-center gap-2">
        <Tab name="Agenda" active={active === "Agenda"} onClick={onAgendaClick} />
      </nav>
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg p-2 hover:bg-white/5 transition" 
          data-testid="button-settings"
        >
          <svg className="h-5 w-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button className="rounded-lg p-2 hover:bg-white/5 transition" data-testid="button-help">
          <svg className="h-5 w-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <div className="h-8 w-8 rounded-full bg-white/10" data-testid="avatar-user" />
      </div>
      
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />
    </header>
  );
}