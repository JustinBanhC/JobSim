import { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';

const mono = { fontFamily: 'var(--font-mono)' };

export default function RunPanel({ onComplete }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [log]);

  function append(line, tone = 'default') {
    setLog((prev) => [...prev.slice(-200), { line, tone, ts: new Date().toLocaleTimeString() }]);
  }

  async function startRun() {
    setRunning(true);
    setLog([]);
    append('Starting discovery run — fetching enabled sources…');

    const { promise, abort } = api.discovery.run(null, (event, data) => {
      switch (event) {
        case 'source_start':
          append(`▸ ${data.company} [${data.board_type}] — fetching…`);
          break;
        case 'source_done':
          append(`✓ ${data.company}: ${data.fetched} fetched, ${data.inserted} new, ${data.filtered} filtered out`, 'ok');
          break;
        case 'source_error':
          append(`✗ ${data.company}: ${data.error}`, 'error');
          break;
        case 'score_progress':
          append(`scoring… ${data.done}/${data.total} (${data.scored} scored, ${data.failed} failed)`);
          break;
        case 'log':
          append(data.msg);
          break;
        case 'done':
          append(`DONE — ${data.sources} sources, ${data.fetched} jobs fetched, ${data.inserted} new, ${data.filtered} filtered.`, 'ok');
          break;
        case 'error':
          append(`ERROR: ${data.message}`, 'error');
          break;
        default:
          break;
      }
    });
    abortRef.current = abort;

    try {
      await promise;
    } catch (e) {
      if (e.name !== 'AbortError') append(`Run failed: ${e.message}`, 'error');
    } finally {
      setRunning(false);
      abortRef.current = null;
      onComplete?.();
    }
  }

  return (
    <div className="border" style={{ borderColor: 'var(--color-border-strong)', backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
          Ingestion console
        </p>
        <button
          type="button"
          onClick={running ? () => abortRef.current?.() : startRun}
          className={running ? 'ui-btn-ghost h-8 px-4 text-[9px] uppercase tracking-[0.2em] cursor-pointer' : 'ui-btn-primary h-8 px-4 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer'}
          style={running ? mono : undefined}
        >
          {running ? 'Stop watching' : 'Run discovery'}
        </button>
      </div>
      {log.length > 0 && (
        <div ref={scrollRef} className="max-h-48 overflow-y-auto px-4 py-3 space-y-1">
          {log.map((entry, i) => (
            <p
              key={i}
              className="text-[10px] leading-relaxed"
              style={{
                ...mono,
                color: entry.tone === 'error' ? 'var(--color-danger)' : entry.tone === 'ok' ? 'var(--color-accent-bright)' : 'var(--color-text-secondary)',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>{entry.ts}</span> {entry.line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
