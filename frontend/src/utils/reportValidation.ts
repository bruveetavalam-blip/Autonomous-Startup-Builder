import type { BackendReport, Source } from '../types';
import { parseStructuredValue, toReadableMarkdown } from '../components/RichText';

const BAD_RESPONSE_PATTERNS = [
  /offline\s+agent\s+draft/i,
  /remote\s+model\s+providers?\s+were\s+unavailable/i,
  /provider[s]?\s+(?:were\s+)?unavailable/i,
  /all\s+.*providers?\s+failed/i,
  /fallback/i,
  /timed?\s*out|timeout/i,
  /not\s+yet\s+specified/i,
  /still\s+being\s+generated/i,
  /unable\s+to\s+reach\s+the\s+backend/i,
  /agent\s+failed/i,
  /error\s*:|exception\s*:|traceback/i,
];

export const sectionAgents: Record<string, string> = {
  Overview: 'market_research',
  'Market Research': 'market_research',
  'Business Plan': 'business_plan',
  Competitors: 'competitors',
  'Competitor Analysis': 'competitors',
  Marketing: 'marketing',
  Revenue: 'revenue',
  Validation: 'validation',
  Sources: 'source_collector',
};

export function valueToText(value: unknown): string {
  const parsed = parseStructuredValue(value);
  return parsed.type === 'data' ? toReadableMarkdown(parsed.value) : parsed.text;
}

export function isInvalidAiText(value: unknown): boolean {
  const raw = valueToText(value).trim();
  if (!raw) return true;
  return BAD_RESPONSE_PATTERNS.some((pattern) => pattern.test(raw));
}

export function cleanReportText(value: unknown): string {
  const raw = valueToText(value).replace(/[{}[\]"]/g, '').replace(/\\+/g, '').trim();
  return isInvalidAiText(raw) ? '' : raw;
}

export function validList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : cleanReportText(value) ? [value] : [];
  return raw.map(cleanReportText).filter(Boolean);
}

export function validSources(report: BackendReport | null | undefined): Source[] {
  const sources = report?.sources || report?.market?.sources || [];
  return sources.filter((source) => source.url && cleanReportText(source.title));
}

export function sectionState(report: BackendReport | null | undefined, tab: string, value: unknown): 'valid' | 'loading' | 'failed' {
  const agentName = sectionAgents[tab];
  const agent = agentName ? report?.agent_status?.[agentName] : undefined;
  if (agent?.status === 'failed' || (agentName && report?.errors?.[agentName])) return 'failed';
  if (!isInvalidAiText(value)) return 'valid';
  if (agent?.status === 'running' || agent?.status === 'waiting') return 'loading';
  return 'failed';
}

