import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { CoachSession, CoachTranscript, CoachSuggestion } from '@shared/schema';

// WebSocket message types
interface CoachMessage {
  type: 'transcript' | 'suggestion' | 'error' | 'session_started' | 'session_ended';
  payload: any;
  timestamp: number;
}

// Coach state interface
interface SalesCoachState {
  // Session management
  activeSession: CoachSession | null;
  isSessionActive: boolean;
  
  // Real-time data
  transcripts: CoachTranscript[];
  suggestions: CoachSuggestion[];
  
  // UI state
  isPanelOpen: boolean;
  isAudioCapturing: boolean;
  
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
}

// Coach actions interface
interface SalesCoachActions {
  // Session management
  startSession: (eventId?: string) => Promise<void>;
  endSession: () => Promise<void>;
  
  // Audio management
  startAudioCapture: () => Promise<void>;
  stopAudioCapture: () => void;
  
  // UI management
  togglePanel: () => void;
  markSuggestionResolved: (suggestionId: string) => Promise<void>;
  
  // Connection management
  connect: () => void;
  disconnect: () => void;
}

// Combined context type
interface SalesCoachContextType extends SalesCoachState, SalesCoachActions {}

// Create context
const SalesCoachContext = createContext<SalesCoachContextType | null>(null);

// Provider component
interface SalesCoachProviderProps {
  children: ReactNode;
}

export function SalesCoachProvider({ children }: SalesCoachProviderProps) {
  const queryClient = useQueryClient();
  
  // State management
  const [activeSession, setActiveSession] = useState<CoachSession | null>(null);
  const [transcripts, setTranscripts] = useState<CoachTranscript[]>([]);
  const [suggestions, setSuggestions] = useState<CoachSuggestion[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isAudioCapturing, setIsAudioCapturing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // WebSocket and audio references
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Get WebSocket connection info
  const { data: wsInfo } = useQuery({
    queryKey: ['/api/coach/ws/status'],
    enabled: false, // Only fetch when needed
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Session mutations
  const createSessionMutation = useMutation({
    mutationFn: async (eventId?: string) => {
      const response = await apiRequest('POST', '/api/coach/sessions', { eventId });
      return await response.json();
    },
    onSuccess: (session: CoachSession) => {
      setActiveSession(session);
      queryClient.invalidateQueries({ queryKey: ['/api/coach/sessions'] });
    }
  });

  const endSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) return;
      
      const response = await apiRequest('POST', `/api/coach/sessions/${activeSession.id}/end`);
      return await response.json();
    },
    onSuccess: () => {
      setActiveSession(null);
      setTranscripts([]);
      setSuggestions([]);
      stopAudioCapture();
      disconnect();
      queryClient.invalidateQueries({ queryKey: ['/api/coach/sessions'] });
    }
  });

  const markSuggestionResolvedMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const response = await apiRequest('POST', `/api/coach/suggestions/${suggestionId}/resolve`);
      return await response.json();
    },
    onSuccess: (updatedSuggestion: CoachSuggestion) => {
      setSuggestions(prev => prev.map(s => 
        s.id === updatedSuggestion.id ? updatedSuggestion : s
      ));
    }
  });

  // WebSocket management
  const connect = async () => {
    if (!activeSession || wsRef.current) return;

    try {
      // Get WebSocket connection info
      const response = await apiRequest('GET', '/api/coach/ws/status');
      const info = await response.json();
      
      // Build WebSocket URL with sessionId and userId for authentication
      const protocol = info.protocol || (window.location.protocol === 'https:' ? 'wss' : 'ws');
      const host = info.host || window.location.host;
      const wsUrl = `${protocol}://${host}${info.wsPath}?sessionId=${activeSession.id}&userId=${activeSession.userId}`;
      
      console.log('[SalesCoach] Connecting to WebSocket:', wsUrl);
      
      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[SalesCoach] WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: CoachMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('[SalesCoach] Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[SalesCoach] WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error('[SalesCoach] WebSocket error:', error);
        setConnectionError('Connection failed');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('[SalesCoach] Failed to establish WebSocket connection:', error);
      setConnectionError('Failed to connect');
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: CoachMessage) => {
    console.log('[SalesCoach] Received message:', message.type);
    
    switch (message.type) {
      case 'transcript':
        setTranscripts(prev => [...prev, message.payload]);
        break;
        
      case 'suggestion':
        setSuggestions(prev => [...prev, message.payload]);
        break;
        
      case 'error':
        console.error('[SalesCoach] Server error:', message.payload);
        setConnectionError(message.payload.message || 'Server error');
        break;
        
      case 'session_started':
        console.log('[SalesCoach] Session started remotely');
        break;
        
      case 'session_ended':
        console.log('[SalesCoach] Session ended remotely');
        endSession();
        break;
    }
  };

  // Audio capture management
  const startAudioCapture = async () => {
    if (!activeSession || !isConnected) {
      throw new Error('Must have active session and WebSocket connection');
    }

    try {
      // Request microphone access with tab audio (if supported)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      streamRef.current = stream;

      // Create MediaRecorder for audio streaming
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      // Send audio data to WebSocket
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Send audio data as binary
          event.data.arrayBuffer().then(buffer => {
            wsRef.current?.send(buffer);
          });
        }
      };

      // Start recording in chunks
      mediaRecorder.start(1000); // 1 second chunks
      setIsAudioCapturing(true);
      
      console.log('[SalesCoach] Audio capture started');

    } catch (error) {
      console.error('[SalesCoach] Failed to start audio capture:', error);
      throw new Error('Failed to start audio capture. Please ensure microphone access is granted.');
    }
  };

  const stopAudioCapture = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsAudioCapturing(false);
    console.log('[SalesCoach] Audio capture stopped');
  };

  // Session management
  const startSession = async (eventId?: string) => {
    try {
      await createSessionMutation.mutateAsync(eventId);
    } catch (error) {
      console.error('[SalesCoach] Failed to start session:', error);
      throw error;
    }
  };

  const endSession = async () => {
    try {
      await endSessionMutation.mutateAsync();
    } catch (error) {
      console.error('[SalesCoach] Failed to end session:', error);
      throw error;
    }
  };

  const markSuggestionResolved = async (suggestionId: string) => {
    try {
      await markSuggestionResolvedMutation.mutateAsync(suggestionId);
    } catch (error) {
      console.error('[SalesCoach] Failed to mark suggestion resolved:', error);
      throw error;
    }
  };

  // UI management
  const togglePanel = () => {
    setIsPanelOpen(prev => !prev);
  };

  // Auto-connect when session becomes active
  useEffect(() => {
    if (activeSession && !isConnected) {
      connect();
    }
  }, [activeSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioCapture();
      disconnect();
    };
  }, []);

  const contextValue: SalesCoachContextType = {
    // State
    activeSession,
    isSessionActive: !!activeSession,
    transcripts,
    suggestions,
    isPanelOpen,
    isAudioCapturing,
    isConnected,
    connectionError,
    
    // Actions
    startSession,
    endSession,
    startAudioCapture,
    stopAudioCapture,
    togglePanel,
    markSuggestionResolved,
    connect,
    disconnect
  };

  return (
    <SalesCoachContext.Provider value={contextValue}>
      {children}
    </SalesCoachContext.Provider>
  );
}

// Hook to use the Sales Coach context
export function useSalesCoach() {
  const context = useContext(SalesCoachContext);
  if (!context) {
    throw new Error('useSalesCoach must be used within a SalesCoachProvider');
  }
  return context;
}

// Export types for use in other components
export type { SalesCoachContextType, CoachMessage };