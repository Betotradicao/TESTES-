import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { GestaoInteligenteService } from '../services/gestao-inteligente.service';
import { ConfigurationService } from '../services/configuration.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { MappingService } from '../services/mapping.service';
import { OracleService } from '../services/oracle.service';

/**
 * Top Quedas Semanal - relatorio em PDF dos 20 itens em maior queda por setor.
 * Comparativo: mes-corrente vs mes-anterior + mes-corrente vs mesmo-mes-ano-anterior.
 */
export class TopQuedasController {

  /**
   * GET /api/top-quedas/preview
   * Gera o PDF e devolve como blob (pra preview no botao "Testar Envio").
   * Query: codLoja (opcional)
   */
  static async preview(req: Request, res: Response): Promise<void> {
    try {
      const codLoja = req.query.codLoja ? Number(req.query.codLoja) : undefined;

      const data = await TopQuedasController.coletarDados(codLoja);

      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="top-quedas-preview.pdf"');
      doc.pipe(res);

      TopQuedasController.renderPdf(doc, data);

      doc.end();
    } catch (error: any) {
      console.error('[TopQuedas] Erro preview:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error?.message || 'Erro ao gerar preview' });
      }
    }
  }

  /**
   * POST /api/top-quedas/send-test
   * Gera o PDF e envia AGORA pro grupo configurado em whatsapp_group_topQuedas.
   * Body: { codLoja? } (opcional)
   */
  static async sendTest(req: Request, res: Response): Promise<void> {
    try {
      const codLoja = req.body?.codLoja ? Number(req.body.codLoja) : undefined;

      const groupId = await ConfigurationService.get('whatsapp_group_topQuedas', '');
      if (!groupId) {
        res.status(400).json({
          success: false,
          error: 'Nenhum grupo WhatsApp configurado. Salve a configuração primeiro com um grupo selecionado.'
        });
        return;
      }

      console.log(`[TopQuedas] Gerando PDF de teste pro grupo ${groupId}...`);
      const data = await TopQuedasController.coletarDados(codLoja);

      // Gerar PDF em buffer
      const pdfBuffer = await TopQuedasController.renderPdfToBuffer(data);

      const dataAtual = new Date().toLocaleDateString('pt-BR');
      const totalSetores = data.setores.length;
      const totalGrupos = data.setores.reduce((acc: number, s: any) => acc + (s.grupos?.length || 0), 0);
      const totalItens = data.setores.reduce(
        (acc: number, s: any) => acc + (s.grupos || []).reduce((a: number, g: any) => a + (g.itens?.length || 0), 0),
        0
      );

      const fmtBRL = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtPct = (v: number) => {
        if (!isFinite(v) || v === 0) return '0,0%';
        const sign = v > 0 ? '+' : '';
        return sign + v.toFixed(1).replace('.', ',') + '%';
      };
      // Cor visual via emoji (verde sobe / vermelho cai), grudado no R$ e no %
      const cor = (v: number) => v < 0 ? '🔴' : v > 0 ? '🟢' : '⚪';

      // Bloco resumo de cada setor
      const blocosSetor = data.setores
        .sort((a: any, b: any) => b.vendaAtual - a.vendaAtual)
        .map((s: any) =>
          `🛒 *${s.setor}* — *${fmtBRL(s.vendaAtual)}*\n` +
          `  📅 Mês anterior: ${cor(s.varMesPct)} *${fmtBRL(s.vendaMesAnterior)}*  ${cor(s.varMesPct)} *${fmtPct(s.varMesPct)}*\n` +
          `  🗓️ Ano anterior: ${cor(s.varAnoPct)} *${fmtBRL(s.vendaAnoAnterior)}*  ${cor(s.varAnoPct)} *${fmtPct(s.varAnoPct)}*\n` +
          `  📊 Média linear: ${cor(s.varMediaLinearPct)} *${fmtBRL(s.mediaLinear)}*  ${cor(s.varMediaLinearPct)} *${fmtPct(s.varMediaLinearPct)}*`
        )
        .join('\n\n');

      const caption = `📉 *TOP QUEDAS SEMANAL* (Teste)\n` +
                      `📅 Período: ${TopQuedasController.brDate(data.dataInicio)} a ${TopQuedasController.brDate(data.dataFim)} (últimos 7 dias)\n` +
                      `📊 Comparativo: mês anterior + ano anterior (mesmos 7 dias)\n` +
                      `\n💼 *VENDAS POR SETOR*\n` +
                      `${blocosSetor || '_(sem dados de vendas no período)_'}\n` +
                      `\n📦 *${totalItens}* itens em queda · ${totalGrupos} grupos · top 15 por grupo (PDF anexo)\n` +
                      `\n_Enviado manualmente em ${dataAtual} via Radar 360_`;

      const fileName = `top-quedas-${data.dataInicio}-a-${data.dataFim}.pdf`;
      const ok = await WhatsAppService.sendDocumentBuffer(groupId, pdfBuffer, fileName, caption);

      if (ok) {
        res.json({
          success: true,
          message: `PDF enviado com sucesso pro grupo! ${totalSetores} setores, ${totalItens} itens.`,
          totalSetores,
          totalItens,
        });
      } else {
        res.status(500).json({ success: false, error: 'Falha ao enviar PDF pro WhatsApp' });
      }
    } catch (error: any) {
      console.error('[TopQuedas] Erro send-test:', error);
      res.status(500).json({ success: false, error: error?.message || 'Erro ao enviar teste' });
    }
  }

  /**
   * Renderiza o PDF e retorna como Buffer (pra envio via WhatsApp).
   */
  private static renderPdfToBuffer(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        TopQuedasController.renderPdf(doc, data);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Coleta dados: pra cada setor, busca itens com comparativo e filtra os 20 piores.
   * Tambem retorna RESUMO por setor (total vendas atual/mes ant/ano ant + variacoes).
   */
  private static async coletarDados(codLoja?: number) {
    // ============ PERIODO: ULTIMOS 7 DIAS (semana corrente, ate ontem) ============
    // Ex: hoje=segunda 02/06 -> dataFim=domingo 01/06, dataInicio=segunda 26/05
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    const seteAtras = new Date(hoje); seteAtras.setDate(hoje.getDate() - 7);
    const dataInicio = ymd(seteAtras);
    const dataFim = ymd(ontem);

    // Comparativo MES ANTERIOR: mesmos 7 dias, 1 mes atras
    const mesAntIniDate = new Date(seteAtras); mesAntIniDate.setMonth(seteAtras.getMonth() - 1);
    const mesAntFimDate = new Date(ontem); mesAntFimDate.setMonth(ontem.getMonth() - 1);
    const mesAntInicio = ymd(mesAntIniDate);
    const mesAntFim = ymd(mesAntFimDate);

    // Comparativo ANO ANTERIOR: mesmos 7 dias, 1 ano atras
    const anoAntIniDate = new Date(seteAtras); anoAntIniDate.setFullYear(seteAtras.getFullYear() - 1);
    const anoAntFimDate = new Date(ontem); anoAntFimDate.setFullYear(ontem.getFullYear() - 1);
    const anoAntInicio = ymd(anoAntIniDate);
    const anoAntFim = ymd(anoAntFimDate);

    console.log(`[TopQuedas] Periodo atual (7 dias): ${dataInicio} a ${dataFim} (codLoja=${codLoja || 'todas'})`);
    console.log(`[TopQuedas] Mes anterior (mesmos 7 dias): ${mesAntInicio} a ${mesAntFim}`);
    console.log(`[TopQuedas] Ano anterior (mesmos 7 dias): ${anoAntInicio} a ${anoAntFim}`);

    // 1. Setores - 3 periodos em paralelo
    const [setoresAtual, setoresMesAnt, setoresAnoAnt] = await Promise.all([
      GestaoInteligenteService.getVendasPorSetor({ dataInicio, dataFim, codLoja }),
      GestaoInteligenteService.getVendasPorSetor({ dataInicio: mesAntInicio, dataFim: mesAntFim, codLoja }).catch(() => []),
      GestaoInteligenteService.getVendasPorSetor({ dataInicio: anoAntInicio, dataFim: anoAntFim, codLoja }).catch(() => []),
    ]);

    // Indexar comparativos por codSecao
    const idxMesAnt = new Map<number, any>();
    setoresMesAnt.forEach((s: any) => idxMesAnt.set(Number(s.codSecao), s));
    const idxAnoAnt = new Map<number, any>();
    setoresAnoAnt.forEach((s: any) => idxAnoAnt.set(Number(s.codSecao), s));

    // 2. Resumo do setor + top 15 itens em queda POR GRUPO dentro do setor
    const result: Array<{
      setor: string;
      codSecao: number;
      vendaAtual: number;
      vendaMesAnterior: number;
      vendaAnoAnterior: number;
      mediaLinear: number;
      varMesPct: number;
      varAnoPct: number;
      varMediaLinearPct: number;
      grupos: Array<{ codGrupo: number; desGrupo: string; itens: any[] }>;
    }> = [];

    // Projecao "se mantiver esse ritmo de 7 dias por todo o mes"
    const diasDecorridos = 7;
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

    for (const setor of setoresAtual) {
      if (!setor.codSecao) continue;
      const codSec = Number(setor.codSecao);
      const sMesAnt = idxMesAnt.get(codSec);
      const sAnoAnt = idxAnoAnt.get(codSec);
      const vAtual = Number(setor.venda || 0);
      const vMesAnt = sMesAnt ? Number(sMesAnt.venda || 0) : 0;
      const vAnoAnt = sAnoAnt ? Number(sAnoAnt.venda || 0) : 0;
      const varMesPct = vMesAnt > 0 ? ((vAtual - vMesAnt) / vMesAnt) * 100 : 0;
      const varAnoPct = vAnoAnt > 0 ? ((vAtual - vAnoAnt) / vAnoAnt) * 100 : 0;
      const mediaLinear = diasDecorridos > 0 ? (vAtual / diasDecorridos) * diasNoMes : 0;
      const varMediaLinearPct = vMesAnt > 0 ? ((mediaLinear - vMesAnt) / vMesAnt) * 100 : 0;

      // Top 15 itens em queda POR GRUPO dentro deste setor
      const grupos: Array<{ codGrupo: number; desGrupo: string; itens: any[] }> = [];
      try {
        const itens = await TopQuedasController.buscarItensPorSecaoComComparativo(
          codSec, dataInicio, dataFim, codLoja
        );
        // Filtra itens em queda vs mes anterior
        const emQueda = itens
          .filter((it: any) => (it.vendaMesAnterior || 0) > 0 && (it.vendaAtual || 0) < (it.vendaMesAnterior || 0));
        // Agrupa por GRUPO
        const porGrupo = new Map<number, { codGrupo: number; desGrupo: string; itens: any[] }>();
        emQueda.forEach((it: any) => {
          const cg = Number(it.codGrupo || 0);
          if (!porGrupo.has(cg)) {
            porGrupo.set(cg, { codGrupo: cg, desGrupo: it.desGrupo || '(sem grupo)', itens: [] });
          }
          porGrupo.get(cg)!.itens.push(it);
        });
        // Em cada grupo: ordena por maior queda em R$ (absoluta) e pega top 15
        // rsCaiuMes = vendaAtual - vendaMesAnterior (negativo quando caiu).
        // Ordem ascendente = mais negativo primeiro = maior queda em R$.
        porGrupo.forEach((g) => {
          g.itens.sort((a: any, b: any) => (a.rsCaiuMes || 0) - (b.rsCaiuMes || 0));
          g.itens = g.itens.slice(0, 15);
          grupos.push(g);
        });
        // Ordena grupos pela soma de R$ perdido (queda absoluta) descendente
        grupos.sort((a, b) => {
          const perdaA = a.itens.reduce((s: number, i: any) => s + Math.abs(i.rsCaiuMes || 0), 0);
          const perdaB = b.itens.reduce((s: number, i: any) => s + Math.abs(i.rsCaiuMes || 0), 0);
          return perdaB - perdaA;
        });
      } catch (err: any) {
        console.error(`[TopQuedas] Erro itens setor ${setor.setor}:`, err?.message);
      }

      result.push({
        setor: setor.setor,
        codSecao: codSec,
        vendaAtual: vAtual,
        vendaMesAnterior: vMesAnt,
        vendaAnoAnterior: vAnoAnt,
        mediaLinear,
        varMesPct,
        varAnoPct,
        varMediaLinearPct,
        grupos,
      });
    }

    const totalGrupos = result.reduce((acc, s) => acc + s.grupos.length, 0);
    const totalItens = result.reduce((acc, s) => acc + s.grupos.reduce((a, g) => a + g.itens.length, 0), 0);
    console.log(`[TopQuedas] Setores: ${result.length} | Grupos com queda: ${totalGrupos} | Itens em queda: ${totalItens}`);

    return {
      dataInicio,
      dataFim,
      mesAntInicio,
      mesAntFim,
      anoAntInicio,
      anoAntFim,
      diasDecorridos,
      diasNoMes,
      codLoja,
      setores: result,
    };
  }

  /**
   * Helper: busca itens de uma secao com vendas atual / mes anterior / ano anterior
   */
  private static async buscarItensPorSecaoComComparativo(
    codSecao: number,
    dataInicio: string,
    dataFim: string,
    codLoja?: number
  ): Promise<any[]> {
    // Calcular periodos comparativos.
    // Usa JS Date com overflow automatico pra evitar datas invalidas como
    // 31/abril (que nao existe). Se data original eh 31/05, mes anterior
    // fica 30/04 (ultimo dia de abril) em vez de 31/04 invalido.
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const shiftMes = (iso: string, delta: number) => {
      const [a, m, dd] = iso.split('-').map(Number);
      // Cria data fixando dia 1 e depois ajusta dia pra MIN(dia_original, ultimo_dia_do_mes_alvo)
      const targetMonth = m - 1 + delta; // pode ser negativo - Date entende e ajusta ano
      const ultimoDiaAlvo = new Date(a, targetMonth + 1, 0).getDate();
      const diaSeguro = Math.min(dd, ultimoDiaAlvo);
      return ymd(new Date(a, targetMonth, diaSeguro));
    };
    const shiftAno = (iso: string, delta: number) => {
      const [a, m, dd] = iso.split('-').map(Number);
      const targetYear = a + delta;
      const ultimoDiaAlvo = new Date(targetYear, m, 0).getDate();
      const diaSeguro = Math.min(dd, ultimoDiaAlvo);
      return ymd(new Date(targetYear, m - 1, diaSeguro));
    };
    const calcPeriodoAnterior = (ini: string, fim: string) => ({ ini: shiftMes(ini, -1), fim: shiftMes(fim, -1) });
    const calcPeriodoAnoAnterior = (ini: string, fim: string) => ({ ini: shiftAno(ini, -1), fim: shiftAno(fim, -1) });

    const mesAnt = calcPeriodoAnterior(dataInicio, dataFim);
    const anoAnt = calcPeriodoAnoAnterior(dataInicio, dataFim);

    // Buscar 3 periodos em paralelo - query Oracle direta filtrando so por secao
    const [vendasAtual, vendasMesAnt, vendasAnoAnt] = await Promise.all([
      TopQuedasController.queryItensPorSecao(dataInicio, dataFim, codSecao, codLoja),
      TopQuedasController.queryItensPorSecao(mesAnt.ini, mesAnt.fim, codSecao, codLoja),
      TopQuedasController.queryItensPorSecao(anoAnt.ini, anoAnt.fim, codSecao, codLoja),
    ]);

    // Indexar por COD_PRODUTO
    const idxMesAnt = new Map<string, any>();
    vendasMesAnt.forEach((r: any) => idxMesAnt.set(String(r.COD_PRODUTO || r.codProduto), r));
    const idxAnoAnt = new Map<string, any>();
    vendasAnoAnt.forEach((r: any) => idxAnoAnt.set(String(r.COD_PRODUTO || r.codProduto), r));

    // Montar resultado com comparativo
    return vendasAtual.map((r: any) => {
      const codProd = String(r.COD_PRODUTO || r.codProduto);
      const desc = r.DES_PRODUTO || r.PRODUTO || r.produto || '-';
      const codGrupo = Number(r.COD_GRUPO || r.codGrupo || 0);
      const desGrupo = r.DES_GRUPO || r.desGrupo || '(sem grupo)';
      const vAtual = Number(r.VENDA || r.venda || 0);
      const cAtual = Number(r.CUSTO || r.custo || 0);
      const lAtual = vAtual - cAtual;
      const mAnt = idxMesAnt.get(codProd);
      const aAnt = idxAnoAnt.get(codProd);
      const vMesAnt = mAnt ? Number(mAnt.VENDA || mAnt.venda || 0) : 0;
      const cMesAnt = mAnt ? Number(mAnt.CUSTO || mAnt.custo || 0) : 0;
      const lMesAnt = vMesAnt - cMesAnt;
      const vAnoAnt = aAnt ? Number(aAnt.VENDA || aAnt.venda || 0) : 0;
      const cAnoAnt = aAnt ? Number(aAnt.CUSTO || aAnt.custo || 0) : 0;
      const lAnoAnt = vAnoAnt - cAnoAnt;
      const varMesPct = vMesAnt > 0 ? ((vAtual - vMesAnt) / vMesAnt) * 100 : 0;
      const varAnoPct = vAnoAnt > 0 ? ((vAtual - vAnoAnt) / vAnoAnt) * 100 : 0;

      return {
        codProduto: codProd,
        produto: desc,
        codGrupo,
        desGrupo,
        vendaAtual: vAtual,
        vendaMesAnterior: vMesAnt,
        vendaAnoAnterior: vAnoAnt,
        lucroAtual: lAtual,
        lucroMesAnterior: lMesAnt,
        lucroAnoAnterior: lAnoAnt,
        varMesPct,
        varAnoPct,
        rsCaiuMes: vAtual - vMesAnt,
        rsCaiuAno: vAtual - vAnoAnt,
      };
    });
  }

  /**
   * Query Oracle direta: vendas por item filtrando APENAS por secao + periodo
   * (vs `buscarVendasPorItemPeriodo` do GestaoInteligente que exige codGrupo+codSubgrupo).
   * Usa MappingService pra TODAS as tabelas e colunas (regra obrigatoria do projeto).
   * Recebe datas em YYYY-MM-DD, converte pra DD/MM/YYYY pra Oracle.
   */
  private static async queryItensPorSecao(
    dataInicio: string, dataFim: string, codSecao: number, codLoja?: number
  ): Promise<any[]> {
    try {
      const schema = await MappingService.getSchema();
      const tabPv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
      const tabP = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabG = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;

      // Colunas mapeadas
      const colCodProdutoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const colCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
      const colCodGrupoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
      // TAB_GRUPO tem chave composta (COD_GRUPO + COD_SECAO).
      // Mesmo COD_GRUPO existe em varios setores no ERP Intersolid.
      const colCodGrupoG = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
      const colCodSecaoG = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao');
      const colDesGrupoG = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
      const colCodProdutoPv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
      const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
      const colCodLojaPv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
      const colValTotal = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
      const colValCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
      const colQtdTotal = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');

      const [aIni, mIni, dIni] = dataInicio.split('-');
      const [aFim, mFim, dFim] = dataFim.split('-');
      const dataIniBR = `${dIni}/${mIni}/${aIni}`;
      const dataFimBR = `${dFim}/${mFim}/${aFim}`;

      let sql = `
        SELECT p.${colCodProdutoP} as COD_PRODUTO, p.${colDesProduto} as DES_PRODUTO,
          p.${colCodGrupoP} as COD_GRUPO, g.${colDesGrupoG} as DES_GRUPO,
          NVL(SUM(pv.${colValTotal}), 0) as VENDA,
          NVL(SUM(pv.${colValCusto} * pv.${colQtdTotal}), 0) as CUSTO,
          NVL(SUM(pv.${colQtdTotal}), 0) as QTD
        FROM ${tabPv} pv
        JOIN ${tabP} p ON p.${colCodProdutoP} = pv.${colCodProdutoPv} AND p.${colCodSecao} = :codSecao
        LEFT JOIN ${tabG} g ON g.${colCodGrupoG} = p.${colCodGrupoP} AND g.${colCodSecaoG} = p.${colCodSecao}
        WHERE pv.${colDtaSaida} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
      `;
      const params: any = { codSecao, dataInicio: dataIniBR, dataFim: dataFimBR };
      if (codLoja) {
        sql += ` AND pv.${colCodLojaPv} = :codLoja`;
        params.codLoja = codLoja;
      }
      sql += ` GROUP BY p.${colCodProdutoP}, p.${colDesProduto}, p.${colCodGrupoP}, g.${colDesGrupoG} ORDER BY VENDA DESC`;

      return await OracleService.query<any>(sql, params);
    } catch (err: any) {
      console.error(`[TopQuedas] queryItensPorSecao(${codSecao}, ${dataInicio}-${dataFim}):`, err?.message);
      return [];
    }
  }

  /**
   * Render do PDF
   */
  private static renderPdf(doc: PDFKit.PDFDocument, data: any) {
    const fmtMoney = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtPct = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

    // CAPA
    doc.fillColor('#FF6B00').fontSize(20).font('Helvetica-Bold')
      .text('TOP 15 ITENS EM QUEDA POR GRUPO', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor('#666').fontSize(12).font('Helvetica')
      .text('Agrupado por SECAO -> GRUPO', { align: 'center' });
    doc.moveDown(0.5);

    doc.fillColor('#333').fontSize(11).font('Helvetica')
      .text(`Periodo (ultimos 7 dias): ${TopQuedasController.brDate(data.dataInicio)} a ${TopQuedasController.brDate(data.dataFim)}`, { align: 'center' });
    doc.text(`Comparativo MES ANTERIOR (mesmos 7 dias): ${TopQuedasController.brDate(data.mesAntInicio)} a ${TopQuedasController.brDate(data.mesAntFim)}`, { align: 'center' });
    doc.text(`Comparativo ANO ANTERIOR (mesmos 7 dias): ${TopQuedasController.brDate(data.anoAntInicio)} a ${TopQuedasController.brDate(data.anoAntFim)}`, { align: 'center' });
    if (data.codLoja) {
      doc.text(`Loja: ${data.codLoja}`, { align: 'center' });
    } else {
      doc.text('Lojas: TODAS', { align: 'center' });
    }
    doc.moveDown(1);

    if (!data.setores || data.setores.length === 0) {
      doc.fontSize(14).fillColor('#999').text('Nenhum dado de vendas encontrado no periodo.', { align: 'center' });
      return;
    }

    // 1 setor por capitulo
    let primeiraSecao = true;
    for (const setor of data.setores) {
      if (!primeiraSecao) doc.addPage();
      primeiraSecao = false;

      doc.fillColor('#FF6B00').fontSize(16).font('Helvetica-Bold')
        .text(`${setor.setor}`);
      doc.moveDown(0.3);

      // Bloco RESUMO DO SETOR (totais com comparativo)
      doc.fillColor('#000').fontSize(10).font('Helvetica-Bold')
        .text('RESUMO DO SETOR');
      doc.moveDown(0.2);
      const resumoLineas = [
        ['Vendas (atual)', fmtMoney(setor.vendaAtual), '', '#000'],
        ['Mês anterior', fmtMoney(setor.vendaMesAnterior), fmtPct(setor.varMesPct), setor.varMesPct < 0 ? '#C62828' : '#2E7D32'],
        ['Ano anterior', fmtMoney(setor.vendaAnoAnterior), fmtPct(setor.varAnoPct), setor.varAnoPct < 0 ? '#C62828' : '#2E7D32'],
        ['Média linear (projeção)', fmtMoney(setor.mediaLinear), fmtPct(setor.varMediaLinearPct), setor.varMediaLinearPct < 0 ? '#C62828' : '#2E7D32'],
      ];
      doc.fontSize(9).font('Helvetica');
      for (const [lbl, val, pct, cor] of resumoLineas) {
        const yLine = doc.y;
        doc.fillColor('#000').text(lbl, 36, yLine, { width: 180 });
        doc.fillColor('#000').text(val, 220, yLine, { width: 100, align: 'right' });
        if (pct) doc.fillColor(cor).text(pct, 330, yLine, { width: 70, align: 'right' });
        doc.y = yLine + 12;
      }
      doc.fillColor('#000');
      doc.moveDown(0.5);

      if (!setor.grupos || setor.grupos.length === 0) {
        doc.fontSize(10).fillColor('#888').font('Helvetica-Oblique')
          .text('(Nenhum item em queda neste setor.)');
        doc.moveDown(0.5);
        continue;
      }

      // Layout LANDSCAPE A4: 842 x 595, margem 30 -> util 782
      const COL_VENDA_ATUAL_BG = '#E8F5E9';
      const COL_VENDA_ATUAL_TX = '#1B5E20';
      const cols = [
        { label: 'Cod',          x: 30,  w: 50,  align: 'left' },
        { label: 'Produto',      x: 80,  w: 230, align: 'left' },
        { label: 'Vendas Atual', x: 310, w: 78,  align: 'right' },
        { label: 'Mês Ant R$',   x: 388, w: 70,  align: 'right' },
        { label: 'Var %',        x: 458, w: 48,  align: 'right' },
        { label: 'Ano Ant R$',   x: 506, w: 70,  align: 'right' },
        { label: 'Var %',        x: 576, w: 48,  align: 'right' },
        { label: 'Lucro Atual',  x: 624, w: 65,  align: 'right' },
        { label: 'Lucro M.Ant',  x: 689, w: 65,  align: 'right' },
        { label: 'Lucro A.Ant',  x: 754, w: 58,  align: 'right' },
      ];
      const rowLeft = 30;
      const rowWidth = 782;

      const renderHeader = () => {
        const hY = doc.y;
        doc.fillColor('#FF6B00').rect(rowLeft, hY - 2, rowWidth, 16).fill();
        doc.fillColor('#43A047').rect(cols[2].x, hY - 2, cols[2].w, 16).fill();
        doc.fillColor('#FFF').fontSize(8).font('Helvetica-Bold');
        cols.forEach(c => {
          doc.text(c.label, c.x + 2, hY + 3, { width: c.w - 4, align: c.align as any });
        });
        doc.y = hY + 16;
        doc.fontSize(8).font('Helvetica');
      };

      // 1 grupo por bloco: titulo do grupo + tabela com 15 itens
      let primeiroGrupo = true;
      for (const grupo of setor.grupos) {
        const perdaGrupo = grupo.itens.reduce((s: number, i: any) => s + Math.abs(i.rsCaiuMes || 0), 0);

        // Quebra de pagina se nao cabe o titulo + header + 3 linhas
        if (doc.y + 80 > 540) {
          doc.addPage();
          doc.fillColor('#FF6B00').fontSize(16).font('Helvetica-Bold')
            .text(`${setor.setor} (continuacao)`);
          doc.moveDown(0.3);
        }
        if (!primeiroGrupo) doc.moveDown(0.5);
        primeiroGrupo = false;

        // Titulo do GRUPO
        doc.fillColor('#1565C0').fontSize(11).font('Helvetica-Bold')
          .text(`▸ ${grupo.desGrupo}`, 30);
        doc.fillColor('#666').fontSize(9).font('Helvetica')
          .text(`${grupo.itens.length} item(ns) em queda · perda total no periodo: ${fmtMoney(perdaGrupo)}`, 30);
        doc.moveDown(0.2);

        // Header da tabela
        renderHeader();

        // Linhas
        doc.fontSize(8).font('Helvetica');
        let rowIdx = 0;
        for (const item of grupo.itens) {
          const produto = String(item.produto || '-');
          const prodH = doc.heightOfString(produto, { width: cols[1].w - 4 });
          const rowH = Math.max(13, prodH + 4);

          if (doc.y + rowH > 540) {
            doc.addPage();
            renderHeader();
          }

          const y = doc.y;
          if (rowIdx % 2 === 0) {
            doc.fillColor('#F8F8F8').rect(rowLeft, y, rowWidth, rowH).fill();
          }
          doc.fillColor(COL_VENDA_ATUAL_BG).rect(cols[2].x, y, cols[2].w, rowH).fill();

          doc.fillColor('#000');
          doc.text(String(item.codProduto || '-'), cols[0].x + 2, y + 2, { width: cols[0].w - 4 });
          doc.text(produto, cols[1].x + 2, y + 2, { width: cols[1].w - 4 });

          doc.fillColor(COL_VENDA_ATUAL_TX).font('Helvetica-Bold');
          doc.text(fmtMoney(item.vendaAtual), cols[2].x + 2, y + 2, { width: cols[2].w - 4, align: 'right' });
          doc.font('Helvetica');

          doc.fillColor('#000');
          doc.text(fmtMoney(item.vendaMesAnterior), cols[3].x + 2, y + 2, { width: cols[3].w - 4, align: 'right' });
          doc.fillColor(item.varMesPct < 0 ? '#C62828' : '#2E7D32');
          doc.text(fmtPct(item.varMesPct), cols[4].x + 2, y + 2, { width: cols[4].w - 4, align: 'right' });

          doc.fillColor('#000');
          doc.text(fmtMoney(item.vendaAnoAnterior), cols[5].x + 2, y + 2, { width: cols[5].w - 4, align: 'right' });
          doc.fillColor(item.varAnoPct < 0 ? '#C62828' : '#2E7D32');
          doc.text(fmtPct(item.varAnoPct), cols[6].x + 2, y + 2, { width: cols[6].w - 4, align: 'right' });

          doc.fillColor('#000');
          doc.text(fmtMoney(item.lucroAtual || 0), cols[7].x + 2, y + 2, { width: cols[7].w - 4, align: 'right' });
          doc.text(fmtMoney(item.lucroMesAnterior || 0), cols[8].x + 2, y + 2, { width: cols[8].w - 4, align: 'right' });
          doc.text(fmtMoney(item.lucroAnoAnterior || 0), cols[9].x + 2, y + 2, { width: cols[9].w - 4, align: 'right' });

          doc.y = y + rowH;
          rowIdx++;
        }
      }

      doc.moveDown(0.5);
    }

    // Rodape em todas as paginas (landscape: altura 595)
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#888').fontSize(8).font('Helvetica');
      doc.text(`Radar 360 - Top Quedas - ${TopQuedasController.brDate(data.dataInicio)} a ${TopQuedasController.brDate(data.dataFim)}  |  Pagina ${i + 1} de ${pages.count}`,
        30, 575, { width: 782, align: 'center' });
    }
  }

  private static brDate(d: string): string {
    const [a, m, di] = d.split('-');
    return `${di}/${m}/${a}`;
  }
}
