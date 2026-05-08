import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'nice', label: 'Nice to have' },
];

const STATUSES = [
  { id: 'not_started', label: 'Not started' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Completed' },
];

function emptyForm() {
  return {
    name: '',
    priority: 'medium',
    current_level: '',
    target_level: '',
    status: 'not_started',
    resources: '',
  };
}

export default function SkillModal({ skill, onClose, onCreate, onUpdate, onDelete }) {
  const isNew = !skill;
  const [form, setForm] = useState(() => (isNew ? emptyForm() : { ...skill }));
  const [logs, setLogs] = useState([]);
  const [logTopic, setLogTopic] = useState('');
  const [logMinutes, setLogMinutes] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [tab, setTab] = useState('details');

  useEffect(() => {
    if (isNew) {
      setForm(emptyForm());
      setLogs([]);
      return;
    }
    setForm({ ...skill });
    supabase.from('learning_logs')
      .select('*')
      .eq('skill_id', skill.id)
      .order('date_created', { ascending: false })
      .then(({ data }) => setLogs(data || []));
  }, [skill, isNew]);

  const inputClass = 'ui-input w-full text-sm px-3 py-2.5 mt-1';

  async function handleSave() {
    if (!form.name.trim()) return;
    if (isNew) {
      await onCreate({ ...form, name: form.name.trim() });
    } else {
      await onUpdate(skill.id, form);
    }
    onClose();
  }

  async function handleAddLog() {
    if (isNew || !logTopic.trim()) return;
    await supabase.from('learning_logs').insert({
      skill_id: skill.id,
      topic: logTopic.trim(),
      time_spent: logMinutes === '' ? null : Number(logMinutes),
      notes: logNotes.trim() || null,
    });
    const { data } = await supabase.from('learning_logs').select('*').eq('skill_id', skill.id).order('date_created', { ascending: false });
    setLogs(data || []);
    setLogTopic('');
    setLogMinutes('');
    setLogNotes('');
  }

  async function handleDelete() {
    if (isNew) return;
    if (!window.confirm(`Delete skill “${skill.name}”?`)) return;
    await onDelete(skill.id);
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
              {isNew ? 'New skill' : form.name}
            </h2>
            {!isNew && (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Learning roadmap entry
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
          {['details', ...(isNew ? [] : ['log'])].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-sm font-medium capitalize cursor-pointer"
              style={{
                color: tab === t ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
                borderBottom: tab === t ? '2px solid var(--color-accent-bright)' : '2px solid transparent',
              }}
            >
              {t === 'log' ? 'Learning log' : t}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[min(70vh,520px)] overflow-y-auto">
          {tab === 'details' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Skill
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. System design"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    className={inputClass}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className={inputClass}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Current level
                  </label>
                  <input
                    value={form.current_level || ''}
                    onChange={(e) => setForm((f) => ({ ...f, current_level: e.target.value }))}
                    className={inputClass}
                    placeholder="Comfortable with basics"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Target level
                  </label>
                  <input
                    value={form.target_level || ''}
                    onChange={(e) => setForm((f) => ({ ...f, target_level: e.target.value }))}
                    className={inputClass}
                    placeholder="Ship small services solo"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Resources
                </label>
                <textarea
                  value={form.resources || ''}
                  onChange={(e) => setForm((f) => ({ ...f, resources: e.target.value }))}
                  rows={3}
                  className={`${inputClass} resize-y min-h-[100px]`}
                  placeholder="Courses, docs, repos…"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ul className="space-y-2 max-h-44 overflow-y-auto">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
                  >
                    <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {log.topic}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(log.date_created).toLocaleDateString()}
                      {log.time_spent != null && ` · ${log.time_spent} min`}
                    </p>
                    {log.notes && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {log.notes}
                      </p>
                    )}
                  </li>
                ))}
                {logs.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No sessions logged yet.
                  </p>
                )}
              </ul>
              <div className="space-y-2">
                <input
                  value={logTopic}
                  onChange={(e) => setLogTopic(e.target.value)}
                  placeholder="What you worked on"
                  className="ui-input w-full text-sm px-3 py-2.5"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(e.target.value)}
                    placeholder="Minutes"
                    className="ui-input w-28 text-sm px-3 py-2.5 shrink-0"
                  />
                  <input
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="ui-input flex-1 text-sm px-3 py-2.5 min-w-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddLog}
                  className="ui-btn-primary w-full py-3 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Log session
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
            <button type="button" onClick={handleDelete} className="text-sm font-medium text-red-600 dark:text-red-400 cursor-pointer">
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
