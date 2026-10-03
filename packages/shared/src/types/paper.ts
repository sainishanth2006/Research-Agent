export type PaperSource = 'arxiv' | 'semantic_scholar' | 'upload';

export interface Paper {
  id: string;
  externalId: string;
  source: PaperSource;
  title: string;
  abstract: string | null;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  pdfUrl: string | null;
  citationCount: number;
  referenceCount: number;
  topics: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaperChunk {
  id: string;
  paperId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  chromaId: string | null;
}

export type RelevanceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface RelevanceSignals {
  semanticMatch: RelevanceLevel;
  keywordMatch: RelevanceLevel;
  methodologyMatch: RelevanceLevel;
  datasetMatch: RelevanceLevel;
  recency: RelevanceLevel;
  citationInfluence: RelevanceLevel;
  overallScore: number;
}

export interface SearchResult {
  paper: Paper;
  relevance: RelevanceSignals;
  rank: number;
}

export interface CitationRef {
  paperId: string;
  chunkIds: string[];
  paperTitle: string;
  paperAuthors: string[];
  paperYear: number;
}

export interface CitedText {
  text: string;
  citations: CitationRef[];
}

export interface PaperAnalysis {
  paperId: string;
  researchProblem: CitedText;
  methodology: CitedText;
  dataset: CitedText;
  experiments: CitedText;
  metrics: CitedText;
  keyFindings: CitedText[];
  contributions: CitedText[];
  limitations: CitedText[];
  futureWork: CitedText[];
}

export interface SearchQuery {
  originalQuery: string;
  expandedTerms: string[];
  filters: SearchFilters;
}

export interface SearchFilters {
  yearFrom?: number;
  yearTo?: number;
  authors?: string[];
  venues?: string[];
  topics?: string[];
  methodologies?: string[];
  datasets?: string[];
  minCitations?: number;
  openAccessOnly?: boolean;
  paperTypes?: ('conference' | 'journal' | 'preprint' | 'workshop')[];
}

export interface ComparisonTable {
  papers: Paper[];
  rows: ComparisonRow[];
}

export interface ComparisonRow {
  feature: string;
  values: Record<string, CitedText>;
}

export interface TimelineEntry {
  year: number;
  papers: Paper[];
  summary: CitedText;
  phase: string;
}

export interface ResearchGap {
  id: string;
  title: string;
  description: CitedText;
  supportingPapers: Paper[];
  confidence: 'high' | 'medium' | 'low';
  category: 'methodology' | 'dataset' | 'evaluation' | 'application' | 'theoretical';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  citations?: CitationRef[];
  createdAt: Date;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id: string;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionPaper {
  id: string;
  collectionId: string;
  paperId: string;
  addedAt: Date;
  notes: string | null;
}

export interface SearchHistory {
  id: string;
  userId: string;
  projectId: string | null;
  query: string;
  filters: Record<string, unknown> | null;
  resultCount: number;
  createdAt: Date;
}