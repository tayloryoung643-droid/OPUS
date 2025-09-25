import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, Zap, TrendingUp } from "lucide-react";

interface SuggestedOpportunitiesProps {
  immediate: string[];
  strategic: string[];
}

export default function SuggestedOpportunities({ immediate, strategic }: SuggestedOpportunitiesProps) {
  const hasOpportunities = immediate.length > 0 || strategic.length > 0;

  if (!hasOpportunities) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Lightbulb className="text-yellow-600 h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold">Suggested Opportunities</h2>
          </div>
          <p className="text-muted-foreground text-sm" data-testid="text-no-opportunities">
            No opportunities identified. Generate AI prep to get suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Lightbulb className="text-yellow-600 h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold">Suggested Opportunities</h2>
        </div>
        
        <div className="space-y-4">
          {immediate.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <h4 className="font-medium text-foreground">Immediate Opportunities:</h4>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                {immediate.map((opportunity, index) => (
                  <li key={index} data-testid={`immediate-opportunity-${index}`}>
                    • {opportunity}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {strategic.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <h4 className="font-medium text-foreground">Strategic Expansion:</h4>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                {strategic.map((expansion, index) => (
                  <li key={index} data-testid={`strategic-expansion-${index}`}>
                    • {expansion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
