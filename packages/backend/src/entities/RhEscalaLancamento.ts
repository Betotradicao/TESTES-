import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rh_escala_lancamentos')
export class RhEscalaLancamento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'colaborador_id', type: 'int' })
  colaboradorId: number;

  @Column({ type: 'date' })
  data: string;

  @Column({ name: 'turno_id', type: 'uuid', nullable: true })
  turnoId: string | null;

  @Column({ length: 20, default: 'template' })
  origem: string; // template | excessao | ferias | licenca | feriado | manual

  @Column({ type: 'text', nullable: true })
  observacao: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
