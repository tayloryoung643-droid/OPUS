import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Calendar, Building2, Clock, FileText, Users, AlertTriangle } from "lucide-react";
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

// Extended interface for partial mode responses from Account Resolver
interface PartialPrepResponse {
  mode: 'partial';
  sheet: {
    notesSectionFirst: boolean;
    banner: string;
    eventSummary: {
      title: string;
      start: string;
      end?: string | null;
      location?: string | null;
    };
    attendees: Array<{
      email: string;
      name?: string;
      status?: string;
    }>;
    organizer?: {
      email: string;
      displayName?: string;
    };
    agendaFromInvite: string[];
    actionItems: string[];
    risks: string[];
  };
  needsSelection: boolean;
  candidates: Array<{
    company?: {
      id: string;
      name: string;
      domain?: string;
      industry?: string;
    };
    contacts: Array<{
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
    }>;
    confidence: number;
    matchType: string;
    matchDetails: string;
  }>;
}

// Union type for API responses
type GeneratePrepResponse = CallDetails | PartialPrepResponse;

// Interface for user notes
interface UserNote {
  text: string;
  updatedAt: string | null;
}

// Simple debounce utility
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), wait);
  }) as T;
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
  
  // State for partial mode and notes
  const [partialPrepData, setPartialPrepData] = useState<PartialPrepResponse | null>(null);
  const [notesText, setNotesText] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

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

  // User notes query and mutation
  const { data: userNote } = useQuery<UserNote>({
    queryKey: ["/api/prep-notes", resolvedCallId],
    queryFn: async () => {
      if (!resolvedCallId) return { text: "", updatedAt: null };
      const response = await apiRequest("GET", `/api/prep-notes?eventId=${resolvedCallId}`);
      return response.json();
    },
    enabled: !!resolvedCallId,
  });

  const saveNotesMutation = useMutation({
    mutationFn: async ({ eventId, text }: { eventId: string; text: string }) => {
      const response = await apiRequest("PUT", "/api/prep-notes", { eventId, text });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prep-notes", resolvedCallId] });
    },
  });

  // Debounced notes save
  const debouncedSaveNotes = useCallback(
    debounce((text: string) => {
      if (resolvedCallId) {
        saveNotesMutation.mutate({ eventId: resolvedCallId, text });
      }
    }, 1000),
    [resolvedCallId]
  );

  // Sync notes text with fetched data
  useEffect(() => {
    if (userNote?.text && notesText !== userNote.text) {
      setNotesText(userNote.text);
    }
  }, [userNote?.text]);

  // Auto-save notes on text change
  useEffect(() => {
    if (notesText !== (userNote?.text || "")) {
      debouncedSaveNotes(notesText);
    }
  }, [notesText, userNote?.text, debouncedSaveNotes]);

  // Generate AI prep mutation (updated to handle partial responses)
  const generatePrepMutation = useMutation({
    mutationFn: async (targetCallId: string) => {
      const response = await apiRequest("POST", `/api/calls/${targetCallId}/generate-prep`);
      return response.json() as Promise<GeneratePrepResponse>;
    },
    onSuccess: (data) => {
      if ('mode' in data && data.mode === 'partial') {
        // Handle partial response
        setPartialPrepData(data);
        toast({
          title: "Prep sheet ready",
          description: data.candidates.length > 0 
            ? `Found ${data.candidates.length} account suggestion(s). Link an account for full AI insights.`
            : "Basic prep sheet ready. Link an account for AI insights.",
        });
      } else {
        // Handle full response
        setPartialPrepData(null);
        toast({
          title: "AI prep generated",
          description: "Your call preparation sheet has been updated with AI insights.",
        });
        // Only update query data for full responses that have call.id
        if ('call' in data && data.call?.id) {
          queryClient.setQueryData(["/api/calls", data.call.id], data);
        }
      }
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

  // Handle account candidate selection
  const selectCandidateMutation = useMutation({
    mutationFn: async ({ callId, companyId }: { callId: string; companyId: string }) => {
      // In a real app, this would link the call to the company
      // For now, we'll simulate this by updating the call
      const response = await apiRequest("PATCH", `/api/calls/${callId}`, { companyId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account linked",
        description: "Company has been linked to this call. Generate AI prep for full insights.",
      });
      setPartialPrepData(null);
      queryClient.invalidateQueries({ queryKey: ["/api/calls", resolvedCallId] });
    },
  });

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

          {/* Partial Prep Mode */}
          {partialPrepData && (
            <>
              {/* Banner Alert */}
              <Alert className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{partialPrepData.sheet.banner}</AlertDescription>
              </Alert>

              {/* Account Candidates */}
              {partialPrepData.candidates.length > 0 && (
                <Card className="mb-6">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Building2 className="h-5 w-5 mr-2" />
                      Account Suggestions
                    </h3>
                    <div className="space-y-3">
                      {partialPrepData.candidates.map((candidate, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-medium">{candidate.company?.name || 'Unknown Company'}</div>
                            <div className="text-sm text-muted-foreground">
                              {candidate.matchDetails} ({candidate.confidence}% confidence)
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {candidate.contacts.length} contact(s) • {candidate.matchType.replace('_', ' ')}
                            </div>
                          </div>
                          <Button 
                            size="sm"
                            onClick={() => candidate.company && selectCandidateMutation.mutate({ 
                              callId: resolvedCallId!, 
                              companyId: candidate.company.id 
                            })}
                            disabled={selectCandidateMutation.isPending}
                            data-testid={`button-select-candidate-${index}`}
                          >
                            Link Account
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes Section (appears first in partial mode) */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Your Notes
                  </h3>
                  <Textarea
                    placeholder="Add your notes for this call..."
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className="min-h-[120px]"
                    data-testid="textarea-prep-notes"
                  />
                  {saveNotesMutation.isPending && (
                    <div className="text-xs text-muted-foreground mt-2">Saving...</div>
                  )}
                </CardContent>
              </Card>

              {/* Event Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Attendees
                    </h3>
                    <div className="space-y-2">
                      {partialPrepData.sheet.attendees.map((attendee, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <div className="text-sm">
                            <div className="font-medium">{attendee.name || attendee.email}</div>
                            {attendee.name && (
                              <div className="text-muted-foreground">{attendee.email}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {partialPrepData.sheet.attendees.length === 0 && (
                        <div className="text-sm text-muted-foreground">No attendees found</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Meeting Agenda</h3>
                    <div className="space-y-2">
                      {partialPrepData.sheet.agendaFromInvite.map((item, index) => (
                        <div key={index} className="text-sm">• {item}</div>
                      ))}
                      {partialPrepData.sheet.agendaFromInvite.length === 0 && (
                        <div className="text-sm text-muted-foreground">No agenda items found</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* No Prep State */}
          {!callPrep && !partialPrepData && (
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
                {/* User Notes */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Your Notes
                    </h3>
                    <Textarea
                      placeholder="Add your notes for this call..."
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      className="min-h-[100px] mb-2"
                      data-testid="textarea-prep-notes-full"
                    />
                    {saveNotesMutation.isPending && (
                      <div className="text-xs text-muted-foreground">Saving...</div>
                    )}
                  </CardContent>
                </Card>
                
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
