import React, { createContext, useContext, useReducer, useRef, useEffect, useCallback } from 'react';
import { startRealtimeVoice, type RealtimeHandle } from '@/lib/voice/realtimeClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string;
  pending: boolean;
  isOpen: boolean;
}

interface VoiceState {
  status: 'inactive' | 'connecting' | 'listening' | 'error';
  handle: RealtimeHandle | null;
}

interface OpusState {
  chat: ChatState;
  voice: VoiceState;
}

// Actions
type OpusAction =
  | { type: 'OPEN_CHAT' }
  | { type: 'CLOSE_CHAT' }
  | { type: 'SET_PENDING'; pending: boolean }
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'CLEAR_CHAT' }
  | { type: 'LOAD_CHAT'; messages: ChatMessage[] }
  | { type: 'SET_VOICE_STATUS'; status: VoiceState['status'] }
  | { type: 'SET_VOICE_HANDLE'; handle: RealtimeHandle | null };

// Initial state
const initialState: OpusState = {
  chat: {
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: "Hey! I'm Opus, your AI companion. I can help with call prep, objection handling, or just chat about your day. Click the orb to start voice mode!",
        timestamp: Date.now()
      }
    ],
    sessionId: crypto.randomUUID(),
    pending: false,
    isOpen: false
  },
  voice: {
    status: 'inactive',
    handle: null
  }
};

// Reducer
function opusReducer(state: OpusState, action: OpusAction): OpusState {
  switch (action.type) {
    case 'OPEN_CHAT':
      return {
        ...state,
        chat: { ...state.chat, isOpen: true }
      };
    case 'CLOSE_CHAT':
      return {
        ...state,
        chat: { ...state.chat, isOpen: false }
      };
    case 'SET_PENDING':
      return {
        ...state,
        chat: { ...state.chat, pending: action.pending }
      };
    case 'ADD_MESSAGE':
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: [...state.chat.messages, action.message]
        }
      };
    case 'CLEAR_CHAT':
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: [initialState.chat.messages[0]], // Keep welcome message
          sessionId: crypto.randomUUID()
        }
      };
    case 'LOAD_CHAT':
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: action.messages.length > 0 ? action.messages : [initialState.chat.messages[0]]
        }
      };
    case 'SET_VOICE_STATUS':
      return {
        ...state,
        voice: { ...state.voice, status: action.status }
      };
    case 'SET_VOICE_HANDLE':
      return {
        ...state,
        voice: { ...state.voice, handle: action.handle }
      };
    default:
      return state;
  }
}

// Context
interface OpusContextType {
  state: OpusState;
  // Chat actions
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  // Voice actions  
  toggleVoice: () => Promise<void>;
  startVoice: () => Promise<void>;
  stopVoice: () => void;
}

const OpusContext = createContext<OpusContextType | undefined>(undefined);

// Provider component
export function OpusProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(opusReducer, initialState);
  const { user } = useAuth();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Handle different user data structures (claims vs direct properties)
  const userId = (user as any)?.claims?.sub || (user as any)?.sub || (user as any)?.id;

  // Load chat history from localStorage on mount
  useEffect(() => {
    if (!userId) return;
    
    try {
      const stored = localStorage.getItem(`opus:chat:${userId}`);
      if (stored) {
        const parsedMessages = JSON.parse(stored);
        dispatch({ type: 'LOAD_CHAT', messages: parsedMessages });
      }
    } catch (error) {
      console.warn('[OpusProvider] Failed to load chat history:', error);
    }
  }, [userId]);

  // Save chat history to localStorage when messages change
  useEffect(() => {
    if (!userId || state.chat.messages.length === 0) return;
    
    try {
      // Keep last 50 messages for performance
      const messagesToSave = state.chat.messages.slice(-50);
      localStorage.setItem(`opus:chat:${userId}`, JSON.stringify(messagesToSave));
    } catch (error) {
      console.warn('[OpusProvider] Failed to save chat history:', error);
    }
  }, [userId, state.chat.messages]);

  // Extension session offer - broadcast one-time codes to Chrome extension when user is authenticated
  useEffect(() => {
    if (!userId) return;
    
    const broadcastSessionOffer = async () => {
      try {
        // Generate one-time session code from our backend
        const response = await fetch('/api/auth/extension/session-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const { code } = await response.json();
          
          // Broadcast session offer to Chrome extension via postMessage
          window.postMessage({ 
            type: 'OPUS_SESSION_OFFER', 
            code 
          }, '*');
          
          console.log('[OpusProvider] Session offer broadcast to Chrome extension');
        } else {
          console.warn('[OpusProvider] Failed to generate session code:', response.status);
        }
      } catch (error) {
        console.error('[OpusProvider] Session offer error:', error);
      }
    };
    
    // Broadcast session offer immediately and then refresh every 25 minutes (codes expire in 5 minutes but tokens last 60 minutes)
    broadcastSessionOffer();
    const sessionRefreshInterval = setInterval(broadcastSessionOffer, 25 * 60 * 1000);
    
    return () => clearInterval(sessionRefreshInterval);
  }, [userId]);

  // Extension message handler - handle requests from Chrome extension for token exchange
  useEffect(() => {
    if (!userId) return;
    
    const handleExtensionMessage = async (event: MessageEvent) => {
      // Only handle messages from extension origins or same origin
      if (!event.origin.startsWith('chrome-extension://') && event.origin !== window.location.origin) {
        return;
      }
      
      const { type, data } = event.data;
      
      if (type === 'OPUS_EXTENSION_TOKEN_REQUEST') {
        try {
          // Call the new mint endpoint with session authentication
          const response = await fetch('/api/auth/extension/mint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'  // Include session cookies
          });
          
          if (response.ok) {
            const tokenData = await response.json();
            
            // Send JWT back to extension
            event.source?.postMessage({
              type: 'OPUS_EXTENSION_TOKEN_RESPONSE',
              success: true,
              ...tokenData
            }, event.origin);
            
            console.log('[OpusProvider] Extension token provided via session auth');
          } else {
            event.source?.postMessage({
              type: 'OPUS_EXTENSION_TOKEN_RESPONSE',
              success: false,
              error: 'Token generation failed'
            }, event.origin);
          }
        } catch (error) {
          console.error('[OpusProvider] Extension token request error:', error);
          event.source?.postMessage({
            type: 'OPUS_EXTENSION_TOKEN_RESPONSE',
            success: false,
            error: 'Token request failed'
          }, event.origin);
        }
      }
    };
    
    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, [userId]);

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      if (state.voice.handle) {
        state.voice.handle.stop();
      }
    };
  }, []);

  // Chat actions
  const openChat = useCallback(() => {
    dispatch({ type: 'OPEN_CHAT' });
  }, []);

  const closeChat = useCallback(() => {
    dispatch({ type: 'CLOSE_CHAT' });
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    };
    
    dispatch({ type: 'ADD_MESSAGE', message: userMessage });
    dispatch({ type: 'SET_PENDING', pending: true });

    try {
      // Send to API
      const response = await fetch('/api/opus/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...state.chat.messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Chat API ${response.status}`);
      }

      const data = await response.json();
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || "I'm here to help! What would you like to discuss?",
        timestamp: Date.now()
      };
      
      dispatch({ type: 'ADD_MESSAGE', message: assistantMessage });
    } catch (error) {
      console.error('[OpusProvider] Chat error:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: Date.now()
      };
      
      dispatch({ type: 'ADD_MESSAGE', message: errorMessage });
      
      toast({
        title: "Chat Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      dispatch({ type: 'SET_PENDING', pending: false });
    }
  }, [state.chat.messages, toast]);

  const clearChat = useCallback(() => {
    dispatch({ type: 'CLEAR_CHAT' });
    
    if (userId) {
      try {
        localStorage.removeItem(`opus:chat:${userId}`);
      } catch (error) {
        console.warn('[OpusProvider] Failed to clear chat history:', error);
      }
    }
  }, [userId]);

  // Voice actions
  const startVoice = useCallback(async () => {
    console.log('[OpusProvider] StartVoice called. User:', user, 'UserId:', userId);
    
    if (!userId) {
      console.log('[OpusProvider] No userId found, blocking voice');
      toast({
        title: "Authentication Required",
        description: "Please sign in to use voice chat",
        variant: "destructive"
      });
      return;
    }
    
    console.log('[OpusProvider] User authenticated, proceeding with voice');

    if (state.voice.handle?.isActive()) {
      return; // Already active
    }

    try {
      dispatch({ type: 'SET_VOICE_STATUS', status: 'connecting' });
      
      if (!audioRef.current) {
        throw new Error('Audio element not available');
      }

      const handle = await startRealtimeVoice(audioRef.current);
      dispatch({ type: 'SET_VOICE_HANDLE', handle });
      dispatch({ type: 'SET_VOICE_STATUS', status: 'listening' });
      
      toast({
        title: "Voice Chat Started",
        description: "Opus is listening! Speak naturally.",
      });
    } catch (error) {
      console.error('[OpusProvider] Voice start error:', error);
      dispatch({ type: 'SET_VOICE_STATUS', status: 'error' });
      
      if (error instanceof Error && error.message.includes('Permission denied')) {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access to chat with Opus",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Voice Chat Failed",
          description: "Failed to start voice chat. Please try again.",
          variant: "destructive"
        });
      }
    }
  }, [userId, state.voice.handle, toast]);

  const stopVoice = useCallback(() => {
    if (state.voice.handle) {
      state.voice.handle.stop();
      dispatch({ type: 'SET_VOICE_HANDLE', handle: null });
    }
    
    dispatch({ type: 'SET_VOICE_STATUS', status: 'inactive' });
    
    toast({
      title: "Voice Chat Ended",
      description: "Thanks for chatting with Opus!",
    });
  }, [state.voice.handle, toast]);

  const toggleVoice = useCallback(async () => {
    const isActive = state.voice.handle?.isActive() || state.voice.status === 'listening';
    
    if (isActive) {
      stopVoice();
    } else {
      await startVoice();
    }
  }, [state.voice.handle, state.voice.status, startVoice, stopVoice]);

  const contextValue: OpusContextType = {
    state,
    openChat,
    closeChat,
    sendMessage,
    clearChat,
    toggleVoice,
    startVoice,
    stopVoice
  };

  return (
    <OpusContext.Provider value={contextValue}>
      {children}
      {/* Hidden audio element for voice responses */}
      <audio 
        ref={audioRef} 
        autoPlay 
        playsInline 
        hidden
        data-testid="opus-global-audio"
      />
    </OpusContext.Provider>
  );
}

// Hook to use the context
export function useOpus() {
  const context = useContext(OpusContext);
  if (context === undefined) {
    throw new Error('useOpus must be used within an OpusProvider');
  }
  return context;
}