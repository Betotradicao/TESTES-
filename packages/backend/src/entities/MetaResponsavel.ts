import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Meta } from './Meta';
import { Employee } from './Employee';

@Entity('meta_responsaveis')
export class MetaResponsavel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meta_id' })
  meta_id: string;

  @ManyToOne(() => Meta, (meta) => meta.responsaveis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meta_id' })
  meta: Meta;

  @Column({ name: 'employee_id' })
  employee_id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @CreateDateColumn()
  created_at: Date;
}
