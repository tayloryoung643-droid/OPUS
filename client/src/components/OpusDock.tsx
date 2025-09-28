import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, Mic, MicOff, Trash2 } from 'lucide-react';
import { useOpus } from '@/contexts/OpusProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function OpusDock() {
  const {
    state,
    openChat,
    closeChat,
    sendMessage,
    clearChat,
    toggleVoice
  } = useOpus();
  
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chat.messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (state.chat.isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state.chat.isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || state.chat.pending) return;
    
    await sendMessage(inputMessage);
    setInputMessage('');
  };

  const handleOrbClick = () => {
    if (state.chat.isOpen) {
      // If chat is open and voice is inactive, start voice
      if (state.voice.status === 'inactive') {
        toggleVoice();
      } else {
        // If voice is active, stop it
        toggleVoice();
      }
    } else {
      // If chat is closed, open it
      openChat();
    }
  };

  // Determine orb visual state
  const getOrbStatus = () => {
    if (state.voice.status === 'connecting') return 'connecting';
    if (state.voice.status === 'listening') return 'listening';
    if (state.voice.status === 'error') return 'error';
    if (state.chat.isOpen) return 'chatOpen';
    return 'inactive';
  };

  const orbStatus = getOrbStatus();

  return (
    <div className="fixed right-8 bottom-8 z-50">
      {/* Chat Panel */}
      <AnimatePresence>
        {state.chat.isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-80 max-h-96 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden"
            data-testid="opus-chat-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-zinc-200">Opus</span>
                {state.voice.status === 'listening' && (
                  <div className="flex items-center gap-1 text-xs text-cyan-400">
                    <Mic className="w-3 h-3" />
                    Listening
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChat}
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  data-testid="button-clear-chat"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeChat}
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  data-testid="button-close-chat"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="h-64 p-4">
              <div className="space-y-4">
                {state.chat.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${message.role}-${message.id}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                          : 'bg-zinc-800/50 text-zinc-200 border border-zinc-700/50'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                
                {state.chat.pending && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800/50 border border-zinc-700/50 p-3 rounded-2xl text-sm text-zinc-200">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-zinc-500">Opus is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </ScrollArea>

            <Separator className="bg-zinc-800/50" />

            {/* Voice Status */}
            {state.voice.status !== 'inactive' && (
              <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800/50">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {state.voice.status === 'listening' && (
                      <>
                        <Mic className="w-3 h-3 text-cyan-400" />
                        <span className="text-cyan-400">Voice mode active - speak naturally</span>
                      </>
                    )}
                    {state.voice.status === 'connecting' && (
                      <>
                        <div className="w-3 h-3 border border-zinc-400 border-t-cyan-400 rounded-full animate-spin" />
                        <span className="text-zinc-400">Connecting...</span>
                      </>
                    )}
                    {state.voice.status === 'error' && (
                      <>
                        <MicOff className="w-3 h-3 text-red-400" />
                        <span className="text-red-400">Voice unavailable</span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleVoice}
                    className="h-6 px-2 text-xs"
                    data-testid="button-toggle-voice"
                  >
                    {state.voice.status === 'listening' ? 'Stop' : 'Retry'}
                  </Button>
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={state.voice.status === 'listening' ? "Voice mode active..." : "Type a message..."}
                  disabled={state.chat.pending || state.voice.status === 'listening'}
                  className="flex-1 bg-zinc-800/50 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-500 focus:border-cyan-500/50"
                  data-testid="input-chat-message"
                />
                <Button
                  type="submit"
                  disabled={!inputMessage.trim() || state.chat.pending || state.voice.status === 'listening'}
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white"
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              
              {state.voice.status === 'inactive' && (
                <div className="flex justify-center mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleVoice}
                    className="text-xs border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-cyan-500/50"
                    data-testid="button-start-voice"
                  >
                    <Mic className="w-3 h-3 mr-1" />
                    Start Voice Chat
                  </Button>
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
        data-testid="button-opus-orb-global"
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
            scale: orbStatus === 'listening' 
              ? [1, 1.3, 1] 
              : orbStatus === 'connecting'
              ? [1, 1.2, 1]
              : [1, 1.1, 1],
            opacity: orbStatus === 'listening' 
              ? [0.6, 0.9, 0.6] 
              : orbStatus === 'connecting'
              ? [0.4, 0.7, 0.4]
              : [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: orbStatus === 'listening' ? 1.5 : orbStatus === 'connecting' ? 1 : 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Main Orb Body */}
        <div className="relative h-full w-full rounded-full bg-black/80 backdrop-blur-sm overflow-hidden">
          {/* Inner Glow */}
          <motion.div
            className={`absolute inset-2 rounded-full ${
              orbStatus === 'listening'
                ? 'bg-gradient-to-tr from-cyan-400/40 to-purple-500/40'
                : orbStatus === 'connecting'
                ? 'bg-gradient-to-tr from-yellow-400/30 to-orange-500/30'
                : orbStatus === 'error'
                ? 'bg-gradient-to-tr from-red-400/30 to-red-600/30'
                : state.chat.isOpen
                ? 'bg-gradient-to-tr from-cyan-400/30 to-purple-500/30'
                : 'bg-gradient-to-tr from-cyan-400/20 to-purple-500/20'
            }`}
            animate={{
              opacity: orbStatus === 'listening' 
                ? [0.4, 0.8, 0.4] 
                : orbStatus === 'connecting'
                ? [0.3, 0.6, 0.3]
                : [0.2, 0.4, 0.2]
            }}
            transition={{
              duration: orbStatus === 'listening' ? 1 : orbStatus === 'connecting' ? 0.8 : 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

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
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Mic className="w-5 h-5 text-cyan-300/70" />
                </motion.div>
              )
            ) : (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <MessageSquare className="w-6 h-6 text-cyan-300/70" />
              </motion.div>
            )}
          </div>
        </div>
      </motion.button>
    </div>
  );
}