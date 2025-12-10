export class CreateEmployeeDto {
  name: string;
  sector_id: number;
  function_description: string;
  username: string;
  password: string;
}

export function validateCreateEmployee(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  }

  if (data.name && data.name.length < 3) {
    errors.push('Name must be at least 3 characters long');
  }

  if (data.name && data.name.length > 255) {
    errors.push('Name must not exceed 255 characters');
  }

  // Sector ID validation
  if (!data.sector_id) {
    errors.push('Sector ID is required');
  }

  if (data.sector_id && !Number.isInteger(Number(data.sector_id))) {
    errors.push('Sector ID must be a valid integer');
  }

  // Function description validation
  if (!data.function_description || typeof data.function_description !== 'string' || data.function_description.trim().length === 0) {
    errors.push('Function description is required and must be a non-empty string');
  }

  if (data.function_description && data.function_description.length < 3) {
    errors.push('Function description must be at least 3 characters long');
  }

  if (data.function_description && data.function_description.length > 255) {
    errors.push('Function description must not exceed 255 characters');
  }

  // Username validation
  if (!data.username || typeof data.username !== 'string' || data.username.trim().length === 0) {
    errors.push('Username is required and must be a non-empty string');
  }

  if (data.username && data.username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (data.username && data.username.length > 100) {
    errors.push('Username must not exceed 100 characters');
  }

  if (data.username && !/^[a-zA-Z0-9._-]+$/.test(data.username)) {
    errors.push('Username can only contain letters, numbers, dots, underscores and hyphens');
  }

  // Password validation
  if (!data.password || typeof data.password !== 'string' || data.password.trim().length === 0) {
    errors.push('Password is required and must be a non-empty string');
  }

  if (data.password && data.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (data.password && data.password.length > 100) {
    errors.push('Password must not exceed 100 characters');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
