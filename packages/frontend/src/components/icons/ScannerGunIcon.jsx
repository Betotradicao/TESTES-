export default function ScannerGunIcon({ className = "w-5 h-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Scanner gun handle */}
      <path d="M8 14h3v6c0 1.1-.9 2-2 2s-2-.9-2-2v-6z"/>

      {/* Scanner gun body */}
      <rect x="6" y="6" width="7" height="8" rx="1"/>

      {/* Scanner lines */}
      <line x1="15" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="15" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="15" y1="14" x2="19" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>

      {/* Scanner window */}
      <rect x="7.5" y="7.5" width="4" height="3" rx="0.5" fill="white" opacity="0.3"/>
    </svg>
  );
}
