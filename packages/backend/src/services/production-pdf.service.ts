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

        // Cabeçalho da tabela
        const tableTop = doc.y;
        const col1X = 40;  // Produto
        const col2X = 220; // Estoque Atual (kg)
        const col3X = 290; // Estoque Atual (und)
        const col4X = 360; // Dias
        const col5X = 410; // Produzir (kg)
        const col6X = 490; // Produzir (und)

        doc.font('Helvetica-Bold').fontSize(8);

        // Fundo cinza do cabeçalho
        doc.rect(col1X - 5, doc.y - 5, pageWidth - 80, 20)
           .fillAndStroke('#f3f4f6', '#d1d5db');

        doc.fillColor('black');
        doc.text('Produto', col1X, doc.y + 5, { width: 150, continued: false });
        doc.text('Estoque', col2X, tableTop + 5, { width: 60, align: 'center' });
        doc.text('Estoque', col3X, tableTop + 5, { width: 60, align: 'center' });
        doc.text('Dias', col4X, tableTop + 5, { width: 40, align: 'center' });
        doc.text('Produzir', col5X, tableTop + 5, { width: 80, align: 'center' });
        doc.text('Produzir', col6X, tableTop + 5, { width: 60, align: 'center' });

        doc.moveDown(0.3);

        // Segunda linha do cabeçalho (unidades)
        doc.fontSize(7);
        doc.text('', col1X, doc.y, { width: 150 });
        doc.text('(kg)', col2X, doc.y - 10, { width: 60, align: 'center' });
        doc.text('(und)', col3X, doc.y - 10, { width: 60, align: 'center' });
        doc.text('', col4X, doc.y - 10, { width: 40, align: 'center' });
        doc.text('(kg)', col5X, doc.y - 10, { width: 80, align: 'center' });
        doc.text('(und)', col6X, doc.y - 10, { width: 60, align: 'center' });

        doc.moveDown(0.5);

        // Itens da tabela
        doc.font('Helvetica').fontSize(8);
        let alternate = false;

        for (const item of sortedItems) {
          // Verificar se precisa de nova página
          if (doc.y > 720) {
            doc.addPage();
            doc.y = 60;
            alternate = false;
          }

          const rowY = doc.y;
          const rowHeight = 18;

          // Fundo alternado
          if (alternate) {
            doc.rect(col1X - 5, rowY - 2, pageWidth - 80, rowHeight)
               .fillAndStroke('#f9fafb', '#f9fafb');
          }

          doc.fillColor('black');

          // Nome do produto (com quebra de linha se necessário)
          doc.text(item.product_name, col1X, rowY, {
            width: 150,
            height: rowHeight,
            ellipsis: true
          });

          // Estoque atual em kg
          doc.text(
            this.formatKg(item.quantity_kg),
            col2X,
            rowY,
            { width: 60, align: 'center' }
          );

          // Estoque atual em unidades
          doc.text(
            item.quantity_units.toString(),
            col3X,
            rowY,
            { width: 60, align: 'center' }
          );

          // Dias de produção
          doc.text(
            item.production_days.toString(),
            col4X,
            rowY,
            { width: 40, align: 'center' }
          );

          // Sugestão de produção em kg (destacar em vermelho se > 0)
          const suggestedKg = this.toNumber(item.suggested_production_kg);
          if (suggestedKg > 0) {
            doc.fillColor('#DC2626').font('Helvetica-Bold');
          }
          doc.text(
            this.formatKg(item.suggested_production_kg),
            col5X,
            rowY,
            { width: 80, align: 'center' }
          );

          // Sugestão de produção em unidades
          const suggestedUnits = item.suggested_production_units || 0;
          doc.text(
            suggestedUnits > 0 ? suggestedUnits.toString() : '-',
            col6X,
            rowY,
            { width: 60, align: 'center' }
          );

          // Resetar cor e fonte
          doc.fillColor('black').font('Helvetica');

          // Linha divisória
          doc.moveTo(col1X - 5, doc.y + 2)
             .lineTo(pageWidth - 40, doc.y + 2)
             .strokeColor('#e5e7eb')
             .stroke();

          doc.moveDown(0.8);
          alternate = !alternate;
        }

        // Rodapé
        doc.moveDown(2);
        doc.fontSize(8).fillColor('#6b7280');
        doc.text(
          'Legenda: Valores em vermelho indicam produtos com necessidade de produção.',
          col1X,
          doc.y,
          { align: 'left' }
        );

        doc.moveDown(0.5);
        doc.text(
          `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
          col1X,
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
}
