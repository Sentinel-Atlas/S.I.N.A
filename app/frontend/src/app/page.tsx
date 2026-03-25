'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatBytes, formatRelative } from '@/lib/utils';
import { StatusDot } from '@/components/shared/StatusDot';
import { Progress } from '@/components/shared/Progress';
import { Button } from '@/components/shared/Button';
import {
  Brain, Library, Map, Shield, Wrench, Download,
  FolderInput, Search, AlertTriangle, Activity,
  MessageSquare, RefreshCw, Wifi, WifiOff, HardDrive,
  ChevronRight,
} from 'lucide-react';
import type { SystemHealth } from '@sina/shared';

interface Stats {
  content: { total: number; indexed: number; failed: number; pending: number };
  downloads: { active: number; queued: number; completed: number; failed: number };
  vault: { total: number; pinned: number };
  conversations: { total: number };
  maps: { regions: number; markers: number };
}

const MODULE_CARDS = [
  { href: '/ai',        label: 'AI Chat',        icon: Brain,         desc: 'Local AI with RAG',          key: 'ai' },
  { href: '/library',   label: 'Library',        icon: Library,       desc: 'Knowledge & documents',       key: 'library' },
  { href: '/maps',      label: 'Maps',           icon: Map,           desc: 'Offline geographic data',     key: 'maps' },
  { href: '/vault',     label: 'Vault',          icon: Shield,        desc: 'Notes, guides & contacts',    key: 'vault' },
  { href: '/tools',     label: 'Tools',          icon: Wrench,        desc: 'Utilities & launchers',       key: 'tools' },
  { href: '/downloads', label: 'Downloads',      icon: Download,      desc: 'Install & manage assets',     key: 'downloads' },
  { href: '/imports',   label: 'Import',         icon: FolderInput,   desc: 'Ingest files & content',      key: 'imports' },
  { href: '/search',    label: 'Search',         icon: Search,        desc: 'Search all local content',    key: 'search' },
  { href: '/emergency', label: 'Emergency',      icon: AlertTriangle, desc: 'Critical procedures & packs', key: 'emergency' },
  { href: '/status',    label: 'System',         icon: Activity,      desc: 'Health & status overview',    key: 'system' },
];

const QUICK_ACTIONS = [
  { href: '/ai',        label: 'Start AI Chat',      icon: MessageSquare },
  { href: '/imports',   label: 'Import Documents',   icon: FolderInput },
  { href: '/downloads', label: 'Install Content',    icon: Download },
  { href: '/maps',      label: 'Open Maps',          icon: Map },
  { href: '/emergency', label: 'Emergency Packs',    icon: AlertTriangle },
];

function moduleStatus(health: SystemHealth, key: string): 'online' | 'warning' | 'offline' | 'installing' {
  const m = health.modules[key as keyof typeof health.modules] as string | undefined;
  if (!m || m === 'unknown') return 'offline';
  if (m === 'ready') return 'online';
  if (m === 'installing') return 'installing';
  if (m === 'degraded') return 'warning';
  return 'offline';
}

export default function DashboardPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      api.dashboard.health(),
      api.dashboard.stats(),
    ]).then(([h, s]) => {
      setHealth(h);
      setStats(s as unknown as Stats);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const storagePct = health?.storage
    ? Math.round((health.storage.used_bytes / Math.max(health.storage.total_bytes, 1)) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Command Center</h1>
          <p className="text-sm text-text-muted mt-0.5">Personal offline operations dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          {health && (
            <StatusDot
              status={health.status === 'healthy' ? 'online' : health.status === 'degraded' ? 'warning' : 'error'}
              label={health.status}
            />
          )}
          <Button size="sm" variant="ghost" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {/* System overview strip */}
      {health && (
        <div className="grid grid-cols-4 gap-3">
          {/* AI */}
          <div className="card p-4">
            <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">AI Runtime</div>
            <div className="flex items-center gap-2">
              <StatusDot status={health.ai.runtime_available ? 'online' : 'offline'} />
              <span className="text-sm font-medium">{health.ai.runtime_available ? 'Ollama Ready' : 'Unavailable'}</span>
            </div>
            {health.ai.active_model && (
              <div className="text-2xs text-text-muted mt-1 font-mono">{health.ai.active_model}</div>
            )}
          </div>

          {/* Storage */}
          <div className="card p-4">
            <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Storage</div>
            <div className="text-sm font-medium mb-1.5">
              {formatBytes(health.storage.used_bytes)} used
            </div>
            <Progress
              value={storagePct}
              variant={storagePct > 85 ? 'red' : storagePct > 70 ? 'amber' : 'green'}
              showLabel
            />
          </div>

          {/* Content */}
          <div className="card p-4">
            <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Content Index</div>
            <div className="text-sm font-medium">{stats?.content?.indexed ?? '—'} indexed</div>
            {(stats?.content?.pending ?? 0) > 0 && (
              <div className="text-2xs text-status-info mt-1">{stats!.content.pending} pending</div>
            )}
          </div>

          {/* Network */}
          <div className="card p-4">
            <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Network</div>
            <div className="flex items-center gap-2">
              {health.network.lan_exposed
                ? <Wifi className="w-4 h-4 text-status-warning" />
                : <WifiOff className="w-4 h-4 text-text-muted" />}
              <span className="text-sm font-medium">
                {health.network.lan_exposed ? 'LAN Exposed' : 'Local Only'}
              </span>
            </div>
            <div className="text-2xs text-text-muted mt-1 font-mono">{health.network.bind_address}</div>
          </div>
        </div>
      )}

      {/* Module cards grid */}
      <div>
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-widest mb-3">Modules</h2>
        <div className="grid grid-cols-5 gap-3">
          {MODULE_CARDS.map(({ href, label, icon: Icon, desc, key }) => {
            const status = health ? moduleStatus(health, key) : 'offline';
            return (
              <Link
                key={href}
                href={href}
                className="card p-4 hover:border-border-bright hover:bg-bg-raised transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-bg-overlay border border-border flex items-center justify-center
                                  group-hover:border-accent/30 group-hover:bg-accent/5 transition-colors">
                    <Icon className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                  </div>
                  <StatusDot status={status} />
                </div>
                <div className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                  {label}
                </div>
                <div className="text-2xs text-text-muted mt-0.5 truncate">{desc}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4">

        {/* Quick Actions */}
        <div className="card p-4">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="space-y-1">
            {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-bg-overlay text-text-secondary hover:text-text-primary transition-colors text-sm group"
              >
                <Icon className="w-4 h-4 flex-shrink-0 group-hover:text-accent transition-colors" />
                {label}
                <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>

        {/* Download activity */}
        <div className="card p-4">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Downloads</h3>
          {stats?.downloads ? (
            <div className="space-y-2">
              {[
                { label: 'Active',    val: stats.downloads.active,    color: 'text-status-info' },
                { label: 'Queued',    val: stats.downloads.queued,    color: 'text-text-muted' },
                { label: 'Completed', val: stats.downloads.completed, color: 'text-status-online' },
                { label: 'Failed',    val: stats.downloads.failed,    color: 'text-status-error' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{label}</span>
                  <span className={`font-mono font-medium ${color}`}>{val}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-text-muted text-sm">—</div>
          )}
        </div>

        {/* Storage breakdown */}
        <div className="card p-4">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Storage Breakdown</h3>
          {health?.storage?.breakdown ? (
            <div className="space-y-1.5">
              {Object.entries(health.storage.breakdown)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted capitalize">{key}</span>
                    <span className="font-mono text-text-secondary">{formatBytes(val)}</span>
                  </div>
                ))}
              {Object.values(health.storage.breakdown).every(v => v === 0) && (
                <div className="text-text-muted text-xs">No data stored yet</div>
              )}
            </div>
          ) : (
            <div className="text-text-muted text-sm">—</div>
          )}
        </div>
      </div>
    </div>
  );
}
