/**
 * Última venda gravada no Oracle do cliente — separa "bug do Radar" de "ERP da loja parado".
 *
 * Roda DENTRO do container do backend (reaproveita o dist compilado e o MappingService).
 *
 *   scp scripts/ultima-venda-oracle.js vps2-hostinger:/tmp/uv.js
 *   ssh vps2-hostinger "docker cp /tmp/uv.js prevencao-<cliente>-backend:/tmp/uv.js"
 *   ssh vps2-hostinger "docker exec prevencao-<cliente>-backend node /tmp/uv.js"
 *
 * Só SELECT (usuário POWERBI é read-only). Ver obsidian-vault/padroes/regras-ssh-windows.md
 */
const { AppDataSource } = require('/app/dist/config/database');
const { MappingService } = require('/app/dist/services/mapping.service');
const { OracleService } = require('/app/dist/services/oracle.service');

(async () => {
  await AppDataSource.initialize();

  const schema   = await MappingService.getSchema();
  const tab      = await MappingService.getRealTableName('TAB_PRODUTO_PDV');
  const colData  = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
  const colLoja  = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
  const colCupom = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_cupom');
  const colHora  = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'hora_venda');

  console.log('### MAPEAMENTO ###');
  console.log('schema=' + schema + ' tabela=' + tab);
  console.log('data=' + colData + ' loja=' + colLoja + ' cupom=' + colCupom + ' hora=' + colHora);

  const agora = await OracleService.query(
    "SELECT TO_CHAR(SYSDATE,'DD/MM/YYYY HH24:MI:SS') AS AGORA FROM DUAL", {});
  console.log('### RELOGIO DO ORACLE DA LOJA ###');
  console.log(agora[0].AGORA);

  const ult = await OracleService.query(
    'SELECT TO_CHAR(MAX(' + colData + "),'DD/MM/YYYY') AS ULT FROM " + schema + '.' + tab, {});
  console.log('### ULTIMA DATA DE VENDA NA TABELA ###');
  console.log(ult[0].ULT);

  const dias = await OracleService.query(
    'SELECT TO_CHAR(TRUNC(' + colData + "),'DD/MM/YYYY') AS DIA, " + colLoja + ' AS LOJA, COUNT(*) AS ITENS' +
    ' FROM ' + schema + '.' + tab +
    ' WHERE ' + colData + ' >= TRUNC(SYSDATE) - 7 AND ' + colCupom + ' > 0' +
    ' GROUP BY TRUNC(' + colData + '), ' + colLoja +
    ' ORDER BY 1 DESC, 2', {});
  console.log('### ULTIMOS 7 DIAS (itens por dia/loja) ###');
  if (!dias.length) console.log('(nada nos ultimos 7 dias)');
  dias.forEach(function (d) { console.log(d.DIA + '  loja ' + d.LOJA + '  ->  ' + d.ITENS + ' itens'); });

  const hoje = await OracleService.query(
    'SELECT COUNT(*) AS N, TO_CHAR(MAX(' + colHora + "),'HH24:MI') AS ULTHORA FROM " + schema + '.' + tab +
    ' WHERE TRUNC(' + colData + ') = TRUNC(SYSDATE)', {});
  console.log('### HOJE (pelo relogio do Oracle) ###');
  console.log('itens=' + hoje[0].N + '  ultima hora=' + (hoje[0].ULTHORA || '-'));

  process.exit(0);
})().catch(function (e) { console.error('### ERRO ###'); console.error(e.message); process.exit(1); });
