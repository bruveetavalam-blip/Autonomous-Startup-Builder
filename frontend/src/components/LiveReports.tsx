import { useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Printer, TrendingUp } from 'lucide-react';
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { Badge, Button, Card, PageHeader } from './ui';
import { parseStructuredValue, RichText, toReadableMarkdown } from './RichText';
import { useStartup } from '../context/StartupContext';
import type { BackendReport, RevenueModel, Source } from '../types';

const inr = (value: number | undefined) => { const n = Number(value || 0); if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')} Crore`; if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')} Lakh`; return `₹${n.toLocaleString('en-IN')}`; };
const text = (value: unknown) => {
  const parsed = parseStructuredValue(value);
  return parsed.type === 'data' ? toReadableMarkdown(parsed.value) : parsed.text;
};
const clean = (value: unknown) => text(value).replace(/[{}[\]"]/g, '').replace(/\\+/g, '').trim();
const sourceList = (report: BackendReport): Source[] => report.sources || report.market?.sources || [];
const locationText = (report: BackendReport) => [report.location?.city, report.location?.state, report.location?.country].filter(Boolean).join(', ') || 'India';
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const normalizeCompetitors = (report: BackendReport) => {
  const parsed = parseStructuredValue(report.competitors);
  if (parsed.type === 'data') {
    const value = parsed.value;
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (Array.isArray(record.competitors)) return record.competitors as Array<Record<string, unknown>>;
      if (Array.isArray(record.items)) return record.items as Array<Record<string, unknown>>;
    }
  }
  if (parsed.type === 'text' && parsed.text.trim()) {
    return [{ name: 'Competitor snapshot', description: parsed.text, strengths: [], weaknesses: [], pricing: '', target_customers: '', market_position: '', why_relevant: '', opportunity_gap: '' }];
  }
  return [];
};
const normalizeRevenue = (report?: BackendReport | null) => {
  const parsed = parseStructuredValue(report?.revenue_estimate);
  return parsed.type === 'data' && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value) ? parsed.value as RevenueModel : null;
};
const normalizeValidation = (report?: BackendReport | null) => {
  const parsed = parseStructuredValue(report?.validation);
  return parsed.type === 'data' && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value) ? parsed.value as Record<string, unknown> : {};
};
const list = (value: unknown) => Array.isArray(value) ? value.map(clean).filter(Boolean) : clean(value) ? [clean(value)] : [];
const htmlList = (items: string[]) => items.length ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="muted">Not yet specified.</p>';
const htmlTable = (headers: string[], rows: string[][]) => rows.length ? `<table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="muted">Not yet specified.</p>';
const docTable = (headers: string[], rows: string[][]) => rows.length ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: headers.map(header => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })] })) }), ...rows.map(row => new TableRow({ children: row.map(cell => new TableCell({ children: [new Paragraph(cell)] })) }))] }) : new Paragraph('Not yet specified.');
const docBullets = (items: string[]) => items.length ? items.map(item => new Paragraph({ text: item, bullet: { level: 0 } })) : [new Paragraph('Not yet specified.')];
const sectionHtml = (title: string, value: unknown, report: BackendReport) => {
  if (title === 'Competitor Analysis') return normalizeCompetitors(report).map((competitor, index) => `<div class="card"><h3>${escapeHtml(clean(competitor.name) || `Competitor ${index + 1}`)}</h3><p>${escapeHtml(clean(competitor.description))}</p><h4>Strengths</h4>${htmlList(list(competitor.strengths))}<h4>Weaknesses</h4>${htmlList(list(competitor.weaknesses))}<h4>Pricing</h4><p>${escapeHtml(clean(competitor.pricing) || 'Not yet specified')}</p><h4>Target Customers</h4><p>${escapeHtml(clean(competitor.target_customers) || 'Not yet specified')}</p><h4>Market Position</h4><p>${escapeHtml(clean(competitor.market_position) || 'Not yet specified')}</p><h4>Opportunity Gap</h4><p>${escapeHtml(clean(competitor.opportunity_gap) || 'Not yet specified')}</p></div>`).join('') || '<p class="muted">This section is still being generated.</p>';
  if (title === 'Revenue') { const revenue = normalizeRevenue(report); if (!revenue) return `<p>${escapeHtml(clean(value) || 'This section is still being generated.')}</p>`; return `<h3>Startup Cost</h3>${htmlTable(['Item', 'Amount'], (revenue.startup_cost?.items || []).map(item => [item.name, inr(item.amount)]))}<h3>Monthly Expenses</h3>${htmlTable(['Item', 'Amount'], (revenue.monthly_expenses || []).map(item => [item.name, inr(item.amount)]))}<h3>Revenue Projection</h3>${htmlTable(['Month', 'Revenue', 'Expenses', 'Profit'], (revenue.revenue_projection || []).map(item => [item.month, inr(item.revenue), inr(item.expenses), inr(item.profit)]))}<h3>Break-even</h3><p>${revenue.break_even_month ? `Projected break-even in month ${revenue.break_even_month}.` : 'Not yet specified.'}</p><h3>Funding</h3><p>${inr(revenue.funding_requirement)}</p>${revenue.notes ? `<p>${escapeHtml(clean(revenue.notes))}</p>` : ''}`; }
  if (title === 'Validation') { const validation = normalizeValidation(report); return `<h3>Overall Score</h3><p>${escapeHtml(clean(validation.overall_score) || 'Not yet specified')}/100</p><h3>Strengths</h3>${htmlList(list(validation.strong_points || validation.strengths))}<h3>Weaknesses</h3>${htmlList(list(validation.weak_points || validation.weaknesses))}<h3>Risks</h3>${htmlList(list(validation.risks))}<h3>Recommendations</h3>${htmlList(list(validation.recommendations))}<h3>Next Steps</h3>${htmlList(list(validation.next_actions))}`; }
  const body = clean(value);
  return body ? `<p>${escapeHtml(body).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '<p class="muted">This section is still being generated.</p>';
};
const docSectionChildren = (title: string, value: unknown, report: BackendReport) => {
  const children: Array<Paragraph | Table> = [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 })];
  if (title === 'Competitor Analysis') {
    const competitors = normalizeCompetitors(report);
    if (!competitors.length) return [...children, new Paragraph('This section is still being generated.')];
    competitors.forEach((competitor, index) => {
      children.push(new Paragraph({ text: clean(competitor.name) || `Competitor ${index + 1}`, heading: HeadingLevel.HEADING_2 }), new Paragraph(clean(competitor.description)));
      children.push(new Paragraph({ text: 'Strengths', heading: HeadingLevel.HEADING_3 }), ...docBullets(list(competitor.strengths)));
      children.push(new Paragraph({ text: 'Weaknesses', heading: HeadingLevel.HEADING_3 }), ...docBullets(list(competitor.weaknesses)));
      ['pricing', 'target_customers', 'market_position', 'opportunity_gap'].forEach(key => children.push(new Paragraph({ children: [new TextRun({ text: `${key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}: `, bold: true }), new TextRun(clean(competitor[key]) || 'Not yet specified')] })));
    });
    return children;
  }
  if (title === 'Revenue') {
    const revenue = normalizeRevenue(report);
    if (!revenue) return [...children, new Paragraph(clean(value) || 'This section is still being generated.')];
    children.push(new Paragraph({ text: 'Startup Cost', heading: HeadingLevel.HEADING_2 }), docTable(['Item', 'Amount'], (revenue.startup_cost?.items || []).map(item => [item.name, inr(item.amount)])));
    children.push(new Paragraph({ text: 'Monthly Expenses', heading: HeadingLevel.HEADING_2 }), docTable(['Item', 'Amount'], (revenue.monthly_expenses || []).map(item => [item.name, inr(item.amount)])));
    children.push(new Paragraph({ text: 'Revenue Projection', heading: HeadingLevel.HEADING_2 }), docTable(['Month', 'Revenue', 'Expenses', 'Profit'], (revenue.revenue_projection || []).map(item => [item.month, inr(item.revenue), inr(item.expenses), inr(item.profit)])));
    children.push(new Paragraph({ text: 'Break-even', heading: HeadingLevel.HEADING_2 }), new Paragraph(revenue.break_even_month ? `Projected break-even in month ${revenue.break_even_month}.` : 'Not yet specified.'));
    children.push(new Paragraph({ text: 'Funding', heading: HeadingLevel.HEADING_2 }), new Paragraph(inr(revenue.funding_requirement)));
    if (revenue.notes) children.push(new Paragraph(clean(revenue.notes)));
    return children;
  }
  if (title === 'Validation') {
    const validation = normalizeValidation(report);
    children.push(new Paragraph({ children: [new TextRun({ text: 'Overall Score: ', bold: true }), new TextRun(`${clean(validation.overall_score) || 'Not yet specified'}/100`)] }));
    children.push(new Paragraph({ text: 'Strengths', heading: HeadingLevel.HEADING_2 }), ...docBullets(list(validation.strong_points || validation.strengths)));
    children.push(new Paragraph({ text: 'Weaknesses', heading: HeadingLevel.HEADING_2 }), ...docBullets(list(validation.weak_points || validation.weaknesses)));
    children.push(new Paragraph({ text: 'Risks', heading: HeadingLevel.HEADING_2 }), ...docBullets(list(validation.risks)));
    children.push(new Paragraph({ text: 'Recommendations', heading: HeadingLevel.HEADING_2 }), ...docBullets(list(validation.recommendations)));
    children.push(new Paragraph({ text: 'Next Steps', heading: HeadingLevel.HEADING_2 }), ...docBullets(list(validation.next_actions)));
    return children;
  }
  (clean(value) || 'This section is still being generated.').split(/\r?\n/).filter(Boolean).forEach(line => children.push(new Paragraph({ children: [new TextRun({ text: line.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, ''), bold: /^\s*[-*+\d]/.test(line) })] })));
  return children;
};

function exportPdf(report: BackendReport) {
  const popup = window.open('', '_blank', 'width=900,height=700'); if (!popup) return;
  const sections: Array<[string, unknown]> = [['Executive Summary', report.analysis], ['Market Research', report.market?.insights], ['Competitor Analysis', report.competitors], ['Business Plan', report.business_plan], ['Revenue', report.revenue_estimate], ['Marketing', report.marketing_strategy], ['Validation', report.validation]];
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(report.startup || 'Startup Report')}</title><style>@page{margin:22mm}body{font:11pt Arial;color:#20324d;line-height:1.55}h1{font-size:28pt;color:#123d70}h2{margin-top:22pt;color:#1565c0;border-bottom:1px solid #dbe5ef;padding-bottom:5pt}h3{color:#163b63;margin:14pt 0 6pt}.cover{height:85vh;display:flex;flex-direction:column;justify-content:center}.card,.source{margin:10pt 0;padding:10pt;border:1px solid #e4ebf2;border-radius:6pt}.muted{color:#6c7c90;font-size:9pt}a{color:#1565c0}table{width:100%;border-collapse:collapse;margin:8pt 0 14pt}th,td{border:1px solid #dbe5ef;padding:6pt;text-align:left;vertical-align:top}th{background:#edf4fb}</style></head><body><section class="cover"><h1>${escapeHtml(report.startup || 'Autonomous Startup Report')}</h1><p>Location-aware startup blueprint</p><p class="muted">${escapeHtml(locationText(report))}</p><p class="muted">Generated by the autonomous agent team</p></section><h1>Table of Contents</h1><ol>${sections.map(([title]) => `<li>${title}</li>`).join('')}<li>Sources</li><li>Appendix</li></ol>${sections.map(([title, value]) => `<section><h2>${title}</h2>${sectionHtml(title, value, report)}</section>`).join('')}<section><h2>Sources</h2>${sourceList(report).map(source => `<div class="source"><strong>${escapeHtml(clean(source.title))}</strong><br/><a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a><p>${escapeHtml(clean(source.description || 'Reference used by the autonomous research workflow.'))}</p><span class="muted">${escapeHtml(clean(source.agent || 'Autonomous agent'))}</span></div>`).join('')}</section><section><h2>Appendix</h2><p>Financial figures are planning estimates. Validate assumptions with local customers, suppliers, and professional advisers.</p></section></body></html>`);
  popup.document.close(); popup.focus(); window.setTimeout(() => popup.print(), 250);
}

async function exportDocx(report: BackendReport) {
  const sections: Array<[string, unknown]> = [['Executive Summary', report.analysis], ['Market Research', report.market?.insights], ['Competitor Analysis', report.competitors], ['Business Plan', report.business_plan], ['Revenue', report.revenue_estimate], ['Marketing', report.marketing_strategy], ['Validation', report.validation]];
  const children: Array<Paragraph | Table> = [new Paragraph({ text: report.startup || 'Autonomous Startup Report', heading: HeadingLevel.TITLE }), new Paragraph({ text: `Location: ${locationText(report)}` }), new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_1 }), ...sections.map(([title]) => new Paragraph({ text: title, bullet: { level: 0 } }))];
  sections.forEach(([title, value]) => children.push(...docSectionChildren(title, value, report)));
  children.push(new Paragraph({ text: 'Sources', heading: HeadingLevel.HEADING_1 })); sourceList(report).forEach(source => children.push(new Paragraph({ children: [new TextRun({ text: source.title, bold: true }), new TextRun({ text: ` — ${source.url} (${source.agent || 'Autonomous agent'})` })] })));
  const blob = await Packer.toBlob(new Document({ sections: [{ properties: {}, children }] })); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${(report.startup || 'startup-report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.docx`; link.click(); URL.revokeObjectURL(url);
}

export function LiveReports() {
  const { report } = useStartup(); const [tab, setTab] = useState('Overview');
  const tabs = ['Overview', 'Business Plan', 'Competitors', 'Marketing', 'Revenue', 'Validation', 'Sources'];
  const revenue = useMemo(() => normalizeRevenue(report), [report?.revenue_estimate]);
  const sources = sourceList(report || {});
  const competitors = useMemo(() => normalizeCompetitors(report || {}), [report?.competitors]);
  const competitorSummary = useMemo(() => {
    const parsed = parseStructuredValue(report?.competitors);
    if (parsed.type === 'data' && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)) {
      const record = parsed.value as Record<string, unknown>;
      return typeof record.summary === 'string' ? record.summary : '';
    }
    return parsed.type === 'text' ? parsed.text : '';
  }, [report?.competitors]);
  const values: Record<string, unknown> = { Overview: report?.analysis, 'Business Plan': report?.business_plan, Competitors: report?.competitors, Marketing: report?.marketing_strategy, Validation: report?.validation };
  const renderRevenue = () => !revenue ? <Card className="skeleton-card"><h2>Revenue model running</h2><p>Financial projections will appear as soon as the Revenue Estimation agent finishes.</p>{toReadableMarkdown(report?.revenue_estimate) ? <RichText content={toReadableMarkdown(report?.revenue_estimate)} /> : null}</Card> : <div className="revenue-dashboard"><div className="revenue-kpis"><Card><span>Startup Cost</span><b>{inr(revenue.startup_cost?.total)}</b></Card><Card><span>Monthly Expenses</span><b>{inr((revenue.monthly_expenses || []).reduce((sum, item) => sum + (item.amount || 0), 0))}</b></Card><Card><span>Funding Required</span><b>{inr(revenue.funding_requirement)}</b></Card></div><div className="revenue-columns"><Card><h2>Startup Cost</h2>{(revenue.startup_cost?.items || []).map(item => <div className="money-row" key={item.name}><span>{item.name}</span><b>{inr(item.amount)}</b></div>)}</Card><Card><h2>Monthly Expenses</h2>{(revenue.monthly_expenses || []).map(item => <div className="money-row" key={item.name}><span>{item.name}</span><b>{inr(item.amount)}</b></div>)}</Card></div><Card><h2>Revenue Forecast & Profit Projection</h2><div className="projection-chart">{(revenue.revenue_projection || []).map(item => <div className="projection-row" key={item.month}><span>{item.month}</span><i style={{ width: `${Math.min(100, Math.max(3, (item.revenue / Math.max(...(revenue.revenue_projection || []).map(point => point.revenue), 1)) * 100))}%` }}/><b>{inr(item.revenue)}</b><em>{inr(item.profit)} profit</em></div>)}</div></Card><div className="revenue-columns"><Card><h2>Break-even</h2><p>Projected break-even in month {revenue.break_even_month || '—'}.</p></Card><Card><h2>Profit Projection</h2><p className="big-money">{inr((revenue.revenue_projection || []).slice(-1)[0]?.profit)}</p><p>{revenue.notes || 'Financial assumptions are still being refined.'}</p></Card></div></div>;
  const renderSources = () => <div className="sources-grid">{Object.entries(sources.reduce<Record<string, Source[]>>((groups, source) => { const key = source.group || 'Research Sources'; (groups[key] ||= []).push(source); return groups; }, {})).map(([group, items]) => <Card key={group}><div className="card-label">{group.toUpperCase()}</div>{items.map(source => <a className="source-item" href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${source.title}`}><div><b>{source.title}</b><p>{source.description || 'Reference used by the autonomous research workflow.'}</p><small>{source.agent || 'Autonomous agent'}</small></div><ExternalLink size={15}/></a>)}</Card>)}</div>;
  const renderValidation = () => { const validation = normalizeValidation(report); return <div className="validation-report"><Card><div className="card-label">VALIDATION SCORE</div><h1>{clean(validation.overall_score) || '—'}<small>/100</small></h1><RichText content={validation.panel_verdict} /></Card><div className="revenue-columns"><Card><h2>Strengths</h2><RichText content={list(validation.strong_points || validation.strengths).map(item => `- ${item}`).join('\n')} /></Card><Card><h2>Weaknesses</h2><RichText content={list(validation.weak_points || validation.weaknesses).map(item => `- ${item}`).join('\n')} /></Card></div><div className="revenue-columns"><Card><h2>Risks</h2><RichText content={list(validation.risks).map(item => `- ${item}`).join('\n')} /></Card><Card><h2>Recommendations</h2><RichText content={list(validation.recommendations).map(item => `- ${item}`).join('\n')} /></Card></div><Card><h2>Next Steps</h2><RichText content={list(validation.next_actions).map((item, index) => `${index + 1}. ${item}`).join('\n')} /></Card></div>; };
  const exportActions = report ? <div className="report-export-actions"><Button variant="secondary" onClick={() => exportPdf(report)}><Printer size={15}/> PDF</Button><Button variant="secondary" onClick={() => exportDocx(report)}><FileText size={15}/> DOCX</Button><Button variant="ghost" onClick={() => exportPdf(report)}><Download size={15}/></Button></div> : undefined;
  return <><PageHeader eyebrow="STARTUP REPORT" title="Your living startup blueprint" description={`Location-aware report for ${locationText(report || {})}. Sections remain readable as agents finish.`} action={<div className="report-header-actions"><Badge tone="green"><TrendingUp size={13}/> Live report</Badge>{exportActions}</div>}/><div className="report-tabs">{tabs.map(item => <button className={tab === item ? 'selected' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>{tab === 'Revenue' ? renderRevenue() : tab === 'Sources' ? renderSources() : tab === 'Validation' ? renderValidation() : tab === 'Competitors' ? <div className="report-layout"><article className="report-content"><Badge tone={values[tab] ? 'green' : 'gray'}>{values[tab] ? 'Agent complete' : 'Agent running'}</Badge><h1>Competitor Analysis</h1><RichText content={competitorSummary || 'A competitor scan is still being generated.'} /><div className="competitor-grid">{competitors.map((competitor, index) => <Card key={`${String(competitor.name || 'competitor')}-${index}`} className="competitor-card"><div className="card-label">{clean(competitor.geography_tier) || 'Local'}</div><h3>{String(competitor.name || `Competitor ${index + 1}`)}</h3><p>{clean(competitor.description)}</p><div className="competitor-section"><h4>Strengths</h4><ul>{list(competitor.strengths).slice(0, 4).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul></div><div className="competitor-section"><h4>Weaknesses</h4><ul>{list(competitor.weaknesses).slice(0, 4).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul></div><div className="competitor-section"><h4>Pricing</h4><p>{clean(competitor.pricing) || 'Not yet specified'}</p></div><div className="competitor-section"><h4>Target Customers</h4><p>{clean(competitor.target_customers) || 'Not yet specified'}</p></div><div className="competitor-section"><h4>Market Position</h4><p>{clean(competitor.market_position) || 'Not yet specified'}</p></div><div className="competitor-section"><h4>Why It Is Relevant</h4><p>{clean(competitor.why_relevant || competitor.selected_for) || 'Not yet specified'}</p></div><div className="competitor-section"><h4>Opportunity Gap</h4><p>{clean(competitor.opportunity_gap) || 'Not yet specified'}</p></div></Card>)}</div></article><aside className="report-side"><Card><p className="card-label">LOCATION</p><h3>{locationText(report || {})}</h3><p>Competitors are prioritized from local to regional to national relevance.</p></Card><Card><p className="card-label">LIVE SOURCES</p><h2>{sources.length}</h2><p>References collected across the agent team.</p></Card></aside></div> : <div className="report-layout"><article className="report-content"><Badge tone={values[tab] ? 'green' : 'gray'}>{values[tab] ? 'Agent complete' : 'Agent running'}</Badge><h1>{tab === 'Overview' ? report?.startup || 'Startup report' : tab}</h1><RichText content={values[tab]} /><div className="section-references"><div className="card-label">REFERENCES</div>{sources.slice(0, 3).map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title}</a>)}</div></article><aside className="report-side"><Card><p className="card-label">LOCATION</p><h3>{locationText(report || {})}</h3><p>Pricing, competition, costs, registrations, taxes, and go-to-market assumptions use this location.</p></Card><Card><p className="card-label">LIVE SOURCES</p><h2>{sources.length}</h2><p>References collected across the agent team.</p></Card></aside></div>}</>;
}

