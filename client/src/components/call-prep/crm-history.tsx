import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";

interface CrmHistoryProps {
  history?: string;
}

export default function CrmHistory({ history }: CrmHistoryProps) {
  if (!history) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <History className="text-purple-600 h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">CRM History</h2>
          </div>
          <p className="text-muted-foreground" data-testid="text-no-crm-history">
            No CRM history available. Generate AI prep to get conversation insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <History className="text-purple-600 h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold">CRM History</h2>
        </div>
        <div className="prose prose-sm max-w-none text-muted-foreground" data-testid="text-crm-history">
          <p>{history}</p>
        </div>
      </CardContent>
    </Card>
  );
}
