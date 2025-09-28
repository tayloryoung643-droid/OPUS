import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { startRealtimeVoice, type RealtimeHandle } from '@/lib/voice/realtimeClient';

interface OpusOrbProps {
  userId?: string;
  className?: string;
}

type OrbState = 'inactive' | 'connecting' | 'listening' | 'error';

export default function OpusOrb({ userId, className = '' }: OpusOrbProps) {
  const [state, setState] = useState<OrbState>('inactive');
  const [isActive, setIsActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const handleRef = useRef<RealtimeHandle | null>(null);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (handleRef.current) {
        handleRef.current.stop();
      }
    };
  }, []);

  // Toggle voice mode with OpenAI Realtime
  const toggleVoice = async () => {
    if (state === 'connecting') return;
    
    try {
      if (!isActive) {
        // Start voice session
        setState('connecting');
        setIsActive(true);
        
        if (!audioRef.current) {
          throw new Error('Audio element not found');
        }
        
        console.log('[OpusOrb] Starting OpenAI Realtime voice session');
        handleRef.current = await startRealtimeVoice(audioRef.current);
        setState('listening');
        
        toast({
          title: "Voice Mode Active",
          description: "Speak to Opus - your AI assistant is listening",
        });
        
      } else {
        // Stop voice session
        setState('connecting');
        console.log('[OpusOrb] Stopping voice session');
        
        handleRef.current?.stop();
        handleRef.current = null;
        setIsActive(false);
        setState('inactive');
        
        toast({
          title: "Voice Mode Ended",
          description: "Voice session completed successfully",
        });
      }
    } catch (error) {
      console.error('[OpusOrb] Voice toggle error:', error);
      setState('error');
      setIsActive(false);
      handleRef.current = null;
      
      toast({
        title: "Voice Mode Error",
        description: error instanceof Error ? error.message : "Failed to start voice session",
        variant: "destructive",
      });
      
      // Reset to inactive after error
      setTimeout(() => setState('inactive'), 2000);
    }
  };

  const handleOrbClick = () => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use voice mode.",
        variant: "destructive",
      });
      return;
    }

    toggleVoice();
  };

  const getOrbContent = () => {
    switch (state) {
      case 'connecting':
        return <Loader2 className="h-8 w-8 animate-spin text-white" />;
      case 'listening':
        return (
          <div className="flex items-center justify-center">
            <Mic className="h-6 w-6 text-white" />
            <Volume2 className="h-4 w-4 text-white/80 ml-1" />
          </div>
        );
      case 'error':
        return <MicOff className="h-8 w-8 text-red-400" />;
      default:
        return <Mic className="h-8 w-8 text-white/60" />;
    }
  };

  const getOrbClasses = () => {
    const baseClasses = "h-28 w-28 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer border-2 border-transparent relative";
    
    switch (state) {
      case 'listening':
        return `${baseClasses} opus-orb bg-gradient-to-tr from-cyan-400 to-purple-500 shadow-[0_0_30px_5px_rgba(59,130,246,0.65)] hover:scale-105`;
      case 'connecting':
        return `${baseClasses} bg-gradient-to-tr from-blue-500 to-indigo-600 animate-pulse`;
      case 'error':
        return `${baseClasses} bg-gradient-to-tr from-red-500 to-red-600`;
      default:
        return `${baseClasses} bg-gradient-to-tr from-gray-600 to-gray-700 hover:from-cyan-500 hover:to-purple-600 hover:scale-105 shadow-[0_0_16px_2px_rgba(255,255,255,0.15)] hover:shadow-[0_0_22px_3px_rgba(255,255,255,0.25)]`;
    }
  };

  const getTooltipText = () => {
    if (!userId) return "Sign in to use voice mode";
    
    switch (state) {
      case 'listening':
        return "Speaking with Opus - click to end session";
      case 'connecting':
        return "Connecting to Opus...";
      case 'error':
        return "Voice error - click to retry";
      default:
        return "Click to start voice conversation with Opus";
    }
  };

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