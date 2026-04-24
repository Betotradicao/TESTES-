import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('rh_escala_licencas')
export class RhEscalaLicenca {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'colaborador_id', type: 'int' })
  colaboradorId: number;

  @Column({ name: 'data_inicio', type: 'date' })
  dataInicio: string;

  @Column({ name: 'data_fim', type: 'date' })
  dataFim: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  @Column({ name: 'arquivo_url', type: 'text', nullable: true })
  arquivoUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
