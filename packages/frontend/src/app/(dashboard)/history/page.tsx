'use client';

import { Clock, Search, Loader2, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@mrdu/shared/utils';

export default function HistoryPage() {
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/backend/search/history');
      if (response.ok) {
        const data = await response.json();
        setSearchHistory(data.history || []);
      }
    } catch (e) {
      setError('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHistory = searchHistory.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'today') {
      const today = new Date().toDateString();
      return new Date(item.created_at).toDateString() === today;
    }
    if (filter === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return new Date(item.created_at) > weekAgo;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Search History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Your recent searches and research activity
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'today', 'week'].map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* History List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
              <p className="text-gray-600 dark:text-gray-400">Loading history...</p>
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredHistory.map((item: any, index: number) => (
                <div
                  key={item.id || index}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {item.query}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {item.result_count} results
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {formatRelativeTime(item.created_at)}
                      {item.filters && Object.keys(item.filters).length > 0 && (
                        <span className="ml-2 text-gray-400">· Filters applied</span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      window.location.href = `/research?query=${encodeURIComponent(item.query)}`;
                    }}
                  >
                    <ArrowRight className="w-4 h-4" />
                    Repeat
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">No search history yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Start searching to build your history
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}