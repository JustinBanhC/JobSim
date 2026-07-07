import { COLUMNS } from '../../hooks/useApplications';

const mono = { fontFamily: 'var(--font-mono)' };

const STATUS_LABELS = Object.fromEntries(COLUMNS.map((c) => [c.id, c.label]));
const STATUS_COLORS = Object.fromEntries(COLUMNS.map((c) => [c.id, c.color]));

function SubHeader({ children }) {
  return (
    <p
      className="px-4 py-2 border-b text-[8px] font-bold uppercase tracking-[0.28em]"
      style={{ ...mono, color: 'var(--color-text-muted)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
    >
      {children}
    </p>
  );
}

export default function FollowUpList({ staleApps, staleContacts, onLogFollowUp, busyId }) {
  const empty = staleApps.length === 0 && staleContacts.length === 0;

  return (
    <section className="border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
      <header
        className="flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-primary)' }}>
          Needs follow-up
        </p>
        <p className="text-[8px] uppercase tracking-[0.2em] tabular-nums" style={{ ...mono, color: 'var(--color-text-muted)' }}>
          {staleApps.length + staleContacts.length} item{staleApps.length + staleContacts.length === 1 ? '' : 's'}
        </p>
      </header>

      <div style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        {empty ? (
          <div className="py-14 px-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-primary)' }}>
              All clear
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] mt-2" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Nothing has been sitting idle. Keep the loop tight.
            </p>
          </div>
        ) : (
          <>
            {staleApps.length > 0 && (
              <>
                <SubHeader>Applications / stale &gt; 7 days</SubHeader>
                {staleApps.map(({ app, days, urgent }) => (
                  <div
                    key={app.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 border-b border-l-2"
                    style={{
                      borderBottomColor: 'var(--color-border)',
                      borderLeftColor: urgent ? 'var(--color-danger)' : 'transparent',
                      backgroundColor: urgent ? 'rgba(248,113,113,0.04)' : 'transparent',
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {app.company}
                      </p>
                      <p className="text-[9px] uppercase tracking-[0.16em] mt-1 truncate" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                        {app.role}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="w-2 h-2 shrink-0" style={{ backgroundColor: STATUS_COLORS[app.status] || 'var(--color-text-muted)' }} />
                      <span className="text-[8px] uppercase tracking-[0.18em]" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                        {STATUS_LABELS[app.status] || app.status}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] tabular-nums"
                      style={{ ...mono, color: urgent ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
                      title={urgent ? 'Stale 14+ days — urgent' : 'Stale more than 7 days'}
                    >
                      {days}d stale{urgent ? ' !' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => onLogFollowUp(app.id)}
                      disabled={busyId === app.id}
                      className="ui-btn-ghost shrink-0 h-8 px-3 text-[8px] font-black uppercase tracking-[0.2em] cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    >
                      {busyId === app.id ? 'Logging…' : 'Log follow-up'}
                    </button>
                  </div>
                ))}
              </>
            )}

            {staleContacts.length > 0 && (
              <>
                <SubHeader>Outreach / no reply &gt; 5 days</SubHeader>
                {staleContacts.map(({ contact, days }) => (
                  <div
                    key={contact.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 border-b"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {contact.name}
                      </p>
                      <p className="text-[9px] uppercase tracking-[0.16em] mt-1 truncate" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                        {[contact.title, contact.company].filter(Boolean).join(' · ') || 'Contact'}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-[9px] uppercase tracking-[0.18em] tabular-nums"
                      style={{ ...mono, color: 'var(--color-text-muted)' }}
                    >
                      {days}d since outreach
                    </span>
                    <span
                      className="shrink-0 text-[8px] font-bold uppercase tracking-[0.2em]"
                      style={{ ...mono, color: 'var(--color-accent-bright)' }}
                    >
                      No reply — nudge?
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
