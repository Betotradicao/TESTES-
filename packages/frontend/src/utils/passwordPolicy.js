// Politica de senha do sistema (mesma regra usada no backend)
// 8+ caracteres, com maiuscula, minuscula, numero e caractere especial.
export const PASSWORD_MIN_LENGTH = 8;

const SPECIAL_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/;

export function checkPasswordRequirements(password = '') {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: SPECIAL_REGEX.test(password),
  };
}

export function isPasswordStrong(password) {
  const r = checkPasswordRequirements(password);
  return r.minLength && r.upper && r.lower && r.number && r.special;
}

export function passwordValidationError(password) {
  if (!isPasswordStrong(password)) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres, com letra maiúscula, minúscula, número e caractere especial`;
  }
  return null;
}
