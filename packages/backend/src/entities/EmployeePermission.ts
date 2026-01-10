import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Employee } from './Employee';

@Entity('employee_permissions')
@Unique(['employee_id', 'module_id', 'submenu_id'])
export class EmployeePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'varchar', length: 50 })
  module_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  submenu_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
