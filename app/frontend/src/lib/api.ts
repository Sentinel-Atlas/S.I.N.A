// S.I.N.A API Client

const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'API error');
  return data.data as T;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const api = {
  dashboard: {
    health: () => request<import('@sina/shared').SystemHealth>('/dashboard/health'),
    stats: () => request<Record<string, Record<string, number>>>('/dashboard/stats'),
  },

  // ─── AI ───────────────────────────────────────────────────────────────────
  ai: {
    personas: () => request<import('@sina/shared').Persona[]>('/ai/personas'),
    models: () => request<import('@sina/shared').AIModel[]>('/ai/models'),
    deleteModel: (name: string) => request<void>(`/ai/models/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    conversations: () => request<import('@sina/shared').Conversation[]>('/ai/conversations'),
    createConversation: (data: { title?: string; persona?: string; model?: string }) =>
      request<import('@sina/shared').Conversation>('/ai/conversations', { method: 'POST', body: JSON.stringify(data) }),
    getMessages: (id: string) => request<import('@sina/shared').ChatMessage[]>(`/ai/conversations/${id}/messages`),
    deleteConversation: (id: string) => request<void>(`/ai/conversations/${id}`, { method: 'DELETE' }),
  },

  // ─── Downloads ────────────────────────────────────────────────────────────
  downloads: {
    list: (status?: string) => request<import('@sina/shared').DownloadJob[]>(`/downloads${status ? `?status=${status}` : ''}`),
    create: (data: { name: string; url: string; checksum?: string; catalog_item_id?: string }) =>
      request<import('@sina/shared').DownloadJob>('/downloads', { method: 'POST', body: JSON.stringify(data) }),
    start: (id: string) => request<import('@sina/shared').DownloadJob>(`/downloads/${id}/start`, { method: 'POST' }),
    pause: (id: string) => request<import('@sina/shared').DownloadJob>(`/downloads/${id}/pause`, { method: 'POST' }),
    resume: (id: string) => request<import('@sina/shared').DownloadJob>(`/downloads/${id}/resume`, { method: 'POST' }),
    cancel: (id: string) => request<import('@sina/shared').DownloadJob>(`/downloads/${id}/cancel`, { method: 'POST' }),
    catalog: () => request<import('@sina/shared').CatalogItem[]>('/downloads/catalog/items'),
  },

  // ─── Library ──────────────────────────────────────────────────────────────
  library: {
    collections: () => request<import('@sina/shared').Collection[]>('/library/collections'),
    createCollection: (data: { name: string; description?: string; category?: string }) =>
      request<import('@sina/shared').Collection>('/library/collections', { method: 'POST', body: JSON.stringify(data) }),
    items: (params?: { category?: string; status?: string; collection_id?: string; page?: number; per_page?: number }) => {
      const q = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
      return request<import('@sina/shared').PaginatedResponse<import('@sina/shared').ContentItem>>(`/library/items?${q}`);
    },
    getItem: (id: string) => request<import('@sina/shared').ContentItem>(`/library/items/${id}`),
    updateItem: (id: string, data: Partial<import('@sina/shared').ContentItem>) =>
      request<import('@sina/shared').ContentItem>(`/library/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteItem: (id: string) => request<void>(`/library/items/${id}`, { method: 'DELETE' }),
    reindexItem: (id: string) => request<import('@sina/shared').ContentItem>(`/library/items/${id}/reindex`, { method: 'POST' }),
    reindexAll: () => request<{ message: string }>('/library/reindex', { method: 'POST' }),
  },

  // ─── Maps ─────────────────────────────────────────────────────────────────
  maps: {
    regions: () => request<import('@sina/shared').MapRegion[]>('/maps/regions'),
    addRegion: (data: object) => request<import('@sina/shared').MapRegion>('/maps/regions', { method: 'POST', body: JSON.stringify(data) }),
    scanRegions: () => request<{ found: number }>('/maps/regions/scan', { method: 'POST' }),
    markers: (params?: { category?: string; collection?: string }) => {
      const q = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v != null) as [string, string][]);
      return request<import('@sina/shared').MapMarker[]>(`/maps/markers?${q}`);
    },
    addMarker: (data: object) => request<import('@sina/shared').MapMarker>('/maps/markers', { method: 'POST', body: JSON.stringify(data) }),
    updateMarker: (id: string, data: object) => request<import('@sina/shared').MapMarker>(`/maps/markers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMarker: (id: string) => request<void>(`/maps/markers/${id}`, { method: 'DELETE' }),
    importGeoJSON: (geojson: object, collection?: string) =>
      request<{ imported: number }>('/maps/markers/import', { method: 'POST', body: JSON.stringify({ geojson, collection }) }),
  },

  // ─── Vault ────────────────────────────────────────────────────────────────
  vault: {
    list: (params?: { type?: string; category?: string; pinned?: boolean }) => {
      const q = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
      return request<import('@sina/shared').PaginatedResponse<import('@sina/shared').VaultItem>>(`/vault?${q}`);
    },
    get: (id: string) => request<import('@sina/shared').VaultItem>(`/vault/${id}`),
    create: (data: object) => request<import('@sina/shared').VaultItem>('/vault', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object) => request<import('@sina/shared').VaultItem>(`/vault/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/vault/${id}`, { method: 'DELETE' }),
  },

  // ─── Search ───────────────────────────────────────────────────────────────
  search: {
    query: (params: { q: string; scope?: string; category?: string; semantic?: boolean }) => {
      const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
      return request<import('@sina/shared').SearchResult[]>(`/search?${q}`);
    },
  },

  // ─── System ───────────────────────────────────────────────────────────────
  system: {
    status: () => request<Record<string, unknown>>('/system/status'),
    settings: () => request<import('@sina/shared').AppSettings>('/system/settings'),
    updateSettings: (data: Partial<import('@sina/shared').AppSettings>) =>
      request<{ message: string }>('/system/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    jobs: () => request<import('@sina/shared').ImportJob[]>('/system/jobs'),
  },

  // ─── Setup Wizard ─────────────────────────────────────────────────────────
  setup: {
    state: () => request<import('@sina/shared').SetupState>('/setup/state'),
    probe: () => request<Record<string, unknown>>('/setup/probe'),
    updateState: (data: { step_id?: string; status?: string; current_step?: string }) =>
      request<import('@sina/shared').SetupState>('/setup/state', { method: 'PATCH', body: JSON.stringify(data) }),
    skip: () => request<import('@sina/shared').SetupState>('/setup/skip', { method: 'POST' }),
    reset: () => request<{ message: string }>('/setup/reset', { method: 'POST' }),
  },

  // ─── Kiwix / ZIM Library ──────────────────────────────────────────────────
  kiwix: {
    status: () => request<Record<string, unknown>>('/kiwix/status'),
    library: () => request<import('@sina/shared').ZimFile[]>('/kiwix/library'),
    scan: () => request<{ added: number; removed: number }>('/kiwix/library/scan', { method: 'POST' }),
    register: (data: { file_path: string; title?: string; description?: string; language?: string; category?: string; tags?: string[] }) =>
      request<import('@sina/shared').ZimFile>('/kiwix/library/register', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string, deleteFile = false) =>
      request<{ message: string }>(`/kiwix/library/${id}?delete_file=${deleteFile}`, { method: 'DELETE' }),
    registryCategories: () => request<Record<string, unknown>>('/kiwix/registry/categories'),
    registryWikipedia: () => request<Record<string, unknown>>('/kiwix/registry/wikipedia'),
    startServe: () => request<{ message: string }>('/kiwix/serve/start', { method: 'POST' }),
    stopServe: () => request<{ message: string }>('/kiwix/serve/stop', { method: 'POST' }),
  },

  // ─── Updates ──────────────────────────────────────────────────────────────
  updates: {
    status: () => request<{ checked_at: string | null; update_count: number | null }>('/updates/status'),
    check: () => request<import('@sina/shared').UpdateCheckResult>('/updates/check', { method: 'POST' }),
  },
};

// ─── Upload helper ───────────────────────────────────────────────────────────

export async function uploadFiles(files: FileList | File[]): Promise<{ name: string; id: string; status: string }[]> {
  const form = new FormData();
  for (const file of Array.from(files)) form.append('files', file);
  const res = await fetch('/api/library/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// ─── Chat streaming ──────────────────────────────────────────────────────────

export function startChatStream(
  conversationId: string,
  message: string,
  onToken: (token: string) => void,
  onSources: (sources: import('@sina/shared').SourceReference[]) => void,
  onDone: (messageId: string) => void,
  onError: (err: string) => void
): () => void {
  const controller = new AbortController();

  fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId, message, use_rag: true }),
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return onError('No stream body');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === 'token') onToken(evt.content);
          else if (evt.type === 'sources') onSources(evt.sources);
          else if (evt.type === 'done') onDone(evt.message_id);
          else if (evt.type === 'error') onError(evt.error);
        } catch { /* skip */ }
      }
    }
  }).catch((err: Error) => {
    if (err.name !== 'AbortError') onError(err.message);
  });

  return () => controller.abort();
}
