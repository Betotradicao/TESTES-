import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { DisparoMensagem } from './DisparoMensagem';

@Entity('disparo_contatos')
export class DisparoContato {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  telefone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tags: string | null;

  @Column({ type: 'int', default: 50 })
  score: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // active, inactive, invalid

  @Column({ type: 'int', default: 0 })
  total_enviados: number;

  @Column({ type: 'int', default: 0 })
  total_entregues: number;

  @Column({ type: 'int', default: 0 })
  total_lidos: number;

  @Column({ type: 'int', default: 0 })
  total_falhas: number;

  @Column({ type: 'timestamp', nullable: true })
  last_interaction_at: Date | null;

  @Column({ type: 'int', nullable: true })
  lista_id: number | null;

  @Column({ type: 'timestamp', nullable: true })
  inactivated_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => DisparoMensagem, msg => msg.contato)
  mensagens: DisparoMensagem[];
}
