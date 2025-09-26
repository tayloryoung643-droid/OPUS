import { storage } from "../storage";
import type { CalendarEvent } from "./googleCalendar";

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
]);

export interface AccountCandidate {
  id: string;
  name: string;
  domain?: string | null;
  confidence: number;
  source: "domain" | "name";
}

export interface AccountResolutionResult {
  resolvedAccount?: AccountCandidate;
  confidence: number;
  candidates: AccountCandidate[];
  outcome: "resolved" | "candidates" | "none";
}

function extractDomain(email?: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  const [, domain] = email.split("@");
  const lowerDomain = domain.toLowerCase();
  if (PERSONAL_DOMAINS.has(lowerDomain)) {
    return null;
  }
  return lowerDomain;
}

export async function resolveAccountForEvent(
  _userId: string,
  event: CalendarEvent,
): Promise<AccountResolutionResult> {
  const attendees = event.attendees || [];
  const domainMatches = new Map<string, AccountCandidate>();

  for (const attendee of attendees) {
    const domain = extractDomain(attendee.email);
    if (!domain) continue;
    if (domainMatches.has(domain)) continue;

    const company = await storage.getCompanyByDomain(domain);
    if (!company) continue;

    domainMatches.set(domain, {
      id: company.id,
      name: company.name,
      domain: company.domain,
      confidence: 0.85,
      source: "domain",
    });
  }

  const candidates = Array.from(domainMatches.values());

  if (candidates.length === 0) {
    return {
      resolvedAccount: undefined,
      confidence: 0,
      candidates: [],
      outcome: "none",
    };
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 1) {
    const [candidate] = candidates;
    candidate.confidence = Math.max(candidate.confidence, 0.92);
    return {
      resolvedAccount: candidate,
      confidence: candidate.confidence,
      candidates,
      outcome: "resolved",
    };
  }

  return {
    resolvedAccount: undefined,
    confidence: candidates[0]?.confidence ?? 0,
    candidates,
    outcome: "candidates",
  };
}
