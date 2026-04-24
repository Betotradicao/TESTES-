import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('rh_escala_excessoes')
export class RhEscalaExcessao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'colaborador_id', type: 'int' })
  colaboradorId: number;

  @Column({ type: 'date' })
  data: string;

  @Column({ name: 'turno_id', type: 'uuid', nullable: true })
  turnoId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
