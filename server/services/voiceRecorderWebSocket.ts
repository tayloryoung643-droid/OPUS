import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import OpenAI from 'openai';
import { storage } from '../storage';
import { CallTranscript } from '@shared/schema';
import { parse as parseCookie } from 'cookie';
import crypto from 'crypto';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  eventId?: string;
  recordingSessionId?: string;
  isAlive?: boolean;
}

interface VoiceMessage {
  type: 'audio' | 'start_recording' | 'stop_recording' | 'status' | 'error';
  payload?: any;
  eventId?: string;
  timestamp?: number;
}

interface RecordingSession {
  eventId: string;
  userId: string;
  startTime: Date;
  audioChunks: Buffer[];
  eventTitle?: string;
  eventStartTime?: Date;
}

export class VoiceRecorderWebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private activeSessions: Map<string, RecordingSession> = new Map(); // eventId:userId -> session
  private openai: OpenAI;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/voice',
      perMessageDeflate: false // Better for real-time audio
    });

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.setupWebSocketServer();
    this.setupHeartbeat();
    
    console.log('[Voice-WS] Voice Recorder WebSocket service initialized');
  }

  private async authenticateWebSocket(req: any): Promise<string | null> {
    try {
      // Parse cookies from the request
      const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};
      const sessionId = cookies['connect.sid'];
      
      if (!sessionId) {
        console.log('[Voice-WS] No session cookie found');
        return null;
      }

      // For MVP, we'll implement a simple token-based approach
      // In production, you'd want to parse the actual session store
      console.log('[Voice-WS] Session cookie found, validating...');
      
      // Since we can't easily access the session store here, we'll need the client
      // to provide a short-lived authentication token from an authenticated endpoint
      return null; // Will implement token-based auth below
    } catch (error) {
      console.error('[Voice-WS] Error parsing session:', error);
      return null;
    }
  }

  private async validateAuthToken(token: string): Promise<string | null> {
    try {
      // Simple token validation for MVP
      // Format: userId:timestamp:hmac
      const parts = token.split(':');
      if (parts.length !== 3) return null;
      
      const [userId, timestamp, providedHmac] = parts;
      const now = Date.now();
      const tokenTime = parseInt(timestamp);
      
      // Token expires after 5 minutes
      if (now - tokenTime > 5 * 60 * 1000) {
        console.log('[Voice-WS] Token expired');
        return null;
      }
      
      // Verify HMAC
      const secret = process.env.SESSION_SECRET || 'default-secret';
      const expectedHmac = crypto
        .createHmac('sha256', secret)
        .update(`${userId}:${timestamp}`)
        .digest('hex');
      
      if (providedHmac !== expectedHmac) {
        console.log('[Voice-WS] Invalid token signature');
        return null;
      }
      
      return userId;
    } catch (error) {
      console.error('[Voice-WS] Error validating token:', error);
      return null;
    }
  }

  // Public method to generate auth tokens for authenticated users
  public static generateAuthToken(userId: string): string {
    const timestamp = Date.now().toString();
    const secret = process.env.SESSION_SECRET || 'default-secret';
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(`${userId}:${timestamp}`)
      .digest('hex');
    
    return `${userId}:${timestamp}:${hmac}`;
  }

  private setupWebSocketServer() {
    this.wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
      try {
        console.log('[Voice-WS] New WebSocket connection attempt');
        
        // Parse query parameters
        const { query } = parse(req.url || '', true);
        const eventId = query.eventId as string;
        const authToken = query.token as string;

        if (!eventId) {
          console.log('[Voice-WS] Missing eventId');
          ws.close(1008, 'Missing event ID');
          return;
        }

        if (!authToken) {
          console.log('[Voice-WS] Missing authentication token');
          ws.close(1008, 'Authentication token required');
          return;
        }

        // Validate the authentication token (simple implementation for MVP)
        const userId = await this.validateAuthToken(authToken);
        if (!userId) {
          console.log('[Voice-WS] Invalid authentication token');
          ws.close(1008, 'Invalid authentication token');
          return;
        }

        // Validate user exists in database
        const dbUser = await storage.getUser(userId);
        if (!dbUser) {
          console.log('[Voice-WS] User not found in database');
          ws.close(1008, 'User not found');
          return;
        }

        // Setup WebSocket
        ws.userId = userId;
        ws.eventId = eventId;
        ws.recordingSessionId = `${eventId}_${userId}_${Date.now()}`;
        ws.isAlive = true;

        this.clients.set(ws.recordingSessionId!, ws);

        console.log(`[Voice-WS] Client connected: event ${eventId}, user ${userId}`);
        
        // Send connection status
        this.sendMessage(ws, {
          type: 'status',
          payload: { status: 'connected', eventId, sessionId: ws.recordingSessionId }
        });

        // Handle messages
        ws.on('message', async (data: Buffer) => {
          try {
            await this.handleMessage(ws, data);
          } catch (error) {
            console.error('[Voice-WS] Error handling message:', error);
            this.sendMessage(ws, {
              type: 'error',
              payload: { message: 'Failed to process message' }
            });
          }
        });

        // Handle close
        ws.on('close', async (code, reason) => {
          console.log(`[Voice-WS] Client disconnected: ${code} ${reason.toString()}`);
          await this.handleDisconnection(ws);
        });

        // Handle errors
        ws.on('error', (error) => {
          console.error('[Voice-WS] WebSocket error:', error);
        });

        // Heartbeat
        ws.on('pong', () => {
          ws.isAlive = true;
        });

      } catch (error) {
        console.error('[Voice-WS] Error setting up connection:', error);
        ws.close(1011, 'Server error');
      }
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, data: Buffer) {
    try {
      // Check if this is a JSON command or audio data
      const firstByte = data[0];
      
      if (firstByte === 123) { // '{' - JSON message
        const message: VoiceMessage = JSON.parse(data.toString());
        await this.handleCommand(ws, message);
      } else {
        // This is audio data
        await this.handleAudioData(ws, data);
      }
    } catch (error) {
      console.error('[Voice-WS] Error parsing message:', error);
      throw error;
    }
  }

  private async handleCommand(ws: AuthenticatedWebSocket, message: VoiceMessage) {
    const { type, payload, eventId } = message;

    switch (type) {
      case 'start_recording':
        await this.startRecording(ws, eventId!, payload);
        break;
      
      case 'stop_recording':
        await this.stopRecording(ws);
        break;
      
      default:
        console.log(`[Voice-WS] Unknown command type: ${type}`);
    }
  }

  private async startRecording(ws: AuthenticatedWebSocket, eventId: string, payload: any) {
    const userId = ws.userId!;
    const sessionKey = `${eventId}:${userId}`;
    
    // Check if already recording for this user+event combination
    if (this.activeSessions.has(sessionKey)) {
      this.sendMessage(ws, {
        type: 'error',
        payload: { message: 'Recording already active for this event' }
      });
      return;
    }

    console.log(`[Voice-WS] Starting recording for event ${eventId}, user ${userId}`);

    // Create recording session
    const session: RecordingSession = {
      eventId,
      userId,
      startTime: new Date(),
      audioChunks: [],
      eventTitle: payload?.eventTitle,
      eventStartTime: payload?.eventStartTime ? new Date(payload.eventStartTime) : undefined
    };

    this.activeSessions.set(sessionKey, session);

    this.sendMessage(ws, {
      type: 'status',
      payload: { 
        status: 'recording', 
        eventId,
        startTime: session.startTime.toISOString()
      }
    });
  }

  private async handleAudioData(ws: AuthenticatedWebSocket, audioData: Buffer) {
    const eventId = ws.eventId!;
    const userId = ws.userId!;
    const sessionKey = `${eventId}:${userId}`;
    const session = this.activeSessions.get(sessionKey);
    
    if (!session) {
      console.log(`[Voice-WS] No active session for event ${eventId}, user ${userId}`);
      return;
    }

    // Buffer audio data (no transcription yet - silent recording)
    session.audioChunks.push(audioData);
    
    // Optional: Log progress without transcribing
    if (session.audioChunks.length % 100 === 0) {
      console.log(`[Voice-WS] Buffered ${session.audioChunks.length} audio chunks for event ${eventId}`);
    }
  }

  private async stopRecording(ws: AuthenticatedWebSocket) {
    const eventId = ws.eventId!;
    const userId = ws.userId!;
    const sessionKey = `${eventId}:${userId}`;
    const session = this.activeSessions.get(sessionKey);
    
    if (!session) {
      this.sendMessage(ws, {
        type: 'error',
        payload: { message: 'No active recording session' }
      });
      return;
    }

    console.log(`[Voice-WS] Stopping recording for event ${eventId}, user ${userId}`);

    try {
      // Finalize transcript from buffered audio
      const transcript = await this.finalizeTranscript(session);
      
      // Save to database
      await this.saveTranscript(session, transcript);
      
      // Clean up session
      this.activeSessions.delete(sessionKey);
      
      this.sendMessage(ws, {
        type: 'status',
        payload: { 
          status: 'completed', 
          eventId,
          transcriptLength: transcript.length
        }
      });

      console.log(`[Voice-WS] Recording completed and saved for event ${eventId}`);
      
    } catch (error) {
      console.error(`[Voice-WS] Error finalizing recording for event ${eventId}:`, error);
      
      // Clean up session even on error
      this.activeSessions.delete(eventId);
      
      this.sendMessage(ws, {
        type: 'error',
        payload: { message: 'Failed to finalize recording' }
      });
    }
  }

  private async finalizeTranscript(session: RecordingSession): Promise<string> {
    if (session.audioChunks.length === 0) {
      return 'No audio captured during the call.';
    }

    try {
      // Combine all audio chunks
      const combinedAudio = Buffer.concat(session.audioChunks);
      
      console.log(`[Voice-WS] Transcribing ${combinedAudio.length} bytes of audio for event ${session.eventId}`);

      // Create a temporary file for OpenAI Whisper
      const tempFile = new File([combinedAudio], 'recording.webm', { type: 'audio/webm' });
      
      // Transcribe with OpenAI Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: tempFile,
        model: 'whisper-1',
        response_format: 'text',
        language: 'en' // Can be made configurable
      });

      return transcription.trim();
      
    } catch (error) {
      console.error('[Voice-WS] Error transcribing audio:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  private async saveTranscript(session: RecordingSession, transcript: string) {
    try {
      const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
      
      // For MVP, we'll save without company/opportunity IDs
      // These can be linked later based on calendar event analysis
      const callTranscriptData = {
        userId: session.userId,
        eventId: session.eventId,
        transcript,
        eventTitle: session.eventTitle,
        eventStartTime: session.eventStartTime,
        duration,
        companyId: null, // TODO: Extract from calendar event or user selection
        opportunityId: null // TODO: Link based on CRM data
      };

      // Save to database using storage interface
      await storage.createCallTranscript(callTranscriptData);
      
      console.log(`[Voice-WS] Transcript saved for event ${session.eventId}`);
      
    } catch (error) {
      console.error('[Voice-WS] Error saving transcript:', error);
      throw error;
    }
  }

  private async handleDisconnection(ws: AuthenticatedWebSocket) {
    if (ws.recordingSessionId) {
      this.clients.delete(ws.recordingSessionId);
    }
    
    // If there was an active recording, finalize it
    if (ws.eventId && ws.userId) {
      const sessionKey = `${ws.eventId}:${ws.userId}`;
      if (this.activeSessions.has(sessionKey)) {
        console.log(`[Voice-WS] Client disconnected during recording, finalizing event ${ws.eventId}, user ${ws.userId}`);
        
        try {
          const session = this.activeSessions.get(sessionKey)!;
          const transcript = await this.finalizeTranscript(session);
          await this.saveTranscript(session, transcript);
          this.activeSessions.delete(sessionKey);
          
          console.log(`[Voice-WS] Auto-finalized recording for event ${ws.eventId}, user ${ws.userId}`);
        } catch (error) {
          console.error(`[Voice-WS] Error auto-finalizing recording:`, error);
          this.activeSessions.delete(sessionKey);
        }
      }
    }
  }

  private sendMessage(ws: AuthenticatedWebSocket, message: VoiceMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
    }
  }

  private setupHeartbeat() {
    const interval = setInterval(() => {
      this.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('[Voice-WS] Terminating dead connection');
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  // Public method to get active recordings (for debugging/monitoring)
  public getActiveRecordings(): string[] {
    return Array.from(this.activeSessions.keys());
  }
}