type Props = { active: "Agenda"; onAgendaClick: () => void };

export default function OpusTopNav({ active, onAgendaClick }: Props) {
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
        <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-opus-cyan to-opus-violet" />
        <span className="text-xl font-semibold tracking-tight">Opus</span>
      </div>
      <nav className="flex items-center gap-2">
        <Tab name="Agenda" active={active === "Agenda"} onClick={onAgendaClick} />
        <Tab name="Pipeline" disabled />
        <Tab name="Tasks" disabled />
        <Tab name="Coach" disabled />
        <Tab name="Insights" disabled />
      </nav>
      <div className="flex items-center gap-3 opacity-70">
        <span className="text-sm">⚙️</span>
        <span className="text-sm">❓</span>
        <div className="h-7 w-7 rounded-full bg-slate-700" />
      </div>
    </header>
  );
}