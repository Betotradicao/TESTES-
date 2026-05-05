import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona colunas que existiam no Tradicao via ALTER TABLE manual mas que
 * nao estavam em migration formal. Padroniza schema para clientes novos.
 */
export class AddMissingColsToRhColaboradores1784718000000 implements MigrationInterface {
  name = 'AddMissingColsToRhColaboradores1784718000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols = [
      { name: 'regime_trabalho_id', type: 'integer' },
      { name: 'tipo_desligamento_id', type: 'integer' },
      { name: 'motivo_desligamento_id', type: 'integer' },
      { name: 'observacoes_desligamento', type: 'text' },
      { name: 'foto_url', type: 'text' },
      { name: 'filtro2', type: 'varchar(100)' },
      { name: 'filtro3', type: 'varchar(100)' },
    ];

    for (const c of cols) {
      const has = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name='rh_colaboradores' AND column_name=$1`,
        [c.name]
      );
      if (has.length === 0) {
        await queryRunner.query(`ALTER TABLE rh_colaboradores ADD COLUMN ${c.name} ${c.type}`);
      }
    }
  }

  public async down(_q: QueryRunner): Promise<void> {
    // Down nao remove (preserva dados)
  }
}
