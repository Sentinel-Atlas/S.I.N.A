// S.I.N.A Update Manager
// Checks for updates to app registries, AI models, map regions, and content packs.
// All checks are advisory — the user approves and triggers updates from the dashboard.

import fs from 'fs';
import { config } from '../config';
import { getDb } from '../db';
import { listModels } from './ollamaAdapter';
import { listZimFiles } from './kiwixManager';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateRecord {
  id: string;
  component_type: string;
  component_id: string;
  name: string;
  current_version: string | null;
  latest_version: string | null;
  size_bytes: number | null;
  changelog: string | null;
  critical: boolean;
  checked_at: string;
}

interface CheckResult {
  checked_at: string;
  updates_available: UpdateRecord[];
  up_to_date: string[];
  errors: string[];
}

// ─── Registry freshness check ─────────────────────────────────────────────────

function getRegistryMtime(registryPath: string): Date | null {
  try {
    return fs.statSync(registryPath).mtime;
  } catch {
    return null;
  }
}

function isRegistryStale(registryPath: string, maxAgeHours = 168): boolean {
  const mtime = getRegistryMtime(registryPath);
  if (!mtime) return true;
  const ageMs = Date.now() - mtime.getTime();
  return ageMs > maxAgeHours * 3_600_000;
}

// ─── Model update checks ──────────────────────────────────────────────────────

async function checkModelUpdates(): Promise<{ updates: UpdateRecord[]; upToDate: string[]; errors: string[] }> {
  const updates: UpdateRecord[] = [];
  const upToDate: string[] = [];
  const errors: string[] = [];

  try {
    const registryPath = config.registry.modelsPath;
    if (!fs.existsSync(registryPath)) {
      errors.push('models.json registry not found');
      return { updates, upToDate, errors };
    }

    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as {
      models: Array<{ id: string; name: string; version?: string; recommended?: boolean }>;
    };

    const installedModels = await listModels();
    const installedIds = new Set(installedModels.map(m => m.id));

    // Check if any recommended models are not installed
    for (const regModel of registry.models) {
      if (regModel.recommended && !installedIds.has(regModel.id)) {
        updates.push({
          id: `model-${regModel.id}`,
          component_type: 'ollama-model',
          component_id: regModel.id,
          name: regModel.name,
          current_version: null,
          latest_version: regModel.version || 'latest',
          size_bytes: null,
          changelog: 'Recommended model not yet installed',
          critical: false,
          checked_at: new Date().toISOString(),
        });
      } else if (installedIds.has(regModel.id)) {
        upToDate.push(regModel.name);
      }
    }
  } catch (err: unknown) {
    errors.push(`Model check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { updates, upToDate, errors };
}

// ─── Registry staleness check ─────────────────────────────────────────────────

function checkRegistryStaleness(): { updates: UpdateRecord[]; upToDate: string[]; errors: string[] } {
  const updates: UpdateRecord[] = [];
  const upToDate: string[] = [];
  const errors: string[] = [];

  const registries = [
    { id: 'catalog', name: 'Content Catalog', path: config.registry.catalogPath },
    { id: 'models', name: 'AI Models Registry', path: config.registry.modelsPath },
    { id: 'maps', name: 'Maps Registry', path: config.registry.mapsPath },
    { id: 'kiwix-categories', name: 'Knowledge Pack Registry', path: config.registry.kiwixCategoriesPath },
    { id: 'wikipedia', name: 'Wikipedia Registry', path: config.registry.wikipediaPath },
  ];

  for (const reg of registries) {
    if (isRegistryStale(reg.path, 168)) {
      updates.push({
        id: `registry-${reg.id}`,
        component_type: 'registry',
        component_id: reg.id,
        name: reg.name,
        current_version: null,
        latest_version: null,
        size_bytes: null,
        changelog: 'Registry data is more than 7 days old. Pull latest from git.',
        critical: false,
        checked_at: new Date().toISOString(),
      });
    } else {
      upToDate.push(reg.name);
    }
  }

  return { updates, upToDate, errors };
}

// ─── ZIM file version check ───────────────────────────────────────────────────

function checkZimUpdates(): { updates: UpdateRecord[]; upToDate: string[]; errors: string[] } {
  const updates: UpdateRecord[] = [];
  const upToDate: string[] = [];
  const errors: string[] = [];

  try {
    const installed = listZimFiles().filter(f => f.installed);

    // ZIM files encode their date in the filename (e.g. wikipedia_en_2024-01.zim)
    // Check if any are more than 6 months old
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const zim of installed) {
      const dateMatch = zim.name.match(/(\d{4}-\d{2})/);
      if (dateMatch) {
        const zimDate = new Date(dateMatch[1] + '-01');
        if (zimDate < sixMonthsAgo) {
          updates.push({
            id: `zim-${zim.id}`,
            component_type: 'kiwix-zim',
            component_id: zim.id,
            name: zim.title,
            current_version: dateMatch[1],
            latest_version: null,
            size_bytes: null,
            changelog: `This ZIM file is from ${dateMatch[1]}. A newer version may be available from Kiwix.`,
            critical: false,
            checked_at: new Date().toISOString(),
          });
        } else {
          upToDate.push(zim.title);
        }
      } else {
        upToDate.push(zim.title);
      }
    }
  } catch (err: unknown) {
    errors.push(`ZIM check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { updates, upToDate, errors };
}

// ─── App update check ─────────────────────────────────────────────────────────

function checkAppUpdate(): { updates: UpdateRecord[]; upToDate: string[]; errors: string[] } {
  const updates: UpdateRecord[] = [];
  const upToDate: string[] = [];
  const errors: string[] = [];

  try {
    const pkgPath = require.resolve('../../../package.json').replace(/node_modules.*/, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version: string };
    // In a full implementation, this would check a remote endpoint.
    // For now, we report the current version.
    upToDate.push(`S.I.N.A v${pkg.version}`);
  } catch {
    errors.push('Could not determine app version');
  }

  return { updates, upToDate, errors };
}

// ─── Main check ───────────────────────────────────────────────────────────────

export async function checkForUpdates(): Promise<CheckResult> {
  const allUpdates: UpdateRecord[] = [];
  const allUpToDate: string[] = [];
  const allErrors: string[] = [];

  const [modelResult, registryResult, zimResult, appResult] = await Promise.all([
    checkModelUpdates(),
    Promise.resolve(checkRegistryStaleness()),
    Promise.resolve(checkZimUpdates()),
    Promise.resolve(checkAppUpdate()),
  ]);

  for (const result of [modelResult, registryResult, zimResult, appResult]) {
    allUpdates.push(...result.updates);
    allUpToDate.push(...result.upToDate);
    allErrors.push(...result.errors);
  }

  // Persist to db for history
  const db = getDb();
  const checkedAt = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  upsert.run('last_update_check', checkedAt);
  upsert.run('last_update_result', JSON.stringify({
    checked_at: checkedAt,
    update_count: allUpdates.length,
    error_count: allErrors.length,
  }));

  return {
    checked_at: checkedAt,
    updates_available: allUpdates,
    up_to_date: allUpToDate,
    errors: allErrors,
  };
}

export function getLastUpdateCheck(): { checked_at: string | null; update_count: number | null } {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'last_update_result'`).get() as
    { value: string } | undefined;
  if (!row) return { checked_at: null, update_count: null };
  try {
    const parsed = JSON.parse(row.value);
    return { checked_at: parsed.checked_at, update_count: parsed.update_count };
  } catch {
    return { checked_at: null, update_count: null };
  }
}
