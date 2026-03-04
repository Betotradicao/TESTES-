import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { MetaResponsavel } from './MetaResponsavel';

@Entity('metas')
export class Meta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'varchar', length: 50, default: 'loja' })
  tipo: string;

  @Column({ type: 'varchar', length: 50, default: 'lucro' })
  indicador: string;

  @Column({ type: 'int' })
  mes: number;

  @Column({ type: 'int' })
  ano: number;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  inflacao: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  crescimento: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_crescimento: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @OneToMany(() => MetaResponsavel, (mr) => mr.meta)
  responsaveis: MetaResponsavel[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
