import axios, { AxiosError } from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001';

const api = axios.create({ baseURL: API_BASE_URL, timeout: 120000, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => config);
api.interceptors.response.use((response) => response, (error: AxiosError<{ detail?: string }>) => Promise.reject(new Error(error.response?.data?.detail || (error.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : 'Unable to reach the backend.'))));
export default api;
