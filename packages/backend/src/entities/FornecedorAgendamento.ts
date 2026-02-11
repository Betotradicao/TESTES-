import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fornecedor_agendamentos')
export class FornecedorAgendamento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  cod_fornecedor: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  freq_visita: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  dia_semana_1: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  dia_semana_2: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  dia_semana_3: string | null;

  @Column({ type: 'int', nullable: true })
  dia_mes: number | null;

  @Column({ type: 'date', nullable: true })
  inicio_agendamento: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  comprador: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tipo_atendimento: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  hora_inicio: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  hora_termino: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
