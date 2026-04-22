import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ArvoreAba } from './ArvoreAba';
import { ArvoreAnexo } from './ArvoreAnexo';

@Entity('arvore_notas')
export class ArvoreNota {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'aba_id' })
  aba_id: number;

  @ManyToOne(() => ArvoreAba, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'aba_id' })
  aba: ArvoreAba;

  @Column({ type: 'varchar', length: 500 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  conteudo: string | null;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ArvoreAnexo, a => a.nota)
  anexos: ArvoreAnexo[];
}
