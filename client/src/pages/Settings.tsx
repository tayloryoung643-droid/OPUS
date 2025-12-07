import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Mail, Building2, Settings as SettingsIcon, ExternalLink, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { User } from "@shared/schema";
import { CONFIG } from "@/config";

export default function Settings() {
  const { user } = useAuth();
  const typedUser = user as User | undefined;
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [, navigate] = useLocation();

  // Check if we're in demo mode
  const isDemoMode = CONFIG.DEMO_MODE;

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleExitDemo = () => {
    localStorage.removeItem('opus_demo_mode');
    window.location.href = "/";
  };

  // Fetch integration statuses
  const { data: outlookStatus, refetch: refetchOutlook } = useQuery({
    queryKey: ["/api/integrations/outlook/status"],
    enabled: true,
    retry: false
  });

  const { data: googleStatus, refetch: refetchGoogle } = useQuery({
    queryKey: ["/api/integrations/google/status"],
    enabled: true,
    retry: false
  });

  const { data: salesforceStatus, refetch: refetchSalesforce } = useQuery({
    queryKey: ["/api/integrations/salesforce/status"],
    enabled: true,
    retry: false
  });

  const integrations = [
    {
      id: "google_calendar",
      name: "Google Calendar & Gmail",
      description: "Connect your Google account to sync calendar events, analyze email conversations, and generate AI call prep",
      icon: <Calendar className="w-8 h-8 text-green-600" />,
      status: (googleStatus as any)?.connected ? "connected" : "not_connected",
      type: "calendar_email",
      scopes: (googleStatus as any)?.scopes || [],
      connectedAt: (googleStatus as any)?.connectedAt
    },
    {
      id: "outlook",
      name: "Outlook Calendar & Email",
      description: "Connect your Outlook calendar and email to automatically sync meetings and conversations",
      icon: <Calendar className="w-8 h-8 text-blue-600" />,
      status: (outlookStatus as any)?.connected ? "connected" : "not_connected",
      type: "calendar_email"
    },
    {
      id: "salesforce",
      name: "Salesforce",
      description: "Connect your Salesforce CRM to pull account data, opportunities, and contact information",
      icon: <Building2 className="w-8 h-8 text-blue-500" />,
      status: (salesforceStatus as any)?.connected ? "connected" : "not_connected",
      type: "crm",
      scopes: (salesforceStatus as any)?.scopes || [],
      connectedAt: (salesforceStatus as any)?.connectedAt
    },
  ];

  const handleConnectIntegration = async (integrationId: string) => {
    if (integrationId === "google_calendar") {
      setConnectingId(integrationId);
      try {
        const response = await fetch("/api/integrations/google/auth");
        const data = await response.json();
        
        if (response.status === 501) {
          // Not configured message
          alert(data.message);
        } else if (data.authUrl) {
          // Redirect to Google OAuth
          window.location.href = data.authUrl;
        }
      } catch (error) {
        console.error("Error connecting Google:", error);
        alert("Failed to connect Google integration. Please try again.");
      } finally {
        setConnectingId(null);
      }
    } else if (integrationId === "outlook") {
      setConnectingId(integrationId);
      try {
        const response = await fetch("/api/integrations/outlook/setup");
        const data = await response.json();
        
        if (response.status === 501) {
          // Coming soon message
          alert(data.message);
        }
      } catch (error) {
        console.error("Error connecting Outlook:", error);
        alert("Failed to connect Outlook integration. Please try again.");
      } finally {
        setConnectingId(null);
      }
    } else if (integrationId === "salesforce") {
      setConnectingId(integrationId);
      try {
        const response = await fetch("/api/integrations/salesforce/auth");
        const data = await response.json();
        
        if (response.status === 501) {
          // Not configured message
          alert(data.message);
        } else if (data.authUrl) {
          // Redirect to Salesforce OAuth
          window.location.href = data.authUrl;
        }
      } catch (error) {
        console.error("Error connecting Salesforce:", error);
        alert("Failed to connect Salesforce integration. Please try again.");
      } finally {
        setConnectingId(null);
      }
    } else {
      // For other integrations, show coming soon
      const integration = integrations.find(i => i.id === integrationId);
      alert(`${integration?.name} integration coming soon! We're working on adding support for this platform.`);
    }
  };

  const handleDisconnectIntegration = async (integrationId: string) => {
    if (integrationId === "google_calendar") {
      setConnectingId(integrationId);
      try {
        const response = await fetch("/api/integrations/google", {
          method: "DELETE"
        });
        const data = await response.json();
        
        if (response.ok) {
          alert("Google integration disconnected successfully!");
          refetchGoogle();
        }
      } catch (error) {
        console.error("Error disconnecting Google:", error);
        alert("Failed to disconnect Google integration. Please try again.");
      } finally {
        setConnectingId(null);
      }
    } else if (integrationId === "outlook") {
      setConnectingId(integrationId);
      try {
        const response = await fetch("/api/integrations/outlook", {
          method: "DELETE"
        });
        const data = await response.json();
        
        if (response.ok) {
          alert("Outlook integration disconnected successfully!");
          refetchOutlook();
        }
      } catch (error) {
        console.error("Error disconnecting Outlook:", error);
        alert("Failed to disconnect Outlook integration. Please try again.");
      } finally {
        setConnectingId(null);
      }
    } else if (integrationId === "salesforce") {
      setConnectingId(integrationId);
      try {
        const response = await fetch("/api/integrations/salesforce", {
          method: "DELETE"
        });
        const data = await response.json();
        
        if (response.ok) {
          alert("Salesforce integration disconnected successfully!");
          refetchSalesforce();
        }
      } catch (error) {
        console.error("Error disconnecting Salesforce:", error);
        alert("Failed to disconnect Salesforce integration. Please try again.");
      } finally {
        setConnectingId(null);
      }
    }
  };

  // Check for pending prep retry after OAuth completion
  useEffect(() => {
    try {
      const pendingRetryStr = localStorage.getItem('pendingPrepRetry');
      if (!pendingRetryStr) return;

      const pendingRetry = JSON.parse(pendingRetryStr);
      const isRecent = Date.now() - pendingRetry.timestamp < 5 * 60 * 1000; // 5 minutes
      
      if (!isRecent) {
        localStorage.removeItem('pendingPrepRetry');
        return;
      }

      // Check if any integration is now connected
      const isGoogleConnected = (googleStatus as any)?.connected;
      const isSalesforceConnected = (salesforceStatus as any)?.connected;

      if (isGoogleConnected || isSalesforceConnected) {
        // Clear the pending retry and navigate back to call prep
        localStorage.removeItem('pendingPrepRetry');
        
        // Use a small delay to ensure the page has fully loaded
        setTimeout(() => {
          navigate(`/call/${pendingRetry.callId}?retry=true`);
        }, 100);
      }
    } catch (error) {
      console.error('Error checking pending prep retry:', error);
      localStorage.removeItem('pendingPrepRetry');
    }
  }, [googleStatus, salesforceStatus, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card border-b border-border px-6 py-4" data-testid="navigation">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            
            <div className="flex items-center space-x-2">
              <SettingsIcon className="w-6 h-6 text-primary" />
              <span className="text-xl font-semibold text-foreground">Settings</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {typedUser?.profileImageUrl && (
              <img
                src={typedUser.profileImageUrl}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
                data-testid="img-profile"
              />
            )}
            <span className="text-sm text-muted-foreground">
              {typedUser?.firstName && typedUser?.lastName 
                ? `${typedUser.firstName} ${typedUser.lastName}`
                : typedUser?.email
              }
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout} 
              className="flex items-center space-x-2" 
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Demo Mode Banner */}
        {isDemoMode && (
          <Card className="mb-6 border-purple-500 bg-purple-50 dark:bg-purple-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                    🎭 Demo Mode Active
                  </h3>
                  <p className="text-sm text-purple-700 dark:text-purple-200">
                    You're viewing Opus with sample data. No real integrations are needed in demo mode.
                  </p>
                </div>
                <Button onClick={handleExitDemo} variant="outline" size="sm">
                  Exit Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Integrations & Settings
          </h1>
          <p className="text-muted-foreground">
            Connect your tools to unlock AI-powered call preparation. The more data you connect,
            the better insights Opus can provide for your sales calls.
          </p>
        </div>

        {/* Integration Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {integrations.map((integration) => (
            <Card key={integration.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {integration.icon}
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                      <div className="mt-1">
                        <Badge variant={integration.status === "connected" ? "default" : "secondary"}>
                          {integration.status === "connected" ? "Connected" : "Not Connected"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                  {integration.description}
                </p>
                
                <div className="flex space-x-2">
                  {integration.status === "connected" ? (
                    <>
                      <Button variant="outline" size="sm" className="flex-1">
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleDisconnectIntegration(integration.id)}
                        disabled={connectingId === integration.id}
                      >
                        {connectingId === integration.id ? "Disconnecting..." : "Disconnect"}
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleConnectIntegration(integration.id)}
                      disabled={connectingId === integration.id}
                      data-testid={`button-connect-${integration.id}`}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {connectingId === integration.id ? "Connecting..." : `Connect ${integration.name}`}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Settings Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="font-medium">Profile Information</p>
                  <p className="text-sm text-muted-foreground">Update your name and profile picture</p>
                </div>
                <Button variant="outline" size="sm" data-testid="button-edit-profile">
                  Edit
                </Button>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="font-medium">Email Preferences</p>
                  <p className="text-sm text-muted-foreground">Manage notification settings</p>
                </div>
                <Button variant="outline" size="sm" data-testid="button-email-preferences">
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="font-medium">Research Depth</p>
                  <p className="text-sm text-muted-foreground">Configure how detailed AI insights should be</p>
                </div>
                <Button variant="outline" size="sm" data-testid="button-ai-settings">
                  Configure
                </Button>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="font-medium">Data Usage</p>
                  <p className="text-sm text-muted-foreground">Control what data is used for AI generation</p>
                </div>
                <Button variant="outline" size="sm" data-testid="button-data-usage">
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}