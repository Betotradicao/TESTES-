const oracledb = require('oracledb');
const { Pool } = require('pg');
require('dotenv').config();

oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_64\\instantclient_23_4' });

async function main() {
  // Connect to Oracle
  const oraConn = await oracledb.getConnection({
    user: 'POWERBI',
    password: 'OdRz6J4LY6Y6',
    connectString: '10.6.1.100:1521/orcl.intersoul'
  });

  // Get all fornecedores with NUM_FREQ_VISITA > 0
  const result = await oraConn.execute(`
    SELECT COD_FORNECEDOR, NVL(NUM_FREQ_VISITA, 0) as NUM_FREQ_VISITA
    FROM INTERSOLID.TAB_FORNECEDOR
    WHERE NUM_FREQ_VISITA > 0
  `);

  console.log(`Found ${result.rows.length} fornecedores with FREQ_VISITA in Oracle`);

  // Map values
  const mapping = {};
  for (const row of result.rows) {
    const cod = row[0];
    const dias = row[1];
    let freq = null;

    if (dias === 7) freq = 'Semanal';
    else if (dias === 15) freq = 'Quinzenal';
    else if (dias === 21) freq = '21 Dias';
    else if (dias === 30) freq = 'Mensal';
    else if (dias === 1) freq = 'Diario';
    else if (dias <= 7) freq = 'Semanal';
    else if (dias <= 15) freq = 'Quinzenal';
    else if (dias <= 21) freq = '21 Dias';
    else if (dias <= 30) freq = 'Mensal';
    else freq = 'Mensal';

    if (freq) {
      mapping[cod] = { dias, freq };
    }
  }

  // Show summary
  const freqCounts = {};
  for (const v of Object.values(mapping)) {
    freqCounts[v.freq] = (freqCounts[v.freq] || 0) + 1;
  }
  console.log('\nResumo:');
  for (const [f, c] of Object.entries(freqCounts)) {
    console.log(`  ${f}: ${c} fornecedores`);
  }

  // Connect to PostgreSQL
  const pgUrl = process.env.DATABASE_URL;
  const pgPool = new Pool({ connectionString: pgUrl });

  let inserted = 0;
  let updated = 0;

  for (const [cod, info] of Object.entries(mapping)) {
    try {
      const res = await pgPool.query(
        `INSERT INTO fornecedor_agendamentos (cod_fornecedor, freq_visita, created_at, updated_at)
         VALUES ($1, $2, now(), now())
         ON CONFLICT (cod_fornecedor) DO UPDATE SET freq_visita = $2, updated_at = now()
         RETURNING (xmax = 0) as is_insert`,
        [parseInt(cod), info.freq]
      );
      if (res.rows[0].is_insert) inserted++;
      else updated++;
    } catch (err) {
      console.error(`Erro cod ${cod}:`, err.message);
    }
  }

  console.log(`\nResultado: ${inserted} inseridos, ${updated} atualizados`);

  await oraConn.close();
  await pgPool.end();
}

main().catch(e => console.error('ERRO:', e.message));
