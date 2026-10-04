export const PAPER_SOURCES = ['arxiv', 'semantic_scholar', 'upload'] as const;
export type PaperSource = (typeof PAPER_SOURCES)[number];

export const RELEVANCE_LEVELS = ['high', 'medium', 'low', 'unknown'] as const;
export type RelevanceLevel = (typeof RELEVANCE_LEVELS)[number];

export const RESEARCH_GAP_CATEGORIES = [
  'methodology',
  'dataset',
  'evaluation',
  'application',
  'theoretical',
] as const;
export type ResearchGapCategory = (typeof RESEARCH_GAP_CATEGORIES)[number];

export const PAPER_TYPES = ['conference', 'journal', 'preprint', 'workshop'] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

export const CHAT_ROLES = ['user', 'assistant', 'tool'] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export const DEFAULT_CHUNK_SIZE = 500;
export const DEFAULT_CHUNK_OVERLAP = 50;
export const DEFAULT_EMBEDDING_DIM = 768;
export const DEFAULT_SEARCH_LIMIT = 20;
export const DEFAULT_RERANK_LIMIT = 10;

export const GEMINI_MODELS = {
  FLASH: 'gemini-3.5-flash',
  PRO: 'gemini-1.5-pro',
  EMBEDDING: 'text-embedding-004',
} as const;

export const SEMANTIC_SCHOLAR_BASE_URL = 'https://api.semanticscholar.org/graph/v1';
export const ARXIV_BASE_URL = 'http://export.arxiv.org/api/query';

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;