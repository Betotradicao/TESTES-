import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { AppDataSource } from '../config/database';
import { GestaoInteligenteService } from '../services/gestao-inteligente.service';
import { ConfigurationService } from '../services/configuration.service';
import { WhatsAppService } from '../services/whatsapp.service';

/**
 * Vendas Mensais por Setor/Grupo - relatorio mensal completo enviado no dia 1
 * do mes seguinte com totalizadores (venda, lucro, margem, ticket medio, qtd).
 *
 * Comparativo: APENAS mes anterior (em %, verde se cresceu, vermelho se caiu).
 * Sem listar itens individuais.
 */
export class VendasMensaisController {

  /**
   * GET /api/vendas-mensais/preview
   * Query: codLoja (opcional), mesRef (YYYY-MM opcional, default = mes anterior)
   */
  static async preview(req: Request, res: Response): Promise<void> {
    try {
      const codLoja = req.query.codLoja ? Number(req.query.codLoja) : undefined;
      const mesRef = req.query.mesRef as string | undefined;

      const data = await VendasMensaisController.coletarDados(codLoja, mesRef);

      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="vendas-mensais-preview.pdf"');
      doc.pipe(res);

      VendasMensaisController.renderPdf(doc, data);

      doc.end();
    } catch (error: any) {
      console.error('[VendasMensais] Erro preview:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error?.message || 'Erro ao gerar preview' });
      }
    }
  }

  /**
   * POST /api/vendas-mensais/send-test
   * Body: { codLoja?, mesRef? }
   */
  static async sendTest(req: Request, res: Response): Promise<void> {
    try {
      const codLoja = req.body?.codLoja ? Number(req.body.codLoja) : undefined;
      const mesRef = req.body?.mesRef as string | undefined;

      const groupId = await ConfigurationService.get('whatsapp_group_vendasMensais', '');
      if (!groupId) {
        res.status(400).json({
          success: false,
          error: 'Nenhum grupo WhatsApp configurado. Salve a configuração primeiro com um grupo selecionado.'
        });
        return;
      }

      console.log(`[VendasMensais] Gerando PDF pro grupo ${groupId}...`);
      const data = await VendasMensaisController.coletarDados(codLoja, mesRef);
      const pdfBuffer = await VendasMensaisController.renderPdfToBuffer(data);

      const caption = VendasMensaisController.buildCaption(data);
      const fileName = `vendas-mensais-${data.mesRef}.pdf`;

      const ok = await WhatsAppService.sendDocumentBuffer(groupId, pdfBuffer, fileName, caption);

      if (ok) {
        res.json({
          success: true,
          message: `PDF enviado com sucesso pro grupo! ${data.setores.length} setores.`,
          totalSetores: data.setores.length,
          totalGrupos: data.setores.reduce((acc, s) => acc + s.grupos.length, 0),
        });
      } else {
        res.status(500).json({ success: false, error: 'Falha ao enviar PDF pro WhatsApp' });
      }
    } catch (error: any) {
      console.error('[VendasMensais] Erro sendTest:', error);
      res.status(500).json({ success: false, error: error?.message || 'Erro ao enviar relatorio' });
    }
  }

  // ============ COLETA DE DADOS ============
  private static async coletarDados(codLoja?: number, mesRef?: string) {
    // mesRef formato YYYY-MM. Default = mes anterior ao atual.
    const hoje = new Date();
    let [ano, mes] = (() => {
      if (mesRef && /^\d{4}-\d{2}$/.test(mesRef)) {
        const [a, m] = mesRef.split('-').map(Number);
        return [a, m];
      }
      // mes anterior
      const m = hoje.getMonth() === 0 ? 12 : hoje.getMonth();
      const a = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
      return [a, m];
    })();

    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    // Mes anterior ao mes ref (pra comparar)
    const mesAntMes = mes === 1 ? 12 : mes - 1;
    const mesAntAno = mes === 1 ? ano - 1 : ano;
    const ultimoDiaMesAnt = new Date(mesAntAno, mesAntMes, 0).getDate();
    const mesAntInicio = `${mesAntAno}-${String(mesAntMes).padStart(2, '0')}-01`;
    const mesAntFim = `${mesAntAno}-${String(mesAntMes).padStart(2, '0')}-${String(ultimoDiaMesAnt).padStart(2, '0')}`;

    console.log(`[VendasMensais] Periodo atual: ${dataInicio} a ${dataFim} (codLoja=${codLoja || 'todas'})`);
    console.log(`[VendasMensais] Mes anterior: ${mesAntInicio} a ${mesAntFim}`);

    // 1. Vendas por setor + Indicadores totais + produtos revenda + area de venda
    // (getIndicadores ja traz comparativo atual+mesPassado com cupons DISTINCT
    //  da TAB_CUPOM_FINALIZADORA, evitando duplicacao de cupons por setor)
    const areaKey = `gestao_area_venda_${codLoja || 'all'}`;
    const [setoresAtual, setoresMesAnt, indicadores, produtosRevenda, areaConfig] = await Promise.all([
      GestaoInteligenteService.getVendasPorSetor({ dataInicio, dataFim, codLoja }),
      GestaoInteligenteService.getVendasPorSetor({ dataInicio: mesAntInicio, dataFim: mesAntFim, codLoja }).catch(() => []),
      GestaoInteligenteService.getIndicadores({ dataInicio, dataFim, codLoja }).catch(() => null),
      GestaoInteligenteService.getProdutosRevendaEstoque(codLoja).catch(() => ({ qtdProdutos: 0, qtdProducao: 0, valorEstoque: 0 })),
      AppDataSource.query(`SELECT value FROM configurations WHERE key = $1 LIMIT 1`, [areaKey]).then(r => Number(r[0]?.value) || 0).catch(() => 0),
    ]);
    const areaVendaM2 = areaConfig;
    const totalSkusCadastrados = (produtosRevenda?.qtdProdutos || 0) + (produtosRevenda?.qtdProducao || 0);

    const idxMesAnt = new Map<number, any>();
    setoresMesAnt.forEach((s: any) => idxMesAnt.set(Number(s.codSecao), s));

    // 2. Pra cada setor, buscar grupos (2 periodos)
    const result: Array<{
      setor: string;
      codSecao: number;
      atual: any;
      mesAnt: any;
      varVendaRs: number;
      varVendaPct: number;
      varLucroRs: number;
      varLucroPct: number;
      varMargemPP: number;
      varTicketRs: number;
      varTicketPct: number;
      varQtd: number;
      varQtdPct: number;
      grupos: Array<{
        codGrupo: number; grupo: string;
        atual: any; mesAnt: any;
        varVendaRs: number; varVendaPct: number;
        varLucroRs: number; varLucroPct: number;
        varMargemPP: number;
        varTicketRs: number; varTicketPct: number;
      }>;
    }> = [];

    for (const setor of setoresAtual) {
      if (!setor.codSecao) continue;
      const codSec = Number(setor.codSecao);
      const sMesAnt = idxMesAnt.get(codSec) || {};

      // grupos do setor nos 2 periodos
      const [gruposAtual, gruposMesAnt] = await Promise.all([
        GestaoInteligenteService.getGruposPorSecao({ dataInicio, dataFim, codLoja, codSecao: codSec }).catch(() => []),
        GestaoInteligenteService.getGruposPorSecao({ dataInicio: mesAntInicio, dataFim: mesAntFim, codLoja, codSecao: codSec }).catch(() => []),
      ]);
      const idxGMesAnt = new Map<number, any>();
      gruposMesAnt.forEach((g: any) => idxGMesAnt.set(Number(g.codGrupo), g));

      const grupos = gruposAtual.map((g: any) => {
        const gAnt = idxGMesAnt.get(Number(g.codGrupo)) || {};
        const varVendaRs = (g.venda || 0) - (gAnt.venda || 0);
        const varVendaPct = (gAnt.venda || 0) > 0 ? (varVendaRs / gAnt.venda) * 100 : 0;
        const varLucroRs = (g.lucro || 0) - (gAnt.lucro || 0);
        const varLucroPct = (gAnt.lucro || 0) > 0 ? (varLucroRs / gAnt.lucro) * 100 : 0;
        const varMargemPP = (g.margemLiquida || 0) - (gAnt.margemLiquida || 0);
        const varTicketRs = (g.ticketMedio || 0) - (gAnt.ticketMedio || 0);
        const varTicketPct = (gAnt.ticketMedio || 0) > 0 ? (varTicketRs / gAnt.ticketMedio) * 100 : 0;
        return {
          codGrupo: Number(g.codGrupo),
          grupo: g.grupo || '(sem nome)',
          atual: g,
          mesAnt: gAnt,
          varVendaRs,
          varVendaPct,
          varLucroRs,
          varLucroPct,
          varMargemPP,
          varTicketRs,
          varTicketPct,
        };
      }).sort((a: any, b: any) => (b.atual.venda || 0) - (a.atual.venda || 0));

      // Variacoes do setor (R$ e %)
      const varVendaRs = (setor.venda || 0) - (sMesAnt.venda || 0);
      const varVendaPct = (sMesAnt.venda || 0) > 0 ? (varVendaRs / sMesAnt.venda) * 100 : 0;
      const varLucroRs = (setor.lucro || 0) - (sMesAnt.lucro || 0);
      const varLucroPct = (sMesAnt.lucro || 0) > 0 ? (varLucroRs / sMesAnt.lucro) * 100 : 0;
      const varMargemPP = (setor.margemLiquida || 0) - (sMesAnt.margemLiquida || 0);
      const varTicketRs = (setor.ticketMedio || 0) - (sMesAnt.ticketMedio || 0);
      const varTicketPct = (sMesAnt.ticketMedio || 0) > 0 ? (varTicketRs / sMesAnt.ticketMedio) * 100 : 0;
      const varQtd = (setor.qtd || 0) - (sMesAnt.qtd || 0);
      const varQtdPct = (sMesAnt.qtd || 0) > 0 ? (varQtd / sMesAnt.qtd) * 100 : 0;

      result.push({
        setor: setor.setor,
        codSecao: codSec,
        atual: setor,
        mesAnt: sMesAnt,
        varVendaRs,
        varVendaPct,
        varLucroRs,
        varLucroPct,
        varMargemPP,
        varTicketRs,
        varTicketPct,
        varQtd,
        varQtdPct,
        grupos,
      });
    }

    // Ordena por venda atual desc
    result.sort((a, b) => (b.atual.venda || 0) - (a.atual.venda || 0));

    // Totais da loja vem do GestaoInteligente.getIndicadores (cupons DISTINCT).
    // Cada campo eh um objeto { atual, mesPassado, anoPassado, mediaLinear }.
    // Helper pra montar var R$ + var % de cada campo:
    const buildKpi = (atual: number, ant: number) => ({
      atual,
      ant,
      varRs: atual - ant,
      varPct: ant > 0 ? ((atual - ant) / ant) * 100 : 0,
    });
    const buildPP = (atual: number, ant: number) => ({
      atual,
      ant,
      varPP: atual - ant, // p.p. (pontos percentuais)
    });

    const indVendas = indicadores?.vendas || ({} as any);
    const indLucro = indicadores?.lucro || ({} as any);
    const indCustoVendas = indicadores?.custoVendas || ({} as any);
    const indMargemLimpa = indicadores?.margemLimpa || ({} as any);
    const indMarkdown = indicadores?.markdown || ({} as any);
    const indCupons = indicadores?.qtdCupons || ({} as any);
    const indItens = indicadores?.qtdItens || ({} as any);
    const indSkus = indicadores?.qtdSkus || ({} as any);
    const indTicket = indicadores?.ticketMedio || ({} as any);
    const indCompras = indicadores?.compras || ({} as any);
    const indPctCV = indicadores?.pctCompraVenda || ({} as any);

    // Excesso de Compras (formula da tela GestaoInteligente):
    //   excesso % = ((custoVendas - compras) / vendas) * 100
    //   excesso R$ = custoVendas - compras
    const calcExcesso = (vendas: number, custo: number, compras: number) => {
      if (!vendas || vendas === 0) return { pct: 0, rs: 0 };
      const pct = ((custo / vendas) - (compras / vendas)) * 100;
      const rs = custo - compras;
      return { pct, rs };
    };
    const excAt = calcExcesso(indVendas.atual || 0, indCustoVendas.atual || 0, indCompras.atual || 0);
    const excAnt = calcExcesso(indVendas.mesPassado || 0, indCustoVendas.mesPassado || 0, indCompras.mesPassado || 0);

    // Imposto Previsto: pct = markdown - margemLimpa ; rs = vendas * pct / 100
    const calcImposto = (vendas: number, markdownPct: number, margemPct: number) => {
      const pct = (markdownPct || 0) - (margemPct || 0);
      const rs = (vendas || 0) * pct / 100;
      return { pct, rs };
    };
    const impAt = calcImposto(indVendas.atual || 0, indMarkdown.atual || 0, indMargemLimpa.atual || 0);
    const impAnt = calcImposto(indVendas.mesPassado || 0, indMarkdown.mesPassado || 0, indMargemLimpa.mesPassado || 0);

    const totais = {
      venda:       buildKpi(indVendas.atual || 0, indVendas.mesPassado || 0),
      lucro:       buildKpi(indLucro.atual || 0, indLucro.mesPassado || 0),
      margem:      buildPP(indMargemLimpa.atual || 0, indMargemLimpa.mesPassado || 0),
      cupons:      buildKpi(indCupons.atual || 0, indCupons.mesPassado || 0),
      ticketMedio: buildKpi(indTicket.atual || 0, indTicket.mesPassado || 0),
      qtdItens:    buildKpi(indItens.atual || 0, indItens.mesPassado || 0),
      qtdSkus:     buildKpi(indSkus.atual || 0, indSkus.mesPassado || 0),
      compras:     buildKpi(indCompras.atual || 0, indCompras.mesPassado || 0),
      pctCompraVenda: buildPP(indPctCV.atual || 0, indPctCV.mesPassado || 0),
      excessoCompras:    { atual: excAt.rs,  ant: excAnt.rs,  varRs: excAt.rs - excAnt.rs,  varPct: excAnt.rs !== 0 ? ((excAt.rs - excAnt.rs) / Math.abs(excAnt.rs)) * 100 : 0 },
      excessoComprasPct: buildPP(excAt.pct, excAnt.pct),
      impostoPrevisto:   { atual: impAt.rs,  ant: impAnt.rs,  varRs: impAt.rs - impAnt.rs,  varPct: impAnt.rs !== 0 ? ((impAt.rs - impAnt.rs) / Math.abs(impAnt.rs)) * 100 : 0 },
      impostoPrevistoPct: buildPP(impAt.pct, impAnt.pct),
    };

    const mesNomes = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    return {
      areaVendaM2,
      totalSkusCadastrados,
      mesRef: `${ano}-${String(mes).padStart(2, '0')}`,
      mesNome: mesNomes[mes - 1],
      ano,
      dataInicio,
      dataFim,
      mesAntInicio,
      mesAntFim,
      codLoja,
      totais,
      setores: result,
    };
  }

  // ============ PDF RENDER ============
  private static renderPdfToBuffer(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        VendasMensaisController.renderPdf(doc, data);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private static fmtBRL(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  private static fmtNum(v: number, dec = 0): string {
    return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  private static fmtPct(v: number, dec = 1): string {
    if (!isFinite(v)) return '—';
    const sign = v > 0 ? '+' : '';
    return sign + v.toFixed(dec).replace('.', ',') + '%';
  }
  private static fmtPP(v: number, dec = 1): string {
    if (!isFinite(v)) return '—';
    const sign = v > 0 ? '+' : '';
    return sign + v.toFixed(dec).replace('.', ',') + ' p.p.';
  }
  private static corVar(v: number): string {
    return v > 0 ? '#2E7D32' : v < 0 ? '#C62828' : '#666';
  }
  private static brDate(iso: string): string {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  private static renderPdf(doc: PDFKit.PDFDocument, data: any) {
    const { fmtBRL, fmtPct, fmtPP, corVar, fmtNum, brDate } = VendasMensaisController;

    // ============ CAPA ============
    doc.fillColor('#1565C0').fontSize(22).font('Helvetica-Bold')
      .text(`VENDAS MENSAIS — ${data.mesNome}/${data.ano}`, { align: 'center' });
    doc.moveDown(0.4);
    doc.fillColor('#666').fontSize(11).font('Helvetica')
      .text(`Periodo: ${brDate(data.dataInicio)} a ${brDate(data.dataFim)}`, { align: 'center' });
    doc.text(`Comparativo: mes anterior (${brDate(data.mesAntInicio)} a ${brDate(data.mesAntFim)})`, { align: 'center' });
    doc.text(data.codLoja ? `Loja: ${data.codLoja}` : 'Lojas: TODAS', { align: 'center' });
    doc.moveDown(1);

    // ===== RESUMO DA LOJA =====
    doc.fillColor('#000').fontSize(14).font('Helvetica-Bold')
      .text('RESUMO DA LOJA', { align: 'center' });
    doc.moveDown(0.4);

    const T = data.totais;
    // Helper: monta string de variacao "+R$ 12.345 · +5,2%" colorida
    const kpisDinheiro: Array<[string, any]> = [
      ['Venda Total',         T.venda],
      ['Compras',             T.compras],
      ['Lucro Bruto',         T.lucro],
      ['Ticket Medio',        T.ticketMedio],
      ['Excesso de Compras',  T.excessoCompras],
      ['Imposto Previsto',    T.impostoPrevisto],
    ];
    const kpisQtd: Array<[string, any]> = [
      ['Cupons',          T.cupons],
      ['Itens Vendidos',  T.qtdItens],
    ];
    const kpisPP: Array<[string, any, (v: number) => string]> = [
      ['Margem Limpa',         T.margem,             (v) => v.toFixed(2) + '%'],
      ['% Compra/Venda',       T.pctCompraVenda,     (v) => v.toFixed(2) + '%'],
      ['Excesso de Compras %', T.excessoComprasPct,  (v) => v.toFixed(2) + '%'],
      ['Imposto Previsto %',   T.impostoPrevistoPct, (v) => v.toFixed(2) + '%'],
    ];

    // Indicadores por m² (so se area_venda configurada)
    const areaM2 = data.areaVendaM2 || 0;
    const skusCadastrados = data.totalSkusCadastrados || 0;
    const skusVendidosAtuais = T.qtdSkus?.atual || 0;

    // tabela KPI 5 colunas: Indicador | Mes | Mes Ant | Var R$ | Var %
    const tblX = 30, tblW = 782;
    const colW = [180, 150, 150, 140, 162];
    let yKpi = doc.y;
    doc.fillColor('#1565C0').rect(tblX, yKpi, tblW, 18).fill();
    doc.fillColor('#FFF').fontSize(10).font('Helvetica-Bold');
    const headersK = ['Indicador', data.mesNome, 'Mes Anterior', 'Variacao R$', 'Variacao %'];
    let xK = tblX;
    headersK.forEach((h, i) => { doc.text(h, xK + 6, yKpi + 4, { width: colW[i] - 12, align: i === 0 ? 'left' : 'right' }); xK += colW[i]; });
    yKpi += 18;
    doc.font('Helvetica').fontSize(10);

    let zebra = 0;
    const drawRow = (lbl: string, atualStr: string, antStr: string, varRsStr: string, varRsNum: number, varPctStr: string, varPctNum: number) => {
      if (zebra % 2 === 0) { doc.fillColor('#F5F5F5').rect(tblX, yKpi, tblW, 18).fill(); }
      doc.fillColor('#000');
      doc.text(lbl, tblX + 6, yKpi + 4, { width: colW[0] - 12 });
      doc.text(atualStr, tblX + colW[0] + 6, yKpi + 4, { width: colW[1] - 12, align: 'right' });
      doc.text(antStr, tblX + colW[0] + colW[1] + 6, yKpi + 4, { width: colW[2] - 12, align: 'right' });
      doc.fillColor(corVar(varRsNum)).font('Helvetica-Bold');
      doc.text(varRsStr, tblX + colW[0] + colW[1] + colW[2] + 6, yKpi + 4, { width: colW[3] - 12, align: 'right' });
      doc.fillColor(corVar(varPctNum));
      doc.text(varPctStr, tblX + colW[0] + colW[1] + colW[2] + colW[3] + 6, yKpi + 4, { width: colW[4] - 12, align: 'right' });
      doc.font('Helvetica');
      yKpi += 18;
      zebra++;
    };
    // KPIs em dinheiro: var R$ tem moeda
    kpisDinheiro.forEach(([lbl, k]) => {
      const sign = k.varRs > 0 ? '+' : '';
      drawRow(lbl, fmtBRL(k.atual), fmtBRL(k.ant), sign + fmtBRL(k.varRs), k.varRs, fmtPct(k.varPct), k.varPct);
    });
    // KPIs em quantidade: var R$ vira "var qtd"
    kpisQtd.forEach(([lbl, k]) => {
      const sign = k.varRs > 0 ? '+' : '';
      drawRow(lbl, fmtNum(k.atual), fmtNum(k.ant), sign + fmtNum(k.varRs), k.varRs, fmtPct(k.varPct), k.varPct);
    });
    // KPIs percentuais (margem, % compra/venda): valor eh em % e var eh em p.p.
    kpisPP.forEach(([lbl, k, fmt]) => {
      drawRow(lbl, fmt(k.atual), fmt(k.ant), fmtPP(k.varPP), k.varPP, '—', 0);
    });

    doc.y = yKpi;
    doc.moveDown(0.8);

    // ============ KPIs POR M² (so se area de venda configurada) ============
    if (areaM2 > 0) {
      const vendaPorM2 = (T.venda.atual || 0) / areaM2;
      const skuCadPorM2 = skusCadastrados / areaM2;
      const skuVendPorM2 = skusVendidosAtuais / areaM2;

      doc.fillColor('#000').fontSize(13).font('Helvetica-Bold')
        .text(`Por Metro Quadrado (área cadastrada: ${areaM2} m²)`, tblX);
      doc.moveDown(0.3);

      const m2Cols = [220, 200, 362];
      const m2Headers = ['Indicador', 'Valor', 'Detalhe'];
      let yM2 = doc.y;
      doc.fillColor('#1565C0').rect(tblX, yM2, tblW, 18).fill();
      doc.fillColor('#FFF').fontSize(10).font('Helvetica-Bold');
      let xM2 = tblX;
      m2Headers.forEach((h, i) => { doc.text(h, xM2 + 6, yM2 + 4, { width: m2Cols[i] - 12, align: i === 0 ? 'left' : i === 1 ? 'right' : 'left' }); xM2 += m2Cols[i]; });
      yM2 += 18;

      const drawM2 = (lbl: string, valor: string, detalhe: string, i: number) => {
        if (i % 2 === 0) { doc.fillColor('#F5F5F5').rect(tblX, yM2, tblW, 18).fill(); }
        doc.fillColor('#000').fontSize(10).font('Helvetica');
        doc.text(lbl, tblX + 6, yM2 + 4, { width: m2Cols[0] - 12 });
        doc.font('Helvetica-Bold').fillColor('#1565C0');
        doc.text(valor, tblX + m2Cols[0] + 6, yM2 + 4, { width: m2Cols[1] - 12, align: 'right' });
        doc.font('Helvetica').fillColor('#666').fontSize(9);
        doc.text(detalhe, tblX + m2Cols[0] + m2Cols[1] + 6, yM2 + 4, { width: m2Cols[2] - 12 });
        doc.fontSize(10);
        yM2 += 18;
      };

      drawM2('💰 Vendas por m²',      fmtBRL(vendaPorM2),         `venda total ${fmtBRL(T.venda.atual)} ÷ ${areaM2} m²`, 0);
      drawM2('📦 SKU cadastrado / m²', skuCadPorM2.toFixed(2),     `${fmtNum(skusCadastrados)} SKUs (revenda + producao) ÷ ${areaM2} m²`, 1);
      drawM2('✅ SKU vendido / m²',    skuVendPorM2.toFixed(2),    `${fmtNum(skusVendidosAtuais)} SKUs distintos vendidos no periodo ÷ ${areaM2} m²`, 2);
      doc.y = yM2;
      doc.moveDown(1);
    } else {
      doc.fillColor('#999').fontSize(10).font('Helvetica-Oblique')
        .text('Configure a área de venda (m²) na tela "Gestão Inteligente" para ver indicadores por m².', tblX);
      doc.moveDown(0.8);
    }

    // ============ POR SETOR ============
    const setores = data.setores || [];
    if (setores.length === 0) {
      doc.fillColor('#999').fontSize(14).text('Nenhum setor com vendas no periodo.', { align: 'center' });
      return;
    }

    for (const s of setores) {
      doc.addPage();
      // Header do setor
      doc.fillColor('#1565C0').fontSize(16).font('Helvetica-Bold').text(s.setor);
      doc.moveDown(0.2);

      // KPIs do setor (mini-tabela) - colunas: Ind | Mes | Mes Ant | Var R$ | Var %
      const sgnRs = (v: number) => (v > 0 ? '+' : v < 0 ? '-' : '') + fmtBRL(Math.abs(v));
      const sgnNum = (v: number) => (v > 0 ? '+' : '') + fmtNum(v, 0);

      type RowSet = [string, string, string, string, number, string, number];
      const kpisSet: RowSet[] = [
        ['Venda',        fmtBRL(s.atual.venda || 0),        fmtBRL(s.mesAnt.venda || 0),        sgnRs(s.varVendaRs),  s.varVendaRs,  fmtPct(s.varVendaPct),  s.varVendaPct],
        ['Lucro Bruto',  fmtBRL(s.atual.lucro || 0),        fmtBRL(s.mesAnt.lucro || 0),        sgnRs(s.varLucroRs),  s.varLucroRs,  fmtPct(s.varLucroPct),  s.varLucroPct],
        ['Margem',       (s.atual.margemLiquida || 0).toFixed(2) + '%', (s.mesAnt.margemLiquida || 0).toFixed(2) + '%', fmtPP(s.varMargemPP), s.varMargemPP, '—', 0],
        ['Cupons',       fmtNum(s.atual.qtdCupons || 0),    fmtNum(s.mesAnt.qtdCupons || 0),    sgnNum((s.atual.qtdCupons || 0) - (s.mesAnt.qtdCupons || 0)), 0, fmtPct(((s.atual.qtdCupons || 0) - (s.mesAnt.qtdCupons || 0)) / Math.max(s.mesAnt.qtdCupons || 1, 1) * 100), 0],
        ['Ticket Medio', fmtBRL(s.atual.ticketMedio || 0),  fmtBRL(s.mesAnt.ticketMedio || 0),  sgnRs(s.varTicketRs), s.varTicketRs, fmtPct(s.varTicketPct), s.varTicketPct],
        ['Itens',        fmtNum(s.atual.qtd || 0, 0),       fmtNum(s.mesAnt.qtd || 0, 0),       sgnNum(s.varQtd),     s.varQtd,      fmtPct(s.varQtdPct),    s.varQtdPct],
        ['% da loja',    (s.atual.percentualSetor || 0).toFixed(2) + '%', '—', '—', 0, '—', 0],
      ];

      let ySet = doc.y;
      const colWS = [120, 110, 110, 110, 100];
      const tblWS = colWS.reduce((a, b) => a + b, 0);
      doc.fillColor('#1565C0').rect(tblX, ySet, tblWS, 16).fill();
      doc.fillColor('#FFF').fontSize(9).font('Helvetica-Bold');
      const headersS = ['Indicador', data.mesNome, 'Mes Anterior', 'Var R$', 'Var %'];
      let xS = tblX;
      headersS.forEach((h, i) => { doc.text(h, xS + 6, ySet + 3, { width: colWS[i] - 12, align: i === 0 ? 'left' : 'right' }); xS += colWS[i]; });
      ySet += 16;
      doc.fontSize(9).font('Helvetica');
      kpisSet.forEach((row, i) => {
        if (i % 2 === 0) { doc.fillColor('#F5F5F5').rect(tblX, ySet, tblWS, 16).fill(); }
        doc.fillColor('#000');
        doc.text(String(row[0]), tblX + 6, ySet + 3, { width: colWS[0] - 12 });
        doc.text(String(row[1]), tblX + colWS[0] + 6, ySet + 3, { width: colWS[1] - 12, align: 'right' });
        doc.text(String(row[2]), tblX + colWS[0] + colWS[1] + 6, ySet + 3, { width: colWS[2] - 12, align: 'right' });
        doc.fillColor(corVar(row[4])).font('Helvetica-Bold');
        doc.text(String(row[3]), tblX + colWS[0] + colWS[1] + colWS[2] + 6, ySet + 3, { width: colWS[3] - 12, align: 'right' });
        doc.fillColor(corVar(row[6]));
        doc.text(String(row[5]), tblX + colWS[0] + colWS[1] + colWS[2] + colWS[3] + 6, ySet + 3, { width: colWS[4] - 12, align: 'right' });
        doc.font('Helvetica');
        ySet += 16;
      });
      doc.y = ySet;
      doc.moveDown(0.8);

      // Grupos do setor
      const grupos = s.grupos || [];
      doc.fillColor('#666').fontSize(11).font('Helvetica-Bold')
        .text(`Grupos do setor (${grupos.length})`);
      doc.moveDown(0.3);

      if (grupos.length === 0) {
        doc.fillColor('#999').fontSize(10).font('Helvetica-Oblique').text('(sem grupos com vendas no periodo)');
        continue;
      }

      // Tabela de grupos
      const colsG = [
        { label: 'Grupo',        x: 30,  w: 200, align: 'left' },
        { label: 'Venda',        x: 230, w: 90,  align: 'right' },
        { label: 'Var %',        x: 320, w: 60,  align: 'right' },
        { label: 'Lucro',        x: 380, w: 80,  align: 'right' },
        { label: 'Var %',        x: 460, w: 55,  align: 'right' },
        { label: 'Margem',       x: 515, w: 55,  align: 'right' },
        { label: 'Var p.p.',     x: 570, w: 60,  align: 'right' },
        { label: 'Tkt Médio',    x: 630, w: 70,  align: 'right' },
        { label: 'Var %',        x: 700, w: 55,  align: 'right' },
        { label: '% setor',      x: 755, w: 55,  align: 'right' },
      ];
      const rowLeft = 30, rowWidth = 780;

      const renderGrupoHeader = () => {
        const hY = doc.y;
        doc.fillColor('#1565C0').rect(rowLeft, hY, rowWidth, 16).fill();
        doc.fillColor('#FFF').fontSize(8).font('Helvetica-Bold');
        colsG.forEach(c => doc.text(c.label, c.x + 2, hY + 4, { width: c.w - 4, align: c.align as any }));
        doc.y = hY + 16;
        doc.fontSize(8).font('Helvetica');
      };
      renderGrupoHeader();

      let idx = 0;
      for (const g of grupos) {
        if (doc.y + 14 > 540) {
          doc.addPage();
          doc.fillColor('#1565C0').fontSize(14).font('Helvetica-Bold').text(`${s.setor} (continuacao)`);
          doc.moveDown(0.3);
          renderGrupoHeader();
        }
        const y = doc.y;
        const rowH = 14;
        if (idx % 2 === 0) doc.fillColor('#F8F8F8').rect(rowLeft, y, rowWidth, rowH).fill();
        doc.fillColor('#000').fontSize(8).font('Helvetica');
        doc.text(String(g.grupo).slice(0, 60), colsG[0].x + 2, y + 3, { width: colsG[0].w - 4 });
        doc.text(fmtBRL(g.atual.venda || 0), colsG[1].x + 2, y + 3, { width: colsG[1].w - 4, align: 'right' });
        doc.fillColor(corVar(g.varVendaPct)).font('Helvetica-Bold');
        doc.text(fmtPct(g.varVendaPct), colsG[2].x + 2, y + 3, { width: colsG[2].w - 4, align: 'right' });
        doc.fillColor('#000').font('Helvetica');
        doc.text(fmtBRL(g.atual.lucro || 0), colsG[3].x + 2, y + 3, { width: colsG[3].w - 4, align: 'right' });
        doc.fillColor(corVar(g.varLucroPct)).font('Helvetica-Bold');
        doc.text(fmtPct(g.varLucroPct), colsG[4].x + 2, y + 3, { width: colsG[4].w - 4, align: 'right' });
        doc.fillColor('#000').font('Helvetica');
        doc.text((g.atual.margemLiquida || 0).toFixed(1) + '%', colsG[5].x + 2, y + 3, { width: colsG[5].w - 4, align: 'right' });
        doc.fillColor(corVar(g.varMargemPP)).font('Helvetica-Bold');
        doc.text(fmtPP(g.varMargemPP), colsG[6].x + 2, y + 3, { width: colsG[6].w - 4, align: 'right' });
        doc.fillColor('#000').font('Helvetica');
        doc.text(fmtBRL(g.atual.ticketMedio || 0), colsG[7].x + 2, y + 3, { width: colsG[7].w - 4, align: 'right' });
        doc.fillColor(corVar(g.varTicketPct)).font('Helvetica-Bold');
        doc.text(fmtPct(g.varTicketPct), colsG[8].x + 2, y + 3, { width: colsG[8].w - 4, align: 'right' });
        doc.fillColor('#000').font('Helvetica');
        doc.text((g.atual.percentualSetor || 0).toFixed(1) + '%', colsG[9].x + 2, y + 3, { width: colsG[9].w - 4, align: 'right' });
        doc.y = y + rowH;
        idx++;
      }
    }

    // Rodape paginas
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#888').fontSize(8).font('Helvetica');
      doc.text(`Radar 360 - Vendas Mensais ${data.mesNome}/${data.ano}  |  Pagina ${i + 1} de ${pages.count}`,
        30, 575, { width: 782, align: 'center' });
    }
  }

  // ============ CAPTION WHATSAPP ============
  private static buildCaption(data: any): string {
    const { fmtBRL, fmtPct, fmtPP, fmtNum } = VendasMensaisController;
    const cor = (v: number) => v > 0 ? '🟢' : v < 0 ? '🔴' : '⚪';
    const T = data.totais;

    // Top 3 que mais cresceram + top 3 que mais cairam
    const ordenados = [...data.setores].sort((a, b) => b.varVendaPct - a.varVendaPct);
    const top3Alta = ordenados.slice(0, 3).filter(s => s.varVendaPct > 0);
    const top3Queda = [...ordenados].reverse().slice(0, 3).filter(s => s.varVendaPct < 0);

    // Helper R$ com sinal
    const fmtRsDelta = (rs: number) => (rs > 0 ? '+' : rs < 0 ? '-' : '') + fmtBRL(Math.abs(rs));

    let txt = `📊 *VENDAS DE ${data.mesNome}/${data.ano}*\n`;
    txt += `📅 ${VendasMensaisController.brDate(data.dataInicio)} a ${VendasMensaisController.brDate(data.dataFim)}\n`;
    txt += `\n💰 *VENDA TOTAL*: ${fmtBRL(T.venda.atual)}\n`;
    txt += `${cor(T.venda.varRs)} vs mes anterior: *${fmtRsDelta(T.venda.varRs)}* · *${fmtPct(T.venda.varPct)}* (mes ant: ${fmtBRL(T.venda.ant)})\n`;
    txt += `\n*Indicadores da loja:*\n`;
    txt += `💵 Lucro: ${fmtBRL(T.lucro.atual)}  ${cor(T.lucro.varRs)} ${fmtRsDelta(T.lucro.varRs)} · *${fmtPct(T.lucro.varPct)}*\n`;
    txt += `📈 Margem: ${T.margem.atual.toFixed(2)}%  ${cor(T.margem.varPP)} *${fmtPP(T.margem.varPP)}*\n`;
    txt += `💳 Ticket Medio: ${fmtBRL(T.ticketMedio.atual)}  ${cor(T.ticketMedio.varRs)} ${fmtRsDelta(T.ticketMedio.varRs)} · *${fmtPct(T.ticketMedio.varPct)}*\n`;
    txt += `🧾 Cupons: ${fmtNum(T.cupons.atual)}  ${cor(T.cupons.varRs)} ${T.cupons.varRs > 0 ? '+' : ''}${fmtNum(T.cupons.varRs)} · *${fmtPct(T.cupons.varPct)}*\n`;
    txt += `📦 Itens vendidos: ${fmtNum(T.qtdItens.atual, 0)}  ${cor(T.qtdItens.varRs)} *${fmtPct(T.qtdItens.varPct)}*\n`;
    txt += `🛒 Compras: ${fmtBRL(T.compras.atual)}  ${cor(T.compras.varRs)} *${fmtPct(T.compras.varPct)}*\n`;
    txt += `📊 % Compra/Venda: ${T.pctCompraVenda.atual.toFixed(2)}%  ${cor(T.pctCompraVenda.varPP)} *${fmtPP(T.pctCompraVenda.varPP)}*\n`;
    // Excesso: positivo = comprou mais do que custou (estoque crescendo) - alerta vermelho
    txt += `⚠️ Excesso Compras: ${fmtBRL(T.excessoCompras.atual)} (${T.excessoComprasPct.atual.toFixed(2)}%)\n`;
    txt += `🏛️ Imposto Previsto: ${fmtBRL(T.impostoPrevisto.atual)} (${T.impostoPrevistoPct.atual.toFixed(2)}%)\n`;

    if (top3Alta.length) {
      txt += `\n🏆 *Setores que CRESCERAM:*\n`;
      top3Alta.forEach(s => {
        txt += `🟢 ${s.setor}: *${fmtPct(s.varVendaPct)}* (${fmtBRL(s.atual.venda || 0)})\n`;
      });
    }
    if (top3Queda.length) {
      txt += `\n⚠️ *Setores que CAIRAM:*\n`;
      top3Queda.forEach(s => {
        txt += `🔴 ${s.setor}: *${fmtPct(s.varVendaPct)}* (${fmtBRL(s.atual.venda || 0)})\n`;
      });
    }

    txt += `\n📎 PDF anexo com detalhamento por setor e grupos`;
    return txt;
  }
}
