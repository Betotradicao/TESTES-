import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MktChatbotFluxo } from './MktChatbotFluxo';

/**
 * Tipos de bloco suportados:
 * - 'mensagem': envia texto + opcional link/midia (sem aguardar resposta)
 * - 'pergunta': envia texto + lista de opcoes (1, 2, 3...) e aguarda resposta
 * - 'ia': chama OpenAI/Claude com prompt + persona + contexto da conversa
 * - 'atendente': transfere pra humano (encerra automacao, libera fila)
 * - 'encerrar': despedida + fim da sessao
 */
export type ChatbotBlocoTipo = 'mensagem' | 'pergunta' | 'ia' | 'atendente' | 'encerrar';

@Entity('mkt_chatbot_blocos')
export class MktChatbotBloco {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  fluxo_id: number;

  @ManyToOne(() => MktChatbotFluxo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fluxo_id' })
  fluxo: MktChatbotFluxo;

  @Column({ type: 'varchar', length: 30 })
  tipo: ChatbotBlocoTipo;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome: string | null;

  @Column({ type: 'int', default: 0 })
  posicao_x: number;

  @Column({ type: 'int', default: 0 })
  posicao_y: number;

  // Config especifica por tipo (JSONB).
  // mensagem: { texto, delay_segundos, mostrar_typing, link_url, midia_url, midia_tipo }
  // pergunta: { texto, delay_segundos, mostrar_typing, opcoes: [{numero, label}] }
  // ia: { prompt_sistema, persona, modelo, temperatura, max_tokens }
  // atendente: { mensagem_transferencia }
  // encerrar: { mensagem_despedida }
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  dados: any;

  @Column({ type: 'boolean', default: false })
  is_inicial: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
