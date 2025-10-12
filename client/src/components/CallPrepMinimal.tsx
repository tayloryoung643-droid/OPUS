import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, Mail, Building2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface MinimalPrepData {
  meeting: {
    id: string;
    title: string;
    start: string;
    end: string;
  };
  attendees: Array<{
    email: string;
    displayName?: string;
  }>;
  gmail?: Array<{
    id: string;
    date: string;
    from: string;
    to: string;
    subject: string;
    snippet: string;
  }>;
  salesforce?: {
    accountName?: string;
    stageName?: string;
    amount?: number;
    closeDate?: string;
    ownerName?: string;
  };
}

interface CallPrepMinimalProps {
  eventId: string;
  eventTitle: string;
  eventStart: string;
  eventEnd?: string;
  initialAttendees?: string[];
}

export default function CallPrepMinimal({
  eventId,
  eventTitle,
  eventStart,
  eventEnd,
  initialAttendees = [],
}: CallPrepMinimalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = (user as any)?.sub || (user as any)?.userId || "default";

  const [attendees, setAttendees] = useState<string[]>(initialAttendees);
  const [newAttendee, setNewAttendee] = useState("");
  const [notes, setNotes] = useState("");
  const [canvas, setCanvas] = useState("");
  const [insertedHashes, setInsertedHashes] = useState<Set<string>>(new Set());

  // Sync initial attendees when they change
  useEffect(() => {
    setAttendees(initialAttendees);
  }, [initialAttendees.join(",")]);

  // Fetch prep data from MCP
  const { data: prepData, isLoading: prepLoading } = useQuery<MinimalPrepData>({
    queryKey: ["/mcp/prep.generate.v1", eventId, userId],
    queryFn: async () => {
      const mcpServiceToken = import.meta.env.VITE_MCP_SERVICE_TOKEN || "";
      const mcpBaseUrl = import.meta.env.VITE_MCP_BASE_URL || "http://localhost:4000";
      
      const response = await fetch(`${mcpBaseUrl}/tools/prep.generate.v1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mcpServiceToken}`,
        },
        body: JSON.stringify({
          userId,
          eventId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch prep data");
      }

      return response.json();
    },
    enabled: !!eventId && !!userId,
    retry: false,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const addAttendee = () => {
    if (newAttendee.trim() && !attendees.includes(newAttendee.trim())) {
      setAttendees([...attendees, newAttendee.trim()]);
      setNewAttendee("");
    }
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter((a) => a !== email));
  };

  // Hash function to detect duplicates
  const hashString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  };

  // Insert last email
  const insertLastEmail = () => {
    if (!prepData?.gmail || prepData.gmail.length === 0) {
      toast({
        title: "No emails found",
        description: "No recent emails available for this meeting.",
        variant: "destructive",
      });
      return;
    }

    const lastEmail = prepData.gmail[0];
    
    // Truncate snippet to 280 chars
    const snippet = lastEmail.snippet.length > 280 
      ? lastEmail.snippet.substring(0, 280) + "…" 
      : lastEmail.snippet;

    const emailText = `Last email (${new Date(lastEmail.date).toISOString().split("T")[0]}): "${snippet}"
Participants: ${lastEmail.from}, ${lastEmail.to}
Subject: ${lastEmail.subject}

`;

    // Check for duplicates
    const hash = hashString(emailText.trim());
    if (insertedHashes.has(hash)) {
      toast({
        title: "Already inserted",
        description: "This email has already been added to the canvas.",
      });
      return;
    }

    setCanvas((prev) => prev + emailText);
    setInsertedHashes((prev) => new Set(prev).add(hash));
  };

  // Insert CRM facts
  const insertCRMFacts = () => {
    if (!prepData?.salesforce) {
      toast({
        title: "No CRM data found",
        description: "No Salesforce data available for this meeting.",
        variant: "destructive",
      });
      return;
    }

    const sf = prepData.salesforce;
    const facts: string[] = [];

    if (sf.accountName) facts.push(`Account=${sf.accountName}`);
    if (sf.stageName) facts.push(`Stage=${sf.stageName}`);
    if (sf.amount) facts.push(`Amount=$${sf.amount.toLocaleString()}`);
    if (sf.closeDate) facts.push(`Close=${sf.closeDate}`);
    if (sf.ownerName) facts.push(`Owner=${sf.ownerName}`);

    if (facts.length === 0) {
      toast({
        title: "No CRM facts",
        description: "No CRM facts available for this meeting.",
      });
      return;
    }

    const crmText = `CRM: ${facts.join(" | ")}

`;

    // Check for duplicates
    const hash = hashString(crmText.trim());
    if (insertedHashes.has(hash)) {
      toast({
        title: "Already inserted",
        description: "CRM facts have already been added to the canvas.",
      });
      return;
    }

    setCanvas((prev) => prev + crmText);
    setInsertedHashes((prev) => new Set(prev).add(hash));
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Event Header */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-event-title">
              {eventTitle}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span data-testid="text-event-date">{formatDate(eventStart)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span data-testid="text-event-time">
                  {formatTime(eventStart)}
                  {eventEnd && ` - ${formatTime(eventEnd)}`}
                </span>
              </div>
            </div>

            {/* Attendees */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Attendees:</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {attendees.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="flex items-center gap-1"
                    data-testid={`badge-attendee-${email}`}
                  >
                    {email}
                    <button
                      onClick={() => removeAttendee(email)}
                      className="ml-1 hover:text-destructive"
                      data-testid={`button-remove-attendee-${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add attendee email..."
                  value={newAttendee}
                  onChange={(e) => setNewAttendee(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAttendee();
                    }
                  }}
                  className="max-w-xs"
                  data-testid="input-new-attendee"
                />
                <Button
                  onClick={addAttendee}
                  variant="outline"
                  size="sm"
                  data-testid="button-add-attendee"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes Scratchpad */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Notes (Local Only)</h3>
          <Textarea
            placeholder="Your personal notes for this call..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-notes"
          />
        </CardContent>
      </Card>

      {/* Open Call Prep Canvas */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Open Call Prep Canvas</h3>
            <div className="flex gap-2">
              <Button
                onClick={insertLastEmail}
                disabled={prepLoading || !prepData?.gmail?.length}
                variant="outline"
                size="sm"
                data-testid="button-insert-email"
              >
                <Mail className="h-4 w-4 mr-2" />
                Insert Last Email
              </Button>
              <Button
                onClick={insertCRMFacts}
                disabled={prepLoading || !prepData?.salesforce}
                variant="outline"
                size="sm"
                data-testid="button-insert-crm"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Insert CRM Facts
              </Button>
            </div>
          </div>

          {prepLoading && (
            <div className="text-sm text-muted-foreground">Loading prep data...</div>
          )}

          <Textarea
            placeholder="Free-form call preparation canvas. Use the buttons above to insert facts from email and CRM..."
            value={canvas}
            onChange={(e) => setCanvas(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            data-testid="textarea-canvas"
          />
        </CardContent>
      </Card>
    </div>
  );
}
