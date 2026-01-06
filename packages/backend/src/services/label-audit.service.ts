import { AppDataSource } from '../config/database';
import { LabelAudit } from '../entities/LabelAudit';
import { LabelAuditItem } from '../entities/LabelAuditItem';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import PDFDocument from 'pdfkit';
import { WhatsAppService } from './whatsapp.service';

export class LabelAuditService {
  /**
   * Processa arquivo CSV e cria auditoria de etiquetas
   */
  static async createAuditFromFile(
    filePath: string,
    titulo: string,
    dataReferencia: Date,
    userId: string
  ): Promise<LabelAudit> {
    try {
      console.log(`📂 Processando arquivo: ${filePath}`);

      // Ler arquivo CSV - tentar UTF-8 primeiro, depois Latin1
      let fileContent: string;
      try {
        fileContent = fs.readFileSync(filePath, 'utf-8');
        // Se tiver caracteres de replacement (�), tentar Latin1
        if (fileContent.includes('�')) {
          console.log('⚠️ Detectado encoding incorreto, tentando Latin1...');
          const buffer = fs.readFileSync(filePath);
          fileContent = buffer.toString('latin1');
        }
      } catch (err) {
        // Fallback para Latin1
        const buffer = fs.readFileSync(filePath);
        fileContent = buffer.toString('latin1');
      }

      // Remover BOM se existir
      if (fileContent.charCodeAt(0) === 0xFEFF) {
        fileContent = fileContent.slice(1);
      }

      // Dividir em linhas para encontrar o header real
      const lines = fileContent.split('\n');

      // Encontrar a linha que contém "Código Barras" (header real)
      let headerLineIndex = lines.findIndex(line =>
        line.includes('Código Barras') || line.includes('C�digo Barras') || line.includes('Codigo Barras')
      );

      // Se não encontrou, tentar pular as primeiras 4 linhas (padrão do seu CSV)
      if (headerLineIndex === -1) {
        headerLineIndex = 0;
      }

      // Reconstruir CSV a partir do header real
      const cleanedContent = lines.slice(headerLineIndex).join('\n');

      // Parsear CSV usando parse síncrono
      const parseResult: Papa.ParseResult<any> = Papa.parse(cleanedContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';', // CSV usa ponto-e-vírgula
      });

      if (parseResult.errors && parseResult.errors.length > 0) {
        console.error('❌ Erros ao parsear CSV:', parseResult.errors);
        throw new Error('Erro ao processar arquivo CSV');
      }

      const rows = (parseResult.data as any[]) || [];
      console.log(`📊 ${rows.length} linhas encontradas no CSV`);

      // Log dos headers para debug
      if (rows.length > 0) {
        console.log('🔍 Headers encontrados:', Object.keys(rows[0]));
      }

      // Filtrar linhas vazias ou de cabeçalho extra
      const validRows = rows.filter(row => {
        const codigoBarras = row['Código Barras'] || row['C�digo Barras'] || row['Codigo Barras'] || row['codigo_barras'];
        const descricao = row['Descrição Produto'] || row['Descri��o Produto'] || row['Descricao Produto'] || row['descricao'];

        // Aceitar linha se tiver código de barras OU descrição, e não for linha de cabeçalho
        return (codigoBarras || descricao) &&
               !String(codigoBarras || '').includes('SUPERMERCADO') &&
               !String(codigoBarras || '').includes('CEP') &&
               !String(codigoBarras || '').includes('CNPJ') &&
               !String(codigoBarras || '').includes('Código Barras');
      });

      console.log(`✅ ${validRows.length} produtos válidos encontrados`);

      // Criar auditoria
      const auditRepository = AppDataSource.getRepository(LabelAudit);
      const audit = auditRepository.create({
        titulo,
        data_referencia: dataReferencia,
        status: 'em_andamento',
      });

      await auditRepository.save(audit);
      console.log(`✅ Auditoria criada com ID: ${audit.id}`);

      // Criar itens
      const itemRepository = AppDataSource.getRepository(LabelAuditItem);
      const items: LabelAuditItem[] = [];

      for (const row of validRows) {
        // Extrair dados com fallback para diferentes encodings
        const codigoBarras = (row['Código Barras'] || row['C�digo Barras'] || row['Codigo Barras'] || '').trim();
        const descricao = (row['Descrição Produto'] || row['Descri��o Produto'] || row['Descricao Produto'] || '').trim();
        const etiqueta = (row['Etiqueta'] || '').trim();
        const secao = (row['Seção'] || row['Se��o'] || row['Secao'] || '').trim();
        const valorVenda = this.parsePrice(row['Valor Venda'] || '0');
        const valorOferta = this.parsePrice(row['Valor Oferta'] || '0');
        const margemPratica = (row['Margem Pratic'] || row['Margem Pratica'] || '').trim();

        const item = itemRepository.create({
          audit_id: audit.id,
          codigo_barras: codigoBarras || null,
          descricao,
          etiqueta: etiqueta || null,
          secao: secao || null,
          valor_venda: valorVenda,
          valor_oferta: valorOferta,
          margem_pratica: margemPratica || null,
          status_verificacao: 'pendente',
        });

        items.push(item);
      }

      await itemRepository.save(items);
      console.log(`✅ ${items.length} itens criados`);

      return audit;
    } catch (error) {
      console.error('❌ Erro ao processar arquivo:', error);
      throw error;
    }
  }

  /**
   * Helper para converter preço brasileiro (45,99) para decimal
   */
  private static parsePrice(priceStr: string): number {
    if (!priceStr || priceStr === '0,00' || priceStr === '0') return 0;

    // Remover "R$" e espaços
    let cleaned = priceStr.replace(/R\$\s*/g, '').trim();

    // Substituir vírgula por ponto
    cleaned = cleaned.replace(',', '.');

    return parseFloat(cleaned) || 0;
  }

  /**
   * Listar todas as auditorias com estatísticas
   */
  static async getAllAudits(): Promise<LabelAudit[]> {
    const auditRepository = AppDataSource.getRepository(LabelAudit);
    const itemRepository = AppDataSource.getRepository(LabelAuditItem);

    const audits = await auditRepository.find({
      order: { created_at: 'DESC' }
    });

    // Adicionar estatísticas para cada auditoria
    for (const audit of audits) {
      const items = await itemRepository.find({
        where: { audit_id: audit.id }
      });

      audit.total_itens = items.length;
      audit.itens_pendentes = items.filter(i => i.status_verificacao === 'pendente').length;
      audit.itens_corretos = items.filter(i => i.status_verificacao === 'preco_correto').length;
      audit.itens_divergentes = items.filter(i => i.status_verificacao === 'preco_divergente').length;

      if (audit.total_itens > 0) {
        audit.percentual_conformidade = Math.round((audit.itens_corretos / audit.total_itens) * 100);
      } else {
        audit.percentual_conformidade = 0;
      }
    }

    return audits;
  }

  /**
   * Buscar auditoria por ID com itens
   */
  static async getAuditById(auditId: number): Promise<LabelAudit | null> {
    const auditRepository = AppDataSource.getRepository(LabelAudit);
    const itemRepository = AppDataSource.getRepository(LabelAuditItem);

    const audit = await auditRepository.findOne({
      where: { id: auditId }
    });

    if (!audit) return null;

    // Buscar itens ordenados por seção (numérica) e depois descrição (alfabética)
    const items = await itemRepository
      .createQueryBuilder('item')
      .where('item.audit_id = :auditId', { auditId })
      .orderBy('CAST(item.secao AS UNSIGNED)', 'ASC')
      .addOrderBy('item.descricao', 'ASC')
      .getMany();

    audit.items = items;

    // Calcular estatísticas
    audit.total_itens = items.length;
    audit.itens_pendentes = items.filter(i => i.status_verificacao === 'pendente').length;
    audit.itens_corretos = items.filter(i => i.status_verificacao === 'preco_correto').length;
    audit.itens_divergentes = items.filter(i => i.status_verificacao === 'preco_divergente').length;

    if (audit.total_itens > 0) {
      audit.percentual_conformidade = Math.round((audit.itens_corretos / audit.total_itens) * 100);
    } else {
      audit.percentual_conformidade = 0;
    }

    return audit;
  }

  /**
   * Buscar itens pendentes para verificação (ordenados por seção)
   */
  static async getPendingItems(auditId: number): Promise<LabelAuditItem[]> {
    const itemRepository = AppDataSource.getRepository(LabelAuditItem);

    const items = await itemRepository
      .createQueryBuilder('item')
      .where('item.audit_id = :auditId', { auditId })
      .andWhere('item.status_verificacao = :status', { status: 'pendente' })
      .orderBy('CAST(item.secao AS UNSIGNED)', 'ASC')
      .addOrderBy('item.descricao', 'ASC')
      .getMany();

    return items;
  }

  /**
   * Verificar item (marcar como correto ou divergente)
   */
  static async verifyItem(
    itemId: number,
    statusVerificacao: 'preco_correto' | 'preco_divergente',
    verificadoPor: string,
    observacao?: string
  ): Promise<LabelAuditItem> {
    const itemRepository = AppDataSource.getRepository(LabelAuditItem);

    const item = await itemRepository.findOne({ where: { id: itemId } });

    if (!item) {
      throw new Error('Item não encontrado');
    }

    item.status_verificacao = statusVerificacao;
    item.data_verificacao = new Date();
    item.verificado_por = verificadoPor;
    if (observacao) {
      item.observacao_item = observacao;
    }

    await itemRepository.save(item);

    return item;
  }

  /**
   * Gerar relatório PDF com itens divergentes
   */
  static async generateDivergentReport(auditId: number): Promise<Buffer> {
    const audit = await this.getAuditById(auditId);

    if (!audit) {
      throw new Error('Auditoria não encontrada');
    }

    // Filtrar apenas itens divergentes
    const divergentItems = audit.items?.filter(i => i.status_verificacao === 'preco_divergente') || [];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Título
      doc.fontSize(18).font('Helvetica-Bold')
        .text('🏷️ PREVENÇÃO DE ETIQUETAS - ITENS DIVERGENTES', { align: 'center' });

      doc.moveDown();
      doc.fontSize(12).font('Helvetica')
        .text(`Auditoria: ${audit.titulo}`, { align: 'center' })
        .text(`Data: ${new Date(audit.data_referencia).toLocaleDateString('pt-BR')}`, { align: 'center' });

      doc.moveDown();
      doc.fontSize(10).fillColor('red')
        .text(`❌ ${divergentItems.length} produtos com preço DIVERGENTE`, { align: 'center' });

      doc.moveDown(2);

      // Tabela
      doc.fontSize(9).fillColor('black').font('Helvetica-Bold');

      let y = doc.y;

      // Cabeçalho
      doc.text('Código', 50, y, { width: 80, continued: false });
      doc.text('Descrição', 135, y, { width: 150, continued: false });
      doc.text('Seção', 290, y, { width: 50, continued: false });
      doc.text('Preço', 345, y, { width: 60, continued: false });
      doc.text('Oferta', 410, y, { width: 60, continued: false });
      doc.text('Verificado', 475, y, { width: 70, continued: false });

      y += 20;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 5;

      // Itens
      doc.font('Helvetica').fontSize(8);

      for (const item of divergentItems) {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }

        const precoVenda = item.valor_venda ? `R$ ${Number(item.valor_venda).toFixed(2).replace('.', ',')}` : '-';
        const precoOferta = item.valor_oferta && item.valor_oferta > 0
          ? `R$ ${Number(item.valor_oferta).toFixed(2).replace('.', ',')}`
          : '-';

        const verificadoPor = item.verificado_por || '-';

        doc.text(item.codigo_barras || '-', 50, y, { width: 80 });
        doc.text(item.descricao || '-', 135, y, { width: 150 });
        doc.text(item.secao || '-', 290, y, { width: 50 });
        doc.text(precoVenda, 345, y, { width: 60 });
        doc.fillColor('orange').text(precoOferta, 410, y, { width: 60 }).fillColor('black');
        doc.text(verificadoPor, 475, y, { width: 70 });

        y += 30;
      }

      // Rodapé
      doc.fontSize(8).fillColor('gray')
        .text(`Gerado em ${new Date().toLocaleString('pt-BR')} | Prevenção no Radar`, 50, 770, {
          align: 'center'
        });

      doc.end();
    });
  }

  /**
   * Enviar relatório via WhatsApp
   */
  static async sendDivergentReportToWhatsApp(auditId: number): Promise<void> {
    const pdfBuffer = await this.generateDivergentReport(auditId);

    // Salvar PDF temporariamente
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `etiquetas_divergentes_${auditId}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, pdfBuffer);

    try {
      await WhatsAppService.sendDocument(filePath, `🏷️ Relatório de Etiquetas Divergentes - Auditoria #${auditId}`);
      console.log(`✅ PDF enviado via WhatsApp: ${fileName}`);
    } finally {
      // Limpar arquivo temporário
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  /**
   * Deletar auditoria
   */
  static async deleteAudit(auditId: number): Promise<void> {
    const auditRepository = AppDataSource.getRepository(LabelAudit);
    await auditRepository.delete(auditId);
  }
}
