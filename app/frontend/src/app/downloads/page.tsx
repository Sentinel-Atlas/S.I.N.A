'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatBytes, formatSpeed, formatEta, formatRelative } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { Progress } from '@/components/shared/Progress';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Download, Pause, Play, X, RefreshCw, Package, Brain,
  Map, BookOpen, Wrench, AlertTriangle, Plus, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DownloadJob, CatalogItem } from '@sina/shared';

const STATUS_COLORS: Record<string, string> = {
  queued:      'default',
  downloading: 'blue',
  paused:      'default',
  verifying:   'amber',
  extracting:  'amber',
  completed:   'green',
  failed:      'red',
  cancelled:   'default',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'ai-models':      <Brain className="w-4 h-4" />,
  'maps':           <Map className="w-4 h-4" />,
  'knowledge':      <BookOpen className="w-4 h-4" />,
  'tools':          <Wrench className="w-4 h-4" />,
  'emergency-packs': <AlertTriangle className="w-4 h-4" />,
};

type Tab = 'catalog' | 'queue';

export default function DownloadsPage() {
  const [tab, setTab] = useState<Tab>('catalog');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    Promise.all([api.downloads.catalog(), api.downloads.list()]).then(([c, j]) => {
      setCatalog(c);
      setJobs(j);
    }).finally(() => setLoading(false));

    // Live updates via SSE
    const es = new EventSource('/api/downloads/events/stream');
    es.addEventListener('update', (e) => {
      const job = JSON.parse(e.data) as DownloadJob;
      setJobs(prev => prev.map(j => j.id === job.id ? job : j));
    });
    es.addEventListener('created', (e) => {
      const job = JSON.parse(e.data) as DownloadJob;
      setJobs(prev => [job, ...prev]);
    });
    eventSourceRef.current = es;
    return () => es.close();
  }, []);

  const installItem = async (item: CatalogItem) => {
    await api.downloads.create({
      name: item.name,
      url: item.url,
      checksum: item.checksum,
      catalog_item_id: item.id,
    });
    setTab('queue');
    const updated = await api.downloads.list();
    setJobs(updated);
  };

  const categories = ['all', ...Array.from(new Set(catalog.map(i => i.category)))];
  const filteredCatalog = categoryFilter === 'all' ? catalog : catalog.filter(i => i.category === categoryFilter);
  const activeJobs = jobs.filter(j => ['downloading', 'queued', 'verifying', 'extracting'].includes(j.status));

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="module-header">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Download className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h1>Downloads</h1>
          <p className="text-xs text-text-muted">Install offline tools, models, maps, and content packs</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeJobs.length > 0 && (
            <Badge variant="blue">{activeJobs.length} active</Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-surface border border-border rounded-lg p-1 w-fit">
        {([['catalog', 'Install Catalog'], ['queue', 'Download Queue']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t ? 'bg-bg-raised text-text-primary' : 'text-text-muted hover:text-text-primary'
            )}
          >
            {label}
            {t === 'queue' && jobs.length > 0 && (
              <span className="ml-1.5 text-2xs text-text-muted">({jobs.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Catalog */}
      {tab === 'catalog' && (
        <div className="space-y-4">
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize',
                  categoryFilter === cat
                    ? 'bg-accent text-text-inverse'
                    : 'bg-bg-surface border border-border text-text-muted hover:border-border-bright hover:text-text-primary'
                )}
              >
                {cat === 'all' ? 'All' : cat.replace('-', ' ')}
              </button>
            ))}
          </div>

          {/* Grid */}
          {filteredCatalog.length === 0 ? (
            <EmptyState
              icon={<Package className="w-5 h-5" />}
              title="No catalog items"
              description="Catalog registry is empty or could not be loaded."
            />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredCatalog.map(item => (
                <div key={item.id} className="card p-4 hover:border-border-bright transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-bg-overlay border border-border flex items-center justify-center text-text-muted">
                        {CATEGORY_ICONS[item.category] || <Package className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{item.name}</div>
                        {item.version && <div className="text-2xs text-text-muted">v{item.version}</div>}
                      </div>
                    </div>
                    {item.installed && <Badge variant="green">Installed</Badge>}
                  </div>

                  <p className="text-xs text-text-secondary mb-3 line-clamp-2">{item.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="text-2xs text-text-muted">{formatBytes(item.size_bytes)}</div>
                    <Button
                      size="sm"
                      variant={item.installed ? 'ghost' : 'primary'}
                      icon={<Download className="w-3 h-3" />}
                      onClick={() => installItem(item)}
                      disabled={item.installed}
                    >
                      {item.installed ? 'Installed' : 'Install'}
                    </Button>
                  </div>

                  {item.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {item.tags.slice(0, 3).map(t => (
                        <Badge key={t} className="text-2xs">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Queue */}
      {tab === 'queue' && (
        <div className="space-y-2">
          {jobs.length === 0 ? (
            <EmptyState
              icon={<Download className="w-5 h-5" />}
              title="No downloads"
              description="Install items from the catalog to start downloading."
              action={<Button size="sm" onClick={() => setTab('catalog')} icon={<Package className="w-3.5 h-3.5" />}>Browse Catalog</Button>}
            />
          ) : (
            <>
              {jobs.map(job => (
                <div key={job.id} className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text-primary truncate">{job.name}</span>
                        <Badge variant={STATUS_COLORS[job.status] as 'default' | 'blue' | 'amber' | 'green' | 'red'}>
                          {job.status}
                        </Badge>
                      </div>
                      {['downloading', 'verifying', 'extracting'].includes(job.status) && (
                        <Progress value={job.progress} variant="blue" showLabel />
                      )}
                      <div className="flex items-center gap-3 mt-1 text-2xs text-text-muted">
                        <span>{formatBytes(job.downloaded_bytes)} / {formatBytes(job.size_bytes)}</span>
                        {job.status === 'downloading' && (
                          <>
                            <span>{formatSpeed(job.speed_bps)}</span>
                            <span>ETA {formatEta(job.eta_seconds)}</span>
                          </>
                        )}
                        {job.error && <span className="text-status-error">{job.error}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {job.status === 'downloading' && (
                        <Button size="sm" variant="ghost" icon={<Pause className="w-3.5 h-3.5" />}
                          onClick={() => api.downloads.pause(job.id)} />
                      )}
                      {job.status === 'paused' && (
                        <Button size="sm" variant="ghost" icon={<Play className="w-3.5 h-3.5" />}
                          onClick={() => api.downloads.resume(job.id)} />
                      )}
                      {job.status === 'failed' && (
                        <Button size="sm" variant="ghost" icon={<RefreshCw className="w-3.5 h-3.5" />}
                          onClick={() => api.downloads.start(job.id)} />
                      )}
                      <Button size="sm" variant="ghost" icon={<X className="w-3.5 h-3.5" />}
                        onClick={() => api.downloads.cancel(job.id)}
                        disabled={['completed', 'cancelled'].includes(job.status)} />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
