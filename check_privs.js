const o = require('oracledb');
(async () => {
  try {
    o.initOracleClient();
    const c = await o.getConnection({
      user: 'POWERBI',
      password: 'Wo8885x7o9NG',
      connectString: 'host.docker.internal:51521/orcl.intersoul'
    });
    const r = await c.execute('SELECT PRIVILEGE FROM SESSION_PRIVS ORDER BY PRIVILEGE');
    console.log('SYS_PRIVS:', r.rows.map(x => x[0]).join(', '));
    const r2 = await c.execute('SELECT GRANTED_ROLE FROM USER_ROLE_PRIVS');
    console.log('ROLES:', r2.rows.map(x => x[0]).join(', '));
    const r3 = await c.execute("SELECT OWNER, VIEW_NAME FROM ALL_VIEWS WHERE VIEW_NAME LIKE 'MXF_VW%' AND ROWNUM<=3");
    console.log('SAMPLE_VIEWS:', r3.rows);
    await c.close();
  } catch (e) {
    console.log('ERR:', e.message);
  }
})();
