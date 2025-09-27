import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Shield, AlertCircle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BANTAssessmentProps {
  bantAssessment?: {
    budget: string;
    authority: string;
    need: string;
    timeline: string;
  };
}

export default function BANTAssessment({ bantAssessment }: BANTAssessmentProps) {
  if (!bantAssessment) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-blue-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">BANT Assessment</h2>
          </div>
          <p className="text-muted-foreground" data-testid="text-no-bant-assessment">
            No BANT assessment available. Generate enhanced prep to get qualification status.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getQualificationScore = (value: string): number => {
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('confirmed') || lowerValue.includes('identified') || lowerValue.includes('high')) return 100;
    if (lowerValue.includes('likely') || lowerValue.includes('medium')) return 75;
    if (lowerValue.includes('possible') || lowerValue.includes('low')) return 50;
    if (lowerValue.includes('to be') || lowerValue.includes('unknown')) return 25;
    return 50; // Default middle score
  };

  const getScoreColor = (score: number): string => {
    if (score >= 75) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const bantItems = [
    {
      key: 'budget',
      label: 'Budget',
      icon: DollarSign,
      color: 'text-green-600',
      value: bantAssessment.budget,
      score: getQualificationScore(bantAssessment.budget),
      description: 'Financial capacity to make the purchase'
    },
    {
      key: 'authority',
      label: 'Authority',
      icon: Shield,
      color: 'text-blue-600',
      value: bantAssessment.authority,
      score: getQualificationScore(bantAssessment.authority),
      description: 'Decision-making power or influence'
    },
    {
      key: 'need',
      label: 'Need',
      icon: AlertCircle,
      color: 'text-red-600',
      value: bantAssessment.need,
      score: getQualificationScore(bantAssessment.need),
      description: 'Business problem or requirement'
    },
    {
      key: 'timeline',
      label: 'Timeline',
      icon: Clock,
      color: 'text-purple-600',
      value: bantAssessment.timeline,
      score: getQualificationScore(bantAssessment.timeline),
      description: 'Urgency and timeframe for decision'
    }
  ];

  const overallScore = Math.round(bantItems.reduce((sum, item) => sum + item.score, 0) / bantItems.length);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-blue-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">BANT Assessment</h2>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-muted-foreground">Overall Score</p>
            <p className={`text-lg font-bold ${overallScore >= 75 ? 'text-green-600' : overallScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {overallScore}%
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          {bantItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <div key={item.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className={`h-4 w-4 ${item.color}`} />
                    <h4 className="font-semibold text-foreground">{item.label}</h4>
                  </div>
                  <span className="text-sm font-medium">{item.score}%</span>
                </div>
                <Progress value={item.score} className="h-2" />
                <p className="text-sm text-muted-foreground" data-testid={`bant-${item.key}`}>
                  {item.value}
                </p>
                <p className="text-xs text-muted-foreground/80 italic">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
        
        <div className={`mt-6 p-3 rounded-lg ${overallScore >= 75 ? 'bg-green-50' : overallScore >= 50 ? 'bg-yellow-50' : 'bg-red-50'}`}>
          <p className={`text-sm ${overallScore >= 75 ? 'text-green-800' : overallScore >= 50 ? 'text-yellow-800' : 'text-red-800'}`}>
            <strong>
              {overallScore >= 75 ? 'Qualified Lead' : overallScore >= 50 ? 'Moderate Qualification' : 'Needs More Discovery'}:
            </strong>{' '}
            {overallScore >= 75 
              ? 'Strong BANT qualification - prioritize this opportunity'
              : overallScore >= 50 
              ? 'Some gaps remain - focus on improving weaker areas'
              : 'Significant qualification work needed before advancing'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}