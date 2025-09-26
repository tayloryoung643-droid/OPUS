import Navigation from "@/components/ui/navigation";
import { PrepSheetView } from "@/features/prep-sheet/PrepSheetView";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

export default function PrepSheetPage() {
  const [, params] = useRoute("/prep-sheet/:eventId");
  const eventId = params?.eventId;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {eventId ? (
            <PrepSheetView eventId={eventId} />
          ) : (
            <Card>
              <CardContent className="py-6">
                <p className="text-muted-foreground">
                  Select a calendar event to generate a prep sheet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
