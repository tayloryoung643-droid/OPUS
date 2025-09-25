import { Button } from "@/components/ui/button";
import { Settings, Sparkles } from "lucide-react";

export default function Navigation() {
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
          <Button variant="outline" size="icon" data-testid="button-settings">
            <Settings className="h-4 w-4" />
          </Button>
          <Button className="flex items-center space-x-2" data-testid="button-ask-ai">
            <Sparkles className="h-4 w-4" />
            <span>Ask AI</span>
          </Button>
          <span className="text-sm text-muted-foreground">Step 2 of 1</span>
        </div>
      </div>
    </nav>
  );
}
