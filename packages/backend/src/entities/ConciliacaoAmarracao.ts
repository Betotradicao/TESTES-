import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Amarração: texto exato do Favorecido do extrato -> conta do plano_contas.
 * Única por (cod_loja, texto_exato) -> auto-aplica a toda linha com o mesmo texto.
 */
@Entity('conciliacao_amarracoes')
@Index('uq_amarracao_loja_texto', ['cod_loja', 'texto_exato'], { unique: true })
export class ConciliacaoAmarracao {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  cod_loja!: number;

  @Column({ type: 'text' })
  texto_exato!: string;

  @Column({ type: 'int' })
  plano_conta_id!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
