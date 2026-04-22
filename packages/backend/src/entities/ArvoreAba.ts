import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Sector } from './Sector';
import { ArvoreNota } from './ArvoreNota';

@Entity('arvore_abas')
export class ArvoreAba {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'setor_id' })
  setor_id: number;

  @ManyToOne(() => Sector, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'setor_id' })
  setor: Sector;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ArvoreNota, n => n.aba)
  notas: ArvoreNota[];
}
