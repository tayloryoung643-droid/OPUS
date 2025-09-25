import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, ExternalLink } from "lucide-react";

interface RecentNewsProps {
  news: string[];
}

export default function RecentNews({ news }: RecentNewsProps) {
  if (!news || news.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Newspaper className="text-blue-600 h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold">Recent News</h2>
          </div>
          <p className="text-muted-foreground text-sm" data-testid="text-no-recent-news">
            No recent news available.
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
            <Newspaper className="text-blue-600 h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold">Recent News</h2>
        </div>
        
        <div className="space-y-3 text-sm">
          {news.map((item, index) => (
            <div 
              key={index} 
              className="flex items-start space-x-2"
              data-testid={`news-item-${index}`}
            >
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="font-medium text-foreground mb-2">Sources:</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center space-x-2">
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Company Press Releases</span>
            </div>
            <div className="flex items-center space-x-2">
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Industry News Sources</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
