import api from './api';
import type { RagResponse } from '../types';
export const ragService = { query: async (query: string) => (await api.post<RagResponse>('/rag/query', { query })).data };
