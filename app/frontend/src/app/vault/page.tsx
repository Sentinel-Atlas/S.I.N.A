'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Shield, Plus, Save, Trash2, Pin, Search, FileText,
  CheckSquare, Phone, Bookmark, BookOpen, Edit3, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VaultItem, VaultItemType } from '@sina/shared';

const TYPE_ICONS: Record<VaultItemType, React.ReactNode> = {
  note:      <FileText className="w-3.5 h-3.5" />,
  checklist: <CheckSquare className="w-3.5 h-3.5" />,
  contact:   <Phone className="w-3.5 h-3.5" />,
  bookmark:  <Bookmark className="w-3.5 h-3.5" />,
  guide:     <BookOpen className="w-3.5 h-3.5" />,
  journal:   <Edit3 className="w-3.5 h-3.5" />,
};

const VAULT_TYPES: VaultItemType[] = ['note', 'checklist', 'contact', 'bookmark', 'guide', 'journal'];

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [selected, setSelected] = useState<VaultItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQ, setSearchQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newItem, setNewItem] = useState({ type: 'note' as VaultItemType, title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await api.vault.list({ type: typeFilter || undefined });
    setItems(res.items);
  };

  useEffect(() => { load(); }, [typeFilter]);

  const selectItem = (item: VaultItem) => {
    setSelected(item);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.vault.update(selected.id, { title: editTitle, content: editContent });
      setSelected(updated);
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (item: VaultItem) => {
    const updated = await api.vault.update(item.id, { pinned: !item.pinned });
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    if (selected?.id === item.id) setSelected(updated);
  };

  const deleteItem = async (id: string) => {
    await api.vault.delete(id);
    setItems(prev => prev.filter(i => i.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const createItem = async () => {
    if (!newItem.title) return;
    const item = await api.vault.create(newItem);
    setItems(prev => [item, ...prev]);
    setSelected(item);
    setEditTitle(item.title);
    setEditContent(item.content);
    setShowNew(false);
    setNewItem({ type: 'note', title: '', content: '' });
  };

  const filteredItems = items.filter(i =>
    (!searchQ || i.title.toLowerCase().includes(searchQ.toLowerCase()))
  );
  const pinnedItems = filteredItems.filter(i => i.pinned);
  const unpinnedItems = filteredItems.filter(i => !i.pinned);

  return (
    <div className="flex h-screen animate-fade-in" style={{ height: 'calc(100vh - var(--statusbar-height))' }}>

      {/* Sidebar */}
      <div className="w-72 border-r border-border bg-bg-surface flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Vault</span>
            </div>
            <Button size="sm" variant="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowNew(true)} />
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input placeholder="Search vault..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
              className="input-base pl-8 text-xs" />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setTypeFilter('')}
              className={cn('badge cursor-pointer transition-colors', !typeFilter ? 'bg-accent/15 text-accent' : 'hover:text-text-primary')}>
              All
            </button>
            {VAULT_TYPES.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={cn('badge cursor-pointer transition-colors capitalize', typeFilter === t ? 'bg-accent/15 text-accent' : 'hover:text-text-primary')}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {pinnedItems.length > 0 && (
            <>
              <div className="text-2xs text-text-muted uppercase tracking-wider px-2 py-1">Pinned</div>
              {pinnedItems.map(item => <VaultListItem key={item.id} item={item} selected={selected?.id === item.id} onSelect={selectItem} onPin={togglePin} onDelete={deleteItem} />)}
              <div className="my-1 border-t border-border/50" />
            </>
          )}
          {unpinnedItems.map(item => <VaultListItem key={item.id} item={item} selected={selected?.id === item.id} onSelect={selectItem} onPin={togglePin} onDelete={deleteItem} />)}
          {filteredItems.length === 0 && (
            <EmptyState icon={<Shield className="w-4 h-4" />} title="No items" description="Create notes, checklists, contacts, and more." />
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="px-6 py-3 border-b border-border flex items-center gap-3">
              <span className="text-text-muted">{TYPE_ICONS[selected.type]}</span>
              {editing ? (
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="input-base flex-1 max-w-md" autoFocus />
              ) : (
                <h2 className="text-sm font-semibold flex-1">{selected.title}</h2>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <Button size="sm" variant="ghost" icon={<Pin className={cn('w-3.5 h-3.5', selected.pinned && 'text-accent')} />}
                  onClick={() => togglePin(selected)} />
                {editing ? (
                  <>
                    <Button size="sm" variant="ghost" icon={<X className="w-3.5 h-3.5" />} onClick={() => setEditing(false)} />
                    <Button size="sm" variant="primary" icon={<Save className="w-3.5 h-3.5" />} onClick={saveEdit} loading={saving}>Save</Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" icon={<Edit3 className="w-3.5 h-3.5" />} onClick={() => setEditing(true)}>Edit</Button>
                )}
                <Button size="sm" variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => deleteItem(selected.id)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {editing ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  placeholder="Write in Markdown..."
                  className="w-full h-full input-base font-mono text-sm resize-none min-h-96"
                />
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content || '*Empty*'}</ReactMarkdown>
                </div>
              )}
            </div>
            <div className="px-6 py-2 border-t border-border text-2xs text-text-muted">
              Updated {formatRelative(selected.updated_at)} · {selected.type}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Shield className="w-5 h-5" />}
            title="No item selected"
            description="Select a vault item to view and edit it."
            action={<Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowNew(true)}>New Item</Button>}
            className="h-full"
          />
        )}
      </div>

      {/* New item modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5 space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold">New Vault Item</h3>
            <div>
              <label className="text-2xs text-text-muted uppercase tracking-wider block mb-1">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {VAULT_TYPES.map(t => (
                  <button key={t} onClick={() => setNewItem(p => ({ ...p, type: t }))}
                    className={cn('flex items-center gap-1.5 px-2 py-2 rounded border text-xs capitalize transition-colors',
                      newItem.type === t ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border text-text-muted hover:text-text-primary hover:border-border-bright')}>
                    {TYPE_ICONS[t]} {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-2xs text-text-muted uppercase tracking-wider block mb-1">Title</label>
              <input placeholder="Title..." value={newItem.title} onChange={e => setNewItem(p => ({ ...p, title: e.target.value }))} className="input-base" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={createItem} disabled={!newItem.title}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VaultListItem({ item, selected, onSelect, onPin, onDelete }: {
  item: VaultItem; selected: boolean;
  onSelect: (i: VaultItem) => void;
  onPin: (i: VaultItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div onClick={() => onSelect(item)}
      className={cn('group flex items-start gap-2 p-2.5 rounded-md cursor-pointer transition-colors',
        selected ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-bg-overlay')}>
      <span className="text-text-muted mt-0.5 flex-shrink-0">
        {TYPE_ICONS[item.type as VaultItemType]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-text-primary truncate">{item.title}</span>
          {item.pinned && <Pin className="w-2.5 h-2.5 text-accent flex-shrink-0" />}
        </div>
        <div className="text-2xs text-text-muted mt-0.5 truncate">
          {item.content?.slice(0, 60) || 'Empty'}
        </div>
      </div>
    </div>
  );
}
