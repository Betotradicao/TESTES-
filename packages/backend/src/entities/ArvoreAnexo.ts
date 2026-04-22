import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ArvoreNota } from './ArvoreNota';

export type ArvoreAnexoTipo = 'imagem' | 'video' | 'pdf' | 'arquivo' | 'link' | 'youtube';

@Entity('arvore_anexos')
export class ArvoreAnexo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nota_id' })
  nota_id: number;

  @ManyToOne(() => ArvoreNota, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nota_id' })
  nota: ArvoreNota;

  @Column({ type: 'varchar', length: 50 })
  tipo: ArvoreAnexoTipo;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  nome_original: string | null;

  @Column({ type: 'bigint', nullable: true })
  tamanho_bytes: number | null;

  @CreateDateColumn()
  created_at: Date;
}
