import axios, { AxiosError } from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL, timeout: 120000, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => config);
api.interceptors.response.use((response) => response, (error: AxiosError<{ detail?: string }>) => Promise.reject(new Error(error.response?.data?.detail || (error.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : 'Unable to reach the backend.'))));
export default api;
