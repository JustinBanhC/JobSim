import { useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import ContactListRow from '../components/ContactListRow';
import ContactModal from '../components/ContactModal';
import { useContacts } from '../hooks/useContacts';

const OUTREACH_TABS = [
  { id: 'all', label: 'All' },
  { id: 'not_contacted', label: 'No contact' },
  { id: 'reached_out', label: 'Sent' },
  { id: 'responded', label: 'Reply' },
  { id: 'call_scheduled', label: 'Call set' },
  { id: 'connected', label: 'Linked' },
];

const mono = { fontFamily: 'var(--font-mono)' };

export default function ConnectionsPage() {
  const { contacts, loading, error, create, update, remove } = useContacts();
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('all');

  const counts = useMemo(() => {
    const m = { all: contacts.length };
    for (const t of OUTREACH_TABS) {
      if (t.id !== 'all') m[t.id] = contacts.filter((c) => c.outreach_status === t.id).length;
    }
    return m;
  }, [contacts]);

  const visible = useMemo(() => {
    if (tab === 'all') return contacts;
    return contacts.filter((c) => c.outreach_status === tab);
  }, [contacts, tab]);

  return (
    <>
      <PageHeader
        variant="dossier"
        eyebrow="Contacts"
        title="Directory"
        description="Flat file of humans. Status is machine-readable. Tags are arbitrary tokens. Follow-up SLA flags when outreach stalls."
        actions={
          <button type="button" onClick={() => setModal('new')} className="ui-btn-primary h-10 px-6 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer">
            New record
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
            Loading contacts…
          </div>
        ) : contacts.length === 0 ? (
          <div className="border border-dashed p-14 text-center max-w-lg mx-auto mt-6" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-primary)' }}>
              No contacts yet
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] mt-3 leading-relaxed" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Add someone you met at a meetup, a recruiter thread, or a referral path.
            </p>
            <button type="button" onClick={() => setModal('new')} className="ui-btn-primary mt-8 h-11 px-8 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer">
              Add contact
            </button>
          </div>
        ) : (
          <>
            {/* ── TAB BAR ── */}
            <div className="flex items-end gap-0 overflow-x-auto pb-0 -mb-px relative z-[2]">
              {OUTREACH_TABS.map((t) => (
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
                className="hidden md:grid md:grid-cols-[1fr_auto] gap-4 px-4 py-3 border-b"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
              >
                {['Contact', ''].map((h) => (
                  <div key={h || 'x'} className="text-[8px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                {visible.length === 0 ? (
                  <div className="py-20 px-6 text-center text-[10px] uppercase tracking-[0.2em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                    No contacts match this filter.
                  </div>
                ) : (
                  visible.map((c) => (
                    <ContactListRow key={c.id} contact={c} onClick={() => setModal(c)} />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {modal && (
        <ContactModal
          key={modal === 'new' ? 'new' : modal.id}
          contact={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onCreate={create}
          onUpdate={update}
          onDelete={remove}
        />
      )}
    </>
  );
}
