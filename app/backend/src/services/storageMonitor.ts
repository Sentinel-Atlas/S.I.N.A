import fs from 'fs';
import path from 'path';
import { config } from '../config';
import type { StorageState } from '@sina/shared';

function getDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += getDirSize(full);
      } else if (entry.isFile()) {
        try { total += fs.statSync(full).size; } catch { /* skip */ }
      }
    }
  } catch { /* skip unreadable dirs */ }
  return total;
}

export function getStorageState(): StorageState {
  const dataDir = config.paths.dataDir;

  // Get disk stats for the data directory partition
  let total = 0, free = 0;
  try {
    const { execSync } = require('child_process');
    const dfOut = execSync(`df -B1 "${dataDir}" 2>/dev/null | tail -1`, { encoding: 'utf8' });
    const parts = dfOut.trim().split(/\s+/);
    if (parts.length >= 4) {
      total = parseInt(parts[1], 10) || 0;
      free = parseInt(parts[3], 10) || 0;
    }
  } catch { /* best-effort */ }

  const models = getDirSize(config.paths.models);
  const maps = getDirSize(config.paths.maps);
  const knowledge = getDirSize(config.paths.knowledge);
  const indexes = getDirSize(config.paths.indexes);
  const vault = getDirSize(config.paths.vault);
  const cache = getDirSize(config.paths.cache);
  const downloads = getDirSize(config.paths.downloads);

  const used = models + maps + knowledge + indexes + vault + cache + downloads;

  return {
    total_bytes: total,
    used_bytes: used,
    free_bytes: total > 0 ? free : 0,
    data_dir: dataDir,
    breakdown: { models, maps, knowledge, indexes, vault, cache, downloads },
  };
}
