const mono = { fontFamily: 'var(--font-mono)' };

/**
 * Applications per week, last 8 weeks. Single-hue bars (accent), current week
 * emphasized in the bright step. `weeks` is oldest → newest:
 * [{ label, count, isCurrent }]
 */
export default function VelocityChart({ weeks, delta }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const up = delta > 0;
  const flat = delta === 0;

  return (
    <section className="border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
      <header
        className="flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-primary)' }}>
          Velocity / apps per week
        </p>
        <p
          className="text-[8px] font-bold uppercase tracking-[0.2em] tabular-nums"
          style={{ ...mono, color: flat ? 'var(--color-text-muted)' : up ? 'var(--color-accent-bright)' : 'var(--color-text-secondary)' }}
          title="This week vs last week"
        >
          {up ? '▲' : flat ? '—' : '▼'} {up ? '+' : ''}{delta} vs last wk
        </p>
      </header>
      <div className="px-4 pt-4 pb-3" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div className="flex items-end gap-[2px] h-28">
          {weeks.map((w) => (
            <div
              key={w.label}
              className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1.5 h-full"
              title={`Week of ${w.label}: ${w.count} application${w.count === 1 ? '' : 's'}`}
            >
              <span className="text-[9px] tabular-nums leading-none" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                {w.count}
              </span>
              <div
                className="w-full max-w-[26px]"
                style={{
                  height: w.count === 0 ? '2px' : `${Math.max((w.count / max) * 84, 4)}px`,
                  backgroundColor: w.count === 0
                    ? 'var(--color-border)'
                    : w.isCurrent
                      ? 'var(--color-accent-bright)'
                      : 'var(--color-accent)',
                  opacity: w.isCurrent || w.count === 0 ? 1 : 0.75,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-[2px] mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {weeks.map((w) => (
            <span
              key={w.label}
              className="flex-1 min-w-0 text-center text-[7px] uppercase tracking-[0.08em] truncate tabular-nums"
              style={{ ...mono, color: w.isCurrent ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}
            >
              {w.isCurrent ? 'Now' : w.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
