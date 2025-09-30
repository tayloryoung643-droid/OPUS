import { Clock, Mail, TrendingUp } from "lucide-react";

const rhythmItems = [
  {
    icon: Clock,
    text: "Back-to-back meetings from 10–4 — grab a snack",
    emoji: "🍎"
  },
  {
    icon: Mail,
    text: "5 emails drafted for you - please review",
    emoji: "🔥"
  },
  {
    icon: TrendingUp,
    text: "2-hour gap this morning — perfect for follow-ups",
    emoji: "✉️"
  }
];

export default function OpusRhythm() {
  return (
    <div className="rounded-2xl bg-white/5 hover:bg-white/8 transition p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Rhythm</h2>
      <div className="space-y-3">
        {rhythmItems.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <div key={index} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
                <IconComponent className="h-3 w-3 text-white/70" />
              </div>
              <p className="text-sm text-white/80">
                {item.text} <span className="ml-1">{item.emoji}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}