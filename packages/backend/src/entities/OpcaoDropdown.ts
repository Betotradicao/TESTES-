import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('opcoes_dropdown')
@Unique(['tipo', 'valor'])
export class OpcaoDropdown {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  tipo: string; // 'comprador' | 'tipo_atendimento'

  @Column({ type: 'varchar', length: 100 })
  valor: string;
}
