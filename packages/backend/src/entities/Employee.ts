import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Sector } from './Sector';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  @Column({ name: 'sector_id' })
  sector_id: number;

  @ManyToOne(() => Sector)
  @JoinColumn({ name: 'sector_id' })
  sector: Sector;

  @Column({ type: 'varchar', length: 255 })
  function_description: string;

  @Column({ type: 'varchar', unique: true, length: 100 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'boolean', default: true })
  first_access: boolean;

  @Column({ type: 'varchar', unique: true, length: 50 })
  barcode: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
