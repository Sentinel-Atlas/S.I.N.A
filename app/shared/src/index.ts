// S.I.N.A Shared Types
// Used by both frontend and backend

// ─── System ───────────────────────────────────────────────────────────────────

export type ModuleStatus = 'ready' | 'degraded' | 'offline' | 'installing' | 'unknown';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  modules: Record<string, ModuleStatus>;
  network: NetworkState;
  storage: StorageState;
  ai: AIState;
  uptime: number;
  version: string;
}

export interface NetworkState {
  lan_exposed: boolean;
  bind_address: string;
  online: boolean;
}

export interface StorageState {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  data_dir: string;
  breakdown: StorageBreakdown;
}

export interface StorageBreakdown {
  models: number;
  maps: number;
  knowledge: number;
  indexes: number;
  vault: number;
  cache: number;
  downloads: number;
}

export interface AIState {
  runtime: 'ollama' | 'none';
  runtime_available: boolean;
  models: AIModel[];
  active_model: string | null;
  embed_model: string | null;
}

// ─── AI / Models ──────────────────────────────────────────────────────────────

export interface AIModel {
  id: string;
  name: string;
  size_bytes: number;
  modified_at: string;
  family?: string;
  parameter_size?: string;
  quantization?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: SourceReference[];
  persona?: string;
  model?: string;
}

export interface SourceReference {
  doc_id: string;
  title: string;
  excerpt: string;
  score: number;
  category?: string;
}

export interface Conversation {
  id: string;
  title: string;
  persona: string;
  model: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export type PersonaId = 'researcher' | 'survival' | 'technical' | 'summarizer' | 'navigator';

export interface Persona {
  id: PersonaId;
  name: string;
  description: string;
  system_prompt: string;
  preferred_categories: string[];
  icon: string;
}

// ─── Downloads ────────────────────────────────────────────────────────────────

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'extracting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadJob {
  id: string;
  name: string;
  url: string;
  destination: string;
  status: DownloadStatus;
  size_bytes: number;
  downloaded_bytes: number;
  progress: number;
  speed_bps: number;
  eta_seconds: number;
  checksum?: string;
  checksum_algo?: 'sha256' | 'md5';
  checksum_verified?: boolean;
  error?: string;
  created_at: string;
  updated_at: string;
  catalog_item_id?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  category: CatalogCategory;
  type: CatalogItemType;
  version?: string;
  size_bytes: number;
  url: string;
  checksum?: string;
  checksum_algo?: string;
  license?: string;
  source?: string;
  tags: string[];
  installed: boolean;
  install_path?: string;
  dependencies?: string[];
  post_install?: string;
}

export type CatalogCategory =
  | 'ai-models'
  | 'maps'
  | 'knowledge'
  | 'tools'
  | 'emergency-packs'
  | 'media';

export type CatalogItemType =
  | 'ollama-model'
  | 'mbtiles'
  | 'wikipedia-pack'
  | 'document-pack'
  | 'tool-binary'
  | 'archive';

// ─── Content / Library ────────────────────────────────────────────────────────

export type ContentCategory =
  | 'medical'
  | 'survival'
  | 'repair'
  | 'maps'
  | 'wikipedia'
  | 'radio-comms'
  | 'emergency'
  | 'family'
  | 'power-offgrid'
  | 'food-water'
  | 'personal'
  | 'technical'
  | 'web-archive'
  | 'uncategorized';

export type ContentStatus = 'pending' | 'parsing' | 'indexing' | 'indexed' | 'failed';

export interface ContentItem {
  id: string;
  title: string;
  file_path: string;
  file_type: string;
  size_bytes: number;
  category: ContentCategory;
  tags: string[];
  source?: string;
  status: ContentStatus;
  error?: string;
  imported_at: string;
  indexed_at?: string;
  checksum?: string;
  collection_id?: string;
  chunk_count?: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  category: ContentCategory;
  item_count: number;
  created_at: string;
  color?: string;
  icon?: string;
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

export interface MapRegion {
  id: string;
  name: string;
  area: string;
  file_path: string;
  size_bytes: number;
  installed: boolean;
  tile_format: 'mbtiles' | 'pmtiles' | 'xyz';
  min_zoom: number;
  max_zoom: number;
  bounds?: [number, number, number, number];
  center?: [number, number, number];
}

export interface MapMarker {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  category: MarkerCategory;
  color?: string;
  icon?: string;
  imported_at: string;
  collection?: string;
}

export type MarkerCategory =
  | 'emergency'
  | 'medical'
  | 'shelter'
  | 'water'
  | 'food'
  | 'power'
  | 'comms'
  | 'hazard'
  | 'personal'
  | 'general';

// ─── Vault ────────────────────────────────────────────────────────────────────

export type VaultItemType = 'note' | 'checklist' | 'contact' | 'bookmark' | 'guide' | 'journal';

export interface VaultItem {
  id: string;
  type: VaultItemType;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
  category?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  order: number;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export type SearchScope = 'all' | 'library' | 'vault' | 'maps' | 'ai-knowledge';

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  source_type: 'content' | 'vault' | 'map-marker' | 'bookmark';
  category?: string;
  score: number;
  url?: string;
  tags?: string[];
}

export interface SearchQuery {
  q: string;
  scope: SearchScope;
  category?: ContentCategory;
  limit?: number;
  semantic?: boolean;
}

// ─── Import ───────────────────────────────────────────────────────────────────

export type ImportStatus = 'detected' | 'classifying' | 'importing' | 'queued' | 'done' | 'failed' | 'unsupported';

export interface ImportJob {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  size_bytes: number;
  status: ImportStatus;
  error?: string;
  detected_at: string;
  completed_at?: string;
  content_id?: string;
  category?: ContentCategory;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  data_dir: string;
  import_watch_dirs: string[];
  ollama_host: string;
  default_model: string;
  embed_model: string;
  default_persona: PersonaId;
  lan_exposed: boolean;
  bind_address: string;
  max_concurrent_downloads: number;
  chunk_size: number;
  chunk_overlap: number;
  auto_reindex: boolean;
  storage_warn_threshold_pct: number;
  tile_server_url: string;
  theme: 'dark';
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}
