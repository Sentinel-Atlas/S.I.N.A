import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const DEFAULT_DATA_DIR = path.join(process.env.HOME || '/opt/sina', '.sina', 'data');

export const config = {
  env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  server: {
    port: parseInt(process.env.BACKEND_PORT || '3001', 10),
    bindAddress: process.env.BIND_ADDRESS || '127.0.0.1',
    frontendPort: parseInt(process.env.FRONTEND_PORT || '3000', 10),
  },

  paths: {
    dataDir: process.env.SINA_DATA_DIR || DEFAULT_DATA_DIR,
    get config()    { return path.join(config.paths.dataDir, 'config'); },
    get db()        { return path.join(config.paths.dataDir, 'db'); },
    get logs()      { return path.join(config.paths.dataDir, 'logs'); },
    get cache()     { return path.join(config.paths.dataDir, 'cache'); },
    get downloads() { return path.join(config.paths.dataDir, 'downloads'); },
    get imports()   { return path.join(config.paths.dataDir, 'imports'); },
    get processed() { return path.join(config.paths.dataDir, 'processed'); },
    get indexes()   { return path.join(config.paths.dataDir, 'indexes'); },
    get models()    { return path.join(config.paths.dataDir, 'models'); },
    get maps()      { return path.join(config.paths.dataDir, 'maps'); },
    get knowledge() { return path.join(config.paths.dataDir, 'knowledge'); },
    get vault()     { return path.join(config.paths.dataDir, 'vault'); },
    get tools()     { return path.join(config.paths.dataDir, 'tools'); },
    get backups()   { return path.join(config.paths.dataDir, 'backups'); },
    get kiwix()     { return path.join(config.paths.dataDir, 'kiwix'); },
    get dbFile()    { return path.join(config.paths.dataDir, 'db', 'sina.db'); },
  },

  ai: {
    ollamaHost: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2',
    embedModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  },

  maps: {
    tileServerUrl: process.env.TILE_SERVER_URL || 'http://127.0.0.1:8080',
  },

  downloads: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '2', 10),
  },

  indexing: {
    chunkSize: parseInt(process.env.CHUNK_SIZE || '512', 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '64', 10),
  },

  registry: {
    catalogPath:         path.resolve(process.cwd(), '../../registry/catalog.json'),
    modelsPath:          path.resolve(process.cwd(), '../../registry/models.json'),
    mapsPath:            path.resolve(process.cwd(), '../../registry/maps.json'),
    toolsPath:           path.resolve(process.cwd(), '../../registry/tools.json'),
    kiwixCategoriesPath: path.resolve(process.cwd(), '../../registry/kiwix-categories.json'),
    wikipediaPath:       path.resolve(process.cwd(), '../../registry/wikipedia.json'),
  },
} as const;

export function ensureDataDirs(): void {
  const dirs = [
    config.paths.dataDir,
    config.paths.config,
    config.paths.db,
    config.paths.logs,
    config.paths.cache,
    config.paths.downloads,
    config.paths.imports,
    config.paths.processed,
    config.paths.indexes,
    config.paths.models,
    config.paths.maps,
    config.paths.knowledge,
    path.join(config.paths.knowledge, 'medical'),
    path.join(config.paths.knowledge, 'survival'),
    path.join(config.paths.knowledge, 'repair'),
    path.join(config.paths.knowledge, 'wikipedia'),
    path.join(config.paths.knowledge, 'technical'),
    path.join(config.paths.knowledge, 'web-archives'),
    path.join(config.paths.knowledge, 'personal'),
    config.paths.vault,
    config.paths.tools,
    config.paths.backups,
    config.paths.kiwix,
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
