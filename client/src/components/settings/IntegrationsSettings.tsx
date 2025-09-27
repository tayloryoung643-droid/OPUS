import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Building2, Check, X, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function IntegrationsSettings() {
  const { toast } = useToast();

  // Query integration statuses
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["/api/integrations/status"],
    queryFn: async () => {
      const response = await fetch("/api/integrations/status");
      if (!response.ok) throw new Error("Failed to fetch integration status");
      return response.json();
    },
  });

  // Google Calendar integration mutation
  const googleCalendarMutation = useMutation({
    mutationFn: async (action: "connect" | "disconnect") => {
      if (action === "connect") {
        window.location.href = "/api/integrations/google/auth";
        return;
      } else {
        return apiRequest("DELETE", "/api/integrations/google");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      toast({
        title: "Google Calendar",
        description: "Integration updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Integration Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Salesforce integration mutation
  const salesforceMutation = useMutation({
    mutationFn: async (action: "connect" | "disconnect") => {
      if (action === "connect") {
        window.location.href = "/api/auth/salesforce";
        return;
      } else {
        return apiRequest("DELETE", "/api/integrations/salesforce");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      toast({
        title: "Salesforce",
        description: "Integration updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Integration Error", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const googleConnected = integrations?.googleCalendar?.connected || false;
  const salesforceConnected = integrations?.salesforce?.connected || false;

  return (
    <div className="space-y-6">
      {/* Google Calendar Integration */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/8 transition">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-blue-500/20 p-2">
            <Calendar className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Google Calendar</h3>
            <p className="text-sm text-white/70">Sync your calendar events for call preparation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            variant={googleConnected ? "default" : "secondary"}
            className={
              googleConnected 
                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                : "bg-white/10 text-white/70 border-white/20"
            }
            data-testid="badge-google-status"
          >
            {googleConnected ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
          <Button
            variant={googleConnected ? "outline" : "default"}
            size="sm"
            onClick={() => googleCalendarMutation.mutate(googleConnected ? "disconnect" : "connect")}
            disabled={googleCalendarMutation.isPending || isLoading}
            className={
              googleConnected
                ? "border-white/20 hover:bg-white/5 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }
            data-testid="button-google-calendar"
          >
            {googleConnected ? "Disconnect" : "Connect"}
            {!googleConnected && <ExternalLink className="h-3 w-3 ml-1" />}
          </Button>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Salesforce Integration */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/8 transition">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-blue-600/20 p-2">
            <Building2 className="h-6 w-6 text-blue-300" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Salesforce CRM</h3>
            <p className="text-sm text-white/70">Access account data and opportunity insights</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            variant={salesforceConnected ? "default" : "secondary"}
            className={
              salesforceConnected 
                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                : "bg-white/10 text-white/70 border-white/20"
            }
            data-testid="badge-salesforce-status"
          >
            {salesforceConnected ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
          <Button
            variant={salesforceConnected ? "outline" : "default"}
            size="sm"
            onClick={() => salesforceMutation.mutate(salesforceConnected ? "disconnect" : "connect")}
            disabled={salesforceMutation.isPending || isLoading}
            className={
              salesforceConnected
                ? "border-white/20 hover:bg-white/5 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }
            data-testid="button-salesforce"
          >
            {salesforceConnected ? "Disconnect" : "Connect"}
            {!salesforceConnected && <ExternalLink className="h-3 w-3 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-sm text-white/50 mt-6">
        Integrations allow Opus to access your calendar and CRM data to provide personalized call preparation and insights.
      </div>
    </div>
  );
}