import { useState } from 'react';
import { api } from '../../lib/api';

const mono = { fontFamily: 'var(--font-mono)' };

export default function NetworkerPanel({ job, highlight }) {
  const [running, setRunning] = useState(false);
  const [links, setLinks] = useState([]);
  const [found, setFound] = useState([]);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);

  async function findContacts() {
    setRunning(true);
    setFound([]);
    setLog([]);
    setDone(false);

    const { promise } = api.networker.findContacts(job.id, (event, data) => {
      if (event === 'links') setLinks(data.links);
      if (event === 'contact') setFound((prev) => [...prev, data]);
      if (event === 'log') setLog((prev) => [...prev, data.msg]);
      if (event === 'done') setDone(true);
    });

    try {
      await promise;
    } catch (e) {
      setLog((prev) => [...prev, `Failed: ${e.message}`]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="pt-2 space-y-3">
      <button
        type="button"
        disabled={running}
        onClick={findContacts}
        className={`h-9 px-4 text-[9px] font-black uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50 ${highlight ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
        style={highlight ? undefined : mono}
      >
        {running ? 'Searching…' : highlight ? '★ Find contacts (high-fit job)' : 'Find contacts'}
      </button>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="text-[9px] uppercase tracking-[0.15em] px-3 py-1.5 border underline-offset-4 hover:underline"
              style={{ ...mono, borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              LinkedIn: {l.label} ↗
            </a>
          ))}
        </div>
      )}

      {found.length > 0 && (
        <div className="space-y-1.5">
          {found.map((c) => (
            <p key={c.id} className="text-[10px] uppercase tracking-[0.12em]" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-accent-bright)' }}>+ saved</span> {c.name} — {c.title} <span style={{ color: 'var(--color-text-muted)' }}>[{c.tag} · {c.source}]</span>
            </p>
          ))}
        </div>
      )}

      {log.map((msg, i) => (
        <p key={i} className="text-[9px] uppercase tracking-[0.12em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
          {msg}
        </p>
      ))}

      {done && (
        <p className="text-[9px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
          Saved contacts appear in your Contacts tab tagged "Discovered".
        </p>
      )}
    </div>
  );
}
