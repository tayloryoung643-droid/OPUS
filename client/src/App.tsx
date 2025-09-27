import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SalesCoachProvider } from "@/contexts/SalesCoachContext";
import { Switch, Route, useLocation } from "wouter";
import OpusAgenda from "@/pages/OpusAgenda";
import Settings from "@/pages/settings";
import LegacyApp from "./LegacyApp";
import OpusOrb from "@/components/OpusOrb";
import SalesCoachModal from "@/components/SalesCoachModal";
import OpusHomePage from "@/pages/OpusHomePage";
import { ProtectedRoute, PublicGate } from "@/routes/guards";

const ENABLE_OPUS = import.meta.env.VITE_ENABLE_OPUS_UI === "true";

function OpusRouter() {
  return (
    <Switch>
      {/* Public landing: logged-in users get bounced to /dashboard */}
      <Route path="/">
        <PublicGate>
          <OpusHomePage />
        </PublicGate>
      </Route>

      {/* Optional: logged-in users shouldn't see /login */}
      <Route path="/login">
        <PublicGate>
          <OpusHomePage />
        </PublicGate>
      </Route>

      {/* Auth-only dashboard (Agenda) */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <OpusAgenda />
        </ProtectedRoute>
      </Route>

      {/* Auth-only settings */}
      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>

      {/* Fallback: anything unknown -> home gate (which will auto-redirect if authed) */}
      <Route path="/:rest*">
        <PublicGate>
          <OpusHomePage />
        </PublicGate>
      </Route>
    </Switch>
  );
}

function Router() {
  if (ENABLE_OPUS) return <OpusRouter />;
  return <LegacyApp />;
}

function App() {
  const [coachOpen, setCoachOpen] = useState(false);
  const [location] = useLocation();

  // Hide Opus Orb on public pages
  const shouldShowOrb = ENABLE_OPUS && location !== "/" && location !== "/login";

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SalesCoachProvider>
          <Toaster />
          <Router />
          {/* Persistent Opus Orb - hide on public home and login pages */}
          {shouldShowOrb && (
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
