import { google } from "googleapis";

export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
};

function makeOAuth2() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth env vars");
  }
  
  // Use the same redirect URI pattern as googleAuth.ts
  const replitDomain = process.env.REPLIT_DOMAINS || 'localhost:5000';
  const redirectUri = `https://${replitDomain}/api/integrations/google/callback`;
  
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
}

export function gmailClient(tokens: GoogleTokens) {
  const auth = makeOAuth2();
  auth.setCredentials(tokens);
  return google.gmail({ version: "v1", auth });
}

export async function listRecentThreads(tokens: GoogleTokens, q = "newer_than:7d -category:promotions") {
  const gmail = gmailClient(tokens);
  const { data } = await gmail.users.threads.list({ userId: "me", q, maxResults: 20 });
  return data.threads ?? [];
}

export async function readThread(tokens: GoogleTokens, threadId: string) {
  const gmail = gmailClient(tokens);
  const { data } = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
  return data;
}

// Gmail uses URL-safe base64 for bodies
export function decodeBody(b64?: string) {
  if (!b64) return "";
  return Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function extractMessageParts(msg: any) {
  const headers: Record<string, string> = {};
  (msg.payload?.headers || []).forEach((h: any) => (headers[h.name.toLowerCase()] = h.value));
  const parts = msg.payload?.parts || [];
  const textPart = parts.find((p: any) => p.mimeType === "text/plain") || msg.payload;
  const body = decodeBody(textPart?.body?.data);
  return {
    id: msg.id,
    headers,
    snippet: msg.snippet || "",
    body,
  };
}