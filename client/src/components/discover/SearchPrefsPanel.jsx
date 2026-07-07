import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const mono = { fontFamily: 'var(--font-mono)' };

const SENIORITY_OPTIONS = [
  { id: 'intern', label: 'Intern' },
  { id: 'new_grad', label: 'New grad' },
  { id: 'junior', label: 'Junior' },
  { id: 'mid', label: 'Mid' },
  { id: 'senior', label: 'Senior' },
];

function SectionLabel({ children }) {
  return (
    <label className="block text-[9px] font-bold uppercase tracking-[0.18em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
      {children}
    </label>
  );
}

function TagInput({ tags, onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  function commit() {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...tags, ...parts.filter((p) => !tags.includes(p))]);
    setDraft('');
  }

  return (
    <div className="mt-1">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] uppercase tracking-[0.12em]"
              style={{ ...mono, borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(tags.filter((x) => x !== t))}
                className="cursor-pointer opacity-60 hover:opacity-100"
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder || 'Type and press Enter or comma…'}
        className="ui-input w-full text-[11px] px-3 py-2"
        style={mono}
      />
    </div>
  );
}

export default function SearchPrefsPanel({ onClose, onSaved }) {
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.discovery.prefs.get()
      .then(setPrefs)
      .catch((e) => setError(e.message));
  }, []);

  function set(key, value) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function setRole(idx, key, value) {
    setPrefs((p) => ({
      ...p,
      target_roles: p.target_roles.map((r, i) => (i === idx ? { ...r, [key]: value } : r)),
    }));
  }

  function toggleSeniority(id) {
    setPrefs((p) => ({
      ...p,
      seniority: p.seniority.includes(id) ? p.seniority.filter((s) => s !== id) : [...p.seniority, id],
    }));
  }

  async function save({ rescore = false } = {}) {
    setError('');
    setSaving(true);
    if (rescore) setRescoring(true);
    try {
      const saved = await api.discovery.prefs.save(prefs);
      setPrefs(saved);
      setStatus(`Saved ${new Date().toLocaleTimeString()}`);
      if (rescore) {
        setStatus('Saved — rescoring all jobs…');
        const result = await api.discovery.rescoreAll();
        setStatus(`Saved — rescored ${result.scored} jobs${result.failed ? `, ${result.failed} failed` : ''}`);
        onSaved?.();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setRescoring(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />
      <div
        className="relative w-full max-w-2xl border shadow-2xl max-h-[85vh] flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border-strong)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-primary)' }}>
              Target roles
            </h2>
            <p className="text-[9px] uppercase tracking-[0.18em] mt-1" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Stored locally · drives the hard filter and AI scoring rubric
            </p>
          </div>
          <button type="button" onClick={onClose} className="ui-btn-ghost w-9 h-9 text-lg cursor-pointer" aria-label="Close">×</button>
        </div>

        {!prefs ? (
          <div className="p-10 text-center text-[10px] uppercase tracking-[0.3em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            {error || 'Loading…'}
          </div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-5">
            <div>
              <SectionLabel>Target roles (highest priority first · band is an optional score hint, e.g. 90+ or 80-95)</SectionLabel>
              <div className="space-y-2 mt-1">
                {prefs.target_roles.map((role, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      value={role.description}
                      onChange={(e) => setRole(i, 'description', e.target.value)}
                      placeholder="e.g. AI/ML research, embedded systems…"
                      className="ui-input flex-1 text-[11px] px-3 py-2"
                      style={mono}
                    />
                    <input
                      value={role.band}
                      onChange={(e) => setRole(i, 'band', e.target.value)}
                      placeholder="band"
                      className="ui-input w-20 text-[11px] px-2 py-2"
                      style={mono}
                    />
                    <button
                      type="button"
                      onClick={() => set('target_roles', prefs.target_roles.filter((_, j) => j !== i))}
                      className="ui-btn-ghost w-9 h-9 shrink-0 cursor-pointer"
                      aria-label="Remove role"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set('target_roles', [...prefs.target_roles, { description: '', band: '' }])}
                  className="ui-btn-ghost h-8 px-4 text-[9px] uppercase tracking-[0.2em] cursor-pointer"
                  style={mono}
                >
                  + Add role
                </button>
              </div>
            </div>

            <div>
              <SectionLabel>Seniority levels to accept</SectionLabel>
              <div className="flex flex-wrap gap-4 mt-2">
                {SENIORITY_OPTIONS.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-[10px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={prefs.seniority.includes(opt.id)}
                      onChange={() => toggleSeniority(opt.id)}
                      className="cursor-pointer"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SectionLabel>Security clearance</SectionLabel>
                <label className="flex items-center gap-2 mt-2 cursor-pointer text-[10px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={prefs.has_clearance}
                    onChange={(e) => set('has_clearance', e.target.checked)}
                    className="cursor-pointer"
                  />
                  I hold a clearance (cleared roles become a boost)
                </label>
              </div>
              <div>
                <SectionLabel>Discard jobs demanding ≥ N years experience (blank = no cap)</SectionLabel>
                <input
                  type="number"
                  min="1"
                  value={prefs.max_experience_years ?? ''}
                  onChange={(e) => set('max_experience_years', e.target.value === '' ? null : Number(e.target.value))}
                  className="ui-input w-24 text-[11px] px-3 py-2 mt-1"
                  style={mono}
                />
              </div>
            </div>

            <div>
              <SectionLabel>Boost keywords (nudge matching jobs up)</SectionLabel>
              <TagInput tags={prefs.boost_keywords} onChange={(v) => set('boost_keywords', v)} />
            </div>

            <div>
              <SectionLabel>Avoid keywords (penalized, not discarded)</SectionLabel>
              <TagInput tags={prefs.avoid_keywords} onChange={(v) => set('avoid_keywords', v)} />
            </div>

            <div>
              <SectionLabel>Discard title keywords (jobs whose title matches are dropped outright)</SectionLabel>
              <TagInput tags={prefs.discard_title_keywords} onChange={(v) => set('discard_title_keywords', v)} />
            </div>

            <div>
              <SectionLabel>Priority flags (special interests the AI should flag and score 85+)</SectionLabel>
              <textarea
                rows={2}
                value={prefs.priority_flags}
                onChange={(e) => set('priority_flags', e.target.value)}
                className="ui-input w-full text-[12px] px-3 py-2 mt-1 resize-none"
              />
            </div>

            <div>
              <SectionLabel>Extra instructions for the AI judge</SectionLabel>
              <textarea
                rows={3}
                value={prefs.extra_instructions}
                onChange={(e) => set('extra_instructions', e.target.value)}
                placeholder="e.g. Prefer remote-friendly roles; weight startups higher…"
                className="ui-input w-full text-[12px] px-3 py-2 mt-1 resize-none"
              />
            </div>

            {error && (
              <p className="text-[10px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-danger)' }}>
                {error}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <p className="flex-1 min-w-0 truncate text-[9px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            {status}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!prefs || saving}
              onClick={() => save({ rescore: true })}
              className="ui-btn-ghost h-9 px-4 text-[9px] font-bold uppercase tracking-[0.2em] cursor-pointer disabled:opacity-50"
              style={mono}
              title="Save prefs, reset scores on all non-dismissed jobs and rescore them"
            >
              {rescoring ? 'Rescoring…' : 'Save & rescore all'}
            </button>
            <button
              type="button"
              disabled={!prefs || saving}
              onClick={() => save()}
              className="ui-btn-primary h-9 px-6 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer disabled:opacity-50"
            >
              {saving && !rescoring ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
