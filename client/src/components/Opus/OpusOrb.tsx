import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { startRealtimeVoice, type RealtimeHandle } from '@/lib/voice/realtimeClient';

interface CalendarEvent {
  id: string;
  summary: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
}

interface OpusOrbProps {
  currentEvent?: CalendarEvent;
  userId?: string;
  className?: string;
}

type OrbState = 'inactive' | 'connecting' | 'listening' | 'error';

export default function OpusOrb({ currentEvent, userId, className = '' }: OpusOrbProps) {
  const [state, setState] = useState<OrbState>('inactive');
  const [userName, setUserName] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const realtimeHandleRef = useRef<RealtimeHandle | null>(null);
  const { toast } = useToast();

  // Get user's name from auth
  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
          const userData = await response.json();
          const firstName = userData.name?.split(' ')[0] || userData.email?.split('@')[0] || 'there';
          setUserName(firstName);
        }
      } catch (error) {
        console.error('[OpusOrb] Failed to fetch user name:', error);
        setUserName('there'); // Fallback
      }
    };

    if (userId) {
      fetchUserName();
    }
  }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (realtimeHandleRef.current) {
        realtimeHandleRef.current.stop();
      }
    };
  }, []);

  // Start OpenAI Realtime Voice with automatic greeting
  const startVoiceMode = useCallback(async () => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to chat with Opus",
        variant: "destructive"
      });
      return;
    }

    if (realtimeHandleRef.current?.isActive()) {
      console.log('[OpusOrb] Already active, ignoring start request');
      return;
    }

    try {
      setState('connecting');
      console.log('[OpusOrb] Starting OpenAI Realtime voice...');

      // Start realtime voice connection
      const handle = await startRealtimeVoice(audioRef.current!);
      realtimeHandleRef.current = handle;

      setState('listening');
      
      // Show success message
      toast({
        title: "Voice Chat Started",
        description: `Hey ${userName}! Opus is listening...`,
      });

      // Add automatic greeting functionality
      // Note: OpenAI Realtime API will handle the conversation flow
      // The greeting will happen naturally through the AI model
      console.log('[OpusOrb] Voice mode active for user:', userName);

    } catch (error) {
      console.error('[OpusOrb] Failed to start voice mode:', error);
      setState('error');
      
      if (error instanceof Error && error.message.includes('Permission denied')) {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access to chat with Opus",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Voice Chat Failed",
          description: error instanceof Error ? error.message : 'Connection failed',
          variant: "destructive"
        });
      }
    }
  }, [userId, userName, toast]);

  const stopVoiceMode = useCallback(() => {
    console.log('[OpusOrb] Stopping voice mode...');
    
    if (realtimeHandleRef.current) {
      realtimeHandleRef.current.stop();
      realtimeHandleRef.current = null;
    }
    
    setState('inactive');
    
    toast({
      title: "Voice Chat Ended",
      description: "Thanks for chatting with Opus!",
    });
  }, [toast]);

  const handleOrbClick = useCallback(() => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to chat with Opus",
        variant: "destructive"
      });
      return;
    }

    const isActive = realtimeHandleRef.current?.isActive() || state === 'listening';
    
    if (isActive) {
      stopVoiceMode();
    } else {
      startVoiceMode();
    }
  }, [userId, state, startVoiceMode, stopVoiceMode, toast]);

  const getOrbClasses = () => {
    const baseClasses = "relative h-16 w-16 rounded-full border-2 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
    
    switch (state) {
      case 'listening':
        return `${baseClasses} border-cyan-400 bg-gradient-to-tr from-cyan-400/20 to-purple-500/20 shadow-lg shadow-cyan-400/25 hover:shadow-xl hover:shadow-cyan-400/30`;
      case 'connecting':
        return `${baseClasses} border-yellow-400 bg-gradient-to-tr from-yellow-400/20 to-orange-500/20 shadow-lg shadow-yellow-400/25`;
      case 'error':
        return `${baseClasses} border-red-400 bg-gradient-to-tr from-red-400/20 to-pink-500/20 shadow-lg shadow-red-400/25`;
      default:
        return `${baseClasses} border-white/30 bg-gradient-to-tr from-white/10 to-gray-400/10 hover:border-white/50 hover:bg-gradient-to-tr hover:from-white/20 hover:to-gray-400/20 shadow-lg shadow-black/25`;
    }
  };

  const getOrbContent = () => {
    switch (state) {
      case 'listening':
        return <Mic className="h-6 w-6 text-cyan-400" />;
      case 'connecting':
        return <Loader2 className="h-6 w-6 text-yellow-400 animate-spin" />;
      case 'error':
        return <MicOff className="h-6 w-6 text-red-400" />;
      default:
        return <Mic className="h-6 w-6 text-white/70" />;
    }
  };

  const getTooltipText = () => {
    switch (state) {
      case 'listening':
        return 'Opus is listening - tap to end chat';
      case 'connecting':
        return 'Connecting to Opus...';
      case 'error':
        return 'Voice chat error - tap to retry';
      default:
        return 'Tap to start chatting with Opus';
    }
  };

  const isActive = state === 'listening';
  const isDisabled = !userId || state === 'connecting';

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={getOrbClasses()}
            onClick={handleOrbClick}
            disabled={isDisabled}
            data-testid="opus-orb"
            aria-pressed={isActive}
            title={getTooltipText()}
          >
            {/* Pulsing glow when listening */}
            {state === 'listening' && (
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-400/30 to-purple-500/30 blur-xl animate-pulse" />
            )}
            
            {/* Hollow circle interior */}
            <div className="absolute inset-2 rounded-full bg-black/80 backdrop-blur-sm border border-white/20" />
            
            {/* Content */}
            <div className="relative z-10">
              {getOrbContent()}
            </div>
            
            {/* Active indicator */}
            {state === 'listening' && (
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white animate-pulse" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
      
      {/* Status text */}
      <div className="text-center">
        <div className="text-xs text-white/60">
          {state === 'listening' ? 'Listening… (tap to end)' : 'Tap to speak with Opus'}
        </div>
      </div>

      {/* Hidden audio element for OpenAI's voice responses */}
      <audio 
        ref={audioRef} 
        autoPlay 
        playsInline 
        hidden
        data-testid="opus-audio"
      />
    </div>
  );
}