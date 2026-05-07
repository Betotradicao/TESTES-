import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { MktChatbotBloco } from './MktChatbotBloco';

/**
 * Fluxo do chatbot. Cada fluxo eh uma "arvore de mensagens" com seus nos.
 * Ex: "Atendimento Geral", "Vagas", "Promocoes".
 *
 * mensagem_primeira_vez: enviada para contatos novos
 * mensagem_recorrente: enviada para contatos que ja conversaram antes
 * timeout_inatividade_min: apos X min sem responder, sessao expira e proxima msg
 *   abre nova sessao no inicio do fluxo
 */
@Entity('mkt_chatbot_fluxos')
export class MktChatbotFluxo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  // Qual instancia da Evolution vai usar (ex: 'MARKETING')
  @Column({ type: 'varchar', length: 255, nullable: true })
  instance_name: string | null;

  @Column({ type: 'text', nullable: true })
  mensagem_primeira_vez: string | null;

  @Column({ type: 'text', nullable: true })
  mensagem_recorrente: string | null;

  @Column({ type: 'int', default: 1440 })
  timeout_inatividade_min: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => MktChatbotBloco, b => b.fluxo)
  blocos: MktChatbotBloco[];
}
