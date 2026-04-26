import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { GestaoInteligenteService } from '../services/gestao-inteligente.service';

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

      const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
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
   * Coleta dados: pra cada setor, busca itens com comparativo e filtra os 20 piores
   */
  private static async coletarDados(codLoja?: number) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    const dia = hoje.getDate();
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    console.log(`[TopQuedas] Coletando dados de ${dataInicio} a ${dataFim} (codLoja=${codLoja || 'todas'})`);

    // 1. Lista de setores (com vendas no periodo)
    const setores = await GestaoInteligenteService.getVendasPorSetor({ dataInicio, dataFim, codLoja });

    const result: Array<{
      setor: string;
      codSecao: number;
      itens: any[];
    }> = [];

    // 2. Pra cada setor, busca itens com comparativo
    for (const setor of setores) {
      if (!setor.codSecao) continue;
      try {
        // getItensAnaliticos retorna itens com vendaAtual/vendaMesAnterior/vendaAnoAnterior + variacao %
        // Como nao temos codGrupo/codSubgrupo, vou usar uma busca por secao via metodo direto
        // Reaproveitando o helper buscarVendasPorItemPeriodo (que aceita so codSecao)
        const itens = await TopQuedasController.buscarItensPorSecaoComComparativo(
          setor.codSecao,
          dataInicio,
          dataFim,
          codLoja
        );

        // Ordena por queda em % (mes anterior) e pega top 20 com queda
        const top20Quedas = itens
          .filter((it: any) => (it.vendaMesAnterior || 0) > 0 && (it.vendaAtual || 0) < (it.vendaMesAnterior || 0))
          .sort((a: any, b: any) => (a.varMesPct || 0) - (b.varMesPct || 0))
          .slice(0, 20);

        if (top20Quedas.length > 0) {
          result.push({
            setor: setor.setor,
            codSecao: setor.codSecao,
            itens: top20Quedas,
          });
        }
      } catch (err: any) {
        console.error(`[TopQuedas] Erro setor ${setor.setor}:`, err?.message);
      }
    }

    return {
      dataInicio,
      dataFim,
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
    // Calcular periodos comparativos
    const calcPeriodoAnterior = (ini: string, fim: string) => {
      const [aIni, mIni, dIni] = ini.split('-').map(Number);
      const [aFim, mFim, dFim] = fim.split('-').map(Number);
      const mesAntIni = mIni === 1 ? 12 : mIni - 1;
      const anoAntIni = mIni === 1 ? aIni - 1 : aIni;
      const mesAntFim = mFim === 1 ? 12 : mFim - 1;
      const anoAntFim = mFim === 1 ? aFim - 1 : aFim;
      return {
        ini: `${anoAntIni}-${String(mesAntIni).padStart(2, '0')}-${String(dIni).padStart(2, '0')}`,
        fim: `${anoAntFim}-${String(mesAntFim).padStart(2, '0')}-${String(dFim).padStart(2, '0')}`,
      };
    };
    const calcPeriodoAnoAnterior = (ini: string, fim: string) => {
      const [aIni, mIni, dIni] = ini.split('-').map(Number);
      const [aFim, mFim, dFim] = fim.split('-').map(Number);
      return {
        ini: `${aIni - 1}-${String(mIni).padStart(2, '0')}-${String(dIni).padStart(2, '0')}`,
        fim: `${aFim - 1}-${String(mFim).padStart(2, '0')}-${String(dFim).padStart(2, '0')}`,
      };
    };

    const mesAnt = calcPeriodoAnterior(dataInicio, dataFim);
    const anoAnt = calcPeriodoAnoAnterior(dataInicio, dataFim);

    // Buscar 3 periodos em paralelo
    const [vendasAtual, vendasMesAnt, vendasAnoAnt] = await Promise.all([
      (GestaoInteligenteService as any).buscarVendasPorItemPeriodo(
        TopQuedasController.toErpDate(dataInicio),
        TopQuedasController.toErpDate(dataFim),
        codLoja, codSecao
      ).catch(() => []),
      (GestaoInteligenteService as any).buscarVendasPorItemPeriodo(
        TopQuedasController.toErpDate(mesAnt.ini),
        TopQuedasController.toErpDate(mesAnt.fim),
        codLoja, codSecao
      ).catch(() => []),
      (GestaoInteligenteService as any).buscarVendasPorItemPeriodo(
        TopQuedasController.toErpDate(anoAnt.ini),
        TopQuedasController.toErpDate(anoAnt.fim),
        codLoja, codSecao
      ).catch(() => []),
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

  private static toErpDate(d: string): string {
    return d.replace(/-/g, '');
  }

  /**
   * Render do PDF
   */
  private static renderPdf(doc: PDFKit.PDFDocument, data: any) {
    const fmtMoney = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtPct = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
    const truncate = (s: string, n: number) => (s.length > n ? s.substring(0, n - 1) + '…' : s);

    // CAPA
    doc.fillColor('#FF6B00').fontSize(20).font('Helvetica-Bold')
      .text('TOP 20 ITENS EM QUEDA POR SETOR', { align: 'center' });
    doc.moveDown(0.5);

    doc.fillColor('#333').fontSize(11).font('Helvetica')
      .text(`Periodo analisado: ${TopQuedasController.brDate(data.dataInicio)} a ${TopQuedasController.brDate(data.dataFim)}`, { align: 'center' });
    doc.text(`Comparativo: mes anterior + mesmo mes do ano anterior`, { align: 'center' });
    if (data.codLoja) {
      doc.text(`Loja: ${data.codLoja}`, { align: 'center' });
    } else {
      doc.text('Lojas: TODAS', { align: 'center' });
    }
    doc.moveDown(1);

    if (!data.setores || data.setores.length === 0) {
      doc.fontSize(14).fillColor('#999').text('Nenhum item em queda encontrado no periodo.', { align: 'center' });
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
      doc.fillColor('#666').fontSize(9).font('Helvetica-Oblique')
        .text(`Top ${setor.itens.length} itens em queda`);
      doc.moveDown(0.5);

      // Cabecalho da tabela
      const startY = doc.y;
      const cols = [
        { label: 'Cod', x: 36, w: 40 },
        { label: 'Produto', x: 76, w: 180 },
        { label: 'Atual R$', x: 256, w: 60, align: 'right' },
        { label: 'Mes Ant', x: 316, w: 60, align: 'right' },
        { label: 'Var %', x: 376, w: 50, align: 'right' },
        { label: 'Ano Ant', x: 426, w: 60, align: 'right' },
        { label: 'Var %', x: 486, w: 50, align: 'right' },
        { label: 'Lucro R$', x: 536, w: 60, align: 'right' },
      ];

      doc.fillColor('#FFF').rect(36, startY - 2, 560, 16).fill('#FF6B00');
      doc.fillColor('#FFF').fontSize(8).font('Helvetica-Bold');
      cols.forEach(c => {
        doc.text(c.label, c.x + 2, startY + 2, { width: c.w - 4, align: (c.align || 'left') as any });
      });
      doc.moveDown(1.2);

      // Linhas
      doc.fontSize(8).font('Helvetica');
      let rowIdx = 0;
      for (const item of setor.itens) {
        const y = doc.y;

        // Quebra de pagina
        if (y > 770) {
          doc.addPage();
          doc.fontSize(8).font('Helvetica');
        }

        // Zebra
        if (rowIdx % 2 === 0) {
          doc.fillColor('#F8F8F8').rect(36, y - 1, 560, 13).fill();
        }

        doc.fillColor('#000');
        doc.text(String(item.codProduto || '-'), cols[0].x + 2, y + 1, { width: cols[0].w - 4 });
        doc.text(truncate(item.produto || '-', 28), cols[1].x + 2, y + 1, { width: cols[1].w - 4 });
        doc.text(fmtMoney(item.vendaAtual), cols[2].x + 2, y + 1, { width: cols[2].w - 4, align: 'right' });
        doc.text(fmtMoney(item.vendaMesAnterior), cols[3].x + 2, y + 1, { width: cols[3].w - 4, align: 'right' });
        doc.fillColor(item.varMesPct < 0 ? '#C62828' : '#2E7D32');
        doc.text(fmtPct(item.varMesPct), cols[4].x + 2, y + 1, { width: cols[4].w - 4, align: 'right' });
        doc.fillColor('#000');
        doc.text(fmtMoney(item.vendaAnoAnterior), cols[5].x + 2, y + 1, { width: cols[5].w - 4, align: 'right' });
        doc.fillColor(item.varAnoPct < 0 ? '#C62828' : '#2E7D32');
        doc.text(fmtPct(item.varAnoPct), cols[6].x + 2, y + 1, { width: cols[6].w - 4, align: 'right' });
        doc.fillColor('#000');
        doc.text(fmtMoney(item.lucroAtual), cols[7].x + 2, y + 1, { width: cols[7].w - 4, align: 'right' });

        doc.y = y + 13;
        rowIdx++;
      }

      doc.moveDown(0.5);
    }

    // Rodape em todas as paginas
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#888').fontSize(8).font('Helvetica');
      doc.text(`Radar 360 - Top Quedas - ${TopQuedasController.brDate(data.dataInicio)} a ${TopQuedasController.brDate(data.dataFim)}  |  Pagina ${i + 1} de ${pages.count}`,
        36, 810, { width: 560, align: 'center' });
    }
  }

  private static brDate(d: string): string {
    const [a, m, di] = d.split('-');
    return `${di}/${m}/${a}`;
  }
}
