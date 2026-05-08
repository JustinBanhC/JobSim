const mono = { fontFamily: 'var(--font-mono)' };

/**
 * @param {'default' | 'dossier'} [variant]
 */
export default function PageHeader({ variant = 'default', eyebrow, title, description, actions }) {
  if (variant === 'dossier') {
    return (
      <header
        className="border-b px-5 md:px-10 lg:px-14 pt-10 md:pt-14 pb-10 md:pb-12"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 lg:gap-20">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[9px] font-bold uppercase tracking-[0.38em] mb-4" style={{ ...mono, color: 'var(--color-text-muted)' }}>
                {eyebrow}
              </p>
            )}
            <h1
              className="text-[clamp(2.25rem,7.5vw,4.75rem)] font-black uppercase tracking-[-0.04em] leading-[0.92]"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
            >
              {title}
            </h1>
          </div>
          <div className="lg:max-w-[22rem] shrink-0 lg:pt-2 flex flex-col gap-6 items-start lg:items-end text-left lg:text-right">
            {description && (
              <p className="text-[10px] uppercase tracking-[0.18em] leading-relaxed" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
                {description}
              </p>
            )}
            {actions && <div className="flex flex-wrap gap-3 justify-start lg:justify-end w-full">{actions}</div>}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 px-5 md:px-10 lg:px-14 pt-10 md:pt-12 pb-8"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <div className="space-y-2 max-w-3xl">
        {eyebrow && (
          <p className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
            {eyebrow}
          </p>
        )}
        <h1
          className="text-[1.65rem] md:text-[2.25rem] font-black uppercase tracking-[-0.03em] leading-[1.1]"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
        >
          {title}
        </h1>
        {description && (
          <p className="text-[10px] uppercase tracking-[0.18em] leading-relaxed max-w-2xl" style={{ ...mono, color: 'var(--color-text-secondary)' }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>}
    </header>
  );
}
