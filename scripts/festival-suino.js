/**
 * Festival do Suino - passo 2: desmembrar a ULTIMA entrada da matriz suina.
 * Rateio do custo proporcional ao preco de venda (mesma conta da tela de Desmembramento).
 * SOMENTE SELECT.
 */
const { AppDataSource } = require('/app/dist/config/database');
const { MappingService } = require('/app/dist/services/mapping.service');
const { OracleService } = require('/app/dist/services/oracle.service');

const MATRIZ = process.env.MATRIZ || '10085967';
const COD_LOJA = 1;
const c = (t, k, f) => MappingService.getColumnFromTable(t, k, f);

(async () => {
  await AppDataSource.initialize();
  await OracleService.initialize();
  const schema = await MappingService.getSchema();
  const T = async (id) => `${schema}.${await MappingService.getRealTableName(id)}`;

  const tProd = await T('TAB_PRODUTO');
  const tLoja = await T('TAB_PRODUTO_LOJA');
  const tNf = await T('TAB_NF');
  const tNfItem = await T('TAB_NF_ITEM');
  const tDecomp = `${schema}.TAB_PRODUTO_DECOMPOSICAO`;

  const pCod = await c('TAB_PRODUTO', 'codigo_produto');
  const pDes = await c('TAB_PRODUTO', 'descricao');
  const lCod = await c('TAB_PRODUTO_LOJA', 'codigo_produto');
  const lLoja = await c('TAB_PRODUTO_LOJA', 'codigo_loja');
  const lVenda = await c('TAB_PRODUTO_LOJA', 'preco_venda');
  const lCusto = await c('TAB_PRODUTO_LOJA', 'preco_custo');
  const lCurva = await c('TAB_PRODUTO_LOJA', 'curva');
  const lVdMedia = await c('TAB_PRODUTO_LOJA', 'venda_media');
  const nfData = await c('TAB_NF', 'data_entrada');
  const nfNum = await c('TAB_NF', 'numero_nf');
  const nfSerie = await c('TAB_NF', 'serie_nf');
  const nfParc = await c('TAB_NF', 'codigo_parceiro');
  const itCod = await c('TAB_NF_ITEM', 'codigo_item');
  const itQtd = await c('TAB_NF_ITEM', 'quantidade_entrada');
  const itCusto = await c('TAB_NF_ITEM', 'valor_custo');
  const itTotal = await c('TAB_NF_ITEM', 'valor_total');
  const itNum = await c('TAB_NF_ITEM', 'numero_nf');
  const itSerie = await c('TAB_NF_ITEM', 'serie_nf');
  const itParc = await c('TAB_NF_ITEM', 'codigo_parceiro');

  // ---------- historico de entradas da matriz ----------
  const hist = await OracleService.query(`
    SELECT * FROM (
      SELECT TO_CHAR(n.${nfData},'DD/MM/YYYY') AS DATA, n.${nfNum} AS NF,
             SUM(i.${itQtd}) AS KG, MAX(i.${itCusto}) AS CUSTO_KG, SUM(i.${itTotal}) AS TOTAL,
             MAX(n.${nfData}) AS DT
        FROM ${tNfItem} i
        JOIN ${tNf} n ON n.${nfNum} = i.${itNum} AND n.${nfSerie} = i.${itSerie} AND n.${nfParc} = i.${itParc}
       WHERE LPAD(TRIM(i.${itCod}),20,'0') = LPAD(TRIM(:matriz),20,'0')
       GROUP BY TO_CHAR(n.${nfData},'DD/MM/YYYY'), n.${nfNum}
       ORDER BY MAX(n.${nfData}) DESC
    ) WHERE ROWNUM <= 8`, { matriz: MATRIZ });

  console.log('###HIST###');
  console.log(JSON.stringify(hist));

  // ---------- cortes da matriz + preco de venda ----------
  const cortes = await OracleService.query(`
    SELECT d.COD_PRODUTO_DECOM AS COD, p.${pDes} AS NOME, d.QTD_DECOMP AS PCT,
           d.DES_UNIDADE AS UN, NVL(pl.${lVenda},0) AS PRECO_VENDA,
           NVL(pl.${lCusto},0) AS CUSTO_REP_ATUAL, TRIM(pl.${lCurva}) AS CURVA,
           NVL(pl.${lVdMedia},0) AS VENDA_MEDIA
      FROM ${tDecomp} d
      JOIN ${tProd} p ON LPAD(TRIM(p.${pCod}),20,'0') = LPAD(TRIM(d.COD_PRODUTO_DECOM),20,'0')
      LEFT JOIN ${tLoja} pl ON LPAD(TRIM(pl.${lCod}),20,'0') = LPAD(TRIM(d.COD_PRODUTO_DECOM),20,'0')
                           AND pl.${lLoja} = :codLoja
     WHERE LPAD(TRIM(d.COD_PRODUTO),20,'0') = LPAD(TRIM(:matriz),20,'0')
     ORDER BY d.QTD_DECOMP DESC`, { matriz: MATRIZ, codLoja: COD_LOJA });

  console.log('###CORTES###');
  console.log(JSON.stringify(cortes));

  await OracleService.close();
  await AppDataSource.destroy();
  process.exit(0);
})().catch(e => { console.log('ERRO: ' + e.message); process.exit(1); });
