'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileText, Download, Share2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'methodology', label: 'Methodology' },
  { id: 'dataset', label: 'Dataset' },
  { id: 'findings', label: 'Key Findings' },
  { id: 'limitations', label: 'Limitations' },
  { id: 'future', label: 'Future Work' },
  { id: 'qa', label: 'Q&A' },
];

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  
  const [paper, setPaper] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaper();
  }, [paperId]);

  const fetchPaper = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const paperRes = await fetch(`/api/backend/papers/${encodeURIComponent(paperId)}`);
      
      const paperData = await paperRes.json().catch(() => null);
      if (!paperRes.ok) {
        throw new Error(paperData?.detail || paperData?.message || 'Paper not found');
      }
      
      setPaper(paperData);

      const analysisRes = await fetch(`/api/backend/papers/${encodeURIComponent(paperId)}/analysis`);
      if (analysisRes.ok) {
        const analysisData = await analysisRes.json().catch(() => null);
        setAnalysis(analysisData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load paper');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaQuestion.trim() || qaLoading) return;
    
    setQaLoading(true);
    setQaAnswer(null);
    try {
      const response = await fetch(`/api/backend/papers/${paperId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: qaQuestion }),
      });
      const result = await response.json();
      setQaAnswer(result.answer || 'No answer available');
    } catch (e) {
      setQaAnswer('Error getting answer');
    } finally {
      setQaLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Failed to load paper</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
          <Button onClick={() => router.push('/research')} className="mt-4">
            Back to Search
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Paper Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-3">
                {paper.source && (
                  <Badge variant="secondary">{paper.source.toUpperCase()}</Badge>
                )}
                {paper.year && <Badge variant="outline">{paper.year}</Badge>}
                {paper.venue && <Badge variant="outline">{paper.venue}</Badge>}
                {paper.doi && <Badge variant="outline">DOI</Badge>}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                {paper.title}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span>{paper.authors?.slice(0, 5).join(', ')}</span>
                {paper.authors?.length > 5 && <span>+{paper.authors.length - 5} more</span>}
              </div>
              <div className="flex gap-2">
                {paper.pdf_url && (
                  <Button variant="outline" asChild>
                    <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="w-4 h-4 mr-2" />
                      View PDF
                    </a>
                  </Button>
                )}
                {paper.url && (
                  <Button variant="outline" asChild>
                    <a href={paper.url} target="_blank" rel="noopener noreferrer">
                      <Share2 className="w-4 h-4 mr-2" />
                      Open Source
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Abstract */}
      {paper.abstract && (
        <Card>
          <CardHeader>
            <CardTitle>Abstract</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{paper.abstract}</p>
          </CardContent>
        </Card>
      )}

      {/* Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            {renderTabContent(tab.id)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );

  function renderTabContent(tabId: string) {
    if (!analysis) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading analysis...</p>
        </div>
      );
    }

    const sectionMap: Record<string, keyof typeof analysis> = {
      summary: 'researchProblem',
      methodology: 'methodology',
      dataset: 'dataset',
      findings: 'keyFindings',
      limitations: 'limitations',
      future: 'futureWork',
    };

    if (tabId === 'qa') {
      return (
        <div className="space-y-4">
          <form onSubmit={handleQa} className="flex gap-2">
            <Textarea
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              placeholder="Ask a question about this paper..."
              className="flex-1 min-h-[100px]"
              disabled={qaLoading}
            />
            <Button type="submit" disabled={qaLoading || !qaQuestion.trim()} className="h-fit">
              {qaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
            </Button>
          </form>
          {qaAnswer && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Answer</h4>
                <p className="whitespace-pre-wrap">{qaAnswer}</p>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    const section = analysis[sectionMap[tabId]];
    if (!section) return <p className="text-gray-500">No analysis available</p>;

    if (Array.isArray(section)) {
      return (
        <div className="space-y-4">
          {section.map((item: any, i: number) => (
            <Card key={i}>
              <CardContent className="p-4">
                <p className="whitespace-pre-wrap">{item.text || item}</p>
                {item.citations?.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    Citations: {item.citations.map((c: any) => `chunk ${c.chunk_index}`).join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <Card>
        <CardContent className="p-6">
          <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {section.text || 'Information unavailable.'}
          </p>
          {section.citations?.length > 0 && (
            <div className="mt-4 text-xs text-gray-500">
              Sources: {section.citations.map((c: any) => `chunk ${c.chunk_index}`).join(', ')}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
}