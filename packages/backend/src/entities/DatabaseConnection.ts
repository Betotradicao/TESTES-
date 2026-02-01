import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum DatabaseType {
  ORACLE = 'oracle',
  SQLSERVER = 'sqlserver',
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql'
}

export enum ConnectionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

@Entity('database_connections')
export class DatabaseConnection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'varchar',
    length: 20
  })
  type: DatabaseType;

  @Column()
  host: string;

  @Column()
  port: number;

  @Column({ nullable: true })
  service: string; // For Oracle service name

  @Column({ nullable: true })
  database: string; // For other databases

  @Column()
  username: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  schema: string;

  @Column({ default: false })
  is_default: boolean;

  @Column({
    type: 'varchar',
    length: 20,
    default: ConnectionStatus.INACTIVE
  })
  status: ConnectionStatus;

  @Column({ nullable: true })
  last_test_at: Date;

  @Column({ nullable: true, type: 'text' })
  last_error: string;

  @Column({ nullable: true, type: 'text' })
  mappings: string; // JSON com mapeamentos de tabelas/colunas por módulo

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
