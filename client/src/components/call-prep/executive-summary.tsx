import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface ExecutiveSummaryProps {
  summary?: string;
  contacts: Array<{
    email: string;
    firstName?: string;
    lastName?: string;
  }>;
  company: {
    name: string;
  } | null;
}

export default function ExecutiveSummary({ summary, contacts, company }: ExecutiveSummaryProps) {
  if (!summary) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="text-blue-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">Executive Summary</h2>
          </div>
          <p className="text-muted-foreground" data-testid="text-no-summary">
            No executive summary available. Generate AI prep to get insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="text-blue-600 h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold">Executive Summary</h2>
        </div>
        <div className="prose prose-sm max-w-none text-muted-foreground" data-testid="text-executive-summary">
          <p>{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
