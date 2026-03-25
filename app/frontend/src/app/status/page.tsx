'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatBytes, formatRelative } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { Progress } from '@/components/shared/Progress';
import { Badge } from '@/components/shared/Badge';
import { StatusDot } from '@/components/shared/StatusDot';
import { Activity, RefreshCw, HardDrive, Cpu, MemoryStick, Network, Server } from 'lucide-react';
import type { ImportJob } from '@sina/shared';

export default function StatusPage() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, j] = await Promise.all([api.system.status(), api.system.jobs()]);
      setStatus(s);
      setJobs(j);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const storage = status?.storage as { used_bytes: number; total_bytes: number; free_bytes: number; breakdown: Record<string, number> } | undefined;
  const ai = status?.ai as { ollama_available: boolean; models: { id: string }[] } | undefined;
  const network = status?.network as { lan_exposed: boolean; bind_address: string } | undefined;
  const runtimePlatform = status?.runtime_platform as {
    id: string;
    label: string;
    is_wsl2: boolean;
    support_tier: string;
    supported_now: boolean;
  } | undefined;
  const storagePct = storage ? Math.round(storage.used_bytes / Math.max(storage.total_bytes, 1) * 100) : 0;
  const memPct = status ? Math.round((1 - (status.mem_free as number) / (status.mem_total as number)) * 100) : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="module-header">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <Activity className="w-4 h-4 text-green-400" />
        </div>
        <div><h1>System Status</h1><p className="text-xs text-text-muted">Health, resources, and background jobs</p></div>
        <Button className="ml-auto" size="sm" variant="ghost" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {status && (
        <>
          {/* Metrics grid */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard icon={<HardDrive className="w-4 h-4" />} label="Storage" value={`${formatBytes(storage?.used_bytes || 0)} / ${formatBytes(storage?.total_bytes || 0)}`}>
              <Progress value={storagePct} variant={storagePct > 85 ? 'red' : storagePct > 70 ? 'amber' : 'green'} showLabel />
            </MetricCard>
            <MetricCard icon={<MemoryStick className="w-4 h-4" />} label="Memory" value={`${formatBytes((status.mem_total as number) - (status.mem_free as number))} / ${formatBytes(status.mem_total as number)}`}>
              <Progress value={memPct} variant={memPct > 85 ? 'red' : memPct > 70 ? 'amber' : 'green'} showLabel />
            </MetricCard>
            <MetricCard icon={<Cpu className="w-4 h-4" />} label="System" value={`${status.cpu_count} CPUs`}>
              <div className="text-xs text-text-muted">{status.platform as string} · {status.arch as string}</div>
              {runtimePlatform && <div className="text-xs text-text-muted">{runtimePlatform.label}</div>}
              <div className="text-xs text-text-muted">Uptime {Math.round((status.uptime as number) / 3600)}h</div>
            </MetricCard>
            <MetricCard icon={<Network className="w-4 h-4" />} label="Network" value={network?.lan_exposed ? 'LAN Exposed' : 'Local Only'}>
              <div className="flex items-center gap-1.5">
                <StatusDot status={network?.lan_exposed ? 'warning' : 'online'} />
                <span className="text-xs text-text-muted font-mono">{network?.bind_address}</span>
              </div>
            </MetricCard>
          </div>

          {/* AI status */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-text-muted" />
              <h3 className="text-sm font-semibold">AI Runtime (Ollama)</h3>
              <StatusDot status={ai?.ollama_available ? 'online' : 'offline'} className="ml-auto" />
            </div>
            {ai?.models && ai.models.length > 0 ? (
              <div className="space-y-1">
                {ai.models.map((m: { id: string }) => (
                  <div key={m.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/50">
                    <span className="font-mono text-text-primary">{m.id}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">{ai?.ollama_available ? 'No models installed' : 'Ollama not running'}</p>
            )}
          </div>

          {/* Storage breakdown */}
          {storage?.breakdown && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Storage Breakdown</h3>
              <div className="space-y-2">
                {Object.entries(storage.breakdown).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-text-muted w-24 capitalize">{key}</span>
                    <Progress value={storage.total_bytes ? (val / storage.total_bytes * 100) : 0} variant="blue" className="flex-1" />
                    <span className="text-xs font-mono text-text-secondary w-16 text-right">{formatBytes(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Import jobs */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3">Recent Import Jobs</h3>
        {jobs.length === 0 ? (
          <p className="text-xs text-text-muted">No import jobs</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>File</th><th>Type</th><th>Status</th><th>Detected</th></tr></thead>
            <tbody>
              {jobs.slice(0, 20).map(job => (
                <tr key={job.id}>
                  <td className="font-medium text-text-primary max-w-xs truncate">{job.file_name}</td>
                  <td className="font-mono uppercase text-2xs">{job.file_type}</td>
                  <td>
                    <Badge variant={job.status === 'done' ? 'green' : job.status === 'failed' ? 'red' : job.status === 'unsupported' ? 'default' : 'amber'}>
                      {job.status}
                    </Badge>
                  </td>
                  <td>{formatRelative(job.detected_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, children }: { icon: React.ReactNode; label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2 text-text-muted">{icon}<span className="text-2xs uppercase tracking-wider">{label}</span></div>
      <div className="text-sm font-semibold text-text-primary mb-2">{value}</div>
      {children}
    </div>
  );
}
