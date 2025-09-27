import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, Users, DollarSign, Clock, AlertCircle, Trophy, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MEDDICChecklistProps {
  meddicChecklist?: {
    metrics: string;
    economicBuyer: string;
    decisionCriteria: string;
    decisionProcess: string;
    identifiedPain: string;
    champion: string;
    competition: string;
  };
}

export default function MEDDICChecklist({ meddicChecklist }: MEDDICChecklistProps) {
  if (!meddicChecklist) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <CheckSquare className="text-purple-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">MEDDIC Qualification</h2>
          </div>
          <p className="text-muted-foreground" data-testid="text-no-meddic-checklist">
            No MEDDIC assessment available. Generate enhanced prep to get qualification checklist.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (value: string) => {
    if (value.toLowerCase().includes('to be')) {
      return <Badge variant="secondary" className="ml-2">TBD</Badge>;
    }
    if (value.toLowerCase().includes('identified') || value.toLowerCase().includes('confirmed')) {
      return <Badge variant="default" className="ml-2 bg-green-100 text-green-800">Identified</Badge>;
    }
    return <Badge variant="outline" className="ml-2">In Progress</Badge>;
  };

  const meddicItems = [
    {
      key: 'metrics',
      label: 'Metrics',
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      value: meddicChecklist.metrics,
      description: 'Quantifiable business impact and success criteria'
    },
    {
      key: 'economicBuyer',
      label: 'Economic Buyer',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      value: meddicChecklist.economicBuyer,
      description: 'Person with authority to approve budget/purchase'
    },
    {
      key: 'decisionCriteria',
      label: 'Decision Criteria',
      icon: CheckSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      value: meddicChecklist.decisionCriteria,
      description: 'How they will evaluate and select a solution'
    },
    {
      key: 'decisionProcess',
      label: 'Decision Process',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      value: meddicChecklist.decisionProcess,
      description: 'Steps and timeline for making the decision'
    },
    {
      key: 'identifiedPain',
      label: 'Identified Pain',
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      value: meddicChecklist.identifiedPain,
      description: 'Critical business problem driving the need'
    },
    {
      key: 'champion',
      label: 'Champion',
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      value: meddicChecklist.champion,
      description: 'Internal advocate who will sell on your behalf'
    },
    {
      key: 'competition',
      label: 'Competition',
      icon: Trophy,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      value: meddicChecklist.competition,
      description: 'Competitive alternatives being considered'
    }
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <CheckSquare className="text-purple-600 h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold">MEDDIC Qualification</h2>
        </div>
        
        <div className="space-y-4">
          {meddicItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <div key={item.key} className="border-l-4 border-purple-400 pl-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-6 h-6 ${item.bgColor} rounded flex items-center justify-center`}>
                      <IconComponent className={`h-3 w-3 ${item.color}`} />
                    </div>
                    <h4 className="font-semibold text-foreground">{item.label}</h4>
                    {getStatusBadge(item.value)}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1" data-testid={`meddic-${item.key}`}>
                  {item.value}
                </p>
                <p className="text-xs text-muted-foreground/80 italic">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 p-3 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>MEDDIC Score:</strong> Focus on completing "TBD" items during this call to advance the qualification.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}