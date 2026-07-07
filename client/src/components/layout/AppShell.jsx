import { useState, useEffect } from 'react';

const WORKSPACE = { name: 'JobSim', slug: 'Hunt console' };

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    rail: 'Mission control / signals',
    icon: 'gauge',
  },
  {
    id: 'applications',
    label: 'Job applications',
    rail: 'Pipeline / stages / SLAs',
    icon: 'ticket',
  },
  {
    id: 'discover',
    label: 'Radar',
    rail: 'Auto-discovery / AI scoring',
    icon: 'radar',
  },
  {
    id: 'skills',
    label: 'Skill tree',
    rail: 'Learn · unlock · progression',
    icon: 'tree',
  },
  {
    id: 'connections',
    label: 'Contacts',
    rail: 'People / outreach log',
    icon: 'people',
  },
  {
    id: 'events',
    label: 'Events',
    rail: 'Fairs / hiring events',
    icon: 'calendar',
  },
];

function NavIcon({ name, active }) {
  const stroke = active ? 'var(--color-accent-bright)' : 'currentColor';
  const common = {
    width: 17,
    height: 17,
    fill: 'none',
    stroke,
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  if (name === 'gauge') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M4 19a9 9 0 1 1 16 0" />
        <path d="M12 15 16 9" />
        <circle cx="12" cy="15" r="1" fill={stroke} />
      </svg>
    );
  }
  if (name === 'ticket') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M14 3h7v7h-2a2 2 0 1 1-4 0h-1V3z" />
        <path d="M10 21H3v-7h2a2 2 0 1 1 4 0h1v7z" />
        <path d="M3 10V3h7v2a2 2 0 1 1-4 0H3z" />
        <path d="M21 14v7h-7v-2a2 2 0 1 1 4 0h3z" />
      </svg>
    );
  }
  if (name === 'radar') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" fill={stroke} />
        <path d="M12 12 18 5" />
      </svg>
    );
  }
  if (name === 'tree') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M12 22V11" />
        <path d="M12 11 7 7M12 11l5-4" />
        <path d="M7 7 5 4M7 7h4" />
        <path d="M17 7l2-3M17 7h-4" />
        <path
          d="M12 2.5 14 5 12 7.5 10 5z"
          fill={active ? 'var(--color-accent-bright)' : 'none'}
          stroke={stroke}
        />
      </svg>
    );
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <rect x="3" y="5" width="18" height="16" />
        <path d="M3 10h18M8 2v6M16 2v6" />
        <circle cx="12" cy="15.5" r="1.5" fill={stroke} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function AppShell({ view, onViewChange, onShowLanding, onAgentToggle, onSignOut, userEmail, children }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('theme');
    if (stored === 'light') return false;
    if (stored === 'dark') return true;
    return true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="jobsim-workspace min-h-screen flex" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <aside
        className="hidden md:flex w-[268px] shrink-0 flex-col py-8 px-0"
        style={{
          backgroundColor: 'var(--color-sidebar)',
          borderRight: '1px solid var(--color-sidebar-border)',
        }}
      >
        <div className="px-5 mb-10">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 shrink-0 flex items-center justify-center text-[10px] font-black tracking-tighter"
              style={{
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-accent-bright)',
                backgroundColor: 'var(--color-bg-primary)',
              }}
            >
              JS
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13px] font-black uppercase tracking-[0.12em] truncate" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                {WORKSPACE.name}
              </p>
              <p className="text-[9px] uppercase tracking-[0.22em] mt-1 truncate" style={{ color: 'var(--color-sidebar-muted)', fontFamily: 'var(--font-mono)' }}>
                {WORKSPACE.slug}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex flex-col flex-1 px-0 overflow-y-auto border-t border-white/[0.05]" aria-label="Primary">
          <p
            className="px-5 pt-5 pb-2 text-[8px] font-bold uppercase tracking-[0.3em]"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Index
          </p>
          {NAV_ITEMS.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                className="relative text-left w-full cursor-pointer py-3.5 pl-5 pr-3 transition-[background-color,color] duration-150 motion-reduce:transition-none border-l-2"
                style={{
                  borderLeftColor: active ? 'var(--color-accent-bright)' : 'transparent',
                  backgroundColor: active ? 'var(--color-sidebar-active-bg)' : 'transparent',
                  color: active ? 'var(--color-text-primary)' : 'var(--color-sidebar-muted)',
                }}
              >
                <span className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5 opacity-90">
                    <NavIcon name={item.icon} active={active} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.1em] leading-snug" style={{ fontFamily: 'var(--font-mono)' }}>{item.label}</span>
                    <span
                      className="block text-[8px] uppercase tracking-[0.18em] mt-1.5 leading-snug truncate opacity-80"
                      style={{ fontFamily: 'var(--font-mono)', color: active ? 'var(--color-text-secondary)' : undefined }}
                    >
                      {item.rail}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/[0.06] px-5 flex flex-col gap-1">
          {typeof onAgentToggle === 'function' && (
            <button
              type="button"
              onClick={onAgentToggle}
              className="text-left flex items-center gap-2 py-2 text-[10px] font-mono uppercase tracking-[0.18em] cursor-pointer transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-accent-bright)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
                <circle cx="9" cy="6.5" r="0.5" fill="currentColor" />
                <circle cx="15" cy="6.5" r="0.5" fill="currentColor" />
              </svg>
              AI Agent
            </button>
          )}
          {typeof onShowLanding === 'function' && (
            <button
              type="button"
              onClick={onShowLanding}
              className="text-left text-[10px] font-mono uppercase tracking-[0.2em] py-2 cursor-pointer transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-sidebar-muted)' }}
            >
              ← Intro / moon
            </button>
          )}
          <button
            type="button"
            onClick={() => setDark(!dark)}
            className="text-left flex items-center gap-2 py-2 text-[10px] font-mono uppercase tracking-[0.18em] cursor-pointer transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-sidebar-muted)' }}
            title={dark ? 'Light' : 'Dark'}
          >
            {dark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          {userEmail && (
            <div className="pt-3 mt-2 border-t border-white/[0.05]">
              <p className="text-[8px] uppercase tracking-[0.2em] truncate mb-2" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {userEmail}
              </p>
              {typeof onSignOut === 'function' && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="text-left text-[10px] font-mono uppercase tracking-[0.2em] py-1 cursor-pointer transition-opacity hover:opacity-80"
                  style={{ color: 'var(--color-danger)' }}
                >
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 app-main-bg" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <header
          className="md:hidden flex items-center justify-between px-4 py-3.5 gap-2"
          style={{
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 shrink-0 flex items-center justify-center text-[9px] font-black"
              style={{
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-accent-bright)',
              }}
            >
              JS
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.14em] truncate" style={{ color: 'var(--color-text-primary)' }}>
              {WORKSPACE.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {typeof onAgentToggle === 'function' && (
              <button
                type="button"
                onClick={onAgentToggle}
                className="p-2 shrink-0 cursor-pointer font-mono text-[10px] uppercase tracking-widest"
                style={{ color: 'var(--color-accent-bright)', border: '1px solid var(--color-accent-muted)' }}
                aria-label="AI Agent"
              >
                AI
              </button>
            )}
            <button
              type="button"
              onClick={() => setDark(!dark)}
              className="p-2 shrink-0 cursor-pointer font-mono text-[10px] uppercase tracking-widest"
              style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              aria-label="Toggle appearance"
            >
              {dark ? 'LT' : 'DK'}
            </button>
          </div>
        </header>

        <div
          className="md:hidden flex gap-0 overflow-x-auto border-b"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
        >
          {NAV_ITEMS.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                className="flex-1 min-w-[25%] py-3 text-[10px] font-bold uppercase tracking-[0.12em] cursor-pointer border-b-2 transition-colors"
                style={{
                  borderBottomColor: active ? 'var(--color-accent-bright)' : 'transparent',
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  backgroundColor: active ? 'var(--color-bg-primary)' : 'transparent',
                }}
              >
                {item.label.split(' ')[0]}
              </button>
            );
          })}
        </div>

        <main className="flex-1 flex flex-col min-h-0">{children}</main>
      </div>
    </div>
  );
}
