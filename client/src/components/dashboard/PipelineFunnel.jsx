const mono = { fontFamily: 'var(--font-mono)' };

const CLOSED = new Set(['rejected', 'ghosted', 'withdrawn']);

export default function PipelineFunnel({ columns, counts, total, activeCount }) {
  const max = Math.max(1, ...columns.map((c) => counts[c.id] || 0));

  return (
    <section className="border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
      <header
        className="flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-primary)' }}>
          Pipeline funnel
        </p>
        <p className="text-[8px] uppercase tracking-[0.2em] tabular-nums" style={{ ...mono, color: 'var(--color-text-muted)' }}>
          {activeCount} active / {total} total
        </p>
      </header>
      <div className="px-4 py-4 flex flex-col gap-[7px]" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        {columns.map((col) => {
          const n = counts[col.id] || 0;
          const closed = CLOSED.has(col.id);
          return (
            <div
              key={col.id}
              className="grid grid-cols-[7.5rem_1fr_2.25rem] items-center gap-3"
              title={`${col.label}: ${n} application${n === 1 ? '' : 's'}`}
            >
              <span
                className="text-[8px] font-bold uppercase tracking-[0.18em] truncate"
                style={{ ...mono, color: closed ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}
              >
                {col.label}
              </span>
              <div className="h-[9px] w-full" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <div
                  className="h-full"
                  style={{
                    width: n === 0 ? 0 : `max(${(n / max) * 100}%, 3px)`,
                    backgroundColor: col.color,
                    opacity: closed ? 0.4 : 0.92,
                  }}
                />
              </div>
              <span
                className="text-[10px] font-bold tabular-nums text-right"
                style={{ ...mono, color: n === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}
              >
                {n}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
