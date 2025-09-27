import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Calendar, Building2, Clock, FileText, Users, AlertTriangle, Brain } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface UserNote {
  text: string;
  updatedAt: string | null;
}

interface PrepSheetProps {
  event: CallWithCompany | null;
}

// Debounce utility with cancel support
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const debounced = ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), wait);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => {
    clearTimeout(timeoutId);
  };
  
  return debounced;
}

export default function PrepSheetView({ event }: PrepSheetProps) {
  const [notesState, setNotesState] = useState<{
    eventId: string | null;
    text: string;
    lastSavedText: string;
  }>({
    eventId: null,
    text: "",
    lastSavedText: ""
  });
  const { toast } = useToast();

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

  // Fetch call details when event is selected
  const {
    data: callDetails,
    isLoading: callDetailsLoading,
    error: callDetailsError,
  } = useQuery<CallDetails>({
    queryKey: ["/api/calls", event?.id],
    enabled: !!event?.id,
    staleTime: 30_000,
  });

  // User notes query and mutation
  const { data: userNote } = useQuery<UserNote>({
    queryKey: ["/api/prep-notes", event?.id],
    queryFn: async () => {
      if (!event?.id) return { text: "", updatedAt: null };
      const response = await apiRequest("GET", `/api/prep-notes?eventId=${event.id}`);
      return response.json();
    },
    enabled: !!event?.id,
  });

  const saveNotesMutation = useMutation({
    mutationFn: async ({ eventId, text }: { eventId: string; text: string }) => {
      const response = await apiRequest("PUT", "/api/prep-notes", { eventId, text });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save notes");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prep-notes", event?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save notes",
        description: error.message,
        variant: "destructive",
      });
      // Revert the text to the last successfully saved state
      setNotesState(prev => ({
        ...prev,
        text: prev.lastSavedText
      }));
    },
  });

  // Debounced save with bulletproof state validation
  const debouncedSaveNotes = useCallback(
    debounce((eventId: string, text: string) => {
      // Double-check the event ID is still current when save executes
      if (event?.id === eventId) {
        saveNotesMutation.mutate({ eventId, text });
        // Update the lastSavedText to track what was saved
        setNotesState(prev => ({
          ...prev,
          lastSavedText: text
        }));
      }
    }, 1000),
    [event?.id, saveNotesMutation]
  );

  // Handle event changes - immediately reset state
  useEffect(() => {
    if (event?.id !== notesState.eventId) {
      debouncedSaveNotes.cancel();
      setNotesState({
        eventId: event?.id || null,
        text: "",
        lastSavedText: ""
      });
    }
  }, [event?.id, notesState.eventId]);

  // Load notes from server when userNote data arrives
  useEffect(() => {
    if (userNote !== undefined && event?.id && notesState.eventId === event.id) {
      const serverText = userNote?.text || "";
      setNotesState(prev => ({
        ...prev,
        text: serverText,
        lastSavedText: serverText
      }));
    }
  }, [userNote, event?.id, notesState.eventId]);

  // Auto-save when text changes
  useEffect(() => {
    if (notesState.eventId && notesState.text !== notesState.lastSavedText) {
      debouncedSaveNotes(notesState.eventId, notesState.text);
    }
  }, [notesState.text, notesState.lastSavedText, notesState.eventId, debouncedSaveNotes]);

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
      // Invalidate and refetch the call details to get updated prep data
      if (event?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/calls", event.id] });
      }
      // Also try to set data if response has the expected format
      if (event?.id && data && 'call' in data && data.call?.id) {
        queryClient.setQueryData(["/api/calls", event.id], data);
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
      if (event?.id && data.methodologyData) {
        queryClient.setQueryData(["/api/calls", event.id], (oldData: any) => {
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

  if (!event) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4" data-testid="text-dashboard-title">
            AI-Powered Sales Call Preparation
          </h1>
          <p className="text-muted-foreground text-lg">
            Select a call from the sidebar to view detailed preparation materials and generate AI-powered insights.
          </p>
        </div>
      </div>
    );
  }

  if (callDetailsLoading) {
    return (
      <div className="flex-1 p-6">
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
    );
  }

  if (callDetailsError || !callDetails) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Call Not Found</h1>
          <p className="text-muted-foreground">The requested call could not be found or an error occurred.</p>
        </div>
      </div>
    );
  }

  const { call, company, contacts, callPrep } = callDetails;

  return (
    <div className="flex-1 p-6 overflow-y-auto">
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
                  onClick={() => event?.id && generatePrepMutation.mutate(event.id)}
                  disabled={generatePrepMutation.isPending || !event?.id}
                  className="flex items-center space-x-2"
                  data-testid="button-generate-prep"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{generatePrepMutation.isPending ? "Generating..." : "Generate Call Prep"}</span>
                </Button>
              )}
              {callPrep?.isGenerated && (
                <>
                  <Button
                    onClick={() => event?.id && generatePrepMutation.mutate(event.id)}
                    disabled={generatePrepMutation.isPending || !event?.id}
                    variant="outline"
                    className="flex items-center space-x-2"
                    data-testid="button-regenerate-prep"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{generatePrepMutation.isPending ? "Regenerating..." : "Regenerate Prep"}</span>
                  </Button>
                  <Button
                    onClick={() => event?.id && generateEnhancedPrepMutation.mutate(event.id)}
                    disabled={generateEnhancedPrepMutation.isPending || !event?.id}
                    variant="default"
                    className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    data-testid="button-enhance-prep"
                  >
                    <Brain className="h-4 w-4" />
                    <span>{generateEnhancedPrepMutation.isPending ? "Enhancing..." : "Enhance with Methodologies"}</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notes Section - Always at the top */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              📝 Notes
            </h3>
            <Textarea
              placeholder="Type your notes here..."
              value={notesState.text}
              onChange={(e) => {
                if (notesState.eventId === event?.id) {
                  setNotesState(prev => ({
                    ...prev,
                    text: e.target.value
                  }));
                }
              }}
              className="min-h-[120px]"
              data-testid="textarea-prep-notes"
            />
            {saveNotesMutation.isPending && (
              <div className="text-xs text-muted-foreground mt-2">Saving...</div>
            )}
          </CardContent>
        </Card>

        {/* Sales Coach Integration */}
        <div className="mb-6">
          <SalesCoachLauncher 
            eventId={event?.id} 
            variant="inline"
          />
        </div>

        {/* Generated Prep Content */}
        {callPrep?.isGenerated && (
          <div className="space-y-6">
            {/* Methodology Components */}
            {callPrep.methodologyData && (
              <div className="space-y-6">
                <MethodologySummary 
                  methodologySummary={callPrep.methodologyData.methodologySummary}
                  contextAnalysis={callPrep.methodologyData.contextAnalysis}
                  callType={call.callType}
                  dealStage={call.stage}
                />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SPINQuestions spinQuestions={callPrep.methodologyData.spinQuestions} />
                  <MEDDICChecklist meddicChecklist={callPrep.methodologyData.meddicChecklist} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <BANTAssessment bantAssessment={callPrep.methodologyData.bantAssessment} />
                  <ChallengerInsights challengerInsights={callPrep.methodologyData.challengerInsights} />
                </div>
                
                <ObjectionHandling objectionHandling={callPrep.methodologyData.objectionHandling} />
              </div>
            )}

            {/* Traditional Prep Components */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ExecutiveSummary 
                  summary={callPrep.executiveSummary} 
                  contacts={contacts}
                  company={company}
                />
                <CrmHistory history={callPrep.crmHistory} />
                <CompetitiveLandscape landscape={callPrep.competitiveLandscape} />
              </div>
              <div className="space-y-6">
                <KeyStakeholders contacts={contacts} />
                <RecentNews news={company?.recentNews || []} />
                <SuggestedOpportunities
                  immediate={callPrep.immediateOpportunities || []}
                  strategic={callPrep.strategicExpansion || []}
                />
              </div>
            </div>
          </div>
        )}

        {/* Placeholder sections when no prep is generated */}
        {!callPrep?.isGenerated && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Stakeholders
                </h3>
                <p className="text-muted-foreground">Generate AI preparation to see stakeholder analysis</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Building2 className="h-5 w-5 mr-2" />
                  Company Info
                </h3>
                <p className="text-muted-foreground">Generate AI preparation to see company insights</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Key Insights</h3>
                <p className="text-muted-foreground">Generate AI preparation to see key insights</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Next Steps</h3>
                <p className="text-muted-foreground">Generate AI preparation to see recommended next steps</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}