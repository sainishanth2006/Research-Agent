'use client';

import { Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function TimelinePage() {
  const [paperId, setPaperId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeline, setTimeline] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialPaperId = new URLSearchParams(window.location.search).get('paperId');
    if (initialPaperId) setPaperId(initialPaperId);
  }, []);

  const fetchTimeline = async () => {
    if (!paperId.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/research/timeline/before-after', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_id: paperId, limit: 10 }),
      });
      if (!response.ok) throw new Error('Paper not found');
      const data = await response.json();
      setTimeline(data);
    } catch (e) {
      setError('Failed to load timeline. Please check the paper ID.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Research Timeline</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Explore papers before and after a given paper
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enter Paper ID</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <input
              type="text"
              value={paperId}
              onChange={(e) => setPaperId(e.target.value)}
              placeholder="Enter paper ID (e.g., cmusax001)"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            />
            <Button onClick={fetchTimeline} disabled={isLoading || !paperId.trim()}>
              {isLoading ? 'Loading...' : 'Load Timeline'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {timeline && (
        <div className="space-y-6">
          {/* Before Papers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChevronLeft className="w-5 h-5 text-blue-600" />
                Papers Before ({timeline.before?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.before?.length > 0 ? (
                <div className="space-y-3">
                  {timeline.before.map((paper: any, index: number) => (
                    <div key={paper.id} className="flex gap-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-8 text-right">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">{paper.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {paper.authors?.slice(0, 2).join(', ')} · {paper.year} · {paper.venue}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No papers found before this paper</p>
              )}
            </CardContent>
          </Card>

          {/* Current Paper */}
          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600" />
            <div className="relative flex items-center justify-center py-4">
              <div className="w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-gray-900 shadow-lg" />
            </div>
          </div>

          {/* After Papers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChevronRight className="w-5 h-5 text-green-600" />
                Papers After ({timeline.after?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.after?.length > 0 ? (
                <div className="space-y-3">
                  {timeline.after.map((paper: any, index: number) => (
                    <div key={paper.id} className="flex gap-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-8 text-right">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">{paper.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {paper.authors?.slice(0, 2).join(', ')} · {paper.year} · {paper.venue}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No papers found after this paper</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}