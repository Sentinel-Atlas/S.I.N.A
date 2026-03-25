'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { StatusDot } from '@/components/shared/StatusDot';
import { Wifi, WifiOff, HardDrive } from 'lucide-react';
import type { SystemHealth } from '@sina/shared';

export function StatusBar() {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    const load = () => api.dashboard.health().then(setHealth).catch(() => null);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const aiStatus = health?.modules?.ai;
  const lanExposed = health?.network?.lan_exposed;
  const storageUsed = health?.storage?.used_bytes;
  const storageTotal = health?.storage?.total_bytes;
  const storagePct = storageTotal && storageUsed ? Math.round(storageUsed / storageTotal * 100) : null;

  return (
    <div className="fixed bottom-0 left-sidebar right-0 h-statusbar bg-bg-surface/80 backdrop-blur border-t border-border flex items-center px-4 gap-4 text-2xs text-text-muted z-30">
      {/* AI status */}
      <span className="flex items-center gap-1.5">
        <StatusDot status={aiStatus === 'ready' ? 'online' : aiStatus === 'offline' ? 'offline' : 'warning'} />
        <span>AI {aiStatus === 'ready' ? 'Ready' : aiStatus === 'offline' ? 'Offline' : 'Degraded'}</span>
      </span>

      <span className="text-border">|</span>

      {/* Network */}
      <span className="flex items-center gap-1.5">
        {lanExposed ? <Wifi className="w-3 h-3 text-status-warning" /> : <WifiOff className="w-3 h-3" />}
        <span>{lanExposed ? 'LAN Exposed' : 'Local Only'}</span>
      </span>

      <span className="text-border">|</span>

      {/* Storage */}
      {storageUsed != null && (
        <span className="flex items-center gap-1.5">
          <HardDrive className="w-3 h-3" />
          <span>{formatBytes(storageUsed)} used</span>
          {storagePct != null && (
            <span className={storagePct > 85 ? 'text-status-warning' : ''}>({storagePct}%)</span>
          )}
        </span>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Version */}
      <span className="font-mono">S.I.N.A v0.1.0</span>
    </div>
  );
}
