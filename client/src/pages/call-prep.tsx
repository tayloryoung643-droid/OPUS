import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Calendar, Building2, NotebookPen } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/ui/navigation";
import ExecutiveSummary from "@/components/call-prep/executive-summary";
import CrmHistory from "@/components/call-prep/crm-history";
import CompetitiveLandscape from "@/components/call-prep/competitive-landscape";
import KeyStakeholders from "@/components/call-prep/key-stakeholders";
import RecentNews from "@/components/call-prep/recent-news";
import SuggestedOpportunities from "@/components/call-prep/suggested-opportunities";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PrepSheetView } from "@/features/prep-sheet/PrepSheetView";

interface CallDetails {
  call: {
    id: string;
    title: string;
    scheduledAt: string;
    status: string;
    callType?: string;
    stage?: string;
    companyId?: string | null;
    calendarEventId?: string | null;
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

interface CalendarCallEnsureResult extends CallDetails {
  source?: "calendar";
}

export default function CallPrep() {
  const [, params] = useRoute("/call/:id");
  const [, navigate] = useLocation();
  const callId = params?.id;
  const { toast } = useToast();

  const isCalendarSelection = !!callId && callId.startsWith("calendar_");
  const calendarEventId = isCalendarSelection ? callId.replace(/^calendar_/, "") : null;
  const [prepSheetEventId, setPrepSheetEventId] = useState<string | null>(calendarEventId);
  const [isPrepSheetOpen, setIsPrepSheetOpen] = useState<boolean>(false);

  const {
    data: ensuredCalendarCall,
    isLoading: ensuringCalendarCall,
    error: ensureCalendarError,
  } = useQuery<CalendarCallEnsureResult>({
    queryKey: ["calendar-event-call", calendarEventId],
    enabled: !!calendarEventId,
    queryFn: async () => {
      const response = await apiRequest("POST", `/api/calendar/events/${calendarEventId}/ensure-call`);
      const contentType = response.headers.get("content-type");
      
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Expected JSON response but got ${contentType}. Response: ${text.substring(0, 200)}`);
      }
      
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

  useEffect(() => {
    if (ensuredCalendarCall?.calendarEvent?.id) {
      setPrepSheetEventId(ensuredCalendarCall.calendarEvent.id);
    }
  }, [ensuredCalendarCall?.calendarEvent?.id]);

  useEffect(() => {
    if (callDetails?.calendarEvent?.id) {
      setPrepSheetEventId(callDetails.calendarEvent.id);
    } else if (callDetails?.call?.calendarEventId) {
      setPrepSheetEventId(callDetails.call.calendarEventId);
    }
  }, [callDetails]);

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

  const hasCompanyContext = !!callDetails?.company;
  const isCalendarSourcedCall = !hasCompanyContext || !!prepSheetEventId;
  const shouldRenderPrepSheet = isCalendarSourcedCall && !!prepSheetEventId;

  useEffect(() => {
    if (shouldRenderPrepSheet) {
      setIsPrepSheetOpen(true);
    }
  }, [shouldRenderPrepSheet, prepSheetEventId]);

  const handleGenerateLegacyPrep = (targetCallId: string | null | undefined) => {
    if (!targetCallId || !hasCompanyContext) {
      return;
    }
    generatePrepMutation.mutate(targetCallId);
  };

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
                {shouldRenderPrepSheet && (
                  <Button
                    onClick={() => setIsPrepSheetOpen(true)}
                    className="flex items-center space-x-2"
                    disabled={!prepSheetEventId}
                    data-testid="button-open-prep-sheet"
                  >
                    <NotebookPen className="h-4 w-4" />
                    <span>Open Prep Sheet</span>
                  </Button>
                )}
                {!shouldRenderPrepSheet && !callPrep?.isGenerated && (
                  <Button
                    onClick={() => handleGenerateLegacyPrep(resolvedCallId)}
                    disabled={generatePrepMutation.isPending || !resolvedCallId || !hasCompanyContext}
                    className="flex items-center space-x-2"
                    data-testid="button-generate-prep"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{generatePrepMutation.isPending ? "Generating..." : "Generate AI Prep"}</span>
                  </Button>
                )}
                {!shouldRenderPrepSheet && callPrep?.isGenerated && (
                  <Button
                    onClick={() => handleGenerateLegacyPrep(resolvedCallId)}
                    disabled={generatePrepMutation.isPending || !resolvedCallId || !hasCompanyContext}
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

          {shouldRenderPrepSheet ? (
            <>
              <Card className="mb-8">
                <CardContent className="p-8 text-center space-y-4">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h2 className="text-xl font-semibold">Calendar prep sheet available</h2>
                  <p className="text-muted-foreground">
                    This meeting comes from your calendar. Use the prep sheet to capture notes and enrich the call with CRM
                    context.
                  </p>
                  <Button onClick={() => setIsPrepSheetOpen(true)} disabled={!prepSheetEventId}>
                    View prep sheet
                  </Button>
                </CardContent>
              </Card>

              <Sheet open={isPrepSheetOpen} onOpenChange={setIsPrepSheetOpen}>
                <SheetContent
                  side="right"
                  className="w-full overflow-y-auto sm:max-w-3xl"
                  aria-describedby={undefined}
                >
                  <SheetHeader>
                    <SheetTitle>Prep sheet</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 pb-10">
                    {prepSheetEventId ? (
                      <PrepSheetView eventId={prepSheetEventId} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Unable to load prep sheet without a calendar event.</p>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <>
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
                      onClick={() => handleGenerateLegacyPrep(resolvedCallId)}
                      disabled={generatePrepMutation.isPending || !resolvedCallId || !hasCompanyContext}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
