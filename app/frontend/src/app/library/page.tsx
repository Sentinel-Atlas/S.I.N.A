'use client';

import { useEffect, useState, useRef } from 'react';
import { api, uploadFiles } from '@/lib/api';
import { formatBytes, formatRelative, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Progress } from '@/components/shared/Progress';
import {
  Library, Upload, RefreshCw, Search, Filter, Trash2,
  FileText, AlertCircle, CheckCircle, Clock, FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentItem, Collection } from '@sina/shared';

const CATEGORIES = Object.keys(CATEGORY_LABELS);

export default function LibraryPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.library.items({
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        page,
        per_page: 50,
      });
      setItems(result.items);
      setTotal(result.total);
      const cols = await api.library.collections();
      setCollections(cols);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [categoryFilter, statusFilter, page]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (!files.length) return;
    setUploading(true);
    try {
      await uploadFiles(files);
      await load();
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      await uploadFiles(files);
      await load();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const deleteItem = async (id: string) => {
    await api.library.deleteItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
    setTotal(t => t - 1);
  };

  const reindexItem = async (id: string) => {
    await api.library.reindexItem(id);
    await load();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'indexed': return <CheckCircle className="w-3.5 h-3.5 text-status-online" />;
      case 'failed':  return <AlertCircle className="w-3.5 h-3.5 text-status-error" />;
      case 'pending':
      case 'parsing':
      case 'indexing': return <Clock className="w-3.5 h-3.5 text-status-info animate-pulse" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="module-header">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Library className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h1>Library</h1>
          <p className="text-xs text-text-muted">{total} documents · offline knowledge base</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => api.library.reindexAll()}>
            Reindex All
          </Button>
          <Button size="sm" variant="primary" icon={<Upload className="w-3.5 h-3.5" />}
            onClick={() => fileInputRef.current?.click()} loading={uploading}>
            Import
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            placeholder="Filter by title..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="input-base pl-8"
          />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input-base w-auto">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-base w-auto">
          <option value="">All Status</option>
          <option value="indexed">Indexed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-all',
          dragging
            ? 'border-accent bg-accent/5 text-accent'
            : 'border-border text-text-muted hover:border-border-bright'
        )}
      >
        <Upload className="w-6 h-6 mx-auto mb-2" />
        <p className="text-sm font-medium">Drop files here to import</p>
        <p className="text-xs mt-1">Supports PDF, DOCX, TXT, Markdown, HTML, CSV</p>
      </div>

      {/* Collections sidebar + items */}
      <div className="flex gap-4">
        {/* Collections */}
        <div className="w-48 flex-shrink-0">
          <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Collections</div>
          <div className="space-y-0.5">
            <button
              onClick={() => setCategoryFilter('')}
              className={cn('w-full text-left nav-item text-xs', !categoryFilter && 'active')}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              All Documents
            </button>
            {collections.map(col => (
              <button key={col.id} className="w-full text-left nav-item text-xs">
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="flex-1 truncate">{col.name}</span>
                <span className="text-2xs text-text-muted">{col.item_count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Items table */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-muted text-sm">Loading...</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-5 h-5" />}
              title="No documents"
              description="Import files or configure a watched folder to populate your library."
              action={
                <Button size="sm" variant="primary" icon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => fileInputRef.current?.click()}>
                  Import Files
                </Button>
              }
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Imported</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter(i => !searchQ || i.title.toLowerCase().includes(searchQ.toLowerCase()))
                  .map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                        <span className="text-text-primary font-medium truncate max-w-xs">{item.title}</span>
                        <span className="text-2xs text-text-muted uppercase">{item.file_type}</span>
                      </div>
                    </td>
                    <td>
                      <span className={cn('badge text-2xs', CATEGORY_COLORS[item.category])}>
                        {CATEGORY_LABELS[item.category] || item.category}
                      </span>
                    </td>
                    <td className="font-mono">{formatBytes(item.size_bytes)}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {statusIcon(item.status)}
                        <span className="text-xs capitalize">{item.status}</span>
                      </div>
                    </td>
                    <td className="text-xs">{formatRelative(item.imported_at)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {item.status === 'failed' && (
                          <Button size="sm" variant="ghost" icon={<RefreshCw className="w-3 h-3" />}
                            onClick={() => reindexItem(item.id)} />
                        )}
                        <Button size="sm" variant="ghost" icon={<Trash2 className="w-3 h-3" />}
                          onClick={() => deleteItem(item.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
