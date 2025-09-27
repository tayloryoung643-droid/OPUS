import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SalesCoachProvider } from "@/contexts/SalesCoachContext";
import { Switch, Route, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import OpusAgenda from "@/pages/OpusAgenda";
import Landing from "@/pages/landing";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import LegacyApp from "./LegacyApp";
import OpusOrb from "@/components/OpusOrb";
import SalesCoachModal from "@/components/SalesCoachModal";
import OpusHomePage from "@/components/OpusHomePage";

const ENABLE_OPUS = import.meta.env.VITE_ENABLE_OPUS_UI === "true";

function OpusMainDashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect unauthenticated users to landing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-indigo-900/80 to-violet-900/60 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  return <OpusAgenda />;
}

function OpusRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/opus" component={OpusHomePage} />
      <Route path="/dashboard" component={OpusMainDashboard} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  if (ENABLE_OPUS) return <OpusRouter />;
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
