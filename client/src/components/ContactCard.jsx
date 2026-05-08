const OUTREACH_LABELS = {
  not_contacted: 'Not contacted',
  reached_out: 'Reached out',
  responded: 'Responded',
  call_scheduled: 'Call scheduled',
  connected: 'Connected',
};

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

function contactNeedsFollowUp(c) {
  if (c.outreach_status !== 'reached_out') return false;
  return daysSince(c.date_updated) >= 5;
}

const STATUS_DOT = {
  not_contacted: '#64748b',
  reached_out: '#3b82f6',
  responded: '#22c55e',
  call_scheduled: '#a855f7',
  connected: '#10b981',
};

export default function ContactCard({ contact, onClick }) {
  const follow = contactNeedsFollowUp(contact);
  const tags = Array.isArray(contact.tags) ? contact.tags : [];

  return (
    <button
      type="button"
      onClick={() => onClick(contact)}
      className="w-full text-left rounded-[var(--radius-xl)] border p-5 cursor-pointer group transition-all duration-200 hover:border-white/15 hover:shadow-[var(--shadow-md)]"
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate group-hover:opacity-90" style={{ color: 'var(--color-text-primary)' }}>
            {contact.name}
          </p>
          <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {[contact.title, contact.company].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        {follow && (
          <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-300">
            Follow up
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_DOT[contact.outreach_status] || STATUS_DOT.not_contacted }}
        />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {OUTREACH_LABELS[contact.outreach_status] || contact.outreach_status}
        </span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-[11px] px-2 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
