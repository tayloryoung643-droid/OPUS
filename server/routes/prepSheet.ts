import { Router } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replitAuth";
import { GoogleCalendarService, type CalendarEvent } from "../services/googleCalendar";
import { resolveAccountForEvent } from "../services/accountResolver";
import { storage } from "../storage";
import { log } from "../vite";

const calendarService = new GoogleCalendarService();

const generateSchema = z.object({
  eventId: z.string().min(1, "eventId is required"),
});

const linkAccountSchema = z.object({
  eventId: z.string().min(1, "eventId is required"),
  accountId: z.string().min(1, "accountId is required"),
});

function normaliseDateInput(date?: { dateTime?: string; date?: string }): string | undefined {
  if (!date) return undefined;
  if (date.dateTime) return date.dateTime;
  if (date.date) {
    const parsed = new Date(date.date);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return undefined;
}

function parseAgenda(description?: string | null): string[] | undefined {
  if (!description) return undefined;

  const lines = description
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*([*\-•])\s*/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return lines.slice(0, 12);
}

function buildEventContext(event: CalendarEvent) {
  return {
    eventSummary: {
      title: event.summary || "Untitled event",
      start: normaliseDateInput(event.start),
      end: normaliseDateInput(event.end),
      location: event.location ?? undefined,
    },
    attendees: (event.attendees || []).map(attendee => ({
      name: attendee.displayName ?? attendee.email ?? "",
      email: attendee.email ?? "",
    })),
    organizer: {
      name: event.organizer?.displayName ?? event.organizer?.email ?? "",
      email: event.organizer?.email ?? "",
    },
    agendaFromInvite: parseAgenda(event.description),
  };
}

function buildPartialSheet(event: CalendarEvent, options?: { includeAttendeesWarning?: boolean }) {
  const base = buildEventContext(event);
  const bannerMessages = [
    "Limited context: no account linked yet. You can link an account to enrich this sheet.",
  ];

  if (options?.includeAttendeesWarning) {
    bannerMessages.push("No attendees found on the invite. Add invitees or link an account for more context.");
  }

  return {
    mode: "partial" as const,
    banner: bannerMessages.join(" "),
    ...base,
    actionItems: [] as string[],
    risks: [] as string[],
    notesSectionFirst: true,
  };
}

function buildFullSheet(event: CalendarEvent, account: { id: string; name?: string | null; domain?: string | null }) {
  const base = buildEventContext(event);
  return {
    mode: "full" as const,
    ...base,
    actionItems: [] as string[],
    risks: [] as string[],
    notesSectionFirst: true,
    salesforceContext: {
      account,
    },
  };
}

export const prepSheetRouter = Router();

prepSheetRouter.post("/api/prep-sheet/generate", isAuthenticated, async (req: any, res, next) => {
  try {
    const { eventId } = generateSchema.parse(req.body ?? {});
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const event = await calendarService.getEventById(userId, eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const attendees = event.attendees || [];

    const existingLink = await storage.getEventAccountLink(userId, eventId);

    if (existingLink) {
      const sheet = buildFullSheet(event, {
        id: existingLink.accountId,
      });

      log(
        `prep-sheet generation complete mode=full resolver=linked candidateCount=0 eventId=${eventId}`,
        "prep-sheet",
      );

      return res.json({
        sheet,
        accountId: existingLink.accountId,
      });
    }

    const resolution = await resolveAccountForEvent(userId, event);

    if (resolution.resolvedAccount && resolution.confidence >= 0.9) {
      const sheet = buildFullSheet(event, {
        id: resolution.resolvedAccount.id,
        name: resolution.resolvedAccount.name,
        domain: resolution.resolvedAccount.domain,
      });

      log(
        `prep-sheet generation complete mode=full resolver=${resolution.outcome} candidateCount=${resolution.candidates.length} eventId=${eventId}`,
        "prep-sheet",
      );

      return res.json({
        sheet,
        accountId: resolution.resolvedAccount.id,
        candidates: resolution.candidates.slice(0, 3),
      });
    }

    const partialSheet = buildPartialSheet(event, {
      includeAttendeesWarning: attendees.length === 0,
    });

    const candidates = resolution.candidates.slice(0, 3);
    const needsSelection = true;

    log(
      `prep-sheet generation complete mode=partial resolver=${resolution.outcome} candidateCount=${candidates.length} eventId=${eventId}`,
      "prep-sheet",
    );

    return res.json({
      sheet: partialSheet,
      needsSelection,
      candidates,
    });
  } catch (error) {
    next(error);
  }
});

prepSheetRouter.post("/api/prep-sheet/link-account", isAuthenticated, async (req: any, res, next) => {
  try {
    const { eventId, accountId } = linkAccountSchema.parse(req.body ?? {});
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const link = await storage.upsertEventAccountLink({
      userId,
      eventId,
      accountId,
    });

    log(`prep-sheet event linked eventId=${eventId} accountId=${accountId}`, "prep-sheet");

    res.json({
      link,
    });
  } catch (error) {
    next(error);
  }
});
