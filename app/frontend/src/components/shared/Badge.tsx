'use client';

import { cn } from '@/lib/utils';

type Variant = 'default' | 'amber' | 'blue' | 'green' | 'red' | 'purple' | 'outline';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-bg-overlay text-text-secondary border border-border',
  amber:   'bg-accent/15 text-accent border border-accent/30',
  blue:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  green:   'bg-status-online/15 text-status-online border border-status-online/30',
  red:     'bg-status-error/15 text-status-error border border-status-error/30',
  purple:  'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  outline: 'border border-border text-text-secondary',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('badge', VARIANTS[variant], className)}>
      {children}
    </span>
  );
}
