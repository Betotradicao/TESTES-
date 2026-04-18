const { Client } = require('pg');
(async () => {
  const c = new Client({
    host: '46.202.150.64', port: 6235, database: 'postgres_nunes',
    user: 'postgres', password: 'Nunes@2026',
    statement_timeout: 15000
  });
  await c.connect();

  // Ver mapeamento atual
  const r = await c.query(`SELECT id, name, type, mappings FROM database_connections WHERE status = 'active' LIMIT 1`);
  if (r.rows.length === 0) { console.log('Nenhuma conexao ativa'); await c.end(); return; }

  const conn = r.rows[0];
  console.log('Conexao:', conn.name, 'Tipo:', conn.type, 'ID:', conn.id);

  let mappings = {};
  try { mappings = JSON.parse(conn.mappings || '{}'); } catch { mappings = {}; }

  console.log('\nVersao:', mappings.version || 'v1');
  console.log('Tabelas mapeadas:', Object.keys(mappings.tabelas || {}).join(', '));

  // Mostrar detalhes de cada tabela mapeada
  for (const [tab, info] of Object.entries(mappings.tabelas || {})) {
    console.log(`\n--- ${tab} ---`);
    console.log('  nome_real:', info.nome_real);
    console.log('  colunas:', JSON.stringify(info.colunas || {}).slice(0, 300));
  }

  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
