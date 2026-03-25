// S.I.N.A — /api/updates
// Update manager endpoints

import { Router, Request, Response } from 'express';
import { checkForUpdates, getLastUpdateCheck } from '../services/updateManager';

const router = Router();

// GET /api/updates/status
// Returns last check time and summary
router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = getLastUpdateCheck();
    res.json({ success: true, data: status });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to get update status' });
  }
});

// POST /api/updates/check
// Triggers a fresh update check across all components
router.post('/check', async (_req: Request, res: Response) => {
  try {
    const result = await checkForUpdates();
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Update check failed' });
  }
});

export default router;
