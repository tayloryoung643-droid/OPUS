import { Button } from "@/components/ui/button";
import { Settings, Sparkles, LogOut } from "lucide-react";
import { Link } from "wouter";

export default function Navigation() {
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <nav className="bg-card border-b border-border px-6 py-4" data-testid="navigation-dashboard">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">M</span>
          </div>
          <span className="text-xl font-semibold text-foreground">Momentum AI</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <Link href="/settings">
            <Button variant="outline" size="icon" data-testid="button-settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Button className="flex items-center space-x-2" data-testid="button-ask-ai">
            <Sparkles className="h-4 w-4" />
            <span>Ask AI</span>
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="flex items-center space-x-2" data-testid="button-logout">
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
