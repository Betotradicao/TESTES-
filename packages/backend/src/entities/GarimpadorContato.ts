import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { GarimpadorMensagem } from './GarimpadorMensagem';

@Entity('garimpador_contatos')
export class GarimpadorContato {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  telefone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome: string | null;

  @Column({ type: 'varchar', length: 20, default: 'nao_classificado' })
  tipo: string; // 'fornecedor' | 'concorrente' | 'nao_classificado'

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => GarimpadorMensagem, msg => msg.contato)
  mensagens: GarimpadorMensagem[];
}
