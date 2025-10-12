import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar, Users, X, Mail, Building2 } from "lucide-react";
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr} · ${timeStr}`;
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
    <div className="min-h-screen bg-black dark:bg-black">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold text-white">Call Prep</h1>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {/* Event Card */}
        <Card className="bg-white dark:bg-white border-0">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Event Header with Icon */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <Calendar className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Event</h2>
                  
                  {/* Event Name and Date/Time Grid */}
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Event name</p>
                      <p className="text-sm text-gray-900" data-testid="text-event-title">
                        {eventTitle}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Date & time</p>
                      <p className="text-sm text-gray-900" data-testid="text-event-datetime">
                        {formatDateTime(eventStart)}
                        {eventEnd && eventEnd !== eventStart && `-${formatDateTime(eventEnd).split(' · ')[1]}`}
                      </p>
                    </div>
                  </div>

                  {/* Attendees Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-gray-600" />
                      <p className="text-xs text-gray-700 font-medium">Attendees (emails)</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {attendees.map((email) => (
                        <Badge
                          key={email}
                          variant="secondary"
                          className="bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1 px-2 py-1 text-xs"
                          data-testid={`badge-attendee-${email}`}
                        >
                          {email}
                          <button
                            onClick={() => removeAttendee(email)}
                            className="ml-1 hover:text-gray-900"
                            data-testid={`button-remove-attendee-${email}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      
                      {/* Add Attendee Input */}
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder="Add attendee..."
                          value={newAttendee}
                          onChange={(e) => setNewAttendee(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addAttendee();
                            }
                          }}
                          className="h-7 text-xs w-40 bg-white border-gray-300 text-gray-600 placeholder:text-gray-400"
                          data-testid="input-new-attendee"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes Scratchpad */}
        <Card className="bg-white dark:bg-white border border-gray-200">
          <CardContent className="p-4">
            <Textarea
              placeholder="Notes (optional, personal scratchpad)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] border-0 resize-none text-sm text-gray-700 placeholder:text-gray-400 bg-white focus-visible:ring-0"
              data-testid="textarea-notes"
            />
          </CardContent>
        </Card>

        {/* Open Call Prep Canvas */}
        <Card className="bg-white dark:bg-white border border-gray-200">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-gray-900">Open call-prep canvas</h3>
              <div className="flex gap-2">
                <Button
                  onClick={insertLastEmail}
                  disabled={prepLoading || !prepData?.gmail?.length}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  data-testid="button-insert-email"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Insert last email
                </Button>
                <Button
                  onClick={insertCRMFacts}
                  disabled={prepLoading || !prepData?.salesforce}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  data-testid="button-insert-crm"
                >
                  <Building2 className="h-3 w-3 mr-1" />
                  Insert CRM facts
                </Button>
              </div>
            </div>

            <Textarea
              placeholder={`Type only what we *know for sure*...

Suggestions:
• Attendees + roles (facts only)
• Last email: short snippet + date
• CRM facts: stage, amount, close date, owner

Keep bullets tight. Avoid repetition.`}
              value={canvas}
              onChange={(e) => setCanvas(e.target.value)}
              className="min-h-[400px] text-sm text-gray-700 placeholder:text-gray-500 bg-white border-gray-200 font-mono resize-none focus-visible:ring-1 focus-visible:ring-gray-300"
              data-testid="textarea-canvas"
            />
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-500">MVP mode: one canvas, zero templates.</p>
        </div>
      </div>
    </div>
  );
}
