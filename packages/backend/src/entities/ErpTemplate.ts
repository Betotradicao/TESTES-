import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Template de ERP para reutilização de mapeamentos
 * Permite salvar configurações de tabelas/colunas para reuso em múltiplos clientes
 */
@Entity('erp_templates')
export class ErpTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Nome do ERP (ex: "Intersolid", "Zanthus", "SAP")

  @Column({ nullable: true })
  description: string; // Descrição opcional

  @Column({
    type: 'varchar',
    length: 20
  })
  database_type: string; // oracle, sqlserver, mysql, postgres

  @Column({ type: 'text' })
  mappings: string; // JSON com todos os mapeamentos de tabelas/colunas

  @Column({ nullable: true })
  logo_url: string; // URL da imagem/logotipo do ERP

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
