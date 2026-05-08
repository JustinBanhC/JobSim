import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const mono = { fontFamily: 'var(--font-mono)' };

const QUICK_PROMPTS = [
  { label: 'Populate apps', prompt: 'Generate 8 realistic software engineering job applications at a variety of companies with different statuses, sources, and locations.' },
  { label: 'Add skills', prompt: 'Create a skill tree of 6 key skills for a full-stack software engineer job search, with varied priorities and progress levels.' },
  { label: 'Add contacts', prompt: 'Generate 5 realistic networking contacts at tech companies with varied outreach statuses and connection methods.' },
  { label: 'Populate all', prompt: 'Populate my entire job search board: create 8 varied job applications, 6 relevant skills, and 5 networking contacts. Make everything realistic with diverse companies, roles, statuses, and details.' },
];

function ActionCard({ type, items }) {
  const icon = type === 'applications' ? '>' : type === 'skills' ? '*' : '@';
  const label = type === 'applications' ? 'Applications' : type === 'skills' ? 'Skills' : 'Contacts';
  return (
    <div
      className="my-2 border"
      style={{ borderColor: 'var(--color-border-strong)', backgroundColor: 'var(--color-bg-card)' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b text-[9px] font-bold uppercase tracking-[0.2em]"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent-bright)', ...mono }}
      >
        <span className="opacity-60">{icon}</span> {items.length} {label} created
      </div>
      <div className="max-h-40 overflow-y-auto">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] border-b last:border-b-0"
            style={{ borderColor: 'rgba(255,255,255,0.04)', ...mono }}
          >
            <span className="text-[8px] opacity-30">+</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{item.company || item.name}</span>
            {item.role && (
              <span className="opacity-50 truncate">{item.role}</span>
            )}
            {item.status && (
              <span
                className="ml-auto text-[8px] uppercase tracking-wider px-1.5 py-0.5 shrink-0"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                {item.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className="max-w-[85%] px-4 py-3"
        style={{
          backgroundColor: isUser ? 'var(--color-accent-soft)' : 'var(--color-bg-card)',
          border: `1px solid ${isUser ? 'var(--color-accent-muted)' : 'var(--color-border)'}`,
          color: 'var(--color-text-primary)',
          ...mono,
        }}
      >
        {message.content && (
          <div className="text-[11px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        )}
        {message.actions?.map((action, i) => (
          <ActionCard key={i} type={action.type} items={action.items} />
        ))}
        {message.thinking && (
          <div className="text-[10px] italic mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {message.thinking}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div
        className="px-4 py-3 flex items-center gap-1.5"
        style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: 'var(--color-accent-bright)',
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AgentPanel({ open, onClose, onDataChange }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'JobSim AI online.\n\nI can populate your board with realistic data, suggest skills to track, or generate networking contacts. What would you like?',
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming) return;

    const userMsg = { role: 'user', content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setStreaming(true);

    let assistantText = '';
    const actions = [];

    const chatMessages = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content || '' }));

    const { promise, abort } = api.agent.chat(chatMessages, (event, data) => {
      switch (event) {
        case 'text':
          assistantText += data.content;
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant' && last._streaming) {
              copy[copy.length - 1] = { ...last, content: assistantText, actions: [...actions] };
            } else {
              copy.push({ role: 'assistant', content: assistantText, actions: [...actions], _streaming: true });
            }
            return copy;
          });
          break;
        case 'function_call':
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            const label = fnLabel(data.name);
            if (last?.role === 'assistant' && last._streaming) {
              copy[copy.length - 1] = { ...last, thinking: label };
            } else {
              copy.push({ role: 'assistant', content: '', thinking: label, actions: [...actions], _streaming: true });
            }
            return copy;
          });
          break;
        case 'function_result': {
          const result = data.result;
          if (result && !result.error) {
            const type = data.name.includes('application') ? 'applications' : data.name.includes('skill') ? 'skills' : 'contacts';
            if (data.name.startsWith('bulk_create')) {
              const items = result.applications || result.skills || result.contacts;
              if (Array.isArray(items) && items.length > 0) {
                actions.push({ type, items });
              }
            } else if (data.name.startsWith('create_')) {
              actions.push({ type, items: [result] });
            }
          }
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant' && last._streaming) {
              copy[copy.length - 1] = { ...last, thinking: null, actions: [...actions] };
            }
            return copy;
          });
          break;
        }
        case 'done':
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?._streaming) {
              const { _streaming, ...rest } = last;
              copy[copy.length - 1] = { ...rest, actions: [...actions] };
            }
            return copy;
          });
          if (actions.length > 0 && onDataChange) {
            onDataChange();
          }
          break;
        case 'error':
          setMessages((prev) => [
            ...prev.filter((m) => !m._streaming),
            { role: 'assistant', content: `Error: ${data.message}` },
          ]);
          break;
      }
    });

    abortRef.current = abort;

    try {
      await promise;
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev.filter((m) => !m._streaming),
          { role: 'assistant', content: `Connection error: ${e.message}` },
        ]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, onDataChange]);

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleQuickPrompt(prompt) {
    sendMessage(prompt);
  }

  function handleStop() {
    if (abortRef.current) abortRef.current();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[440px] flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-primary)', borderLeft: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 flex items-center justify-center text-[10px] font-black"
              style={{ border: '1px solid var(--color-accent-muted)', color: 'var(--color-accent-bright)', ...mono }}
            >
              AI
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-primary)', ...mono }}>
                JobSim Agent
              </p>
              <p className="text-[8px] uppercase tracking-[0.22em] mt-0.5" style={{ color: 'var(--color-text-muted)', ...mono }}>
                gemini 2.5 flash
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 cursor-pointer transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Close agent panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-0">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {streaming && !messages[messages.length - 1]?._streaming && <TypingIndicator />}
        </div>

        {/* Quick prompts */}
        {messages.length <= 2 && !streaming && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                type="button"
                onClick={() => handleQuickPrompt(qp.prompt)}
                className="text-[9px] uppercase tracking-[0.14em] px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.06]"
                style={{
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-accent-bright)',
                  backgroundColor: 'transparent',
                  ...mono,
                }}
              >
                {qp.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="shrink-0 px-4 pb-4 pt-2"
        >
          <div
            className="flex items-center gap-2 border"
            style={{ borderColor: 'var(--color-border-strong)', backgroundColor: 'var(--color-bg-input)' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={streaming ? 'Thinking...' : 'Ask the agent anything...'}
              disabled={streaming}
              className="flex-1 bg-transparent border-none outline-none px-3 py-3 text-[11px] placeholder:text-[var(--color-text-muted)] disabled:opacity-50"
              style={{ color: 'var(--color-text-primary)', ...mono }}
            />
            {streaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="shrink-0 mr-2 px-3 py-1.5 text-[9px] uppercase tracking-[0.16em] cursor-pointer"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-danger)', ...mono }}
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="shrink-0 mr-2 px-3 py-1.5 text-[9px] uppercase tracking-[0.16em] cursor-pointer disabled:opacity-30"
                style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-accent-bright)', ...mono }}
              >
                Send
              </button>
            )}
          </div>
        </form>

        <style>{`
          @keyframes pulse {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </>
  );
}

function fnLabel(name) {
  const map = {
    list_applications: 'Reading applications...',
    list_skills: 'Reading skills...',
    list_contacts: 'Reading contacts...',
    create_application: 'Creating application...',
    create_skill: 'Creating skill...',
    create_contact: 'Creating contact...',
    bulk_create_applications: 'Creating applications...',
    bulk_create_skills: 'Creating skills...',
    bulk_create_contacts: 'Creating contacts...',
  };
  return map[name] || 'Processing...';
}
