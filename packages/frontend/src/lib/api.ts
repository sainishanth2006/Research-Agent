import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getSession, signOut } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const session = await getSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - sign out
      await signOut({ callbackUrl: '/login', redirect: true });
    }
    return Promise.reject(error);
  }
);

// API endpoint helpers
export const searchApi = {
  search: (data: { query: string; expanded_terms?: string[]; filters?: Record<string, unknown>; limit?: number }) =>
    api.post('/search', data).then(response => response.data),
  expand: (query: string) => api.post('/search/expand', { query }).then(response => response.data),
};

export const papersApi = {
  get: (id: string) => api.get(`/papers/${id}`),
  analysis: (id: string) => api.get(`/papers/${id}/analysis`),
  qa: (id: string, question: string) => api.post(`/papers/${id}/qa`, { question }),
  upload: (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/papers/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chunks: (id: string) => (api as any).get(`/papers/${id}/chunks`),
};

export const chatApi = {
  send: (data: { message: string; conversation_id?: string; context?: Record<string, unknown> }) =>
    api.post('/chat', data),
  conversations: {
    list: (projectId?: string) => api.get('/chat/conversations', { params: { project_id: projectId } }),
    create: (data: {
      title: string;
      project_id?: string;
      context?: Record<string, unknown>;
      initial_messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => api.post('/chat/conversations', data),
    messages: (id: string) => api.get(`/chat/conversations/${id}/messages`),
  },
};

export const collectionsApi = {
  list: () => api.get('/collections'),
  create: (data: { name: string; description?: string; color?: string }) => api.post('/collections', data),
  get: (id: string) => api.get(`/collections/${id}`),
  addPaper: (id: string, data: { paper_id: string; notes?: string }) => api.post(`/collections/${id}/papers`, data),
  removePaper: (id: string, paperId: string) => api.delete(`/collections/${id}/papers/${paperId}`),
  delete: (id: string) => api.delete(`/collections/${id}`),
};

export const authApi = {
  verify: () => api.get('/auth/verify'),
  me: () => api.get('/auth/me'),
  dashboard: () => api.get('/auth/dashboard'),
};