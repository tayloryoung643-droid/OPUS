import { Card, CardContent } from "@/components/ui/card";
import { Zap, Lightbulb, TrendingUp } from "lucide-react";

interface ChallengerInsightsProps {
  challengerInsights?: string[];
}

export default function ChallengerInsights({ challengerInsights }: ChallengerInsightsProps) {
  if (!challengerInsights || challengerInsights.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Zap className="text-red-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">Challenger Insights</h2>
          </div>
          <p className="text-muted-foreground" data-testid="text-no-challenger-insights">
            No challenger insights available. Generate enhanced prep to get disruptive insights.
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
            <Zap className="text-red-600 h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold">Challenger Insights</h2>
        </div>
        
        <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Lightbulb className="h-4 w-4 text-red-600" />
              <h4 className="font-semibold text-red-800">Teach, Tailor, Take Control</h4>
            </div>
            <p className="text-xs text-red-700 mb-3">
              Challenge the customer's thinking with compelling insights that reframe their problem and create urgency for change.
            </p>
          </div>
          
          <div className="space-y-3">
            {challengerInsights.map((insight, index) => (
              <div 
                key={index}
                className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border-l-4 border-orange-400"
                data-testid={`challenger-insight-${index}`}
              >
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingUp className="h-3 w-3 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <h5 className="font-medium text-orange-800 mb-1">Challenger Approach Tips:</h5>
            <ul className="text-xs text-orange-700 space-y-1">
              <li>• Present unexpected insights about their industry or market</li>
              <li>• Challenge assumptions about their current approach</li>
              <li>• Create urgency by highlighting hidden costs of inaction</li>
              <li>• Position yourself as a trusted advisor, not just a vendor</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}