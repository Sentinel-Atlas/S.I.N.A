import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, getSetting } from '../db';
import { chatStream, listModels, pullModel, deleteModel, checkOllamaAvailable } from '../services/ollamaAdapter';
import { getContextChunks } from '../services/searchService';
import type { Persona, PersonaId, ChatMessage } from '@sina/shared';

const router = Router();

// ─── Personas ─────────────────────────────────────────────────────────────────

const PERSONAS: Persona[] = [
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Thorough, citation-aware answers from your local knowledge base.',
    icon: 'BookOpen',
    preferred_categories: ['technical', 'wikipedia', 'medical'],
    system_prompt: 'You are a knowledgeable research assistant. Provide thorough, accurate answers based on the provided context. Always cite sources when available. If you lack sufficient context, say so clearly.',
  },
  {
    id: 'survival',
    name: 'Survival Advisor',
    description: 'Practical, calm guidance for emergency and off-grid scenarios.',
    icon: 'Shield',
    preferred_categories: ['survival', 'medical', 'food-water', 'power-offgrid', 'emergency'],
    system_prompt: 'You are a calm, practical survival advisor. Prioritize safety and actionable steps. Draw from the provided emergency and survival references. Keep answers concise and clear.',
  },
  {
    id: 'technical',
    name: 'Technical Assistant',
    description: 'Engineering, repair, and technical problem solving.',
    icon: 'Wrench',
    preferred_categories: ['technical', 'repair'],
    system_prompt: 'You are a technical expert. Provide clear, step-by-step solutions to technical and engineering problems. Reference available manuals and technical documentation.',
  },
  {
    id: 'summarizer',
    name: 'Notes Summarizer',
    description: 'Condense documents, notes, and long content into clear summaries.',
    icon: 'FileText',
    preferred_categories: ['personal', 'wikipedia', 'technical'],
    system_prompt: 'You are a concise summarizer. Extract key points and create clear, structured summaries. Use bullet points when helpful. Focus on the most important information.',
  },
  {
    id: 'navigator',
    name: 'Map & Travel Helper',
    description: 'Navigation guidance, route planning, and local knowledge.',
    icon: 'Map',
    preferred_categories: ['maps', 'emergency', 'survival'],
    system_prompt: 'You are a navigation and travel advisor. Help with route planning, local knowledge, and travel logistics. Reference any available map or geographic information.',
  },
];

router.get('/personas', (_req, res) => {
  res.json({ success: true, data: PERSONAS });
});

// ─── Models ───────────────────────────────────────────────────────────────────

router.get('/models', async (_req, res) => {
  try {
    const available = await checkOllamaAvailable();
    if (!available) {
      return res.json({ success: true, data: [], message: 'Ollama not available' });
    }
    const models = await listModels();
    res.json({ success: true, data: models });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/models/pull', async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name) return res.status(400).json({ success: false, error: 'Model name required' });

  // Stream progress via SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  try {
    await pullModel(name, (pct, status) => {
      res.write(`data: ${JSON.stringify({ pct, status })}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ pct: 100, status: 'complete', done: true })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err), done: true })}\n\n`);
  } finally {
    res.end();
  }
});

router.delete('/models/:name', async (req, res) => {
  try {
    await deleteModel(req.params.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── Conversations ────────────────────────────────────────────────────────────

router.get('/conversations', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50').all();
  res.json({ success: true, data: rows });
});

router.post('/conversations', (req, res) => {
  const db = getDb();
  const { title, persona = 'researcher', model } = req.body as { title?: string; persona?: PersonaId; model?: string };
  const id = uuidv4();
  const activeModel = model || getSetting('default_model') || 'llama3.2';

  db.prepare(`
    INSERT INTO conversations (id, title, persona, model) VALUES (?, ?, ?, ?)
  `).run(id, title || 'New Conversation', persona, activeModel);

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  res.json({ success: true, data: conv });
});

router.get('/conversations/:id/messages', (req, res) => {
  const db = getDb();
  const messages = db.prepare('SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY timestamp ASC').all(req.params.id);
  res.json({ success: true, data: messages.map(m => ({
    ...(m as object),
    sources: (m as Record<string, string>).sources ? JSON.parse((m as Record<string, string>).sources) : undefined,
  }))});
});

router.delete('/conversations/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Chat ─────────────────────────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
  const { conversation_id, message, use_rag = true } = req.body as {
    conversation_id: string;
    message: string;
    use_rag?: boolean;
  };

  if (!conversation_id || !message) {
    return res.status(400).json({ success: false, error: 'conversation_id and message required' });
  }

  const db = getDb();
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversation_id) as {
    id: string; persona: PersonaId; model: string;
  } | undefined;

  if (!conv) return res.status(404).json({ success: false, error: 'Conversation not found' });

  const persona = PERSONAS.find(p => p.id === conv.persona) || PERSONAS[0];

  // Save user message
  const userMsgId = uuidv4();
  db.prepare(`INSERT INTO chat_messages (id, conversation_id, role, content, persona, model) VALUES (?, ?, 'user', ?, ?, ?)`).run(
    userMsgId, conversation_id, message, conv.persona, conv.model
  );

  // Fetch context via RAG
  let sources: unknown[] = [];
  let systemPrompt = persona.system_prompt;

  if (use_rag) {
    try {
      const contextChunks = await getContextChunks(message, 5);
      if (contextChunks.length > 0) {
        sources = contextChunks;
        const contextText = contextChunks.map((c, i) =>
          `[Source ${i + 1}: ${c.title}]\n${c.excerpt}`
        ).join('\n\n---\n\n');
        systemPrompt += `\n\nRelevant context from local knowledge base:\n\n${contextText}\n\nAnswer using this context when applicable.`;
      }
    } catch { /* RAG best-effort */ }
  }

  // Get recent conversation history
  const history = db.prepare(`
    SELECT role, content FROM chat_messages
    WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 20
  `).all(conversation_id) as { role: string; content: string }[];
  history.reverse();

  // Stream response via SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  let fullResponse = '';
  const assistantMsgId = uuidv4();

  try {
    // Send sources before streaming starts
    if (sources.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);
    }

    for await (const chunk of chatStream({
      model: conv.model,
      messages: history.slice(0, -1), // exclude the just-added user message to avoid duplication
      system: systemPrompt,
    })) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`);
    }

    // Save assistant message
    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, role, content, sources, persona, model)
      VALUES (?, ?, 'assistant', ?, ?, ?, ?)
    `).run(assistantMsgId, conversation_id, fullResponse, JSON.stringify(sources), conv.persona, conv.model);

    // Update conversation
    db.prepare(`
      UPDATE conversations SET updated_at = datetime('now'), message_count = message_count + 2
      WHERE id = ?
    `).run(conversation_id);

    res.write(`data: ${JSON.stringify({ type: 'done', message_id: assistantMsgId })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
