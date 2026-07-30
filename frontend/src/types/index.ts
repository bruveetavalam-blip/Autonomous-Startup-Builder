export type Page = 'landing' | 'signup' | 'login' | 'dashboard' | 'new-startup' | 'execution' | 'reports' | 'history' | 'knowledge' | 'settings';
export type AgentState = 'waiting' | 'running' | 'completed' | 'failed';
export interface Agent { name: string; description: string; state: AgentState; progress: number; elapsed: string; activity: string; }
export interface Startup { name: string; industry: string; status: 'Completed' | 'In progress' | 'Draft'; score: number; date: string; summary: string; }
export interface HealthResponse { status: string; backend: string; database: string; api: string; features: Record<string, boolean>; }
export interface StartupBuilderRequest { idea: string; country?: string; state?: string; city?: string; }
export interface ValidationReport { overall_score: number; market_potential: number; competition_risk: number; revenue_feasibility: number; execution_difficulty: number; panel_verdict: string; strong_points: string[]; weak_points: string[]; next_actions: string[]; }
export interface Source { title: string; url: string; description?: string; agent?: string; group?: string; }
export interface RevenueModel { currency: 'INR'; startup_cost?: { items?: Array<{ name: string; amount: number }>; total?: number }; monthly_expenses?: Array<{ name: string; amount: number }>; revenue_projection?: Array<{ month: string; revenue: number; expenses: number; profit: number }>; break_even_month?: number | null; funding_requirement?: number; assumptions?: string[]; notes?: string; }
export interface AgentRun { label: string; status: AgentState; progress: number; started_at?: string; completed_at?: string; error?: string; }
export interface BackendReport { startup?: string; workflow?: string; history_id?: number; location?: { country?: string; state?: string; city?: string }; analysis?: string; market?: { available: boolean; insights: Record<string, unknown>; sources: Source[] }; sources?: Source[]; competitors?: string; business_plan?: string; marketing_strategy?: string; revenue_estimate?: RevenueModel | string; validation?: ValidationReport; agent_status?: Record<string, AgentRun>; errors?: Record<string, string>; warnings?: string[]; }
export interface StartupJob { job_id: string; startup_id: number; status: 'running' | 'completed'; agents: Record<string, AgentRun>; errors: Record<string, string>; report: BackendReport; updated_at: string; }
export interface StartupWorkflowResponse extends BackendReport { idea: string; history_id: number; report: BackendReport; job_id?: string; status?: string; agents?: Record<string, AgentRun>; }
export interface HistoryItem { id: number; startup_name: string; created_at: string; }
export interface RagResponse { query: string; answer: string; context: Array<Record<string, unknown>>; }
export interface SignupRequest { full_name: string; email: string; password: string; company: string; }
export interface LoginRequest { email: string; password: string; }
export interface UserProfile { id: number; full_name: string; email: string; company: string; role: string; created_at: string; }
