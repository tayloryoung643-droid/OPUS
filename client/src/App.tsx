import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SalesCoachProvider } from "@/contexts/SalesCoachContext";
import OpusAgenda from "@/pages/OpusAgenda";
import LegacyApp from "./LegacyApp";
import OpusOrb from "@/components/OpusOrb";
import SalesCoachModal from "@/components/SalesCoachModal";

const ENABLE_OPUS = import.meta.env.VITE_ENABLE_OPUS_UI === "true";

function Router() {
  if (ENABLE_OPUS) return <OpusAgenda />;
  return <LegacyApp />;
}

function App() {
  const [coachOpen, setCoachOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SalesCoachProvider>
          <Toaster />
          <Router />
          {/* Persistent Opus Orb - only show in Opus mode */}
          {ENABLE_OPUS && (
            <>
              <OpusOrb onOpen={() => setCoachOpen(true)} />
              <SalesCoachModal 
                isOpen={coachOpen} 
                onClose={() => setCoachOpen(false)}
                eventId={undefined}
              />
            </>
          )}
        </SalesCoachProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
