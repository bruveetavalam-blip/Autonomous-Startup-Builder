import { Fragment, type ReactNode } from 'react';

const inline = (value: string): ReactNode[] => {
  const tokens = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith('*') && token.endsWith('*') && token.length > 1) return <em key={index}>{token.slice(1, -1)}</em>;
    if (token.startsWith('`') && token.endsWith('`')) return <code key={index}>{token.slice(1, -1)}</code>;
    const link = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (link) return <a href={link[2]} target="_blank" rel="noreferrer" key={index}>{link[1]}</a>;
    return <Fragment key={index}>{token.replace(/[*_#]/g, '')}</Fragment>;
  });
};

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(item => item.trim());

const normalizeMarkdown = (value: string) => value
  .replace(/\r\n/g, '\n')
  .replace(/^\s*[-*+]\s+/gm, '- ')
  .replace(/^\s*\d+[.)]\s+/gm, '1. ')
  .trim();

const decodeEscapedText = (value: string) => value
  .replace(/\\r\\n|\\r|\\n/g, '\n')
  .replace(/\\t/g, '  ')
  .replace(/\\"/g, '"')
  .replace(/\\\\/g, '\\')
  .replace(/\\'/g, "'")
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

const serializeInline = (value: unknown): string => {
  if (typeof value === 'string') return decodeEscapedText(value).trim();
  if (Array.isArray(value)) return value.map(item => serializeInline(item)).join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${serializeInline(item)}`).join('; ');
  }
  return String(value ?? '');
};

const tryParseJson = (candidate: string): unknown | null => {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  const variants = [trimmed];
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    variants.push(trimmed.slice(1, -1));
  }
  for (const variant of variants) {
    try {
      const parsed = JSON.parse(variant);
      if (parsed !== null && (typeof parsed === 'object' || Array.isArray(parsed))) return parsed;
      if (typeof parsed === 'string' && parsed.trim()) {
        const nested = tryParseJson(parsed);
        if (nested !== null) return nested;
      }
    } catch {
      // fall through to text rendering
    }
  }
  return null;
};

export function parseStructuredValue(value: unknown): { type: 'text'; text: string } | { type: 'data'; value: unknown } {
  if (value === null || value === undefined) return { type: 'text', text: '' };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return { type: 'text', text: '' };
    const cleaned = decodeEscapedText(trimmed);
    const parsed = tryParseJson(cleaned);
    if (parsed !== null) return { type: 'data', value: parsed };
    return { type: 'text', text: cleaned.replace(/[{}[\]"]/g, '').replace(/\\+/g, '').replace(/\s+/g, ' ').trim() };
  }
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return { type: 'data', value };
  }
  return { type: 'text', text: String(value) };
}

export function toReadableMarkdown(value: unknown): string {
  const parsed = parseStructuredValue(value);
  if (parsed.type === 'data') {
    const data = parsed.value;
    if (Array.isArray(data)) {
      return data.map(item => `- ${serializeInline(item)}`).join('\n');
    }
    if (data && typeof data === 'object') {
      return Object.entries(data as Record<string, unknown>).map(([key, item]) => {
        if (Array.isArray(item)) return `- ${key}: ${item.map(entry => serializeInline(entry)).join(', ')}`;
        if (item && typeof item === 'object') return `- ${key}: ${serializeInline(item)}`;
        return `- ${key}: ${serializeInline(item)}`;
      }).join('\n');
    }
  }
  return parsed.type === 'text' ? parsed.text : '';
}

export function RichText({ content, empty = 'This section is still being generated.' }: { content: unknown; empty?: string }) {
  const parsed = parseStructuredValue(content);
  const raw = parsed.type === 'data' ? toReadableMarkdown(parsed.value) : parsed.text;
  if (!raw.trim()) return <p className="rich-empty">{empty}</p>;
  const lines = normalizeMarkdown(raw).split(/\n/);
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1])) {
      const head = cells(line); const rows: string[][] = []; index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) { rows.push(cells(lines[index])); index += 1; }
      blocks.push(<div className="rich-table-wrap" key={`table-${index}`}><table className="rich-table"><thead><tr>{head.map((cell, cellIndex) => <th key={cellIndex}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{head.map((_, cellIndex) => <td key={cellIndex}>{inline(row[cellIndex] || '')}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.+)/);
    if (heading) { const level = Math.min(3, line.match(/^#+/)?.[0].length || 2); const Tag = `h${level}` as 'h1' | 'h2' | 'h3'; blocks.push(<Tag key={`heading-${index}`}>{inline(heading[1])}</Tag>); index += 1; continue; }
    if (/^>\s?/.test(line)) { blocks.push(<blockquote key={`quote-${index}`}>{inline(line.replace(/^>\s?/, ''))}</blockquote>); index += 1; continue; }
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = []; while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) { items.push(lines[index].replace(/^\s*[-*+]\s+/, '')); index += 1; }
      blocks.push(<ul key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>); continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = []; while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) { items.push(lines[index].replace(/^\s*\d+[.)]\s+/, '')); index += 1; }
      blocks.push(<ol key={`ordered-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>); continue;
    }
    const paragraph: string[] = [line]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^\s*(#{1,4}\s|[-*+]\s+|\d+[.)]\s+|>\s?)/.test(lines[index])) { paragraph.push(lines[index].trim()); index += 1; }
    blocks.push(<p key={`paragraph-${index}`}>{inline(paragraph.join(' '))}</p>);
  }
  return <div className="rich-text">{blocks}</div>;
}
