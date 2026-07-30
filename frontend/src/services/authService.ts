import api from './api';
import type { LoginRequest, SignupRequest, UserProfile } from '../types';

export const authService = {
  signup: async (payload: SignupRequest) => {
    const { data } = await api.post<UserProfile>('/auth/signup', payload);
    return data;
  },
  login: async (payload: LoginRequest) => {
    const { data } = await api.post<UserProfile>('/auth/login', payload);
    return data;
  },
};
