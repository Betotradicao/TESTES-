export class UpdateSectorDto {
  name?: string;
  color_hash?: string;
}

export function validateUpdateSector(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Name must be a non-empty string');
    }

    if (data.name && data.name.length < 3) {
      errors.push('Name must be at least 3 characters long');
    }

    if (data.name && data.name.length > 255) {
      errors.push('Name must not exceed 255 characters');
    }
  }

  if (data.color_hash !== undefined) {
    if (typeof data.color_hash !== 'string') {
      errors.push('Color hash must be a string');
    }

    if (data.color_hash && !/^#[0-9A-F]{6}$/i.test(data.color_hash)) {
      errors.push('Color hash must be in format #RRGGBB');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
