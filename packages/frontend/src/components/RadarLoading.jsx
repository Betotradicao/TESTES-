export default function RadarLoading({ message = 'Atualizando dados...', size = 'md' }) {
  const sizes = {
    sm: { container: 'w-16 h-16', py: 'py-8', text: 'text-xs' },
    md: { container: 'w-24 h-24', py: 'py-16', text: 'text-sm' },
    lg: { container: 'w-32 h-32', py: 'py-20', text: 'text-base' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex flex-col items-center justify-center ${s.py} gap-4`}>
      <div className={`relative ${s.container}`}>
        {/* Círculos do radar */}
        <div className="absolute inset-0 rounded-full border-2 border-orange-200"></div>
        <div className="absolute inset-3 rounded-full border border-orange-200/60"></div>
        <div className="absolute inset-6 rounded-full border border-orange-200/40"></div>
        {/* Ponto central */}
        <div className="absolute top-1/2 left-1/2 w-2 h-2 -mt-1 -ml-1 bg-orange-500 rounded-full"></div>
        {/* Linha de varredura + cone */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="radarSweepGrad" gradientTransform="rotate(0, 50, 50)">
                <stop offset="0%" stopColor="rgba(249, 115, 22, 0)" />
                <stop offset="100%" stopColor="rgba(249, 115, 22, 0.5)" />
              </linearGradient>
            </defs>
            {/* Cone de varredura */}
            <path d="M 50 50 L 50 2 A 48 48 0 0 0 8.5 26 Z" fill="url(#radarSweepGrad)" opacity="0.4" />
            {/* Linha de varredura */}
            <line x1="50" y1="50" x2="50" y2="2" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        {/* Brilho pulsante */}
        <div className="absolute inset-0 rounded-full animate-ping opacity-10 bg-orange-400" style={{ animationDuration: '2s' }}></div>
      </div>
      {message && <p className={`${s.text} text-gray-400 animate-pulse`}>{message}</p>}
    </div>
  );
}
