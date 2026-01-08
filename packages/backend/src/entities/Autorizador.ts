import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('autorizadores')
export class Autorizador {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'codigo', type: 'int', unique: true })
  codigo!: number;

  @Column({ name: 'nome', type: 'varchar', length: 100 })
  nome!: string;

  @Column({ name: 'cargo', type: 'varchar', length: 50, nullable: true })
  cargo?: string;

  @Column({ name: 'ativo', type: 'boolean', default: true })
  ativo!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
