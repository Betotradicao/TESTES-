import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 5 })
  date: string; // MM-DD format (recorrente, sem ano)

  @Column({ type: 'int', nullable: true })
  year: number | null; // Legado - não usado mais para filtro

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
