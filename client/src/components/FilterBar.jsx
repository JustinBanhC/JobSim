import { useState } from 'react';
import { COLUMNS } from '../hooks/useApplications';

const SOURCES = ['LinkedIn', 'Company Site', 'Referral', 'Indeed', 'Handshake', 'AngelList', 'Other'];

const mono = { fontFamily: 'var(--font-mono)' };
const field = 'ui-input h-10 text-[10px] uppercase tracking-[0.12em] px-3 min-w-0 cursor-pointer';

export default function FilterBar({ onFilter }) {
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function apply() {
    const filters = {};
    if (status) filters.status = status;
    if (source) filters.source = source;
    if (from) filters.from = from;
    if (to) filters.to = to;
    onFilter(filters);
  }

  function clear() {
    setStatus('');
    setSource('');
    setFrom('');
    setTo('');
    onFilter({});
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
      <div className="flex flex-wrap items-center gap-2 lg:gap-3 flex-1">
        <span
          className="text-[8px] font-bold uppercase tracking-[0.28em] shrink-0 w-full lg:w-auto lg:mr-1"
          style={{ ...mono, color: 'var(--color-text-muted)' }}
        >
          Filter query
        </span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={field} style={mono}>
          <option value="">All statuses</option>
          {COLUMNS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={field} style={mono}>
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} style={mono} aria-label="Applied from" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] px-0.5" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            to
          </span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} style={mono} aria-label="Applied until" />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" onClick={apply} className="ui-btn-primary h-10 px-5 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer">
          Apply
        </button>
        <button type="button" onClick={clear} className="ui-btn-ghost h-10 px-4 text-[9px] uppercase tracking-[0.2em] cursor-pointer" style={mono}>
          Reset
        </button>
      </div>
    </div>
  );
}
