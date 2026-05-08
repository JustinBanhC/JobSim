const OUTREACH_LABELS = {
  not_contacted: 'NO CONTACT',
  reached_out: 'SENT',
  responded: 'REPLY',
  call_scheduled: 'CALL SET',
  connected: 'LINKED',
};

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

function contactNeedsFollowUp(c) {
  if (c.outreach_status !== 'reached_out') return false;
  return daysSince(c.date_updated) >= 5;
}

function initials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ContactListRow({ contact, onClick }) {
  const follow = contactNeedsFollowUp(contact);
  const tags = Array.isArray(contact.tags) ? contact.tags : [];
  const line = [contact.title, contact.company].filter(Boolean).join(' // ') || '—';

  return (
    <button
      type="button"
      onClick={() => onClick(contact)}
      className="w-full grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 md:gap-6 py-5 px-4 border-b last:border-b-0 cursor-pointer text-left transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-[var(--color-accent-bright)]"
      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
    >
      <div className="min-w-0 flex items-start gap-3">
        <span
          className="shrink-0 w-9 h-9 flex items-center justify-center text-[10px] font-black tracking-tighter"
          style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-accent-bright)' }}
          aria-hidden
        >
          {initials(contact.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-black uppercase tracking-[0.1em] truncate" style={{ color: 'var(--color-text-primary)' }}>
            {contact.name}
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] mt-1.5 truncate leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            {line}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
            <span className="text-[8px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-secondary)' }}>
              {OUTREACH_LABELS[contact.outreach_status] || contact.outreach_status}
            </span>
            {tags.slice(0, 5).map((t) => (
              <span
                key={t}
                className="text-[8px] uppercase tracking-wider px-1.5 py-0.5"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0">
        {follow && (
          <span
            className="text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1"
            style={{ border: '1px solid rgba(250, 204, 21, 0.45)', color: '#facc15' }}
          >
            SLA
          </span>
        )}
        <span className="text-[9px] opacity-35 uppercase tracking-widest hidden md:inline">
          Record →
        </span>
      </div>
    </button>
  );
}
