import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

interface AbastecimentoItem {
  codigo: number;
  codigo_barras: string;
  descricao: string;
  fornecedor: string;
  secao: string;
  grupo: string;
  curva: string;
  custo: number;
  preco_venda: number;
  margem: number;
  estoque_atual: number;
  venda_media: number;
  prioridade: number;
  motivo_prioridade: string;
  numero_nf: string;
  tipo_especie: string;
}

const PRIORIDADE_LABELS: Record<number, string> = {
  1: 'P1-CURVA A',
  2: 'P2-RUPTURA',
  3: 'P3-PRE-RUPT',
  4: 'P4-DEMAIS',
};

export class AbastecimentoPDFService {
  /**
   * Gera PDF de prioridade de reposição (landscape, agrupado por seção)
   */
  static async generatePDF(
    dateFormatted: string,
    itens: AbastecimentoItem[]
  ): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `abastecimento_${dateFormatted.replace(/\//g, '-')}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    const p1 = itens.filter(i => i.prioridade === 1).length;
    const p2 = itens.filter(i => i.prioridade === 2).length;
    const p3 = itens.filter(i => i.prioridade === 3).length;
    const p4 = itens.filter(i => i.prioridade === 4).length;

    // Agrupar por seção
    const grupos = new Map<string, AbastecimentoItem[]>();
    itens.forEach(item => {
      const secao = item.secao || 'SEM SECAO';
      if (!grupos.has(secao)) grupos.set(secao, []);
      grupos.get(secao)!.push(item);
    });

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        const pageWidth = 841.89;
        const marginLeft = 30;
        const marginRight = 30;
        const tableWidth = pageWidth - marginLeft - marginRight;

        // Título
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#EA580C');
        doc.text('PRIORIDADE REPOSICAO', marginLeft, 25, { align: 'center', width: tableWidth });

        // Subtítulo
        doc.fontSize(9).font('Helvetica').fillColor('#505050');
        doc.text(
          `Data Entrada NF: ${dateFormatted}  |  Total: ${itens.length} itens  |  P1: ${p1}  P2: ${p2}  P3: ${p3}  P4: ${p4}`,
          marginLeft, 45, { align: 'center', width: tableWidth }
        );

        // Colunas (sem Secao, pois já está na barra)
        const cols = [
          { header: '#', width: 22, align: 'center' as const },
          { header: 'Prior.', width: 58, align: 'center' as const },
          { header: 'Produto', width: 175, align: 'left' as const },
          { header: 'Cod.Barras', width: 82, align: 'left' as const },
          { header: 'Fornecedor', width: 120, align: 'left' as const },
          { header: 'Grupo', width: 75, align: 'left' as const },
          { header: 'Curva', width: 30, align: 'center' as const },
          { header: 'Custo', width: 55, align: 'right' as const },
          { header: 'Preco Vd', width: 55, align: 'right' as const },
          { header: 'Margem', width: 42, align: 'right' as const },
          { header: 'Estoque', width: 38, align: 'right' as const },
          { header: 'NF', width: 52, align: 'center' as const },
        ];

        let currentY = 60;
        let globalIdx = 0;

        grupos.forEach((itensSecao, secaoNome) => {
          // Verificar espaço para barra de seção + header + pelo menos 1 linha
          if (currentY > 500) {
            doc.addPage();
            currentY = 30;
          }

          // Barra da seção (laranja)
          const secBarHeight = 18;
          doc.rect(marginLeft, currentY, tableWidth, secBarHeight).fillAndStroke('#EA580C', '#EA580C');
          doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
          doc.text(`${secaoNome}  (${itensSecao.length} itens)`, marginLeft + 8, currentY + 5, { width: tableWidth - 16 });
          currentY += secBarHeight + 2;

          // Header da tabela (cinza escuro)
          this.renderTableHeader(doc, cols, marginLeft, currentY);
          currentY += 18;

          // Linhas
          itensSecao.forEach((item, localIdx) => {
            if (currentY > 540) {
              doc.addPage();
              currentY = 30;
              this.renderTableHeader(doc, cols, marginLeft, currentY);
              currentY += 18;
            }

            globalIdx++;
            const rowHeight = 14;

            if (localIdx % 2 === 0) {
              doc.rect(marginLeft, currentY - 2, tableWidth, rowHeight).fillAndStroke('#FFF7ED', '#FFF7ED');
            }

            doc.fillColor('black').font('Helvetica').fontSize(6.5);

            let x = marginLeft;
            const rowData = [
              String(globalIdx),
              PRIORIDADE_LABELS[item.prioridade] || 'P4',
              (item.descricao || '').substring(0, 38),
              item.codigo_barras || '-',
              (item.fornecedor || '').substring(0, 24),
              (item.grupo || '').substring(0, 16),
              item.curva || '-',
              `R$ ${(item.custo || 0).toFixed(2)}`,
              `R$ ${(item.preco_venda || 0).toFixed(2)}`,
              `${(item.margem || 0).toFixed(1)}%`,
              String(Math.round(item.estoque_atual || 0)),
              item.numero_nf || '-',
            ];

            cols.forEach((col, colIdx) => {
              const textOpts: any = { width: col.width - 4 };
              if (col.align === 'center') textOpts.align = 'center';
              if (col.align === 'right') textOpts.align = 'right';

              if (colIdx === 1) {
                const prioColors: Record<number, string> = { 1: '#DC2626', 2: '#EA580C', 3: '#CA8A04', 4: '#6B7280' };
                doc.fillColor(prioColors[item.prioridade] || '#6B7280');
                doc.font('Helvetica-Bold');
              }

              doc.text(rowData[colIdx], x + 2, currentY, textOpts);

              if (colIdx === 1) {
                doc.fillColor('black').font('Helvetica');
              }

              x += col.width;
            });

            currentY += rowHeight;
          });

          currentY += 8; // Espaço entre seções
        });

        // Rodapé
        doc.fontSize(7).font('Helvetica').fillColor('#888');
        doc.text(
          `Relatorio gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
          marginLeft,
          doc.page.height - 25,
          { align: 'center', width: tableWidth }
        );

        doc.end();

        writeStream.on('finish', () => {
          console.log(`✅ [AbastecimentoPDF] PDF gerado: ${filePath}`);
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          console.error(`❌ [AbastecimentoPDF] Erro ao salvar PDF:`, error);
          reject(error);
        });
      } catch (error) {
        console.error(`❌ [AbastecimentoPDF] Erro ao gerar PDF:`, error);
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
