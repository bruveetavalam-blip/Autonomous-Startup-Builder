import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Clock3, LoaderCircle, RotateCcw } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from './ui';
import { startupService } from '../services/startupService';
import { useStartup } from '../context/StartupContext';
import type { AgentRun } from '../types';

export function LiveExecution({ setPage }: { setPage: (p: any) => void }) {
  const { currentStartup, report, setReport } = useStartup();
  const [job, setJob] = useState(currentStartup?.job_id ? { agents: currentStartup.agents || {}, status: currentStartup.status || 'running', errors: {}, report } : null);
  const [startedAt] = useState(Date.now());
  useEffect(() => {
    const jobId = currentStartup?.job_id;
    if (!jobId) return;
    let active = true;
    const poll = async () => {
      try { const next = await startupService.status(jobId); if (active) { setJob(next); setReport(next.report); } }
      catch { /* the existing API interceptor surfaces the error on the next user action */ }
    };
    poll();
    const timer = window.setInterval(poll, 1200);
    return () => { active = false; window.clearInterval(timer); };
  }, [currentStartup?.job_id, setReport]);
  const agents = (job?.agents || report?.agent_status || {}) as Record<string, AgentRun>;
  const entries = Object.entries(agents);
  const completed = entries.filter(([, value]) => value.status === 'completed').length;
  const failed = entries.filter(([, value]) => value.status === 'failed').length;
  const running = entries.filter(([, value]) => value.status === 'running').length;
  const progress = entries.length ? Math.round((completed / entries.length) * 100) : 0;
  const eta = completed ? Math.max(1, Math.round(((Date.now() - startedAt) / completed) * (entries.length - completed) / 1000)) : 'calculating';
  const retry = async (name: string) => { if (!currentStartup?.job_id) return; const next = await startupService.retry(currentStartup.job_id, name); setJob(next); setReport(next.report); };
  const icon = (state: string) => state === 'completed' ? <CheckCircle2 size={17}/> : state === 'failed' ? <AlertTriangle size={17}/> : <LoaderCircle className="spin" size={17}/>;
  return <>
    <PageHeader eyebrow="LIVE EXECUTION" title="Your startup team is working." description="Independent agents run in parallel. Completed sections are saved and readable immediately." action={<Badge tone={failed ? 'orange' : progress === 100 ? 'green' : 'blue'}>{progress}% complete</Badge>}/>
    <Card className="live-progress"><div className="live-progress-head"><div><span className="eyebrow">OVERALL PROGRESS</span><h2>{completed} of {entries.length || 7} agents complete</h2></div><div className="eta"><Clock3 size={16}/><span>ETA {typeof eta === 'number' ? `${eta}s` : eta}</span></div></div><div className="progress large"><i style={{width:`${progress}%`}}/></div><div className="progress-stats"><span><b>{completed}</b> complete</span><span><b>{running}</b> running</span><span><b>{failed}</b> failed</span></div></Card>
    <div className="agent-grid live-agent-grid">{entries.map(([name, agent]) => <Card className={`agent-card ${agent.status}`} key={name}><div className="agent-top"><span className="agent-avatar"><Bot size={20}/></span><span className={`agent-status ${agent.status}`}>{icon(agent.status)} {agent.status}</span></div><h3>{agent.label}</h3>{agent.status === 'completed' ? <p className="agent-complete">Section saved — open Reports to read it.</p> : agent.status === 'failed' ? <><p className="agent-error">{agent.error || 'Agent failed without a message.'}</p><Button variant="secondary" onClick={() => retry(name)}><RotateCcw size={14}/> Retry agent</Button></> : <><p className="skeleton-line"/><p className="skeleton-line short"/><p className="agent-activity"><LoaderCircle className="spin" size={14}/> Researching independently…</p></>}</Card>)}</div>
    <div className="live-actions"><Button variant="secondary" onClick={() => setPage('reports')}>Read available sections</Button>{progress === 100 && <Button onClick={() => setPage('reports')}>Open complete report</Button>}</div>
  </>;
}
