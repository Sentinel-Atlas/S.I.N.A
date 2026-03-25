'use client';

import { useEffect, useRef, useState } from 'react';
import { api, uploadFiles } from '@/lib/api';
import { formatBytes, formatRelative } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { FolderInput, Upload, RefreshCw, CheckCircle, AlertCircle, Clock, XCircle, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportJob } from '@sina/shared';

export default function ImportsPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [watchDirs, setWatchDirs] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [j, s] = await Promise.all([api.system.jobs(), api.system.status()]);
    setJobs(j);
    setWatchDirs((s as Record<string, unknown>).watch_dirs as string[] || []);
  };

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setUploading(true);
    try {
      await uploadFiles(e.dataTransfer.files);
      await load();
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      await uploadFiles(e.target.files);
      await load();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const statusIcon = (s: string) => ({
    done:        <CheckCircle className="w-3.5 h-3.5 text-status-online" />,
    failed:      <AlertCircle className="w-3.5 h-3.5 text-status-error" />,
    unsupported: <XCircle className="w-3.5 h-3.5 text-text-muted" />,
    importing:   <Clock className="w-3.5 h-3.5 text-status-info animate-pulse" />,
    queued:      <Clock className="w-3.5 h-3.5 text-text-muted" />,
    detected:    <Clock className="w-3.5 h-3.5 text-text-muted animate-pulse" />,
  }[s] || <Clock className="w-3.5 h-3.5 text-text-muted" />);

  const summary = {
    total: jobs.length,
    done: jobs.filter(j => j.status === 'done').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    pending: jobs.filter(j => ['importing', 'queued', 'detected'].includes(j.status)).length,
  };

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="module-header">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <FolderInput className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h1>Content Import</h1>
          <p className="text-xs text-text-muted">Drag & drop files or use watched folders to ingest content</p>
        </div>
        <Button className="ml-auto" size="sm" variant="ghost" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>Refresh</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', val: summary.total, color: 'text-text-primary' },
          { label: 'Indexed', val: summary.done, color: 'text-status-online' },
          { label: 'Pending', val: summary.pending, color: 'text-status-info' },
          { label: 'Failed', val: summary.failed, color: 'text-status-error' },
        ].map(({ label, val, color }) => (
          <div key={label} className="card p-4 text-center">
            <div className={cn('text-2xl font-bold font-mono', color)}>{val}</div>
            <div className="text-2xs text-text-muted uppercase tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-border-bright hover:bg-bg-surface/50'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className={cn('w-8 h-8 mx-auto mb-3', dragging ? 'text-accent' : 'text-text-muted')} />
        <p className={cn('text-sm font-medium', dragging ? 'text-accent' : 'text-text-secondary')}>
          {uploading ? 'Importing...' : dragging ? 'Release to import' : 'Drop files here or click to browse'}
        </p>
        <p className="text-xs text-text-muted mt-1">Supports PDF, DOCX, TXT, Markdown, HTML, CSV</p>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFile} />
      </div>

      {/* Watched directories */}
      <div className="card p-4">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Watched Folders</h3>
        {watchDirs.length === 0 ? (
          <p className="text-xs text-text-muted">No watched directories configured.</p>
        ) : (
          <div className="space-y-2">
            {watchDirs.map(dir => (
              <div key={dir} className="flex items-center gap-2 bg-bg-overlay rounded-md px-3 py-2">
                <Folder className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs font-mono text-text-secondary">{dir}</span>
                <Badge variant="green" className="ml-auto text-2xs">Watching</Badge>
              </div>
            ))}
          </div>
        )}
        <p className="text-2xs text-text-muted mt-2">Files placed in watched folders are automatically detected and imported. Configure in Settings.</p>
      </div>

      {/* Import log */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Import Log</h3>
          <span className="text-2xs text-text-muted">{jobs.length} entries</span>
        </div>
        {jobs.length === 0 ? (
          <EmptyState
            icon={<FolderInput className="w-5 h-5" />}
            title="No imports yet"
            description="Drop files above or place them in a watched folder."
            className="py-12"
          />
        ) : (
          <table className="data-table">
            <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Status</th><th>Error</th><th>Detected</th></tr></thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td className="text-text-primary max-w-xs truncate">{job.file_name}</td>
                  <td className="font-mono uppercase text-2xs">{job.file_type}</td>
                  <td className="font-mono">{formatBytes(job.size_bytes)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {statusIcon(job.status)}
                      <span className="capitalize text-xs">{job.status}</span>
                    </div>
                  </td>
                  <td className="text-status-error text-xs max-w-xs truncate">{job.error || '—'}</td>
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
