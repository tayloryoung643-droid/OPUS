// Embeddable Opus Orb bundle - shared between app and extension
import React, { useEffect, useRef, useState, useCallback, useReducer } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, Mic, MicOff, Trash2 } from 'lucide-react';
import { McpClient } from '../../../shared/mcpClient';
import { PersistenceAdapter, ChatMessage } from '../../../shared/persistenceAdapter';
import { startRealtimeVoice, RealtimeHandle } from '../lib/voice/realtimeClient';

// Embedded Orb configuration
export interface OpusOrbConfig {
  jwt: string;
  apiBaseUrl: string;
  mcpWsUrl: string;
  conversationId?: string;
  persistence: PersistenceAdapter;
  userId?: string;
  userName?: string;
}

// Chat and voice state management
interface ChatState {
  messages: ChatMessage[];
  conversationId: string;
  pending: boolean;
  isOpen: boolean;
}

interface VoiceState {
  status: 'inactive' | 'connecting' | 'listening' | 'error';
  handle: RealtimeHandle | null;
}

interface OrbState {
  chat: ChatState;
  voice: VoiceState;
  mcpConnected: boolean;
}

type OrbAction =
  | { type: 'OPEN_CHAT' }
  | { type: 'CLOSE_CHAT' }
  | { type: 'SET_PENDING'; pending: boolean }
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'CLEAR_CHAT' }
  | { type: 'LOAD_CHAT'; messages: ChatMessage[] }
  | { type: 'SET_CONVERSATION_ID'; conversationId: string }
  | { type: 'SET_VOICE_STATUS'; status: VoiceState['status'] }
  | { type: 'SET_VOICE_HANDLE'; handle: RealtimeHandle | null }
  | { type: 'SET_MCP_CONNECTED'; connected: boolean };

function orbReducer(state: OrbState, action: OrbAction): OrbState {
  switch (action.type) {
    case 'OPEN_CHAT':
      return { ...state, chat: { ...state.chat, isOpen: true } };
    case 'CLOSE_CHAT':
      return { ...state, chat: { ...state.chat, isOpen: false } };
    case 'SET_PENDING':
      return { ...state, chat: { ...state.chat, pending: action.pending } };
    case 'ADD_MESSAGE':
      return {
        ...state,
        chat: { ...state.chat, messages: [...state.chat.messages, action.message] }
      };
    case 'CLEAR_CHAT':
      return {
        ...state,
        chat: { ...state.chat, messages: [], conversationId: crypto.randomUUID() }
      };
    case 'LOAD_CHAT':
      return {
        ...state,
        chat: { ...state.chat, messages: action.messages }
      };
    case 'SET_CONVERSATION_ID':
      return {
        ...state,
        chat: { ...state.chat, conversationId: action.conversationId }
      };
    case 'SET_VOICE_STATUS':
      return { ...state, voice: { ...state.voice, status: action.status } };
    case 'SET_VOICE_HANDLE':
      return { ...state, voice: { ...state.voice, handle: action.handle } };
    case 'SET_MCP_CONNECTED':
      return { ...state, mcpConnected: action.connected };
    default:
      return state;
  }
}

// Main Orb component
function OpusOrbComponent({ config }: { config: OpusOrbConfig }) {
  const [state, dispatch] = useReducer(orbReducer, {
    chat: {
      messages: [],
      conversationId: config.conversationId || crypto.randomUUID(),
      pending: false,
      isOpen: false
    },
    voice: {
      status: 'inactive',
      handle: null
    },
    mcpConnected: false
  });

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mcpClientRef = useRef<McpClient | null>(null);

  // Initialize stable conversation ID and MCP client
  useEffect(() => {
    const initializeOrb = async () => {
      // Get or create stable conversation ID
      let conversationId = config.conversationId;
      if (!conversationId) {
        try {
          conversationId = await config.persistence.createSession();
          dispatch({ type: 'SET_CONVERSATION_ID', conversationId });
        } catch (error) {
          console.error('[OpusOrb] Failed to create session:', error);
          conversationId = crypto.randomUUID();
          dispatch({ type: 'SET_CONVERSATION_ID', conversationId });
        }
      }

      // Initialize MCP client
      try {
        mcpClientRef.current = new McpClient(config.mcpWsUrl, config.jwt);
        mcpClientRef.current.onConnectionChange = (connected) => {
          dispatch({ type: 'SET_MCP_CONNECTED', connected });
        };
        await mcpClientRef.current.connect();
      } catch (error) {
        console.error('[OpusOrb] MCP connection failed:', error);
        dispatch({ type: 'SET_MCP_CONNECTED', connected: false });
      }
    };

    initializeOrb();

    return () => {
      mcpClientRef.current?.disconnect();
    };
  }, [config.mcpWsUrl, config.jwt, config.conversationId]);

  // Load chat history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const messages = await config.persistence.loadMessages(state.chat.conversationId);
        dispatch({ type: 'LOAD_CHAT', messages });
      } catch (error) {
        console.error('[OpusOrb] Failed to load chat history:', error);
      }
    };

    loadHistory();
  }, [state.chat.conversationId]);

  // Save chat history when messages change
  useEffect(() => {
    if (state.chat.messages.length > 0) {
      config.persistence.saveMessages(state.chat.conversationId, state.chat.messages)
        .catch(error => console.error('[OpusOrb] Failed to save chat history:', error));
    }
  }, [state.chat.messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chat.messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (state.chat.isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state.chat.isOpen]);

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      if (state.voice.handle) {
        state.voice.handle.stop();
      }
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    };

    dispatch({ type: 'ADD_MESSAGE', message: userMessage });
    dispatch({ type: 'SET_PENDING', pending: true });

    try {
      // Send to chat API with MCP context
      const response = await fetch(`${config.apiBaseUrl}/opus/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.jwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId: state.chat.conversationId,
          messages: [...state.chat.messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          mcpContext: state.mcpConnected
        })
      });

      if (!response.ok) {
        throw new Error(`Chat API ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || "I'm here to help! What would you like to discuss?",
        timestamp: Date.now()
      };

      dispatch({ type: 'ADD_MESSAGE', message: assistantMessage });
    } catch (error) {
      console.error('[OpusOrb] Chat error:', error);
      
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: Date.now()
      };

      dispatch({ type: 'ADD_MESSAGE', message: errorMessage });
    } finally {
      dispatch({ type: 'SET_PENDING', pending: false });
    }
  }, [config, state.chat.conversationId, state.chat.messages, state.mcpConnected]);

  const startVoice = useCallback(async () => {
    if (state.voice.handle?.isActive()) return;

    try {
      dispatch({ type: 'SET_VOICE_STATUS', status: 'connecting' });

      if (!audioRef.current) {
        throw new Error('Audio element not available');
      }

      const handle = await startRealtimeVoice(audioRef.current);
      dispatch({ type: 'SET_VOICE_HANDLE', handle });
      dispatch({ type: 'SET_VOICE_STATUS', status: 'listening' });
    } catch (error) {
      console.error('[OpusOrb] Voice start error:', error);
      dispatch({ type: 'SET_VOICE_STATUS', status: 'error' });
    }
  }, [state.voice.handle]);

  const stopVoice = useCallback(() => {
    if (state.voice.handle) {
      state.voice.handle.stop();
      dispatch({ type: 'SET_VOICE_HANDLE', handle: null });
    }
    dispatch({ type: 'SET_VOICE_STATUS', status: 'inactive' });
  }, [state.voice.handle]);

  const toggleVoice = useCallback(async () => {
    const isActive = state.voice.handle?.isActive() || state.voice.status === 'listening';
    if (isActive) {
      stopVoice();
    } else {
      await startVoice();
    }
  }, [state.voice.handle, state.voice.status, startVoice, stopVoice]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || state.chat.pending) return;
    
    await sendMessage(inputMessage);
    setInputMessage('');
  };

  const handleOrbClick = () => {
    if (state.chat.isOpen) {
      if (state.voice.status === 'inactive') {
        toggleVoice();
      } else {
        toggleVoice();
      }
    } else {
      dispatch({ type: 'OPEN_CHAT' });
    }
  };

  const getOrbStatus = () => {
    if (state.voice.status === 'connecting') return 'connecting';
    if (state.voice.status === 'listening') return 'listening';
    if (state.voice.status === 'error') return 'error';
    if (state.chat.isOpen) return 'chatOpen';
    return 'inactive';
  };

  const orbStatus = getOrbStatus();

  return (
    <div className="fixed right-8 bottom-8 z-50 font-sans">
      {/* Chat Panel */}
      <AnimatePresence>
        {state.chat.isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-80 max-h-96 bg-black/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden"
            style={{ zIndex: 2147483647 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  state.mcpConnected ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <span className="text-sm font-medium text-gray-200">Opus</span>
                <span className="text-xs text-gray-500">
                  MCP {state.mcpConnected ? 'connected' : 'disconnected'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => dispatch({ type: 'CLEAR_CHAT' })}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => dispatch({ type: 'CLOSE_CHAT' })}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-64 p-4 overflow-y-auto">
              <div className="space-y-4">
                {state.chat.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                          : 'bg-gray-800/50 text-gray-200 border border-gray-600/50'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                
                {state.chat.pending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800/50 border border-gray-600/50 p-3 rounded-2xl text-sm text-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-gray-500">Opus is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </div>

            {/* Voice Status */}
            {state.voice.status !== 'inactive' && (
              <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-700/50">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {state.voice.status === 'listening' && (
                      <>
                        <Mic className="w-3 h-3 text-cyan-400" />
                        <span className="text-cyan-400">Voice mode active</span>
                      </>
                    )}
                    {state.voice.status === 'connecting' && (
                      <>
                        <div className="w-3 h-3 border border-gray-400 border-t-cyan-400 rounded-full animate-spin" />
                        <span className="text-gray-400">Connecting...</span>
                      </>
                    )}
                    {state.voice.status === 'error' && (
                      <>
                        <MicOff className="w-3 h-3 text-red-400" />
                        <span className="text-red-400">Voice unavailable</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={toggleVoice}
                    className="h-6 px-2 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                  >
                    {state.voice.status === 'listening' ? 'Stop' : 'Retry'}
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={state.voice.status === 'listening' ? "Voice mode active..." : "Type a message..."}
                  disabled={state.chat.pending || state.voice.status === 'listening'}
                  className="flex-1 bg-gray-800/50 border border-gray-600/50 text-gray-200 placeholder:text-gray-500 px-3 py-2 rounded-lg text-sm focus:border-cyan-500/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || state.chat.pending || state.voice.status === 'listening'}
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              
              {state.voice.status === 'inactive' && (
                <div className="flex justify-center mt-3">
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className="text-xs border border-gray-600/50 text-gray-400 hover:text-gray-200 hover:border-cyan-500/50 px-3 py-1 rounded-lg flex items-center gap-1"
                  >
                    <Mic className="w-3 h-3" />
                    Start Voice Chat
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Opus Orb */}
      <motion.button
        onClick={handleOrbClick}
        className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500 p-1 shadow-2xl transition-transform hover:scale-105"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{ zIndex: 2147483647 }}
      >
        {/* Animated Background Glow */}
        <motion.div
          className={`absolute inset-0 rounded-full blur-xl ${
            orbStatus === 'listening' 
              ? 'bg-gradient-to-tr from-cyan-400/60 to-purple-500/60' 
              : orbStatus === 'connecting'
              ? 'bg-gradient-to-tr from-yellow-400/40 to-orange-500/40'
              : orbStatus === 'error'
              ? 'bg-gradient-to-tr from-red-400/40 to-red-600/40'
              : 'bg-gradient-to-tr from-cyan-400/30 to-purple-500/30'
          }`}
          animate={{
            scale: orbStatus === 'listening' ? [1, 1.3, 1] : [1, 1.1, 1],
            opacity: orbStatus === 'listening' ? [0.6, 0.9, 0.6] : [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: orbStatus === 'listening' ? 1.5 : 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Main Orb Body */}
        <div className="relative h-full w-full rounded-full bg-black/80 backdrop-blur-sm overflow-hidden">
          {/* Center Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {state.chat.isOpen ? (
              orbStatus === 'listening' ? (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Mic className="w-6 h-6 text-cyan-300" />
                </motion.div>
              ) : orbStatus === 'connecting' ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-5 h-5 border-2 border-yellow-300 border-t-transparent rounded-full" />
                </motion.div>
              ) : orbStatus === 'error' ? (
                <MicOff className="w-6 h-6 text-red-300" />
              ) : (
                <Mic className="w-5 h-5 text-cyan-300/70" />
              )
            ) : (
              <MessageSquare className="w-6 h-6 text-cyan-300/70" />
            )}
          </div>
        </div>
      </motion.button>

      {/* Hidden audio element for voice responses */}
      <audio 
        ref={audioRef} 
        autoPlay 
        playsInline 
        hidden
      />
    </div>
  );
}

// Global mount function
export function mount(selector: string, config: OpusOrbConfig): { unmount: () => void } {
  const container = document.querySelector(selector);
  if (!container) {
    throw new Error(`Container not found: ${selector}`);
  }

  const root = createRoot(container);
  root.render(<OpusOrbComponent config={config} />);

  return {
    unmount: () => {
      root.unmount();
    }
  };
}

// Make it globally available
if (typeof window !== 'undefined') {
  (window as any).OpusOrb = { mount };
}