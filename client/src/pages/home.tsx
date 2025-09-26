import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, TrendingUp, LogOut, Settings, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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
            Connect your integrations to start generating AI-powered call preparation sheets.
          </p>
        </div>

        {/* Empty State - No Integrations Connected */}
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
      </div>
    </div>
  );
}