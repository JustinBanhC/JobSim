/**
 * Game-style XP strip + milestone glyphs (no emoji).
 */
export default function SkillProgressBar({ percent, stageIndex, stages }) {
  return (
    <div className="flex flex-col gap-2 shrink-0 w-[min(100%,11rem)] sm:w-36" aria-hidden>
      <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, #6d28d9, #c4b5fd)',
            boxShadow: '0 0 12px rgba(196,181,253,0.35)',
          }}
        />
      </div>
      <div
        className="flex justify-between gap-0.5 text-[7px] sm:text-[8px] tracking-[0.14em] uppercase"
        style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
      >
        {stages.map((label, i) => (
          <span
            key={label}
            className="tabular-nums"
            style={{
              color: i <= stageIndex ? 'var(--color-accent-bright)' : undefined,
              opacity: i <= stageIndex ? 1 : 0.45,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
