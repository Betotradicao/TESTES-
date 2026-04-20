// Renderiza icones padronizados das alternativas — estilo moderno/gradient

const ICONES = {
  smile_green: {
    label: 'Positivo',
    grad: 'from-emerald-400 to-green-600',
    ring: 'ring-emerald-300',
    svg: (s) => (
      <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="url(#g_smile)" stroke="#fff" strokeWidth="1.5" />
        <defs>
          <linearGradient id="g_smile" x1="0" y1="0" x2="0" y2="40">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="16" r="2" fill="#fff" />
        <circle cx="26" cy="16" r="2" fill="#fff" />
        <path d="M13 24 Q20 30 27 24" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  frown_red: {
    label: 'Negativo',
    grad: 'from-rose-400 to-red-600',
    ring: 'ring-rose-300',
    svg: (s) => (
      <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="url(#g_frown)" stroke="#fff" strokeWidth="1.5" />
        <defs>
          <linearGradient id="g_frown" x1="0" y1="0" x2="0" y2="40">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="16" r="2" fill="#fff" />
        <circle cx="26" cy="16" r="2" fill="#fff" />
        <path d="M13 28 Q20 22 27 28" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  na_blue: {
    label: 'N/A',
    grad: 'from-sky-400 to-blue-600',
    ring: 'ring-sky-300',
    svg: (s) => (
      <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="url(#g_na)" stroke="#fff" strokeWidth="1.5" />
        <defs>
          <linearGradient id="g_na" x1="0" y1="0" x2="0" y2="40">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <text x="20" y="26" textAnchor="middle" fontFamily="'Segoe UI', sans-serif" fontWeight="700" fontSize="14" fill="#fff" fontStyle="italic">n/a</text>
      </svg>
    ),
  },
  warning_yellow: {
    label: 'Alerta',
    grad: 'from-amber-300 to-amber-600',
    ring: 'ring-amber-300',
    svg: (s) => (
      <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="url(#g_warn)" stroke="#fff" strokeWidth="1.5" />
        <defs>
          <linearGradient id="g_warn" x1="0" y1="0" x2="0" y2="40">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
        <path d="M20 10 L30 28 L10 28 Z" fill="#fff" stroke="#fff" strokeWidth="0.5" strokeLinejoin="round" />
        <rect x="18.7" y="16" width="2.6" height="7.5" rx="1" fill="#b45309" />
        <circle cx="20" cy="26" r="1.4" fill="#b45309" />
      </svg>
    ),
  },
  check_green: {
    label: 'OK',
    grad: 'from-emerald-400 to-teal-600',
    ring: 'ring-emerald-300',
    svg: (s) => (
      <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="url(#g_chk)" stroke="#fff" strokeWidth="1.5" />
        <defs>
          <linearGradient id="g_chk" x1="0" y1="0" x2="0" y2="40">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>
        <path d="M11 20 L17 27 L29 14" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  cross_red: {
    label: 'Falha',
    grad: 'from-rose-400 to-red-700',
    ring: 'ring-rose-300',
    svg: (s) => (
      <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="url(#g_x)" stroke="#fff" strokeWidth="1.5" />
        <defs>
          <linearGradient id="g_x" x1="0" y1="0" x2="0" y2="40">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
        </defs>
        <path d="M13 13 L27 27 M27 13 L13 27" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

export const ICON_KEYS = Object.keys(ICONES);

export function AlternativaIcon({ icone, size = 32, withShadow = true }) {
  const cfg = ICONES[icone] || ICONES.smile_green;
  return (
    <div
      className={`inline-block ${withShadow ? 'drop-shadow-sm' : ''}`}
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      {cfg.svg(size)}
    </div>
  );
}

export function getAlternativaMeta(icone) {
  return ICONES[icone] || ICONES.smile_green;
}

export default ICONES;
