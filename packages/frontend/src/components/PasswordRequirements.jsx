import { checkPasswordRequirements, PASSWORD_MIN_LENGTH } from '../utils/passwordPolicy';

const items = [
  { key: 'minLength', label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres` },
  { key: 'upper', label: '1 letra maiúscula (A-Z)' },
  { key: 'lower', label: '1 letra minúscula (a-z)' },
  { key: 'number', label: '1 número (0-9)' },
  { key: 'special', label: '1 caractere especial (!@#$%&*…)' },
];

export default function PasswordRequirements({ password = '', className = '' }) {
  const r = checkPasswordRequirements(password);
  return (
    <ul className={`space-y-1 mt-2 ${className}`}>
      {items.map(it => {
        const ok = r[it.key];
        return (
          <li key={it.key} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-gray-500'}`}>
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              {ok ? '✓' : '○'}
            </span>
            <span>{it.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
