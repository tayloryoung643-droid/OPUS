import { Router } from "express";
import { listRecentThreads, readThread, extractMessageParts } from "../services/gmail";
import { storage } from "../storage";

// Get Google tokens from user's integration
async function requireTokens(req: any) {
  const userId = req?.user?.claims?.sub;
  if (!userId) {
    throw new Error("Missing user ID");
  }
  
  const googleIntegration = await storage.getGoogleIntegration(userId);
  if (!googleIntegration?.accessToken) {
    throw new Error("Missing Google tokens - user needs to connect Google integration");
  }
  
  return {
    access_token: googleIntegration.accessToken,
    refresh_token: googleIntegration.refreshToken,
    expiry_date: googleIntegration.tokenExpiry?.getTime()
  };
}

const r = Router();

r.get("/threads", async (req: any, res, next) => {
  try {
    const tokens = await requireTokens(req);
    const q = (req.query.q as string) || "newer_than:7d";
    const threads = await listRecentThreads(tokens, q);
    res.json({ threads });
  } catch (e) {
    next(e);
  }
});

r.get("/threads/:id", async (req: any, res, next) => {
  try {
    const tokens = await requireTokens(req);
    const thread = await readThread(tokens, req.params.id);
    const messages = (thread.messages || []).map(extractMessageParts).map(m => ({
      id: m.id,
      date: m.headers["date"],
      from: m.headers["from"],
      to: m.headers["to"],
      subject: m.headers["subject"],
      snippet: m.snippet,
      body: m.body,
    }));
    res.json({ threadId: thread.id, messages });
  } catch (e) {
    next(e);
  }
});

export default r;