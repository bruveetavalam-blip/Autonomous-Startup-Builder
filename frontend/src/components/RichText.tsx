import { Fragment, isValidElement, type ReactNode } from 'react';

const inline = (value: string): ReactNode[] => value.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean).map((token, index) => {
  if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) return <strong key={index}>{token.slice(2, -2)}</strong>;
  if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) return <em key={index}>{token.slice(1, -1)}</em>;
  if (token.startsWith('`') && token.endsWith('`')) return <code key={index}>{token.slice(1, -1)}</code>;
  const link = token.match(/^\[([^\]]+)\]\(([^\s\)]+)(?:\s+"[^"]*")?\)$/);
  return link ? <a href={link[2]} target="_blank" rel="noreferrer" key={index}>{link[1]}</a> : <Fragment key={index}>{token}</Fragment>;
});

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
const markdownLabels = /\s+(?=(?:Executive Summary|Problem Statement|Solution|Target Customers?|Business Model|Marketing Strategy|Market (?:Analysis|Research)|Revenue Model|Competitive (?:Analysis|Landscape)|Implementation Plan|Next Steps?|Risks?|Recommendations?)\s*:)/gi;
const normalizeMarkdown = (value: string) => value.replace(/\r\n/g, '\n').replace(/\\n/g, '\n').replace(markdownLabels, '\n\n').replace(/^\s*[-*+]\s+/gm, '- ').replace(/^\s*\d+[.)]\s+/gm, '1. ').trim();

const decodeEscapedText = (value: string) => value.replace(/\\r\\n|\\r|\\n/g, '\n').replace(/\\t/g, '  ').replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\'/g, "'").replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const serializeInline = (value: unknown): string => typeof value === 'string' ? decodeEscapedText(value).trim() : Array.isArray(value) ? value.map(serializeInline).join(', ') : value && typeof value === 'object' ? Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${serializeInline(item)}`).join('; ') : String(value ?? '');
const tryParseJson = (candidate: string): unknown | null => { const trimmed = candidate.trim(); if (!trimmed) return null; for (const variant of [trimmed, ...(trimmed.startsWith('"') && trimmed.endsWith('"') ? [trimmed.slice(1, -1)] : [])]) { try { const parsed = JSON.parse(variant); if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) return parsed; if (typeof parsed === 'string') return tryParseJson(parsed); } catch { /* render as text */ } } return null; };

export function parseStructuredValue(value: unknown): { type: 'text'; text: string } | { type: 'data'; value: unknown } {
  if (value == null) return { type: 'text', text: '' };
  if (typeof value === 'string') { const cleaned = decodeEscapedText(value.trim()); const parsed = tryParseJson(cleaned); return parsed !== null ? { type: 'data', value: parsed } : { type: 'text', text: cleaned }; }
  return Array.isArray(value) || typeof value === 'object' ? { type: 'data', value } : { type: 'text', text: String(value) };
}

export function toReadableMarkdown(value: unknown): string { const parsed = parseStructuredValue(value); if (parsed.type === 'text') return parsed.text; if (Array.isArray(parsed.value)) return parsed.value.map(item => `- ${serializeInline(item)}`).join('\n'); return Object.entries(parsed.value as Record<string, unknown>).map(([key, item]) => `## ${key.replace(/_/g, ' ')}\n${Array.isArray(item) ? item.map(entry => `- ${serializeInline(entry)}`).join('\n') : serializeInline(item)}`).join('\n\n'); }

export function RichText({ content, empty = '' }: { content: unknown; empty?: string }) {
  const parsed = parseStructuredValue(content); const raw = parsed.type === 'data' ? toReadableMarkdown(parsed.value) : parsed.text; if (!raw.trim()) return empty ? <p className="rich-empty">{empty}</p> : null;
  const lines = normalizeMarkdown(raw).split('\n'); const blocks: ReactNode[] = []; let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim(); if (!line) { index += 1; continue; }
    if (/^```/.test(line)) { const language = line.slice(3).trim(); const code: string[] = []; index += 1; while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]); if (index < lines.length) index += 1; blocks.push(<pre key={`code-${index}`}><code className={language ? `language-${language}` : undefined}>{code.join('\n')}</code></pre>); continue; }
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1])) { const head = cells(line); const rows: string[][] = []; index += 2; while (index < lines.length && lines[index].includes('|') && lines[index].trim()) rows.push(cells(lines[index++])); blocks.push(<div className="rich-table-wrap" key={`table-${index}`}><table className="rich-table"><thead><tr>{head.map((cell, i) => <th key={i}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{head.map((_, cellIndex) => <td key={cellIndex}>{inline(row[cellIndex] || '')}</td>)}</tr>)}</tbody></table></div>); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)/); if (heading) { const Tag = `h${Math.min(3, heading[1].length)}` as 'h1' | 'h2' | 'h3'; blocks.push(<Tag key={`heading-${index}`}>{inline(heading[2])}</Tag>); index += 1; continue; }
    const labelledHeading = line.match(/^([A-Z][A-Za-z /&-]{2,50}):\s*$/); if (labelledHeading) { blocks.push(<h3 key={`heading-${index}`}>{labelledHeading[1]}</h3>); index += 1; continue; }
    if (/^>\s?/.test(line)) { blocks.push(<blockquote key={`quote-${index}`}>{inline(line.replace(/^>\s?/, ''))}</blockquote>); index += 1; continue; }
    const ordered = /^\d+[.)]\s+/.test(line); if (ordered || /^[-*+]\s+/.test(line)) { const items: string[] = []; const matcher = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/; while (index < lines.length && matcher.test(lines[index])) items.push(lines[index++].replace(matcher, '')); const List = ordered ? 'ol' : 'ul'; blocks.push(<List key={`list-${index}`}>{items.map((item, i) => <li key={i}>{inline(item)}</li>)}</List>); continue; }
    const paragraph = [line]; index += 1; while (index < lines.length && lines[index].trim() && !/^(?:```|#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/.test(lines[index].trim())) paragraph.push(lines[index++].trim()); let body = paragraph.join('\n'); if (/^\*\*[\s\S]{120,}\*\*$/.test(body)) body = body.slice(2, -2); blocks.push(<p key={`paragraph-${index}`}>{inline(body)}</p>);
  }
  const hasBusinessSections = /(?:Executive Summary|Problem Statement|Solution|Target Customers?|Business Model|Marketing Strategy|Implementation Plan)/i.test(raw);
  if (!hasBusinessSections) return <div className="rich-text">{blocks}</div>;

  const placards: ReactNode[][] = [];
  let current: ReactNode[] = [];
  for (const block of blocks) {
    // H3 headings are supporting labels (for example, the service list under
    // "Solution"), so they stay in the same placard as their H2 section.
    const isHeading = isValidElement(block) && typeof block.type === 'string' && /^h[12]$/.test(block.type);
    if (isHeading && current.length) {
      placards.push(current);
      current = [];
    }
    current.push(block);
  }
  if (current.length) placards.push(current);
  return <div className="rich-text section-placards">{placards.map((placard, index) => <section className={`section-placard ${index % 2 ? 'dark' : 'light'}`} key={index}>{placard}</section>)}</div>;
}
