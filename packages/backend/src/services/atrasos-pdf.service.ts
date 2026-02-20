import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

interface AtrasoItem {
  cod_produto: number;
  descricao: string;
  qtd_pedida: number;
  qtd_recebida: number;
  val_unitario: number;
  val_total_pendente: number;
  curva: string;
  estoque_atual: number;
  des_unidade: string;
}

interface AtrasoFornecedor {
  cod_fornecedor: number;
  fornecedor: string;
  cnpj: string;
  num_pedido: number;
  val_pedido: number;
  dta_entrega: string;
  dias_atraso: number;
  itens: AtrasoItem[];
}

export class AtrasosPDFService {
  // Cores por curva
  private static readonly CURVA_COLORS: Record<string, { bg: string; text: string }> = {
    'A': { bg: '#DC2626', text: '#FFFFFF' },  // Vermelho
    'B': { bg: '#EA580C', text: '#FFFFFF' },  // Laranja
    'C': { bg: '#CA8A04', text: '#FFFFFF' },  // Amarelo escuro
    'D': { bg: '#2563EB', text: '#FFFFFF' },  // Azul
    'E': { bg: '#6B7280', text: '#FFFFFF' },  // Cinza
  };

  private static readonly CURVA_ORDER: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };

  /**
   * Gera PDF de pedidos em atraso (landscape, agrupado por fornecedor)
   */
  static async generatePDF(
    dateFormatted: string,
    fornecedores: AtrasoFornecedor[]
  ): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `pedidos_atraso_${dateFormatted.replace(/\//g, '-')}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    const totalFornecedores = fornecedores.length;
    const totalPedidos = fornecedores.length;
    const totalItens = fornecedores.reduce((sum, f) => sum + f.itens.length, 0);
    const valorTotalPendente = fornecedores.reduce(
      (sum, f) => sum + f.itens.reduce((s, i) => s + i.val_total_pendente, 0), 0
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
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#EA580C');
        doc.text('PEDIDOS EM ATRASO', marginLeft, 25, { align: 'center', width: tableWidth });

        // Subtitulo
        doc.fontSize(9).font('Helvetica').fillColor('#505050');
        doc.text(
          `Data: ${dateFormatted}  |  ${totalFornecedores} fornecedores  |  ${totalPedidos} pedidos  |  ${totalItens} itens pendentes  |  Valor Total: R$ ${valorTotalPendente.toFixed(2)}`,
          marginLeft, 45, { align: 'center', width: tableWidth }
        );

        // Colunas
        const cols = [
          { header: '#', width: 22, align: 'center' as const },
          { header: 'Produto', width: 200, align: 'left' as const },
          { header: 'Curva', width: 32, align: 'center' as const },
          { header: 'Unid.', width: 35, align: 'center' as const },
          { header: 'Qtd Pedida', width: 60, align: 'right' as const },
          { header: 'Qtd Recebida', width: 65, align: 'right' as const },
          { header: 'Qtd Pendente', width: 65, align: 'right' as const },
          { header: 'Vlr Unit.', width: 65, align: 'right' as const },
          { header: 'Vlr Pendente', width: 70, align: 'right' as const },
          { header: 'Estoque', width: 50, align: 'right' as const },
        ];

        let currentY = 60;

        fornecedores.forEach((forn) => {
          const valorPendente = forn.itens.reduce((s, i) => s + i.val_total_pendente, 0);

          // Verificar espaco para barra + header + pelo menos 1 linha
          if (currentY > 490) {
            doc.addPage();
            currentY = 30;
          }

          // Barra do fornecedor (roxo)
          const barHeight = 20;
          doc.rect(marginLeft, currentY, tableWidth, barHeight).fillAndStroke('#EA580C', '#EA580C');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('white');
          doc.text(
            `${forn.fornecedor}  |  CNPJ: ${forn.cnpj || '-'}  |  Pedido: #${forn.num_pedido}  |  Entrega: ${forn.dta_entrega}  |  ${forn.dias_atraso} dias em atraso  |  R$ ${valorPendente.toFixed(2)}`,
            marginLeft + 8, currentY + 6, { width: tableWidth - 16 }
          );
          currentY += barHeight + 2;

          // Ordenar itens por curva A→B→C→D→E
          const itensSorted = [...forn.itens].sort((a, b) => {
            const oa = this.CURVA_ORDER[a.curva?.trim()?.toUpperCase()] || 99;
            const ob = this.CURVA_ORDER[b.curva?.trim()?.toUpperCase()] || 99;
            return oa - ob;
          });

          // Header da tabela (cinza escuro)
          this.renderTableHeader(doc, cols, marginLeft, currentY);
          currentY += 18;

          // Linhas
          itensSorted.forEach((item, idx) => {
            if (currentY > 540) {
              doc.addPage();
              currentY = 30;
              this.renderTableHeader(doc, cols, marginLeft, currentY);
              currentY += 18;
            }

            const rowHeight = 14;

            if (idx % 2 === 0) {
              doc.rect(marginLeft, currentY - 2, tableWidth, rowHeight).fillAndStroke('#FFF7ED', '#FFF7ED');
            }

            doc.fillColor('black').font('Helvetica').fontSize(6.5);

            const qtdPendente = (item.qtd_pedida || 0) - (item.qtd_recebida || 0);

            let x = marginLeft;
            const rowData = [
              String(idx + 1),
              (item.descricao || '').substring(0, 46),
              item.curva || '-',
              item.des_unidade || 'UN',
              String(item.qtd_pedida || 0),
              String(item.qtd_recebida || 0),
              String(qtdPendente),
              `R$ ${(item.val_unitario || 0).toFixed(2)}`,
              `R$ ${(item.val_total_pendente || 0).toFixed(2)}`,
              String(Math.round(item.estoque_atual || 0)),
            ];

            cols.forEach((col, colIdx) => {
              const textOpts: any = { width: col.width - 4 };
              if (col.align === 'center') textOpts.align = 'center';
              if (col.align === 'right') textOpts.align = 'right';

              // Coluna Curva - badge colorido
              if (colIdx === 2) {
                const curvaKey = (item.curva || '').trim().toUpperCase();
                const curvaColor = this.CURVA_COLORS[curvaKey] || { bg: '#9CA3AF', text: '#FFFFFF' };
                const badgeWidth = 18;
                const badgeHeight = 10;
                const badgeX = x + (col.width - badgeWidth) / 2;
                const badgeY = currentY - 1;
                doc.save();
                doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3).fillAndStroke(curvaColor.bg, curvaColor.bg);
                doc.fontSize(6).font('Helvetica-Bold').fillColor(curvaColor.text);
                doc.text(curvaKey || '-', badgeX, badgeY + 2, { width: badgeWidth, align: 'center' });
                doc.restore();
                doc.fillColor('black').font('Helvetica').fontSize(6.5);
                x += col.width;
                return;
              }

              // Qtd Pendente em laranja bold
              if (colIdx === 6) {
                doc.fillColor('#EA580C').font('Helvetica-Bold');
              }
              // Valor Pendente em laranja bold
              if (colIdx === 8) {
                doc.fillColor('#EA580C').font('Helvetica-Bold');
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
          console.log(`\u2705 [AtrasosPDF] PDF gerado: ${filePath}`);
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          console.error(`\u274C [AtrasosPDF] Erro ao salvar PDF:`, error);
          reject(error);
        });
      } catch (error) {
        console.error(`\u274C [AtrasosPDF] Erro ao gerar PDF:`, error);
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
