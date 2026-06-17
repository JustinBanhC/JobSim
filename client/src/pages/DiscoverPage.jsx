import { useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import RunPanel from '../components/discover/RunPanel';
import NetworkerPanel from '../components/discover/NetworkerPanel';
import CopilotPanel from '../components/discover/CopilotPanel';
import ProfileVault from '../components/discover/ProfileVault';
import { useDiscoveredJobs } from '../hooks/useDiscoveredJobs';

const mono = { fontFamily: 'var(--font-mono)' };

const SCORE_TABS = [
  { id: 'all', label: 'All', min: 0 },
  { id: 'dream', label: '90+', min: 90 },
  { id: 'strong', label: '75+', min: 75 },
  { id: 'maybe', label: '50+', min: 50 },
];

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

export default function DiscoverPage() {
  const { jobs, loading, error, localOnly, refresh, promote, dismiss } = useDiscoveredJobs();
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null);
  const [vaultOpen, setVaultOpen] = useState(false);

  const visible = useMemo(() => {
    const min = SCORE_TABS.find((t) => t.id === tab)?.min ?? 0;
    const q = query.trim().toLowerCase();
    return jobs
      .filter((j) => j.status !== 'dismissed')
      .filter((j) => (min === 0 ? true : (j.score ?? 0) >= min))
      .filter((j) => (q ? `${j.company} ${j.role}`.toLowerCase().includes(q) : true))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [jobs, tab, query]);

  async function handlePromote(job) {
    setBusy(job.id);
    try {
      await promote(job.id);
    } finally {
      setBusy(null);
    }
  }

  async function handleDismiss(job) {
    setBusy(job.id);
    try {
      await dismiss(job.id);
    } finally {
      setBusy(null);
    }
  }

  if (localOnly) {
    return (
      <>
        <PageHeader variant="dossier" eyebrow="Job discovery" title="Radar" description="Automated ingestion, AI scoring, contact sourcing." />
        <div className="px-5 md:px-10 lg:px-14 py-14">
          <div className="border border-dashed p-14 text-center max-w-lg mx-auto" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-primary)' }}>
              Local only
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] mt-3 leading-relaxed" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              The discovery pipeline runs on your machine (browser automation can't run serverless). Start the local server to use Radar.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        variant="dossier"
        eyebrow="Job discovery"
        title="Radar"
        description="Boards are polled via official APIs, hard-filtered, then scored 1-100 by AI against your profile. Promote winners into the pipeline."
        actions={
          <button
            type="button"
            onClick={() => setVaultOpen(true)}
            className="ui-btn-ghost h-10 px-5 text-[9px] uppercase tracking-[0.2em] cursor-pointer"
            style={mono}
          >
            Profile vault
          </button>
        }
      />
      {vaultOpen && <ProfileVault onClose={() => setVaultOpen(false)} />}
      <div className="flex-1 px-5 md:px-10 lg:px-14 pb-14 pt-8 space-y-6 max-w-[1400px] mx-auto w-full">
        <RunPanel onComplete={() => refresh()} />

        {error && (
          <div className="p-3 border text-[10px] uppercase tracking-[0.18em]" style={{ ...mono, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex border" style={{ borderColor: 'var(--color-border)' }}>
            {SCORE_TABS.map((t) => (
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
          <input
            placeholder="Search company or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ui-input h-9 text-[11px] px-3 flex-1 max-w-sm"
            style={mono}
          />
          <p className="text-[9px] uppercase tracking-[0.2em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            {visible.length} signals
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-24 text-[10px] uppercase tracking-[0.3em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            Scanning…
          </div>
        ) : visible.length === 0 ? (
          <div className="border border-dashed p-14 text-center max-w-lg mx-auto" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-primary)' }}>
              No signals yet
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] mt-3 leading-relaxed" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Hit "Run discovery" to poll your sources and let the AI surface the best fits.
            </p>
          </div>
        ) : (
          <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
            {visible.map((job) => {
              const reasons = JSON.parse(job.score_reasons || '[]');
              const isOpen = expanded === job.id;
              const promoted = job.status === 'promoted';
              return (
                <div
                  key={job.id}
                  className="border-b px-4 py-4 transition-colors"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: isOpen ? 'var(--color-bg-secondary)' : 'transparent' }}
                >
                  <div className="flex items-center gap-4">
                    <ScoreBadge score={job.score} />
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : job.id)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <p className="text-[13px] font-black uppercase tracking-[0.04em] truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {job.company}
                      </p>
                      <p className="text-[11px] mt-1 truncate" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                        {job.role}
                      </p>
                      <p className="text-[9px] uppercase tracking-[0.15em] mt-1.5 truncate" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                        {[job.location, job.source, job.posted_date].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {promoted ? (
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] px-3 py-2 border" style={{ ...mono, color: 'var(--color-accent-bright)', borderColor: 'var(--color-accent-muted)' }}>
                          In pipeline
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busy === job.id}
                            onClick={() => handlePromote(job)}
                            className="ui-btn-primary h-9 px-4 text-[9px] font-black uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
                          >
                            Promote
                          </button>
                          <button
                            type="button"
                            disabled={busy === job.id}
                            onClick={() => handleDismiss(job)}
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
                              <span style={{ color: scoreColor(job.score) }}>▸</span> {r}
                            </li>
                          ))}
                        </ul>
                      )}
                      {job.description && (
                        <p className="text-[11px] leading-relaxed max-w-3xl whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>
                          {job.description.slice(0, 600)}{job.description.length > 600 ? '…' : ''}
                        </p>
                      )}
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-[9px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
                        style={{ ...mono, color: 'var(--color-accent-bright)' }}
                      >
                        View posting ↗
                      </a>
                      <NetworkerPanel job={job} highlight={(job.score ?? 0) > 85} />
                      <CopilotPanel job={job} />
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
