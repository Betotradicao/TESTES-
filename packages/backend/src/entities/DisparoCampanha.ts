import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { DisparoMensagem } from './DisparoMensagem';

@Entity('disparo_campanhas')
export class DisparoCampanha {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  mensagem_texto: string | null;

  @Column({ type: 'text', nullable: true })
  imagem_url: string | null;

  @Column({ type: 'text', nullable: true })
  imagem_base64: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  imagens_base64: string[] | null;

  @Column({ type: 'int', nullable: true })
  lista_id: number | null;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: string; // draft, running, paused, completed, cancelled

  @Column({ type: 'int', default: 0 })
  total_contatos: number;

  @Column({ type: 'int', default: 0 })
  enviados: number;

  @Column({ type: 'int', default: 0 })
  entregues: number;

  @Column({ type: 'int', default: 0 })
  lidos: number;

  @Column({ type: 'int', default: 0 })
  falharam: number;

  @Column({ type: 'int', default: 4000 })
  delay_min_ms: number;

  @Column({ type: 'int', default: 6000 })
  delay_max_ms: number;

  @Column({ type: 'int', default: 3500 })
  daily_limit: number;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => DisparoMensagem, msg => msg.campanha)
  mensagens: DisparoMensagem[];
}
