import { Card, CardContent } from "@/components/ui/card";
import { Shield, MessageCircle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ObjectionHandlingProps {
  objectionHandling?: Array<{
    objection: string;
    response: string;
    methodology: string;
  }>;
}

export default function ObjectionHandling({ objectionHandling }: ObjectionHandlingProps) {
  if (!objectionHandling || objectionHandling.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Shield className="text-amber-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">Objection Handling</h2>
          </div>
          <p className="text-muted-foreground" data-testid="text-no-objection-handling">
            No objection handling guidance available. Generate enhanced prep to get response strategies.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getMethodologyColor = (methodology: string) => {
    const lower = methodology.toLowerCase();
    if (lower.includes('sandler')) return 'bg-blue-100 text-blue-800';
    if (lower.includes('challenger')) return 'bg-red-100 text-red-800';
    if (lower.includes('spin')) return 'bg-green-100 text-green-800';
    if (lower.includes('meddic')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <Shield className="text-amber-600 h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold">Objection Handling</h2>
        </div>
        
        <div className="space-y-4">
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
            <h4 className="font-semibold text-amber-800 mb-1">Preparation Strategy</h4>
            <p className="text-sm text-amber-700">
              Anticipate common objections and prepare methodology-specific responses to maintain conversation momentum and control.
            </p>
          </div>
          
          <div className="space-y-4">
            {objectionHandling.map((item, index) => (
              <div 
                key={index}
                className="border border-gray-200 rounded-lg p-4 space-y-3"
                data-testid={`objection-${index}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1">
                    <MessageCircle className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900 mb-1">Likely Objection:</h5>
                      <p className="text-sm text-gray-700 italic">"{item.objection}"</p>
                    </div>
                  </div>
                  <Badge className={getMethodologyColor(item.methodology)}>
                    {item.methodology}
                  </Badge>
                </div>
                
                <div className="flex items-center space-x-2 text-gray-400">
                  <ArrowRight className="h-4 w-4" />
                  <span className="text-xs font-medium">RESPONSE STRATEGY</span>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {item.response}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h5 className="font-medium text-gray-800 mb-2">Universal Objection Handling Framework:</h5>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <p className="font-medium">Listen</p>
                <p className="text-gray-600">Acknowledge fully</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
                  <span className="text-green-600 font-bold">2</span>
                </div>
                <p className="font-medium">Clarify</p>
                <p className="text-gray-600">Ask follow-up questions</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-1">
                  <span className="text-orange-600 font-bold">3</span>
                </div>
                <p className="font-medium">Respond</p>
                <p className="text-gray-600">Address with evidence</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-1">
                  <span className="text-purple-600 font-bold">4</span>
                </div>
                <p className="font-medium">Advance</p>
                <p className="text-gray-600">Move forward</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}