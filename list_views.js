const o = require('oracledb');
(async () => {
  try {
    o.initOracleClient();
    const c = await o.getConnection({
      user:'POWERBI', password:'OdRz6J4LY6Y6',
      connectString:'10.6.1.100:1521/orcl.intersoul'
    });
    // Colunas de TAB_PRODUTO_PDV_ESTORNO que possam ter operador
    const r = await c.execute(`SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER='INTERSOLID' AND TABLE_NAME='TAB_PRODUTO_PDV_ESTORNO' ORDER BY COLUMN_NAME`);
    console.log('COLS TAB_PRODUTO_PDV_ESTORNO:');
    r.rows.forEach(x => console.log(`  ${x[0]}`));
    await c.close();
  } catch (e) { console.log('ERR:', e.message); }
})();
