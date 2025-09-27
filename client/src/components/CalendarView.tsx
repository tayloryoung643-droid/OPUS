import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CallSource = "database" | "calendar";

interface CallWithCompany {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  callType?: string;
  stage?: string;
  source?: CallSource;
  calendarEventId?: string;
  company: {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
  };
}

interface CalendarEvent {
  id: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
}

interface CalendarViewProps {
  onSelectEvent: (event: CallWithCompany) => void;
}

export default function CalendarView({ onSelectEvent }: CalendarViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingCalendarEventId, setPendingCalendarEventId] = useState<string | null>(null);
  const { toast } = useToast();

  // Check Google Calendar connection status
  const { data: googleStatus } = useQuery({
    queryKey: ["/api/integrations/google/status"],
    retry: false
  });

  // Fetch Google Calendar events (upcoming)
  const { data: calendarEvents, isLoading: calendarLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events"],
    enabled: !!(googleStatus as any)?.connected,
    retry: false
  });

  // Fetch database calls (from Salesforce sync)
  const { data: upcomingCalls = [], isLoading: upcomingLoading } = useQuery<CallWithCompany[]>({
    queryKey: ["/api/calls/upcoming"],
  });

  // Fetch previous calls
  const { data: previousCalls = [], isLoading: previousLoading } = useQuery<CallWithCompany[]>({
    queryKey: ["/api/calls/previous"],
  });

  const upcomingDatabaseCalls = Array.isArray(upcomingCalls)
    ? upcomingCalls.map((call) => ({ ...call, source: "database" as const }))
    : [];

  // Convert Google Calendar events to call format
  const upcomingCalendarEvents = Array.isArray(calendarEvents)
    ? calendarEvents.map((event) => ({
        id: `calendar_${event.id}`,
        calendarEventId: event.id,
        title: event.summary || "No Title",
        scheduledAt:
          event.start?.dateTime ||
          (event.start?.date ? new Date(`${event.start.date}T00:00:00Z`).toISOString() : new Date().toISOString()),
        status: "upcoming",
        callType: "meeting",
        source: "calendar" as const,
        company: {
          id: "google-calendar",
          name: "Google Calendar",
          domain: undefined,
          industry: undefined,
        },
      }))
    : [];

  // Combine all upcoming calls (database + Google Calendar)
  const allUpcomingCalls: CallWithCompany[] = [...upcomingDatabaseCalls, ...upcomingCalendarEvents];

  const filteredUpcomingCalls = allUpcomingCalls.filter(call =>
    call.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    call.company?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPreviousCalls = previousCalls.filter(call =>
    call.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    call.company?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isUpcomingLoading = upcomingLoading || calendarLoading;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCallTypeColor = (callType?: string) => {
    switch (callType) {
      case "demo":
        return "bg-blue-100 text-blue-800";
      case "discovery":
        return "bg-green-100 text-green-800";
      case "negotiation":
        return "bg-purple-100 text-purple-800";
      case "follow-up":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const ensureCalendarCallMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await apiRequest("POST", `/api/calendar/events/${eventId}/ensure-call`);
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setPendingCalendarEventId(null);
      // Instead of navigating, call onSelectEvent with the ensured call data
      if (data.call) {
        const callWithCompany: CallWithCompany = {
          id: data.call.id,
          title: data.call.title,
          scheduledAt: data.call.scheduledAt,
          status: data.call.status,
          callType: data.call.callType,
          stage: data.call.stage,
          source: "calendar",
          calendarEventId: data.calendarEvent?.id,
          company: data.company || {
            id: "google-calendar",
            name: "Google Calendar",
          },
        };
        onSelectEvent(callWithCompany);
      }
    },
    onError: (error: unknown) => {
      setPendingCalendarEventId(null);
      toast({
        title: "Unable to open calendar event",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleCalendarSelection = (call: CallWithCompany) => {
    if (!call.calendarEventId) return;
    setPendingCalendarEventId(call.calendarEventId);
    ensureCalendarCallMutation.mutate(call.calendarEventId);
  };

  const handleCallSelection = (call: CallWithCompany) => {
    const isCalendarCall = call.source === "calendar";
    
    if (isCalendarCall) {
      handleCalendarSelection(call);
    } else {
      onSelectEvent(call);
    }
  };

  return (
    <div className="w-80 bg-card border-r border-border p-6 h-full overflow-y-auto">
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Search calls..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-calls"
        />
      </div>

      {/* Upcoming Calls */}
      <div className="mb-8">
        <h3 className="font-semibold text-foreground mb-4" data-testid="text-upcoming-calls">Upcoming Calls</h3>
        
        {isUpcomingLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredUpcomingCalls.length === 0 ? (
          <p className="text-muted-foreground text-sm" data-testid="text-no-upcoming-calls">No upcoming calls found</p>
        ) : (
          <div className="space-y-3">
            {filteredUpcomingCalls.map((call, index) => {
              const isCalendarCall = call.source === "calendar";
              return (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => handleCallSelection(call)}
                  className="w-full text-left focus:outline-none"
                  disabled={
                    isCalendarCall && 
                    call.calendarEventId === pendingCalendarEventId &&
                    ensureCalendarCallMutation.isPending
                  }
                  data-testid={`button-select-call-${call.id}`}
                >
                  <Card
                    className={`transition-colors hover:bg-accent/50 cursor-pointer ${
                      index === 0 ? "bg-primary text-primary-foreground" : ""
                    } ${
                      isCalendarCall && call.calendarEventId === pendingCalendarEventId
                        ? "opacity-60 cursor-wait"
                        : ""
                    }`}
                    data-testid={`card-upcoming-call-${call.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold mb-1" data-testid={`text-call-title-${call.id}`}>
                          {call.title}
                        </h4>
                        {isCalendarCall && (
                          <Badge variant={index === 0 ? "outline" : "secondary"} className="text-xs">
                            Google Calendar
                          </Badge>
                        )}
                      </div>
                      <p
                        className={`text-sm mb-2 ${
                          index === 0 ? "text-primary-foreground/90" : "text-muted-foreground"
                        }`}
                      >
                        {call.company?.name}
                      </p>
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex items-center text-sm ${
                            index === 0 ? "text-primary-foreground/75" : "text-muted-foreground"
                          }`}
                        >
                          <Clock className="mr-2 h-3 w-3" />
                          <span data-testid={`text-call-time-${call.id}`}>{formatDate(call.scheduledAt)}</span>
                        </div>
                        {call.callType && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              index === 0
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : getCallTypeColor(call.callType)
                            }`}
                          >
                            {call.callType}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Previous Calls */}
      <div>
        <h3 className="font-semibold text-foreground mb-4" data-testid="text-previous-calls">Previous Calls</h3>
        
        {previousLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredPreviousCalls.length === 0 ? (
          <p className="text-muted-foreground text-sm" data-testid="text-no-previous-calls">No previous calls found</p>
        ) : (
          <div className="space-y-3">
            {filteredPreviousCalls.map((call) => (
              <button
                key={call.id}
                type="button"
                onClick={() => handleCallSelection(call)}
                className="w-full text-left focus:outline-none"
                data-testid={`button-select-previous-call-${call.id}`}
              >
                <Card className="cursor-pointer transition-colors hover:bg-accent/50" data-testid={`card-previous-call-${call.id}`}>
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-1" data-testid={`text-call-title-${call.id}`}>
                      {call.title}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {call.company?.name}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="mr-2 h-3 w-3" />
                        <span data-testid={`text-call-time-${call.id}`}>{formatDate(call.scheduledAt)}</span>
                      </div>
                      {call.callType && (
                        <Badge variant="secondary" className={`text-xs ${getCallTypeColor(call.callType)}`}>
                          {call.callType}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}