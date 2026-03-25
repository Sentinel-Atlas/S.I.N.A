import { Router } from 'express';
import { search } from '../services/searchService';
import type { SearchScope, ContentCategory } from '@sina/shared';

const router = Router();

router.get('/', async (req, res) => {
  const { q, scope = 'all', category, limit = '20', semantic = 'false' } = req.query as Record<string, string>;
  if (!q?.trim()) return res.json({ success: true, data: [] });

  try {
    const results = await search({
      q,
      scope: scope as SearchScope,
      category: category as ContentCategory | undefined,
      limit: parseInt(limit, 10),
      semantic: semantic === 'true',
    });
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;
