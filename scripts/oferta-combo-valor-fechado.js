/**
 * Quinta do 10 - Tradicao
 * Acha itens (curva A e B) onde N unidades por R$ 10,00 dao margem de 15% a 20%.
 *
 * Matematica: margem = (10 - N*custo)/10. Para 15%..20% => N*custo entre 8,00 e 8,50.
 *
 * SOMENTE SELECT. Nomes de tabela/coluna vem do MappingService (nunca hardcode).
 */
const { AppDataSource } = require('/app/dist/config/database');
const { MappingService } = require('/app/dist/services/mapping.service');
const { OracleService } = require('/app/dist/services/oracle.service');

const COD_LOJA = Number(process.env.COD_LOJA || 1);
const N_MAX = 12;
const CUSTO_MIN = 7.5 / N_MAX - 0.01;
const CUSTO_MAX = 8.8;

async function tryCol(tabela, chave) {
  try {
    const c = await MappingService.getColumnFromTable(tabela, chave);
    return c || null;
  } catch (e) {
    return null;
  }
}

(async () => {
  await AppDataSource.initialize();
  await OracleService.initialize();

  const schema = await MappingService.getSchema();
  const tProd = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
  const tLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

  const cCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
  const cDesc = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
  const cBarras = await tryCol('TAB_PRODUTO', 'codigo_barras');
  const cSecaoProd = await tryCol('TAB_PRODUTO', 'codigo_secao');
  const cEmbalagem = await tryCol('TAB_PRODUTO', 'embalagem');
  const cPesavel = await tryCol('TAB_PRODUTO', 'pesavel');

  const lCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
  const lCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
  const lVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
  const lCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
  const lCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');
  const lEstoque = await tryCol('TAB_PRODUTO_LOJA', 'estoque_atual');
  const lVdMedia = await tryCol('TAB_PRODUTO_LOJA', 'venda_media');
  const lForaLinha = (await tryCol('TAB_PRODUTO_LOJA', 'fora_linha')) || 'FORA_LINHA';
  const lInativo = (await tryCol('TAB_PRODUTO_LOJA', 'inativo')) || 'INATIVO';

  console.log('### MAPEAMENTO RESOLVIDO');
  console.log(JSON.stringify({
    schema, tProd, tLoja,
    cCodProd, cDesc, cBarras, cSecaoProd, cEmbalagem, cPesavel,
    lCodProd, lCodLoja, lVenda, lCusto, lCurva, lEstoque, lVdMedia, lForaLinha, lInativo
  }, null, 2));

  const selEstoque = lEstoque ? `NVL(pl.${lEstoque},0)` : '0';
  const selVdMedia = lVdMedia ? `NVL(pl.${lVdMedia},0)` : '0';
  const selBarras = cBarras ? `p.${cBarras}` : `NULL`;
  const selSecao = cSecaoProd ? `NVL(p.${cSecaoProd},0)` : '0';
  const selEmb = cEmbalagem ? `NVL(p.${cEmbalagem},' ')` : `' '`;
  const selPesavel = cPesavel ? `NVL(p.${cPesavel},'N')` : `'N'`;

  const sql = `
    SELECT
      p.${cCodProd}            AS COD_PRODUTO,
      p.${cDesc}               AS DESCRICAO,
      ${selBarras}             AS COD_BARRAS,
      ${selSecao}              AS COD_SECAO,
      ${selEmb}                AS EMBALAGEM,
      ${selPesavel}            AS PESAVEL,
      TRIM(pl.${lCurva})       AS CURVA,
      NVL(pl.${lVenda},0)      AS PRECO_VENDA,
      NVL(pl.${lCusto},0)      AS CUSTO,
      ${selEstoque}            AS ESTOQUE,
      ${selVdMedia}            AS VENDA_MEDIA
    FROM ${tProd} p
    JOIN ${tLoja} pl
      ON p.${cCodProd} = pl.${lCodProd}
     AND pl.${lCodLoja} = :codLoja
    WHERE TRIM(pl.${lCurva}) IN ('A','B')
      AND NVL(pl.${lCusto},0) BETWEEN :custoMin AND :custoMax
      AND NVL(pl.${lVenda},0) > 0
      AND NVL(pl.${lForaLinha},'N') <> 'S'
      AND NVL(pl.${lInativo},'N') <> 'S'
  `;

  const rows = await OracleService.query(sql, {
    codLoja: COD_LOJA, custoMin: CUSTO_MIN, custoMax: CUSTO_MAX
  });

  console.log('### LINHAS BRUTAS: ' + rows.length);

  const achados = [];
  for (const r of rows) {
    const custo = Number(r.CUSTO) || 0;
    const preco = Number(r.PRECO_VENDA) || 0;
    if (custo <= 0 || preco <= 0) continue;

    for (let n = 1; n <= N_MAX; n++) {
      const custoTotal = custo * n;
      if (custoTotal < 7.5 || custoTotal > 8.8) continue;
      const margem = ((10 - custoTotal) / 10) * 100;
      const precoHoje = preco * n;
      achados.push({
        cod: String(r.COD_PRODUTO),
        desc: String(r.DESCRICAO || '').trim(),
        barras: String(r.COD_BARRAS || '').trim(),
        secao: Number(r.COD_SECAO) || 0,
        embalagem: String(r.EMBALAGEM || '').trim(),
        pesavel: String(r.PESAVEL || '').trim(),
        curva: String(r.CURVA || '').trim(),
        n,
        precoUnitOferta: +(10 / n).toFixed(4),
        custoUnit: +custo.toFixed(4),
        custoTotal: +custoTotal.toFixed(2),
        margem: +margem.toFixed(1),
        precoHojeUnit: +preco.toFixed(2),
        precoHojeTotal: +precoHoje.toFixed(2),
        descontoPct: +(((precoHoje - 10) / precoHoje) * 100).toFixed(1),
        estoque: Number(r.ESTOQUE) || 0,
        vendaMedia: Number(r.VENDA_MEDIA) || 0,
      });
    }
  }

  console.log('### CANDIDATOS: ' + achados.length);
  console.log('###JSON###');
  console.log(JSON.stringify(achados));

  await OracleService.close();
  await AppDataSource.destroy();
  process.exit(0);
})().catch(e => { console.log('ERRO: ' + e.message); process.exit(1); });
