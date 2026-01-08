import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('motivos_desconto')
export class MotivoDesconto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'codigo', type: 'int', unique: true })
  codigo!: number;

  @Column({ name: 'descricao', type: 'varchar', length: 200 })
  descricao!: string;

  @Column({ name: 'ativo', type: 'boolean', default: true })
  ativo!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
