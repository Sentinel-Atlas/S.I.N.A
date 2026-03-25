import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';

import { config, ensureDataDirs } from './config';
import { initDb } from './db';
import { startWatchers } from './services/fileWatcher';

import dashboardRoutes from './routes/dashboard';
import aiRoutes from './routes/ai';
import downloadsRoutes from './routes/downloads';
import libraryRoutes from './routes/library';
import mapsRoutes from './routes/maps';
import vaultRoutes from './routes/vault';
import searchRoutes from './routes/search';
import systemRoutes from './routes/system';
import kiwixRoutes from './routes/kiwix';
import updatesRoutes from './routes/updates';
import setupRoutes from './routes/setup';

async function main() {
  // ── Bootstrap ───────────────────────────────────────────────────────────────
  ensureDataDirs();
  initDb();
  console.log(`[S.I.N.A] Data directory: ${config.paths.dataDir}`);

  // ── Express ─────────────────────────────────────────────────────────────────
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false, // Allow loading local resources
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({
    origin: [
      `http://localhost:${config.server.frontendPort}`,
      `http://127.0.0.1:${config.server.frontendPort}`,
      `http://localhost:${config.server.port}`,
      `http://127.0.0.1:${config.server.port}`,
    ],
    credentials: true,
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (config.isDev) {
    app.use(morgan('dev'));
  }

  // ── API Routes ──────────────────────────────────────────────────────────────
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/downloads', downloadsRoutes);
  app.use('/api/library', libraryRoutes);
  app.use('/api/maps', mapsRoutes);
  app.use('/api/vault', vaultRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/kiwix', kiwixRoutes);
  app.use('/api/updates', updatesRoutes);
  app.use('/api/setup', setupRoutes);

  // ── Serve frontend static files (production) ────────────────────────────────
  const frontendDist = path.resolve(__dirname, '../../frontend/.next');
  if (!config.isDev && fs.existsSync(frontendDist)) {
    app.use(express.static(path.resolve(__dirname, '../../frontend/public')));
    // Next.js static export — serve from 'out' if available
    const outDir = path.resolve(__dirname, '../../frontend/out');
    if (fs.existsSync(outDir)) {
      app.use(express.static(outDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(outDir, 'index.html'));
      });
    }
  }

  // ── Global Error Handler ───────────────────────────────────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Error]', err.message);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  });

  // ── Start ───────────────────────────────────────────────────────────────────
  const { port, bindAddress } = config.server;
  app.listen(port, bindAddress, () => {
    console.log(`\n┌─────────────────────────────────────────┐`);
    console.log(`│  S.I.N.A Command Center — Backend       │`);
    console.log(`│  http://${bindAddress}:${port}${' '.repeat(Math.max(0, 24 - bindAddress.length - String(port).length))}│`);
    console.log(`│  Data: ${config.paths.dataDir.slice(0, 32).padEnd(32)} │`);
    console.log(`└─────────────────────────────────────────┘\n`);
  });

  // ── File Watchers ───────────────────────────────────────────────────────────
  startWatchers();

  // ── Graceful Shutdown ───────────────────────────────────────────────────────
  process.on('SIGTERM', () => {
    console.log('[S.I.N.A] Shutting down...');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    console.log('[S.I.N.A] Shutting down...');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[S.I.N.A] Fatal startup error:', err);
  process.exit(1);
});
