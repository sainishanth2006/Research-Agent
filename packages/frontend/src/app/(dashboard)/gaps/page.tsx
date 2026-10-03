'use client';

import { Lightbulb, Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function GapsPage() {
  const [query, setQuery] = useState('');
  const [paperIds, setPaperIds] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFindingGaps, setIsFindingGaps] = useState(false);
  const [gaps, setGaps] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('mrdu.gapPaperIds');
    if (stored) {
      try {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) setPaperIds(ids);
        sessionStorage.removeItem('mrdu.gapPaperIds');
      } catch {
        sessionStorage.removeItem('mrdu.gapPaperIds');
      }
    }
  }, []);

  const searchPapers = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 15 }),
      });
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (e) {
      setError('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const togglePaper = (paperId: string) => {
    setPaperIds(prev => prev.includes(paperId)
      ? prev.filter(id => id !== paperId)
      : [...prev, paperId]
    );
  };

  const findGaps = async () => {
    if (paperIds.length === 0) {
      setError('Please select at least one paper');
      return;
    }
    setIsFindingGaps(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/research/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, paper_ids: paperIds }),
      });
      const data = await response.json();
      setGaps(data.gaps || []);
    } catch (e) {
      setError('Failed to identify gaps');
    } finally {
      setIsFindingGaps(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Research Gaps</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Identify potential research opportunities from selected papers
        </p>
      </div>

      {/* Search & Select Papers */}
      <Card>
        <CardHeader>
          <CardTitle>Select Papers for Gap Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search papers (e.g., 'adaptive learning recommendation')..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Button
                onClick={searchPapers}
                disabled={isSearching || !query.trim()}
                className="ml-2"
              >
                Search
              </Button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((paper: any) => (
                <label
                  key={paper.external_id}
                  className={cn(
                    'flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-colors',
                    paperIds.includes(paper.external_id) && 'bg-primary/5 border-primary'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{paper.title}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {paper.authors?.slice(0, 2).join(', ')} · {paper.year}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={paperIds.includes(paper.external_id)}
                    onChange={() => togglePaper(paper.external_id)}
                    className="ml-4 h-4 w-4 text-primary"
                  />
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Papers */}
      {paperIds.length > 0 && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Selected Papers ({paperIds.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {paperIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1">
                  {searchResults.find(p => p.external_id === id)?.title?.slice(0, 30) || id}
                </Badge>
              ))}
            </div>
            <Button
              onClick={findGaps}
              disabled={isFindingGaps}
              className="w-full"
              size="lg"
            >
              {isFindingGaps ? 'Finding Gaps...' : 'Find Research Gaps'}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Gaps Results */}
      {gaps.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Identified Research Gaps ({gaps.length})</h2>
          <div className="space-y-4">
            {gaps.map((gap: any, index: number) => (
              <Card key={gap.id || index} className="border-yellow-200 dark:border-yellow-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-600 dark:text-yellow-400 text-2xl">💡</span>
                        <CardTitle className="text-lg">{gap.title}</CardTitle>
                      </div>
                      <Badge
                        variant={
                          gap.confidence === 'high' ? 'default' :
                          gap.confidence === 'medium' ? 'secondary' : 'outline'
                        }
                      >
                        {gap.confidence} confidence
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300">{gap.description?.text || gap.description}</p>
                  {gap.category && (
                    <Badge variant="outline" className="mt-2">
                      Category: {gap.category}
                    </Badge>
                  )}
                  {gap.supporting_papers?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Based on papers:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gap.supporting_papers.map((pid: string) => (
                          <Badge key={pid} variant="outline" className="text-xs">
                            {pid}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}