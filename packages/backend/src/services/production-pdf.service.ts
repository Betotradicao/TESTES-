import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { ProductionAudit } from '../entities/ProductionAudit';
import { ProductionAuditItem } from '../entities/ProductionAuditItem';

export class ProductionPDFService {
  /**
   * Converte valor para número (trata strings e Decimal do TypeORM)
   */
  private static toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Formata número com 3 casas decimais
   */
  private static formatKg(value: any): string {
    const num = this.toNumber(value);
    return num.toFixed(3).replace('.', ',');
  }

  /**
   * Gera PDF da sugestão de produção
   * Retorna o caminho do arquivo PDF gerado
   */
  static async generateProductionPDF(
    audit: ProductionAudit,
    items: ProductionAuditItem[]
  ): Promise<string> {
    // Criar diretório temporário se não existir
    const tmpDir = path.join(__dirname, '../../tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Nome do arquivo
    const fileName = `producao_${audit.id}_${Date.now()}.pdf`;
    const filePath = path.join(tmpDir, fileName);

    const auditor = audit.user?.name || audit.user?.username || '';

    return new Promise((resolve, reject) => {
      try {
        // Criar documento PDF
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          bufferPages: true
        });

        // Criar stream para arquivo
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // LOGO COM BOX LARANJA NO TOPO
        const pageWidth = doc.page.width;
        const boxHeight = 50;

        // Desenhar box laranja no topo
        doc.rect(0, 0, pageWidth, boxHeight)
           .fillAndStroke('#EA580C', '#EA580C');

        // Texto do logo em branco no box
        doc.fontSize(20).font('Helvetica-Bold').fillColor('white');
        doc.text('PREVENÇÃO', 0, 12, { align: 'center', width: pageWidth });
        doc.fontSize(16).fillColor('white');
        doc.text('NO RADAR', 0, 32, { align: 'center', width: pageWidth });

        // Voltar para baixo do box
        doc.y = boxHeight + 20;
        doc.fillColor('black');

        // Título do relatório
        doc.fontSize(14).font('Helvetica-Bold').text('SUGESTÃO DE PRODUÇÃO - PADARIA', {
          align: 'center'
        });

        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Data: ${new Date(audit.audit_date).toLocaleDateString('pt-BR')}`, {
          align: 'center'
        });

        if (auditor) {
          doc.moveDown(0.3);
          doc.text(`Auditor: ${auditor}`, {
            align: 'center'
          });
        }

        doc.moveDown(1);

        // Ordenar itens por nome do produto
        const sortedItems = [...items].sort((a, b) =>
          a.product_name.localeCompare(b.product_name)
        );

        // Desenhar cabeçalho da tabela
        this.drawTableHeader(doc, [
          'Produto',
          'Estoque (kg)',
          'Estoque (und)',
          'Dias',
          'Produzir (kg)',
          'Produzir (und)'
        ]);

        // Desenhar linhas da tabela
        sortedItems.forEach((item, index) => {
          // Verificar se precisa de nova página
          if (doc.y > 700) {
            doc.addPage();
          }

          const suggestedKg = this.toNumber(item.suggested_production_kg);
          const suggestedUnits = item.suggested_production_units || 0;

          this.drawTableRow(doc, [
            this.truncate(item.product_name, 35),
            this.formatKg(item.quantity_kg),
            item.quantity_units.toString(),
            item.production_days.toString(),
            this.formatKg(item.suggested_production_kg),
            suggestedUnits > 0 ? suggestedUnits.toString() : '-'
          ], index % 2 === 0, suggestedKg > 0);
        });

        // Rodapé
        doc.moveDown(2);
        doc.fontSize(8).fillColor('#6b7280');
        doc.text(
          'Legenda: Valores em vermelho indicam produtos com necessidade de produção.',
          40,
          doc.y,
          { align: 'left' }
        );

        doc.moveDown(0.5);
        doc.text(
          `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
          40,
          doc.y,
          { align: 'left' }
        );

        // Finalizar PDF
        doc.end();

        stream.on('finish', () => {
          resolve(filePath);
        });

        stream.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Desenha cabeçalho da tabela com fundo laranja
   */
  private static drawTableHeader(doc: PDFKit.PDFDocument, columns: string[]) {
    const startY = doc.y;
    const colWidth = (doc.page.width - 80) / columns.length;
    const rowHeight = 20;

    // Fundo laranja para o cabeçalho
    doc.rect(40, startY, doc.page.width - 80, rowHeight)
       .fillAndStroke('#EA580C', '#EA580C');

    // Texto branco em negrito
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white');

    columns.forEach((col, idx) => {
      doc.text(
        col,
        40 + idx * colWidth,
        startY + 5,
        { width: colWidth - 5, align: 'left', lineBreak: false }
      );
    });

    doc.fillColor('black');
    doc.y = startY + rowHeight;
  }

  /**
   * Desenha linha da tabela com zebra (alternando cores)
   */
  private static drawTableRow(
    doc: PDFKit.PDFDocument,
    columns: string[],
    isEven: boolean,
    highlightRed: boolean = false
  ) {
    const startY = doc.y;
    const colWidth = (doc.page.width - 80) / columns.length;
    const rowHeight = 22;

    // Fundo zebrado - cinza claro para linhas pares, branco para ímpares
    const bgColor = isEven ? '#F3F4F6' : '#FFFFFF';
    doc.rect(40, startY, doc.page.width - 80, rowHeight)
       .fillAndStroke(bgColor, bgColor);

    // Texto preto (ou vermelho para valores com produção sugerida)
    doc.fontSize(8).font('Helvetica');

    columns.forEach((col, idx) => {
      // Destacar em vermelho as últimas duas colunas (Produzir kg/und) se highlightRed
      if (highlightRed && idx >= 4) {
        doc.fillColor('#DC2626').font('Helvetica-Bold');
      } else {
        doc.fillColor('black').font('Helvetica');
      }

      doc.text(
        col,
        40 + idx * colWidth + 3,
        startY + 5,
        { width: colWidth - 8, align: 'left', lineBreak: false, ellipsis: true }
      );
    });

    doc.fillColor('black').font('Helvetica');
    doc.y = startY + rowHeight;
  }

  /**
   * Trunca texto longo
   */
  private static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
