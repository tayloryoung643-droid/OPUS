import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SalesCoachProvider } from "@/contexts/SalesCoachContext";
import OpusAgenda from "@/pages/OpusAgenda";
import LegacyApp from "./LegacyApp";

const ENABLE_OPUS = import.meta.env.VITE_ENABLE_OPUS_UI === "true";

function Router() {
  if (ENABLE_OPUS) return <OpusAgenda />;
  return <LegacyApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SalesCoachProvider>
          <Toaster />
          <Router />
        </SalesCoachProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
