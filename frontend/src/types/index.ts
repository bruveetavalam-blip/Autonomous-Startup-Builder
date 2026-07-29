export type Page = 'landing' | 'dashboard' | 'new-startup' | 'execution' | 'reports' | 'history' | 'knowledge' | 'settings';
export type AgentState = 'waiting' | 'running' | 'completed' | 'failed';
export interface Agent { name: string; description: string; state: AgentState; progress: number; elapsed: string; activity: string; }
export interface Startup { name: string; industry: string; status: 'Completed' | 'In progress' | 'Draft'; score: number; date: string; summary: string; }
export interface HealthResponse { status: string; backend: string; database: string; api: string; features: Record<string, boolean>; }
export interface StartupBuilderRequest { idea: string; }
export interface ValidationReport { overall_score: number; market_potential: number; competition_risk: number; revenue_feasibility: number; execution_difficulty: number; panel_verdict: string; strong_points: string[]; weak_points: string[]; next_actions: string[]; }
export interface Source { title: string; url: string; }
export interface BackendReport { startup?: string; workflow?: string; history_id?: number; analysis?: string; market?: { available: boolean; insights: Record<string, unknown>; sources: Source[] }; competitors?: string; business_plan?: string; marketing_strategy?: string; revenue_estimate?: string; validation?: ValidationReport; warnings?: string[]; }
export interface StartupWorkflowResponse extends BackendReport { idea: string; history_id: number; report: BackendReport; }
export interface HistoryItem { id: number; startup_name: string; created_at: string; }
export interface RagResponse { query: string; answer: string; context: Array<Record<string, unknown>>; }
