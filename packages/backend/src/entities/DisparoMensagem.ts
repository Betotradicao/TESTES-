import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DisparoCampanha } from './DisparoCampanha';
import { DisparoContato } from './DisparoContato';

@Entity('disparo_mensagens')
export class DisparoMensagem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid' })
  campanha_id: string;

  @Column({ type: 'int' })
  contato_id: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome_contato: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  evolution_msg_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // pending, sent, delivered, read, failed

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  delivered_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  read_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => DisparoCampanha, c => c.mensagens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campanha_id' })
  campanha: DisparoCampanha;

  @ManyToOne(() => DisparoContato, c => c.mensagens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contato_id' })
  contato: DisparoContato;
}
