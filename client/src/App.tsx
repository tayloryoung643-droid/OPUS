import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { SalesCoachProvider } from "@/contexts/SalesCoachContext";
import { Brain } from "lucide-react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Settings from "@/pages/settings";
import Navigation from "@/components/ui/navigation";
import CalendarView from "@/components/CalendarView";
import PrepSheetView from "@/components/PrepSheetView";
import SalesCoachModal from "@/components/SalesCoachModal";
import { useAuth } from "@/hooks/useAuth";

interface CallWithCompany {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  callType?: string;
  stage?: string;
  source?: "database" | "calendar";
  calendarEventId?: string;
  company: {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
  };
}

function MainDashboard() {
  const [selectedEvent, setSelectedEvent] = useState<CallWithCompany | null>(null);
  const [isCoachOpen, setCoachOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <header className="flex justify-between items-center p-4 border-b bg-card">
            <h1 className="text-xl font-bold">Momentum AI</h1>
            <Button
              onClick={() => setCoachOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center space-x-2"
              data-testid="button-ai-sales-coach"
            >
              <Brain className="h-4 w-4" />
              <span>AI Sales Coach</span>
            </Button>
          </header>

          <PrepSheetView event={selectedEvent} />
        </div>

        {/* Calendar pinned right */}
        <CalendarView onSelectEvent={setSelectedEvent} />
      </div>

      {/* Sales Coach Modal */}
      <SalesCoachModal 
        isOpen={isCoachOpen} 
        onClose={() => setCoachOpen(false)}
        eventId={selectedEvent?.id}
      />
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={MainDashboard} />
          <Route path="/dashboard" component={MainDashboard} />
          <Route path="/settings" component={Settings} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
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
