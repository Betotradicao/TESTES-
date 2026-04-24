import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('rh_escala_cobertura')
export class RhEscalaCobertura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ name: 'departamento_id', type: 'int', nullable: true })
  departamentoId: number | null;

  @Column({ name: 'turno_id', type: 'uuid' })
  turnoId: string;

  @Column({ name: 'dia_semana', type: 'smallint' })
  diaSemana: number; // 0 = dom .. 6 = sab

  @Column({ type: 'int', default: 0 })
  minimo: number;
}
