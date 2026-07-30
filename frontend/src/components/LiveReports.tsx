import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, LoaderCircle, Printer, RotateCcw, TrendingUp } from 'lucide-react';
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { Badge, Button, Card, PageHeader } from './ui';
import { parseStructuredValue, RichText, toReadableMarkdown } from './RichText';
import { competitorSummary, parseCompetitors } from '../utils/competitorParser';
import { cleanReportText, sectionAgents, sectionState, validList, validSources } from '../utils/reportValidation';
import { useStartup } from '../context/StartupContext';
import { startupService } from '../services/startupService';
import type { BackendReport, RevenueModel, Source } from '../types';

const inr = (value: number | undefined) => { const n = Number(value || 0); if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')} Crore`; if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')} Lakh`; return `₹${n.toLocaleString('en-IN')}`; };
const text = (value: unknown) => {
  const parsed = parseStructuredValue(value);
  return parsed.type === 'data' ? toReadableMarkdown(parsed.value) : parsed.text;
};
const clean = cleanReportText;
const sourceList = (report: BackendReport): Source[] => validSources(report);
const locationText = (report: BackendReport) => [report.location?.city, report.location?.state, report.location?.country].filter(Boolean).join(', ') || 'India';
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const normalizeCompetitors = (report: BackendReport) => parseCompetitors(report.competitors);
const normalizeRevenue = (report?: BackendReport | null) => {
  const parsed = parseStructuredValue(report?.revenue_estimate);
  return parsed.type === 'data' && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value) ? parsed.value as RevenueModel : null;
};
const normalizeValidation = (report?: BackendReport | null) => {
  const parsed = parseStructuredValue(report?.validation);
  return parsed.type === 'data' && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value) ? parsed.value as Record<string, unknown> : {};
};
const list = validList;
const htmlList = (items: string[]) => items.length ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
const htmlTable = (headers: string[], rows: string[][]) => rows.length ? `<table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
const docTable = (headers: string[], rows: string[][]) => rows.length ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: headers.map(header => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })] })) }), ...rows.map(row => new TableRow({ children: row.map(cell => new TableCell({ children: [new Paragraph(cell)] })) }))] }) : null;
const docBullets = (items: string[]) => items.map(item => new Paragraph({ text: item, bullet: { level: 0 } }));
const exportableSections = (report: BackendReport): Array<[string, unknown]> => {
  const sections: Array<[string, unknown]> = [['Executive Summary', report.analysis], ['Market Research', report.market?.insights], ['Competitor Analysis', report.competitors], ['Business Plan', report.business_plan], ['Revenue', report.revenue_estimate], ['Marketing', report.marketing_strategy], ['Validation', report.validation]];
  return sections.filter(([title, value]) => sectionState(report, title, value) === 'valid');
};
const sectionHtml = (title: string, value: unknown, report: BackendReport) => {
  if (sectionState(report, title, value) !== 'valid') return '';
  if (title === 'Competitor Analysis') return normalizeCompetitors(report).map((competitor, index) => `<div class="card"><h3>${escapeHtml(clean(competitor.name) || `Competitor ${index + 1}`)}</h3>${clean(competitor.description) ? `<p>${escapeHtml(clean(competitor.description))}</p>` : ''}${list(competitor.strengths).length ? `<h4>Strengths</h4>${htmlList(list(competitor.strengths))}` : ''}${list(competitor.weaknesses).length ? `<h4>Weaknesses</h4>${htmlList(list(competitor.weaknesses))}` : ''}${clean(competitor.pricing) ? `<h4>Pricing</h4><p>${escapeHtml(clean(competitor.pricing))}</p>` : ''}${clean(competitor.target_customers) ? `<h4>Target Customers</h4><p>${escapeHtml(clean(competitor.target_customers))}</p>` : ''}${clean(competitor.market_position) ? `<h4>Market Position</h4><p>${escapeHtml(clean(competitor.market_position))}</p>` : ''}${clean(competitor.opportunity_gap) ? `<h4>Opportunity Gap</h4><p>${escapeHtml(clean(competitor.opportunity_gap))}</p>` : ''}</div>`).join('');
  if (title === 'Revenue') { const revenue = normalizeRevenue(report); if (!revenue) return ''; const startupCost = htmlTable(['Item', 'Amount'], (revenue.startup_cost?.items || []).map(item => [item.name, inr(item.amount)])); const monthly = htmlTable(['Item', 'Amount'], (revenue.monthly_expenses || []).map(item => [item.name, inr(item.amount)])); const projection = htmlTable(['Month', 'Revenue', 'Expenses', 'Profit', 'Profit Label'], (revenue.revenue_projection || []).map(item => [item.month, inr(item.revenue), inr(item.expenses), inr(item.profit), item.profit_label || ''])); return `${startupCost ? `<h3>Startup Cost</h3>${startupCost}` : ''}${monthly ? `<h3>Monthly Expenses</h3>${monthly}` : ''}${projection ? `<h3>Revenue Projection</h3>${projection}` : ''}${revenue.break_even_month ? `<h3>Break-even</h3><p>Projected break-even in month ${revenue.break_even_month}.</p>` : ''}${revenue.estimated_roi ? `<h3>Estimated ROI</h3><p>${escapeHtml(revenue.estimated_roi)}</p>` : ''}${revenue.profitability_note ? `<h3>Profitability Note</h3><p>${escapeHtml(clean(revenue.profitability_note))}</p>` : ''}${revenue.funding_requirement ? `<h3>Funding</h3><p>${inr(revenue.funding_requirement)}</p>` : ''}${clean(revenue.notes) ? `<p>${escapeHtml(clean(revenue.notes))}</p>` : ''}`; }
  if (title === 'Validation') { const validation = normalizeValidation(report); return `${clean(validation.overall_score) ? `<h3>Overall Score</h3><p>${escapeHtml(clean(validation.overall_score))}/100</p>` : ''}${list(validation.strong_points || validation.strengths).length ? `<h3>Strengths</h3>${htmlList(list(validation.strong_points || validation.strengths))}` : ''}${list(validation.weak_points || validation.weaknesses).length ? `<h3>Weaknesses</h3>${htmlList(list(validation.weak_points || validation.weaknesses))}` : ''}${list(validation.risks).length ? `<h3>Risks</h3>${htmlList(list(validation.risks))}` : ''}${list(validation.recommendations).length ? `<h3>Recommendations</h3>${htmlList(list(validation.recommendations))}` : ''}${list(validation.next_actions).length ? `<h3>Next Steps</h3>${htmlList(list(validation.next_actions))}` : ''}`; }
  const body = clean(value);
  return body ? `<p>${escapeHtml(body).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '';
};
const docSectionChildren = (title: string, value: unknown, report: BackendReport) => {
  if (sectionState(report, title, value) !== 'valid') return [];
  const children: Array<Paragraph | Table> = [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 })];
  if (title === 'Competitor Analysis') {
    const competitors = normalizeCompetitors(report);
    if (!competitors.length) return [];
    competitors.forEach((competitor, index) => {
      children.push(new Paragraph({ text: clean(competitor.name) || `Competitor ${index + 1}`, heading: HeadingLevel.HEADING_2 }), new Paragraph(clean(competitor.description)));
      children.push(new Paragraph({ text: 'Strengths', heading: HeadingLevel.HEADING_3 }), ...docBullets(list(competitor.strengths)));
      children.push(new Paragraph({ text: 'Weaknesses', heading: HeadingLevel.HEADING_3 }), ...docBullets(list(competitor.weaknesses)));
      ['pricing', 'target_customers', 'market_position', 'opportunity_gap'].forEach(key => { const value = clean(competitor[key]); if (value) children.push(new Paragraph({ children: [new TextRun({ text: `${key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}: `, bold: true }), new TextRun(value)] })); });
    });
    return children;
  }
  if (title === 'Revenue') {
    const revenue = normalizeRevenue(report);
    if (!revenue) return [];
    const startupCost = docTable(['Item', 'Amount'], (revenue.startup_cost?.items || []).map(item => [item.name, inr(item.amount)]));
    const monthly = docTable(['Item', 'Amount'], (revenue.monthly_expenses || []).map(item => [item.name, inr(item.amount)]));
    const projection = docTable(['Month', 'Revenue', 'Expenses', 'Profit', 'Profit Label'], (revenue.revenue_projection || []).map(item => [item.month, inr(item.revenue), inr(item.expenses), inr(item.profit), item.profit_label || '']));
    if (startupCost) children.push(new Paragraph({ text: 'Startup Cost', heading: HeadingLevel.HEADING_2 }), startupCost);
    if (monthly) children.push(new Paragraph({ text: 'Monthly Expenses', heading: HeadingLevel.HEADING_2 }), monthly);
    if (projection) children.push(new Paragraph({ text: 'Revenue Projection', heading: HeadingLevel.HEADING_2 }), projection);
    if (revenue.break_even_month) children.push(new Paragraph({ text: 'Break-even', heading: HeadingLevel.HEADING_2 }), new Paragraph(`Projected break-even in month ${revenue.break_even_month}.`));
    if (revenue.estimated_roi) children.push(new Paragraph({ text: 'Estimated ROI', heading: HeadingLevel.HEADING_2 }), new Paragraph(clean(revenue.estimated_roi)));
    if (revenue.profitability_note) children.push(new Paragraph({ text: 'Profitability Note', heading: HeadingLevel.HEADING_2 }), new Paragraph(clean(revenue.profitability_note)));
    if (revenue.funding_requirement) children.push(new Paragraph({ text: 'Funding', heading: HeadingLevel.HEADING_2 }), new Paragraph(inr(revenue.funding_requirement)));
    if (clean(revenue.notes)) children.push(new Paragraph(clean(revenue.notes)));
    return children;
  }
  if (title === 'Validation') {
    const validation = normalizeValidation(report);
    if (clean(validation.overall_score)) children.push(new Paragraph({ children: [new TextRun({ text: 'Overall Score: ', bold: true }), new TextRun(`${clean(validation.overall_score)}/100`)] }));
    [['Strengths', validation.strong_points || validation.strengths], ['Weaknesses', validation.weak_points || validation.weaknesses], ['Risks', validation.risks], ['Recommendations', validation.recommendations], ['Next Steps', validation.next_actions]].forEach(([heading, items]) => { const bullets = docBullets(list(items)); if (bullets.length) children.push(new Paragraph({ text: String(heading), heading: HeadingLevel.HEADING_2 }), ...bullets); });
    return children;
  }
  clean(value).split(/\r?\n/).filter(Boolean).forEach(line => children.push(new Paragraph({ children: [new TextRun({ text: line.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, ''), bold: /^\s*[-*+\d]/.test(line) })] })));
  return children;
};

function exportPdf(report: BackendReport) {
  const popup = window.open('', '_blank', 'width=900,height=700'); if (!popup) return;
  const sections = exportableSections(report);
  const sources = sourceList(report);
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(report.startup || 'Startup Report')}</title><style>@page{margin:22mm}body{font:11pt Arial;color:#20324d;line-height:1.55}h1{font-size:28pt;color:#123d70}h2{margin-top:22pt;color:#1565c0;border-bottom:1px solid #dbe5ef;padding-bottom:5pt}h3{color:#163b63;margin:14pt 0 6pt}.cover{height:85vh;display:flex;flex-direction:column;justify-content:center}.card,.source{margin:10pt 0;padding:10pt;border:1px solid #e4ebf2;border-radius:6pt}.muted{color:#6c7c90;font-size:9pt}a{color:#1565c0}table{width:100%;border-collapse:collapse;margin:8pt 0 14pt}th,td{border:1px solid #dbe5ef;padding:6pt;text-align:left;vertical-align:top}th{background:#edf4fb}</style></head><body><section class="cover"><h1>${escapeHtml(report.startup || 'Autonomous Startup Report')}</h1><p>Location-aware startup blueprint</p><p class="muted">${escapeHtml(locationText(report))}</p><p class="muted">Generated by the autonomous agent team</p></section><h1>Table of Contents</h1><ol>${sections.map(([title]) => `<li>${title}</li>`).join('')}${sources.length ? '<li>Sources</li>' : ''}<li>Appendix</li></ol>${sections.map(([title, value]) => `<section><h2>${title}</h2>${sectionHtml(title, value, report)}</section>`).join('')}${sources.length ? `<section><h2>Sources</h2>${sources.map(source => `<div class="source"><strong>${escapeHtml(clean(source.title))}</strong><br/><a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a>${clean(source.description) ? `<p>${escapeHtml(clean(source.description))}</p>` : ''}${clean(source.agent) ? `<span class="muted">${escapeHtml(clean(source.agent))}</span>` : ''}</div>`).join('')}</section>` : ''}<section><h2>Appendix</h2><p>Financial figures are planning estimates. Validate assumptions with local customers, suppliers, and professional advisers.</p></section></body></html>`);
  popup.document.close(); popup.focus(); window.setTimeout(() => popup.print(), 250);
}

async function exportDocx(report: BackendReport) {
  const sections = exportableSections(report);
  const sources = sourceList(report);
  const children: Array<Paragraph | Table> = [new Paragraph({ text: report.startup || 'Autonomous Startup Report', heading: HeadingLevel.TITLE }), new Paragraph({ text: `Location: ${locationText(report)}` }), new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_1 }), ...sections.map(([title]) => new Paragraph({ text: title, bullet: { level: 0 } }))];
  sections.forEach(([title, value]) => children.push(...docSectionChildren(title, value, report)));
  if (sources.length) {
    children.push(new Paragraph({ text: 'Sources', heading: HeadingLevel.HEADING_1 }));
    sources.forEach(source => children.push(new Paragraph({ children: [new TextRun({ text: clean(source.title), bold: true }), new TextRun({ text: ` - ${source.url}${clean(source.agent) ? ` (${clean(source.agent)})` : ''}` })] })));
  }
  const blob = await Packer.toBlob(new Document({ sections: [{ properties: {}, children }] })); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${(report.startup || 'startup-report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.docx`; link.click(); URL.revokeObjectURL(url);
}

export function LiveReports() {
  const { currentStartup, report, setReport } = useStartup(); const [tab, setTab] = useState('Overview');
  const [retrying, setRetrying] = useState<string | null>(null);
  const tabs = ['Overview', 'Business Plan', 'Competitors', 'Marketing', 'Revenue', 'Validation', 'Sources'];
  const nextTab = tabs[(tabs.indexOf(tab) + 1) % tabs.length];
  useEffect(() => {
    const anchor = document.querySelector<HTMLElement>('.report-content > h1, .revenue-dashboard, .sources-grid, .validation-report');
    if (!anchor) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'report-next-button';
    button.textContent = `Next: ${nextTab} →`;
    const goToNextTab = () => setTab(nextTab);
    button.addEventListener('click', goToNextTab);
    anchor.insertAdjacentElement('afterend', button);
    return () => {
      button.removeEventListener('click', goToNextTab);
      button.remove();
    };
  }, [nextTab, tab]);
  const revenue = useMemo(() => normalizeRevenue(report), [report?.revenue_estimate]);
  const sources = sourceList(report || {});
  const competitors = useMemo(() => normalizeCompetitors(report || {}), [report?.competitors]);
  const competitorOverview = useMemo(() => competitorSummary(report?.competitors), [report?.competitors]);
  const values: Record<string, unknown> = { Overview: report?.business_plan || report?.analysis, 'Business Plan': report?.business_plan, Competitors: report?.competitors, Marketing: report?.marketing_strategy, Validation: report?.validation };
  const retrySection = async (section: string) => {
    const agent = sectionAgents[section];
    if (!currentStartup?.job_id || !agent) return;
    setRetrying(section);
    try { const next = await startupService.retry(currentStartup.job_id, agent); setReport(next.report); }
    finally { setRetrying(null); }
  };
  const SectionSkeleton = ({ title }: { title: string }) => <Card className="skeleton-card report-state"><LoaderCircle className="spin" size={18}/><h2>{title} is being prepared</h2><p className="skeleton-line"/><p className="skeleton-line short"/></Card>;
  const SectionIssue = ({ section }: { section: string }) => <Card className="report-state"><h2>We could not generate a usable {section.toLowerCase()} section.</h2><p>The agent response was empty, incomplete, or unavailable. Retry the section to regenerate clean report data.</p>{currentStartup?.job_id ? <Button variant="secondary" onClick={() => retrySection(section)} disabled={retrying === section}><RotateCcw size={14}/> {retrying === section ? 'Retrying' : 'Retry'}</Button> : null}</Card>;
  const renderValidatedRichText = (section: string, value: unknown) => {
    const state = sectionState(report, section, value);
    if (state === 'loading') return <SectionSkeleton title={section}/>;
    if (state === 'failed') return <SectionIssue section={section}/>;
    return <RichText content={value}/>;
  };
  const renderRevenue = () => {
    const state = sectionState(report, 'Revenue', report?.revenue_estimate);
    if (state === 'loading') return <SectionSkeleton title="Revenue"/>;
    if (state === 'failed' || !revenue) return <SectionIssue section="Revenue"/>;

    const monthlyTotal = (revenue.monthly_expenses || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    const lastProfit = (revenue.revenue_projection || []).slice(-1)[0]?.profit;

    return <div className="revenue-dashboard">
      <div className="revenue-kpis">
        {revenue.startup_cost?.total ? <Card><span>Startup Cost</span><b>{inr(revenue.startup_cost.total)}</b></Card> : null}
        {monthlyTotal ? <Card><span>Monthly Expenses</span><b>{inr(monthlyTotal)}</b></Card> : null}
        {revenue.funding_requirement ? <Card><span>Funding Required</span><b>{inr(revenue.funding_requirement)}</b></Card> : null}
        {revenue.estimated_roi ? <Card><span>Estimated ROI</span><b>{clean(revenue.estimated_roi)}</b></Card> : null}
      </div>

      <div className="revenue-columns">
        {(revenue.startup_cost?.items || []).length ? <Card><h2>Startup Cost</h2>{(revenue.startup_cost?.items || []).map(item => <div className="money-row" key={item.name}><span>{item.name}</span><b>{inr(item.amount)}</b></div>)}</Card> : null}
        {(revenue.monthly_expenses || []).length ? <Card><h2>Monthly Expenses</h2>{(revenue.monthly_expenses || []).map(item => <div className="money-row" key={item.name}><span>{item.name}</span><b>{inr(item.amount)}</b></div>)}</Card> : null}
      </div>

      {(revenue.revenue_projection || []).length ? <Card><h2>Revenue Forecast & Profit Projection</h2><div className="projection-chart">{(revenue.revenue_projection || []).map(item => <div className="projection-row" key={item.month}><span>{item.month}</span><i style={{ width: `${Math.min(100, Math.max(3, (item.revenue / Math.max(...(revenue.revenue_projection || []).map(point => point.revenue), 1)) * 100))}%` }}/><b>{inr(item.revenue)}</b><em>{inr(item.profit)} profit{item.profit_label ? ` · ${item.profit_label}` : ''}</em></div>)}</div></Card> : null}

      <div className="revenue-columns">
        {revenue.break_even_month ? <Card><h2>Break-even</h2><p>Projected break-even in month {revenue.break_even_month}.</p></Card> : null}
        {revenue.profitability_note ? <Card><h2>Profitability Note</h2><p>{clean(revenue.profitability_note)}</p></Card> : null}
      </div>
    </div>;
  };  const renderSources = () => sources.length ? <div className="sources-grid">{Object.entries(sources.reduce<Record<string, Source[]>>((groups, source) => { const key = clean(source.group) || 'Research Sources'; (groups[key] ||= []).push(source); return groups; }, {})).map(([group, items]) => <Card key={group}><div className="card-label">{group.toUpperCase()}</div>{items.map(source => <a className="source-item" href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${source.title}`}><div><b>{clean(source.title)}</b>{clean(source.description) ? <p>{clean(source.description)}</p> : null}{clean(source.agent) ? <small>{clean(source.agent)}</small> : null}</div><ExternalLink size={15}/></a>)}</Card>)}</div> : <SectionIssue section="Sources"/>;  const renderValidation = () => { const validation = normalizeValidation(report); return <div className="validation-report"><Card><div className="card-label">VALIDATION SCORE</div><h1>{clean(validation.overall_score) || '—'}<small>/100</small></h1><RichText content={validation.panel_verdict} /></Card><div className="revenue-columns"><Card><h2>Strengths</h2><RichText content={list(validation.strong_points || validation.strengths).map(item => `- ${item}`).join('\n')} /></Card><Card><h2>Weaknesses</h2><RichText content={list(validation.weak_points || validation.weaknesses).map(item => `- ${item}`).join('\n')} /></Card></div><div className="revenue-columns"><Card><h2>Risks</h2><RichText content={list(validation.risks).map(item => `- ${item}`).join('\n')} /></Card><Card><h2>Recommendations</h2><RichText content={list(validation.recommendations).map(item => `- ${item}`).join('\n')} /></Card></div><Card><h2>Next Steps</h2><RichText content={list(validation.next_actions).map((item, index) => `${index + 1}. ${item}`).join('\n')} /></Card></div>; };
  const renderCompetitors = () => { const state = sectionState(report, 'Competitors', report?.competitors); if (state === 'loading') return <SectionSkeleton title="Competitors"/>; if (state === 'failed' || !competitors.length) return <SectionIssue section="Competitors"/>; return <div className="report-layout"><article className="report-content"><Badge tone="green">Agent complete</Badge><h1>Competitor Analysis</h1>{clean(competitorOverview) ? <RichText content={competitorOverview} /> : null}<div className="competitor-grid">{competitors.map((competitor, index) => <Card key={`${String(competitor.name || 'competitor')}-${index}`} className="competitor-card">{clean(competitor.geography_tier) ? <div className="card-label">{clean(competitor.geography_tier)}</div> : null}<h3>{clean(competitor.name) || `Competitor ${index + 1}`}</h3>{clean(competitor.location) ? <p className="competitor-location">{clean(competitor.location)}{clean(competitor.distance_km) ? ` · ${clean(competitor.distance_km)} km away` : ''}</p> : null}{clean(competitor.description) ? <p>{clean(competitor.description)}</p> : null}{list(competitor.strengths).length ? <div className="competitor-section"><h4>Strengths</h4><ul>{list(competitor.strengths).slice(0, 4).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul></div> : null}{list(competitor.weaknesses).length ? <div className="competitor-section"><h4>Weaknesses</h4><ul>{list(competitor.weaknesses).slice(0, 4).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul></div> : null}{clean(competitor.pricing) ? <div className="competitor-section"><h4>Pricing</h4><p>{clean(competitor.pricing)}</p></div> : null}{clean(competitor.target_customers) ? <div className="competitor-section"><h4>Target Customers</h4><p>{clean(competitor.target_customers)}</p></div> : null}{clean(competitor.market_position) ? <div className="competitor-section"><h4>Market Position</h4><p>{clean(competitor.market_position)}</p></div> : null}{clean(competitor.why_relevant || competitor.selected_for) ? <div className="competitor-section"><h4>Why It Is Relevant</h4><p>{clean(competitor.why_relevant || competitor.selected_for)}</p></div> : null}{clean(competitor.opportunity_gap) ? <div className="competitor-section"><h4>Opportunity Gap</h4><p>{clean(competitor.opportunity_gap)}</p></div> : null}</Card>)}</div></article><aside className="report-side"><Card><p className="card-label">LOCATION</p><h3>{locationText(report || {})}</h3><p>Competitors are prioritized from local to regional to national relevance. Any distance shown is the competitor's actual operating location relative to the launch city.</p></Card>{sources.length ? <Card><p className="card-label">LIVE SOURCES</p><h2>{sources.length}</h2><p>References collected across the agent team.</p></Card> : null}</aside></div>; };
  const renderStandardSection = () => <div className="report-layout"><article className="report-content"><Badge tone={sectionState(report, tab, values[tab]) === 'valid' ? 'green' : 'gray'}>{sectionState(report, tab, values[tab]) === 'valid' ? 'Agent complete' : 'Needs retry'}</Badge><h1>{tab === 'Overview' ? report?.startup || 'Startup report' : tab}</h1>{renderValidatedRichText(tab, values[tab])}{sources.length ? <div className="section-references"><div className="card-label">REFERENCES</div>{sources.slice(0, 3).map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{clean(source.title)}</a>)}</div> : null}</article><aside className="report-side"><Card><p className="card-label">LOCATION</p><h3>{locationText(report || {})}</h3><p>Pricing, competition, costs, registrations, taxes, and go-to-market assumptions use this location.</p></Card>{sources.length ? <Card><p className="card-label">LIVE SOURCES</p><h2>{sources.length}</h2><p>References collected across the agent team.</p></Card> : null}</aside></div>;  const exportActions = report ? <div className="report-export-actions"><Button variant="secondary" onClick={() => exportPdf(report)}><Printer size={15}/> PDF</Button><Button variant="secondary" onClick={() => exportDocx(report)}><FileText size={15}/> DOCX</Button><Button variant="ghost" onClick={() => exportPdf(report)}><Download size={15}/></Button></div> : undefined;
  return <><PageHeader eyebrow="STARTUP REPORT" title="Your living startup blueprint" description={`Location-aware report for ${locationText(report || {})}. Sections remain readable as agents finish.`} action={<div className="report-header-actions"><Badge tone="green"><TrendingUp size={13}/> Live report</Badge>{exportActions}</div>}/><div className="report-tabs">{tabs.map(item => <button className={tab === item ? 'selected' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>{tab === 'Revenue' ? renderRevenue() : tab === 'Sources' ? renderSources() : tab === 'Validation' ? renderValidation() : tab === 'Competitors' ? renderCompetitors() : renderStandardSection()}</>;
}

