import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Bip } from '../entities/Bip';

export class BipPDFService {
  /**
   * Função para normalizar texto (remover acentos e caracteres especiais)
   */
  private static normalizeText(text: string | null | undefined): string {
    if (!text) return '-';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\x00-\x7F]/g, ''); // Remove caracteres não-ASCII
  }

  /**
   * Gera PDF com bipagens pendentes do dia anterior
   */
  static async generatePendingBipsPDF(bips: Bip[], date: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Data em horário brasileiro (GMT-3)
      const brazilDate = new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Cabeçalho com fundo laranja forte
      const headerHeight = 45;
      doc.rect(0, 0, 595, headerHeight).fillAndStroke('#FF5500', '#FF5500');
      doc.fontSize(16).fillColor('#FFF').text(this.normalizeText('RELATÓRIO DE BIPAGENS PENDENTES'), 30, 15, { align: 'center' });
      doc.moveDown(2.5);

      // Box do Resumo Geral
      const boxY = doc.y + 8;
      doc.rect(30, boxY, 535, 70).fillAndStroke('#F8F9FA', '#FF5500');

      // Título do Resumo
      doc.fontSize(11).fillColor('#FF5500').text('RESUMO GERAL', 40, boxY + 8);

      // Informações do resumo em duas colunas
      const colLeft = 40;
      const colRight = 310;
      let lineY = boxY + 26;
      const lineHeight = 13;

      doc.fontSize(8.5).fillColor('#000');

      // Coluna esquerda
      doc.text(this.normalizeText(`Data de Referência: ${date}`), colLeft, lineY);
      lineY += lineHeight;
      doc.text(this.normalizeText(`Total de Bipagens Pendentes: ${bips.length}`), colLeft, lineY);
      lineY += lineHeight;
      doc.text(this.normalizeText('Status: Produtos não vendidos no dia anterior'), colLeft, lineY);

      // Coluna direita
      lineY = boxY + 26;
      doc.text(this.normalizeText(`Gerado em: ${brazilDate}`), colRight, lineY);
      lineY += lineHeight;
      doc.text(this.normalizeText('Tipo: Bipagens sem Venda Identificada'), colRight, lineY);

      doc.moveDown(7);

      // Título da seção de bipagens
      let startY = doc.y;
      doc.fontSize(12).fillColor('#000').text(this.normalizeText(`PRODUTOS BIPADOS SEM VENDA (${bips.length})`), 30, startY);
      startY += 20;

      // Definir colunas da tabela
      const colX = [30, 100, 300, 410, 495];
      const colWidth = [70, 200, 110, 85, 70];
      const rowHeight = 18;

      // Cabeçalho da tabela (laranja forte)
      doc.rect(30, startY, 535, rowHeight).fillAndStroke('#FF6600', '#000');
      doc.fontSize(8).fillColor('#FFF');
      doc.text(this.normalizeText('COD. PROD'), colX[0] + 5, startY + 5, { width: colWidth[0], align: 'left' });
      doc.text(this.normalizeText('DESCRIÇÃO'), colX[1] + 5, startY + 5, { width: colWidth[1], align: 'left' });
      doc.text(this.normalizeText('BIPADOR'), colX[2] + 5, startY + 5, { width: colWidth[2], align: 'left' });
      doc.text(this.normalizeText('VALOR'), colX[3] + 5, startY + 5, { width: colWidth[3], align: 'left' });
      doc.text(this.normalizeText('DATA/HORA'), colX[4] + 5, startY + 5, { width: colWidth[4], align: 'left' });

      startY += rowHeight;

      // Itens
      doc.fontSize(7).fillColor('#000');
      for (let i = 0; i < bips.length; i++) {
        const bip = bips[i];

        if (startY > 750) {
          doc.addPage();
          startY = 50;
        }

        const bgColor = i % 2 === 0 ? '#FFF' : '#F9F9F9';
        doc.rect(30, startY, 535, rowHeight).fillAndStroke(bgColor, '#DDD');

        const preco = bip.bip_price_cents ? `R$ ${(bip.bip_price_cents / 100).toFixed(2).replace('.', ',')}` : '-';
        const dataHora = bip.event_date
          ? new Date(bip.event_date).toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          : '-';

        // Nome do bipador (employee)
        const bipadorNome = bip.employee?.name || 'Desconhecido';

        doc.fillColor('#000').text(bip.product_id || '-', colX[0] + 5, startY + 5, { width: colWidth[0] });
        doc.text(this.normalizeText(bip.product_description), colX[1] + 5, startY + 5, { width: colWidth[1] });
        doc.text(this.normalizeText(bipadorNome), colX[2] + 5, startY + 5, { width: colWidth[2] });
        doc.fillColor('#FF6600').text(preco, colX[3] + 5, startY + 5, { width: colWidth[3] });
        doc.fillColor('#666').text(dataHora, colX[4] + 5, startY + 5, { width: colWidth[4] });

        startY += rowHeight;
      }

      // Rodapé
      doc.fontSize(8).fillColor('#888').text(
        this.normalizeText('Relatório gerado automaticamente pelo sistema Prevenção no Radar'),
        50,
        770,
        { align: 'center' }
      );

      doc.end();
    });
  }

  /**
   * Salva PDF de bipagens pendentes e retorna o caminho do arquivo
   */
  static async savePendingBipsPDF(bips: Bip[], date: string): Promise<string> {
    const pdfBuffer = await this.generatePendingBipsPDF(bips, date);

    const fileName = `bipagens_pendentes_${date.replace(/-/g, '')}_${Date.now()}.pdf`;
    const filePath = path.join('/tmp', fileName);

    fs.writeFileSync(filePath, pdfBuffer);

    return filePath;
  }
}
