import api from './api';
import type { HistoryItem } from '../types';
export const historyService = { list: async () => (await api.get<HistoryItem[]>('/history')).data };
