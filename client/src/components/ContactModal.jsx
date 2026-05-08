import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const OUTREACH = [
  { id: 'not_contacted', label: 'Not contacted' },
  { id: 'reached_out', label: 'Reached out' },
  { id: 'responded', label: 'Responded' },
  { id: 'call_scheduled', label: 'Call scheduled' },
  { id: 'connected', label: 'Connected' },
];

const TAG_OPTIONS = ['Recruiter', 'Engineer', 'Hiring Manager', 'Referral', 'Mentor'];

function emptyForm() {
  return {
    name: '',
    title: '',
    company: '',
    email: '',
    linkedin_url: '',
    how_connected: '',
    notes: '',
    outreach_status: 'not_contacted',
    tags: [],
  };
}

export default function ContactModal({ contact, onClose, onCreate, onUpdate, onDelete }) {
  const isNew = !contact;
  const [form, setForm] = useState(() => (isNew ? emptyForm() : { ...contact, tags: [...(contact.tags || [])] }));
  const [interactions, setInteractions] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [tab, setTab] = useState('details');

  useEffect(() => {
    if (isNew) {
      setForm(emptyForm());
      setInteractions([]);
      return;
    }
    setForm({ ...contact, tags: [...(contact.tags || [])] });
    supabase.from('interactions')
      .select('*')
      .eq('contact_id', contact.id)
      .order('date_created', { ascending: false })
      .then(({ data }) => setInteractions(data || []));
  }, [contact, isNew]);

  const inputClass = 'ui-input w-full text-sm px-3 py-2.5 mt-1';

  function toggleTag(tag) {
    setForm((f) => {
      const set = new Set(f.tags || []);
      if (set.has(tag)) set.delete(tag);
      else set.add(tag);
      return { ...f, tags: [...set] };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    if (isNew) {
      await onCreate({
        ...form,
        name: form.name.trim(),
      });
    } else {
      await onUpdate(contact.id, form);
    }
    onClose();
  }

  async function handleAddNote() {
    if (isNew || !newNote.trim()) return;
    await supabase.from('interactions').insert({ contact_id: contact.id, note: newNote.trim() });
    await supabase.from('contacts').update({ date_updated: new Date().toISOString() }).eq('id', contact.id);
    const { data } = await supabase.from('interactions').select('*').eq('contact_id', contact.id).order('date_created', { ascending: false });
    setInteractions(data || []);
    setNewNote('');
  }

  async function handleDelete() {
    if (isNew) return;
    if (!window.confirm(`Remove ${contact.name} from your CRM?`)) return;
    await onDelete(contact.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />
      <div
        className="relative w-full max-w-lg rounded-[var(--radius-xl)] shadow-2xl overflow-hidden border"
        style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border-strong)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {isNew ? 'New contact' : form.name}
            </h2>
            {!isNew && (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {[form.title, form.company].filter(Boolean).join(' · ') || 'Networking'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-xl leading-none cursor-pointer"
            style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-hover)' }}
          >
            ×
          </button>
        </div>

        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {['details', ...(isNew ? [] : ['activity'])].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-sm font-medium capitalize cursor-pointer transition-colors"
              style={{
                color: tab === t ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
                borderBottom: tab === t ? '2px solid var(--color-accent-bright)' : '2px solid transparent',
                backgroundColor: 'transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[min(70vh,520px)] overflow-y-auto">
          {tab === 'details' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    placeholder="Alex Rivera"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Title
                  </label>
                  <input
                    value={form.title || ''}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Company
                  </label>
                  <input
                    value={form.company || ''}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Email
                  </label>
                  <input
                    value={form.email || ''}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    LinkedIn URL
                  </label>
                  <input
                    value={form.linkedin_url || ''}
                    onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                    className={inputClass}
                    placeholder="https://"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    How you connected
                  </label>
                  <input
                    value={form.how_connected || ''}
                    onChange={(e) => setForm((f) => ({ ...f, how_connected: e.target.value }))}
                    className={inputClass}
                    placeholder="Conference, mutual friend, inbound…"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Outreach status
                  </label>
                  <select
                    value={form.outreach_status}
                    onChange={(e) => setForm((f) => ({ ...f, outreach_status: e.target.value }))}
                    className={inputClass}
                  >
                    {OUTREACH.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => {
                      const on = (form.tags || []).includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium border cursor-pointer transition-colors"
                          style={{
                            borderColor: on ? 'var(--color-accent-bright)' : 'var(--color-border)',
                            backgroundColor: on ? 'var(--color-accent-soft)' : 'transparent',
                            color: on ? 'var(--color-accent-bright)' : 'var(--color-text-secondary)',
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Notes
                  </label>
                  <textarea
                    value={form.notes || ''}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className={`${inputClass} resize-y min-h-[100px]`}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {interactions.map((i) => (
                  <li
                    key={i.id}
                    className="text-sm rounded-xl border px-3 py-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
                  >
                    <p style={{ color: 'var(--color-text-primary)' }}>{i.note}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(i.date_created).toLocaleString()}
                    </p>
                  </li>
                ))}
                {interactions.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No interactions yet.
                  </p>
                )}
              </ul>
              <div className="flex gap-2">
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Log coffee chat, reply, intro…"
                  className="ui-input flex-1 text-sm px-3 py-2.5"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  className="ui-btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-2 px-6 py-4 border-t"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
        >
          {!isNew ? (
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm font-medium px-3 py-2 rounded-xl cursor-pointer text-red-600 dark:text-red-400"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="ui-btn-ghost text-sm px-4 py-2.5 cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="ui-btn-primary text-sm px-5 py-2.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
