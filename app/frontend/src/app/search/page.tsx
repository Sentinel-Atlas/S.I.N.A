'use client';

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Search, FileText, Shield, MapPin, Bookmark, Zap, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchResult, SearchScope } from '@sina/shared';

const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'library',      label: 'Library' },
  { value: 'vault',        label: 'Vault' },
  { value: 'ai-knowledge', label: 'AI Knowledge' },
];

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  content:    <FileText className="w-3.5 h-3.5" />,
  vault:      <Shield className="w-3.5 h-3.5" />,
  'map-marker': <MapPin className="w-3.5 h-3.5" />,
  bookmark:   <Bookmark className="w-3.5 h-3.5" />,
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [semantic, setSemantic] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await api.search.query({ q: query, scope, semantic });
      setResults(res);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }, [query, scope, semantic]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="module-header">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Search className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h1>Search</h1>
          <p className="text-xs text-text-muted">Search across all local content</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search your local knowledge base..."
              className="input-base pl-10 h-10 text-sm"
              autoFocus
            />
          </div>
          <Button variant="primary" size="md" icon={<Search className="w-4 h-4" />} onClick={doSearch} loading={searching}>
            Search
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {/* Scope */}
          <div className="flex gap-1">
            {SCOPE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setScope(opt.value)}
                className={cn('px-3 py-1 rounded text-xs font-medium transition-colors',
                  scope === opt.value ? 'bg-accent text-text-inverse' : 'bg-bg-overlay text-text-muted hover:text-text-primary')}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Semantic toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={cn('w-8 h-4 rounded-full transition-colors relative', semantic ? 'bg-accent' : 'bg-bg-overlay border border-border')}>
              <div className={cn('w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform', semantic ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className="text-xs text-text-muted flex items-center gap-1">
              <Zap className="w-3 h-3" /> Semantic Search
            </span>
          </label>
        </div>
      </div>

      {/* Results */}
      {searched && results.length === 0 && (
        <EmptyState
          icon={<Search className="w-5 h-5" />}
          title="No results found"
          description={`No matches for "${query}" in ${scope === 'all' ? 'any content' : scope}.`}
        />
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-text-muted">{results.length} result{results.length !== 1 ? 's' : ''}</div>
          {results.map(result => (
            <div key={result.id} className="card p-4 hover:border-border-bright transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-bg-overlay border border-border flex items-center justify-center text-text-muted flex-shrink-0">
                  {SOURCE_ICONS[result.source_type] || <FileText className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-text-primary">{result.title}</span>
                    {result.category && (
                      <span className={cn('badge text-2xs', CATEGORY_COLORS[result.category])}>
                        {CATEGORY_LABELS[result.category] || result.category}
                      </span>
                    )}
                    <span className="ml-auto text-2xs text-text-muted font-mono">
                      {Math.round(result.score)}%
                    </span>
                  </div>
                  <p
                    className="text-xs text-text-secondary line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: result.excerpt }}
                  />
                  {result.tags && result.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {result.tags.slice(0, 4).map(t => (
                        <Badge key={t} className="text-2xs">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searched && !searching && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 mx-auto text-text-muted/30 mb-4" />
          <p className="text-sm text-text-muted">Enter a query to search your local knowledge base</p>
          <p className="text-xs text-text-muted mt-1">Searches documents, vault, maps, and more</p>
        </div>
      )}
    </div>
  );
}
