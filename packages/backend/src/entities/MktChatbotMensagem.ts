import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MktChatbotSessao } from './MktChatbotSessao';
import { MktChatbotBloco } from './MktChatbotBloco';

/**
 * Log historico de toda mensagem trocada com o chatbot.
 * Util pra auditoria, analise e treino futuro de IA.
 */
@Entity('mkt_chatbot_mensagens')
export class MktChatbotMensagem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  sessao_id: number;

  @ManyToOne(() => MktChatbotSessao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessao_id' })
  sessao: MktChatbotSessao;

  @Column({ type: 'varchar', length: 10 })
  direcao: 'recebida' | 'enviada';

  @Column({ type: 'text' })
  conteudo: string;

  @Column({ type: 'int', nullable: true })
  bloco_id: number | null;

  @ManyToOne(() => MktChatbotBloco, { nullable: true })
  @JoinColumn({ name: 'bloco_id' })
  bloco: MktChatbotBloco | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  whatsapp_message_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
