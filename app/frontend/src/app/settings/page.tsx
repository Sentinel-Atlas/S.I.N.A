'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/shared/Button';
import { StatusDot } from '@/components/shared/StatusDot';
import { Settings, Save, RefreshCw, Wifi, WifiOff, FolderOpen, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppSettings } from '@sina/shared';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Partial<AppSettings>>({});

  useEffect(() => {
    api.system.settings().then(s => {
      setSettings(s);
      setForm(s);
    });
  }, []);

  const update = (key: keyof AppSettings, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.system.updateSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="p-6 text-text-muted text-sm">Loading settings...</div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl">
      <div className="module-header">
        <div className="w-8 h-8 rounded-lg bg-bg-overlay border border-border flex items-center justify-center">
          <Settings className="w-4 h-4 text-text-muted" />
        </div>
        <div><h1>Settings</h1><p className="text-xs text-text-muted">Configure your command center</p></div>
        <Button className="ml-auto" variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />} onClick={save} loading={saving}>
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <Section title="AI Runtime">
        <Field label="Ollama Host">
          <input value={form.ollama_host || ''} onChange={e => update('ollama_host', e.target.value)} className="input-base" placeholder="http://127.0.0.1:11434" />
        </Field>
        <Field label="Default Model">
          <input value={form.default_model || ''} onChange={e => update('default_model', e.target.value)} className="input-base" placeholder="llama3.2" />
        </Field>
        <Field label="Embedding Model">
          <input value={form.embed_model || ''} onChange={e => update('embed_model', e.target.value)} className="input-base" placeholder="nomic-embed-text" />
        </Field>
        <Field label="Default Persona">
          <select value={form.default_persona || 'researcher'} onChange={e => update('default_persona', e.target.value)} className="input-base">
            {['researcher', 'survival', 'technical', 'summarizer', 'navigator'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Network">
        <Field label="LAN Exposure" description="When enabled, the server binds to all interfaces and is accessible on your local network.">
          <div className="flex items-center gap-3">
            <button
              onClick={() => update('lan_exposed', !form.lan_exposed)}
              className={cn('w-10 h-5 rounded-full transition-colors relative flex-shrink-0',
                form.lan_exposed ? 'bg-status-warning' : 'bg-bg-overlay border border-border')}>
              <div className={cn('w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                form.lan_exposed ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
            <div className="flex items-center gap-2">
              {form.lan_exposed
                ? <><Wifi className="w-3.5 h-3.5 text-status-warning" /><span className="text-xs text-status-warning">LAN Exposed</span></>
                : <><WifiOff className="w-3.5 h-3.5 text-text-muted" /><span className="text-xs text-text-muted">Local Only</span></>
              }
            </div>
          </div>
        </Field>
      </Section>

      <Section title="Downloads">
        <Field label="Max Concurrent Downloads">
          <input type="number" min={1} max={10} value={form.max_concurrent_downloads || 2}
            onChange={e => update('max_concurrent_downloads', parseInt(e.target.value))} className="input-base w-24" />
        </Field>
      </Section>

      <Section title="Indexing">
        <Field label="Chunk Size (words)" description="Size of text chunks for semantic indexing.">
          <input type="number" min={128} max={2048} step={64} value={form.chunk_size || 512}
            onChange={e => update('chunk_size', parseInt(e.target.value))} className="input-base w-24" />
        </Field>
        <Field label="Chunk Overlap (words)">
          <input type="number" min={0} max={512} step={16} value={form.chunk_overlap || 64}
            onChange={e => update('chunk_overlap', parseInt(e.target.value))} className="input-base w-24" />
        </Field>
        <Field label="Auto-Reindex on Import">
          <Toggle checked={form.auto_reindex !== false} onChange={v => update('auto_reindex', v)} />
        </Field>
        <Field label="Storage Warning Threshold">
          <div className="flex items-center gap-2">
            <input type="number" min={50} max={99} value={form.storage_warn_threshold_pct || 85}
              onChange={e => update('storage_warn_threshold_pct', parseInt(e.target.value))} className="input-base w-20" />
            <span className="text-sm text-text-muted">%</span>
          </div>
        </Field>
      </Section>

      <Section title="Maps">
        <Field label="Tile Server URL" description="Local tile server for offline maps (via docker-compose --profile maps).">
          <input value={form.tile_server_url || ''} onChange={e => update('tile_server_url', e.target.value)} className="input-base" placeholder="http://127.0.0.1:8080" />
        </Field>
      </Section>

      <Section title="Data Directory" description="Read-only. Change via SINA_DATA_DIR environment variable.">
        <div className="flex items-center gap-2 bg-bg-overlay border border-border rounded-md px-3 py-2 text-sm font-mono text-text-muted">
          <FolderOpen className="w-4 h-4 flex-shrink-0" />
          {settings.data_dir}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-48 flex-shrink-0 pt-0.5">
        <div className="text-xs font-medium text-text-secondary">{label}</div>
        {description && <div className="text-2xs text-text-muted mt-0.5">{description}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={cn('w-10 h-5 rounded-full transition-colors relative', checked ? 'bg-accent' : 'bg-bg-overlay border border-border')}>
      <div className={cn('w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}
