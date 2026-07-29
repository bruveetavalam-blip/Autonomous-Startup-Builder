import api from './api';
import type { BackendReport } from '../types';
export const reportService = { get: async (startupId: number) => (await api.get<BackendReport>(`/reports/${startupId}`)).data };
