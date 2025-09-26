import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AccountSelectModal, type AccountCandidate } from "@/components/AccountSelectModal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EventSummary {
  title: string;
  start?: string;
  end?: string;
  location?: string;
}

interface SheetAttendee {
  name: string;
  email: string;
}

interface PartialPrepSheet {
  mode: "partial";
  banner: string;
  eventSummary: EventSummary;
  attendees: SheetAttendee[];
  organizer: SheetAttendee;
  agendaFromInvite?: string[];
  actionItems: string[];
  risks: string[];
  notesSectionFirst: true;
}

interface FullPrepSheet extends Omit<PartialPrepSheet, "mode" | "banner"> {
  mode: "full";
  banner?: string;
  salesforceContext?: Record<string, unknown>;
}

export type PrepSheet = PartialPrepSheet | FullPrepSheet;

interface PrepSheetResponse {
  sheet: PrepSheet;
  accountId?: string;
  needsSelection?: boolean;
  candidates?: AccountCandidate[];
}

interface PrepSheetViewProps {
  eventId: string;
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AgendaList({ agenda }: { agenda?: string[] }) {
  if (!agenda || agenda.length === 0) return null;
  return (
    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
      {agenda.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

export function PrepSheetView({ eventId }: PrepSheetViewProps) {
  const [sheetResponse, setSheetResponse] = useState<PrepSheetResponse | null>(null);
  const [notes, setNotes] = useState("");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async (): Promise<PrepSheetResponse> => {
      const response = await apiRequest("POST", "/api/prep-sheet/generate", { eventId });
      return response.json();
    },
    onSuccess: (data) => {
      setSheetResponse(data);
    },
    onError: (error: unknown) => {
      toast({
        title: "Unable to generate prep sheet",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const linkAccountMutation = useMutation({
    mutationFn: async (account: AccountCandidate) => {
      await apiRequest("POST", "/api/prep-sheet/link-account", {
        eventId,
        accountId: account.id,
      });
    },
    onSuccess: () => {
      toast({
        title: "Account linked",
        description: "Regenerating with full context…",
      });
      setIsAccountModalOpen(false);
      generateMutation.mutate();
    },
    onError: (error: unknown) => {
      toast({
        title: "Unable to link account",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (eventId) {
      generateMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const sheet = sheetResponse?.sheet;
  const candidates = sheetResponse?.candidates ?? [];
  const needsSelection = sheetResponse?.needsSelection ?? false;

  const attendees = useMemo(() => sheet?.attendees ?? [], [sheet]);

  if (generateMutation.isPending && !sheet) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">No prep sheet generated yet.</p>
        </CardContent>
      </Card>
    );
  }

  const notesCard = (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Capture your notes for this meeting"
          rows={6}
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {sheet.banner && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {sheet.banner}
        </div>
      )}

      {sheet.notesSectionFirst ? (
        <>{notesCard}</>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Event summary</span>
            {needsSelection && (
              <Button size="sm" onClick={() => setIsAccountModalOpen(true)}>
                Link account to enrich
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-foreground">{sheet.eventSummary.title}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
              <span>{formatDate(sheet.eventSummary.start)}</span>
              <span>–</span>
              <span>{formatDate(sheet.eventSummary.end)}</span>
              {sheet.eventSummary.location && (
                <Badge variant="outline">{sheet.eventSummary.location}</Badge>
              )}
            </div>
          </div>

          <div>
            <p className="font-medium">Organizer</p>
            <p className="text-muted-foreground">{sheet.organizer.name || sheet.organizer.email}</p>
          </div>

          <div>
            <p className="font-medium">Attendees</p>
            {attendees.length === 0 ? (
              <p className="text-muted-foreground">No attendees on this invite yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-muted-foreground">
                {attendees.map((attendee) => (
                  <li key={`${attendee.email}-${attendee.name}`}>
                    <span className="font-medium text-foreground">{attendee.name}</span>
                    <span className="ml-2">{attendee.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="font-medium">Agenda</p>
            <AgendaList agenda={sheet.agendaFromInvite} />
          </div>
        </CardContent>
      </Card>

      {(!sheet.notesSectionFirst) && notesCard}

      <Card>
        <CardHeader>
          <CardTitle>Action items</CardTitle>
        </CardHeader>
        <CardContent>
          {sheet.actionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No action items generated yet.</p>
          ) : (
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              {sheet.actionItems.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risks</CardTitle>
        </CardHeader>
        <CardContent>
          {sheet.risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No risks identified yet.</p>
          ) : (
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              {sheet.risks.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AccountSelectModal
        open={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        candidates={candidates}
        onSelectCandidate={(candidate) => linkAccountMutation.mutate(candidate)}
        isLinking={linkAccountMutation.isPending}
      />

      {sheet.mode === "full" && sheet.salesforceContext && (
        <Card>
          <CardHeader>
            <CardTitle>Salesforce context</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(sheet.salesforceContext, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
