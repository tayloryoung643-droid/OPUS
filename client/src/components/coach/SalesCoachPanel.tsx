import { useState, useEffect, useRef } from 'react';
import { useSalesCoach } from '@/contexts/SalesCoachContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  Mic, 
  MicOff, 
  Wifi, 
  WifiOff, 
  Check, 
  AlertTriangle, 
  Lightbulb,
  Target,
  Zap,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CoachTranscript, CoachSuggestion } from '@shared/schema';

interface SalesCoachPanelProps {
  className?: string;
}

export function SalesCoachPanel({ className }: SalesCoachPanelProps) {
  const {
    isPanelOpen,
    togglePanel,
    transcripts,
    suggestions,
    isConnected,
    isAudioCapturing,
    startAudioCapture,
    stopAudioCapture,
    markSuggestionResolved,
    connectionError
  } = useSalesCoach();

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new transcripts arrive
  useEffect(() => {
    if (autoScroll && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, autoScroll]);

  // Don't render if panel is closed
  if (!isPanelOpen) return null;

  const handleAudioToggle = async () => {
    try {
      if (isAudioCapturing) {
        stopAudioCapture();
      } else {
        await startAudioCapture();
      }
    } catch (error) {
      console.error('Audio toggle failed:', error);
      // Could show a toast notification here
    }
  };

  const handleSuggestionResolve = async (suggestion: CoachSuggestion) => {
    try {
      await markSuggestionResolved(suggestion.id);
    } catch (error) {
      console.error('Failed to resolve suggestion:', error);
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'objection':
        return <AlertTriangle className="h-4 w-4" />;
      case 'opportunity':
        return <Target className="h-4 w-4" />;
      case 'warning':
        return <Zap className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getSuggestionColor = (type: string, priority: string) => {
    if (priority === 'high') return 'bg-red-100 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200';
    if (priority === 'medium') return 'bg-yellow-100 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200';
    return 'bg-blue-100 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200';
  };

  const getSpeakerColor = (speaker: string) => {
    switch (speaker) {
      case 'rep':
        return 'text-blue-600 dark:text-blue-400';
      case 'prospect':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const unresolvedSuggestions = suggestions.filter(s => !s.resolved);

  return (
    <div 
      className={cn(
        "fixed right-4 top-20 bottom-4 w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl z-50 flex flex-col",
        className
      )}
      data-testid="sales-coach-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-red-500"
          )} />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Sales Coach
          </h3>
          {connectionError && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Connection Status */}
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" data-testid="connection-status-connected" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" data-testid="connection-status-disconnected" />
          )}
          
          {/* Audio Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAudioToggle}
            disabled={!isConnected}
            data-testid="audio-toggle-button"
            className={cn(
              isAudioCapturing && "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            )}
          >
            {isAudioCapturing ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          
          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePanel}
            data-testid="close-panel-button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Suggestions Section */}
        {unresolvedSuggestions.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Coaching Suggestions ({unresolvedSuggestions.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {unresolvedSuggestions.map((suggestion) => (
                <Card 
                  key={suggestion.id} 
                  className={cn(
                    "p-3 border",
                    getSuggestionColor(suggestion.type, suggestion.priority)
                  )}
                  data-testid={`suggestion-${suggestion.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getSuggestionIcon(suggestion.type)}
                        <span className="text-sm font-medium truncate">
                          {suggestion.title}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        {suggestion.body}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeAgo(suggestion.at)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSuggestionResolve(suggestion)}
                          className="h-6 px-2 text-xs"
                          data-testid={`resolve-suggestion-${suggestion.id}`}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Done
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Transcript Section */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Live Transcript
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={cn(
                    "text-xs",
                    autoScroll && "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  )}
                  data-testid="auto-scroll-toggle"
                >
                  Auto-scroll
                </Button>
              </div>
            </div>
          </div>
          
          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="space-y-3" data-testid="transcript-container">
              {transcripts.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                  {isAudioCapturing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Listening for audio...
                    </div>
                  ) : (
                    "Start audio capture to see conversation transcript"
                  )}
                </div>
              ) : (
                transcripts.map((transcript) => (
                  <div 
                    key={transcript.id} 
                    className="group"
                    data-testid={`transcript-${transcript.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs font-medium",
                            getSpeakerColor(transcript.speaker)
                          )}
                        >
                          {transcript.speaker === 'rep' ? 'You' : 
                           transcript.speaker === 'prospect' ? 'Prospect' : 
                           'System'}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                          {transcript.text}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-500 mt-1 block">
                          {new Date(transcript.at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>
            {transcripts.length} messages • {unresolvedSuggestions.length} suggestions
          </span>
          <span className="flex items-center gap-1">
            {isAudioCapturing && (
              <>
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                Recording
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}