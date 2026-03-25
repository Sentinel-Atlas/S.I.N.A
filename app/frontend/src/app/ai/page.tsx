'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api, startChatStream } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Brain, Plus, Send, Trash2, MessageSquare, BookOpen,
  Shield, Wrench, FileText, Map, ChevronDown, X, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation, ChatMessage, Persona, AIModel, SourceReference } from '@sina/shared';

const PERSONA_ICONS: Record<string, React.ReactNode> = {
  researcher: <BookOpen className="w-4 h-4" />,
  survival:   <Shield className="w-4 h-4" />,
  technical:  <Wrench className="w-4 h-4" />,
  summarizer: <FileText className="w-4 h-4" />,
  navigator:  <Map className="w-4 h-4" />,
};

export default function AIPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>('researcher');
  const [selectedModel, setSelectedModel] = useState<string>('llama3.2');
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSources, setStreamingSources] = useState<SourceReference[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    Promise.all([
      api.ai.personas(),
      api.ai.models(),
      api.ai.conversations(),
    ]).then(([p, m, c]) => {
      setPersonas(p);
      setModels(m);
      setConversations(c);
      if (m.length > 0) setSelectedModel(m[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const loadConversation = async (id: string) => {
    setActiveConvId(id);
    const msgs = await api.ai.getMessages(id).catch(() => []);
    setMessages(msgs);
  };

  const newConversation = async () => {
    const conv = await api.ai.createConversation({
      title: 'New Conversation',
      persona: selectedPersona,
      model: selectedModel,
    });
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
    setMessages([]);
  };

  const deleteConversation = async (id: string) => {
    await api.ai.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;
    if (!activeConvId) {
      await newConversation();
      return;
    }

    const userMsg = input.trim();
    setInput('');
    setStreaming(true);
    setStreamingContent('');
    setStreamingSources([]);

    // Optimistically add user message
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content: userMsg,
      timestamp: new Date().toISOString(),
    }]);

    let fullContent = '';
    cancelRef.current = startChatStream(
      activeConvId,
      userMsg,
      (token) => {
        fullContent += token;
        setStreamingContent(fullContent);
      },
      (sources) => setStreamingSources(sources),
      (msgId) => {
        setStreaming(false);
        setStreamingContent('');
        setMessages(prev => [
          ...prev,
          {
            id: msgId,
            role: 'assistant',
            content: fullContent,
            timestamp: new Date().toISOString(),
            sources: streamingSources.length > 0 ? streamingSources : undefined,
          },
        ]);
        setStreamingSources([]);
      },
      (err) => {
        setStreaming(false);
        setStreamingContent('');
        console.error('Chat error:', err);
      }
    );
  }, [input, streaming, activeConvId, selectedPersona, selectedModel, streamingSources]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activePersona = personas.find(p => p.id === (activeConv?.persona || selectedPersona));

  return (
    <div className="flex h-screen" style={{ height: 'calc(100vh - var(--statusbar-height))' }}>

      {/* Conversation sidebar */}
      {showSidebar && (
        <div className="w-64 border-r border-border bg-bg-surface flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-border">
            <Button variant="primary" size="sm" className="w-full" icon={<Plus className="w-3.5 h-3.5" />} onClick={newConversation}>
              New Conversation
            </Button>
          </div>

          {/* Persona selector */}
          <div className="p-3 border-b border-border">
            <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Persona</div>
            <div className="grid grid-cols-2 gap-1">
              {personas.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPersona(p.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors text-left',
                    selectedPersona === p.id
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-overlay'
                  )}
                >
                  {PERSONA_ICONS[p.id]}
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {conversations.length === 0 && (
              <div className="text-center py-8 text-xs text-text-muted">No conversations yet</div>
            )}
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={cn(
                  'group flex items-start gap-2 p-2.5 rounded-md cursor-pointer transition-colors',
                  activeConvId === conv.id ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-bg-overlay'
                )}
              >
                <MessageSquare className="w-3.5 h-3.5 text-text-muted mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-text-primary truncate">{conv.title}</div>
                  <div className="text-2xs text-text-muted mt-0.5">{formatRelative(conv.updated_at)}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-status-error transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Chat header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <button onClick={() => setShowSidebar(!showSidebar)} className="text-text-muted hover:text-text-primary">
            <Brain className="w-4 h-4" />
          </button>
          <div className="flex-1">
            {activeConv ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{activeConv.title}</span>
                <Badge variant="amber" className="text-2xs">{activeConv.persona}</Badge>
              </div>
            ) : (
              <span className="text-sm text-text-muted">Select or start a conversation</span>
            )}
          </div>
          {models.length > 0 && (
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="input-base w-auto text-xs py-1 h-7"
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
            </select>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeConvId && (
            <EmptyState
              icon={<Brain className="w-5 h-5" />}
              title="No conversation selected"
              description="Start a new conversation or select one from the sidebar."
              action={
                <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={newConversation}>
                  New Conversation
                </Button>
              }
            />
          )}

          {activeConvId && messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full gap-4 pb-20">
              <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                {activePersona && PERSONA_ICONS[activePersona.id]}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary">{activePersona?.name || 'AI Assistant'}</p>
                <p className="text-xs text-text-muted mt-1 max-w-sm">{activePersona?.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {['What emergency supplies should I have?', 'Summarize my recent documents', 'How do I repair a generator?', 'Find medical information'].map(q => (
                  <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="text-left px-3 py-2 rounded-lg border border-border hover:border-accent/40 hover:bg-accent/5 text-text-muted hover:text-text-primary transition-all">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {streaming && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
                <Brain className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="flex-1 card-raised p-3 text-sm text-text-primary">
                {streamingSources.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-border">
                    <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Sources</div>
                    <div className="flex flex-wrap gap-1">
                      {streamingSources.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-2xs">{s.title}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {streamingContent ? (
                  <div className="streaming-cursor">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeConvId ? 'Ask anything... (Enter to send, Shift+Enter for newline)' : 'Start a new conversation first'}
                disabled={!activeConvId || streaming}
                rows={1}
                className="input-base resize-none min-h-[2.5rem] max-h-40 py-2.5"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = `${t.scrollHeight}px`;
                }}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              icon={<Send className="w-4 h-4" />}
              onClick={sendMessage}
              disabled={!input.trim() || !activeConvId}
              loading={streaming}
            />
          </div>
          <div className="text-2xs text-text-muted mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-status-online inline-block" />
            RAG enabled — answers grounded in your local knowledge base
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const [showSources, setShowSources] = useState(false);

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
        isUser ? 'bg-bg-overlay border border-border text-text-muted' : 'bg-accent/15 border border-accent/30 text-accent'
      )}>
        {isUser ? 'Y' : <Brain className="w-3.5 h-3.5" />}
      </div>
      <div className={cn('flex-1 max-w-3xl', isUser && 'flex flex-col items-end')}>
        <div className={cn(
          'rounded-lg px-3 py-2.5 text-sm',
          isUser
            ? 'bg-bg-overlay border border-border text-text-primary'
            : 'bg-bg-surface border border-border text-text-primary'
        )}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({ children, ...props }) => (
                <code className="font-mono text-xs bg-bg-overlay px-1 rounded" {...props}>{children}</code>
              ),
              pre: ({ children }) => (
                <pre className="bg-bg-overlay rounded-md p-3 overflow-x-auto text-xs my-2">{children}</pre>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-2xs text-text-muted">{formatRelative(message.timestamp)}</span>
          {message.sources && message.sources.length > 0 && (
            <button
              onClick={() => setShowSources(!showSources)}
              className="text-2xs text-accent hover:text-accent-glow flex items-center gap-0.5"
            >
              {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
              <ChevronDown className={cn('w-3 h-3 transition-transform', showSources && 'rotate-180')} />
            </button>
          )}
        </div>
        {showSources && message.sources && (
          <div className="mt-2 space-y-1">
            {message.sources.map((s, i) => (
              <div key={i} className="card px-3 py-2 text-xs">
                <div className="font-medium text-text-primary">{s.title}</div>
                <div className="text-text-muted mt-0.5 truncate-2">{s.excerpt}</div>
                {s.category && <Badge variant="outline" className="mt-1 text-2xs">{s.category}</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
