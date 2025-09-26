import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, TrendingUp, LogOut, Settings, Plus, Clock, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function Home() {
  const { user } = useAuth();
  const typedUser = user as User | undefined;

  // Fetch Google integration status and calendar data
  const { data: googleStatus } = useQuery({
    queryKey: ["/api/integrations/google/status"],
    enabled: true,
    retry: false
  });

  const { data: upcomingEvents } = useQuery({
    queryKey: ["/api/calendar/events"],
    enabled: !!(googleStatus as any)?.connected,
    retry: false
  });

  const { data: todaysEvents } = useQuery({
    queryKey: ["/api/calendar/today"],
    enabled: !!(googleStatus as any)?.connected,
    retry: false
  });

  const isGoogleConnected = (googleStatus as any)?.connected;
  const hasUpcomingEvents = upcomingEvents && Array.isArray(upcomingEvents) && upcomingEvents.length > 0;
  const hasTodaysEvents = todaysEvents && Array.isArray(todaysEvents) && todaysEvents.length > 0;

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const formatEventTime = (event: any) => {
    const start = event.start?.dateTime || event.start?.date;
    if (!start) return '';
    
    const date = new Date(start);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card border-b border-border px-6 py-4" data-testid="navigation">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-semibold text-foreground">Momentum AI</span>
          </div>

          <div className="flex items-center space-x-4">
            {typedUser && (
              <div className="flex items-center space-x-3">
                {typedUser.profileImageUrl && (
                  <img
                    src={typedUser.profileImageUrl}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover"
                    data-testid="img-profile"
                  />
                )}
                <span className="text-sm text-muted-foreground" data-testid="text-user-email">
                  {typedUser.firstName && typedUser.lastName 
                    ? `${typedUser.firstName} ${typedUser.lastName}`
                    : typedUser.email
                  }
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="button-settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <Link href="/settings">
                      <DropdownMenuItem data-testid="menu-settings">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings & Integrations
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/profile">
                      <DropdownMenuItem data-testid="menu-profile">
                        <Users className="w-4 h-4 mr-2" />
                        Profile
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-welcome">
            Welcome back{typedUser?.firstName ? `, ${typedUser.firstName}` : ""}!
          </h1>
          <p className="text-muted-foreground">
            {isGoogleConnected 
              ? "Here's your personalized dashboard with AI-powered insights." 
              : "Connect your integrations to start generating AI-powered call preparation sheets."
            }
          </p>
        </div>

        {!isGoogleConnected ? (
          /* Empty State - No Integrations Connected */
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="max-w-md text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Settings className="w-8 h-8 text-primary" />
              </div>
              
              <h2 className="text-2xl font-semibold text-foreground mb-3">
                No Integrations Connected
              </h2>
              
              <p className="text-muted-foreground mb-8 leading-relaxed">
                To start generating personalized call preparation sheets, connect your calendar, 
                CRM, and email accounts. Our AI will analyze your data to provide valuable insights 
                for every sales call.
              </p>
              
              <div className="space-y-3">
                <Link href="/settings">
                  <Button size="lg" className="w-full" data-testid="button-connect-integrations">
                    <Plus className="w-4 h-4 mr-2" />
                    Connect Your First Integration
                  </Button>
                </Link>
                
                <Link href="/settings">
                  <Button variant="outline" size="lg" className="w-full" data-testid="button-view-settings">
                    <Settings className="w-4 h-4 mr-2" />
                    View All Settings
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Connected State - Show Real Data */
          <>
            {/* Today's Calendar Events */}
            {hasTodaysEvents && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">Today's Schedule</h2>
                <div className="space-y-3">
                  {(todaysEvents as any[])?.slice(0, 3).map((event: any) => (
                    <Card key={event.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{event.summary}</h3>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {formatEventTime(event)}
                              </div>
                              {event.location && (
                                <div className="flex items-center">
                                  <MapPin className="w-4 h-4 mr-1" />
                                  {event.location}
                                </div>
                              )}
                            </div>
                            {event.attendees && event.attendees.length > 0 && (
                              <div className="mt-2 text-sm text-muted-foreground">
                                {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          <Button size="sm" variant="outline">
                            Prep Call
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Upcoming Calls Card */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                    Upcoming Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-upcoming-calls">
                    {hasUpcomingEvents ? (upcomingEvents as any[]).length : '0'}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    In the next 7 days
                  </p>
                  <Link href="/">
                    <Button size="sm" className="w-full" data-testid="button-view-calls">
                      View Calls
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Integration Status Card */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Settings className="w-5 h-5 mr-2 text-green-600" />
                    Integrations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground mb-1">
                    ✓
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Google Calendar connected
                  </p>
                  <Link href="/settings">
                    <Button size="sm" variant="outline" className="w-full" data-testid="button-manage-integrations">
                      Manage Integrations
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Quick Actions Card */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button size="sm" className="w-full justify-start" data-testid="button-prepare-next-call">
                      <Calendar className="w-4 h-4 mr-2" />
                      Prepare Next Call
                    </Button>
                    <Link href="/settings">
                      <Button size="sm" variant="outline" className="w-full justify-start" data-testid="button-add-integration">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Integration
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Events List */}
            {hasUpcomingEvents && (
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Calendar Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(upcomingEvents as any[])?.slice(0, 5).map((event: any) => (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{event.summary}</h4>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(event.start?.dateTime || event.start?.date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {formatEventTime(event)}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Prepare
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}