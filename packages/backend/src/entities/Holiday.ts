import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 5 })
  date: string; // MM-DD format

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar', length: 20, default: 'national' })
  type: string; // 'national' | 'regional'

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
