'use client';

import { cn } from '@/lib/utils';

type Status = 'online' | 'warning' | 'error' | 'offline' | 'installing';

const MAP: Record<Status, string> = {
  online:     'bg-status-online shadow-[0_0_6px_theme(colors.status.online)]',
  warning:    'bg-status-warning',
  error:      'bg-status-error shadow-[0_0_6px_theme(colors.status.error)]',
  offline:    'bg-status-offline',
  installing: 'bg-status-info animate-pulse',
};

interface StatusDotProps {
  status: Status;
  className?: string;
  label?: string;
}

export function StatusDot({ status, className, label }: StatusDotProps) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <span className={cn('inline-block w-1.5 h-1.5 rounded-full flex-shrink-0', MAP[status])} />
      {label && <span className="text-2xs text-text-muted uppercase tracking-wider">{label}</span>}
    </span>
  );
}
