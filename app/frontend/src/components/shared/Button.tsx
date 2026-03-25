'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:   'bg-accent text-text-inverse hover:bg-accent-glow font-semibold shadow-glow-amber',
  secondary: 'bg-bg-overlay border border-border text-text-primary hover:bg-bg-raised hover:border-border-bright',
  ghost:     'text-text-secondary hover:text-text-primary hover:bg-bg-overlay',
  danger:    'bg-status-error/15 border border-status-error/30 text-status-error hover:bg-status-error/25',
  outline:   'border border-border text-text-secondary hover:border-accent/50 hover:text-accent',
};

const SIZES: Record<Size, string> = {
  sm:  'h-7 px-3 text-xs gap-1.5',
  md:  'h-8 px-4 text-sm gap-2',
  lg:  'h-10 px-5 text-sm gap-2',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
