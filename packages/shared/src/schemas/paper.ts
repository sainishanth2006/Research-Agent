import { z } from 'zod';

export const PaperSourceSchema = z.enum(['arxiv', 'semantic_scholar', 'upload']);
export type PaperSource = z.infer<typeof PaperSourceSchema>;

export const RelevanceLevelSchema = z.enum(['high', 'medium', 'low', 'unknown']);
export type RelevanceLevel = z.infer<typeof RelevanceLevelSchema>;

export const RelevanceSignalsSchema = z.object({
  semanticMatch: RelevanceLevelSchema,
  keywordMatch: RelevanceLevelSchema,
  methodologyMatch: RelevanceLevelSchema,
  datasetMatch: RelevanceLevelSchema,
  recency: RelevanceLevelSchema,
  citationInfluence: RelevanceLevelSchema,
  overallScore: z.number().min(0).max(100),
});
export type RelevanceSignals = z.infer<typeof RelevanceSignalsSchema>;

export const PaperSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  source: PaperSourceSchema,
  title: z.string(),
  abstract: z.string().nullable(),
  authors: z.array(z.string()),
  year: z.number().nullable(),
  venue: z.string().nullable(),
  doi: z.string().nullable(),
  url: z.string().nullable(),
  pdfUrl: z.string().nullable(),
  citationCount: z.number().int().default(0),
  referenceCount: z.number().int().default(0),
  topics: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Paper = z.infer<typeof PaperSchema>;

export const PaperChunkSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  chunkIndex: z.number().int(),
  content: z.string(),
  tokenCount: z.number().int(),
  chromaId: z.string().nullable(),
});
export type PaperChunk = z.infer<typeof PaperChunkSchema>;

export const SearchResultSchema = z.object({
  paper: PaperSchema,
  relevance: RelevanceSignalsSchema,
  rank: z.number().int(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const CitationRefSchema = z.object({
  paperId: z.string(),
  chunkIds: z.array(z.string()),
  paperTitle: z.string(),
  paperAuthors: z.array(z.string()),
  paperYear: z.number().int(),
});
export type CitationRef = z.infer<typeof CitationRefSchema>;

export const CitedTextSchema = z.object({
  text: z.string(),
  citations: z.array(CitationRefSchema),
});
export type CitedText = z.infer<typeof CitedTextSchema>;

export const PaperAnalysisSchema = z.object({
  paperId: z.string(),
  researchProblem: CitedTextSchema,
  methodology: CitedTextSchema,
  dataset: CitedTextSchema,
  experiments: CitedTextSchema,
  metrics: CitedTextSchema,
  keyFindings: z.array(CitedTextSchema),
  contributions: z.array(CitedTextSchema),
  limitations: z.array(CitedTextSchema),
  futureWork: z.array(CitedTextSchema),
});
export type PaperAnalysis = z.infer<typeof PaperAnalysisSchema>;

export const SearchFiltersSchema = z.object({
  yearFrom: z.number().int().optional(),
  yearTo: z.number().int().optional(),
  authors: z.array(z.string()).optional(),
  venues: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  methodologies: z.array(z.string()).optional(),
  datasets: z.array(z.string()).optional(),
  minCitations: z.number().int().optional(),
  openAccessOnly: z.boolean().optional(),
  paperTypes: z.array(z.enum(['conference', 'journal', 'preprint', 'workshop'])).optional(),
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

export const SearchQuerySchema = z.object({
  originalQuery: z.string(),
  expandedTerms: z.array(z.string()),
  filters: SearchFiltersSchema,
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const ComparisonRowSchema = z.object({
  feature: z.string(),
  values: z.record(CitedTextSchema),
});
export type ComparisonRow = z.infer<typeof ComparisonRowSchema>;

export const ComparisonTableSchema = z.object({
  papers: z.array(PaperSchema),
  rows: z.array(ComparisonRowSchema),
});
export type ComparisonTable = z.infer<typeof ComparisonTableSchema>;

export const TimelineEntrySchema = z.object({
  year: z.number().int(),
  papers: z.array(PaperSchema),
  summary: CitedTextSchema,
  phase: z.string(),
});
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

export const ResearchGapSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: CitedTextSchema,
  supportingPapers: z.array(PaperSchema),
  confidence: z.enum(['high', 'medium', 'low']),
  category: z.enum(['methodology', 'dataset', 'evaluation', 'application', 'theoretical']),
});
export type ResearchGap = z.infer<typeof ResearchGapSchema>;

export const ToolCallSchema = z.object({
  name: z.string(),
  args: z.record(z.unknown()),
  id: z.string(),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ToolResultSchema = z.object({
  toolCallId: z.string(),
  result: z.unknown(),
  error: z.string().optional(),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
  toolCalls: z.array(ToolCallSchema).optional(),
  toolResults: z.array(ToolResultSchema).optional(),
  citations: z.array(CitationRefSchema).optional(),
  createdAt: z.date(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const CollectionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const CollectionPaperSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  paperId: z.string(),
  addedAt: z.date(),
  notes: z.string().nullable(),
});
export type CollectionPaper = z.infer<typeof CollectionPaperSchema>;

export const SearchHistorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string().nullable(),
  query: z.string(),
  filters: z.record(z.unknown()).nullable(),
  resultCount: z.number().int(),
  createdAt: z.date(),
});
export type SearchHistory = z.infer<typeof SearchHistorySchema>;