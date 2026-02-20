import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

interface CorteItem {
  cod_produto: number;
  descricao: string;
  qtd_pedida: number;
  qtd_recebida: number;
  qtd_cortada: number;
  val_unitario: number;
  val_total_corte: number;
  curva: string;
  estoque_atual: number;
  des_unidade: string;
}

interface CorteFornecedor {
  cod_fornecedor: number;
  fornecedor: string;
  cnpj: string;
  num_pedido: number;
  val_pedido: number;
  itens: CorteItem[];
}

export class CortesPDFService {
  /**
   * Gera PDF de cortes de pedidos (landscape, agrupado por fornecedor)
   */
  static async generatePDF(
    dateFormatted: string,
    fornecedores: CorteFornecedor[]
  ): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `cortes_pedidos_${dateFormatted.replace(/\//g, '-')}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    const totalFornecedores = fornecedores.length;
    const totalItens = fornecedores.reduce((sum, f) => sum + f.itens.length, 0);
    const valorTotalCorte = fornecedores.reduce(
      (sum, f) => sum + f.itens.reduce((s, i) => s + i.val_total_corte, 0), 0
    );

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        const pageWidth = 841.89;
        const marginLeft = 30;
        const marginRight = 30;
        const tableWidth = pageWidth - marginLeft - marginRight;

        // Titulo
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#DC2626');
        doc.text('CORTES DE PEDIDOS', marginLeft, 25, { align: 'center', width: tableWidth });

        // Subtitulo
        doc.fontSize(9).font('Helvetica').fillColor('#505050');
        doc.text(
          `Data Cancelamento: ${dateFormatted}  |  ${totalFornecedores} fornecedores  |  ${totalItens} itens cortados  |  Valor Total: R$ ${valorTotalCorte.toFixed(2)}`,
          marginLeft, 45, { align: 'center', width: tableWidth }
        );

        // Colunas
        const cols = [
          { header: '#', width: 22, align: 'center' as const },
          { header: 'Produto', width: 210, align: 'left' as const },
          { header: 'Curva', width: 32, align: 'center' as const },
          { header: 'Unid.', width: 35, align: 'center' as const },
          { header: 'Qtd Pedida', width: 60, align: 'right' as const },
          { header: 'Qtd Recebida', width: 65, align: 'right' as const },
          { header: 'Qtd Cortada', width: 65, align: 'right' as const },
          { header: 'Vlr Unit.', width: 65, align: 'right' as const },
          { header: 'Vlr Corte', width: 70, align: 'right' as const },
          { header: 'Estoque', width: 50, align: 'right' as const },
        ];

        let currentY = 60;

        fornecedores.forEach((forn) => {
          const valorCorte = forn.itens.reduce((s, i) => s + i.val_total_corte, 0);

          // Verificar espaco para barra + header + pelo menos 1 linha
          if (currentY > 490) {
            doc.addPage();
            currentY = 30;
          }

          // Barra do fornecedor (vermelho)
          const barHeight = 20;
          doc.rect(marginLeft, currentY, tableWidth, barHeight).fillAndStroke('#DC2626', '#DC2626');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('white');
          doc.text(
            `${forn.fornecedor}  |  CNPJ: ${forn.cnpj || '-'}  |  Pedido: #${forn.num_pedido}  |  ${forn.itens.length} itens cortados  |  R$ ${valorCorte.toFixed(2)}`,
            marginLeft + 8, currentY + 6, { width: tableWidth - 16 }
          );
          currentY += barHeight + 2;

          // Header da tabela (cinza escuro)
          this.renderTableHeader(doc, cols, marginLeft, currentY);
          currentY += 18;

          // Linhas
          forn.itens.forEach((item, idx) => {
            if (currentY > 540) {
              doc.addPage();
              currentY = 30;
              this.renderTableHeader(doc, cols, marginLeft, currentY);
              currentY += 18;
            }

            const rowHeight = 14;

            if (idx % 2 === 0) {
              doc.rect(marginLeft, currentY - 2, tableWidth, rowHeight).fillAndStroke('#FEF2F2', '#FEF2F2');
            }

            doc.fillColor('black').font('Helvetica').fontSize(6.5);

            let x = marginLeft;
            const rowData = [
              String(idx + 1),
              (item.descricao || '').substring(0, 48),
              item.curva || '-',
              item.des_unidade || 'UN',
              String(item.qtd_pedida || 0),
              String(item.qtd_recebida || 0),
              String(item.qtd_cortada || 0),
              `R$ ${(item.val_unitario || 0).toFixed(2)}`,
              `R$ ${(item.val_total_corte || 0).toFixed(2)}`,
              String(Math.round(item.estoque_atual || 0)),
            ];

            cols.forEach((col, colIdx) => {
              const textOpts: any = { width: col.width - 4 };
              if (col.align === 'center') textOpts.align = 'center';
              if (col.align === 'right') textOpts.align = 'right';

              // Qtd Cortada em vermelho bold
              if (colIdx === 6) {
                doc.fillColor('#DC2626').font('Helvetica-Bold');
              }
              // Valor Corte em vermelho bold
              if (colIdx === 8) {
                doc.fillColor('#DC2626').font('Helvetica-Bold');
              }

              doc.text(rowData[colIdx], x + 2, currentY, textOpts);

              if (colIdx === 6 || colIdx === 8) {
                doc.fillColor('black').font('Helvetica');
              }

              x += col.width;
            });

            currentY += rowHeight;
          });

          currentY += 8; // Espaco entre fornecedores
        });

        // Rodape
        doc.fontSize(7).font('Helvetica').fillColor('#888');
        doc.text(
          `Relatorio gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
          marginLeft,
          doc.page.height - 25,
          { align: 'center', width: tableWidth }
        );

        doc.end();

        writeStream.on('finish', () => {
          console.log(`\u2705 [CortesPDF] PDF gerado: ${filePath}`);
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          console.error(`\u274C [CortesPDF] Erro ao salvar PDF:`, error);
          reject(error);
        });
      } catch (error) {
        console.error(`\u274C [CortesPDF] Erro ao gerar PDF:`, error);
        reject(error);
      }
    });
  }

  private static renderTableHeader(
    doc: PDFKit.PDFDocument,
    cols: Array<{ header: string; width: number; align: string }>,
    marginLeft: number,
    y: number
  ): void {
    const totalWidth = cols.reduce((sum, c) => sum + c.width, 0);
    const headerHeight = 16;

    doc.rect(marginLeft, y, totalWidth, headerHeight).fillAndStroke('#374151', '#374151');

    doc.fontSize(7).font('Helvetica-Bold').fillColor('white');

    let x = marginLeft;
    cols.forEach(col => {
      const textOpts: any = { width: col.width - 4 };
      if (col.align === 'center') textOpts.align = 'center';
      if (col.align === 'right') textOpts.align = 'right';
      doc.text(col.header, x + 2, y + 4, textOpts);
      x += col.width;
    });

    doc.fillColor('black');
  }
}
