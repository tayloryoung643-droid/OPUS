import { Button } from "@/components/ui/button";
import { Settings, Sparkles, LogOut, Sun, Moon } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeProvider";

export default function Navigation() {
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <nav className="bg-card border-b border-border px-6 py-4" data-testid="navigation-dashboard">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Opus Logo Circle */}
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center relative">
            <div className="w-6 h-6 border-2 border-white rounded-full flex items-center justify-center">
              <div className="w-1 h-3 bg-white rounded-full"></div>
              <div className="w-1 h-2 bg-white rounded-full ml-0.5"></div>
              <div className="w-1 h-4 bg-white rounded-full ml-0.5"></div>
            </div>
          </div>
          <span className="text-xl font-semibold text-foreground">Opus</span>
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>
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
