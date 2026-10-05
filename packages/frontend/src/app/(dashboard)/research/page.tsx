'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Loader2, ChevronRight, MessageSquare, Brain, Zap, ArrowRight, X, Settings, RefreshCw, GitCompare, Database, Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { chatApi, searchApi } from '@/lib/api';
import toast from 'react-hot-toast';

const searchSchema = z.object({
  query: z.string().min(3, 'Query too short'),
});

type SearchForm = z.infer<typeof searchSchema>;

interface ResearchAgentStep {
  id: string;
  type: 'understanding' | 'expanding' | 'searching' | 'analyzing' | 'complete';
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  data?: any;
}

interface ExpandedConcept {
  term: string;
  reason: string;
  selected: boolean;
}

export default function ResearchPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandedConcepts, setExpandedConcepts] = useState<Array<{term: string; reason: string; selected: boolean}>>([]);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<Array<{id: string; type: string; title: string; description: string; status: 'pending' | 'active' | 'completed'; data?: any}>>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const requestIdRef = useRef(0);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<{query: string}>({
    resolver: zodResolver(z.object({ query: z.string().min(3, 'Query too short') })),
    defaultValues: { query: '' },
  });

  const query = watch('query');

  useEffect(() => {
    let cancelled = false;

    const restoreLatestConversation = async () => {
      try {
        const activeConversationId = window.localStorage.getItem('mrdu.researchConversationId');
        if (!activeConversationId) return;

        const [conversationsResponse, messagesResponse] = await Promise.all([
          chatApi.conversations.list(),
          chatApi.conversations.messages(activeConversationId),
        ]);
        if (cancelled) return;
        const latest = conversationsResponse.data?.find((conversation: { id: string }) => conversation.id === activeConversationId);
        if (!latest) {
          window.localStorage.removeItem('mrdu.researchConversationId');
          return;
        }

        setConversationId(latest.id);
        const context = latest.context || {};
        const restoredResults = Array.isArray(context.papers) ? context.papers : [];
        const restoredTerms = Array.isArray(context.expanded_terms) ? context.expanded_terms : [];
        const restoredMessages = messagesResponse.data || [];
        const restoredQuery = typeof context.query === 'string' ? context.query : latest.title;
        setConversationHistory(
          restoredMessages.length > 0
            ? restoredMessages.map((message: { role: 'user' | 'assistant'; content: string }) => ({
                role: message.role,
                content: message.content,
                timestamp: new Date(latest.updated_at),
              }))
            : [
                { role: 'user', content: restoredQuery, timestamp: new Date(latest.created_at) },
                {
                  role: 'assistant',
                  content: `Found ${restoredResults.length} relevant papers. You can continue asking questions about this research session.`,
                  timestamp: new Date(latest.updated_at),
                },
              ]
        );
        setResults(restoredResults);
        setExpandedConcepts(
          restoredTerms.map((term: string) => ({
            term,
            reason: 'Restored from this research session',
            selected: true,
          }))
        );
        reset({ query: restoredQuery });
        if (restoredResults.length > 0) {
          const restoredSteps = initializeAgentSteps().map((step) => ({
            ...step,
            status: 'completed' as const,
          }));
          setAgentSteps(restoredSteps);
          setCurrentStepIndex(restoredSteps.length - 1);
        }
      } catch (restoreError) {
        if (!cancelled) {
          setError(restoreError instanceof Error ? restoreError.message : 'Could not restore research session');
        }
      }
    };

    void restoreLatestConversation();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const startNewResearch = () => {
    requestIdRef.current += 1;
    window.localStorage.removeItem('mrdu.researchConversationId');
    setConversationId(undefined);
    setConversationHistory([]);
    setExpandedConcepts([]);
    setResults([]);
    setError(null);
    setAgentSteps([]);
    setCurrentStepIndex(0);
    reset({ query: '' });
  };

  const downloadSummary = () => {
    if (results.length === 0) return;
    const title = query.trim() || 'Research paper summary';
    const assistantNotes = conversationHistory
      .filter((message) => message.role === 'assistant')
      .map((message) => message.content)
      .join('\n\n');
    const lines = [
      title,
      'Generated by MRDU Research Workspace',
      '',
      'Assistant summary',
      assistantNotes || 'No assistant summary available.',
      '',
      'Retrieved papers',
    ];
    results.forEach((paper: any, index: number) => {
      lines.push(
        '',
        `${index + 1}. ${paper.title || 'Untitled paper'}`,
        `Authors: ${(paper.authors || []).join(', ') || 'Not available'}`,
        `Year: ${paper.year || 'Not available'} | Venue: ${paper.venue || 'Not available'}`,
        `Link: ${paper.url || paper.pdf_url || 'Not available'}`,
        paper.abstract || 'No abstract available.'
      );
    });
    const blob = new Blob([createPdf(lines)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'research-summary'}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const createPdf = (content: string[]) => {
    const sanitize = (value: string) => value
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/[\\()]/g, (character) => `\\${character}`);
    const wrappedLines = content.flatMap((line) => {
      const words = sanitize(line).split(/\s+/).filter(Boolean);
      if (words.length === 0) return [''];
      const result: string[] = [];
      let current = '';
      words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length > 92 && current) {
          result.push(current);
          current = word;
        } else {
          current = next;
        }
      });
      if (current) result.push(current);
      return result;
    });
    const linesPerPage = 48;
    const pages = Array.from(
      { length: Math.max(1, Math.ceil(wrappedLines.length / linesPerPage)) },
      (_, index) => wrappedLines.slice(index * linesPerPage, (index + 1) * linesPerPage)
    );
    const objects: string[] = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Length 0 >>\nstream\n\nendstream',
    ];
    pages.forEach((pageLines, pageIndex) => {
      const stream = [
        'BT',
        '/F1 11 Tf',
        '50 750 Td',
        ...pageLines.flatMap((line, lineIndex) => [
          `(${sanitize(line)}) Tj`,
          ...(lineIndex < pageLines.length - 1 ? ['0 -15 Td'] : []),
        ]),
        'ET',
      ].join('\n');
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${6 + pageIndex * 2} 0 R >>`,
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
      );
    });
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets[index + 1] = pdf.length;
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  };

  const initializeAgentSteps = () => [
    { id: '1', type: 'understanding', title: 'Understanding your research', description: 'Analyzing your natural language query to identify core concepts, intent, and research goals', status: 'pending' as const },
    { id: '2', type: 'expanding', title: 'Expanding search concepts', description: 'Generating related terms, synonyms, and related concepts for comprehensive coverage', status: 'pending' as const },
    { id: '3', type: 'searching', title: 'Searching literature', description: 'Querying arXiv and Semantic Scholar with hybrid semantic + keyword search', status: 'pending' as const },
    { id: '4', type: 'analyzing', title: 'Analyzing results', description: 'Ranking by relevance, extracting methodologies, datasets, and key findings', status: 'pending' as const },
    { id: '5', type: 'complete', title: 'Research brief ready', description: 'Presenting structured results with relevance signals and citations', status: 'pending' as const },
  ];

  const runAgentWorkflow = async (searchQuery: string) => {
    const requestId = ++requestIdRef.current;
    const steps = initializeAgentSteps();
    setAgentSteps(steps);
    setCurrentStepIndex(0);

    const updateStep = (index: number, data?: any) => {
      if (requestId !== requestIdRef.current) return;
      setAgentSteps(prev => prev.map((step, stepIndex) =>
        stepIndex === index
          ? { ...step, status: 'completed', data }
          : stepIndex < index
            ? { ...step, status: 'completed' }
            : stepIndex === index + 1
              ? { ...step, status: 'active' }
              : step
      ));
      setCurrentStepIndex(Math.min(index + 1, steps.length - 1));
    };

    setAgentSteps(prev => prev.map((step, index) =>
      index === 0 ? { ...step, status: 'completed' } :
      index === 1 ? { ...step, status: 'active' } : step
    ));
    setCurrentStepIndex(1);

    const fallbackTerms = searchQuery
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 2)
      .slice(0, 6)
      .flatMap((term) => [term, `${term} methods`])
      .filter((term, index, terms) => terms.indexOf(term) === index)
      .slice(0, 8);

    let expandedTerms = fallbackTerms;
    try {
      const expandResult = await Promise.race([
        searchApi.expand(searchQuery),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Concept expansion timed out')), 8000)
        ),
      ]);
      if (Array.isArray(expandResult.expanded_terms) && expandResult.expanded_terms.length > 0) {
        expandedTerms = expandResult.expanded_terms;
      }
    } catch {
      // Continue with local terms when the optional expansion service is unavailable.
    }

    const conceptsData: ExpandedConcept[] = expandedTerms.map((term: string) => ({
      term,
      reason: 'Semantically related to core concepts',
      selected: true
    })) || [];
    if (requestId !== requestIdRef.current) return;
    setExpandedConcepts(conceptsData);
    updateStep(1, conceptsData);

    const searchResult = await searchApi.search({
      query: searchQuery,
      expanded_terms: conceptsData.map(c => c.term),
      limit: 10,
    });
    if (requestId !== requestIdRef.current) return;
    setResults(searchResult.results || []);
    const conversation = await chatApi.conversations.create({
      title: searchQuery,
      context: {
        query: searchQuery,
        expanded_terms: conceptsData.map(c => c.term),
        papers: searchResult.results || [],
      },
      initial_messages: [
        { role: 'user', content: searchQuery },
        {
          role: 'assistant',
          content: `Found ${searchResult.results?.length ?? 0} relevant papers. I've analyzed their methodologies, datasets, and key findings. You can explore the results below, or ask me to compare papers.`,
        },
      ],
    });
    setConversationId(conversation.data.id);
    window.localStorage.setItem('mrdu.researchConversationId', conversation.data.id);
    updateStep(2, { count: searchResult.results?.length ?? 0 });
    updateStep(3);
    updateStep(4);
    setCurrentStepIndex(4);
    return searchResult.results || [];
  };

  const onSubmit = async (data: { query: string }) => {
    if (results.length > 0) {
      await handleFollowUp(data.query);
      reset();
      return;
    }
    setIsLoading(true);
    setError(null);
    setExpandedConcepts([]);
    setAgentSteps([]);
    
    setConversationHistory(prev => [...prev, { role: 'user', content: data.query, timestamp: new Date() }]);

    try {
      const workflowResults = await runAgentWorkflow(data.query);
      
      const resultCount = workflowResults?.length ?? 0;
      setConversationHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `Found ${resultCount} relevant papers. I've analyzed their methodologies, datasets, and key findings. You can explore the results below, or ask me to compare papers.`,
        timestamp: new Date() 
      }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Research failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConceptToggle = (term: string) => {
    setExpandedConcepts(prev => prev.map(c => 
      c.term === term ? { ...c, selected: !c.selected } : c
    ));
  };

  const handleSearchWithConcepts = () => {
    const selectedTerms = expandedConcepts.filter(c => c.selected).map(c => c.term);
    setConversationHistory(prev => [...prev, { 
      role: 'user', 
      content: `Search with these concepts: ${selectedTerms.join(', ')}`, 
      timestamp: new Date() 
    }]);
    setIsLoading(true);
    setError(null);
    runAgentWorkflow(query)
      .catch((e) => setError(e instanceof Error ? e.message : 'Research failed'))
      .finally(() => setIsLoading(false));
  };

  const handleFollowUp = async (followUp: string) => {
    const normalizedFollowUp = followUp.toLowerCase();
    if (normalizedFollowUp.includes('compare')) {
      sessionStorage.setItem(
        'mrdu.comparePaperIds',
        JSON.stringify(results.slice(0, 5).map((paper: any) => paper.external_id || paper.id).filter(Boolean))
      );
      sessionStorage.setItem('mrdu.comparePapers', JSON.stringify(results.slice(0, 5)));
      router.push('/compare');
      return;
    }
    setConversationHistory(prev => [...prev, { role: 'user', content: followUp, timestamp: new Date() }]);
    
    try {
      const response = await chatApi.send({
        message: followUp,
        conversation_id: conversationId,
        context: { query, papers: results },
      });
      if (!conversationId) {
        setConversationId(response.data.conversation_id);
      }
      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: response.data.message.content,
        timestamp: new Date(),
      }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assistant response failed');
    }
  };

  const suggestedFollowUps = [
    "Compare the top 3 papers",
    "Show methodology trends",
    "Analyze datasets used",
    "Summarize the papers",
    "Suggest follow-up searches"
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <div className="flex-1 flex flex-col min-w-0 min-h-[calc(100vh-4rem)]">
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-primary">
              <Brain className="w-4 h-4" />
              <span className="font-medium">Research Agent Active</span>
            </div>
            <div className="flex items-center gap-2">
              {agentSteps.map((step, idx) => (
                <div key={step.id} className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs',
                  idx <= currentStepIndex ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                )}>
                  {idx < currentStepIndex && <span className="text-green-500">✓</span>}
                  {idx === currentStepIndex && <Loader2 className="w-3 h-3 animate-spin" />}
                  {step.title}
                </div>
              ))}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className="ml-auto"
            >
              {showAgentPanel ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
              Agent
            </Button>
            <Button variant="outline" size="sm" onClick={startNewResearch}>
              <RefreshCw className="w-4 h-4 mr-2" /> New research
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 overflow-y-auto">
          <ScrollArea className="mb-4">
            <div className="space-y-4 max-w-3xl mx-auto w-full">
              {conversationHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Brain className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <h3 className="text-lg font-medium mb-2">How can I help with your research?</h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                    Describe your research topic, question, or goal in natural language. I'll understand your intent, expand relevant concepts, search the literature, and provide a structured analysis with citations.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center">
                    {[
                      "Adaptive learning for personalized recommendation systems",
                      "Meta-learning approaches for few-shot recommendation",
                      "Graph neural networks for session-based recommendation",
                      "Continual learning in recommendation systems"
                    ].map((example, i) => (
                      <Button key={i} variant="outline" size="sm" className="text-xs"
                        onClick={() => handleFollowUp(example)}>
                        {example}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                conversationHistory.map((msg, idx) => (
                  <div key={idx} className={cn(
                    'flex gap-3 max-w-3xl',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}>
                    <div className={cn(
                      'max-w-[80%] rounded-2xl p-4',
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-br-none' 
                        : 'bg-gray-100 dark:bg-gray-800 rounded-bl-none'
                    )}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className={cn('text-xs mt-1 opacity-70', msg.role === 'user' ? 'text-primary-foreground/70' : 'text-gray-500')}>
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              
              {!isLoading && results.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Suggested follow-ups:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedFollowUps.map((followUp, i) => (
                      <Button key={i} variant="outline" size="sm" onClick={() => handleFollowUp(followUp)}>
                        {followUp}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="relative">
              <Textarea
                {...register('query')}
                placeholder="Describe your research in natural language... e.g., 'I'm looking for recent approaches that combine adaptive learning with personalized recommendation systems, particularly interested in meta-learning approaches and their evaluation on standard benchmarks.'"
                className="min-h-[100px] resize-none border-gray-300 dark:border-gray-600"
                disabled={isLoading}
                rows={3}
              />
              {isLoading && (
                <div className="absolute bottom-2 right-2 flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Research agent working...</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => handleFollowUp("Compare the top 3 papers")} disabled={results.length === 0}>
                  <GitCompare className="w-4 h-4 mr-1" /> Compare Papers
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleFollowUp("Show methodology trends")} disabled={results.length === 0}>
                  <Zap className="w-4 h-4 mr-1" /> Methodology Trends
                </Button>
              </div>
              <Button type="submit" disabled={isLoading || !query.trim()} size="lg" className="w-full sm:w-auto">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Researching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Start Research
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {results.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <Card className="mx-4 mb-4">
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Results ({results.length} papers)</CardTitle>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={downloadSummary}>
                    <Download className="w-4 h-4 mr-2" /> Download summary
                  </Button>
                  <span className="text-sm text-gray-500">Up to 10 papers</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                  <div className="space-y-3">
                    {results.map((paper: any, index: number) => (
                      <div key={paper.id || paper.external_id || index} className="flex gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <span className="text-xl font-bold text-gray-300 dark:text-gray-600 w-8 text-right">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            className="text-left font-medium text-gray-900 dark:text-white hover:text-primary hover:underline"
                            onClick={() => router.push(`/paper/${encodeURIComponent(paper.external_id || paper.id)}`)}
                          >
                            {paper.title}
                          </button>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {paper.authors?.slice(0, 20).join(', ')} · {paper.year} · {paper.venue}
                          </p>
                          {paper.abstract && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{paper.abstract}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 ml-4">
                          {paper.relevance && Object.entries(paper.relevance).map(([key, value]) => (
                            <Badge key={key} variant={value === 'high' ? 'default' : value === 'medium' ? 'secondary' : 'outline'} className="text-xs capitalize">
                              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}: {String(value)}
                            </Badge>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/paper/${encodeURIComponent(paper.external_id || paper.id)}`)}
                          >
                            Open paper
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {showAgentPanel && (
        <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Research Agent
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAgentPanel(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Agent Workflow</h4>
                <div className="space-y-3">
                  {agentSteps.map((step, idx) => (
                    <div key={step.id} className={cn(
                      'p-3 rounded-lg border-l-4 transition-all',
                      idx < currentStepIndex ? 'bg-green-50 dark:bg-green-900/20 border-green-500' :
                      idx === currentStepIndex ? 'bg-primary/5 border-primary' :
                      'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    )}>
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                          idx < currentStepIndex ? 'bg-green-500 text-white' :
                          idx === currentStepIndex ? 'bg-primary text-white animate-pulse' :
                          'bg-gray-200 dark:bg-gray-700 text-gray-500'
                        )}>
                          {idx < currentStepIndex ? '✓' : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{step.title}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{step.description}</p>
                          {step.data && (
                            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(step.data, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {expandedConcepts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Expanded Concepts</h4>
                  <div className="flex flex-wrap gap-2">
                    {expandedConcepts.map((concept) => (
                      <label key={concept.term} className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors',
                        concept.selected 
                          ? 'bg-primary text-primary-foreground border-primary' 
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      )}>
                        <input
                          type="checkbox"
                          checked={concept.selected}
                          onChange={() => handleConceptToggle(concept.term)}
                          className="sr-only"
                        />
                        <span>{concept.term}</span>
                      </label>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleSearchWithConcepts}>
                    Search with Selected ({expandedConcepts.filter(c => c.selected).length})
                  </Button>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleFollowUp("Compare the top 3 papers")} disabled={results.length === 0}>
                    <GitCompare className="w-4 h-4 mr-2" /> Compare Papers
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleFollowUp("Show methodology trends")} disabled={results.length === 0}>
                    <Zap className="w-4 h-4 mr-2" /> Methodology Trends
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleFollowUp("Analyze datasets used")} disabled={results.length === 0}>
                    <Database className="w-4 h-4 mr-2" /> Analyze Datasets
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}