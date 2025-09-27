import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server } from 'http';
import { parse } from 'url';
import { storage } from '../storage';
import { createMCPServer } from '../mcp/mcp-server.js';
import type { CoachSession, CoachTranscript, CoachSuggestion } from '@shared/schema';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  session?: CoachSession;
  isAlive?: boolean;
}

interface CoachMessage {
  type: 'audio' | 'transcript' | 'suggestion' | 'objection' | 'knowledge' | 'error' | 'status';
  payload?: any;
  sessionId?: string;
  timestamp?: number;
}

export class CoachWebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private audioBuffers: Map<string, Buffer[]> = new Map();
  private transcriptionTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/coach',
      perMessageDeflate: false // Better for real-time audio
    });

    this.setupWebSocketServer();
    this.setupHeartbeat();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
      try {
        console.log('[Coach-WS] New WebSocket connection attempt');
        
        const { query } = parse(req.url || '', true);
        const sessionId = query.sessionId as string;
        const userId = query.userId as string;
        const token = query.token as string;

        if (!sessionId || !userId) {
          console.log('[Coach-WS] Missing sessionId or userId');
          ws.close(1008, 'Missing session or user ID');
          return;
        }

        // Authenticate and validate session
        const session = await this.authenticateConnection(sessionId, userId);
        if (!session) {
          console.log('[Coach-WS] Authentication failed');
          ws.close(1008, 'Authentication failed');
          return;
        }

        // Setup WebSocket
        ws.userId = userId;
        ws.sessionId = sessionId;
        ws.session = session;
        ws.isAlive = true;

        this.clients.set(sessionId, ws);
        this.audioBuffers.set(sessionId, []);

        console.log(`[Coach-WS] Client connected: session ${sessionId}, user ${userId}`);
        
        // Send status
        this.sendMessage(ws, {
          type: 'status',
          payload: { status: 'connected', session: session }
        });

        // Handle messages
        ws.on('message', async (data: Buffer) => {
          await this.handleMessage(ws, data);
        });

        ws.on('close', (code, reason) => {
          console.log(`[Coach-WS] Client disconnected: ${sessionId}, code: ${code}, reason: ${reason}`);
          this.cleanup(sessionId);
        });

        ws.on('error', (error) => {
          console.error(`[Coach-WS] WebSocket error for session ${sessionId}:`, error);
          this.cleanup(sessionId);
        });

        // Heartbeat
        ws.on('pong', () => {
          ws.isAlive = true;
        });

      } catch (error) {
        console.error('[Coach-WS] Connection setup error:', error);
        ws.close(1011, 'Internal error');
      }
    });
  }

  private async authenticateConnection(sessionId: string, userId: string): Promise<CoachSession | null> {
    try {
      const session = await storage.getCoachSession(sessionId);
      
      if (!session) {
        console.log(`[Coach-WS] Session not found: ${sessionId}`);
        return null;
      }

      if (session.userId !== userId) {
        console.log(`[Coach-WS] User mismatch: expected ${session.userId}, got ${userId}`);
        return null;
      }

      // Update session status to listening if it's connecting
      if (session.status === 'connecting') {
        const updatedSession = await storage.updateCoachSession(sessionId, {
          status: 'listening',
          startedAt: new Date()
        });
        return updatedSession;
      }

      return session;
    } catch (error) {
      console.error('[Coach-WS] Authentication error:', error);
      return null;
    }
  }

  private async handleMessage(ws: AuthenticatedWebSocket, data: Buffer) {
    try {
      if (!ws.sessionId || !ws.userId) return;

      // Check if this is JSON (control message) or binary (audio data)
      if (data[0] === 0x7B) { // Starts with '{', likely JSON
        const message: CoachMessage = JSON.parse(data.toString());
        await this.handleControlMessage(ws, message);
      } else {
        // Binary audio data
        await this.handleAudioData(ws, data);
      }
    } catch (error) {
      console.error(`[Coach-WS] Message handling error for session ${ws.sessionId}:`, error);
      this.sendMessage(ws, {
        type: 'error',
        payload: { message: 'Failed to process message' }
      });
    }
  }

  private async handleControlMessage(ws: AuthenticatedWebSocket, message: CoachMessage) {
    const { sessionId, userId } = ws;
    if (!sessionId || !userId) return;

    console.log(`[Coach-WS] Control message: ${message.type} for session ${sessionId}`);

    switch (message.type) {
      case 'status':
        // Send current session status
        const session = await storage.getCoachSession(sessionId);
        this.sendMessage(ws, {
          type: 'status',
          payload: { status: session?.status || 'unknown', session }
        });
        break;

      default:
        console.log(`[Coach-WS] Unknown control message type: ${message.type}`);
    }
  }

  private async handleAudioData(ws: AuthenticatedWebSocket, audioData: Buffer) {
    const { sessionId, userId } = ws;
    if (!sessionId || !userId) return;

    // Buffer audio chunks
    const buffers = this.audioBuffers.get(sessionId) || [];
    buffers.push(audioData);
    this.audioBuffers.set(sessionId, buffers);

    // Debounce transcription - process every 2 seconds
    if (this.transcriptionTimers.has(sessionId)) {
      clearTimeout(this.transcriptionTimers.get(sessionId)!);
    }

    const timer = setTimeout(async () => {
      await this.processAudioBuffer(sessionId, userId);
    }, 2000);

    this.transcriptionTimers.set(sessionId, timer);
  }

  private async processAudioBuffer(sessionId: string, userId: string) {
    try {
      const buffers = this.audioBuffers.get(sessionId);
      if (!buffers || buffers.length === 0) return;

      console.log(`[Coach-WS] Processing ${buffers.length} audio chunks for session ${sessionId}`);

      // Combine audio buffers
      const audioData = Buffer.concat(buffers);
      
      // Clear processed buffers
      this.audioBuffers.set(sessionId, []);

      // Process audio with OpenAI Whisper (placeholder - implement in next task)
      await this.transcribeAudio(sessionId, userId, audioData);

    } catch (error) {
      console.error(`[Coach-WS] Audio processing error for session ${sessionId}:`, error);
    }
  }

  private async transcribeAudio(sessionId: string, userId: string, audioData: Buffer) {
    try {
      // TODO: Implement OpenAI Whisper transcription
      // For now, create a mock transcript
      const mockTranscript = `Audio received at ${new Date().toISOString()} (${audioData.length} bytes)`;
      
      // Save transcript to database
      const transcript = await storage.createCoachTranscript({
        sessionId,
        at: new Date(),
        speaker: 'rep', // TODO: Implement speaker detection
        text: mockTranscript
      });

      console.log(`[Coach-WS] Created transcript ${transcript.id} for session ${sessionId}`);

      // Send transcript to client
      const ws = this.clients.get(sessionId);
      if (ws) {
        this.sendMessage(ws, {
          type: 'transcript',
          payload: transcript
        });
      }

      // Generate coaching suggestions using MCP
      await this.generateCoachingSuggestions(sessionId, userId, mockTranscript);

    } catch (error) {
      console.error(`[Coach-WS] Transcription error for session ${sessionId}:`, error);
    }
  }

  private async generateCoachingSuggestions(sessionId: string, userId: string, transcript: string) {
    try {
      // TODO: Implement MCP-based coaching suggestions
      // For now, create a mock suggestion
      const mockSuggestion = {
        title: "Ask about their biggest challenge",
        body: "Based on their tone, they seem concerned. Ask: 'What's your biggest challenge with your current solution?'",
        priority: "medium" as const,
        type: "suggestion" as const
      };

      const suggestion = await storage.createCoachSuggestion({
        sessionId,
        at: new Date(),
        type: mockSuggestion.type,
        priority: mockSuggestion.priority,
        title: mockSuggestion.title,
        body: mockSuggestion.body,
        resolved: false
      });

      console.log(`[Coach-WS] Created suggestion ${suggestion.id} for session ${sessionId}`);

      // Send suggestion to client
      const ws = this.clients.get(sessionId);
      if (ws) {
        this.sendMessage(ws, {
          type: 'suggestion',
          payload: suggestion
        });
      }

    } catch (error) {
      console.error(`[Coach-WS] Suggestion generation error for session ${sessionId}:`, error);
    }
  }

  private sendMessage(ws: AuthenticatedWebSocket, message: CoachMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
    }
  }

  private cleanup(sessionId: string) {
    this.clients.delete(sessionId);
    this.audioBuffers.delete(sessionId);
    
    if (this.transcriptionTimers.has(sessionId)) {
      clearTimeout(this.transcriptionTimers.get(sessionId)!);
      this.transcriptionTimers.delete(sessionId);
    }
  }

  private setupHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          console.log(`[Coach-WS] Terminating inactive connection: ${ws.sessionId}`);
          if (ws.sessionId) this.cleanup(ws.sessionId);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 second heartbeat
  }

  public getActiveConnections(): number {
    return this.clients.size;
  }

  public getActiveSessionIds(): string[] {
    return Array.from(this.clients.keys());
  }
}