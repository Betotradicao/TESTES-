import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('bank_accounts')
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  nome!: string;

  @Column({ default: 'santander' })
  tipo_banco!: string;

  @Column({ type: 'varchar', nullable: true })
  cnpj!: string;

  @Column({ type: 'varchar', nullable: true })
  agencia!: string;

  @Column({ type: 'varchar', nullable: true })
  conta!: string;

  @Column({ type: 'text', nullable: true })
  client_id!: string;

  @Column({ type: 'text', nullable: true })
  client_secret!: string;

  @Column({ type: 'text', nullable: true })
  pfx_password!: string;

  @Column({ type: 'varchar', nullable: true })
  certificate_path!: string;

  @Column({ type: 'varchar', nullable: true })
  workspace_id!: string;

  @Column({ default: 'production' })
  environment!: string;

  @Column({ name: 'cod_loja', type: 'int', nullable: true })
  cod_loja: number | null;

  @Column({ default: true })
  ativo!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
