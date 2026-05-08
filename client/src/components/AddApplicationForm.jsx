import { useState } from 'react';

const SOURCES = ['LinkedIn', 'Company Site', 'Referral', 'Indeed', 'Handshake', 'AngelList', 'Other'];

export default function AddApplicationForm({ defaultStatus, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    company: '',
    role: '',
    status: defaultStatus,
    source: '',
    url: '',
    location: '',
    salary_range: '',
    notes: '',
    date_applied: defaultStatus === 'applied' ? new Date().toISOString().split('T')[0] : '',
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    onSubmit(form);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-lg)] border p-3.5 space-y-2.5 ui-panel-glass"
      style={{ borderColor: 'var(--color-border-strong)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        Quick add
      </p>
      <input
        autoFocus
        placeholder="Company"
        value={form.company}
        onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
        className="ui-input w-full text-[13px] px-3 py-2.5"
      />
      <input
        placeholder="Role title"
        value={form.role}
        onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
        className="ui-input w-full text-[13px] px-3 py-2.5"
      />
      <div className="flex gap-2">
        <select
          value={form.source}
          onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
          className="ui-input flex-1 text-[13px] px-3 py-2.5 min-w-0"
        >
          <option value="">Source</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.date_applied}
          onChange={(e) => setForm((f) => ({ ...f, date_applied: e.target.value }))}
          className="ui-input flex-1 text-[13px] px-3 py-2.5 min-w-0"
          aria-label="Date applied"
        />
      </div>
      <input
        placeholder="Location (optional)"
        value={form.location}
        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        className="ui-input w-full text-[13px] px-3 py-2.5"
      />
      <div className="flex gap-2 pt-1">
        <button type="submit" className="ui-btn-primary flex-1 text-[13px] font-semibold py-2.5 cursor-pointer">
          Add
        </button>
        <button type="button" onClick={onCancel} className="ui-btn-ghost flex-1 text-[13px] font-semibold py-2.5 cursor-pointer">
          Cancel
        </button>
      </div>
    </form>
  );
}
