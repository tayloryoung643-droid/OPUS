import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AccountCandidate {
  id: string;
  name: string;
  domain?: string | null;
  confidence?: number;
  source?: string;
}

interface AccountSelectModalProps {
  open: boolean;
  onClose: () => void;
  candidates?: AccountCandidate[];
  onSelectCandidate: (candidate: AccountCandidate) => void;
  onSearch?: (term: string) => Promise<AccountCandidate[]>;
  isLinking?: boolean;
}

const PERSONAL_DOMAIN_HINTS = ["gmail.com", "outlook.com", "yahoo.com"];

export function AccountSelectModal({
  open,
  onClose,
  candidates = [],
  onSelectCandidate,
  onSearch,
  isLinking,
}: AccountSelectModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AccountCandidate[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const showSearch = useMemo(() => candidates.length === 0 || !!onSearch, [candidates.length, onSearch]);

  const candidateList = useMemo(() => {
    if (searchResults.length > 0) {
      return searchResults;
    }
    return candidates;
  }, [candidates, searchResults]);

  const handleSearch = useCallback(async () => {
    if (!onSearch || !searchTerm.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const results = await onSearch(searchTerm.trim());
      setSearchResults(results);
    } catch (error) {
      setSearchError((error as Error).message);
    } finally {
      setSearching(false);
    }
  }, [onSearch, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select an account</DialogTitle>
          <DialogDescription>
            Link an account to enrich the prep sheet with CRM insights.
          </DialogDescription>
        </DialogHeader>

        {showSearch && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search Salesforce accounts"
              />
              <Button onClick={handleSearch} disabled={!onSearch || searching}>
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>
            {searchError && <p className="text-sm text-destructive">{searchError}</p>}
            <p className="text-xs text-muted-foreground">
              Try searching by company name or domain. Avoid personal domains like {PERSONAL_DOMAIN_HINTS.join(", ")}.
            </p>
          </div>
        )}

        <ScrollArea className="mt-4 h-60 pr-2">
          <div className="space-y-3">
            {candidateList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {showSearch
                  ? "No results yet. Try searching for the account you want to link."
                  : "No account suggestions available for this event."}
              </p>
            ) : (
              candidateList.map((candidate) => (
                <div
                  key={candidate.id}
                  className={cn(
                    "rounded-lg border border-border p-3",
                    "flex items-center justify-between gap-3",
                  )}
                >
                  <div>
                    <p className="font-medium text-sm">{candidate.name}</p>
                    {(candidate.domain || candidate.confidence !== undefined) && (
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {candidate.domain && <span>{candidate.domain}</span>}
                        {candidate.confidence !== undefined && (
                          <Badge variant="secondary">Confidence {(candidate.confidence * 100).toFixed(0)}%</Badge>
                        )}
                        {candidate.source && <Badge variant="outline">{candidate.source}</Badge>}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onSelectCandidate(candidate)}
                    disabled={isLinking}
                  >
                    {isLinking ? "Linking…" : "Link"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose} disabled={isLinking}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
