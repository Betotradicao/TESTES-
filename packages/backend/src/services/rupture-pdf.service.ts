import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { RuptureSurvey } from '../entities/RuptureSurvey';
import { RuptureSurveyItem } from '../entities/RuptureSurveyItem';

export class RupturePDFService {
  /**
   * Converte valor para número (trata strings e Decimal do TypeORM)
   */
  private static toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Gera PDF da auditoria de ruptura agrupado por tipo
   * Retorna o caminho do arquivo PDF gerado
   */
  static async generateRupturePDF(
    survey: RuptureSurvey,
    items: RuptureSurveyItem[]
  ): Promise<string> {
    // Criar diretório temporário se não existir
    const tmpDir = path.join(__dirname, '../../tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Nome do arquivo
    const fileName = `ruptura_${survey.id}_${Date.now()}.pdf`;
    const filePath = path.join(tmpDir, fileName);

    // Agrupar itens por tipo de ruptura
    const naoEncontrados = items.filter(i => i.status_verificacao === 'nao_encontrado');
    const emEstoque = items.filter(i => i.status_verificacao === 'ruptura_estoque');

    // Buscar nome do auditor dos itens verificados (quem fez as verificações)
    const auditores = items
      .filter(i => i.verificado_por)
      .map(i => i.verificado_por)
      .filter((v, i, a) => a.indexOf(v) === i); // Unique
    const auditor = auditores.length > 0 ? auditores[0] : (survey.user?.name || survey.user?.username || '');

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
        doc.text('RADAR', 0, 12, { align: 'center', width: pageWidth });
        doc.fontSize(16).fillColor('white');
        doc.text('360', 0, 32, { align: 'center', width: pageWidth });

        // Voltar para baixo do box
        doc.y = boxHeight + 20;
        doc.fillColor('black');

        // Título do relatório
        doc.fontSize(14).font('Helvetica-Bold').text('RELATÓRIO DE AUDITORIA DE RUPTURAS', {
          align: 'center'
        });

        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Auditoria: ${survey.nome_pesquisa}`, {
          align: 'center'
        });

        doc.moveDown(0.3);
        doc.text(`Data: ${survey.data_fim_coleta ? new Date(survey.data_fim_coleta).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}`, {
          align: 'center'
        });

        // Adicionar auditor
        if (auditor) {
          doc.moveDown(0.3);
          doc.text(`Auditor: ${auditor}`, {
            align: 'center'
          });
        }

        doc.moveDown(1);

        // ESTATÍSTICAS GERAIS
        doc.fontSize(12).font('Helvetica-Bold').text('RESUMO GERAL', {
          underline: true
        });

        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total de Itens Verificados: ${survey.total_itens}`);
        doc.text(`Itens Encontrados: ${survey.itens_encontrados}`);
        doc.text(`Total de Rupturas: ${survey.itens_nao_encontrados}`);
        doc.text(`Taxa de Ruptura: ${survey.taxa_ruptura?.toFixed(2) || 0}%`);

        // Calcular perdas totais
        const rupturas = items.filter(i =>
          i.status_verificacao === 'nao_encontrado' ||
          i.status_verificacao === 'ruptura_estoque'
        );

        const perdaVendaDia = rupturas.reduce((total, item) => {
          const venda = this.toNumber(item.venda_media_dia) * this.toNumber(item.valor_venda);
          return total + venda;
        }, 0);

        const perdaLucroDia = rupturas.reduce((total, item) => {
          const lucro = this.toNumber(item.venda_media_dia) *
                        this.toNumber(item.valor_venda) *
                        (this.toNumber(item.margem_lucro) / 100);
          return total + lucro;
        }, 0);

        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#DC2626');
        doc.text(`Perda de Venda/Dia: R$ ${perdaVendaDia.toFixed(2)}`);
        doc.text(`Perda de Lucro/Dia: R$ ${perdaLucroDia.toFixed(2)}`);
        doc.fillColor('black');

        doc.moveDown(1.5);

        // ============ SEÇÃO 1: RUPTURAS - NÃO ENCONTRADO ============
        const sectionY = doc.y;
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#DC2626');
        doc.text('RUPTURAS - NÃO ENCONTRADO', 40, sectionY, {
          underline: true,
          continued: false
        });

        doc.fillColor('black');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Total: ${naoEncontrados.length} itens`);
        doc.moveDown(1);

        if (naoEncontrados.length > 0) {
          // Ordenar por criticidade (venda * valor * margem)
          const naoEncontradosOrdenados = naoEncontrados.sort((a, b) => {
            const critA = this.toNumber(a.venda_media_dia) * this.toNumber(a.valor_venda) * this.toNumber(a.margem_lucro);
            const critB = this.toNumber(b.venda_media_dia) * this.toNumber(b.valor_venda) * this.toNumber(b.margem_lucro);
            return critB - critA;
          });

          // Tabela de produtos não encontrados
          this.drawTableHeader(doc, ['Produto', 'Fornecedor', 'Curva', 'Estoque', 'V.Média/Dia', 'Valor', 'Pedido']);

          naoEncontradosOrdenados.forEach((item, index) => {
            this.drawTableRow(doc, [
              this.truncate(item.descricao || '', 40),
              this.truncate(item.fornecedor || '', 25),
              item.curva || '',
              '0', // Sempre 0 para não encontrado
              this.toNumber(item.venda_media_dia).toFixed(1),
              `R$ ${this.toNumber(item.valor_venda).toFixed(2)}`,
              item.tem_pedido === 'SIM' ? 'Sim' : 'Não'
            ], index % 2 === 0);

            // Nova página se necessário
            if (doc.y > 700) {
              doc.addPage();
            }
          });
        } else {
          doc.fontSize(10).font('Helvetica-Oblique').text('Nenhum item nesta categoria.');
        }

        // Nova página se necessário antes da segunda seção
        if (doc.y > 600) {
          doc.addPage();
        } else {
          doc.moveDown(3);
        }

        // ============ SEÇÃO 2: RUPTURAS - EM ESTOQUE ============
        const currentY = doc.y;
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#EA580C');
        doc.text('RUPTURAS - EM ESTOQUE', 40, currentY, {
          underline: true,
          continued: false
        });

        doc.fillColor('black');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Total: ${emEstoque.length} itens`);
        doc.moveDown(1);

        if (emEstoque.length > 0) {
          // Ordenar por criticidade
          const emEstoqueOrdenados = emEstoque.sort((a, b) => {
            const critA = this.toNumber(a.venda_media_dia) * this.toNumber(a.valor_venda) * this.toNumber(a.margem_lucro);
            const critB = this.toNumber(b.venda_media_dia) * this.toNumber(b.valor_venda) * this.toNumber(b.margem_lucro);
            return critB - critA;
          });

          // Nova página se a tabela anterior tomou muito espaço
          if (doc.y > 600) {
            doc.addPage();
          }

          // Tabela de produtos em estoque com ruptura
          this.drawTableHeader(doc, ['Produto', 'Fornecedor', 'Curva', 'Estoque', 'V.Média/Dia', 'Valor', 'Pedido']);

          emEstoqueOrdenados.forEach((item, index) => {
            this.drawTableRow(doc, [
              this.truncate(item.descricao || '', 40),
              this.truncate(item.fornecedor || '', 25),
              item.curva || '',
              this.toNumber(item.estoque_atual).toFixed(0),
              this.toNumber(item.venda_media_dia).toFixed(1),
              `R$ ${this.toNumber(item.valor_venda).toFixed(2)}`,
              item.tem_pedido === 'SIM' ? 'Sim' : 'Não'
            ], index % 2 === 0);

            // Nova página se necessário
            if (doc.y > 700) {
              doc.addPage();
            }
          });
        } else {
          doc.fontSize(10).font('Helvetica-Oblique').text('Nenhum item nesta categoria.');
        }

        // RODAPÉ - Informação sobre envio
        const rodapeY = doc.page.height - 60;
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#6B7280').text(
          `Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}`,
          40,
          rodapeY,
          { align: 'center' }
        );

        doc.fontSize(7).text(
          `📱 PDF enviado automaticamente para o grupo do WhatsApp configurado`,
          40,
          rodapeY + 12,
          { align: 'center' }
        );

        doc.fillColor('black');

        // Finalizar documento
        doc.end();

        // Quando stream terminar, resolver Promise com o caminho
        stream.on('finish', () => {
          console.log(`✅ PDF gerado: ${filePath}`);
          resolve(filePath);
        });

        stream.on('error', (err) => {
          console.error('❌ Erro ao gerar PDF:', err);
          reject(err);
        });

      } catch (error) {
        console.error('❌ Erro ao criar PDF:', error);
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
  private static drawTableRow(doc: PDFKit.PDFDocument, columns: string[], isEven: boolean) {
    const startY = doc.y;
    const colWidth = (doc.page.width - 80) / columns.length;
    const rowHeight = 22; // Altura maior para mais espaço

    // Fundo zebrado - cinza claro para linhas pares, branco para ímpares
    const bgColor = isEven ? '#F3F4F6' : '#FFFFFF';
    doc.rect(40, startY, doc.page.width - 80, rowHeight)
       .fillAndStroke(bgColor, bgColor);

    // Texto preto
    doc.fontSize(8).font('Helvetica').fillColor('black');

    columns.forEach((col, idx) => {
      doc.text(
        col,
        40 + idx * colWidth + 3,
        startY + 5,
        { width: colWidth - 8, align: 'left', lineBreak: false, ellipsis: true }
      );
    });

    doc.y = startY + rowHeight;
  }

  /**
   * Trunca texto longo
   */
  private static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Remove arquivo PDF temporário
   */
  static async deletePDF(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ PDF deletado: ${filePath}`);
      }
    } catch (error) {
      console.error('❌ Erro ao deletar PDF:', error);
    }
  }
}
