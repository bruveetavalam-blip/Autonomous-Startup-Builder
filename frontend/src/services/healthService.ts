import api from './api';
import type { HealthResponse } from '../types';
export const healthService = { get: async () => (await api.get<HealthResponse>('/health')).data };
