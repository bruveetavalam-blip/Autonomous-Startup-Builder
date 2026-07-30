import api from './api';
import type { StartupBuilderRequest, StartupJob, StartupWorkflowResponse } from '../types';
export const startupService = {
  generate: async (payload: StartupBuilderRequest) => (await api.post<StartupWorkflowResponse>('/startup-builder', payload)).data,
  status: async (jobId: string) => (await api.get<StartupJob>(`/startup-builder/${jobId}`)).data,
  retry: async (jobId: string, agent: string) => (await api.post<StartupJob>(`/startup-builder/${jobId}/agents/${agent}/retry`)).data,
};
