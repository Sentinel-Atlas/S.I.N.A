'use client';

import { useState } from 'react';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import {
  Wrench, Terminal, FileText, Archive, FileVideo, Calculator,
  HardDrive, Wifi, Globe, Search, FolderOpen, Download, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  installed: boolean;
  launchable: boolean;
  launch?: () => void;
  installNote?: string;
}

const TOOLS: Tool[] = [
  { id: 'terminal', name: 'Terminal', description: 'System terminal emulator', icon: <Terminal className="w-5 h-5" />, category: 'system', installed: true, launchable: true, launch: () => window.open('/', '_blank') },
  { id: 'text-editor', name: 'Text Editor', description: 'Plain text and markdown editor', icon: <FileText className="w-5 h-5" />, category: 'editing', installed: true, launchable: true, launch: () => window.location.href = '/vault' },
  { id: 'archive', name: 'Archive Manager', description: 'Extract ZIP, tar, and other archives', icon: <Archive className="w-5 h-5" />, category: 'files', installed: false, launchable: false, installNote: 'Install via: apt install file-roller' },
  { id: 'media-player', name: 'Media Player', description: 'Play local audio and video files', icon: <FileVideo className="w-5 h-5" />, category: 'media', installed: false, launchable: false, installNote: 'Install via: apt install vlc' },
  { id: 'file-browser', name: 'File Browser', description: 'Browse and manage local files', icon: <FolderOpen className="w-5 h-5" />, category: 'files', installed: false, launchable: false, installNote: 'Install via: apt install thunar' },
  { id: 'calculator', name: 'Unit Converter', description: 'Measurements, currency, conversions', icon: <Calculator className="w-5 h-5" />, category: 'utilities', installed: true, launchable: true, launch: () => {} },
  { id: 'disk-usage', name: 'Disk Usage', description: 'Analyze storage consumption', icon: <HardDrive className="w-5 h-5" />, category: 'system', installed: false, launchable: false, installNote: 'Install via: apt install baobab' },
  { id: 'network-scan', name: 'Network Scanner', description: 'Scan local network devices', icon: <Wifi className="w-5 h-5" />, category: 'network', installed: false, launchable: false, installNote: 'Install via: apt install nmap' },
  { id: 'offline-browser', name: 'Offline Web Browser', description: 'Browse saved website archives (WARC/WACZ)', icon: <Globe className="w-5 h-5" />, category: 'web', installed: false, launchable: false, installNote: 'Import web archives via Library module' },
  { id: 'local-search', name: 'Content Search', description: 'Full-text search across all local content', icon: <Search className="w-5 h-5" />, category: 'search', installed: true, launchable: true, launch: () => window.location.href = '/search' },
  { id: 'lan-share', name: 'LAN File Share', description: 'Share files over local network', icon: <Wifi className="w-5 h-5" />, category: 'network', installed: false, launchable: false, installNote: 'Enable LAN exposure in Settings' },
  { id: 'downloads', name: 'Download Manager', description: 'Manage queued downloads and installs', icon: <Download className="w-5 h-5" />, category: 'system', installed: true, launchable: true, launch: () => window.location.href = '/downloads' },
];

const CATEGORIES = ['all', ...Array.from(new Set(TOOLS.map(t => t.category)))];

export default function ToolsPage() {
  const [filter, setFilter] = useState('all');
  const [installedOnly, setInstalledOnly] = useState(false);

  const visible = TOOLS
    .filter(t => filter === 'all' || t.category === filter)
    .filter(t => !installedOnly || t.installed);

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="module-header">
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Wrench className="w-4 h-4 text-orange-400" />
        </div>
        <div>
          <h1>Tools</h1>
          <p className="text-xs text-text-muted">Utilities, launchers, and system tools</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors',
                filter === cat ? 'bg-accent text-text-inverse' : 'bg-bg-surface border border-border text-text-muted hover:text-text-primary hover:border-border-bright')}>
              {cat}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 cursor-pointer ml-auto">
          <div className={cn('w-8 h-4 rounded-full relative transition-colors', installedOnly ? 'bg-accent' : 'bg-bg-overlay border border-border')}
            onClick={() => setInstalledOnly(!installedOnly)}>
            <div className={cn('w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform', installedOnly ? 'translate-x-4' : 'translate-x-0.5')} />
          </div>
          <span className="text-xs text-text-muted">Installed only</span>
        </label>
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-4 gap-4">
        {visible.map(tool => (
          <div key={tool.id} className="card p-4 hover:border-border-bright transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center transition-colors',
                tool.installed
                  ? 'bg-accent/10 border-accent/20 text-accent group-hover:bg-accent/15'
                  : 'bg-bg-overlay border-border text-text-muted')}>
                {tool.icon}
              </div>
              <Badge variant={tool.installed ? 'green' : 'default'}>{tool.installed ? 'Ready' : 'Not Installed'}</Badge>
            </div>
            <div className="text-sm font-semibold text-text-primary mb-1">{tool.name}</div>
            <p className="text-xs text-text-muted mb-3 line-clamp-2">{tool.description}</p>
            {tool.installed && tool.launchable && tool.launch ? (
              <Button size="sm" variant="primary" className="w-full" icon={<ExternalLink className="w-3 h-3" />} onClick={tool.launch}>
                Launch
              </Button>
            ) : !tool.installed && tool.installNote ? (
              <div className="text-2xs text-text-muted font-mono bg-bg-overlay rounded px-2 py-1.5 border border-border">
                {tool.installNote}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
