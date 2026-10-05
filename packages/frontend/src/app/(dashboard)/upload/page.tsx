'use client';

import { FileText, Upload, Loader2, CheckCircle, Send, ExternalLink, Download, GitCompare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { papersApi, searchApi, chatApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Message = { role: 'user' | 'assistant'; content: string };

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
    const stream = ['BT', '/F1 11 Tf', '50 750 Td',
      ...pageLines.flatMap((line, lineIndex) => [
        `(${sanitize(line)}) Tj`,
        ...(lineIndex < pageLines.length - 1 ? ['0 -15 Td'] : []),
      ]), 'ET'].join('\n');
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
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  return `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
};

export default function UploadPage() {
  const router = useRouter();
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const savedId = window.localStorage.getItem('mrdu.uploadConversationId');
    if (!savedId) return () => { active = false; };
    setConversationId(savedId);
    Promise.all([
      chatApi.conversations.list(),
      chatApi.conversations.messages(savedId),
    ])
      .then(([conversationsResponse, messagesResponse]) => {
        if (!active) return;
        const conversation = conversationsResponse.data?.find(
          (item: { id: string }) => item.id === savedId
        );
        if (!conversation) {
          throw new Error('Saved upload conversation not found');
        }
        const context = conversation.context || {};
        setPaper(context.paper || null);
        setResults(Array.isArray(context.papers) ? context.papers : []);
        setConcepts(Array.isArray(context.expanded_terms) ? context.expanded_terms : []);
        setMessages(messagesResponse.data.filter((m: Message) => m.role === 'user' || m.role === 'assistant'));
      })
      .catch(() => {
        if (!active) return;
        window.localStorage.removeItem('mrdu.uploadConversationId');
        setConversationId(undefined);
      });
    return () => { active = false; };
  }, []);

  const resetUpload = () => {
    setFile(null);
    setPaper(null);
    setResults([]);
    setConcepts([]);
    setMessages([]);
    setQuestion('');
    setConversationId(undefined);
    setProgress(0);
    setError(null);
    setDragActive(false);
    window.localStorage.removeItem('mrdu.uploadConversationId');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
    setConversationId(undefined);
    window.localStorage.removeItem('mrdu.uploadConversationId');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        limit: 10,
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

  const openComparativeAnalysis = () => {
    if (results.length < 2) return;
    const selected = results.slice(0, 5);
    sessionStorage.setItem(
      'mrdu.comparePaperIds',
      JSON.stringify(selected.map((result) => result.external_id || result.id).filter(Boolean))
    );
    sessionStorage.setItem('mrdu.comparePapers', JSON.stringify(selected));
    router.push('/compare');
  };

  const downloadSummary = () => {
    if (!paper || results.length === 0) return;
    const lines = [
      'Uploaded Paper Literature Summary',
      'Generated by MRDU Research Workspace',
      '',
      `Uploaded paper: ${paper.title}`,
      '',
      paper.abstract || 'No abstract available.',
      '',
      `Retrieved related papers (${results.length})`,
    ];
    results.forEach((result, index) => {
      lines.push(
        '',
        `${index + 1}. ${result.title || 'Untitled paper'}`,
        `Authors: ${(result.authors || []).join(', ') || 'Not available'}`,
        `Year: ${result.year || 'Not available'} | Venue: ${result.venue || 'Not available'}`,
        `Link: ${result.url || result.pdf_url || 'Not available'}`,
        result.abstract || 'No abstract available.'
      );
    });
    const blob = new Blob([createPdf(lines)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'uploaded-paper-literature-summary.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
       <div>
         <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Upload Paper</h1>
         <p className="text-gray-600 dark:text-gray-400 mt-1">
           Upload a paper to extract its research concepts, find related literature, and continue with an AI assistant.
         </p>
       </div>
       {(paper || file || conversationId) && (
         <Button variant="outline" onClick={resetUpload} disabled={isWorking}>
           <Upload className="w-4 h-4 mr-2" /> New upload
         </Button>
       )}
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
              <input ref={fileInputRef} id="file-input" type="file" accept="application/pdf" className="hidden" onChange={(event) => event.target.files?.[0] && selectFile(event.target.files[0])} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Choose File</Button>
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
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Related literature ({results.length})</CardTitle>
              <div className="flex flex-wrap gap-2">
                {results.length >= 2 && (
                  <Button variant="outline" size="sm" onClick={openComparativeAnalysis}>
                    <GitCompare className="w-4 h-4 mr-2" /> Comparative analysis
                  </Button>
                )}
                {results.length > 0 && (
                  <Button variant="outline" size="sm" onClick={downloadSummary}>
                    <Download className="w-4 h-4 mr-2" /> Download PDF summary
                  </Button>
                )}
              </div>
            </CardHeader>
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
