import { useMemo } from 'react';

/**
 * Hand-drawn moon — preserved as-is (paths, gradients, craters).
 */
function MoonDrawing({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="moonFace" x1="30%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#f4f0ff" />
          <stop offset="45%" stopColor="#e8dff8" />
          <stop offset="100%" stopColor="#cfc0ea" />
        </linearGradient>
      </defs>
      <path
        d="M 148 38 C 178 58 188 98 178 132 C 168 168 128 192 88 188 C 48 184 18 152 22 112 C 26 72 58 36 98 32 C 118 30 136 32 148 38 Z"
        fill="url(#moonFace)"
        stroke="#9b7ec4"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.98"
      />
      <path
        d="M 102 48 Q 72 72 68 108 Q 66 138 88 158"
        stroke="#b39ddb"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <ellipse cx="118" cy="88" rx="14" ry="12" stroke="#a78bca" strokeWidth="1.2" fill="#ddd4f0" opacity="0.5" />
      <ellipse cx="72" cy="128" rx="10" ry="9" stroke="#a78bca" strokeWidth="1" fill="#e5dcf5" opacity="0.45" />
      <ellipse cx="132" cy="138" rx="8" ry="7" stroke="#9b7ec4" strokeWidth="1" fill="none" opacity="0.7" />
      <circle cx="94" cy="96" r="3" fill="#9b7ec4" opacity="0.35" />
      <circle cx="124" cy="118" r="2.2" fill="#8b6bb8" opacity="0.4" />
    </svg>
  );
}

function MovingStarsBehindMoon() {
  const stars = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => {
        const left = ((i * 47.17 + 13) % 100);
        const top = ((i * 61.91 + 7) % 100);
        const size = 1 + (i % 3);
        const duration = 10 + (i % 9) + (i % 5) * 0.4;
        const delay = -(i * 0.35);
        const dx = 8 + (i % 11) * 1.4;
        const dy = -(10 + (i % 13) * 1.6);
        const o1 = 0.28 + (i % 6) * 0.06;
        const o2 = 0.75 + (i % 4) * 0.05;
        return { left, top, size, duration, delay, dx, dy, o1, o2 };
      }),
    []
  );

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="landing-star-motion absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            marginLeft: '-1px',
            marginTop: '-1px',
            boxShadow: '0 0 4px rgba(196, 181, 253, 0.35)',
            animation: `landing-star-drift ${s.duration}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
            '--star-dx': `${s.dx}px`,
            '--star-dy': `${s.dy}px`,
            '--star-o1': String(s.o1),
            '--star-o2': String(s.o2),
          }}
        />
      ))}
    </div>
  );
}

function GlossySpaceBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Deep black base */}
      <div className="absolute inset-0 bg-[#020204]" />
      {/* Glossy “photo” nebula layers — space purple */}
      <div
        className="landing-nebula-blob absolute -left-[20%] -top-[15%] w-[85%] h-[75%] rounded-full opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 40% 45%, rgba(139, 92, 246, 0.42) 0%, rgba(76, 29, 149, 0.15) 45%, transparent 70%)',
          filter: 'blur(48px)',
          animation: 'landing-nebula-drift 28s ease-in-out infinite',
        }}
      />
      <div
        className="landing-nebula-blob absolute -right-[25%] top-[10%] w-[90%] h-[80%] rounded-full opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 55% 40%, rgba(167, 139, 250, 0.35) 0%, rgba(88, 28, 135, 0.2) 50%, transparent 68%)',
          filter: 'blur(56px)',
          animation: 'landing-nebula-drift 36s ease-in-out infinite reverse',
          animationDelay: '-8s',
        }}
      />
      <div
        className="landing-nebula-blob absolute left-[15%] -bottom-[20%] w-[70%] h-[60%] rounded-full opacity-55"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(192, 132, 252, 0.22) 0%, rgba(49, 46, 129, 0.35) 55%, transparent 72%)',
          filter: 'blur(64px)',
          animation: 'landing-nebula-drift 32s ease-in-out infinite',
          animationDelay: '-14s',
        }}
      />
      {/* Specular / glossy rim light */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          background:
            'linear-gradient(125deg, rgba(255,255,255,0.12) 0%, transparent 35%, transparent 65%, rgba(196,181,253,0.08) 100%)',
        }}
      />
      {/* Fine grain for “photographic” finish */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export default function LandingPage({ onEnter }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <GlossySpaceBackdrop />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10 sm:px-8 md:py-14">
        <div
          className="w-full max-w-[min(1040px,calc(100vw-2rem))] rounded-[1.75rem] sm:rounded-[2rem] overflow-hidden"
          style={{
            background: 'linear-gradient(165deg, rgba(8,6,18,0.92) 0%, rgba(4,3,10,0.96) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow:
              '0 0 0 1px rgba(139,92,246,0.12), 0 24px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <header className="flex flex-wrap items-center justify-between gap-4 px-5 sm:px-8 md:px-10 py-4 sm:py-5 border-b border-white/[0.06]">
            <span className="text-[11px] sm:text-xs font-bold tracking-[0.28em] text-white/95">JOB SIMULATOR</span>
            <div className="flex items-center gap-4 sm:gap-8 text-[9px] sm:text-[10px] font-semibold tracking-[0.2em] text-white/40 uppercase">
              <span className="hidden sm:inline">Pipeline</span>
              <span className="hidden md:inline">Skills</span>
              <span className="hidden lg:inline">Network</span>
              <button
                type="button"
                onClick={onEnter}
                className="text-white/70 hover:text-white transition-colors duration-200 cursor-pointer motion-reduce:transition-none tracking-[0.22em]"
              >
                Open →
              </button>
            </div>
          </header>

          <div className="px-5 sm:px-10 md:px-16 pt-10 pb-14 sm:pt-14 sm:pb-20 md:pt-16 md:pb-24 flex flex-col items-center text-center">
            {/* Moon + stars behind it (same hero as reference: figure above title) */}
            <div className="relative w-[min(18rem,72vw)] aspect-square max-w-[280px] mx-auto mb-10 sm:mb-14">
              <div
                className="absolute inset-[4%] rounded-full overflow-hidden"
                style={{
                  background: 'radial-gradient(circle at 40% 35%, rgba(30,20,50,0.9) 0%, #050308 72%)',
                  boxShadow: 'inset 0 0 40px rgba(0,0,0,0.85), 0 0 60px rgba(109,40,217,0.15)',
                }}
              >
                <MovingStarsBehindMoon />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <MoonDrawing className="relative z-10 w-[78%] h-[78%] drop-shadow-[0_0_48px_rgba(139,92,246,0.35)]" />
              </div>
            </div>

            <h1
              className="text-[clamp(2.5rem,10vw,6.5rem)] font-black uppercase leading-[0.92] tracking-[-0.04em] text-white max-w-[18ch]"
              style={{
                fontFamily: 'var(--font-sans)',
                textShadow: '0 0 80px rgba(139, 92, 246, 0.25), 0 2px 0 rgba(0,0,0,0.5)',
              }}
            >
              JOB
              <br className="sm:hidden" />
              <span className="sm:ml-[0.15em]"> SIMULATOR</span>
            </h1>

            <p className="mt-6 sm:mt-8 text-sm sm:text-base text-white/50 font-medium tracking-wide max-w-md leading-relaxed">
              either find a job or cry trying.
            </p>

            <button
              type="button"
              onClick={onEnter}
              className="mt-10 sm:mt-12 rounded-xl px-10 py-3.5 text-[13px] font-semibold tracking-wide cursor-pointer transition-[filter,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none hover:brightness-110 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300/80"
              style={{
                background: 'linear-gradient(180deg, rgba(167,139,250,0.95) 0%, #5b21b6 100%)',
                color: '#faf8ff',
                boxShadow:
                  '0 0 0 1px rgba(255,255,255,0.14) inset, 0 10px 40px rgba(91, 33, 182, 0.55), 0 0 60px rgba(139, 92, 246, 0.2)',
              }}
            >
              Enter workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
