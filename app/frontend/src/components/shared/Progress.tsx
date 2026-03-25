'use client';

import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number; // 0-100
  variant?: 'amber' | 'blue' | 'green' | 'red';
  className?: string;
  showLabel?: boolean;
  height?: 'sm' | 'md';
}

const COLORS = {
  amber: 'bg-accent',
  blue:  'bg-blue-500',
  green: 'bg-status-online',
  red:   'bg-status-error',
};

export function Progress({ value, variant = 'amber', className, showLabel, height = 'sm' }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('progress-track flex-1', height === 'md' ? 'h-2' : 'h-1')}>
        <div
          className={cn('progress-fill', COLORS[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-2xs text-text-muted font-mono w-8 text-right">{Math.round(pct)}%</span>
      )}
    </div>
  );
}
