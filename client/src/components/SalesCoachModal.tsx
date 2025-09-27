import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Send, MessageSquare, Bot, User, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SalesCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;
}

export default function SalesCoachModal({ isOpen, onClose, eventId }: SalesCoachModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm your AI Sales Coach. I can help you prepare for calls, practice objection handling, or provide real-time coaching during live conversations. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Chat mutation for sending messages to AI coach
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/coach/chat', {
        message,
        eventId,
        context: 'sales_coaching'
      });
      return response.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: data.response || "I'm here to help with your sales preparation and coaching needs.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error) => {
      toast({
        title: "Chat Error",
        description: "Failed to get response from AI coach: " + (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user', 
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(inputMessage.trim());
    setInputMessage("");
  }, [inputMessage, chatMutation]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Voice functionality (placeholder for future implementation)
  const toggleListening = () => {
    if (!isListening) {
      // Future: Start speech recognition
      setIsListening(true);
      toast({
        title: "Voice Mode",
        description: "Voice interaction coming soon! For now, use text chat.",
      });
      setTimeout(() => setIsListening(false), 2000);
    } else {
      // Future: Stop speech recognition
      setIsListening(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-t-lg">
          <DialogTitle className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span>AI Sales Coach</span>
          </DialogTitle>
        </DialogHeader>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${message.type}-${message.id}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.type === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-muted text-muted-foreground border'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    {message.type === 'user' ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Bot className="h-3 w-3" />
                    )}
                    <span className="text-xs opacity-75">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}
            
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground border rounded-lg px-4 py-2 max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-3 w-3" />
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-sm">AI Coach is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="px-6 py-4 border-t bg-background">
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask your AI Sales Coach anything..."
                className="pr-12"
                disabled={chatMutation.isPending}
                data-testid="input-coach-message"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleListening}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 ${
                  isListening ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="button-voice-toggle"
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || chatMutation.isPending}
              size="sm"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {eventId && (
            <div className="flex items-center justify-between mt-2">
              <Badge variant="outline" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                Call Context Available
              </Badge>
              <div className="text-xs text-muted-foreground">
                Ask about call preparation, objection handling, or sales strategies
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}