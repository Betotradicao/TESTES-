import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MktChatbotFluxo } from './MktChatbotFluxo';
import { MktChatbotBloco } from './MktChatbotBloco';

/**
 * Aresta do grafo. Conecta dois blocos.
 *
 * condicao:
 * - null: padrao — segue automaticamente apos bloco origem (apenas blocos sem
 *   resposta esperada usam: mensagem, atendente, encerrar)
 * - '1', '2', '3'...: numero da opcao do menu (bloco origem deve ser tipo
 *   'pergunta')
 * - '*': fallback (segue se nada bater)
 */
@Entity('mkt_chatbot_conexoes')
export class MktChatbotConexao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  fluxo_id: number;

  @ManyToOne(() => MktChatbotFluxo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fluxo_id' })
  fluxo: MktChatbotFluxo;

  @Column({ type: 'int' })
  origem_id: number;

  @ManyToOne(() => MktChatbotBloco, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'origem_id' })
  origem: MktChatbotBloco;

  @Column({ type: 'int' })
  destino_id: number;

  @ManyToOne(() => MktChatbotBloco, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destino_id' })
  destino: MktChatbotBloco;

  @Column({ type: 'varchar', length: 50, nullable: true })
  condicao: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @CreateDateColumn()
  created_at: Date;
}
