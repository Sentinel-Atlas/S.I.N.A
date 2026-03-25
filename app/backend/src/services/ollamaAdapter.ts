import { config } from '../config';
import { getSetting } from '../db';
import type { AIModel, ChatMessage } from '@sina/shared';

function getOllamaHost(): string {
  return getSetting('ollama_host') || config.ai.ollamaHost;
}

export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${getOllamaHost()}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels(): Promise<AIModel[]> {
  const res = await fetch(`${getOllamaHost()}/api/tags`);
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json() as { models: OllamaModel[] };
  return data.models.map(mapOllamaModel);
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

function mapOllamaModel(m: OllamaModel): AIModel {
  return {
    id: m.name,
    name: m.name,
    size_bytes: m.size,
    modified_at: m.modified_at,
    family: m.details?.family,
    parameter_size: m.details?.parameter_size,
    quantization: m.details?.quantization_level,
  };
}

export async function pullModel(name: string, onProgress: (pct: number, status: string) => void): Promise<void> {
  const res = await fetch(`${getOllamaHost()}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true }),
  });
  if (!res.ok) throw new Error(`Ollama pull failed: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as { status: string; completed?: number; total?: number };
        const pct = chunk.total ? Math.round((chunk.completed || 0) / chunk.total * 100) : 0;
        onProgress(pct, chunk.status);
      } catch { /* skip malformed */ }
    }
  }
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetch(`${getOllamaHost()}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Ollama delete failed: ${res.status}`);
}

export interface ChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  system?: string;
  options?: Record<string, unknown>;
}

export async function* chatStream(req: ChatRequest): AsyncGenerator<string> {
  const body = {
    model: req.model,
    messages: req.system
      ? [{ role: 'system', content: req.system }, ...req.messages]
      : req.messages,
    stream: true,
    options: req.options,
  };

  const res = await fetch(`${getOllamaHost()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ollama chat failed: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as { message?: { content: string }; done: boolean };
        if (chunk.message?.content) yield chunk.message.content;
      } catch { /* skip */ }
    }
  }
}

export async function generateEmbedding(text: string, model?: string): Promise<number[]> {
  const embedModel = model || getSetting('embed_model') || config.ai.embedModel;
  const res = await fetch(`${getOllamaHost()}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: embedModel, prompt: text }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}
