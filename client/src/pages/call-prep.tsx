import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Calendar, Building2, Clock, FileText, Users, AlertTriangle, Zap, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/ui/navigation";
import ExecutiveSummary from "@/components/call-prep/executive-summary";
import CrmHistory from "@/components/call-prep/crm-history";
import CompetitiveLandscape from "@/components/call-prep/competitive-landscape";
import KeyStakeholders from "@/components/call-prep/key-stakeholders";
import RecentNews from "@/components/call-prep/recent-news";
import SuggestedOpportunities from "@/components/call-prep/suggested-opportunities";
import SPINQuestions from "@/components/call-prep/methodology/SPINQuestions";
import MEDDICChecklist from "@/components/call-prep/methodology/MEDDICChecklist";
import BANTAssessment from "@/components/call-prep/methodology/BANTAssessment";
import ChallengerInsights from "@/components/call-prep/methodology/ChallengerInsights";
import ObjectionHandling from "@/components/call-prep/methodology/ObjectionHandling";
import MethodologySummary from "@/components/call-prep/methodology/MethodologySummary";
import { SalesCoachLauncher } from "@/components/coach/SalesCoachLauncher";
import { SalesCoachPanel } from "@/components/coach/SalesCoachPanel";

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
    // Enhanced methodology data
    methodologyData?: {
      executiveSummary: string;
      customerProfile: {
        industryBackground: string;
        currentChallenges: string[];
        stakeholders: string[];
      };
      spinQuestions: {
        situation: string[];
        problem: string[];
        implication: string[];
        needPayoff: string[];
      };
      meddicChecklist: {
        metrics: string;
        economicBuyer: string;
        decisionCriteria: string;
        decisionProcess: string;
        identifiedPain: string;
        champion: string;
        competition: string;
      };
      bantAssessment: {
        budget: string;
        authority: string;
        need: string;
        timeline: string;
      };
      challengerInsights: string[];
      solutionAlignment: string;
      objectionHandling: Array<{
        objection: string;
        response: string;
        methodology: string;
      }>;
      callAgenda: string[];
      nextSteps: string[];
      methodologySummary: string;
      contextAnalysis: string;
    };
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

// Helper to parse integration errors from API response
function parseIntegrationError(error: Error): { code: string; message: string; raw: any } | null {
  try {
    const errorText = error.message;
    // Error format is: "500: {json}"
    const jsonMatch = errorText.match(/^\d+:\s*(\{.*\})$/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.error && parsed.error.code) {
        return {
          code: parsed.error.code,
          message: parsed.error.message || parsed.message || errorText,
          raw: parsed
        };
      }
    }
  } catch (e) {
    // If parsing fails, return null
  }
  return null;
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
  
  // State for integration errors
  const [integrationError, setIntegrationError] = useState<{ code: string; message: string; raw: any } | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

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

  // Handle account candidate selection (MUST be before conditional returns)
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

  // Generate AI prep mutation (updated to handle partial responses)
  const generatePrepMutation = useMutation({
    mutationFn: async (targetCallId: string) => {
      const response = await apiRequest("POST", `/api/calls/${targetCallId}/generate-prep`);
      return response.json() as Promise<GeneratePrepResponse>;
    },
    onSuccess: (data) => {
      // Clear any previous integration errors on success
      setIntegrationError(null);
      
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
      const parsedError = parseIntegrationError(error as Error);
      
      if (parsedError) {
        // Store integration error for UI display
        setIntegrationError(parsedError);
        
        // Show user-friendly error message
        if (parsedError.code === "GOOGLE_NOT_CONNECTED") {
          toast({
            title: "Google Calendar not connected",
            description: "Connect your Google Calendar to generate AI prep sheets.",
            variant: "destructive",
          });
        } else if (parsedError.code === "SALESFORCE_NOT_CONNECTED" || parsedError.code === "SFDC_NOT_CONNECTED") {
          toast({
            title: "Salesforce not connected",
            description: "Connect your Salesforce CRM to generate AI prep sheets.",
            variant: "destructive",
          });
        } else if (parsedError.code === "NO_UPCOMING_EVENTS") {
          toast({
            title: "No upcoming events",
            description: "No upcoming calendar events found to generate prep sheets.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: parsedError.message,
            variant: "destructive",
          });
        }
      } else {
        // Generic error handling
        toast({
          title: "Error",
          description: "Failed to generate AI preparation: " + (error as Error).message,
          variant: "destructive",
        });
      }
    },
  });

  // Enhanced methodology-aware prep generation mutation
  const generateEnhancedPrepMutation = useMutation({
    mutationFn: async (callId: string) => {
      const response = await apiRequest('POST', `/api/calls/${callId}/generate-enhanced-prep`);
      const json = await response.json();
      return json as { success: boolean; methodologyData: any; message: string };
    },
    onSuccess: (data) => {
      toast({
        title: "Enhanced AI prep generated",
        description: "Your call preparation now includes multi-methodology sales strategies.",
      });
      // Update the call data with methodology information
      if (resolvedCallId && data.methodologyData) {
        queryClient.setQueryData(["/api/calls", resolvedCallId], (oldData: any) => {
          if (oldData && oldData.callPrep) {
            return {
              ...oldData,
              callPrep: {
                ...oldData.callPrep,
                methodologyData: data.methodologyData
              }
            };
          } else if (oldData) {
            return {
              ...oldData,
              callPrep: {
                isGenerated: true,
                methodologyData: data.methodologyData
              }
            };
          }
          return oldData;
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate enhanced preparation: " + (error as Error).message,
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
                  <>
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
                    <Button
                      onClick={() => resolvedCallId && generateEnhancedPrepMutation.mutate(resolvedCallId)}
                      disabled={generateEnhancedPrepMutation.isPending || !resolvedCallId}
                      variant="default"
                      className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      data-testid="button-enhance-prep"
                    >
                      <Zap className="h-4 w-4" />
                      <span>{generateEnhancedPrepMutation.isPending ? "Enhancing..." : "Enhance with Methodologies"}</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sales Coach Integration */}
          <div className="mb-6">
            <SalesCoachLauncher 
              eventId={resolvedCallId} 
              variant="inline"
            />
          </div>

          {/* Integration Error Card */}
          {integrationError && (
            <Card className="mb-6 border-destructive">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2" data-testid="text-integration-error-title">
                      {integrationError.code === "GOOGLE_NOT_CONNECTED" && "Google Calendar Not Connected"}
                      {(integrationError.code === "SALESFORCE_NOT_CONNECTED" || integrationError.code === "SFDC_NOT_CONNECTED") && "Salesforce CRM Not Connected"}
                      {integrationError.code === "NO_UPCOMING_EVENTS" && "No Upcoming Events"}
                      {!["GOOGLE_NOT_CONNECTED", "SALESFORCE_NOT_CONNECTED", "SFDC_NOT_CONNECTED", "NO_UPCOMING_EVENTS"].includes(integrationError.code) && "Integration Error"}
                    </h3>
                    <p className="text-muted-foreground mb-4" data-testid="text-integration-error-message">
                      {integrationError.message}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {integrationError.code === "GOOGLE_NOT_CONNECTED" && (
                        <Button
                          onClick={() => window.location.href = '/settings'}
                          className="flex items-center space-x-2"
                          data-testid="button-connect-google"
                        >
                          <Calendar className="h-4 w-4" />
                          <span>Connect Google Calendar</span>
                        </Button>
                      )}
                      
                      {(integrationError.code === "SALESFORCE_NOT_CONNECTED" || integrationError.code === "SFDC_NOT_CONNECTED") && (
                        <Button
                          onClick={() => window.location.href = '/settings'}
                          className="flex items-center space-x-2"
                          data-testid="button-connect-salesforce"
                        >
                          <Building2 className="h-4 w-4" />
                          <span>Connect Salesforce</span>
                        </Button>
                      )}
                      
                      <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center space-x-2"
                            data-testid="button-toggle-error-details"
                          >
                            {showErrorDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span>{showErrorDetails ? "Hide" : "Show"} error details</span>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4">
                          <div className="bg-muted rounded-lg p-4 overflow-auto max-h-64">
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap" data-testid="text-error-details">
                              {JSON.stringify(integrationError.raw, null, 2)}
                            </pre>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* Multi-Methodology Section */}
          {callPrep?.methodologyData && (
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-6">
                <Zap className="h-6 w-6 text-purple-600" />
                <h2 className="text-2xl font-bold text-foreground">Multi-Methodology Sales Strategy</h2>
                <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-blue-600">
                  Enhanced
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <MethodologySummary 
                  methodologySummary={callPrep.methodologyData.methodologySummary}
                  contextAnalysis={callPrep.methodologyData.contextAnalysis}
                  callType={call.callType}
                  dealStage={call.stage}
                  complexity="medium"
                />
                <BANTAssessment bantAssessment={callPrep.methodologyData.bantAssessment} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <SPINQuestions spinQuestions={callPrep.methodologyData.spinQuestions} />
                <MEDDICChecklist meddicChecklist={callPrep.methodologyData.meddicChecklist} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ChallengerInsights challengerInsights={callPrep.methodologyData.challengerInsights} />
                <ObjectionHandling objectionHandling={callPrep.methodologyData.objectionHandling} />
              </div>
            </div>
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

      {/* Sales Coach Panel - conditionally rendered when panel is open */}
      <SalesCoachPanel />
    </div>
  );
}
