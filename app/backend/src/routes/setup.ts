// S.I.N.A — /api/setup
// First-run setup wizard state management

import { Router, Request, Response } from 'express';
import os from 'os';
import fs from 'fs';
import { getDb } from '../db';
import { config } from '../config';
import { checkOllamaAvailable, listModels } from '../services/ollamaAdapter';
import { getKiwixStatus } from '../services/kiwixManager';
import { detectRuntimePlatform } from '../services/platform';

const router = Router();

// ─── Setup step definitions ───────────────────────────────────────────────────

const DEFAULT_STEPS = [
  {
    id: 'storage',
    title: 'Storage',
    description: 'Confirm where S.I.N.A stores all data',
    status: 'pending',
    required: true,
  },
  {
    id: 'ai-runtime',
    title: 'AI Runtime',
    description: 'Install and configure Ollama for local AI',
    status: 'pending',
    required: false,
  },
  {
    id: 'ai-models',
    title: 'AI Models',
    description: 'Install recommended chat and embedding models',
    status: 'pending',
    required: false,
  },
  {
    id: 'knowledge-packs',
    title: 'Knowledge Packs',
    description: 'Download offline Wikipedia and reference content',
    status: 'pending',
    required: false,
  },
  {
    id: 'maps',
    title: 'Offline Maps',
    description: 'Select regional map packs to download',
    status: 'pending',
    required: false,
  },
  {
    id: 'watched-folders',
    title: 'Watched Folders',
    description: 'Set up auto-import directories',
    status: 'pending',
    required: false,
  },
  {
    id: 'network',
    title: 'Network',
    description: 'Configure LAN exposure settings',
    status: 'pending',
    required: false,
  },
  {
    id: 'complete',
    title: 'Complete',
    description: 'Setup complete — go to Dashboard',
    status: 'pending',
    required: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSetupState() {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM setup_state WHERE id = 'singleton'`).get() as
    Record<string, unknown> | undefined;

  if (!row) {
    // Initialize on first access
    const initialSteps = JSON.stringify(DEFAULT_STEPS);
    db.prepare(`
      INSERT INTO setup_state (id, completed, current_step, steps)
      VALUES ('singleton', 0, 'storage', ?)
    `).run(initialSteps);

    return {
      completed: false,
      current_step: 'storage',
      steps: DEFAULT_STEPS,
      started_at: new Date().toISOString(),
      completed_at: null,
    };
  }

  return {
    completed: Boolean(row.completed),
    current_step: row.current_step,
    steps: JSON.parse(row.steps as string || '[]'),
    started_at: row.started_at,
    completed_at: row.completed_at || null,
  };
}

function saveSetupState(state: { completed: boolean; current_step: string; steps: unknown[]; completed_at?: string | null }) {
  const db = getDb();
  db.prepare(`
    UPDATE setup_state SET
      completed = ?,
      current_step = ?,
      steps = ?,
      completed_at = ?
    WHERE id = 'singleton'
  `).run(
    state.completed ? 1 : 0,
    state.current_step,
    JSON.stringify(state.steps),
    state.completed_at || null
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/setup/state
router.get('/state', (_req: Request, res: Response) => {
  try {
    const state = getSetupState();
    res.json({ success: true, data: state });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to get setup state' });
  }
});

// PATCH /api/setup/state
// Update step status and current step
router.patch('/state', (req: Request, res: Response) => {
  try {
    const { step_id, status, current_step } = req.body;
    const state = getSetupState();

    if (step_id) {
      const stepIndex = (state.steps as Array<{ id: string; status: string }>).findIndex(s => s.id === step_id);
      if (stepIndex !== -1) {
        (state.steps as Array<{ id: string; status: string }>)[stepIndex].status = status || 'complete';
      }
    }

    if (current_step) {
      state.current_step = current_step;
    }

    // Check if all required steps are complete
    const requiredSteps = DEFAULT_STEPS.filter(s => s.required).map(s => s.id);
    const completedSteps = new Set(
      (state.steps as Array<{ id: string; status: string }>)
        .filter(s => s.status === 'complete' || s.status === 'skipped')
        .map(s => s.id)
    );
    const allRequiredDone = requiredSteps.every(id => completedSteps.has(id));

    if (current_step === 'complete' || allRequiredDone) {
      state.completed = true;
      state.completed_at = new Date().toISOString();
    }

    saveSetupState(state);
    res.json({ success: true, data: state });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to update setup state' });
  }
});

// POST /api/setup/skip
// Skip setup entirely (for experienced users)
router.post('/skip', (_req: Request, res: Response) => {
  try {
    const state = getSetupState();
    state.completed = true;
    state.current_step = 'complete';
    state.completed_at = new Date().toISOString();
    (state.steps as Array<{ status: string }>).forEach(s => {
      if (s.status === 'pending') s.status = 'skipped';
    });
    saveSetupState(state);
    res.json({ success: true, message: 'Setup skipped', data: state });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to skip setup' });
  }
});

// POST /api/setup/reset
// Reset setup wizard (for re-running setup)
router.post('/reset', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const resetSteps = DEFAULT_STEPS.map(s => ({ ...s, status: 'pending' }));
    db.prepare(`
      UPDATE setup_state SET
        completed = 0,
        current_step = 'storage',
        steps = ?,
        completed_at = NULL
      WHERE id = 'singleton'
    `).run(JSON.stringify(resetSteps));
    res.json({ success: true, message: 'Setup wizard reset' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to reset setup' });
  }
});

// GET /api/setup/probe
// Probe system state for setup wizard pre-fill
router.get('/probe', async (_req: Request, res: Response) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuCount = os.cpus().length;

    const runtimePlatform = detectRuntimePlatform();

    // Check AI runtime
    const ollamaAvailable = await checkOllamaAvailable();
    const installedModels = ollamaAvailable ? await listModels() : [];

    // Check storage
    const dataDir = config.paths.dataDir;
    const dataDirExists = fs.existsSync(dataDir);

    // Check Kiwix
    const kiwixStatus = await getKiwixStatus();

    // RAM-based model recommendation
    const ramGb = Math.round(totalMem / (1024 ** 3));
    let recommendedModel = 'llama3.2:1b';
    if (ramGb >= 16) recommendedModel = 'llama3.1:8b';
    else if (ramGb >= 8) recommendedModel = 'llama3.2';
    else if (ramGb >= 4) recommendedModel = 'llama3.2:1b';

    res.json({
      success: true,
      data: {
        system: {
          total_ram_bytes: totalMem,
          free_ram_bytes: freeMem,
          total_ram_gb: ramGb,
          cpu_count: cpuCount,
          platform: process.platform,
          runtime_platform: runtimePlatform,
        },
        storage: {
          data_dir: dataDir,
          data_dir_exists: dataDirExists,
        },
        ai: {
          ollama_available: ollamaAvailable,
          installed_models: installedModels.map(m => m.id),
          recommended_model: recommendedModel,
          has_chat_model: installedModels.some(m => !m.id.includes('embed')),
          has_embed_model: installedModels.some(m => m.id.includes('embed') || m.id.includes('nomic')),
        },
        kiwix: {
          kiwix_serve_available: kiwixStatus.kiwix_serve_available,
          zim_count: kiwixStatus.zim_count,
        },
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Probe failed' });
  }
});

export default router;
