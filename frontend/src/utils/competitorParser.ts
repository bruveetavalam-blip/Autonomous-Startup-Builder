import { parseStructuredValue, toReadableMarkdown } from '../components/RichText';

export type CompetitorDetails = Record<string, unknown> & {
  name: string;
  geography_tier?: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  pricing: string;
  target_customers: string;
  market_position: string;
  opportunity_gap: string;
  why_relevant: string;
};

const fields = {
  name: ['name', 'company', 'company name', 'competitor', 'competitor name', 'brand'],
  geography_tier: ['geography tier', 'tier', 'location tier', 'scope'],
  description: ['description', 'summary', 'overview', 'profile'],
  strengths: ['strengths', 'key strengths', 'advantages'],
  weaknesses: ['weaknesses', 'key weaknesses', 'limitations', 'disadvantages'],
  pricing: ['pricing', 'price', 'pricing model', 'price range'],
  target_customers: ['target customers', 'target customer', 'customer segment', 'customers', 'audience', 'target audience'],
  market_position: ['market position', 'positioning', 'market positioning'],
  opportunity_gap: ['opportunity gap', 'market gap', 'positioning gap', 'gap'],
  location: ['location', 'address', 'city', 'actual location', 'operating location'],
  distance_km: ['distance', 'distance_km', 'distance in km', 'km away', 'miles away'],
  why_relevant: ['why it is relevant', 'why relevant', 'relevance', 'reason', 'selected for', 'selection reason'],
} as const;

const key = (value: string) => value.toLowerCase().replace(/[*`:#()[\]{}]/g, '').replace(/[_\-/]/g, ' ').replace(/\s+/g, ' ').trim();
const labelToField = (label: string) => Object.entries(fields).find(([, aliases]) => aliases.includes(key(label) as never))?.[0] as keyof typeof fields | undefined;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
const list = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(list).filter(Boolean) : text(value) ? [text(value)] : [];

const readField = (record: Record<string, unknown>, field: keyof typeof fields): unknown => {
  for (const [candidate, value] of Object.entries(record)) if (fields[field].includes(key(candidate) as never) && value != null) return value;
  const containers = ['details', 'analysis', 'profile', 'data', 'attributes'];
  for (const container of containers) {
    const value = record[container];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = readField(value as Record<string, unknown>, field);
      if (nested != null && text(nested)) return nested;
    }
  }
  return undefined;
};

const normalizeRecord = (record: Record<string, unknown>, index: number): CompetitorDetails => ({
  ...record,
  name: text(readField(record, 'name')) || `Competitor ${index + 1}`,
  geography_tier: text(readField(record, 'geography_tier')),
  description: text(readField(record, 'description')),
  strengths: list(readField(record, 'strengths')),
  weaknesses: list(readField(record, 'weaknesses')),
  pricing: text(readField(record, 'pricing')),
  target_customers: text(readField(record, 'target_customers')),
  market_position: text(readField(record, 'market_position')),
  opportunity_gap: text(readField(record, 'opportunity_gap')),
  location: text(readField(record, 'location')),
  distance_km: text(readField(record, 'distance_km')),
  why_relevant: text(readField(record, 'why_relevant')),
});

const recordsFromValue = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  for (const candidate of ['competitors', 'items', 'results', 'data', 'companies']) {
    if (Array.isArray(record[candidate])) return recordsFromValue(record[candidate]);
  }
  return [record];
};

const isCompetitorStart = (line: string) => /^#{1,6}\s+/.test(line) || /^\s*\d+[.)]\s+(?!pricing|strengths|weaknesses)/i.test(line) || /^\s*(?:\*\*)?(?:competitor|company|name)\s*:/i.test(line);
const removeMarker = (line: string) => line.replace(/^#{1,6}\s+|^\s*\d+[.)]\s+|^\s*[-*+]\s+/, '').replace(/^\*\*|\*\*$/g, '').trim();

/** Converts inconsistent AI markdown/narrative competitor output into card-ready fields. */
export const parseCompetitorText = (raw: string): CompetitorDetails[] => {
  const inlineEntries = parseInlineLabels(raw);
  if (inlineEntries.length) return inlineEntries;
  const lines = raw.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  const blocks: string[][] = [];
  for (const line of lines) {
    if (isCompetitorStart(line) && blocks.length && !labelToField(removeMarker(line))) blocks.push([]);
    if (!blocks.length) blocks.push([]);
    blocks[blocks.length - 1]?.push(line);
  }
  return blocks.map((block, index) => {
    const values: Record<string, unknown> = {};
    let current: keyof typeof fields | 'description' = 'description';
    for (const line of block) {
      const normalized = removeMarker(line);
      const match = normalized.match(/^([^:]{2,40}):\s*(.*)$/);
      const field = match && labelToField(match[1]);
      if (field) { current = field; values[field] = match[2].trim(); continue; }
      const standalone = labelToField(normalized);
      if (standalone) { current = standalone; values[current] = ''; continue; }
      if (!values.name && isCompetitorStart(line)) { values.name = normalized; continue; }
      const content = normalized.replace(/^[-*+]\s+/, '');
      values[current] = `${text(values[current])}${text(values[current]) ? '\n' : ''}${content}`;
    }
    return normalizeRecord(values, index);
  }).filter(item => item.name !== 'Competitor 1' || item.description || item.pricing || item.strengths.length);
};

/** Handles provider fallbacks that serialize JSON as `name: …, pricing: …` on one line. */
const parseInlineLabels = (raw: string): CompetitorDetails[] => {
  const input = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').replace(/[{}]/g, ' ').trim();
  const aliases = Object.values(fields).flat().map(alias => alias.replace(/ /g, '[ _-]?')).join('|');
  const matcher = new RegExp(`(?:^|,\\s*)(summary|competitors?|${aliases})\\s*:`, 'gi');
  const matches = Array.from(input.matchAll(matcher));
  if (!matches.some(match => key(match[1]) === 'name')) return [];
  const entries: Record<string, unknown>[] = []; let entry: Record<string, unknown> | null = null;
  matches.forEach((match, index) => {
    const field = labelToField(match[1]);
    const start = (match.index || 0) + match[0].length;
    const value = input.slice(start, index + 1 < matches.length ? matches[index + 1].index : input.length).replace(/^,\s*|,\s*$/g, '').trim();
    if (field === 'name') { entry = { name: value }; entries.push(entry); return; }
    if (entry && field) entry[field] = value;
  });
  return entries.map(normalizeRecord).filter(item => item.name && item.name !== 'Competitor 1');
};

export const parseCompetitors = (value: unknown): CompetitorDetails[] => {
  const parsed = parseStructuredValue(value);
  if (parsed.type === 'data') {
    const records = recordsFromValue(parsed.value);
    // Older reports may contain a valid fenced JSON response nested inside a fallback snapshot.
    if (records.length === 1 && typeof records[0].description === 'string') {
      const embedded = records[0].description.replace(/^\s*```(?:json)?\s*|\s*```\s*$/gi, '');
      const nested = parseStructuredValue(embedded);
      if (nested.type === 'data') {
        const nestedRecords = recordsFromValue(nested.value).map(normalizeRecord).filter(item => item.name || item.description);
        if (nestedRecords.length) return nestedRecords;
      }
      const narrativeRecords = parseCompetitorText(embedded);
      if (narrativeRecords.length) return narrativeRecords;
    }
    return records.map(normalizeRecord).filter(item => item.name || item.description);
  }
  return parsed.text ? parseCompetitorText(parsed.text) : [];
};

export const competitorSummary = (value: unknown): string => {
  const parsed = parseStructuredValue(value);
  if (parsed.type === 'data' && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)) {
    const record = parsed.value as Record<string, unknown>;
    return text(record.summary ?? record.overview ?? record.analysis);
  }
  if (parsed.type === 'text') {
    const summary = parsed.text.match(/(?:^|,\s*)summary\s*:\s*(.*?)(?=,\s*(?:competitors?|name)\s*:|$)/i);
    return summary?.[1].trim() || 'Competitor analysis generated by the research agent.';
  }
  return toReadableMarkdown(value);
};
