// Politica de senha (mesma do frontend em utils/passwordPolicy.js).
export const PASSWORD_MIN_LENGTH = 8;

const SPECIAL_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/;

export function isPasswordStrong(password: string): boolean {
  if (!password || password.length < PASSWORD_MIN_LENGTH) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!SPECIAL_REGEX.test(password)) return false;
  return true;
}

export const PASSWORD_POLICY_ERROR = `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres, com letra maiúscula, minúscula, número e caractere especial`;
