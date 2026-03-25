'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { AlertTriangle, Heart, Droplets, Zap, Radio, Wrench, Wheat, MapPin, Phone, Shield, ChevronRight, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMERGENCY_PACKS = [
  {
    id: 'medical',
    title: 'Medical & First Aid',
    icon: <Heart className="w-5 h-5" />,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    items: ['First aid procedures', 'CPR instructions', 'Wound care', 'Medication references', 'Triage protocols'],
    status: 'partial',
  },
  {
    id: 'survival',
    title: 'Survival Basics',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    items: ['Shelter building', 'Fire starting', 'Navigation', 'Signaling for help', 'Wilderness survival'],
    status: 'empty',
  },
  {
    id: 'water-food',
    title: 'Water & Food',
    icon: <Droplets className="w-5 h-5" />,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    items: ['Water purification', 'Food storage', 'Foraging guides', 'Long-term food supply', 'Garden reference'],
    status: 'empty',
  },
  {
    id: 'power',
    title: 'Power & Off-Grid',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    items: ['Solar setup guides', 'Generator operation', 'Battery management', 'Electrical basics', 'Energy conservation'],
    status: 'empty',
  },
  {
    id: 'comms',
    title: 'Communications',
    icon: <Radio className="w-5 h-5" />,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    items: ['Ham radio basics', 'Frequency references', 'Emergency channels', 'Signal protocols', 'GMRS/FRS guide'],
    status: 'empty',
  },
  {
    id: 'repair',
    title: 'Repair & Maintenance',
    icon: <Wrench className="w-5 h-5" />,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    items: ['Vehicle repair', 'Generator maintenance', 'Plumbing basics', 'Electrical repair', 'Tool references'],
    status: 'empty',
  },
  {
    id: 'navigation',
    title: 'Navigation & Maps',
    icon: <MapPin className="w-5 h-5" />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    items: ['Offline maps (Toronto/Ontario/Canada)', 'Emergency shelters', 'Resource locations', 'Evacuation routes', 'Meeting points'],
    status: 'partial',
  },
  {
    id: 'contacts',
    title: 'Emergency Contacts',
    icon: <Phone className="w-5 h-5" />,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    items: ['Family contacts', 'Emergency services', 'Neighbors & community', 'Medical contacts', 'Utility companies'],
    status: 'empty',
  },
];

type StatusBadge = 'complete' | 'partial' | 'empty';
const STATUS_LABEL: Record<StatusBadge, { label: string; variant: 'green' | 'amber' | 'red' }> = {
  complete: { label: 'Complete', variant: 'green' },
  partial:  { label: 'Partial',  variant: 'amber' },
  empty:    { label: 'Empty',    variant: 'red' },
};

export default function EmergencyPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedPack = EMERGENCY_PACKS.find(p => p.id === selected);

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="module-header">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h1>Emergency Packs</h1>
          <p className="text-xs text-text-muted">Survival procedures, critical references, and offline emergency guides</p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-300">Populate your emergency packs before you need them</p>
          <p className="text-xs text-red-400/70 mt-0.5">
            Import survival guides, medical references, and emergency procedures via the Library module.
            Use the Downloads catalog to install curated offline content packs.
          </p>
        </div>
      </div>

      {/* Pack grid */}
      <div className="grid grid-cols-4 gap-4">
        {EMERGENCY_PACKS.map(pack => {
          const statusInfo = STATUS_LABEL[pack.status as StatusBadge];
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
              <div className="text-2xs text-text-muted mt-1">{pack.items.length} categories</div>
            </button>
          );
        })}
      </div>

      {/* Expanded pack detail */}
      {selectedPack && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center', selectedPack.bg, selectedPack.border, selectedPack.color)}>
              {selectedPack.icon}
            </div>
            <h2 className="text-sm font-semibold">{selectedPack.title}</h2>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" icon={<Download className="w-3.5 h-3.5" />}
                onClick={() => window.location.href = '/downloads'}>
                Get Content Pack
              </Button>
              <Button size="sm" variant="primary" onClick={() => window.location.href = '/library'}>
                Open in Library
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {selectedPack.items.map(item => (
              <div key={item} className="flex items-center gap-2 bg-bg-overlay rounded-md px-3 py-2">
                <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-secondary">{item}</span>
              </div>
            ))}
          </div>

          {selectedPack.status === 'empty' && (
            <div className="mt-4 p-3 bg-bg-overlay rounded-lg border border-border border-dashed text-center">
              <p className="text-xs text-text-muted">This pack is empty. Import relevant documents or install a content pack.</p>
            </div>
          )}
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
