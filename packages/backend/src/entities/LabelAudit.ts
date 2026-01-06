import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { LabelAuditItem } from './LabelAuditItem';

@Entity('label_audits')
export class LabelAudit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  titulo: string;

  @Column({ type: 'date' })
  data_referencia: Date;

  @Column({ type: 'text', nullable: true })
  observacoes: string | null;

  @Column({
    type: 'enum',
    enum: ['em_andamento', 'concluida', 'cancelada'],
    default: 'em_andamento'
  })
  status: 'em_andamento' | 'concluida' | 'cancelada';

  @OneToMany(() => LabelAuditItem, item => item.audit)
  items: LabelAuditItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Campos calculados (serão populados via query)
  total_itens?: number;
  itens_pendentes?: number;
  itens_corretos?: number;
  itens_divergentes?: number;
  percentual_conformidade?: number;
}
