export class EmployeeResponseDto {
  id: string;
  name: string;
  avatar: string | null;
  sector_id: number;
  sector?: {
    id: number;
    name: string;
    color_hash: string;
  };
  function_description: string;
  username: string;
  first_access: boolean;
  barcode: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(employee: any) {
    this.id = employee.id;
    this.name = employee.name;
    this.avatar = employee.avatar;
    this.sector_id = employee.sector_id;
    this.function_description = employee.function_description;
    this.username = employee.username;
    this.first_access = employee.first_access;
    this.barcode = employee.barcode;
    this.active = employee.active;
    this.created_at = employee.created_at;
    this.updated_at = employee.updated_at;

    // Include sector info if it was loaded
    if (employee.sector) {
      this.sector = {
        id: employee.sector.id,
        name: employee.sector.name,
        color_hash: employee.sector.color_hash,
      };
    }

    // IMPORTANT: Never include password in response
  }
}
