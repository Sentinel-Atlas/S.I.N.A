import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatSpeed(bps: number): string {
  if (bps === 0) return '—';
  return `${formatBytes(bps)}/s`;
}

export function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

export const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Medical',
  survival: 'Survival',
  repair: 'Repair',
  maps: 'Maps',
  wikipedia: 'Wikipedia',
  'radio-comms': 'Radio / Comms',
  emergency: 'Emergency',
  family: 'Family',
  'power-offgrid': 'Power / Off-Grid',
  'food-water': 'Food & Water',
  personal: 'Personal',
  technical: 'Technical',
  'web-archive': 'Web Archive',
  uncategorized: 'Uncategorized',
};

export const CATEGORY_COLORS: Record<string, string> = {
  medical:       'text-red-400 bg-red-900/30',
  survival:      'text-green-400 bg-green-900/30',
  repair:        'text-orange-400 bg-orange-900/30',
  maps:          'text-blue-400 bg-blue-900/30',
  wikipedia:     'text-purple-400 bg-purple-900/30',
  'radio-comms': 'text-yellow-400 bg-yellow-900/30',
  emergency:     'text-red-300 bg-red-900/40',
  family:        'text-pink-400 bg-pink-900/30',
  'power-offgrid': 'text-amber-400 bg-amber-900/30',
  'food-water':  'text-teal-400 bg-teal-900/30',
  personal:      'text-slate-400 bg-slate-800/50',
  technical:     'text-cyan-400 bg-cyan-900/30',
  'web-archive': 'text-indigo-400 bg-indigo-900/30',
  uncategorized: 'text-text-muted bg-bg-overlay',
};
