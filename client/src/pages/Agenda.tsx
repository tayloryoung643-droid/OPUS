import OpusAgendaMock from "../features/agenda/OpusAgendaMock";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import OpusTopNav from "@/components/Opus/TopNav";
import OpusOrb from "@/components/Opus/OpusOrb";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CONFIG } from "@/config";

export default function Agenda() {
  const navigate = useNavigate();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (prefersDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return <OpusAgendaMock />;
}