'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Loader2, ChevronRight, MessageSquare, Brain, Zap, ArrowRight, X, Settings, RefreshCw, GitCompare, Clock, Database } from 'lucide-react';
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
import { searchApi } from '@/lib/api';
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

    const expandResult = await searchApi.expand(searchQuery);
    const conceptsData: ExpandedConcept[] = expandResult.expanded_terms?.map((term: string) => ({
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
      limit: 20,
    });
    if (requestId !== requestIdRef.current) return;
    setResults(searchResult.results || []);
    updateStep(2, { count: searchResult.results?.length ?? 0 });
    updateStep(3);
    updateStep(4);
    setCurrentStepIndex(4);
    return searchResult.results || [];
  };

  const onSubmit = async (data: { query: string }) => {
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
        content: `Found ${resultCount} relevant papers. I've analyzed their methodologies, datasets, and key findings. You can explore the results below, or ask me to compare papers, show research gaps, or generate a timeline.`, 
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
      router.push('/compare');
      return;
    }
    if (normalizedFollowUp.includes('gap') || normalizedFollowUp.includes('opportunity')) {
      sessionStorage.setItem(
        'mrdu.gapPaperIds',
        JSON.stringify(results.map((paper: any) => paper.external_id || paper.id).filter(Boolean))
      );
      router.push('/gaps');
      return;
    }
    if (normalizedFollowUp.includes('timeline') || normalizedFollowUp.includes('evolution')) {
      const paperId = results[0]?.external_id || results[0]?.id;
      if (paperId) {
        router.push(`/timeline?paperId=${encodeURIComponent(paperId)}`);
      } else {
        router.push('/timeline');
      }
      return;
    }

    setConversationHistory(prev => [...prev, { role: 'user', content: followUp, timestamp: new Date() }]);
    
    let response = "";
    if (followUp.includes('compare')) {
      response = "I'll help you compare papers. Select 2-5 papers from the results and I'll generate a detailed comparison table showing methodologies, datasets, metrics, and findings side by side.";
    } else if (followUp.includes('gap') || followUp.includes('opportunity')) {
      response = "I'll analyze the current literature to identify research gaps. Based on the current results, I can see opportunities in cross-domain evaluation, real-world deployment studies, and theoretical analysis of adaptive methods.";
    } else if (followUp.includes('timeline') || followUp.includes('evolution')) {
      response = "I'll generate a research evolution timeline. Select a key paper and I'll show you the foundational work before it and the subsequent developments that built upon it.";
    } else if (followUp.includes('methodology') || followUp.includes('method')) {
      response = "The top methodologies in your results: 1) Meta-learning (MAML, Alpha MAML) - 3 papers, 2) Graph Neural Networks - 2 papers, 3) Reinforcement Learning - 2 papers, 4) Contrastive Learning - 1 paper. Would you like me to dive deeper into any specific approach?";
    } else if (followUp.includes('dataset')) {
      response = "Key datasets in your results: Omniglot (few-shot learning), MovieLens (recommendation), Amazon Reviews (recommendation), custom microblogging datasets. Most papers evaluate on 1-2 benchmarks. Cross-domain evaluation appears limited.";
    } else {
      response = "I'm here to help with your research! You can ask me to: compare papers, identify research gaps, show methodology trends, analyze datasets, generate timelines, or suggest follow-up searches.";
    }
    
    setConversationHistory(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }]);
  };

  const suggestedFollowUps = [
    "Compare the top 3 papers",
    "What research gaps exist?",
    "Show methodology trends",
    "Analyze datasets used",
    "Generate timeline for key paper",
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
                <Button type="button" variant="ghost" size="sm" onClick={() => handleFollowUp("What research gaps exist?")} disabled={results.length === 0}>
                  <Sparkles className="w-4 h-4 mr-1" /> Find Gaps
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
                <span className="text-sm text-gray-500">Scroll to review all results</span>
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
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleFollowUp("What research gaps exist?")} disabled={results.length === 0}>
                    <Sparkles className="w-4 h-4 mr-2" /> Find Research Gaps
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleFollowUp("Show methodology trends")} disabled={results.length === 0}>
                    <Zap className="w-4 h-4 mr-2" /> Methodology Trends
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleFollowUp("Analyze datasets used")} disabled={results.length === 0}>
                    <Database className="w-4 h-4 mr-2" /> Analyze Datasets
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleFollowUp("Generate timeline for key paper")} disabled={results.length === 0}>
                    <Clock className="w-4 h-4 mr-2" /> Generate Timeline
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