import { useMemo, useRef, useState, useEffect } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useEvents } from '../hooks/useEvents';
import { api } from '../lib/api';

const mono = { fontFamily: 'var(--font-mono)' };

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
];

const TYPE_LABELS = {
  career_fair: 'Career fair',
  hiring_event: 'Hiring event',
  info_session: 'Info session',
  invite_event: 'Invite-only',
  conference: 'Conference',
  other: 'Event',
};

const STATUS_COLORS = {
  saved: 'var(--color-accent-bright)',
  registered: '#34d399',
  attended: '#a78bfa',
  dismissed: 'var(--color-text-muted)',
};

function scoreColor(score) {
  if (score == null) return 'var(--color-text-muted)';
  if (score >= 90) return 'var(--color-accent-bright)';
  if (score >= 75) return '#34d399';
  if (score >= 50) return '#fbbf24';
  return 'var(--color-text-muted)';
}

function ScoreBadge({ score }) {
  return (
    <div
      className="w-12 h-12 shrink-0 flex flex-col items-center justify-center border"
      style={{ borderColor: scoreColor(score), color: scoreColor(score) }}
    >
      <span className="text-[15px] font-black leading-none">{score ?? '—'}</span>
      <span className="text-[6px] uppercase tracking-[0.2em] mt-1 opacity-70" style={mono}>score</span>
    </div>
  );
}

function Tag({ children, color }) {
  return (
    <span
      className="text-[8px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 border"
      style={{ ...mono, color: color || 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
    >
      {children}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return 'Date TBD';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const EMPTY_FORM = { title: '', host: '', event_type: 'career_fair', url: '', location: '', event_date: '', is_virtual: false };

export default function EventsPage() {
  const { events, loading, error, refresh, create, setStatus } = useEvents();
  const [tab, setTab] = useState('upcoming');
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null);

  // Scan controls
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState([]);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  // Manual search links (always available — zero API keys needed)
  const [links, setLinks] = useState([]);

  // Manual add form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [log]);

  // Fetch one-click search links whenever the query settles.
  useEffect(() => {
    const q = [keywords.split(',')[0].trim(), location.trim()].filter(Boolean).join(' ');
    const t = setTimeout(() => {
      api.events.searchLinks(q).then((data) => setLinks(data.links || [])).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [keywords, location]);

  function append(line, tone = 'default') {
    setLog((prev) => [...prev.slice(-200), { line, tone, ts: new Date().toLocaleTimeString() }]);
  }

  async function startScan() {
    setScanning(true);
    setLog([]);
    append('Scanning public results for job fairs & hiring events…');
    const kwList = keywords.split(',').map((s) => s.trim()).filter(Boolean);
    const body = {
      keywords: kwList.length ? kwList : undefined,
      location: location.trim() || undefined,
    };

    const handleEvent = (event, data) => {
      switch (event) {
        case 'links':
          if (data.links) setLinks(data.links);
          break;
        case 'progress':
          append(`▸ [${data.done}/${data.total}] ${data.query}`);
          break;
        case 'extract_progress':
          append(`extracting… ${data.done}/${data.total}`);
          break;
        case 'log':
          append(data.msg);
          break;
        case 'event':
          append(`+ ${data.title} [${TYPE_LABELS[data.event_type] || data.event_type}]${data.score != null ? ` score ${data.score}` : ''}`, 'ok');
          break;
        case 'done':
          append(`DONE — ${data.found} public results, ${data.saved} new events saved.`, 'ok');
          break;
        case 'result': {
          // Serverless (non-streaming) response: one JSON payload.
          if (data.links) setLinks(data.links);
          for (const msg of data.log || []) append(msg);
          append(`DONE — ${data.found} public results, ${data.saved} new events saved.`, 'ok');
          break;
        }
        case 'error':
          append(`ERROR: ${data.message}`, 'error');
          break;
        default:
          break;
      }
    };

    try {
      const { promise, abort } = api.events.scan(body, handleEvent);
      abortRef.current = abort;
      await promise;
    } catch (e) {
      if (e.name !== 'AbortError') {
        // Streaming path failed — fall back to the plain JSON scan endpoint.
        append(`Stream failed (${e.message}) — retrying as plain request…`);
        try {
          const result = await api.events.scanJson(body);
          handleEvent('result', result);
        } catch (e2) {
          append(`Scan failed: ${e2.message}`, 'error');
        }
      }
    } finally {
      setScanning(false);
      abortRef.current = null;
      refresh();
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const visible = useMemo(() => {
    return events
      .filter((e) => {
        if (tab === 'all') return true;
        if (e.status === 'dismissed') return false;
        const isPast = e.event_date && e.event_date.slice(0, 10) < today;
        return tab === 'past' ? isPast : !isPast; // unknown dates count as upcoming
      })
      .sort((a, b) => {
        if (!a.event_date && !b.event_date) return 0;
        if (!a.event_date) return 1; // unknown dates last
        if (!b.event_date) return -1;
        return a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0;
      });
  }, [events, tab, today]);

  async function handleStatus(event, status) {
    setBusy(event.id);
    try {
      await setStatus(event.id, status);
    } finally {
      setBusy(null);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setAddError(null);
    try {
      await create({
        title: form.title.trim(),
        host: form.host.trim() || undefined,
        event_type: form.event_type,
        url: form.url.trim() || undefined,
        location: form.location.trim() || undefined,
        event_date: form.event_date || undefined,
        is_virtual: form.is_virtual,
        source: 'manual',
      });
      setForm(EMPTY_FORM);
      setShowAdd(false);
    } catch (err) {
      setAddError(err.message);
    }
  }

  return (
    <>
      <PageHeader
        variant="dossier"
        eyebrow="Event discovery"
        title="Events"
        description="Job fairs, hiring events, invite-only recruiting & info sessions — discovered from public LinkedIn / Instagram / Eventbrite / Luma search results and scored by AI."
        actions={
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="ui-btn-ghost h-10 px-5 text-[9px] uppercase tracking-[0.2em] cursor-pointer"
            style={mono}
          >
            {showAdd ? 'Close form' : 'Add event'}
          </button>
        }
      />
      <div className="flex-1 px-5 md:px-10 lg:px-14 pb-14 pt-8 space-y-6 max-w-[1400px] mx-auto w-full">

        {/* Scan console */}
        <div className="border" style={{ borderColor: 'var(--color-border-strong)', backgroundColor: 'var(--color-bg-secondary)' }}>
          <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] shrink-0" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Events radar
            </p>
            <input
              placeholder="Keywords (comma-separated) — default: career fair, hiring event…"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="ui-input h-9 text-[11px] px-3 flex-1"
              style={mono}
              disabled={scanning}
            />
            <input
              placeholder="Location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="ui-input h-9 text-[11px] px-3 md:max-w-[200px]"
              style={mono}
              disabled={scanning}
            />
            <button
              type="button"
              onClick={scanning ? () => abortRef.current?.() : startScan}
              className={scanning ? 'ui-btn-ghost h-9 px-5 text-[9px] uppercase tracking-[0.2em] cursor-pointer shrink-0' : 'ui-btn-primary h-9 px-5 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer shrink-0'}
              style={scanning ? mono : undefined}
            >
              {scanning ? 'Stop' : 'Scan'}
            </button>
          </div>
          {log.length > 0 && (
            <div ref={scrollRef} className="max-h-48 overflow-y-auto px-4 py-3 space-y-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
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
          {/* Always-visible manual search links — work with zero API keys */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <span className="text-[8px] font-bold uppercase tracking-[0.25em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Search manually ▸
            </span>
            {links.map((l) => (
              <a
                key={l.label}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1.5 border transition-opacity hover:opacity-80"
                style={{ ...mono, color: 'var(--color-accent-bright)', borderColor: 'var(--color-accent-muted)' }}
              >
                {l.label} ↗
              </a>
            ))}
          </div>
        </div>

        {/* Manual add form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="border p-4 space-y-3" style={{ borderColor: 'var(--color-border-strong)', backgroundColor: 'var(--color-bg-secondary)' }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Add event manually
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input placeholder="Title *" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="ui-input h-9 text-[11px] px-3 md:col-span-2" style={mono} />
              <input placeholder="Host (company/org)" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} className="ui-input h-9 text-[11px] px-3" style={mono} />
              <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="ui-input h-9 text-[11px] px-3" style={mono}>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="ui-input h-9 text-[11px] px-3" style={mono} />
              <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="ui-input h-9 text-[11px] px-3" style={mono} />
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="ui-input h-9 text-[11px] px-3" style={mono} />
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                <input type="checkbox" checked={form.is_virtual} onChange={(e) => setForm({ ...form, is_virtual: e.target.checked })} />
                Virtual
              </label>
              <button type="submit" className="ui-btn-primary h-9 px-5 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer">
                Save event
              </button>
            </div>
            {addError && (
              <p className="text-[10px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-danger)' }}>{addError}</p>
            )}
          </form>
        )}

        {error && (
          <div className="p-3 border text-[10px] uppercase tracking-[0.18em]" style={{ ...mono, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-3">
          <div className="flex border" style={{ borderColor: 'var(--color-border)' }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.18em] cursor-pointer"
                style={{
                  ...mono,
                  backgroundColor: tab === t.id ? 'var(--color-bg-secondary)' : 'transparent',
                  color: tab === t.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[9px] uppercase tracking-[0.2em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            {visible.length} events
          </p>
        </div>

        {/* Event list */}
        {loading ? (
          <div className="flex justify-center py-24 text-[10px] uppercase tracking-[0.3em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            Scanning…
          </div>
        ) : visible.length === 0 ? (
          <div className="border border-dashed p-14 text-center max-w-lg mx-auto" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-primary)' }}>
              No events on radar
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] mt-3 leading-relaxed" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Hit "Scan" to sweep public LinkedIn, Instagram, Eventbrite and Luma results — or use the manual search links above.
            </p>
          </div>
        ) : (
          <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
            {visible.map((ev) => {
              let reasons = [];
              try { reasons = JSON.parse(ev.score_reasons || '[]'); } catch { /* ignore */ }
              const isOpen = expanded === ev.id;
              const dismissed = ev.status === 'dismissed';
              return (
                <div
                  key={ev.id}
                  className="border-b px-4 py-4 transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: isOpen ? 'var(--color-bg-secondary)' : 'transparent',
                    opacity: dismissed ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-center gap-4">
                    <ScoreBadge score={ev.score} />
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : ev.id)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-black uppercase tracking-[0.04em] truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {ev.title}
                        </p>
                        {ev.status !== 'new' && (
                          <Tag color={STATUS_COLORS[ev.status]}>{ev.status}</Tag>
                        )}
                      </div>
                      <p className="text-[11px] mt-1 truncate" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                        {[ev.host, formatDate(ev.event_date), ev.location].filter(Boolean).join(' · ')}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Tag color="var(--color-accent-bright)">{TYPE_LABELS[ev.event_type] || ev.event_type}</Tag>
                        <Tag>{ev.source}</Tag>
                        {Boolean(ev.is_virtual) && <Tag>virtual</Tag>}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {dismissed ? (
                        <button
                          type="button"
                          disabled={busy === ev.id}
                          onClick={() => handleStatus(ev, 'new')}
                          className="ui-btn-ghost h-9 px-3 text-[9px] uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
                          style={mono}
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          {ev.status !== 'saved' && ev.status !== 'registered' && ev.status !== 'attended' && (
                            <button
                              type="button"
                              disabled={busy === ev.id}
                              onClick={() => handleStatus(ev, 'saved')}
                              className="ui-btn-primary h-9 px-4 text-[9px] font-black uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
                            >
                              Save
                            </button>
                          )}
                          {ev.status !== 'registered' && ev.status !== 'attended' && (
                            <button
                              type="button"
                              disabled={busy === ev.id}
                              onClick={() => handleStatus(ev, 'registered')}
                              className="ui-btn-ghost h-9 px-3 text-[9px] uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
                              style={mono}
                            >
                              Registered
                            </button>
                          )}
                          {ev.status === 'registered' && (
                            <button
                              type="button"
                              disabled={busy === ev.id}
                              onClick={() => handleStatus(ev, 'attended')}
                              className="ui-btn-ghost h-9 px-3 text-[9px] uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
                              style={mono}
                            >
                              Attended
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy === ev.id}
                            onClick={() => handleStatus(ev, 'dismissed')}
                            className="ui-btn-ghost h-9 px-3 text-[9px] uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
                            style={mono}
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-4 ml-16 space-y-3">
                      {reasons.length > 0 && (
                        <ul className="space-y-1.5">
                          {reasons.map((r, i) => (
                            <li key={i} className="text-[10px] uppercase tracking-[0.12em] leading-relaxed flex gap-2" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                              <span style={{ color: scoreColor(ev.score) }}>▸</span> {r}
                            </li>
                          ))}
                        </ul>
                      )}
                      {ev.description && (
                        <p className="text-[11px] leading-relaxed max-w-3xl whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>
                          {ev.description.slice(0, 600)}{ev.description.length > 600 ? '…' : ''}
                        </p>
                      )}
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-[9px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
                          style={{ ...mono, color: 'var(--color-accent-bright)' }}
                        >
                          View event ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
