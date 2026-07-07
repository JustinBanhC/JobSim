const mono = { fontFamily: 'var(--font-mono)' };

export default function StatTile({ label, value, sub, accent = false }) {
  return (
    <div
      className="border px-4 py-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <p className="text-[8px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p
        className="mt-2.5 text-[1.85rem] font-black tabular-nums leading-none tracking-[-0.02em]"
        style={{ color: accent ? 'var(--color-accent-bright)' : 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-2.5 text-[8px] uppercase tracking-[0.18em] leading-relaxed" style={{ ...mono, color: 'var(--color-text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}
