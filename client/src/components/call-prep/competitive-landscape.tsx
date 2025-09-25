import { Card, CardContent } from "@/components/ui/card";
import { Trophy, TrendingUp } from "lucide-react";

interface CompetitiveLandscapeProps {
  landscape?: {
    primaryCompetitors: Array<{
      name: string;
      strengths: string[];
      weaknesses: string[];
      ourAdvantage: string;
    }>;
  };
}

export default function CompetitiveLandscape({ landscape }: CompetitiveLandscapeProps) {
  if (!landscape || !landscape.primaryCompetitors?.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Trophy className="text-red-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">Competitive Landscape</h2>
          </div>
          <p className="text-muted-foreground" data-testid="text-no-competitive-landscape">
            No competitive analysis available. Generate AI prep to get competitor insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <Trophy className="text-red-600 h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold">Competitive Landscape</h2>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-foreground mb-2">Primary Competitors:</h4>
          <div className="space-y-4">
            {landscape.primaryCompetitors.map((competitor, index) => (
              <div 
                key={index} 
                className="border-l-4 border-amber-400 pl-4"
                data-testid={`competitor-${index}`}
              >
                <h5 className="font-medium flex items-center mb-2">
                  <TrendingUp className="mr-2 h-4 w-4 text-amber-600" />
                  {competitor.name}
                </h5>
                <div className="text-sm text-muted-foreground space-y-1">
                  {competitor.strengths.length > 0 && (
                    <p>
                      <strong>Strengths:</strong> {competitor.strengths.join(", ")}
                    </p>
                  )}
                  {competitor.weaknesses.length > 0 && (
                    <p>
                      <strong>Weaknesses:</strong> {competitor.weaknesses.join(", ")}
                    </p>
                  )}
                  {competitor.ourAdvantage && (
                    <p>
                      <strong>Our advantage:</strong> {competitor.ourAdvantage}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
