import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Calendar, Building2, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/ui/navigation";
import ExecutiveSummary from "@/components/call-prep/executive-summary";
import CrmHistory from "@/components/call-prep/crm-history";
import CompetitiveLandscape from "@/components/call-prep/competitive-landscape";
import KeyStakeholders from "@/components/call-prep/key-stakeholders";
import RecentNews from "@/components/call-prep/recent-news";
import SuggestedOpportunities from "@/components/call-prep/suggested-opportunities";

interface CallDetails {
  call: {
    id: string;
    title: string;
    scheduledAt: string;
    status: string;
    callType?: string;
    stage?: string;
  };
  company: {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
    description?: string;
    recentNews?: string[];
  } | null;
  contacts: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    role?: string;
  }>;
  callPrep: {
    id: string;
    executiveSummary?: string;
    crmHistory?: string;
    competitiveLandscape?: {
      primaryCompetitors: Array<{
        name: string;
        strengths: string[];
        weaknesses: string[];
        ourAdvantage: string;
      }>;
    };
    conversationStrategy?: string;
    dealRisks?: string[];
    immediateOpportunities?: string[];
    strategicExpansion?: string[];
    isGenerated: boolean;
  } | null;
}

interface CalendarCallEnsureResult extends CallDetails {
  source?: "calendar";
  calendarEvent?: {
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
  };
}

export default function CallPrep() {
  const [, params] = useRoute("/call/:id");
  const [, navigate] = useLocation();
  const callId = params?.id;
  const { toast } = useToast();

  const isCalendarSelection = !!callId && callId.startsWith("calendar_");
  const calendarEventId = isCalendarSelection ? callId.replace(/^calendar_/, "") : null;

  const {
    data: ensuredCalendarCall,
    isLoading: ensuringCalendarCall,
    error: ensureCalendarError,
  } = useQuery<CalendarCallEnsureResult>({
    queryKey: ["calendar-event-call", calendarEventId],
    enabled: !!calendarEventId,
    queryFn: async () => {
      const response = await apiRequest("POST", `/api/calendar/events/${calendarEventId}/ensure-call`);
      return (await response.json()) as CalendarCallEnsureResult;
    },
    staleTime: 30_000,
  });

  const resolvedCallId = isCalendarSelection ? ensuredCalendarCall?.call?.id : callId;

  const {
    data: callDetails,
    isLoading: callDetailsLoading,
    error: callDetailsError,
  } = useQuery<CallDetails>({
    queryKey: ["/api/calls", resolvedCallId],
    enabled: !!resolvedCallId,
    initialData: () => {
      if (isCalendarSelection && ensuredCalendarCall?.call?.id) {
        return ensuredCalendarCall;
      }
      return undefined;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isCalendarSelection && ensuredCalendarCall?.call?.id) {
      queryClient.setQueryData(["/api/calls", ensuredCalendarCall.call.id], ensuredCalendarCall);
      navigate(`/call/${ensuredCalendarCall.call.id}`, { replace: true });
    }
  }, [isCalendarSelection, ensuredCalendarCall, navigate]);

  // Generate AI prep mutation
  const generatePrepMutation = useMutation({
    mutationFn: async (targetCallId: string) => {
      const response = await apiRequest("POST", `/api/calls/${targetCallId}/generate-prep`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "AI prep generated",
        description: "Your call preparation sheet has been updated with AI insights.",
      });
      queryClient.setQueryData(["/api/calls", data.call.id], data);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate AI preparation: " + (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const combinedError = (ensureCalendarError as Error | null) || (callDetailsError as Error | null);
  const isLoading =
    (isCalendarSelection && (ensuringCalendarCall || !resolvedCallId)) || callDetailsLoading;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <Skeleton className="h-8 w-96 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (combinedError || !callDetails) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="p-6">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Call Not Found</h1>
            <p className="text-muted-foreground">The requested call could not be found or an error occurred.</p>
          </div>
        </div>
      </div>
    );
  }

  const { call, company, contacts, callPrep } = callDetails;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2" data-testid={`text-call-title-${call.id}`}>
                  {call.title}
                </h1>
                <div className="flex items-center space-x-4 text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span data-testid={`text-call-date-${call.id}`}>{formatDate(call.scheduledAt)}</span>
                  </div>
                  {company && (
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4" />
                      <span data-testid={`text-company-name-${call.id}`}>{company.name}</span>
                    </div>
                  )}
                  <Badge variant="secondary" data-testid={`badge-call-status-${call.id}`}>
                    {call.status}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {!callPrep?.isGenerated && (
                  <Button
                    onClick={() => resolvedCallId && generatePrepMutation.mutate(resolvedCallId)}
                    disabled={generatePrepMutation.isPending || !resolvedCallId}
                    className="flex items-center space-x-2"
                    data-testid="button-generate-prep"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{generatePrepMutation.isPending ? "Generating..." : "Generate AI Prep"}</span>
                  </Button>
                )}
                {callPrep?.isGenerated && (
                  <Button
                    onClick={() => resolvedCallId && generatePrepMutation.mutate(resolvedCallId)}
                    disabled={generatePrepMutation.isPending || !resolvedCallId}
                    variant="outline"
                    className="flex items-center space-x-2"
                    data-testid="button-regenerate-prep"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{generatePrepMutation.isPending ? "Regenerating..." : "Regenerate Prep"}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* No Prep State */}
          {!callPrep && (
            <Card className="mb-8">
              <CardContent className="p-8 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Preparation Available</h2>
                <p className="text-muted-foreground mb-4">
                  Generate AI-powered call preparation to get insights, research, and conversation strategies.
                </p>
                <Button
                  onClick={() => resolvedCallId && generatePrepMutation.mutate(resolvedCallId)}
                  disabled={generatePrepMutation.isPending || !resolvedCallId}
                  data-testid="button-generate-initial-prep"
                >
                  {generatePrepMutation.isPending ? "Generating..." : "Generate AI Prep"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Main Content Grid */}
          {callPrep && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                <ExecutiveSummary summary={callPrep.executiveSummary} contacts={contacts} company={company} />
                <CrmHistory history={callPrep.crmHistory} />
                <CompetitiveLandscape landscape={callPrep.competitiveLandscape} />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <KeyStakeholders contacts={contacts} />
                <RecentNews news={company?.recentNews || []} />
                <SuggestedOpportunities 
                  immediate={callPrep.immediateOpportunities || []}
                  strategic={callPrep.strategicExpansion || []}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
