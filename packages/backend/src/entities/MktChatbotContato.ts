import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Contato unico identificado pelo telefone. Usado pra:
 * - Detectar se eh primeira interacao com a marca
 * - Estatisticas (total de mensagens, primeira/ultima atividade)
 * - Bloquear contatos indesejados
 */
@Entity('mkt_chatbot_contatos')
export class MktChatbotContato {
  @PrimaryGeneratedColumn()
  id: number;

  // Telefone normalizado (so digitos com codigo do pais)
  @Column({ type: 'varchar', length: 30, unique: true })
  telefone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome_whatsapp: string | null;

  @Column({ type: 'timestamp', nullable: true })
  primeira_msg_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  ultima_msg_at: Date | null;

  @Column({ type: 'int', default: 0 })
  total_msgs: number;

  @Column({ type: 'boolean', default: false })
  bloqueado: boolean;

  @Column({ type: 'text', nullable: true })
  observacao: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
