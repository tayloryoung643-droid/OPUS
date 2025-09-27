import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server } from 'http';
import { parse } from 'url';
import { storage } from '../storage';
import { createMCPServer } from '../mcp/mcp-server.js';
import OpenAI from 'openai';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
  private openai: OpenAI;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/coach',
      perMessageDeflate: false // Better for real-time audio
    });

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
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
      console.log(`[Coach-WS] Transcribing ${audioData.length} bytes of audio for session ${sessionId}`);

      if (audioData.length < 1000) {
        console.log(`[Coach-WS] Audio data too small for transcription: ${audioData.length} bytes`);
        return;
      }

      // Create temporary file for OpenAI Whisper
      const tempFilePath = join(tmpdir(), `coach-audio-${sessionId}-${Date.now()}.webm`);
      
      try {
        // Write audio data to temporary file
        writeFileSync(tempFilePath, audioData);
        
        // Transcribe using OpenAI Whisper
        const transcription = await this.openai.audio.transcriptions.create({
          file: { 
            name: 'audio.webm',
            buffer: audioData,
            type: 'audio/webm'
          } as any,
          model: 'whisper-1',
          language: 'en',
          response_format: 'json',
          temperature: 0.2
        });

        const transcriptText = transcription.text?.trim();
        
        if (!transcriptText || transcriptText.length < 3) {
          console.log(`[Coach-WS] Empty or too short transcription for session ${sessionId}`);
          return;
        }

        console.log(`[Coach-WS] Transcribed: "${transcriptText}" for session ${sessionId}`);

        // Determine speaker (simplified - in production would use speaker diarization)
        const speaker = this.detectSpeaker(transcriptText);
        
        // Save transcript to database
        const transcript = await storage.createCoachTranscript({
          sessionId,
          at: new Date(),
          speaker,
          text: transcriptText
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
        await this.generateCoachingSuggestions(sessionId, userId, transcriptText);

      } finally {
        // Clean up temporary file
        try {
          unlinkSync(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

    } catch (error) {
      console.error(`[Coach-WS] Transcription error for session ${sessionId}:`, error);
      
      // Send error to client
      const ws = this.clients.get(sessionId);
      if (ws) {
        this.sendMessage(ws, {
          type: 'error',
          payload: { message: 'Transcription failed', error: (error as Error).message }
        });
      }
    }
  }

  private detectSpeaker(text: string): 'rep' | 'prospect' | 'system' {
    // Simple heuristic-based speaker detection
    // In production, would use proper speaker diarization
    const lowerText = text.toLowerCase();
    
    // Check for question indicators (likely prospect)
    if (lowerText.includes('?') || 
        lowerText.includes('what') || 
        lowerText.includes('how') || 
        lowerText.includes('when') ||
        lowerText.includes('where') ||
        lowerText.includes('why')) {
      return 'prospect';
    }
    
    // Check for sales/presentation language (likely rep)
    if (lowerText.includes('our solution') ||
        lowerText.includes('our product') ||
        lowerText.includes('we offer') ||
        lowerText.includes('let me show') ||
        lowerText.includes('i can help')) {
      return 'rep';
    }
    
    // Default to rep for most cases
    return 'rep';
  }

  private async generateCoachingSuggestions(sessionId: string, userId: string, transcript: string) {
    try {
      console.log(`[Coach-WS] Generating methodology-aware suggestions for session ${sessionId} based on: "${transcript}"`);
      
      // Get the session data for context
      const session = await storage.getCoachSession(sessionId);
      if (!session) {
        console.error(`[Coach-WS] Session ${sessionId} not found for suggestion generation`);
        return;
      }

      // Get recent conversation history for better context
      const recentTranscripts = await storage.getCoachTranscripts(sessionId);
      const conversationContext = recentTranscripts
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

      // Get call and company data for methodology analysis
      let callContext = null;
      let methodologyWeights = null;
      
      try {
        if (session.eventId) {
          const call = await storage.getCall(session.eventId);
          if (call && call.companyId) {
            const company = await storage.getCompany(call.companyId);
            const contacts = await storage.getContactsByCompany(call.companyId);
            
            if (company) {
              // Import methodology analysis tools
              const { analyzeCallContext } = await import('./callContextAnalyzer');
              const { calculateMethodologyWeights } = await import('./salesMethodologies');
              
              // Analyze call context for methodology selection
              const analysisInput = {
                call: { ...call, company },
                crmData: {
                  contacts: contacts || [],
                  account: company
                }
              };
              
              callContext = await analyzeCallContext(analysisInput);
              
              // Calculate methodology weights
              methodologyWeights = calculateMethodologyWeights(callContext);
              
              console.log(`[Coach-WS] Call context analyzed: ${callContext.callType} | ${callContext.dealStage} | ${callContext.complexity} complexity`);
            }
          }
        }
      } catch (contextError) {
        const error = contextError as Error;
        console.log(`[Coach-WS] Could not analyze call context:`, error.message);
      }

      // Initialize MCP server for tool access  
      const mcpServer = await createMCPServer({ userId, storage });
      
      let crmContext = '';
      let calendarContext = '';
      let suggestions: any[] = [];

      try {
        // Get CRM context if available
        try {
          // Use MCP tools to get Salesforce data
          const accountsResult = await mcpServer.executeTool('salesforce_account_lookup', { 
            query: transcript.substring(0, 50) 
          });
          
          const opportunitiesResult = await mcpServer.executeTool('salesforce_opportunity_lookup', {
            query: transcript.substring(0, 50) 
          });

          crmContext = `CRM Data:\nAccounts: ${JSON.stringify(accountsResult)}\nOpportunities: ${JSON.stringify(opportunitiesResult)}`;
        } catch (mcpError) {
          const error = mcpError as Error;
          console.log(`[Coach-WS] CRM context unavailable:`, error.message);
        }

        // Get calendar context
        try {
          const calendarResult = await mcpServer.executeTool('calendar_meeting_context', {
            eventId: session.eventId || sessionId
          });
          calendarContext = `Calendar Context: ${JSON.stringify(calendarResult)}`;
        } catch (mcpError) {
          const error = mcpError as Error;
          console.log(`[Coach-WS] Calendar context unavailable:`, error.message);
        }

        // Generate methodology-aware coaching suggestions
        let prompt = '';
        
        if (callContext && methodologyWeights) {
          // Use methodology-aware prompt generation
          const { generateLiveCoachingPrompt } = await import('./methodologyPrompts');
          const promptContext = {
            callContext,
            methodologyWeights,
            prospectData: {} as any // Not needed for live coaching
          };
          
          // Generate methodology-specific coaching prompt
          prompt = generateLiveCoachingPrompt(
            promptContext,
            conversationContext + '\n\nLatest: ' + transcript,
            'Live call coaching needed based on latest conversation'
          );
          
          // Enhance with JSON format requirement
          prompt += `

ADDITIONAL CONTEXT:
CRM Data: ${crmContext}
Calendar: ${calendarContext}

Respond with a JSON array of 1-2 coaching suggestions in this format:
[{
  "title": "Suggestion title (max 50 chars)",
  "body": "Specific action to take (max 150 chars)",
  "type": "suggestion|objection|opportunity|warning",
  "priority": "high|medium|low",
  "methodology": "SPIN|MEDDIC|BANT|Challenger|Sandler|Mixed"
}]`;
          
          console.log(`[Coach-WS] Using methodology-aware coaching with top methodology: ${Object.entries(methodologyWeights).sort(([,a], [,b]) => b - a)[0][0]}`);
        } else {
          // Fallback to generic prompt if methodology analysis unavailable
          prompt = `You are an expert sales coach providing real-time guidance during a sales call.

CONVERSATION CONTEXT:
${conversationContext}

LATEST SPEAKER INPUT:
${transcript}

CRM CONTEXT:
${crmContext}

CALENDAR CONTEXT:
${calendarContext}

Analyze the conversation and provide 1-2 specific, actionable coaching suggestions. For each suggestion, provide:
1. A clear title (max 50 characters)
2. A specific action to take (max 150 characters)
3. The type: "suggestion", "objection", "opportunity", or "warning"
4. Priority: "high", "medium", or "low"

Respond with a JSON array of suggestions in this format:
[{
  "title": "Ask about timeline",
  "body": "They mentioned budget approval - ask: 'What's your timeline for making this decision?'",
  "type": "suggestion", 
  "priority": "high",
  "methodology": "Mixed"
}]`;
          
          console.log(`[Coach-WS] Using generic coaching prompt (methodology analysis unavailable)`);
        }

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 600
        });

        const aiResponse = completion.choices[0]?.message?.content;
        if (aiResponse) {
          try {
            suggestions = JSON.parse(aiResponse);
          } catch (parseError) {
            console.error(`[Coach-WS] Failed to parse AI suggestions:`, parseError);
            // Fallback to a default suggestion
            suggestions = [{
              title: "Continue discovery",
              body: "Listen actively and ask follow-up questions to understand their needs better",
              type: "suggestion",
              priority: "medium"
            }];
          }
        }

      } catch (aiError) {
        console.error(`[Coach-WS] AI suggestion generation failed:`, aiError);
        // Fallback suggestion based on transcript analysis
        suggestions = this.generateFallbackSuggestions(transcript);
      }

      // Store and send each suggestion
      for (const suggestionData of suggestions.slice(0, 2)) { // Limit to 2 suggestions
        try {
          const suggestion = await storage.createCoachSuggestion({
            sessionId,
            at: new Date(),
            type: suggestionData.type || 'suggestion',
            priority: suggestionData.priority || 'medium',
            title: suggestionData.title || 'Coaching Suggestion',
            body: suggestionData.body || 'Continue with active listening and discovery',
            resolved: false
          });
          
          console.log(`[Coach-WS] Created MCP-powered suggestion ${suggestion.id}: ${suggestion.title}`);

          // Send suggestion to client
          const ws = this.clients.get(sessionId);
          if (ws) {
            this.sendMessage(ws, {
              type: 'suggestion',
              payload: suggestion
            });
          }
        } catch (storageError) {
          console.error(`[Coach-WS] Failed to store suggestion:`, storageError);
        }
      }

    } catch (error) {
      console.error(`[Coach-WS] MCP suggestion generation error for session ${sessionId}:`, error);
    }
  }

  private generateFallbackSuggestions(transcript: string): any[] {
    const lowerTranscript = transcript.toLowerCase();
    
    // Pattern-based fallback suggestions
    if (lowerTranscript.includes('price') || lowerTranscript.includes('cost') || lowerTranscript.includes('expensive')) {
      return [{
        title: "Handle price objection",
        body: "Focus on ROI and value, not just price. Ask about their current costs.",
        type: "objection",
        priority: "high"
      }];
    }
    
    if (lowerTranscript.includes('think about it') || lowerTranscript.includes('need time')) {
      return [{
        title: "Address delay objection",
        body: "Identify the real decision criteria and timeline. Ask what needs to happen next.",
        type: "objection", 
        priority: "high"
      }];
    }
    
    if (lowerTranscript.includes('?')) {
      return [{
        title: "Follow up on question",
        body: "Provide a detailed answer and ask a relevant follow-up question.",
        type: "suggestion",
        priority: "medium"
      }];
    }
    
    return [{
      title: "Continue discovery",
      body: "Ask an open-ended question to better understand their needs and challenges.",
      type: "suggestion",
      priority: "medium"
    }];
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