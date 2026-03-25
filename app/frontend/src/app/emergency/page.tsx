'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { Progress } from '@/components/shared/Progress';
import {
  AlertTriangle, Heart, Droplets, Zap, Radio, Wrench,
  MapPin, Phone, Shield, ChevronRight, Download, BookOpen,
  CheckCircle2, XCircle, Siren,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PackDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  items: string[];
  kiwix_categories?: string[];
  vault_tags?: string[];
  required_for_readiness: number;
}

const EMERGENCY_PACKS: PackDef[] = [
  {
    id: 'medical',
    title: 'Medical & First Aid',
    icon: <Heart className="w-5 h-5" />,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    items: ['First aid procedures', 'CPR instructions', 'Wound care', 'Medication references', 'Triage protocols'],
    kiwix_categories: ['medicine'],
    vault_tags: ['medical', 'first-aid', 'emergency'],
    required_for_readiness: 3,
  },
  {
    id: 'survival',
    title: 'Survival Basics',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    items: ['Shelter building', 'Fire starting', 'Navigation', 'Signaling for help', 'Wilderness survival'],
    kiwix_categories: ['survival'],
    vault_tags: ['survival', 'shelter', 'fire'],
    required_for_readiness: 3,
  },
  {
    id: 'water-food',
    title: 'Water & Food',
    icon: <Droplets className="w-5 h-5" />,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    items: ['Water purification', 'Food storage', 'Foraging guides', 'Long-term food supply', 'Garden reference'],
    kiwix_categories: ['agriculture'],
    vault_tags: ['water', 'food', 'foraging'],
    required_for_readiness: 2,
  },
  {
    id: 'power',
    title: 'Power & Off-Grid',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    items: ['Solar setup guides', 'Generator operation', 'Battery management', 'Electrical basics', 'Energy conservation'],
    kiwix_categories: ['diy-repair', 'technical'],
    vault_tags: ['power', 'solar', 'generator'],
    required_for_readiness: 2,
  },
  {
    id: 'comms',
    title: 'Communications',
    icon: <Radio className="w-5 h-5" />,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    items: ['Ham radio basics', 'Frequency references', 'Emergency channels', 'Signal protocols', 'GMRS/FRS guide'],
    kiwix_categories: ['technical'],
    vault_tags: ['radio', 'comms', 'frequency'],
    required_for_readiness: 2,
  },
  {
    id: 'repair',
    title: 'Repair & Maintenance',
    icon: <Wrench className="w-5 h-5" />,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    items: ['Vehicle repair', 'Generator maintenance', 'Plumbing basics', 'Electrical repair', 'Tool references'],
    kiwix_categories: ['diy-repair'],
    vault_tags: ['repair', 'maintenance', 'tools'],
    required_for_readiness: 1,
  },
  {
    id: 'navigation',
    title: 'Navigation & Maps',
    icon: <MapPin className="w-5 h-5" />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    items: ['Offline maps (Toronto/Ontario/Canada)', 'Emergency shelters', 'Resource locations', 'Evacuation routes', 'Meeting points'],
    kiwix_categories: [],
    vault_tags: ['maps', 'evacuation', 'shelter'],
    required_for_readiness: 2,
  },
  {
    id: 'contacts',
    title: 'Emergency Contacts',
    icon: <Phone className="w-5 h-5" />,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    items: ['Family contacts', 'Emergency services', 'Neighbors & community', 'Medical contacts', 'Utility companies'],
    kiwix_categories: [],
    vault_tags: ['contacts', 'emergency'],
    required_for_readiness: 3,
  },
];

interface PackReadiness {
  score: number; // 0-100
  indexed_docs: number;
  vault_items: number;
  kiwix_installed: boolean;
  status: 'ready' | 'partial' | 'empty';
  missing: string[];
}

type StatusBadge = 'ready' | 'partial' | 'empty';
const STATUS_CONFIG: Record<StatusBadge, { label: string; variant: 'green' | 'amber' | 'red' }> = {
  ready:   { label: 'Ready',   variant: 'green' },
  partial: { label: 'Partial', variant: 'amber' },
  empty:   { label: 'Empty',   variant: 'red' },
};

function computeReadiness(pack: PackDef, contentCount: number, vaultCount: number, zimCategories: string[]): PackReadiness {
  const missing: string[] = [];
  let score = 0;

  // Check Kiwix packs
  const hasKiwix = (pack.kiwix_categories || []).some(cat => zimCategories.includes(cat));
  if (pack.kiwix_categories && pack.kiwix_categories.length > 0) {
    if (hasKiwix) score += 40;
    else missing.push(`Install a ${pack.kiwix_categories[0]} knowledge pack from the Library`);
  } else {
    score += 40;
  }

  // Check indexed content
  if (contentCount >= pack.required_for_readiness) {
    score += 35;
  } else {
    const need = pack.required_for_readiness - contentCount;
    if (contentCount > 0) score += 15;
    missing.push(`Import ${need} more ${pack.id} document${need > 1 ? 's' : ''}`);
  }

  // Check vault items
  if (vaultCount > 0) {
    score += 25;
  } else {
    missing.push(`Create emergency notes in the Vault`);
  }

  let status: 'ready' | 'partial' | 'empty' = 'empty';
  if (score >= 80) status = 'ready';
  else if (score >= 30) status = 'partial';

  return { score, indexed_docs: contentCount, vault_items: vaultCount, kiwix_installed: hasKiwix, status, missing };
}

export default function EmergencyPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [quickMode, setQuickMode] = useState(false);
  const [readiness, setReadiness] = useState<Record<string, PackReadiness>>({});
  const [zimCategories, setZimCategories] = useState<string[]>([]);

  useEffect(() => {
    // Fetch ZIM library to see what's installed
    api.kiwix.library().then(zims => {
      const cats = [...new Set(zims.filter(z => z.installed).map(z => z.category))];
      setZimCategories(cats);
    }).catch(() => {});

    // For each pack, fetch content counts
    const computeAll = async () => {
      const result: Record<string, PackReadiness> = {};
      const stats = await api.dashboard.stats().catch(() => null);

      for (const pack of EMERGENCY_PACKS) {
        // Use stats as a rough approximation — in production we'd have per-category counts
        const contentCount = stats ? Math.floor((stats as Record<string, Record<string, number>>).content?.indexed ?? 0 / EMERGENCY_PACKS.length) : 0;
        const vaultCount = stats ? Math.floor((stats as Record<string, Record<string, number>>).vault?.total ?? 0 / EMERGENCY_PACKS.length) : 0;
        result[pack.id] = computeReadiness(pack, contentCount, vaultCount, zimCategories);
      }
      setReadiness(result);
    };

    computeAll();
  }, [zimCategories]);

  const selectedPack = EMERGENCY_PACKS.find(p => p.id === selected);
  const selectedReadiness = selected ? readiness[selected] : null;

  const overallScore = EMERGENCY_PACKS.length > 0
    ? Math.round(Object.values(readiness).reduce((s, r) => s + r.score, 0) / EMERGENCY_PACKS.length)
    : 0;

  const readyCount = Object.values(readiness).filter(r => r.status === 'ready').length;
  const emptyCount = Object.values(readiness).filter(r => r.status === 'empty').length;

  if (quickMode) {
    return (
      <div className="fixed inset-0 bg-bg-base z-50 flex flex-col">
        <div className="bg-red-500/20 border-b border-red-500/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Siren className="w-6 h-6 text-red-400" />
            <div>
              <div className="text-red-300 font-bold text-lg tracking-wide">EMERGENCY QUICK ACCESS</div>
              <div className="text-red-400/70 text-xs">All critical procedures — tap to open</div>
            </div>
          </div>
          <button
            onClick={() => setQuickMode(false)}
            className="text-red-400 hover:text-red-300 text-sm border border-red-500/30 px-3 py-1.5 rounded"
          >
            Exit Emergency Mode
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
            {EMERGENCY_PACKS.map(pack => (
              <Link
                key={pack.id}
                href={`/library?category=${pack.id}`}
                className={cn('card p-5 hover:border-border-bright transition-all', pack.bg, pack.border)}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0', pack.bg, pack.border, pack.color)}>
                    {pack.icon}
                  </div>
                  <div>
                    <div className={cn('font-semibold', pack.color)}>{pack.title}</div>
                    <div className="text-text-muted text-xs mt-0.5">{pack.items[0]}, {pack.items[1]}...</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-muted ml-auto" />
                </div>
              </Link>
            ))}

            <Link href="/vault" className="card p-5 border-pink-500/20 bg-pink-500/10 hover:border-border-bright transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border border-pink-500/20 bg-pink-500/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <div className="text-pink-400 font-semibold">Emergency Contacts</div>
                  <div className="text-text-muted text-xs mt-0.5">Personal vault — contacts & notes</div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-muted ml-auto" />
              </div>
            </Link>

            <Link href="/maps" className="card p-5 border-blue-500/20 bg-blue-500/10 hover:border-border-bright transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border border-blue-500/20 bg-blue-500/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-blue-400 font-semibold">Offline Maps</div>
                  <div className="text-text-muted text-xs mt-0.5">Regional maps & emergency markers</div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-muted ml-auto" />
              </div>
            </Link>

            <Link href="/ai" className="card p-5 border-amber-500/20 bg-amber-500/10 hover:border-border-bright transition-all col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border border-amber-500/20 bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-amber-400 font-semibold">AI Survival Advisor</div>
                  <div className="text-text-muted text-xs mt-0.5">Ask the local AI — no internet required</div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-muted ml-auto" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="module-header">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h1>Emergency Packs</h1>
          <p className="text-xs text-text-muted">Readiness status, critical references, and offline emergency guides</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setQuickMode(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
          >
            <Siren className="w-4 h-4" />
            Emergency Mode
          </button>
        </div>
      </div>

      {/* Readiness overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Overall Readiness</div>
          <div className="text-2xl font-bold text-text-primary mb-2">{overallScore}%</div>
          <Progress
            value={overallScore}
            variant={overallScore >= 70 ? 'green' : overallScore >= 40 ? 'amber' : 'red'}
          />
        </div>
        <div className="card p-4">
          <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Packs Ready</div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-status-ok">{readyCount}</span>
            <span className="text-text-muted text-sm mb-0.5">/ {EMERGENCY_PACKS.length}</span>
          </div>
          <div className="text-xs text-text-muted mt-1">
            {emptyCount > 0 && <span className="text-status-error">{emptyCount} empty</span>}
            {emptyCount === 0 && <span className="text-status-ok">None empty</span>}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Knowledge Packs</div>
          <div className="text-2xl font-bold text-text-primary mb-1">{zimCategories.length}</div>
          <div className="text-xs text-text-muted">
            {zimCategories.length === 0
              ? <span className="text-status-warn">No ZIM files installed</span>
              : `Categories: ${zimCategories.slice(0, 3).join(', ')}`}
          </div>
        </div>
      </div>

      {/* Warning banner if not ready */}
      {overallScore < 40 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-300">Emergency packs are not populated</p>
            <p className="text-xs text-red-400/70 mt-0.5">
              Download knowledge packs from the Library module, import survival guides, and create emergency vault notes.
              Use the Downloads catalog for curated offline content.
            </p>
          </div>
          <Link href="/library" className="ml-auto text-xs border border-red-500/30 text-red-400 px-3 py-1.5 rounded whitespace-nowrap hover:bg-red-500/10 transition-colors">
            Go to Library →
          </Link>
        </div>
      )}

      {/* Pack grid */}
      <div className="grid grid-cols-4 gap-4">
        {EMERGENCY_PACKS.map(pack => {
          const r = readiness[pack.id];
          const status = r?.status || 'empty';
          const statusInfo = STATUS_CONFIG[status as StatusBadge];
          return (
            <button
              key={pack.id}
              onClick={() => setSelected(selected === pack.id ? null : pack.id)}
              className={cn(
                'text-left card p-4 transition-all hover:border-border-bright',
                selected === pack.id && 'border-accent/50 bg-accent/5 ring-1 ring-accent/20'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0', pack.bg, pack.border, pack.color)}>
                  {pack.icon}
                </div>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>
              <div className="text-sm font-semibold text-text-primary">{pack.title}</div>
              <div className="mt-2">
                <Progress value={r?.score || 0} variant={status === 'ready' ? 'green' : status === 'partial' ? 'amber' : 'red'} />
              </div>
              <div className="text-2xs text-text-muted mt-1">
                {r ? `${r.score}% ready` : 'Not assessed'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Expanded pack detail */}
      {selectedPack && selectedReadiness && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center', selectedPack.bg, selectedPack.border, selectedPack.color)}>
              {selectedPack.icon}
            </div>
            <div>
              <h2 className="text-sm font-semibold">{selectedPack.title}</h2>
              <div className="text-xs text-text-muted">Readiness: {selectedReadiness.score}%</div>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" icon={<Download className="w-3.5 h-3.5" />}
                onClick={() => window.location.href = '/downloads'}>
                Get Content Pack
              </Button>
              <Button size="sm" variant="secondary" icon={<BookOpen className="w-3.5 h-3.5" />}
                onClick={() => window.location.href = '/library'}>
                Open Library
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Content items */}
            <div>
              <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Required Content</div>
              <div className="space-y-1.5">
                {selectedPack.items.map(item => (
                  <div key={item} className="flex items-center gap-2 bg-bg-overlay rounded-md px-3 py-2">
                    <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
                    <span className="text-xs text-text-secondary">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Readiness checklist */}
            <div>
              <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Readiness Checklist</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  {selectedReadiness.kiwix_installed
                    ? <CheckCircle2 className="w-4 h-4 text-status-ok flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-status-error flex-shrink-0" />}
                  <span className={selectedReadiness.kiwix_installed ? 'text-text-secondary' : 'text-text-muted'}>
                    Knowledge pack (ZIM) installed
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {selectedReadiness.indexed_docs >= selectedPack.required_for_readiness
                    ? <CheckCircle2 className="w-4 h-4 text-status-ok flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-status-error flex-shrink-0" />}
                  <span className={selectedReadiness.indexed_docs >= selectedPack.required_for_readiness ? 'text-text-secondary' : 'text-text-muted'}>
                    {selectedReadiness.indexed_docs} / {selectedPack.required_for_readiness} documents indexed
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {selectedReadiness.vault_items > 0
                    ? <CheckCircle2 className="w-4 h-4 text-status-ok flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-status-error flex-shrink-0" />}
                  <span className={selectedReadiness.vault_items > 0 ? 'text-text-secondary' : 'text-text-muted'}>
                    Vault notes created
                  </span>
                </div>
              </div>

              {selectedReadiness.missing.length > 0 && (
                <div className="mt-4">
                  <div className="text-2xs text-status-warn uppercase tracking-wider mb-2">To improve readiness:</div>
                  <ul className="space-y-1">
                    {selectedReadiness.missing.map((m, i) => (
                      <li key={i} className="text-xs text-text-muted flex items-start gap-1.5">
                        <span className="text-status-warn mt-0.5">→</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-4">
        <Link href="/vault" className="card p-4 hover:border-border-bright transition-colors flex items-center gap-3">
          <Shield className="w-4 h-4 text-accent" />
          <div>
            <div className="text-sm font-medium">Vault</div>
            <div className="text-xs text-text-muted">Personal notes & contacts</div>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted ml-auto" />
        </Link>
        <Link href="/maps" className="card p-4 hover:border-border-bright transition-colors flex items-center gap-3">
          <MapPin className="w-4 h-4 text-blue-400" />
          <div>
            <div className="text-sm font-medium">Maps</div>
            <div className="text-xs text-text-muted">Offline maps & markers</div>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted ml-auto" />
        </Link>
        <Link href="/ai" className="card p-4 hover:border-border-bright transition-colors flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <div>
            <div className="text-sm font-medium">AI Advisor</div>
            <div className="text-xs text-text-muted">Ask the Survival Advisor</div>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted ml-auto" />
        </Link>
      </div>
    </div>
  );
}
