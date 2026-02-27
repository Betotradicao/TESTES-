import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

interface NotaPrazo {
  NUM_NF_FORN: string;
  DTA_ENTRADA: string;
  VAL_TOTAL_NF: number;
  PRAZO: string;
  PRAZO_MEDIO_NF: number;
  FORMA_PGTO: string;
  TIPO_NF: string;
}

interface FornecedorForaCombinado {
  COD_FORNECEDOR: number;
  DES_FANTASIA: string;
  DES_CONTATO: string;
  NUM_CELULAR: string;
  NUM_FONE: string;
  COND_PGTO_SISTEMA: number;
  PRAZO_MEDIO: number;
  VAL_TOTAL: number;
  notasFora: NotaPrazo[];
}

const CLASSIF_COLORS: Record<string, string> = {
  'PÉSSIMO': '#DC2626',
  'RUIM': '#EA580C',
  'REGULAR': '#CA8A04',
  'BOM': '#2563EB',
  'ÓTIMO': '#16A34A',
  'EXCELENTE': '#9333EA',
};

const getClassificacao = (prazoMedio: number): string => {
  if (prazoMedio <= 0) return '-';
  if (prazoMedio <= 1) return 'PÉSSIMO';
  if (prazoMedio <= 7) return 'RUIM';
  if (prazoMedio <= 14) return 'REGULAR';
  if (prazoMedio <= 21) return 'BOM';
  if (prazoMedio <= 31) return 'ÓTIMO';
  return 'EXCELENTE';
};

export class PrazoFornecedoresPDFService {
  /**
   * Gera PDF de fornecedores Fora do Combinado (landscape A4)
   */
  static async generatePDF(
    dateFormatted: string,
    fornecedores: FornecedorForaCombinado[]
  ): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `prazo_fora_combinado_${dateFormatted.replace(/\//g, '-')}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    const totalNFs = fornecedores.reduce((s, f) => s + f.notasFora.length, 0);
    const valorTotal = fornecedores.reduce((s, f) => s + f.notasFora.reduce((s2, n) => s2 + (n.VAL_TOTAL_NF || 0), 0), 0);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        const pageWidth = 841.89;
        const marginLeft = 20;
        const tableWidth = pageWidth - 40;

        // Título
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#DC2626');
        doc.text('PRAZO FORNECEDORES - FORA DO COMBINADO', marginLeft, 18, { align: 'center', width: tableWidth });

        // Subtítulo
        doc.fontSize(8).font('Helvetica').fillColor('#505050');
        doc.text(
          `Data: ${dateFormatted}  |  Fornecedores: ${fornecedores.length}  |  NFs Fora: ${totalNFs}  |  Valor Total: R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          marginLeft, 36, { align: 'center', width: tableWidth }
        );

        // Colunas da tabela de notas
        const cols = [
          { header: 'Fornecedor', width: 140, align: 'left' as const },
          { header: 'Contato', width: 80, align: 'left' as const },
          { header: 'Celular', width: 72, align: 'left' as const },
          { header: 'N° Nota', width: 52, align: 'center' as const },
          { header: 'Valor', width: 68, align: 'right' as const },
          { header: 'Prazo', width: 80, align: 'center' as const },
          { header: 'Prazo Sist.', width: 48, align: 'center' as const },
          { header: 'Combinado', width: 52, align: 'center' as const },
          { header: 'Forma Pgto', width: 80, align: 'center' as const },
          { header: 'Tipo', width: 55, align: 'center' as const },
          { header: 'Classif.', width: 52, align: 'center' as const },
          { header: 'Prazo Med', width: 48, align: 'center' as const },
        ];

        let currentY = 50;

        fornecedores.forEach((forn) => {
          const celular = forn.NUM_CELULAR || forn.NUM_FONE || '';
          const classifForn = getClassificacao(forn.PRAZO_MEDIO);

          // Check space: need header bar + table header + at least 1 row
          if (currentY > 490) {
            doc.addPage();
            currentY = 20;
          }

          // Barra do fornecedor (laranja)
          const fornBarHeight = 16;
          doc.rect(marginLeft, currentY, tableWidth, fornBarHeight).fillAndStroke('#EA580C', '#EA580C');
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor('white');
          const fornLabel = `${forn.DES_FANTASIA}  |  Sist: ${forn.COND_PGTO_SISTEMA}d  |  Med: ${forn.PRAZO_MEDIO}d  |  ${classifForn}  |  ${forn.notasFora.length} NF(s) fora`;
          doc.text(fornLabel, marginLeft + 6, currentY + 4, { width: tableWidth - 12 });
          currentY += fornBarHeight + 1;

          // Table header
          this.renderTableHeader(doc, cols, marginLeft, currentY);
          currentY += 15;

          // Notas fora do combinado
          forn.notasFora.forEach((nota, idx) => {
            if (currentY > 530) {
              doc.addPage();
              currentY = 20;
              this.renderTableHeader(doc, cols, marginLeft, currentY);
              currentY += 15;
            }

            const rowHeight = 12;
            if (idx % 2 === 0) {
              doc.rect(marginLeft, currentY - 1, tableWidth, rowHeight).fillAndStroke('#FEF2F2', '#FEF2F2');
            }

            doc.fillColor('black').font('Helvetica').fontSize(6);
            const notaClassif = getClassificacao(nota.PRAZO_MEDIO_NF);

            const rowData = [
              (forn.DES_FANTASIA || '').substring(0, 28),
              (forn.DES_CONTATO || '-').substring(0, 16),
              celular ? String(celular).substring(0, 14) : '-',
              nota.NUM_NF_FORN || '-',
              `R$ ${(nota.VAL_TOTAL_NF || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              nota.PRAZO || '-',
              `${forn.COND_PGTO_SISTEMA}d`,
              'FORA',
              (nota.FORMA_PGTO || '-').substring(0, 16),
              (nota.TIPO_NF || '-').substring(0, 10),
              notaClassif,
              nota.PRAZO_MEDIO_NF > 0 ? `${nota.PRAZO_MEDIO_NF}d` : '-',
            ];

            let x = marginLeft;
            cols.forEach((col, colIdx) => {
              const textOpts: any = { width: col.width - 3 };
              if (col.align === 'center') textOpts.align = 'center';
              if (col.align === 'right') textOpts.align = 'right';

              // Colorir "FORA" em vermelho
              if (colIdx === 7) {
                doc.fillColor('#DC2626').font('Helvetica-Bold');
              }
              // Colorir classificação
              if (colIdx === 10 && notaClassif !== '-') {
                doc.fillColor(CLASSIF_COLORS[notaClassif] || '#6B7280').font('Helvetica-Bold');
              }

              doc.text(rowData[colIdx], x + 1, currentY, textOpts);

              // Reset
              if (colIdx === 7 || colIdx === 10) {
                doc.fillColor('black').font('Helvetica');
              }

              x += col.width;
            });

            currentY += rowHeight;
          });

          currentY += 6;
        });

        // Rodapé
        doc.fontSize(6.5).font('Helvetica').fillColor('#888');
        doc.text(
          `Relatorio gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
          marginLeft,
          doc.page.height - 20,
          { align: 'center', width: tableWidth }
        );

        doc.end();

        writeStream.on('finish', () => {
          console.log(`[PrazoFornPDF] PDF gerado: ${filePath}`);
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          console.error(`[PrazoFornPDF] Erro ao salvar PDF:`, error);
          reject(error);
        });
      } catch (error) {
        console.error(`[PrazoFornPDF] Erro ao gerar PDF:`, error);
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
    const headerHeight = 14;

    doc.rect(marginLeft, y, totalWidth, headerHeight).fillAndStroke('#374151', '#374151');
    doc.fontSize(6).font('Helvetica-Bold').fillColor('white');

    let x = marginLeft;
    cols.forEach(col => {
      const textOpts: any = { width: col.width - 3 };
      if (col.align === 'center') textOpts.align = 'center';
      if (col.align === 'right') textOpts.align = 'right';
      doc.text(col.header, x + 1, y + 3, textOpts);
      x += col.width;
    });

    doc.fillColor('black');
  }
}
