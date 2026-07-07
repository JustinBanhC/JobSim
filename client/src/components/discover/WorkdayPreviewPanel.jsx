import { useState } from 'react';
import { api } from '../../lib/api';

const mono = { fontFamily: 'var(--font-mono)' };

const TYPE_HINTS = { select: 'dropdown', textarea: 'long text', file: 'file upload', date: 'date', text: 'text' };

function SectionHeader({ title, note }) {
  return (
    <div className="pt-4 pb-2 first:pt-0">
      <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-primary)' }}>
        {title}
      </p>
      {note && (
        <p className="text-[8px] uppercase tracking-[0.12em] mt-1 leading-relaxed" style={{ ...mono, color: 'var(--color-text-muted)' }}>
          {note}
        </p>
      )}
    </div>
  );
}

export default function WorkdayPreviewPanel({ job }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // { sections, posting_detail, note, answers_source, … }
  const [values, setValues] = useState({}); // key → value (editable)
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [log, setLog] = useState([]);

  const isWorkday = job?.url?.includes('myworkdayjobs.com');
  if (!isWorkday) return null;

  function applyAnswers(answers) {
    const next = {};
    for (const a of answers || []) next[a.key] = a.value;
    setValues(next);
  }

  async function load({ regenerate } = {}) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.workday.preview(job.id, { regenerate });
      setPreview(data);
      applyAnswers(data.answers);
      setOpen(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toAnswerArray() {
    const out = [];
    for (const s of preview?.sections || []) {
      for (const f of s.fields) {
        const v = (values[f.key] || '').trim();
        if (v) out.push({ key: f.key, label: f.label, section: f.section, value: v });
      }
    }
    return out;
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.workday.saveAnswers(job.id, toAnswerArray());
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function appendLog(line, tone = 'default') {
    setLog((prev) => [...prev.slice(-50), { line, tone }]);
  }

  async function launchCopilot() {
    setLaunching(true);
    setLog([]);
    try {
      await api.workday.saveAnswers(job.id, toAnswerArray()); // co-pilot reads saved answers
      appendLog('Answers saved — launching co-pilot browser…', 'ok');
    } catch (e) {
      appendLog(`Could not save answers first: ${e.message}`, 'error');
      setLaunching(false);
      return;
    }
    const { promise } = api.copilot.apply(job.id, (event, data) => {
      if (event === 'log') appendLog(data.msg);
      if (event === 'fields_found') appendLog(`Found ${data.count} empty fields`, 'ok');
      if (event === 'filled') appendLog(`✓ ${data.label} ← "${data.value}"${data.source === 'saved' ? ' [saved answer]' : ''}`, 'ok');
      if (event === 'done') appendLog(data.msg, 'ok');
      if (event === 'error') appendLog(`ERROR: ${data.message}`, 'error');
    });
    try {
      await promise;
    } catch (e) {
      appendLog(e.message, 'error');
    } finally {
      setLaunching(false);
    }
  }

  const detail = preview?.posting_detail;

  return (
    <div className="pt-2 space-y-3">
      <button
        type="button"
        disabled={loading}
        onClick={() => (open && preview ? setOpen(false) : preview ? setOpen(true) : load())}
        className="ui-btn-ghost h-9 px-4 text-[9px] font-black uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
        style={mono}
        title="Builds a preview of the standard Workday application form and prefills answers from your profile vault."
      >
        {loading ? 'Building preview…' : open ? 'Hide Workday form preview' : '▤ Preview Workday form'}
      </button>

      {error && (
        <p className="text-[9px] uppercase tracking-[0.12em]" style={{ ...mono, color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      {open && preview && (
        <div className="border p-4 space-y-4" style={{ borderColor: 'var(--color-border-strong)', backgroundColor: 'var(--color-bg-card)' }}>
          {/* Posting detail header */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-primary)' }}>
              {detail?.title || job.role}
            </p>
            <p className="text-[9px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              {[detail?.job_req_id && `req ${detail.job_req_id}`, detail?.location, detail?.time_type, detail?.posted_on]
                .filter(Boolean)
                .join(' · ') || 'Posting detail unavailable'}
            </p>
          </div>
          {preview.detail_error && (
            <p className="text-[8px] uppercase tracking-[0.12em]" style={{ ...mono, color: 'var(--color-danger)' }}>
              Live posting detail fetch failed ({preview.detail_error}) — showing the standard template only.
            </p>
          )}

          {/* Honesty note */}
          <p
            className="text-[8px] uppercase tracking-[0.12em] leading-relaxed border-l-2 pl-3"
            style={{ ...mono, color: 'var(--color-text-muted)', borderColor: 'var(--color-accent-muted)' }}
          >
            {preview.note}
          </p>

          {/* Side-by-side: form preview (left) + editable answers (right); stacked on small screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
            {/* LEFT: form preview grouped by Workday section headers */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] pb-2 border-b" style={{ ...mono, color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>
                Form preview
              </p>
              {preview.sections.map((s) => (
                <div key={s.id}>
                  <SectionHeader title={s.title} note={s.note} />
                  <div className="space-y-2">
                    {s.fields.map((f) => (
                      <div key={f.key}>
                        <div className="flex items-baseline justify-between gap-2">
                          <label className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                            {f.label}
                          </label>
                          <span className="text-[7px] uppercase tracking-[0.15em] shrink-0" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                            {TYPE_HINTS[f.type] || f.type}
                          </span>
                        </div>
                        <div
                          className="mt-1 px-3 py-2 border text-[11px] min-h-[34px] whitespace-pre-wrap break-words"
                          style={{
                            borderColor: 'var(--color-border)',
                            color: values[f.key] ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                            backgroundColor: 'var(--color-bg-secondary)',
                          }}
                        >
                          {f.type === 'file'
                            ? '⇪ attached manually in the browser'
                            : values[f.key] || (f.options ? `— select: ${f.options.slice(0, 4).join(' / ')}${f.options.length > 4 ? ' / …' : ''}` : '—')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT: editable answers */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] pb-2 border-b" style={{ ...mono, color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>
                Your answers ({preview.answers_source === 'saved' ? 'saved' : preview.answers_source === 'ai' ? 'AI prefilled' : 'prefilled from profile'})
              </p>
              {preview.answers_source === 'heuristic' && preview.ai_error && (
                <p className="text-[8px] uppercase tracking-[0.12em] mt-2" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                  AI prefill unavailable ({preview.ai_error}) — basic profile fields were copied in.
                </p>
              )}
              {preview.sections.map((s) => (
                <div key={s.id}>
                  <SectionHeader title={s.title} />
                  <div className="space-y-2">
                    {s.fields.filter((f) => f.type !== 'file').map((f) => (
                      <div key={f.key}>
                        <label className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                          {f.label}
                        </label>
                        {f.type === 'select' ? (
                          <select
                            value={values[f.key] || ''}
                            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                            className="ui-input w-full text-[11px] px-3 py-2 mt-1"
                            style={mono}
                          >
                            <option value="">— leave blank —</option>
                            {(f.options || []).map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        ) : f.type === 'textarea' ? (
                          <textarea
                            rows={3}
                            value={values[f.key] || ''}
                            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                            className="ui-input w-full text-[11px] px-3 py-2 mt-1 resize-none"
                          />
                        ) : (
                          <input
                            value={values[f.key] || ''}
                            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                            className="ui-input w-full text-[11px] px-3 py-2 mt-1"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              type="button"
              disabled={saving || launching}
              onClick={save}
              className="ui-btn-primary h-9 px-4 text-[9px] font-black uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save answers'}
            </button>
            <button
              type="button"
              disabled={loading || launching}
              onClick={() => load({ regenerate: true })}
              className="ui-btn-ghost h-9 px-4 text-[9px] uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
              style={mono}
              title="Discards the shown answers and asks the AI to prefill again from your profile vault."
            >
              {loading ? 'Regenerating…' : 'Regenerate with AI'}
            </button>
            <button
              type="button"
              disabled={launching}
              onClick={launchCopilot}
              className="ui-btn-ghost h-9 px-4 text-[9px] font-black uppercase tracking-[0.18em] cursor-pointer disabled:opacity-50"
              style={mono}
              title="Saves these answers, then opens the co-pilot browser. Saved answers take priority over raw profile data; company-specific questions are handled live."
            >
              {launching ? 'Co-pilot active — see browser window' : '⚡ Launch co-pilot with these answers'}
            </button>
            {savedAt && (
              <span className="text-[8px] uppercase tracking-[0.15em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                Saved {savedAt}
              </span>
            )}
          </div>

          {log.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto border-l-2 pl-3" style={{ borderColor: 'var(--color-border)' }}>
              {log.map((entry, i) => (
                <p
                  key={i}
                  className="text-[9px] uppercase tracking-[0.1em] leading-relaxed"
                  style={{
                    ...mono,
                    color: entry.tone === 'error' ? 'var(--color-danger)' : entry.tone === 'ok' ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
                  }}
                >
                  {entry.line}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
