import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, TrendingUp, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const typedUser = user as User | undefined;

  const handleLogout = () => {
    window.location.href = "/api/logout";
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
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
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
            Get ready for your upcoming calls with AI-powered preparation.
          </p>
        </div>

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
                3
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                In the next 7 days
              </p>
              <Link href="/dashboard">
                <Button size="sm" className="w-full" data-testid="button-view-calls">
                  View Calls
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Prospects Card */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Users className="w-5 h-5 mr-2 text-green-600" />
                Active Prospects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-prospects">
                12
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Companies in pipeline
              </p>
              <Link href="/dashboard">
                <Button size="sm" variant="outline" className="w-full" data-testid="button-view-prospects">
                  View Prospects
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Performance Card */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-conversion">
                65%
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Call-to-close rate
              </p>
              <Button size="sm" variant="outline" className="w-full" data-testid="button-view-analytics">
                View Analytics
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/dashboard">
                <Button className="w-full justify-start" data-testid="button-prepare-call">
                  <Calendar className="w-4 h-4 mr-2" />
                  Prepare for Next Call
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full justify-start" data-testid="button-add-prospect">
                  <Users className="w-4 h-4 mr-2" />
                  Add New Prospect
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Call prep generated for TechCorp</span>
                  <span>2h ago</span>
                </div>
                <div className="flex justify-between">
                  <span>New prospect: DataFlow Solutions</span>
                  <span>1d ago</span>
                </div>
                <div className="flex justify-between">
                  <span>Meeting completed with InnovateAI</span>
                  <span>2d ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}