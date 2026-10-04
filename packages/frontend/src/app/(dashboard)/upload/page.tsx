'use client';

import { FileText, Upload, Loader2, CheckCircle, Send, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { papersApi, searchApi, chatApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Message = { role: 'user' | 'assistant'; content: string };

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paper, setPaper] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [concepts, setConcepts] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const savedId = window.localStorage.getItem('mrdu.uploadConversationId');
    if (!savedId) return;
    setConversationId(savedId);
    chatApi.conversations.messages(savedId)
      .then(({ data }) => setMessages(data.filter((m: Message) => m.role === 'user' || m.role === 'assistant')))
      .catch(() => window.localStorage.removeItem('mrdu.uploadConversationId'));
  }, []);

  const selectFile = (candidate: File) => {
    if (candidate.type !== 'application/pdf' && !candidate.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }
    if (candidate.size > 50 * 1024 * 1024) {
      setError('The PDF must be smaller than 50MB');
      return;
    }
    setFile(candidate);
    setError(null);
    setPaper(null);
    setResults([]);
    setConcepts([]);
    setMessages([]);
  };

  const handleUpload = async () => {
    if (!file || isWorking) return;
    setIsWorking(true);
    setProgress(10);
    setError(null);
    try {
      const uploadResponse = await papersApi.upload(file, setProgress);
      const uploadedPaper = uploadResponse.data.paper;
      setPaper(uploadedPaper);
      setProgress(55);

      const query = `${uploadedPaper.title}\n${uploadedPaper.abstract || ''}`.slice(0, 2200);
      const expansion = await searchApi.expand(query);
      const expandedTerms = Array.isArray(expansion.expanded_terms) ? expansion.expanded_terms : [];
      setConcepts(expandedTerms);
      setProgress(68);

      const searchResponse = await searchApi.search({
        query,
        expanded_terms: expandedTerms,
        limit: 20,
      });
      const relatedPapers = searchResponse.results || [];
      setResults(relatedPapers);
      setProgress(82);

      const summary = `I uploaded “${uploadedPaper.title}”. I found ${relatedPapers.length} related papers and extracted these search concepts: ${expandedTerms.slice(0, 8).join(', ')}.`;
      const conversation = await chatApi.conversations.create({
        title: `Uploaded paper: ${uploadedPaper.title}`,
        context: {
          source: 'uploaded-paper',
          paper: uploadedPaper,
          query,
          expanded_terms: expandedTerms,
          papers: relatedPapers,
        },
        initial_messages: [
          { role: 'user', content: `Analyze this uploaded paper: ${uploadedPaper.title}` },
          { role: 'assistant', content: summary },
        ],
      });
      setConversationId(conversation.data.id);
      window.localStorage.setItem('mrdu.uploadConversationId', conversation.data.id);
      setMessages([
        { role: 'user', content: `Analyze this uploaded paper: ${uploadedPaper.title}` },
        { role: 'assistant', content: summary },
      ]);
      setProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload research failed');
    } finally {
      setIsWorking(false);
    }
  };

  const askAssistant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim() || !conversationId || isWorking) return;
    const userMessage = question.trim();
    setQuestion('');
    setMessages((current) => [...current, { role: 'user', content: userMessage }]);
    try {
      const response = await chatApi.send({
        message: userMessage,
        conversation_id: conversationId,
        context: { paper, papers: results, expanded_terms: concepts },
      });
      setMessages((current) => [...current, {
        role: 'assistant',
        content: response.data.message.content,
      }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assistant response failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Upload Paper</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload a paper to extract its research concepts, find related literature, and continue with an AI assistant.
        </p>
      </div>

      {!paper && (
        <Card className={cn(dragActive && 'border-primary bg-primary/5')}>
          <CardContent className="p-8">
            <div
              className="text-center"
              onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => { event.preventDefault(); setDragActive(false); if (event.dataTransfer.files[0]) selectFile(event.dataTransfer.files[0]); }}
            >
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Drop PDF here or click to browse</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Maximum file size: 50MB · PDF only</p>
              <input id="file-input" type="file" accept="application/pdf" className="hidden" onChange={(event) => event.target.files?.[0] && selectFile(event.target.files[0])} />
              <Button variant="outline" onClick={() => document.getElementById('file-input')?.click()}>Choose File</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {file && !paper && (
        <Card>
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-gray-400" />
              <div><p className="font-medium">{file.name}</p><p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div>
            </div>
            <Button onClick={handleUpload} disabled={isWorking}>
              {isWorking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing {progress}%</> : 'Analyze & Find Related Papers'}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>}

      {paper && (
        <>
          <Card className="border-green-200">
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" />Paper analyzed</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <h2 className="text-xl font-semibold">{paper.title}</h2>
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{paper.abstract}</p>
              <div><p className="font-medium mb-2">Extracted search concepts</p><div className="flex flex-wrap gap-2">{concepts.map((term) => <span key={term} className="px-2 py-1 rounded bg-primary/10 text-sm">{term}</span>)}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Related literature ({results.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {results.map((result) => <div key={result.external_id || result.id} className="border rounded-lg p-4"><div className="flex justify-between gap-3"><h3 className="font-medium">{result.title}</h3>{result.url && <a href={result.url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>}</div><p className="text-sm text-gray-600 mt-1">{result.abstract}</p></div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Paper assistant</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">{messages.map((message, index) => <div key={index} className={cn('rounded-lg p-3 whitespace-pre-wrap', message.role === 'user' ? 'bg-primary text-primary-foreground ml-8' : 'bg-gray-100 dark:bg-gray-800 mr-8')}>{message.content}</div>)}</div>
              <form onSubmit={askAssistant} className="flex gap-2">
                <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the uploaded paper or related literature..." rows={2} />
                <Button type="submit" disabled={!question.trim() || !conversationId}><Send className="w-4 h-4 mr-2" />Ask</Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
