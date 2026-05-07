import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MktChatbotContato } from './MktChatbotContato';
import { MktChatbotFluxo } from './MktChatbotFluxo';
import { MktChatbotBloco } from './MktChatbotBloco';

/**
 * Estado da conversa de um contato com o chatbot. Mantem em qual no o usuario
 * esta no momento. Quando o no atual eh atualizado, a proxima mensagem do
 * cliente eh interpretada como uma das opcoes (filhos) desse no.
 *
 * Status: 'ativa' | 'finalizada' | 'expirada' | 'transferida_humano'
 */
@Entity('mkt_chatbot_sessoes')
export class MktChatbotSessao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  contato_id: number;

  @ManyToOne(() => MktChatbotContato)
  @JoinColumn({ name: 'contato_id' })
  contato: MktChatbotContato;

  @Column({ type: 'int' })
  fluxo_id: number;

  @ManyToOne(() => MktChatbotFluxo)
  @JoinColumn({ name: 'fluxo_id' })
  fluxo: MktChatbotFluxo;

  @Column({ type: 'int', nullable: true })
  bloco_atual_id: number | null;

  @ManyToOne(() => MktChatbotBloco, { nullable: true })
  @JoinColumn({ name: 'bloco_atual_id' })
  bloco_atual: MktChatbotBloco | null;

  // Contexto pra IA: array de mensagens [{role: user|assistant, content}]
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  contexto_ia: { role: 'user' | 'assistant' | 'system'; content: string }[];

  @Column({ type: 'timestamp' })
  iniciada_at: Date;

  @Column({ type: 'timestamp' })
  ultima_atividade_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  finalizada_at: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'ativa' })
  status: 'ativa' | 'finalizada' | 'expirada' | 'transferida_humano';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
