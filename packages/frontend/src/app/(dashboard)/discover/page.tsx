'use client';

import { Search, Filter, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function DiscoverPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    yearFrom: '',
    yearTo: '',
    minCitations: '',
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/backend/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          limit: 20,
          filters: {
            ...(filters.yearFrom && { yearFrom: Number(filters.yearFrom) }),
            ...(filters.yearTo && { yearTo: Number(filters.yearTo) }),
            ...(filters.minCitations && { minCitations: Number(filters.minCitations) }),
          },
        }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Search failed');
      }
      setResults(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Discover Papers</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Browse and search academic papers by topic, keyword, or filter
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[300px]">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by topic, keyword, author..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <Button type="submit" disabled={isLoading} className="px-6 py-3">
                {isLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>

            <div className="flex gap-4 flex-wrap border-t pt-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year From</label>
                <input
                  type="number"
                  value={filters.yearFrom}
                  onChange={(e) => setFilters({...filters, yearFrom: e.target.value})}
                  placeholder="2020"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year To</label>
                <input
                  type="number"
                  value={filters.yearTo}
                  onChange={(e) => setFilters({...filters, yearTo: e.target.value})}
                  placeholder="2024"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Citations</label>
                <input
                  type="number"
                  value={filters.minCitations}
                  onChange={(e) => setFilters({...filters, minCitations: e.target.value})}
                  placeholder="10"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Results</h2>
        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((paper: any, index: number) => (
              <div key={paper.id || paper.external_id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  <span className="text-2xl font-bold text-gray-300 dark:text-gray-600 w-10 text-right">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      className="text-left font-semibold text-gray-900 dark:text-white hover:text-primary hover:underline"
                      onClick={() => router.push(`/paper/${encodeURIComponent(paper.external_id || paper.id)}`)}
                    >
                      {paper.title}
                    </button>
                    <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {paper.authors?.slice(0, 3).map((a: string, i: number) => (
                        <span key={i}>{a}{i < 2 ? ', ' : ''}</span>
                      ))}
                      {paper.authors?.length > 3 && <span>+{paper.authors.length - 3} more</span>}
                      {paper.year && <span>· {paper.year}</span>}
                      {paper.venue && <span>· {paper.venue}</span>}
                    </div>
                    {paper.abstract && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{paper.abstract}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 ml-4">
                    <span className="text-xs text-gray-500">Relevance</span>
                    <div className="flex flex-col gap-1">
                      {paper.relevance && Object.entries(paper.relevance).map(([key, value]) => (
                        <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded text-xs capitalize ${key === 'high' ? 'bg-green-100 text-green-800' : key === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!results.length && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Enter a search query to discover papers</p>
          </div>
        )}
      </div>
    </div>
  );
}