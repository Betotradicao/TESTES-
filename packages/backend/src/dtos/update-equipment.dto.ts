export interface UpdateEquipmentDto {
  sector_id?: number;
  color_hash?: string;
  description?: string;
}

export function validateUpdateEquipment(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Validar color_hash se fornecido
  if (data.color_hash !== undefined) {
    if (typeof data.color_hash !== 'string') {
      errors.push('color_hash must be a string');
    } else if (!/^#[0-9A-Fa-f]{6}$/.test(data.color_hash)) {
      errors.push('color_hash must be a valid hex color (e.g., #FF5733)');
    }
  }

  // Validar sector_id se fornecido
  if (data.sector_id !== undefined && data.sector_id !== null) {
    if (typeof data.sector_id !== 'number' || data.sector_id <= 0) {
      errors.push('sector_id must be a positive number');
    }
  }

  // Validar description se fornecido
  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== 'string') {
      errors.push('description must be a string');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
