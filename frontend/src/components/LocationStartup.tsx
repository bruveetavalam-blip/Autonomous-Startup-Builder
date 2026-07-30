import { useState, type ChangeEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, PageHeader } from './ui';
import { startupService } from '../services/startupService';
import { useStartup } from '../context/StartupContext';
import type { Page } from '../types';

export function LocationStartup({ setPage }: { setPage: (page: Page) => void }) {
  const { setCurrentStartup, setReport, setLoading, setError, loading } = useStartup();
  const [form, setForm] = useState({ idea: '', country: 'India', state: '', city: '', businessLocation: '' });
  const update = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(value => ({ ...value, [key]: event.target.value }));
  const submit = async () => {
    const idea = form.idea.trim();
    const businessLocation = form.businessLocation.trim();
    if (idea.length < 2) { toast.error('Please enter a startup idea.'); return; }
    if (!businessLocation) { toast.error('Please enter a business location.'); return; }
    setLoading(true); setError(null);
    try {
      const startup = await startupService.generate({ idea, country: form.country.trim() || 'India', state: form.state.trim(), city: businessLocation });
      setCurrentStartup(startup); setReport(startup.report); toast.success('Startup generation started'); setPage('execution');
    } catch (error) { const message = error instanceof Error ? error.message : 'Request failed'; setError(message); toast.error(message); }
    finally { setLoading(false); }
  };
  return <div className="form-wrap"><PageHeader eyebrow="NEW PROJECT" title="Start with an ambitious idea." description="Give your AI team some context. They’ll turn it into an actionable startup blueprint."/><Card className="idea-form"><label>Startup idea<textarea value={form.idea} onChange={update('idea')} placeholder="e.g. A platform that helps remote teams build healthier daily routines..."/></label><div className="form-grid"><label>Country<input value={form.country} onChange={update('country')} placeholder="India"/></label><label>State<input value={form.state} onChange={update('state')} placeholder="Karnataka"/></label><label>Business Location<span>Required</span><input value={form.businessLocation} onChange={update('businessLocation')} placeholder="Bengaluru, Karnataka, India"/></label></div><p className="location-note">This is the city or region where the startup will launch. It shapes local competitors, pricing, costs, registrations, taxes, and marketing assumptions.</p><div className="form-footer"><p>Your request will be processed by the connected backend workflow.</p><Button disabled={loading} onClick={submit}>{loading ? 'Starting agents…' : 'Generate startup blueprint'} <ArrowRight size={17}/></Button></div></Card></div>;
}
