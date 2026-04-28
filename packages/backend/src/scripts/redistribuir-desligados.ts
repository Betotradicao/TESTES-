import { AppDataSource } from '../config/database';

/**
 * Script one-shot: distribui colaboradores desligados sem `data_desligamento`
 * uniformemente nos ultimos 8 meses. Idempotente — so mexe nos que estao com
 * a data nula.
 *
 * Uso: cd packages/backend && npx ts-node src/scripts/redistribuir-desligados.ts
 */
async function main() {
  await AppDataSource.initialize();

  const [{ total }] = await AppDataSource.query(
    `SELECT COUNT(*)::int AS total FROM rh_colaboradores
     WHERE status = 'desligado' AND data_desligamento IS NULL`
  );

  if (total === 0) {
    console.log('Nada a fazer — nenhum desligado sem data.');
    await AppDataSource.destroy();
    return;
  }

  console.log(`Encontrados ${total} desligados sem data. Distribuindo nos ultimos 8 meses...`);

  // Distribui em 8 buckets (meses). Bucket 0 = 7 meses atras, bucket 7 = mes atual.
  // Coloca no dia 15 de cada mes.
  await AppDataSource.query(`
    WITH desligados AS (
      SELECT id,
             ROW_NUMBER() OVER (ORDER BY id) - 1 AS rn,
             COUNT(*) OVER () AS total
      FROM rh_colaboradores
      WHERE status = 'desligado' AND data_desligamento IS NULL
    )
    UPDATE rh_colaboradores c
    SET data_desligamento = (
      DATE_TRUNC('month', NOW() - INTERVAL '7 month')::date
      + (FLOOR(d.rn::numeric * 8 / GREATEST(d.total, 1)))::int * INTERVAL '1 month'
      + INTERVAL '14 days'
    )::date,
    updated_at = NOW()
    FROM desligados d
    WHERE c.id = d.id;
  `);

  const dist = await AppDataSource.query(`
    SELECT TO_CHAR(data_desligamento, 'YYYY-MM') AS mes, COUNT(*)::int AS qtd
    FROM rh_colaboradores
    WHERE status = 'desligado'
    GROUP BY mes
    ORDER BY mes
  `);

  console.log('\nDistribuicao final (status = desligado):');
  dist.forEach((r: any) => console.log(`  ${r.mes}: ${r.qtd} colaborador(es)`));

  await AppDataSource.destroy();
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
