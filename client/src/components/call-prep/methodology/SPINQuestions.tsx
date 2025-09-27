import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, AlertTriangle, TrendingUp, Target } from "lucide-react";

interface SPINQuestionsProps {
  spinQuestions?: {
    situation: string[];
    problem: string[];
    implication: string[];
    needPayoff: string[];
  };
}

export default function SPINQuestions({ spinQuestions }: SPINQuestionsProps) {
  if (!spinQuestions || !Object.values(spinQuestions).some(arr => arr.length > 0)) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <HelpCircle className="text-green-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">SPIN Discovery Questions</h2>
          </div>
          <p className="text-muted-foreground" data-testid="text-no-spin-questions">
            No SPIN questions available. Generate enhanced prep to get structured discovery questions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <HelpCircle className="text-green-600 h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold">SPIN Discovery Questions</h2>
        </div>
        
        <div className="space-y-4">
          {spinQuestions.situation.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Target className="h-4 w-4 text-blue-500" />
                <h4 className="font-semibold text-foreground">Situation Questions:</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                {spinQuestions.situation.map((question, index) => (
                  <li key={index} data-testid={`situation-question-${index}`} className="flex items-start space-x-2">
                    <span className="text-blue-500 font-bold mt-1">S:</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {spinQuestions.problem.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <h4 className="font-semibold text-foreground">Problem Questions:</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                {spinQuestions.problem.map((question, index) => (
                  <li key={index} data-testid={`problem-question-${index}`} className="flex items-start space-x-2">
                    <span className="text-orange-500 font-bold mt-1">P:</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {spinQuestions.implication.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="h-4 w-4 text-red-500" />
                <h4 className="font-semibold text-foreground">Implication Questions:</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                {spinQuestions.implication.map((question, index) => (
                  <li key={index} data-testid={`implication-question-${index}`} className="flex items-start space-x-2">
                    <span className="text-red-500 font-bold mt-1">I:</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {spinQuestions.needPayoff.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Target className="h-4 w-4 text-green-500" />
                <h4 className="font-semibold text-foreground">Need-Payoff Questions:</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                {spinQuestions.needPayoff.map((question, index) => (
                  <li key={index} data-testid={`needpayoff-question-${index}`} className="flex items-start space-x-2">
                    <span className="text-green-500 font-bold mt-1">N:</span>
                    <span>{question}</span>
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