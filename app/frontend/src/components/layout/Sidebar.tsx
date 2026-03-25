'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Brain, Library, Map, Shield, Wrench,
  Download, FolderInput, Search, Activity, Settings,
  AlertTriangle, ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',           label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/ai',         label: 'AI',           icon: Brain },
  { href: '/library',    label: 'Library',      icon: Library },
  { href: '/maps',       label: 'Maps',         icon: Map },
  { href: '/vault',      label: 'Vault',        icon: Shield },
  { href: '/tools',      label: 'Tools',        icon: Wrench },
  { href: '/downloads',  label: 'Downloads',    icon: Download },
  { href: '/imports',    label: 'Import',       icon: FolderInput },
  { href: '/search',     label: 'Search',       icon: Search },
  { href: '/emergency',  label: 'Emergency',    icon: AlertTriangle },
  null, // divider
  { href: '/status',     label: 'Status',       icon: Activity },
  { href: '/settings',   label: 'Settings',     icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-full w-sidebar bg-bg-surface border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
        <div className="w-7 h-7 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center">
          <span className="text-accent font-bold text-xs font-mono">SI</span>
        </div>
        <div>
          <div className="text-sm font-bold text-text-primary tracking-tight">S.I.N.A</div>
          <div className="text-2xs text-text-muted uppercase tracking-widest">Command Center</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item, i) => {
          if (!item) return <div key={i} className="my-2 border-t border-border/50" />;
          const Icon = item.icon;
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'nav-item',
                active && 'active',
                item.label === 'Emergency' && !active && 'hover:text-status-error hover:bg-status-error/10'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <div className="text-2xs text-text-muted font-mono">v0.1.0 — local-first</div>
      </div>
    </aside>
  );
}
