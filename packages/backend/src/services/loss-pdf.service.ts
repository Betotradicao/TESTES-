import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

interface LossItem {
  codigoBarras: string;
  descricaoReduzida: string;
  quantidadeAjuste: number;
  custoReposicao: number;
  descricaoAjusteCompleta: string;
  secao: string;
  secaoNome?: string;
}

export class LossPDFService {
  /**
   * Gera resumo de perdas/entradas por motivo para mensagem WhatsApp
   */
  static generateWhatsAppSummary(items: LossItem[]): {
    saidas: Map<string, number>;
    entradas: Map<string, number>;
    totalSaidas: number;
    totalEntradas: number;
    valorTotalSaidas: number;
    valorTotalEntradas: number;
  } {
    const saidas = items.filter(item => Number(item.quantidadeAjuste) < 0);
    const entradas = items.filter(item => Number(item.quantidadeAjuste) > 0);

    // Agrupar saídas por motivo e somar valores
    const saidasPorMotivo = new Map<string, number>();
    saidas.forEach(item => {
      const motivo = item.descricaoAjusteCompleta || 'SEM MOTIVO';
      const valor = Math.abs(Number(item.quantidadeAjuste) * Number(item.custoReposicao));
      saidasPorMotivo.set(motivo, (saidasPorMotivo.get(motivo) || 0) + valor);
    });

    // Agrupar entradas por motivo e somar valores
    const entradasPorMotivo = new Map<string, number>();
    entradas.forEach(item => {
      const motivo = item.descricaoAjusteCompleta || 'SEM MOTIVO';
      const valor = Number(item.quantidadeAjuste) * Number(item.custoReposicao);
      entradasPorMotivo.set(motivo, (entradasPorMotivo.get(motivo) || 0) + valor);
    });

    const valorTotalSaidas = saidas.reduce((sum, item) =>
      sum + Math.abs(Number(item.quantidadeAjuste) * Number(item.custoReposicao)), 0);
    const valorTotalEntradas = entradas.reduce((sum, item) =>
      sum + (Number(item.quantidadeAjuste) * Number(item.custoReposicao)), 0);

    return {
      saidas: saidasPorMotivo,
      entradas: entradasPorMotivo,
      totalSaidas: saidas.length,
      totalEntradas: entradas.length,
      valorTotalSaidas,
      valorTotalEntradas
    };
  }

  /**
   * Gera PDF de perdas e entradas agrupadas por motivo
   */
  static async generateLossesPDF(
    nomeLote: string,
    dataInicio: string,
    dataFim: string,
    items: LossItem[]
  ): Promise<string> {
    // Criar diretório temporário se não existir
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `perdas_${nomeLote.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        // Separar itens em saídas (negativo) e entradas (positivo)
        const saidas = items.filter(item => Number(item.quantidadeAjuste) < 0);
        const entradas = items.filter(item => Number(item.quantidadeAjuste) > 0);

        // Agrupar saídas por motivo
        const saidasPorMotivo = this.agruparPorMotivo(saidas);
        const entradasPorMotivo = this.agruparPorMotivo(entradas);

        // Cabeçalho
        doc.fontSize(18).font('Helvetica-Bold').text('RELATÓRIO DE AJUSTE DE ESTOQUE', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').text(`Lote: ${nomeLote}`, { align: 'center' });
        doc.text(`Período: ${dataInicio} até ${dataFim}`, { align: 'center' });
        doc.moveDown(1);

        // Resumo
        const totalSaidas = saidas.length;
        const totalEntradas = entradas.length;
        const valorTotalSaidas = saidas.reduce((sum, item) => sum + Math.abs(Number(item.quantidadeAjuste) * Number(item.custoReposicao)), 0);
        const valorTotalEntradas = entradas.reduce((sum, item) => sum + (Number(item.quantidadeAjuste) * Number(item.custoReposicao)), 0);

        doc.fontSize(10);
        doc.font('Helvetica-Bold').text('RESUMO GERAL:', { underline: true });
        doc.font('Helvetica');
        doc.text(`Total de Saídas: ${totalSaidas} itens`);
        doc.text(`Valor Total Saídas: R$ ${valorTotalSaidas.toFixed(2)}`);
        doc.text(`Total de Entradas: ${totalEntradas} itens`);
        doc.text(`Valor Total Entradas: R$ ${valorTotalEntradas.toFixed(2)}`);
        doc.moveDown(1.5);

        // SAÍDAS (PERDAS)
        if (saidasPorMotivo.size > 0) {
          this.renderSecao(doc, 'SAÍDAS (PERDAS)', saidasPorMotivo, true);
        }

        // ENTRADAS (AJUSTES POSITIVOS)
        if (entradasPorMotivo.size > 0) {
          if (doc.y > 600) {
            doc.addPage();
          }
          doc.moveDown(1);
          this.renderSecao(doc, 'ENTRADAS (AJUSTES POSITIVOS)', entradasPorMotivo, false);
        }

        // Rodapé
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).font('Helvetica');
          doc.text(
            `Página ${i + 1} de ${pageCount} - Gerado em ${new Date().toLocaleString('pt-BR')}`,
            40,
            doc.page.height - 30,
            { align: 'center' }
          );
        }

        doc.end();

        writeStream.on('finish', () => {
          console.log(`✅ PDF gerado: ${filePath}`);
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          console.error(`❌ Erro ao salvar PDF:`, error);
          reject(error);
        });
      } catch (error) {
        console.error(`❌ Erro ao gerar PDF:`, error);
        reject(error);
      }
    });
  }

  /**
   * Agrupa itens por motivo (descricaoAjusteCompleta)
   */
  private static agruparPorMotivo(items: LossItem[]): Map<string, LossItem[]> {
    const grupos = new Map<string, LossItem[]>();

    items.forEach(item => {
      const motivo = item.descricaoAjusteCompleta || 'SEM MOTIVO';
      if (!grupos.has(motivo)) {
        grupos.set(motivo, []);
      }
      grupos.get(motivo)!.push(item);
    });

    // Ordenar grupos por valor total (maior para menor)
    const sortedGroups = new Map(
      Array.from(grupos.entries()).sort((a, b) => {
        const valorA = a[1].reduce((sum, item) => sum + Math.abs(Number(item.quantidadeAjuste) * Number(item.custoReposicao)), 0);
        const valorB = b[1].reduce((sum, item) => sum + Math.abs(Number(item.quantidadeAjuste) * Number(item.custoReposicao)), 0);
        return valorB - valorA;
      })
    );

    return sortedGroups;
  }

  /**
   * Renderiza uma seção (Saídas ou Entradas)
   */
  private static renderSecao(
    doc: PDFKit.PDFDocument,
    titulo: string,
    motivosMap: Map<string, LossItem[]>,
    isSaida: boolean
  ): void {
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#D32F2F');
    doc.text(titulo, { underline: true });
    doc.fillColor('black');
    doc.moveDown(0.5);

    motivosMap.forEach((items, motivo) => {
      // Verificar se precisa de nova página
      if (doc.y > 650) {
        doc.addPage();
      }

      // Cabeçalho do motivo
      const totalItems = items.length;
      const valorTotal = items.reduce((sum, item) =>
        sum + Math.abs(Number(item.quantidadeAjuste) * Number(item.custoReposicao)), 0
      );

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#E65100');
      doc.text(`${motivo}`, { continued: false });
      doc.fontSize(9).font('Helvetica').fillColor('#555');
      doc.text(`Total: ${totalItems} itens | Valor: R$ ${valorTotal.toFixed(2)}`, { indent: 10 });
      doc.fillColor('black');
      doc.moveDown(0.3);

      // Tabela de itens
      const tableTop = doc.y;
      const colWidths = {
        codigo: 90,
        descricao: 200,
        qtd: 60,
        custo: 70,
        valor: 75
      };

      // Header da tabela com fundo laranja
      const headerHeight = 20;
      doc.rect(50, tableTop, 495, headerHeight).fillAndStroke('#FF6F00', '#FF6F00');

      doc.fontSize(8).font('Helvetica-Bold').fillColor('white');
      let x = 50;
      const textY = tableTop + 6;
      doc.text('Código', x + 5, textY, { width: colWidths.codigo - 5 });
      x += colWidths.codigo;
      doc.text('Descrição', x + 5, textY, { width: colWidths.descricao - 5 });
      x += colWidths.descricao;
      doc.text('Qtd', x + 5, textY, { width: colWidths.qtd - 5 });
      x += colWidths.qtd;
      doc.text('Custo Unit.', x + 5, textY, { width: colWidths.custo - 5 });
      x += colWidths.custo;
      doc.text('Valor Total', x + 5, textY, { width: colWidths.valor - 5 });

      doc.fillColor('black');
      doc.moveDown(1.5);

      // Linhas da tabela zebradas
      doc.font('Helvetica').fontSize(7);
      items.forEach((item, index) => {
        if (doc.y > 700) {
          doc.addPage();
          doc.y = 50;
        }

        const y = doc.y;
        const rowHeight = 15;

        // Fundo zebrado (cinza claro em linhas pares)
        if (index % 2 === 0) {
          doc.rect(50, y - 2, 495, rowHeight).fillAndStroke('#F5F5F5', '#F5F5F5');
        }

        doc.fillColor('black');
        let x = 50;

        // Código
        doc.text(item.codigoBarras, x + 5, y, { width: colWidths.codigo - 5 });
        x += colWidths.codigo;

        // Descrição
        doc.text(item.descricaoReduzida.substring(0, 35), x + 5, y, { width: colWidths.descricao - 5 });
        x += colWidths.descricao;

        // Quantidade
        const qtdText = Math.abs(Number(item.quantidadeAjuste)).toFixed(3);
        doc.text(qtdText, x + 5, y, { width: colWidths.qtd - 5 });
        x += colWidths.qtd;

        // Custo
        doc.text(`R$ ${Number(item.custoReposicao).toFixed(2)}`, x + 5, y, { width: colWidths.custo - 5 });
        x += colWidths.custo;

        // Valor Total
        const valorItem = Math.abs(Number(item.quantidadeAjuste) * Number(item.custoReposicao));
        doc.text(`R$ ${valorItem.toFixed(2)}`, x + 5, y, { width: colWidths.valor - 5 });

        doc.moveDown(1);
      });

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);
    });
  }
}
