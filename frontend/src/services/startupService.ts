import api from './api';
import type { StartupBuilderRequest, StartupWorkflowResponse } from '../types';
export const startupService = { generate: async (payload: StartupBuilderRequest) => (await api.post<StartupWorkflowResponse>('/startup-builder', payload)).data };
