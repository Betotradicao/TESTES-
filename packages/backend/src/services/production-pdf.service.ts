import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { ProductionAudit } from '../entities/ProductionAudit';
import { ProductionAuditItem } from '../entities/ProductionAuditItem';

// Interface para dados de perdas mensais
interface PerdasMensais {
  mesAnterior: number;
  mesAtual: number;
  qtdMesAnterior: number;
  qtdMesAtual: number;
}

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
   * Formata número com 2 casas decimais
   */
  private static formatDecimal(value: any, decimals: number = 2): string {
    const num = this.toNumber(value);
    return num.toFixed(decimals).replace('.', ',');
  }

  /**
   * Calcula dias sem venda a partir da data YYYYMMDD
   */
  private static calculateDaysWithoutSale(dateStr: string | null): number {
    if (!dateStr || dateStr.length !== 8) return 999;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const lastSaleDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - lastSaleDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  }

  /**
   * Retorna cor de fundo baseada na curva
   */
  private static getCurvaColor(curva: string): string {
    switch (curva?.toUpperCase()) {
      case 'A': return '#dcfce7'; // Verde claro
      case 'B': return '#dbeafe'; // Azul claro
      case 'C': return '#fef9c3'; // Amarelo claro
      default: return '#fee2e2';  // Vermelho claro
    }
  }

  /**
   * Retorna cor de fundo baseada nos dias sem venda
   */
  private static getDiasSemVendaColor(dias: number): string {
    if (dias <= 1) return '#dcfce7';  // Verde claro
    if (dias <= 3) return '#fef9c3';  // Amarelo claro
    return '#fee2e2';                  // Vermelho claro
  }

  /**
   * Gera PDF da sugestão de produção
   * Retorna o caminho do arquivo PDF gerado
   */
  static async generateProductionPDF(
    audit: ProductionAudit,
    items: ProductionAuditItem[],
    perdasMensais?: Record<string, PerdasMensais>
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
        // Criar documento PDF em modo PAISAGEM
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 20,
          bufferPages: true
        });

        // Criar stream para arquivo
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const pageWidth = doc.page.width;
        const margin = 20;

        // LOGO COM BOX LARANJA NO TOPO
        const boxHeight = 35;
        doc.rect(0, 0, pageWidth, boxHeight).fillAndStroke('#EA580C', '#EA580C');
        doc.fontSize(14).font('Helvetica-Bold').fillColor('white');
        doc.text('RADAR 360', 0, 10, { align: 'center', width: pageWidth });

        // Título e informações
        doc.y = boxHeight + 8;
        doc.fillColor('black');
        doc.fontSize(11).font('Helvetica-Bold').text('SUGESTÃO DE PRODUÇÃO - PADARIA', { align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(8).font('Helvetica');
        const auditDateStr = new Date(audit.audit_date).toLocaleDateString('pt-BR');
        doc.text(`Data: ${auditDateStr}  |  Auditor: ${auditor || 'N/A'}`, { align: 'center' });
        doc.moveDown(0.4);

        // Ordenar itens por nome do produto
        const sortedItems = [...items].sort((a, b) => a.product_name.localeCompare(b.product_name));

        // Definir colunas - Total ~802 (842 - 40 de margem)
        // Código | Produto | Curva | Dias S/V | Estoque | V.Méd kg | V.Méd und | Perdas Ant | Qtd Ant | Perdas Atual | Qtd Atual | 1D kg | 1D und | 3D kg | 3D und | 7D kg | 7D und
        const cols = [
          { key: 'codigo', label: 'Código', width: 38 },
          { key: 'produto', label: 'Produto', width: 105 },
          { key: 'curva', label: 'Curva', width: 26 },
          { key: 'dias', label: 'Dias\nS/V', width: 26 },
          { key: 'estoque', label: 'Estoque', width: 40 },
          { key: 'vmedia_kg', label: 'V.Méd\nkg/d', width: 38 },
          { key: 'vmedia_und', label: 'V.Méd\nund/d', width: 38 },
          { key: 'perdas_ant', label: 'Perdas\nMês Ant', width: 48 },
          { key: 'qtd_ant', label: 'Qtd\nAnt', width: 28 },
          { key: 'perdas_atual', label: 'Perdas\nMês Atual', width: 48 },
          { key: 'qtd_atual', label: 'Qtd\nAtual', width: 28 },
          { key: 'sug1_kg', label: '1D\nkg', width: 32, bg: '#dcfce7' },
          { key: 'sug1_und', label: '1D\nund', width: 28, bg: '#dcfce7' },
          { key: 'sug3_kg', label: '3D\nkg', width: 32, bg: '#dbeafe' },
          { key: 'sug3_und', label: '3D\nund', width: 28, bg: '#dbeafe' },
          { key: 'sug7_kg', label: '7D\nkg', width: 32, bg: '#e9d5ff' },
          { key: 'sug7_und', label: '7D\nund', width: 28, bg: '#e9d5ff' },
        ];

        // Calcular totais
        let totalPerdasAnt = 0;
        let totalPerdasAtual = 0;

        // Função para desenhar cabeçalho
        const drawHeader = () => {
          const startY = doc.y;
          const headerHeight = 24;

          // Fundo laranja para cabeçalho principal
          doc.rect(margin, startY, pageWidth - margin * 2, headerHeight).fillAndStroke('#EA580C', '#EA580C');

          doc.fontSize(6).font('Helvetica-Bold').fillColor('white');
          let xPos = margin;
          cols.forEach((col) => {
            // Se tem cor de fundo específica (colunas de sugestão), desenhar
            if (col.bg) {
              doc.rect(xPos, startY, col.width, headerHeight).fillAndStroke(col.bg, col.bg);
              doc.fillColor('#166534'); // Verde escuro para 1D
              if (col.key.includes('3')) doc.fillColor('#1e40af'); // Azul escuro para 3D
              if (col.key.includes('7')) doc.fillColor('#7c3aed'); // Roxo para 7D
            } else {
              doc.fillColor('white');
            }

            const lines = col.label.split('\n');
            const textY = lines.length > 1 ? startY + 4 : startY + 8;
            lines.forEach((line, idx) => {
              doc.text(line, xPos + 2, textY + idx * 7, { width: col.width - 4, align: 'center', lineBreak: false });
            });
            xPos += col.width;
          });

          doc.y = startY + headerHeight;
        };

        // Função para desenhar linha
        const drawRow = (item: ProductionAuditItem, index: number) => {
          const startY = doc.y;
          const rowHeight = 16;

          // Fundo zebrado
          const bgColor = index % 2 === 0 ? '#f9fafb' : '#ffffff';
          doc.rect(margin, startY, pageWidth - margin * 2, rowHeight).fillAndStroke(bgColor, bgColor);

          // Calcular valores
          const daysWithoutSale = item.days_without_sale ?? this.calculateDaysWithoutSale(item.last_sale_date);
          const estoqueUnd = item.quantity_units || 0;
          const estoqueKg = estoqueUnd * this.toNumber(item.unit_weight_kg);
          const vendaMediaKg = this.toNumber(item.avg_sales_kg);
          const pesoMedio = this.toNumber(item.unit_weight_kg) || 1;
          // Calcular venda média em unidades
          const vendaMediaUnd = pesoMedio > 0 ? vendaMediaKg / pesoMedio : 0;

          // Perdas
          const perdas = perdasMensais?.[item.product_code] || { mesAnterior: 0, mesAtual: 0, qtdMesAnterior: 0, qtdMesAtual: 0 };
          const qtdUndAnt = pesoMedio > 0 ? Math.round(perdas.qtdMesAnterior / pesoMedio) : 0;
          const qtdUndAtual = pesoMedio > 0 ? Math.round(perdas.qtdMesAtual / pesoMedio) : 0;

          totalPerdasAnt += perdas.mesAnterior;
          totalPerdasAtual += perdas.mesAtual;

          // Sugestões
          const calcSug = (dias: number) => {
            const necessidadeKg = vendaMediaKg * dias;
            const sugKg = Math.max(0, necessidadeKg - estoqueKg);
            const sugUnd = pesoMedio > 0 ? Math.ceil(sugKg / pesoMedio) : 0;
            return { kg: sugKg, und: sugUnd };
          };
          const sug1 = calcSug(1);
          const sug3 = calcSug(3);
          const sug7 = calcSug(7);

          // Dados (17 colunas agora)
          const values = [
            { val: item.product_code || '-', align: 'left' },
            { val: item.product_name || '-', align: 'left' },
            { val: item.curva || '-', bg: this.getCurvaColor(item.curva || ''), fontColor: '#000000', bold: true },
            { val: daysWithoutSale.toString(), bg: this.getDiasSemVendaColor(daysWithoutSale), fontColor: '#000000', bold: true },
            { val: `${estoqueUnd} und`, align: 'center' },
            { val: vendaMediaKg > 0 ? this.formatDecimal(vendaMediaKg) : '-', align: 'center' },
            { val: vendaMediaUnd > 0 ? this.formatDecimal(vendaMediaUnd, 1) : '-', align: 'center' },
            { val: perdas.mesAnterior > 0 ? `R$ ${this.formatDecimal(perdas.mesAnterior)}` : '-', fontColor: '#1e40af' },
            { val: qtdUndAnt > 0 ? `${qtdUndAnt} und` : '-', fontColor: '#1e40af' },
            { val: perdas.mesAtual > 0 ? `R$ ${this.formatDecimal(perdas.mesAtual)}` : '-', fontColor: '#7c3aed' },
            { val: qtdUndAtual > 0 ? `${qtdUndAtual} und` : '-', fontColor: '#7c3aed' },
            { val: this.formatDecimal(sug1.kg), bg: '#dcfce7', fontColor: '#166534', bold: sug1.kg > 0 },
            { val: sug1.und > 0 ? sug1.und.toString() : '-', bg: '#dcfce7', fontColor: '#166534', bold: sug1.und > 0 },
            { val: this.formatDecimal(sug3.kg), bg: '#dbeafe', fontColor: '#1e40af', bold: sug3.kg > 0 },
            { val: sug3.und > 0 ? sug3.und.toString() : '-', bg: '#dbeafe', fontColor: '#1e40af', bold: sug3.und > 0 },
            { val: this.formatDecimal(sug7.kg), bg: '#e9d5ff', fontColor: '#7c3aed', bold: sug7.kg > 0 },
            { val: sug7.und > 0 ? sug7.und.toString() : '-', bg: '#e9d5ff', fontColor: '#7c3aed', bold: sug7.und > 0 },
          ];

          let xPos = margin;
          values.forEach((v, idx) => {
            const col = cols[idx];

            // Desenhar fundo colorido se necessário
            if (v.bg) {
              doc.rect(xPos, startY, col.width, rowHeight).fillAndStroke(v.bg, v.bg);
            }

            // Configurar fonte
            doc.fontSize(6).font(v.bold ? 'Helvetica-Bold' : 'Helvetica');
            doc.fillColor(v.fontColor || '#000000');

            // Desenhar texto
            const textAlign = v.align || 'center';
            doc.text(v.val, xPos + 2, startY + 5, {
              width: col.width - 4,
              align: textAlign as any,
              lineBreak: false,
              ellipsis: true
            });

            xPos += col.width;
          });

          doc.y = startY + rowHeight;
        };

        // Função para desenhar rodapé com totais
        const drawFooter = () => {
          const startY = doc.y;
          const footerHeight = 18;

          // Fundo cinza escuro
          doc.rect(margin, startY, pageWidth - margin * 2, footerHeight).fillAndStroke('#374151', '#374151');

          doc.fontSize(7).font('Helvetica-Bold').fillColor('white');

          // Posicionar os totais nas colunas corretas
          let xPos = margin;

          // Pular até a coluna de Perdas Mês Ant (índice 7, pois agora temos V.Méd und no índice 6)
          for (let i = 0; i < 7; i++) {
            xPos += cols[i].width;
          }

          // Total Perdas Mês Ant
          doc.fillColor('#93c5fd'); // Azul claro
          doc.text(`R$ ${this.formatDecimal(totalPerdasAnt)}`, xPos + 2, startY + 5, { width: cols[7].width - 4, align: 'center' });
          xPos += cols[7].width + cols[8].width; // Pular Qtd Ant

          // Total Perdas Mês Atual
          doc.fillColor('#c4b5fd'); // Roxo claro
          doc.text(`R$ ${this.formatDecimal(totalPerdasAtual)}`, xPos + 2, startY + 5, { width: cols[9].width - 4, align: 'center' });

          doc.y = startY + footerHeight;
        };

        // Desenhar cabeçalho inicial
        drawHeader();

        // Desenhar linhas
        sortedItems.forEach((item, index) => {
          // Verificar se precisa de nova página
          if (doc.y > 520) {
            doc.addPage();
            doc.y = 20;
            drawHeader();
          }
          drawRow(item, index);
        });

        // Desenhar rodapé com totais
        drawFooter();

        // Legenda
        doc.moveDown(0.5);
        doc.fontSize(6).font('Helvetica').fillColor('#6b7280');
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}  |  1D = 1 Dia, 3D = 3 Dias, 7D = 7 Dias`, margin);

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
