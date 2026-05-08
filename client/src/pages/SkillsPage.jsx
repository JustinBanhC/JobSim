import { useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import SkillModal from '../components/SkillModal';
import SkillProgressBar from '../components/SkillProgressBar';
import { useSkills } from '../hooks/useSkills';
import { getSkillProgress } from '../lib/skillProgress';

const PRIORITY_LABEL = { high: 'HIGH', medium: 'MID', nice: 'LOW' };

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'not_started', label: 'Locked' },
  { id: 'in_progress', label: 'Running' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Cleared' },
];

const STATUS_LABEL = {
  not_started: 'LOCK',
  in_progress: 'RUN',
  paused: 'PAUSE',
  completed: 'CLEAR',
};

const mono = { fontFamily: 'var(--font-mono)' };

export default function SkillsPage() {
  const { skills, loading, error, create, update, remove } = useSkills();
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('all');

  const counts = useMemo(() => {
    const m = { all: skills.length };
    for (const t of STATUS_TABS) {
      if (t.id !== 'all') m[t.id] = skills.filter((s) => s.status === t.id).length;
    }
    return m;
  }, [skills]);

  const visible = useMemo(() => {
    if (tab === 'all') return skills;
    return skills.filter((s) => s.status === tab);
  }, [skills, tab]);

  return (
    <>
      <PageHeader
        variant="dossier"
        eyebrow="Skill tree"
        title="Learn"
        description="Allocate points across capabilities. Each row is a branch you clear toward interview-ready depth."
        actions={
          <button
            type="button"
            onClick={() => setModal('new')}
            className="ui-btn-primary h-10 px-6 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer"
          >
            New branch
          </button>
        }
      />
      <div className="flex-1 px-5 md:px-10 lg:px-14 pb-14">
        {error && (
          <div
            className="mb-4 p-3 border text-[10px] uppercase tracking-[0.18em]"
            style={{ ...mono, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', backgroundColor: 'rgba(248,113,113,0.06)' }}
          >
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-24 text-[10px] uppercase tracking-[0.3em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            Loading tree…
          </div>
        ) : skills.length === 0 ? (
          <div className="border border-dashed p-14 text-center max-w-lg mx-auto mt-6" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-primary)' }}>
              No branches yet
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] mt-3 leading-relaxed" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Spin up a skill node. Progression unlocks as you move status and levels.
            </p>
            <button type="button" onClick={() => setModal('new')} className="ui-btn-primary mt-8 h-11 px-8 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer">
              Create branch
            </button>
          </div>
        ) : (
          <>
            {/* ── TAB BAR ── */}
            <div className="flex items-end gap-0 overflow-x-auto pb-0 -mb-px relative z-[2]">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="relative shrink-0 px-4 py-3 cursor-pointer text-left transition-[color,border-color] duration-150 motion-reduce:transition-none border border-b-0"
                  style={{
                    ...mono,
                    color: tab === t.id ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
                    borderColor: tab === t.id ? 'var(--color-border)' : 'transparent',
                    backgroundColor: tab === t.id ? 'var(--color-bg-secondary)' : 'transparent',
                    marginBottom: tab === t.id ? '-1px' : '0',
                    paddingBottom: tab === t.id ? 'calc(0.75rem + 1px)' : '0.75rem',
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.16em] whitespace-nowrap">{t.label}</span>
                    <span className="text-[9px] tabular-nums opacity-55">{counts[t.id] ?? 0}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* ── INSET PANEL ── */}
            <div
              className="border relative z-[1]"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
            >
              {/* Table header */}
              <div
                className="hidden sm:grid sm:grid-cols-[1fr_minmax(9rem,11rem)_auto] gap-4 px-4 py-3 border-b"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
              >
                {['Skill node', 'Progression', ''].map((h) => (
                  <div key={h || 'x'} className="text-[8px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                {visible.length === 0 ? (
                  <div className="py-20 px-6 text-center text-[10px] uppercase tracking-[0.2em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                    No skills match this filter.
                  </div>
                ) : (
                  visible.map((s) => {
                    const prog = getSkillProgress(s);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setModal(s)}
                        className="w-full flex flex-col sm:flex-row sm:items-stretch gap-4 sm:gap-6 py-5 px-4 border-b last:border-b-0 text-left cursor-pointer transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-[var(--color-accent-bright)]"
                        style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                      >
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-[13px] font-black uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-primary)' }}>
                              {s.name}
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-[0.16em]" style={{ ...mono, color: 'var(--color-accent-bright)' }}>
                              {PRIORITY_LABEL[s.priority] || 'MID'}
                            </span>
                          </div>
                          <p className="text-[10px] uppercase tracking-[0.14em] mt-2 leading-relaxed line-clamp-2" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                            {STATUS_LABEL[s.status] || s.status}
                            <span className="opacity-40 mx-2">//</span>
                            {s.current_level || '—'} → {s.target_level || '—'}
                            {s.resources ? (
                              <>
                                <span className="opacity-40 mx-2">//</span>
                                {s.resources}
                              </>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 sm:justify-end">
                          <SkillProgressBar percent={prog.percent} stageIndex={prog.stageIndex} stages={prog.stages} />
                          <span className="text-[9px] opacity-40 hidden sm:inline uppercase tracking-widest" style={mono}>
                            Open
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {modal && (
        <SkillModal
          key={modal === 'new' ? 'new' : modal.id}
          skill={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onCreate={create}
          onUpdate={update}
          onDelete={remove}
        />
      )}
    </>
  );
}
