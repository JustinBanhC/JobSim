import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { COLUMNS } from '../hooks/useApplications';

const SOURCES = ['LinkedIn', 'Company Site', 'Referral', 'Indeed', 'Handshake', 'AngelList', 'Other'];

export default function ApplicationModal({ app, onClose, onUpdate, onDelete }) {
  const [form, setForm] = useState({ ...app });
  const [activity, setActivity] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [tab, setTab] = useState('details');

  useEffect(() => {
    supabase.from('application_activity')
      .select('*')
      .eq('application_id', app.id)
      .order('date_created', { ascending: false })
      .then(({ data }) => setActivity(data || []));
  }, [app.id]);

  async function handleSave() {
    await onUpdate(app.id, form);
    onClose();
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    await supabase.from('application_activity').insert({ application_id: app.id, type: 'note', note: newNote });
    const { data } = await supabase.from('application_activity').select('*').eq('application_id', app.id).order('date_created', { ascending: false });
    setActivity(data || []);
    setNewNote('');
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${app.company} - ${app.role}?`)) return;
    await onDelete(app.id);
    onClose();
  }

  const inputClass = 'ui-input w-full text-sm px-3 py-2.5 mt-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />
      <div
        className="relative w-full max-w-lg rounded-[var(--radius-xl)] shadow-2xl overflow-hidden border"
        style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border-strong)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{app.company}</h2>
            <p className="text-[14px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>{app.role}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-xl leading-none cursor-pointer ui-btn-ghost"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex border-b px-2 gap-1" style={{ borderColor: 'var(--color-border)' }}>
          {['details', 'activity'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex-1 py-3 text-[13px] font-semibold capitalize cursor-pointer transition-colors rounded-t-lg"
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

        <div className="p-6 max-h-[min(70vh,560px)] overflow-y-auto">
          {tab === 'details' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Company</label>
                  <input
                    value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Role</label>
                  <input
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className={inputClass}
                  >
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Source</label>
                  <select
                    value={form.source || ''}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">None</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Date Applied</label>
                  <input
                    type="date"
                    value={form.date_applied || ''}
                    onChange={e => setForm(f => ({ ...f, date_applied: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Location</label>
                  <input
                    value={form.location || ''}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Salary Range</label>
                <input
                  value={form.salary_range || ''}
                  onChange={e => setForm(f => ({ ...f, salary_range: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>URL</label>
                <input
                  value={form.url || ''}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Notes</label>
                <textarea
                  rows={3}
                  value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className={`${inputClass} resize-y min-h-[88px]`}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                  className="ui-input flex-1 text-sm px-3 py-2.5"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  className="ui-btn-primary shrink-0 text-sm px-4 py-2.5 cursor-pointer"
                >
                  Add
                </button>
              </div>
              {activity.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  No activity yet
                </p>
              ) : (
                <div className="space-y-2">
                  {activity.map(a => (
                    <div key={a.id} className="flex gap-3 text-sm py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <span className="shrink-0 text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(a.date_created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <div>
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded capitalize"
                          style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                        >
                          {a.type.replace('_', ' ')}
                        </span>
                        <p className="mt-1" style={{ color: 'var(--color-text-primary)' }}>{a.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm font-semibold px-3 py-2.5 rounded-xl cursor-pointer"
            style={{ color: 'var(--color-danger)' }}
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="ui-btn-ghost text-sm px-4 py-2.5 cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="ui-btn-primary text-sm px-5 py-2.5 cursor-pointer">
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
