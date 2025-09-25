import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

interface KeyStakeholdersProps {
  contacts: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    role?: string;
  }>;
}

export default function KeyStakeholders({ contacts }: KeyStakeholdersProps) {
  if (!contacts || contacts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="text-green-600 h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold">Key Stakeholders</h2>
          </div>
          <p className="text-muted-foreground text-sm" data-testid="text-no-stakeholders">
            No stakeholders identified.
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
            <Users className="text-green-600 h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold">Key Stakeholders</h2>
        </div>
        
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div 
              key={contact.id} 
              className="pb-3 border-b border-border last:border-b-0"
              data-testid={`stakeholder-${contact.id}`}
            >
              <p className="font-medium text-foreground" data-testid={`text-stakeholder-email-${contact.id}`}>
                {contact.email}
              </p>
              {contact.title && (
                <p className="text-sm text-muted-foreground" data-testid={`text-stakeholder-title-${contact.id}`}>
                  {contact.title}
                </p>
              )}
              <p className="text-sm text-muted-foreground" data-testid={`text-stakeholder-role-${contact.id}`}>
                {contact.role || "Stakeholder"}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
