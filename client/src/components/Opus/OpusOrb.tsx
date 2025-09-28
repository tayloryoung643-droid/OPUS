import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

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

type OrbState = 'muted' | 'listening' | 'connecting' | 'error';

interface VoiceMessage {
  type: 'status' | 'error';
  payload?: any;
  timestamp?: number;
}

export default function OpusOrb({ currentEvent, userId, className = '' }: OpusOrbProps) {
  const [state, setState] = useState<OrbState>('muted');
  const [isRecording, setIsRecording] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { toast } = useToast();

  // Check if we're currently during a calendar event
  const isDuringEvent = useCallback((): boolean => {
    if (!currentEvent?.start?.dateTime || !currentEvent?.end?.dateTime) {
      return false;
    }
    
    const now = new Date();
    const start = new Date(currentEvent.start.dateTime);
    const end = new Date(currentEvent.end.dateTime);
    
    return now >= start && now <= end;
  }, [currentEvent]);

  // Auto-stop recording when event ends
  useEffect(() => {
    if (isRecording && !isDuringEvent()) {
      console.log('[OpusOrb] Auto-stopping recording - event ended');
      handleStopRecording();
    }
  }, [isRecording, isDuringEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const connectWebSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (!currentEvent?.id) {
        reject(new Error('Missing eventId'));
        return;
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/voice?eventId=${currentEvent.id}`;
      console.log('[OpusOrb] Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[OpusOrb] WebSocket connected');
        resolve(ws);
      };
      
      ws.onmessage = (event) => {
        try {
          const message: VoiceMessage = JSON.parse(event.data);
          console.log('[OpusOrb] Received message:', message);
          
          if (message.type === 'status') {
            const status = message.payload?.status;
            if (status === 'connected') {
              setState('muted');
            } else if (status === 'recording') {
              setState('listening');
            } else if (status === 'completed') {
              setState('muted');
              setIsRecording(false);
              toast({
                title: "Recording completed",
                description: "Call transcript has been saved.",
              });
            }
          } else if (message.type === 'error') {
            console.error('[OpusOrb] WebSocket error:', message.payload?.message);
            setState('error');
            toast({
              title: "Recording error",
              description: message.payload?.message || "Failed to process recording",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('[OpusOrb] Error parsing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[OpusOrb] WebSocket error:', error);
        setState('error');
        reject(error);
      };
      
      ws.onclose = () => {
        console.log('[OpusOrb] WebSocket disconnected');
        wsRef.current = null;
      };
    });
  }, [currentEvent?.id, toast]);

  const startRecording = async () => {
    try {
      setState('connecting');
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Connect to WebSocket
      const ws = await connectWebSocket();
      wsRef.current = ws;
      
      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          // Send audio data to WebSocket
          ws.send(event.data);
        }
      };
      
      // Send start recording command
      ws.send(JSON.stringify({
        type: 'start_recording',
        eventId: currentEvent?.id,
        payload: {
          eventTitle: currentEvent?.summary,
          eventStartTime: currentEvent?.start?.dateTime
        }
      }));
      
      // Start recording in chunks for real-time streaming
      mediaRecorder.start(1000); // 1 second chunks for WebSocket streaming
      setIsRecording(true);
      
      toast({
        title: "Recording started",
        description: "Silently capturing call audio...",
      });
      
    } catch (error) {
      console.error('[OpusOrb] Error starting recording:', error);
      setState('error');
      toast({
        title: "Recording failed",
        description: "Could not access microphone or connect to server.",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      console.log('[OpusOrb] Stopping recording...');
      
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      // Send stop command to WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'stop_recording'
        }));
      }
      
      setIsRecording(false);
      setState('muted');
      
      toast({
        title: "Processing recording",
        description: "Generating transcript from call audio...",
      });
      
    } catch (error) {
      console.error('[OpusOrb] Error stopping recording:', error);
      setState('error');
      toast({
        title: "Error stopping recording",
        description: "There was an issue finalizing the recording.",
        variant: "destructive",
      });
    }
  };

  const handleOrbClick = () => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use voice recording.",
        variant: "destructive",
      });
      return;
    }

    if (!currentEvent) {
      toast({
        title: "No active event",
        description: "Voice recording is only available during calendar events.",
        variant: "destructive",
      });
      return;
    }

    if (!isDuringEvent()) {
      toast({
        title: "Event not active",
        description: "This event hasn't started yet or has already ended.",
        variant: "destructive",
      });
      return;
    }

    if (isRecording) {
      handleStopRecording();
    } else {
      startRecording();
    }
  };

  const getOrbContent = () => {
    switch (state) {
      case 'connecting':
        return <Loader2 className="h-8 w-8 animate-spin text-white" />;
      case 'error':
        return <MicOff className="h-8 w-8 text-red-400" />;
      default:
        return null; // No icon - clean orb appearance
    }
  };

  const getOrbClasses = () => {
    const baseClasses = "h-20 w-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer";
    
    switch (state) {
      case 'listening':
        return `${baseClasses} opus-orb bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg hover:scale-105`;
      case 'connecting':
        return `${baseClasses} bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse`;
      case 'error':
        return `${baseClasses} bg-gradient-to-br from-red-500 to-red-600`;
      default:
        return `${baseClasses} bg-gradient-to-br from-gray-600 to-gray-700 hover:from-purple-600 hover:to-violet-700 hover:scale-105`;
    }
  };

  const getTooltipText = () => {
    if (!userId) return "Sign in to use voice recording";
    if (!currentEvent) return "No active calendar event";
    if (!isDuringEvent()) return "Event not currently active";
    
    switch (state) {
      case 'listening':
        return "Recording active call";
      case 'connecting':
        return "Connecting...";
      case 'error':
        return "Recording error - click to retry";
      default:
        return "Ready for automatic recording";
    }
  };

  const isDisabled = !userId || !currentEvent || !isDuringEvent() || state === 'connecting';

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={getOrbClasses()}
            onClick={handleOrbClick}
            disabled={isDisabled}
            data-testid="opus-orb"
          >
            {getOrbContent()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
      
      {/* Event info */}
      {currentEvent && (
        <div className="text-center">
          <div className="flex items-center gap-1 text-xs text-white/60 mb-1">
            <Calendar className="h-3 w-3" />
            <span>{isDuringEvent() ? 'Active' : 'Upcoming'}</span>
          </div>
          <p className="text-sm text-white/80 font-medium max-w-32 truncate">
            {currentEvent.summary}
          </p>
        </div>
      )}
    </div>
  );
}