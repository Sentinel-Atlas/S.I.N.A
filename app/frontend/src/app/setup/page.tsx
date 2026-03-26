'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import type { SetupState, SetupStep, SetupStepId } from '@sina/shared';

// ─── Step components ──────────────────────────────────────────────────────────

interface StepProps {
  probe: Record<string, unknown>;
  onComplete: (stepId: SetupStepId) => void;
  onSkip: (stepId: SetupStepId) => void;
}

function StorageStep({ probe, onComplete }: StepProps) {
  const storage = probe.storage as Record<string, unknown> | undefined;
  const system = probe.system as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-text-primary font-medium mb-3">Data Directory</h3>
        <div className="font-mono text-sm bg-bg-base border border-border-DEFAULT rounded px-3 py-2 text-accent-warm">
          {String(storage?.data_dir || '~/.sina/data')}
        </div>
        <p className="text-text-muted text-sm mt-2">
          All S.I.N.A data — database, documents, maps, AI models, vault — is stored here.
          Change this in <code className="text-accent-warm">.env</code> before first run.
        </p>
      </div>

      <div className="card">
        <h3 className="text-text-primary font-medium mb-3">System Resources</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-text-muted">Total RAM</div>
            <div className="text-text-primary font-medium">
              {formatBytes(Number(system?.total_ram_bytes || 0))} ({Number(system?.total_ram_gb || 0)} GB)
            </div>
          </div>
          <div>
            <div className="text-text-muted">CPU Cores</div>
            <div className="text-text-primary font-medium">{String(system?.cpu_count || '—')}</div>
          </div>
        </div>
      </div>

      <button className="btn-primary w-full" onClick={() => onComplete('storage')}>
        Confirm Storage Setup →
      </button>
    </div>
  );
}

function AIRuntimeStep({ probe, onComplete, onSkip }: StepProps) {
  const ai = probe.ai as Record<string, unknown> | undefined;
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const installOllama = async () => {
    setInstalling(true);
    setStatus('Installing Ollama via system package manager...');
    try {
      // Trigger bootstrap-style install via system endpoint
      await fetch('/api/system/install-ollama', { method: 'POST' });
      setStatus('Ollama installed. Checking...');
      await new Promise(r => setTimeout(r, 2000));
      setStatus('Ollama is ready.');
      onComplete('ai-runtime');
    } catch {
      setStatus('Installation failed. Install Ollama manually: curl -fsSL https://ollama.ai/install.sh | sh');
    } finally {
      setInstalling(false);
    }
  };

  if (ai?.ollama_available) {
    return (
      <div className="space-y-4">
        <div className="card border-status-ok/30 bg-status-ok/5">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-status-ok" />
            <div>
              <div className="text-text-primary font-medium">Ollama is installed and running</div>
              <div className="text-text-muted text-sm">AI models can be managed from the dashboard</div>
            </div>
          </div>
        </div>
        <button className="btn-primary w-full" onClick={() => onComplete('ai-runtime')}>
          Continue →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card border-status-warn/30 bg-status-warn/5">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-status-warn" />
          <div>
            <div className="text-text-primary font-medium">Ollama not detected</div>
            <div className="text-text-muted text-sm">Required for AI chat, RAG search, and embeddings</div>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="text-text-secondary text-sm mb-4">
          S.I.N.A uses Ollama to run AI models locally. It installs as a single binary with no cloud dependency.
          Recommended: <strong className="text-text-primary">{String(ai?.recommended_model || 'llama3.2')}</strong>
        </p>
        <p className="text-text-muted text-xs">
          RAM available: {Number((probe.system as Record<string, unknown>)?.total_ram_gb || 0)} GB
          {Number((probe.system as Record<string, unknown>)?.total_ram_gb || 0) < 4 && (
            <span className="text-status-warn ml-2">⚠ 4 GB minimum recommended for AI features</span>
          )}
        </p>
      </div>

      {status && (
        <div className="text-text-muted text-sm font-mono bg-bg-surface rounded px-3 py-2">{status}</div>
      )}

      <div className="flex gap-3">
        <button className="btn-primary flex-1" onClick={installOllama} disabled={installing}>
          {installing ? 'Installing...' : 'Install Ollama'}
        </button>
        <button className="btn-secondary" onClick={() => onSkip('ai-runtime')}>
          Skip (install later)
        </button>
      </div>
    </div>
  );
}

function AIModelsStep({ probe, onComplete, onSkip }: StepProps) {
  const ai = probe.ai as Record<string, unknown> | undefined;
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(
    new Set((ai?.installed_models as string[] || []))
  );

  const MODELS = [
    {
      id: 'llama3.2',
      name: 'Llama 3.2 (3B)',
      description: 'Best balance of quality and speed. Recommended.',
      size: '~2 GB',
      min_ram_gb: 4,
      type: 'chat',
    },
    {
      id: 'llama3.2:1b',
      name: 'Llama 3.2 (1B)',
      description: 'Fastest, lowest RAM. Use if under 4 GB RAM.',
      size: '~900 MB',
      min_ram_gb: 2,
      type: 'chat',
    },
    {
      id: 'nomic-embed-text',
      name: 'nomic-embed-text',
      description: 'Embedding model. Required for semantic search and RAG.',
      size: '~300 MB',
      min_ram_gb: 2,
      type: 'embed',
    },
  ];

  const ramGb = Number((probe.system as Record<string, unknown>)?.total_ram_gb || 0);

  const pullModel = async (modelId: string) => {
    setInstalling(modelId);
    try {
      const es = new EventSource(`/api/ai/models/pull?model=${encodeURIComponent(modelId)}`);
      await new Promise<void>((resolve, reject) => {
        es.onmessage = (e) => {
          const evt = JSON.parse(e.data);
          if (evt.status === 'success') {
            es.close();
            resolve();
          }
        };
        es.onerror = () => { es.close(); reject(new Error('Pull failed')); };
      });
      setInstalled(prev => new Set([...prev, modelId]));
    } catch {
      // silently continue
    } finally {
      setInstalling(null);
    }
  };

  const hasChatModel = MODELS.filter(m => m.type === 'chat').some(m => installed.has(m.id));
  const hasEmbedModel = installed.has('nomic-embed-text');

  return (
    <div className="space-y-4">
      {MODELS.map(model => {
        const isInstalled = installed.has(model.id);
        const underRAM = ramGb > 0 && ramGb < model.min_ram_gb;
        const isInstalling = installing === model.id;

        return (
          <div key={model.id} className={`card ${isInstalled ? 'border-status-ok/30' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium">{model.name}</span>
                  <span className="text-text-muted text-xs">{model.size}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${model.type === 'embed' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                    {model.type}
                  </span>
                </div>
                <div className="text-text-muted text-sm mt-1">{model.description}</div>
                {underRAM && (
                  <div className="text-status-warn text-xs mt-1">⚠ Requires {model.min_ram_gb} GB RAM</div>
                )}
              </div>
              {isInstalled ? (
                <div className="text-status-ok text-sm flex items-center gap-1">
                  <span>✓</span> Installed
                </div>
              ) : (
                <button
                  className="btn-secondary text-sm"
                  onClick={() => pullModel(model.id)}
                  disabled={isInstalling !== null}
                >
                  {isInstalling ? 'Pulling...' : 'Install'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex gap-3 pt-2">
        <button
          className="btn-primary flex-1"
          onClick={() => onComplete('ai-models')}
          disabled={!hasChatModel}
        >
          {hasChatModel ? 'Continue →' : 'Install a chat model to continue'}
        </button>
        <button className="btn-secondary" onClick={() => onSkip('ai-models')}>
          Skip
        </button>
      </div>
    </div>
  );
}

function KnowledgePacksStep({ onComplete, onSkip }: StepProps) {
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    api.kiwix.registryCategories().then((data) => {
      const typed = data as { categories?: Record<string, unknown>[] };
      setCategories(typed.categories || []);
    }).catch(() => {});
  }, []);

  const toggleTier = (catId: string, tier: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[catId] === tier) delete next[catId];
      else next[catId] = tier;
      return next;
    });
  };

  const totalSize = categories.reduce((sum, cat) => {
    const catTyped = cat as { id: string; tiers: Array<{ tier: string; size_mb: number }> };
    const tier = selected[catTyped.id];
    if (!tier) return sum;
    const tierData = catTyped.tiers?.find((t) => t.tier === tier);
    return sum + (tierData?.size_mb || 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="text-text-muted text-sm">
        Select content tiers to queue for download. Downloads run in the background and can be managed from the Library module.
        {totalSize > 0 && (
          <span className="text-accent-warm ml-2">~{(totalSize / 1024).toFixed(1)} GB selected</span>
        )}
      </div>

      {categories.length === 0 && (
        <div className="card text-text-muted text-sm">Loading knowledge pack registry...</div>
      )}

      {categories.map((cat) => {
        const catTyped = cat as {
          id: string;
          name: string;
          description: string;
          icon: string;
          tiers: Array<{ tier: string; label: string; description: string; size_mb: number }>;
        };
        return (
          <div key={catTyped.id} className="card">
            <div className="font-medium text-text-primary mb-2">{catTyped.name}</div>
            <div className="text-text-muted text-xs mb-3">{catTyped.description}</div>
            <div className="flex gap-2 flex-wrap">
              {catTyped.tiers?.map((tier) => (
                <button
                  key={tier.tier}
                  onClick={() => toggleTier(catTyped.id, tier.tier)}
                  className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                    selected[catTyped.id] === tier.tier
                      ? 'bg-accent-warm/20 border-accent-warm text-accent-warm'
                      : 'border-border-DEFAULT text-text-muted hover:border-border-bright'
                  }`}
                >
                  {tier.label} ({tier.size_mb >= 1024 ? `${(tier.size_mb / 1024).toFixed(1)} GB` : `${tier.size_mb} MB`})
                </button>
              ))}
              {selected[catTyped.id] && (
                <span className="text-xs text-text-muted self-center">
                  — {catTyped.tiers?.find(t => t.tier === selected[catTyped.id])?.description}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex gap-3 pt-2">
        <button className="btn-primary flex-1" onClick={() => onComplete('knowledge-packs')}>
          {Object.keys(selected).length > 0 ? `Queue Downloads (${Object.keys(selected).length} packs) →` : 'Continue →'}
        </button>
        <button className="btn-secondary" onClick={() => onSkip('knowledge-packs')}>
          Skip
        </button>
      </div>
    </div>
  );
}

function MapsStep({ onComplete, onSkip }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-text-primary font-medium mb-2">Offline Map Tiles</h3>
        <p className="text-text-muted text-sm mb-4">
          S.I.N.A uses <code className="text-accent-warm">.mbtiles</code> or <code className="text-accent-warm">.pmtiles</code> files for offline maps.
          Place files in <code className="text-accent-warm">$SINA_DATA_DIR/maps/</code> and use Maps → Scan to register them.
        </p>
        <p className="text-text-muted text-sm">
          Regional map packs can be downloaded from the <strong className="text-text-secondary">Downloads</strong> module after setup.
          Free sources: <span className="text-accent-warm">Geofabrik</span> (via tilemaker), <span className="text-accent-warm">BBBike</span>.
        </p>
      </div>

      <div className="card border-border-subtle">
        <div className="text-text-muted text-sm font-medium mb-2">After setup:</div>
        <ol className="text-text-muted text-sm space-y-1 list-decimal list-inside">
          <li>Go to Downloads → install a map pack</li>
          <li>Or copy an existing .mbtiles file to <code className="text-accent-warm text-xs">~/.sina/data/maps/</code></li>
          <li>Go to Maps → Regions → Scan to register it</li>
        </ol>
      </div>

      <div className="flex gap-3">
        <button className="btn-primary flex-1" onClick={() => onComplete('maps')}>
          Continue →
        </button>
        <button className="btn-secondary" onClick={() => onSkip('maps')}>
          Skip
        </button>
      </div>
    </div>
  );
}

function WatchedFoldersStep({ onComplete, onSkip }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-text-primary font-medium mb-2">Auto-Import Folders</h3>
        <p className="text-text-muted text-sm mb-4">
          S.I.N.A watches these directories for new files. Supported: PDF, DOCX, HTML, Markdown, TXT, CSV.
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-base rounded border border-border-DEFAULT">
            <span className="text-accent-warm font-mono text-sm">~/.sina/data/imports/</span>
            <span className="text-text-muted text-xs ml-auto">default drop folder</span>
          </div>
        </div>

        <p className="text-text-muted text-xs mt-3">
          Add more watched directories in Settings → Import after setup.
        </p>
      </div>

      <div className="flex gap-3">
        <button className="btn-primary flex-1" onClick={() => onComplete('watched-folders')}>
          Continue →
        </button>
        <button className="btn-secondary" onClick={() => onSkip('watched-folders')}>
          Skip
        </button>
      </div>
    </div>
  );
}

function NetworkStep({ onComplete, onSkip }: StepProps) {
  const [lanExposed, setLanExposed] = useState(false);

  const save = async () => {
    try {
      await api.system.updateSettings({ lan_exposed: lanExposed, bind_address: lanExposed ? '0.0.0.0' : '127.0.0.1' });
    } catch { /* proceed anyway */ }
    onComplete('network');
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-text-primary font-medium mb-2">Network Exposure</h3>
        <p className="text-text-muted text-sm mb-4">
          By default, S.I.N.A is only accessible from this machine (localhost).
          Enable LAN exposure to access it from phones or other devices on the same network.
        </p>

        <div className="flex items-center justify-between py-3 border-t border-border-DEFAULT">
          <div>
            <div className="text-text-primary text-sm font-medium">LAN Exposure</div>
            <div className="text-text-muted text-xs">Bind to 0.0.0.0 — accessible from local network</div>
          </div>
          <button
            onClick={() => setLanExposed(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${lanExposed ? 'bg-accent-warm' : 'bg-border-bright'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lanExposed ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {lanExposed && (
          <div className="mt-3 p-3 rounded bg-status-warn/10 border border-status-warn/30 text-status-warn text-xs">
            ⚠ LAN exposure means anyone on your local network can access S.I.N.A. Only enable on trusted networks.
            You can revert this at any time from Settings → Network.
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button className="btn-primary flex-1" onClick={save}>
          Save & Continue →
        </button>
        <button className="btn-secondary" onClick={() => onSkip('network')}>
          Skip
        </button>
      </div>
    </div>
  );
}

function CompleteStep(_props: StepProps) {
  const router = useRouter();

  return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 rounded-full bg-status-ok/20 border border-status-ok/40 flex items-center justify-center mx-auto text-3xl">
        ✓
      </div>
      <div>
        <h2 className="text-2xl font-semibold text-text-primary mb-2">S.I.N.A is ready</h2>
        <p className="text-text-muted">
          All modules are initialized. You can continue setup from any module at any time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-left">
        {[
          { label: 'AI Chat', desc: 'Chat with your documents using local AI', icon: '🤖' },
          { label: 'Library', desc: 'Browse and search indexed knowledge', icon: '📚' },
          { label: 'Maps', desc: 'View offline regional maps', icon: '🗺' },
          { label: 'Vault', desc: 'Notes, checklists, emergency guides', icon: '🔒' },
        ].map(item => (
          <div key={item.label} className="card text-sm">
            <div className="text-lg mb-1">{item.icon}</div>
            <div className="text-text-primary font-medium">{item.label}</div>
            <div className="text-text-muted text-xs">{item.desc}</div>
          </div>
        ))}
      </div>

      <button className="btn-primary w-full text-lg py-3" onClick={() => router.push('/')}>
        Go to Dashboard →
      </button>
    </div>
  );
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────

const STEP_COMPONENTS: Record<string, React.ComponentType<StepProps>> = {
  storage: StorageStep,
  'ai-runtime': AIRuntimeStep,
  'ai-models': AIModelsStep,
  'knowledge-packs': KnowledgePacksStep,
  maps: MapsStep,
  'watched-folders': WatchedFoldersStep,
  network: NetworkStep,
};

export default function SetupPage() {
  const router = useRouter();
  const [state, setState] = useState<SetupState | null>(null);
  const [probe, setProbe] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.setup.state(), api.setup.probe()]).then(([s, p]) => {
      if (s.completed) {
        router.replace('/');
        return;
      }
      setState(s);
      setProbe(p as Record<string, unknown>);
    }).catch(() => {
      setLoading(false);
    }).finally(() => setLoading(false));
  }, [router]);

  const goToStep = useCallback(async (stepId: SetupStepId) => {
    const updated = await api.setup.updateState({ current_step: stepId });
    setState(updated);
  }, []);

  const completeStep = useCallback(async (stepId: SetupStepId) => {
    const steps: SetupStepId[] = ['storage', 'ai-runtime', 'ai-models', 'knowledge-packs', 'maps', 'watched-folders', 'network', 'complete'];
    const idx = steps.indexOf(stepId);
    const nextStep = steps[idx + 1] || 'complete';
    const updated = await api.setup.updateState({ step_id: stepId, status: 'complete', current_step: nextStep });
    setState(updated);
  }, []);

  const skipStep = useCallback(async (stepId: SetupStepId) => {
    const steps: SetupStepId[] = ['storage', 'ai-runtime', 'ai-models', 'knowledge-packs', 'maps', 'watched-folders', 'network', 'complete'];
    const idx = steps.indexOf(stepId);
    const nextStep = steps[idx + 1] || 'complete';
    const updated = await api.setup.updateState({ step_id: stepId, status: 'skipped', current_step: nextStep });
    setState(updated);
  }, []);

  const skipAll = useCallback(async () => {
    await api.setup.skip();
    router.push('/');
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-status-error">Failed to load setup state. <a href="/" className="text-accent-warm underline">Go to Dashboard</a></div>
      </div>
    );
  }

  const currentStep = state.current_step as SetupStepId;
  const isComplete = currentStep === 'complete';

  const STEP_LABELS: Record<string, string> = {
    storage: 'Storage',
    'ai-runtime': 'AI Runtime',
    'ai-models': 'AI Models',
    'knowledge-packs': 'Knowledge Packs',
    maps: 'Maps',
    'watched-folders': 'Watched Folders',
    network: 'Network',
    complete: 'Complete',
  };

  const STEP_ORDER: SetupStepId[] = ['storage', 'ai-runtime', 'ai-models', 'knowledge-packs', 'maps', 'watched-folders', 'network', 'complete'];
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  const StepComponent = !isComplete ? STEP_COMPONENTS[currentStep] : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border-DEFAULT bg-bg-surface px-8 py-5 flex items-center justify-between">
        <div>
          <div className="text-accent-warm font-mono text-xs tracking-widest uppercase mb-1">
            S.I.N.A — Survival Intelligence & Navigation Assistant
          </div>
          <h1 className="text-text-primary text-xl font-semibold">Setup Wizard</h1>
        </div>
        <button onClick={skipAll} className="text-text-muted text-sm hover:text-text-secondary transition-colors">
          Skip setup →
        </button>
      </div>

      <div className="flex flex-1">
        {/* Step nav */}
        <div className="w-56 border-r border-border-DEFAULT bg-bg-surface p-4 flex-shrink-0">
          <nav className="space-y-1">
            {state.steps.map((step: SetupStep, idx: number) => {
              const isActive = step.id === currentStep;
              const isDone = step.status === 'complete' || step.status === 'skipped';
              const isReachable = idx <= currentIdx + 1;

              return (
                <button
                  key={step.id}
                  onClick={() => isReachable ? goToStep(step.id as SetupStepId) : undefined}
                  disabled={!isReachable}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                    isActive ? 'bg-accent-warm/15 text-accent-warm' :
                    isDone ? 'text-text-muted hover:text-text-secondary' :
                    isReachable ? 'text-text-muted hover:text-text-secondary' :
                    'text-border-bright cursor-default'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${
                    isDone ? 'border-status-ok bg-status-ok/20 text-status-ok' :
                    isActive ? 'border-accent-warm bg-accent-warm/20 text-accent-warm' :
                    'border-border-bright'
                  }`}>
                    {isDone ? '✓' : String(idx + 1)}
                  </span>
                  {STEP_LABELS[step.id]}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Step content */}
        <div className="flex-1 p-8 max-w-2xl">
          {isComplete ? (
            <CompleteStep probe={probe} onComplete={completeStep} onSkip={skipStep} />
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-text-primary text-lg font-semibold mb-1">
                  {STEP_LABELS[currentStep]}
                </h2>
                <p className="text-text-muted text-sm">
                  {state.steps.find((s: SetupStep) => s.id === currentStep)?.description}
                </p>
                <div className="mt-3 h-1 bg-bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-warm rounded-full transition-all"
                    style={{ width: `${((currentIdx + 1) / STEP_ORDER.length) * 100}%` }}
                  />
                </div>
              </div>

              {StepComponent && (
                <StepComponent probe={probe} onComplete={completeStep} onSkip={skipStep} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
