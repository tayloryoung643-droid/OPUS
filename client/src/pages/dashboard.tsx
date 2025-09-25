import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Settings, Sparkles, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/ui/navigation";

interface CallWithCompany {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  callType?: string;
  stage?: string;
  company: {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
  };
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Fetch upcoming calls
  const { data: upcomingCalls = [], isLoading: upcomingLoading } = useQuery<CallWithCompany[]>({
    queryKey: ["/api/calls/upcoming"],
  });

  // Fetch previous calls
  const { data: previousCalls = [], isLoading: previousLoading } = useQuery<CallWithCompany[]>({
    queryKey: ["/api/calls/previous"],
  });

  // Setup demo data mutation
  const setupDemoMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/demo/setup");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Demo data created",
        description: "Sample calls and companies have been set up for demonstration.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to set up demo data.",
        variant: "destructive",
      });
    },
  });

  const filteredUpcomingCalls = upcomingCalls.filter(call =>
    call.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    call.company?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPreviousCalls = previousCalls.filter(call =>
    call.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    call.company?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCallTypeColor = (callType?: string) => {
    switch (callType) {
      case "demo":
        return "bg-blue-100 text-blue-800";
      case "discovery":
        return "bg-green-100 text-green-800";
      case "negotiation":
        return "bg-purple-100 text-purple-800";
      case "follow-up":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="flex">
        {/* Sidebar */}
        <div className="w-80 bg-card border-r border-border p-6">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-calls"
            />
          </div>

          {/* Demo Setup Button */}
          {upcomingCalls.length === 0 && previousCalls.length === 0 && !upcomingLoading && !previousLoading && (
            <div className="mb-6">
              <Button
                onClick={() => setupDemoMutation.mutate()}
                disabled={setupDemoMutation.isPending}
                className="w-full"
                data-testid="button-setup-demo"
              >
                {setupDemoMutation.isPending ? "Setting up..." : "Setup Demo Data"}
              </Button>
            </div>
          )}

          {/* Upcoming Calls */}
          <div className="mb-8">
            <h3 className="font-semibold text-foreground mb-4" data-testid="text-upcoming-calls">Upcoming Calls</h3>
            
            {upcomingLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-border rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredUpcomingCalls.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="text-no-upcoming-calls">No upcoming calls found</p>
            ) : (
              <div className="space-y-3">
                {filteredUpcomingCalls.map((call, index) => (
                  <Link key={call.id} href={`/call/${call.id}`}>
                    <Card 
                      className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                        index === 0 ? 'bg-primary text-primary-foreground' : ''
                      }`}
                      data-testid={`card-upcoming-call-${call.id}`}
                    >
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-1" data-testid={`text-call-title-${call.id}`}>
                          {call.title}
                        </h4>
                        <p className={`text-sm mb-2 ${index === 0 ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                          {call.company?.name}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center text-sm ${index === 0 ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                            <Clock className="mr-2 h-3 w-3" />
                            <span data-testid={`text-call-time-${call.id}`}>{formatDate(call.scheduledAt)}</span>
                          </div>
                          {call.callType && (
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${index === 0 ? 'bg-primary-foreground/20 text-primary-foreground' : getCallTypeColor(call.callType)}`}
                            >
                              {call.callType}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Previous Calls */}
          <div>
            <h3 className="font-semibold text-foreground mb-4" data-testid="text-previous-calls">Previous Calls</h3>
            
            {previousLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-border rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredPreviousCalls.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="text-no-previous-calls">No previous calls found</p>
            ) : (
              <div className="space-y-3">
                {filteredPreviousCalls.map((call) => (
                  <Link key={call.id} href={`/call/${call.id}`}>
                    <Card className="cursor-pointer transition-colors hover:bg-accent/50" data-testid={`card-previous-call-${call.id}`}>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-1" data-testid={`text-call-title-${call.id}`}>
                          {call.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {call.company?.name}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="mr-2 h-3 w-3" />
                            <span data-testid={`text-call-time-${call.id}`}>{formatDate(call.scheduledAt)}</span>
                          </div>
                          {call.callType && (
                            <Badge variant="secondary" className={`text-xs ${getCallTypeColor(call.callType)}`}>
                              {call.callType}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-foreground mb-4" data-testid="text-dashboard-title">
              AI-Powered Sales Call Preparation
            </h1>
            <p className="text-muted-foreground mb-8 text-lg">
              Select a call from the sidebar to view detailed preparation materials, or set up demo data to get started.
            </p>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6 text-center">
                  <h3 className="text-2xl font-bold text-primary mb-2" data-testid="text-stat-upcoming">
                    {upcomingCalls.length}
                  </h3>
                  <p className="text-muted-foreground">Upcoming Calls</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <h3 className="text-2xl font-bold text-primary mb-2" data-testid="text-stat-completed">
                    {previousCalls.length}
                  </h3>
                  <p className="text-muted-foreground">Completed Calls</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <h3 className="text-2xl font-bold text-primary mb-2" data-testid="text-stat-prep-rate">
                    100%
                  </h3>
                  <p className="text-muted-foreground">AI Prep Rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Sparkles className="text-primary h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">AI-Generated Insights</h3>
                  <p className="text-muted-foreground text-sm">
                    Get comprehensive prospect research, competitive analysis, and conversation strategies powered by advanced AI.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Clock className="text-primary h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Save Time</h3>
                  <p className="text-muted-foreground text-sm">
                    Reduce call prep time from hours to minutes with automated research and personalized recommendations.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
