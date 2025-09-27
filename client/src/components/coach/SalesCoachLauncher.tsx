import { useState } from 'react';
import { useSalesCoach } from '@/contexts/SalesCoachContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Square, 
  Mic, 
  MicOff,
  MessageSquare, 
  Loader2,
  Zap,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SalesCoachLauncherProps {
  eventId?: string;
  className?: string;
  variant?: 'floating' | 'inline';
}

export function SalesCoachLauncher({ 
  eventId,
  className,
  variant = 'floating'
}: SalesCoachLauncherProps) {
  const {
    isSessionActive,
    isPanelOpen,
    isConnected,
    isAudioCapturing,
    connectionError,
    transcripts,
    suggestions,
    startSession,
    endSession,
    togglePanel,
    startAudioCapture,
    stopAudioCapture
  } = useSalesCoach();

  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const { toast } = useToast();

  const handleStartSession = async () => {
    try {
      setIsStarting(true);
      await startSession(eventId);
      
      toast({
        title: "Sales Coach Started",
        description: "Ready to provide real-time coaching suggestions",
      });

      // Automatically start audio capture after session starts
      setTimeout(async () => {
        try {
          await startAudioCapture();
        } catch (error) {
          toast({
            title: "Audio Setup Required",
            description: "Please enable microphone access for live coaching",
            variant: "destructive",
          });
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to start coaching session:', error);
      toast({
        title: "Failed to Start",
        description: "Could not start coaching session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndSession = async () => {
    try {
      setIsEnding(true);
      await endSession();
      
      toast({
        title: "Session Ended",
        description: `Captured ${transcripts.length} messages and ${suggestions.length} suggestions`,
      });

    } catch (error) {
      console.error('Failed to end coaching session:', error);
      toast({
        title: "Error Ending Session",
        description: "Session may still be active. Please refresh if issues persist.",
        variant: "destructive",
      });
    } finally {
      setIsEnding(false);
    }
  };

  const handleToggleAudio = async () => {
    try {
      if (isAudioCapturing) {
        stopAudioCapture();
        toast({
          title: "Audio Stopped",
          description: "No longer capturing audio for coaching",
        });
      } else {
        await startAudioCapture();
        toast({
          title: "Audio Started",
          description: "Now listening for conversation audio",
        });
      }
    } catch (error) {
      toast({
        title: "Audio Error",
        description: "Failed to start audio capture. Please ensure microphone access is granted.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = () => {
    if (!isSessionActive) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    if (connectionError) return 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400';
    if (isAudioCapturing) return 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400';
    if (isConnected) return 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400';
    return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400';
  };

  const getStatusText = () => {
    if (!isSessionActive) return 'Ready to start';
    if (connectionError) return 'Connection error';
    if (isAudioCapturing) return 'Live coaching';
    if (isConnected) return 'Connected';
    return 'Connecting...';
  };

  const getStatusIcon = () => {
    if (!isSessionActive) return <Play className="h-3 w-3" />;
    if (connectionError) return <AlertCircle className="h-3 w-3" />;
    if (isAudioCapturing) return <Mic className="h-3 w-3" />;
    if (isConnected) return <CheckCircle className="h-3 w-3" />;
    return <Loader2 className="h-3 w-3 animate-spin" />;
  };

  const unresolvedSuggestions = suggestions.filter(s => !s.resolved).length;

  if (variant === 'inline') {
    return (
      <Card className={cn("w-full", className)} data-testid="sales-coach-launcher-inline">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Sales Coach
                </h3>
              </div>
              
              <Badge className={getStatusColor()}>
                <div className="flex items-center gap-1">
                  {getStatusIcon()}
                  {getStatusText()}
                </div>
              </Badge>

              {isSessionActive && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>{transcripts.length} messages</span>
                  {unresolvedSuggestions > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {unresolvedSuggestions} suggestions
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isSessionActive && (
                <>
                  {/* Audio Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleAudio}
                    disabled={!isConnected}
                    data-testid="audio-toggle-inline"
                    className={cn(
                      isAudioCapturing && "bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800"
                    )}
                  >
                    {isAudioCapturing ? (
                      <>
                        <MicOff className="h-4 w-4 mr-2" />
                        Stop Audio
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Start Audio
                      </>
                    )}
                  </Button>

                  {/* Panel Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePanel}
                    data-testid="panel-toggle-inline"
                    className={cn(
                      isPanelOpen && "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800"
                    )}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {isPanelOpen ? 'Hide Panel' : 'Show Panel'}
                  </Button>

                  {/* End Session */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEndSession}
                    disabled={isEnding}
                    data-testid="end-session-inline"
                    className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800"
                  >
                    {isEnding ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    End Session
                  </Button>
                </>
              )}

              {!isSessionActive && (
                <Button
                  onClick={handleStartSession}
                  disabled={isStarting}
                  data-testid="start-session-inline"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Start Coaching
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Floating variant
  return (
    <div 
      className={cn(
        "fixed bottom-6 right-6 z-40",
        className
      )}
      data-testid="sales-coach-launcher-floating"
    >
      {isSessionActive ? (
        <div className="flex flex-col gap-2">
          {/* Notification Badge */}
          {unresolvedSuggestions > 0 && !isPanelOpen && (
            <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {unresolvedSuggestions} new suggestion{unresolvedSuggestions !== 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Control Button */}
          <Button
            size="lg"
            onClick={togglePanel}
            className={cn(
              "h-14 w-14 rounded-full shadow-lg",
              isPanelOpen 
                ? "bg-blue-600 hover:bg-blue-700" 
                : "bg-green-600 hover:bg-green-700"
            )}
            data-testid="main-control-floating"
          >
            {isPanelOpen ? (
              <MessageSquare className="h-6 w-6" />
            ) : isAudioCapturing ? (
              <Mic className="h-6 w-6 animate-pulse" />
            ) : (
              <MicOff className="h-6 w-6" />
            )}
          </Button>

          {/* Status Indicator */}
          <div className="text-center">
            <Badge className={cn("text-xs", getStatusColor())}>
              <div className="flex items-center gap-1">
                {getStatusIcon()}
                {getStatusText()}
              </div>
            </Badge>
          </div>
        </div>
      ) : (
        /* Start Session Button */
        <Button
          size="lg"
          onClick={handleStartSession}
          disabled={isStarting}
          className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
          data-testid="start-session-floating"
        >
          {isStarting ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Zap className="h-6 w-6" />
          )}
        </Button>
      )}
    </div>
  );
}