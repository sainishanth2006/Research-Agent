'use client';

import { GitCompare, Loader2, Plus, Minus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ComparePage() {
  const [paperIds, setPaperIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparison, setComparison] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('mrdu.comparePaperIds');
    if (stored) {
      try {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) setPaperIds(ids.slice(0, 5));
        sessionStorage.removeItem('mrdu.comparePaperIds');
      } catch {
        sessionStorage.removeItem('mrdu.comparePaperIds');
      }
    }
  }, []);

  const searchPapers = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 10 }),
      });
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (e) {
      setError('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const addPaper = (paperId: string) => {
    if (!paperIds.includes(paperId) && paperIds.length < 5) {
      setPaperIds([...paperIds, paperId]);
    }
  };

  const removePaper = (paperId: string) => {
    setPaperIds(paperIds.filter(id => id !== paperId));
  };

  const handleCompare = async () => {
    if (paperIds.length < 2) {
      setError('Please select at least 2 papers to compare');
      return;
    }
    setIsComparing(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/research/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_ids: paperIds }),
      });
      const data = await response.json();
      setComparison(data);
    } catch (e) {
      setError('Comparison failed');
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Compare Papers</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Select 2-5 papers to compare side by side
        </p>
      </div>

      {/* Search & Add Papers */}
      <Card>
        <CardHeader>
          <CardTitle>Select Papers to Compare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search papers to add..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Button
                onClick={searchPapers}
                disabled={isSearching || !searchQuery.trim()}
                className="ml-2"
              >
                Search
              </Button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((paper: any) => (
                <div
                  key={paper.external_id}
                  className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{paper.title}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {paper.authors?.slice(0, 2).join(', ')} · {paper.year}
                    </p>
                  </div>
                  <Button
                    variant={paperIds.includes(paper.external_id) ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => addPaper(paper.external_id)}
                    disabled={paperIds.length >= 5 && !paperIds.includes(paper.external_id)}
                  >
                    {paperIds.includes(paper.external_id) ? 'Added' : 'Add'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Papers */}
      {paperIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Papers ({paperIds.length}/5)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {paperIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1">
                  {searchResults.find(p => p.external_id === id)?.title?.slice(0, 30) || id}
                  <button
                    onClick={() => removePaper(id)}
                    className="ml-1 hover:text-red-500"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {paperIds.length >= 2 && (
              <Button
                onClick={handleCompare}
                disabled={isComparing}
                className="mt-4 w-full"
                size="lg"
              >
                {isComparing ? 'Comparing...' : 'Compare Papers'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-2 font-medium">Feature</th>
                    {comparison.papers.map((p: any) => (
                      <th key={p.id} className="text-left p-2 font-medium truncate max-w-xs">
                        {p.title?.slice(0, 40)}...
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row: any) => (
                    <tr key={row.feature} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="p-2 font-medium">{row.feature}</td>
                      {comparison.papers.map((p: any) => (
                        <td key={p.id} className="p-2">
                          <pre className="whitespace-pre-wrap text-xs max-h-32 overflow-y-auto">
                            {JSON.stringify(row.values[p.id] || {}, null, 2)}
                          </pre>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}