import { useState } from 'react';
import { api } from '../../lib/api';

const mono = { fontFamily: 'var(--font-mono)' };

export default function CopilotPanel({ job }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);

  function append(line, tone = 'default') {
    setLog((prev) => [...prev.slice(-50), { line, tone }]);
  }

  async function startApply() {
    setRunning(true);
    setLog([]);

    const { promise } = api.copilot.apply(job.id, (event, data) => {
      if (event === 'log') append(data.msg);
      if (event === 'fields_found') append(`Found ${data.count} empty fields`, 'ok');
      if (event === 'filled') append(`✓ ${data.label} ← "${data.value}"`, 'ok');
      if (event === 'done') append(data.msg, 'ok');
      if (event === 'error') append(`ERROR: ${data.message}`, 'error');
    });

    try {
      await promise;
    } catch (e) {
      append(e.message, 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="pt-2 space-y-2">
      <button
        type="button"
        disabled={running}
        onClick={startApply}
        className="ui-btn-ghost h-9 px-4 text-[9px] font-black uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
        style={mono}
        title="Opens a visible browser window. The AI fills your saved profile into the form. You review and submit."
      >
        {running ? 'Co-pilot active — see browser window' : '⚡ Apply with co-pilot'}
      </button>
      {log.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto border-l-2 pl-3" style={{ borderColor: 'var(--color-border)' }}>
          {log.map((entry, i) => (
            <p
              key={i}
              className="text-[9px] uppercase tracking-[0.1em] leading-relaxed"
              style={{
                ...mono,
                color: entry.tone === 'error' ? 'var(--color-danger)' : entry.tone === 'ok' ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
              }}
            >
              {entry.line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
