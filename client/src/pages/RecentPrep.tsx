import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Calendar, Clock, FileText, ExternalLink } from "lucide-react";

interface PrepItem {
  id: string;
  eventId: string;
  title?: string;
  url: string;
  createdAt: string;
  eventTitle?: string;
  eventDate?: string;
}

export default function RecentPrep() {
  const { user } = useAuth();

  const { data: preps, isLoading } = useQuery<PrepItem[]>({
    queryKey: ["/api/recent-prep"],
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-indigo-900/80 to-violet-900/60 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 flex items-center gap-3">
            <FileText className="h-8 w-8" />
            Recent Prep Sheets
          </h1>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-white/10 border-white/20">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 bg-white/20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-1/2 bg-white/20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !preps || preps.length === 0 ? (
            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-12 text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 text-white/60" />
                <h2 className="text-xl font-semibold mb-2">No prep sheets yet</h2>
                <p className="text-white/70">
                  Generate your first AI-powered prep sheet from the Overview page.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {preps.map((prep) => (
                <Card
                  key={prep.id}
                  className="bg-white/10 border-white/20 hover:bg-white/15 transition-colors"
                  data-testid={`card-prep-${prep.id}`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-white" data-testid={`text-prep-title-${prep.id}`}>
                        {prep.eventTitle || prep.title || `Prep ${prep.id}`}
                      </span>
                      <a
                        href={prep.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        data-testid={`link-prep-${prep.id}`}
                      >
                        <ExternalLink className="h-5 w-5" />
                      </a>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm text-white/70">
                      {prep.eventDate && (
                        <div className="flex items-center gap-2" data-testid={`text-prep-date-${prep.id}`}>
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(prep.eventDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2" data-testid={`text-prep-created-${prep.id}`}>
                        <Clock className="h-4 w-4" />
                        <span>Created {new Date(prep.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-xs font-mono" data-testid={`text-prep-id-${prep.id}`}>
                          {prep.id}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
