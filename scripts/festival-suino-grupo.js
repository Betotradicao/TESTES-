/** Passo 7: TUDO do grupo PROTEINA SUINA (secao 1, grupo 2). SOMENTE SELECT. */
const { AppDataSource } = require('/app/dist/config/database');
const { MappingService } = require('/app/dist/services/mapping.service');
const { OracleService } = require('/app/dist/services/oracle.service');
const c = (t, k, f) => MappingService.getColumnFromTable(t, k, f);

(async () => {
  await AppDataSource.initialize();
  await OracleService.initialize();
  const schema = await MappingService.getSchema();
  const T = async (id) => `${schema}.${await MappingService.getRealTableName(id)}`;
  const tProd = await T('TAB_PRODUTO');
  const tLoja = await T('TAB_PRODUTO_LOJA');
  const tSub = `${schema}.TAB_SUBGRUPO`;
  const pCod = await c('TAB_PRODUTO', 'codigo_produto');
  const pDes = await c('TAB_PRODUTO', 'descricao');
  const pBar = await c('TAB_PRODUTO', 'codigo_barras');
  const lCod = await c('TAB_PRODUTO_LOJA', 'codigo_produto');
  const lLoja = await c('TAB_PRODUTO_LOJA', 'codigo_loja');
  const lVenda = await c('TAB_PRODUTO_LOJA', 'preco_venda');
  const lCusto = await c('TAB_PRODUTO_LOJA', 'preco_custo');
  const lCurva = await c('TAB_PRODUTO_LOJA', 'curva');
  const lVdMedia = await c('TAB_PRODUTO_LOJA', 'venda_media');
  const lEst = await c('TAB_PRODUTO_LOJA', 'estoque_atual');

  const itens = await OracleService.query(`
    SELECT p.${pCod} AS COD, p.${pDes} AS NOME, p.${pBar} AS BARRAS,
           p.COD_SUB_GRUPO AS SUB, s.DES_SUB_GRUPO AS SUBGRUPO,
           NVL(pl.${lVenda},0) AS PRECO, NVL(pl.${lCusto},0) AS CUSTO,
           TRIM(pl.${lCurva}) AS CURVA, NVL(pl.${lVdMedia},0) AS GIRO,
           NVL(pl.${lEst},0) AS ESTOQUE,
           NVL(pl.FORA_LINHA,'N') AS FORA_LINHA, NVL(pl.INATIVO,'N') AS INATIVO
      FROM ${tProd} p
      JOIN ${tLoja} pl ON LPAD(TRIM(pl.${lCod}),20,'0') = LPAD(TRIM(p.${pCod}),20,'0') AND pl.${lLoja} = 1
      LEFT JOIN ${tSub} s ON s.COD_SECAO=p.COD_SECAO AND s.COD_GRUPO=p.COD_GRUPO AND s.COD_SUB_GRUPO=p.COD_SUB_GRUPO
     WHERE p.COD_SECAO = 1 AND p.COD_GRUPO = 2
     ORDER BY p.COD_SUB_GRUPO, NVL(pl.${lVdMedia},0) DESC`, {});
  console.log('###ITENS###');
  console.log(JSON.stringify(itens));
  await OracleService.close();
  await AppDataSource.destroy();
  process.exit(0);
})().catch(e => { console.log('ERRO: ' + e.message); process.exit(1); });
