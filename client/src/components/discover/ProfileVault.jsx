import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const mono = { fontFamily: 'var(--font-mono)' };

const FIELDS = [
  { key: 'full_name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'City, State' },
  { key: 'linkedin', label: 'LinkedIn URL' },
  { key: 'github', label: 'GitHub URL' },
  { key: 'website', label: 'Portfolio / website' },
  { key: 'university', label: 'University' },
  { key: 'degree', label: 'Degree(s)' },
  { key: 'graduation', label: 'Graduation (Month Year)' },
  { key: 'gpa', label: 'GPA' },
  { key: 'work_authorization', label: 'Work authorization (e.g. US Citizen)' },
  { key: 'clearance', label: 'Security clearance (level)' },
  { key: 'resume_path', label: 'Resume file path (for manual upload prompts)' },
];

export default function ProfileVault({ onClose }) {
  const [profile, setProfile] = useState({});
  const [extra, setExtra] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    api.copilot.getProfile().then((data) => {
      setProfile(data || {});
      setExtra(data?.extra_notes || '');
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.copilot.saveProfile({ ...profile, extra_notes: extra });
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />
      <div
        className="relative w-full max-w-xl border shadow-2xl max-h-[85vh] flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border-strong)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-primary)' }}>
              Profile vault
            </h2>
            <p className="text-[9px] uppercase tracking-[0.18em] mt-1" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Stored locally · used by the Apply Co-pilot to fill forms
            </p>
          </div>
          <button type="button" onClick={onClose} className="ui-btn-ghost w-9 h-9 text-lg cursor-pointer" aria-label="Close">×</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                  {f.label}
                </label>
                <input
                  value={profile[f.key] || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="ui-input w-full text-[12px] px-3 py-2 mt-1"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Extra notes for the AI (work history, EEO answers, anything forms ask)
            </label>
            <textarea
              rows={5}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className="ui-input w-full text-[12px] px-3 py-2 mt-1 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-[9px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            {savedAt ? `Saved ${savedAt}` : ''}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="ui-btn-primary h-9 px-6 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
