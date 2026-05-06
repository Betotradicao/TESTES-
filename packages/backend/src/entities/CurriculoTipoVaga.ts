import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Tipos de vaga disponiveis no formulario publico de curriculo.
 * Editavel pelo admin via tela Modelo de Curriculo.
 *
 * - slug: chave estavel ('clt', 'aprendiz', 'estagio', 'pj', etc) usada pra
 *   filtrar/comparar. UPPER-snake-case ou lowercase, sem espaco.
 * - nome: label exibido pro candidato e admin (ex: 'CLT', 'Menor Aprendiz').
 */
@Entity('curriculo_tipos_vaga')
export class CurriculoTipoVaga {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  nome: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
