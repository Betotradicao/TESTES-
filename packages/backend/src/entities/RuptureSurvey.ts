import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { RuptureSurveyItem } from './RuptureSurveyItem';
import { User } from './User';

@Entity('rupture_surveys')
export class RuptureSurvey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nome_pesquisa: string;

  @CreateDateColumn()
  data_criacao: Date;

  @Column({ type: 'timestamp', nullable: true })
  data_inicio_coleta: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  data_fim_coleta: Date | null;

  @Column({
    type: 'enum',
    enum: ['rascunho', 'em_andamento', 'concluida', 'cancelada'],
    default: 'rascunho'
  })
  status: 'rascunho' | 'em_andamento' | 'concluida' | 'cancelada';

  @Column({ type: 'int', default: 0 })
  total_itens: number;

  @Column({ type: 'int', default: 0 })
  itens_verificados: number;

  @Column({ type: 'int', default: 0 })
  itens_encontrados: number;

  @Column({ type: 'int', default: 0 })
  itens_nao_encontrados: number;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  observacoes: string | null;

  @OneToMany(() => RuptureSurveyItem, item => item.survey)
  items: RuptureSurveyItem[];

  @UpdateDateColumn()
  updated_at: Date;

  // Campos calculados (não salvos no banco)
  get taxa_ruptura(): number {
    if (this.itens_verificados === 0) return 0;
    return (this.itens_nao_encontrados / this.itens_verificados) * 100;
  }

  get progresso_percentual(): number {
    if (this.total_itens === 0) return 0;
    return (this.itens_verificados / this.total_itens) * 100;
  }
}
