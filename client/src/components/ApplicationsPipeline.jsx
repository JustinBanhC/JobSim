import { useMemo, useState } from 'react';
import { COLUMNS } from '../hooks/useApplications';
import ApplicationModal from './ApplicationModal';
import AddApplicationForm from './AddApplicationForm';
import FilterBar from './FilterBar';

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function appNeedsFollowUp(app) {
  const d = daysSince(app.date_updated);
  if (d === null || d < 7) return false;
  return ['applied', 'screen_scheduled', 'interviewing'].includes(app.status);
}

function formatShortDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

const mono = { fontFamily: 'var(--font-mono)' };

export default function ApplicationsPipeline({ applications, grouped, onMove, onCreate, onUpdate, onDelete, onFilter }) {
  const [stageFilter, setStageFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedApp, setSelectedApp] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const counts = useMemo(() => {
    const m = { all: applications.length };
    for (const c of COLUMNS) m[c.id] = applications.filter((a) => a.status === c.id).length;
    return m;
  }, [applications]);

  const visible = useMemo(() => {
    let list = [...applications];
    if (stageFilter !== 'all') list = list.filter((a) => a.status === stageFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) => (a.company || '').toLowerCase().includes(q) || (a.role || '').toLowerCase().includes(q)
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp;
      switch (sort) {
        case 'company':
          cmp = (a.company || '').localeCompare(b.company || '', undefined, { sensitivity: 'base' });
          break;
        case 'role':
          cmp = (a.role || '').localeCompare(b.role || '', undefined, { sensitivity: 'base' });
          break;
        case 'applied':
          cmp = (new Date(a.date_applied || 0).getTime() || 0) - (new Date(b.date_applied || 0).getTime() || 0);
          break;
        case 'updated':
          cmp = (new Date(a.date_updated || 0).getTime() || 0) - (new Date(b.date_updated || 0).getTime() || 0);
          break;
        case 'stage':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          cmp = 0;
      }
      return (cmp ?? 0) * dir;
    });
    return list;
  }, [applications, stageFilter, query, sort, sortDir]);

  function handleRowClick(e, app) {
    if (e.target.closest('[data-stage-control]')) return;
    setSelectedApp(app);
  }

  function handleStageChange(app, newStatus) {
    if (newStatus === app.status) return;
    const col = grouped[newStatus] || [];
    const position = col.filter((c) => c.id !== app.id).length;
    onMove(app.id, newStatus, position);
  }

  const addDefaultStatus = stageFilter === 'all' ? 'applied' : stageFilter;

  return (
    <>
      <div className="px-5 md:px-10 lg:px-14 pb-14 min-h-0">
        {/* ── TAB BAR: stage tabs across the top ── */}
        <div className="flex items-end gap-0 overflow-x-auto pb-0 -mb-px relative z-[2]">
          <TabItem
            label="All"
            count={counts.all}
            active={stageFilter === 'all'}
            onClick={() => setStageFilter('all')}
          />
          {COLUMNS.map((col) => (
            <TabItem
              key={col.id}
              label={col.label}
              count={counts[col.id] ?? 0}
              active={stageFilter === col.id}
              dotColor={col.color}
              onClick={() => setStageFilter(col.id)}
            />
          ))}
        </div>

        {/* ── INSET PANEL: sits inside the active tab ── */}
        <div
          className="border relative z-[1]"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          {/* Toolbar row */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center p-4 sm:p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company or role…"
              className="ui-input flex-1 min-w-[11rem] h-10 text-[11px] px-3 uppercase tracking-wider cursor-text"
              style={mono}
              aria-label="Search applications"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="ui-input h-10 text-[10px] uppercase tracking-[0.14em] px-3 min-w-[8.5rem] cursor-pointer"
                style={mono}
                aria-label="Sort by"
              >
                <option value="updated">Last updated</option>
                <option value="applied">Date applied</option>
                <option value="company">Company</option>
                <option value="role">Role</option>
                <option value="stage">Stage</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="ui-btn-ghost h-10 px-3 text-[9px] uppercase tracking-[0.2em] cursor-pointer whitespace-nowrap"
                style={mono}
              >
                {sortDir === 'asc' ? 'ASC' : 'DESC'}
              </button>
              {onFilter && (
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className="ui-btn-ghost h-10 px-3 text-[9px] uppercase tracking-[0.2em] cursor-pointer whitespace-nowrap"
                  style={mono}
                >
                  {showFilters ? 'Hide filters' : 'Filters'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAdd((s) => !s)}
                className="ui-btn-primary h-10 px-5 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer whitespace-nowrap"
              >
                {showAdd ? 'Close' : 'New'}
              </button>
            </div>
          </div>

          {/* Expandable server-filter row */}
          {showFilters && onFilter && (
            <div className="p-4 sm:p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <FilterBar onFilter={onFilter} />
            </div>
          )}

          {/* Quick-add form */}
          {showAdd && (
            <div className="p-4 sm:p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <AddApplicationForm
                defaultStatus={addDefaultStatus}
                onSubmit={(data) => {
                  onCreate(data);
                  setShowAdd(false);
                }}
                onCancel={() => setShowAdd(false)}
              />
            </div>
          )}

          {/* Table header */}
          <div
            className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(8rem,10rem)_6.5rem_6.5rem_auto] gap-3 px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
          >
            {['Organization', 'Stage control', 'Applied', 'Updated', ''].map((h) => (
              <div key={h || 'sp'} className="text-[8px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {visible.length === 0 ? (
              <div className="py-20 px-6 text-center text-[10px] uppercase tracking-[0.2em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                No applications match this view.
              </div>
            ) : (
              visible.map((app) => {
                const col = COLUMNS.find((c) => c.id === app.status);
                const follow = appNeedsFollowUp(app);
                return (
                  <div
                    key={app.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleRowClick(e, app)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!e.target.closest('[data-stage-control]')) setSelectedApp(app);
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(8rem,10rem)_6.5rem_6.5rem_auto] md:items-center gap-3 py-5 px-4 cursor-pointer text-left w-full transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-white/[0.03] border-b last:border-b-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-[var(--color-accent-bright)]"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-black uppercase tracking-[0.08em] truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {app.company}
                      </p>
                      <p className="text-[10px] mt-1.5 truncate uppercase tracking-[0.14em]" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                        {app.role}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 md:hidden">
                        {app.source && (
                          <span className="text-[8px] font-bold uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ border: '1px solid var(--color-border)', color: 'var(--color-accent-bright)', ...mono }}>
                            {app.source}
                          </span>
                        )}
                        {follow && (
                          <span className="text-[8px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ border: '1px solid rgba(250,204,21,0.45)', color: '#facc15' }}>
                            SLA
                          </span>
                        )}
                      </div>
                    </div>

                    <div data-stage-control className="min-w-0" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={app.status}
                        onChange={(e) => handleStageChange(app, e.target.value)}
                        className="ui-input h-9 text-[10px] uppercase tracking-[0.12em] px-2 w-full md:min-w-[8.5rem] md:w-auto cursor-pointer"
                        style={mono}
                        aria-label={`Change stage for ${app.company}`}
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:hidden text-[9px] uppercase tracking-[0.16em] tabular-nums flex gap-4" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                      <span>{formatShortDate(app.date_applied)}</span>
                      <span>{formatShortDate(app.date_updated)}</span>
                    </div>

                    <div className="hidden md:block text-[10px] tabular-nums self-center uppercase tracking-[0.14em]" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                      {formatShortDate(app.date_applied)}
                    </div>
                    <div className="hidden md:block text-[10px] tabular-nums self-center uppercase tracking-[0.14em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                      {formatShortDate(app.date_updated)}
                    </div>
                    <div className="hidden md:flex flex-col items-end gap-1 shrink-0 justify-self-end">
                      {follow && (
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ border: '1px solid rgba(250,204,21,0.45)', color: '#facc15' }}>
                          SLA
                        </span>
                      )}
                      {app.source && (
                        <span className="text-[8px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 max-w-full truncate" style={{ border: '1px solid var(--color-border)', color: 'var(--color-accent-bright)', ...mono }}>
                          {app.source}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {selectedApp && (
        <ApplicationModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

function TabItem({ label, count, active, dotColor, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative shrink-0 px-4 py-3 cursor-pointer text-left transition-[color,border-color] duration-150 motion-reduce:transition-none border border-b-0"
      style={{
        fontFamily: 'var(--font-mono)',
        color: active ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
        borderColor: active ? 'var(--color-border)' : 'transparent',
        backgroundColor: active ? 'var(--color-bg-secondary)' : 'transparent',
        marginBottom: active ? '-1px' : '0',
        paddingBottom: active ? 'calc(0.75rem + 1px)' : '0.75rem',
      }}
    >
      <span className="flex items-center gap-2">
        {dotColor && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        )}
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] whitespace-nowrap">{label}</span>
        <span className="text-[9px] tabular-nums opacity-55">{count}</span>
      </span>
    </button>
  );
}
