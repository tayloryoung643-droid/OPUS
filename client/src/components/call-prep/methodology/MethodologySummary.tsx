import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Target, Zap, HelpCircle, CheckSquare, DollarSign, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface MethodologySummaryProps {
  methodologySummary?: string;
  contextAnalysis?: string;
  callType?: string;
  dealStage?: string;
  complexity?: string;
}

export default function MethodologySummary({ 
  methodologySummary, 
  contextAnalysis,
  callType,
  dealStage,
  complexity
}: MethodologySummaryProps) {
  if (!methodologySummary && !contextAnalysis) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-indigo-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">Methodology Mix</h2>
          </div>
          <p className="text-muted-foreground" data-testid="text-no-methodology-summary">
            No methodology analysis available. Generate enhanced prep to get strategic approach.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Parse methodology percentages from summary string
  const parseMethodologyMix = (summary: string) => {
    const methodologies = [
      { name: 'SPIN', icon: HelpCircle, color: 'text-green-600' },
      { name: 'MEDDIC', icon: CheckSquare, color: 'text-purple-600' },
      { name: 'BANT', icon: DollarSign, color: 'text-blue-600' },
      { name: 'Challenger', icon: Zap, color: 'text-red-600' },
      { name: 'Sandler', icon: Target, color: 'text-orange-600' },
      { name: 'Solution', icon: Users, color: 'text-indigo-600' }
    ];

    return methodologies.map(methodology => {
      const regex = new RegExp(`${methodology.name}[^\\d]*(\\d+)%`, 'i');
      const match = summary.match(regex);
      const percentage = match ? parseInt(match[1]) : 0;
      return {
        ...methodology,
        percentage
      };
    }).filter(m => m.percentage > 0).sort((a, b) => b.percentage - a.percentage);
  };

  const methodologyMix = methodologySummary ? parseMethodologyMix(methodologySummary) : [];

  const getComplexityColor = (complexity?: string) => {
    if (!complexity) return 'bg-gray-100 text-gray-800';
    if (complexity.toLowerCase().includes('low')) return 'bg-green-100 text-green-800';
    if (complexity.toLowerCase().includes('medium')) return 'bg-yellow-100 text-yellow-800';
    if (complexity.toLowerCase().includes('high')) return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getStageColor = (stage?: string) => {
    if (!stage) return 'bg-gray-100 text-gray-800';
    if (stage.toLowerCase().includes('discovery')) return 'bg-blue-100 text-blue-800';
    if (stage.toLowerCase().includes('qualification')) return 'bg-orange-100 text-orange-800';
    if (stage.toLowerCase().includes('proposal')) return 'bg-purple-100 text-purple-800';
    if (stage.toLowerCase().includes('negotiation')) return 'bg-red-100 text-red-800';
    if (stage.toLowerCase().includes('closed')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="text-indigo-600 h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold">Methodology Strategy</h2>
        </div>
        
        <div className="space-y-4">
          {/* Context Analysis */}
          {contextAnalysis && (
            <div className="flex items-center space-x-2 mb-4">
              <Badge variant="outline">{callType}</Badge>
              <Badge className={getStageColor(dealStage)}>{dealStage}</Badge>
              <Badge className={getComplexityColor(complexity)}>{complexity} Complexity</Badge>
            </div>
          )}

          {/* Methodology Mix */}
          {methodologyMix.length > 0 && (
            <div>
              <h4 className="font-semibold text-foreground mb-3">Recommended Methodology Mix:</h4>
              <div className="space-y-3">
                {methodologyMix.map((methodology, index) => {
                  const IconComponent = methodology.icon;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <IconComponent className={`h-4 w-4 ${methodology.color}`} />
                          <span className="font-medium text-foreground">{methodology.name}</span>
                        </div>
                        <span className="text-sm font-medium">{methodology.percentage}%</span>
                      </div>
                      <Progress value={methodology.percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Raw Summary */}
          {methodologySummary && (
            <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 rounded-r-lg">
              <h4 className="font-semibold text-indigo-800 mb-2">Strategic Approach:</h4>
              <p className="text-sm text-indigo-700" data-testid="text-methodology-summary">
                {methodologySummary}
              </p>
            </div>
          )}

          {/* Strategy Tips */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h5 className="font-medium text-gray-800 mb-2">Multi-Methodology Tips:</h5>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Start with the highest-weighted methodology for initial approach</li>
              <li>• Blend techniques naturally throughout the conversation</li>
              <li>• Adapt based on customer responses and engagement level</li>
              <li>• Use SPIN for discovery, MEDDIC for qualification, Challenger for insights</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}