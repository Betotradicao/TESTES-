import { AppDataSource } from '../config/database';
import { LabelAudit } from '../entities/LabelAudit';
import { LabelAuditItem } from '../entities/LabelAuditItem';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import PDFDocument from 'pdfkit';
import { WhatsAppService } from './whatsapp.service';
import { ConfigurationService } from './configuration.service';
import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

export class LabelAuditService {
  /**
   * Processa arquivo CSV e cria auditoria de etiquetas
   */
  static async createAuditFromFile(
    filePath: string,
    titulo: string,
    dataReferencia: Date,
    userId: string,
    codLoja?: number
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
        cod_loja: codLoja || null,
      });

      await auditRepository.save(audit);
      console.log(`✅ Auditoria criada com ID: ${audit.id} (cod_loja: ${codLoja || 'null'})`);

      // Criar itens
      const itemRepository = AppDataSource.getRepository(LabelAuditItem);
      const items: LabelAuditItem[] = [];

      for (const row of validRows) {
        // Extrair dados com fallback para diferentes encodings
        const codigoBarras = this.parseBarcode(row['Código Barras'] || row['C�digo Barras'] || row['Codigo Barras'] || '');
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
   * Helper para converter código de barras em notação científica de volta para número completo
   * Exemplo: "7,8074E+12" ou "7.8074E+12" → "7807400000000"
   */
  private static parseBarcode(barcodeStr: string): string {
    if (!barcodeStr) return '';

    const cleaned = barcodeStr.trim();

    // Detectar notação científica (tanto com vírgula quanto com ponto)
    // Padrões: 7.8074E+12, 7,8074E+12, 7.8074e+12, etc.
    const scientificPattern = /^([0-9]+)[.,]([0-9]+)[eE]([+-]?[0-9]+)$/;
    const match = cleaned.match(scientificPattern);

    if (match) {
      // Converter de notação científica para número completo
      const integerPart = match[1];
      const decimalPart = match[2];
      const exponent = parseInt(match[3], 10);

      // Reconstruir o número: combinar integer + decimal e ajustar com o expoente
      const fullNumber = integerPart + decimalPart;
      const totalDigits = fullNumber.length;

      // Calcular quantos zeros adicionar
      // Expoente positivo significa mover a vírgula para a direita
      const zerosToAdd = Math.max(0, exponent - decimalPart.length);

      // Construir o número completo
      const result = fullNumber + '0'.repeat(zerosToAdd);

      return result;
    }

    // Se não estiver em notação científica, retornar como está
    return cleaned;
  }

  /**
   * Cria auditoria a partir de itens já carregados (Direto Sistema)
   */
  static async createFromItems(
    nomeAuditoria: string,
    items: any[],
    userId: string,
    codLoja?: number
  ): Promise<LabelAudit> {
    try {
      console.log(`📊 Criando auditoria de etiquetas com ${items.length} itens do sistema`);

      // Criar auditoria
      const auditRepository = AppDataSource.getRepository(LabelAudit);
      const audit = auditRepository.create({
        titulo: nomeAuditoria,
        data_referencia: new Date(),
        status: 'em_andamento',
        cod_loja: codLoja || null,
      });

      await auditRepository.save(audit);
      console.log(`✅ Auditoria criada: ID ${audit.id} (cod_loja: ${codLoja || 'null'})`);

      // Criar itens
      const itemRepository = AppDataSource.getRepository(LabelAuditItem);
      const auditItems: LabelAuditItem[] = [];

      for (const item of items) {
        const auditItem = itemRepository.create({
          audit_id: audit.id,
          codigo_barras: item.codigo_barras || null,
          descricao: item.descricao || '',
          etiqueta: item.etiqueta || null,
          secao: item.secao || null,
          valor_venda: item.valor_venda || 0,
          valor_oferta: item.valor_oferta || 0,
          margem_pratica: item.margem_lucro ? String(item.margem_lucro) : null,
          status_verificacao: 'pendente',
        });

        auditItems.push(auditItem);
      }

      await itemRepository.save(auditItems);
      console.log(`✅ ${auditItems.length} itens criados`);

      // Atualizar estatísticas da auditoria
      audit.total_itens = auditItems.length;
      audit.itens_pendentes = auditItems.length;
      audit.itens_verificados = 0;
      audit.itens_corretos = 0;
      audit.itens_divergentes = 0;

      return audit;
    } catch (error: any) {
      console.error('❌ Erro ao criar auditoria a partir dos itens:', error.message);
      throw error;
    }
  }

  /**
   * Listar todas as auditorias com estatísticas
   */
  static async getAllAudits(codLoja?: number): Promise<LabelAudit[]> {
    const auditRepository = AppDataSource.getRepository(LabelAudit);
    const itemRepository = AppDataSource.getRepository(LabelAuditItem);

    // Filtrar por loja se especificado
    const whereCondition: any = {};
    if (codLoja) {
      whereCondition.cod_loja = codLoja;
    }

    const audits = await auditRepository.find({
      where: whereCondition,
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

      // Calcular itens verificados (não pendentes) e incorretos
      audit.itens_verificados = items.filter(i => i.status_verificacao !== 'pendente').length;
      audit.itens_incorretos = audit.itens_divergentes; // Alias para manter compatibilidade com frontend

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
    console.log('🔍 [ETIQUETAS] Buscando auditoria ID:', auditId);

    const auditRepository = AppDataSource.getRepository(LabelAudit);
    const itemRepository = AppDataSource.getRepository(LabelAuditItem);

    const audit = await auditRepository.findOne({
      where: { id: auditId }
    });

    if (!audit) {
      console.log('❌ [ETIQUETAS] Auditoria não encontrada:', auditId);
      return null;
    }

    console.log('✅ [ETIQUETAS] Auditoria encontrada:', audit.titulo);

    // Buscar itens ordenados por seção (alfabética) e depois descrição (alfabética)
    const items = await itemRepository
      .createQueryBuilder('item')
      .where('item.audit_id = :auditId', { auditId })
      .orderBy('item.secao', 'ASC')
      .addOrderBy('item.descricao', 'ASC')
      .getMany();

    console.log('📦 [ETIQUETAS] Total de items encontrados:', items.length);

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

    console.log('📊 [ETIQUETAS] Estatísticas:', {
      total: audit.total_itens,
      pendentes: audit.itens_pendentes,
      corretos: audit.itens_corretos,
      divergentes: audit.itens_divergentes
    });

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
      .orderBy('item.secao', 'ASC')
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
   * Marcar auditoria como concluída
   */
  static async markAsCompleted(auditId: number): Promise<void> {
    const auditRepository = AppDataSource.getRepository(LabelAudit);

    await auditRepository.update(auditId, {
      status: 'concluida'
    });
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
    const itensCorretos = audit.items?.filter(i => i.status_verificacao === 'preco_correto') || [];

    // Função para normalizar texto (remover acentos e caracteres especiais)
    const normalizeText = (text: string | null | undefined): string => {
      if (!text) return '-';
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^\x00-\x7F]/g, ''); // Remove caracteres não-ASCII
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Cabeçalho com fundo laranja forte
      const headerHeight = 45;
      doc.rect(0, 0, 595, headerHeight).fillAndStroke('#FF5500', '#FF5500');
      doc.fontSize(16).fillColor('#FFF').text(normalizeText('RELATÓRIO DE AUDITORIA DE ETIQUETAS'), 30, 15, { align: 'center' });
      doc.moveDown(2.5);

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

      // Taxa de conformidade
      const totalItens = audit.total_itens || 0;
      const taxaConformidade = totalItens > 0 ? ((itensCorretos.length / totalItens) * 100) : 0;

      // Box do Resumo Geral - menor e mais compacto
      const boxY = doc.y + 8;
      doc.rect(30, boxY, 535, 90).fillAndStroke('#F8F9FA', '#FF5500');

      // Título do Resumo
      doc.fontSize(11).fillColor('#FF5500').text('RESUMO GERAL', 40, boxY + 8);

      // Informações do resumo em duas colunas
      const colLeft = 40;
      const colRight = 310;
      let lineY = boxY + 26;
      const lineHeight = 13;

      doc.fontSize(8.5).fillColor('#000');

      // Coluna esquerda
      const auditor = divergentItems[0]?.verificado_por || itensCorretos[0]?.verificado_por || 'N/A';
      doc.text(normalizeText(`Auditor: ${auditor}`), colLeft, lineY);
      lineY += lineHeight;
      doc.text(normalizeText(`Titulo: ${audit.titulo}`), colLeft, lineY);
      lineY += lineHeight;
      doc.text(normalizeText(`Total de Itens Verificados: ${totalItens}`), colLeft, lineY);
      lineY += lineHeight;
      doc.text(normalizeText(`Itens com Preco Correto: ${itensCorretos.length}`), colLeft, lineY);

      // Coluna direita
      lineY = boxY + 26;
      doc.text(normalizeText(`Data da Auditoria: ${new Date(audit.data_referencia).toLocaleDateString('pt-BR')}`), colRight, lineY);
      lineY += lineHeight;
      doc.text(normalizeText(`Itens Divergentes: ${divergentItems.length}`), colRight, lineY);
      lineY += lineHeight;
      doc.text(normalizeText(`Taxa de Conformidade: ${taxaConformidade.toFixed(1)}%`), colRight, lineY);
      lineY += lineHeight;
      doc.text(normalizeText(`Gerado em: ${brazilDate}`), colRight, lineY);

      doc.moveDown(8);

      // Título da seção de divergentes
      let startY = doc.y;
      doc.fontSize(12).fillColor('#000').text(normalizeText(`ETIQUETAS COM PREÇO DIVERGENTE (${divergentItems.length})`), 30, startY);
      startY += 20;

      // Definir colunas da tabela (sem VERIFICADO POR, CODIGO mais largo)
      const colX = [30, 130, 300, 360, 445];
      const colWidth = [100, 170, 60, 85, 85];
      const rowHeight = 18;

      // Cabeçalho da tabela (laranja forte)
      doc.rect(30, startY, 535, rowHeight).fillAndStroke('#FF6600', '#000');
      doc.fontSize(8).fillColor('#FFF');
      doc.text(normalizeText('CÓDIGO DE BARRAS'), colX[0] + 5, startY + 5, { width: colWidth[0], align: 'left' });
      doc.text(normalizeText('PRODUTO'), colX[1] + 5, startY + 5, { width: colWidth[1], align: 'left' });
      doc.text(normalizeText('SEÇÃO'), colX[2] + 5, startY + 5, { width: colWidth[2], align: 'left' });
      doc.text(normalizeText('PREÇO VENDA'), colX[3] + 5, startY + 5, { width: colWidth[3], align: 'left' });
      doc.text(normalizeText('PREÇO OFERTA'), colX[4] + 5, startY + 5, { width: colWidth[4], align: 'left' });

      startY += rowHeight;

      // Itens divergentes
      doc.fontSize(7).fillColor('#000');
      for (let i = 0; i < divergentItems.length; i++) {
        const item = divergentItems[i];

        if (startY > 750) {
          doc.addPage();
          startY = 50;
        }

        const bgColor = i % 2 === 0 ? '#FFF' : '#F9F9F9';
        doc.rect(30, startY, 535, rowHeight).fillAndStroke(bgColor, '#DDD');

        const precoVenda = item.valor_venda ? `R$ ${Number(item.valor_venda).toFixed(2).replace('.', ',')}` : '-';
        const precoOferta = item.valor_oferta && item.valor_oferta > 0
          ? `R$ ${Number(item.valor_oferta).toFixed(2).replace('.', ',')}`
          : '-';

        // Forçar código de barras como string para evitar notação científica
        const codigoBarras = item.codigo_barras ? String(item.codigo_barras) : '-';

        doc.fillColor('#000').text(codigoBarras, colX[0] + 5, startY + 5, { width: colWidth[0] });
        doc.text(normalizeText(item.descricao), colX[1] + 5, startY + 5, { width: colWidth[1] });
        doc.text(normalizeText(item.secao), colX[2] + 5, startY + 5, { width: colWidth[2] });
        doc.text(precoVenda, colX[3] + 5, startY + 5, { width: colWidth[3] });
        doc.fillColor('#FF6600').text(precoOferta, colX[4] + 5, startY + 5, { width: colWidth[4] });

        startY += rowHeight;
      }

      // Rodapé
      doc.fontSize(8).fillColor('#888').text(
        normalizeText('Relatório gerado automaticamente pelo sistema Radar 360'),
        50,
        770,
        { align: 'center' }
      );

      doc.end();
    });
  }

  /**
   * Enviar relatório via WhatsApp
   */
  static async sendDivergentReportToWhatsApp(auditId: number): Promise<void> {
    // Buscar grupo do WhatsApp específico para Etiquetas (com fallback para o grupo padrão)
    const groupId = await ConfigurationService.get('whatsapp_group_etiquetas', '') ||
                    await ConfigurationService.get('evolution_whatsapp_group_id', process.env.EVOLUTION_WHATSAPP_GROUP_ID || '');

    if (!groupId) {
      console.warn('⚠️  Grupo do WhatsApp não configurado (whatsapp_group_etiquetas ou evolution_whatsapp_group_id)');
      throw new Error('Grupo do WhatsApp não configurado');
    }

    // Buscar dados da auditoria para incluir na mensagem
    const audit = await this.getAuditById(auditId);
    if (!audit) {
      throw new Error('Auditoria não encontrada');
    }

    const totalItens = audit.total_itens || 0;
    const itensCorretos = audit.itens_corretos || 0;
    const itensDivergentes = audit.itens_divergentes || 0;

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
      console.log(`📊 Enviando relatório de etiquetas para grupo: ${groupId}`);

      // Mensagem formatada com as estatísticas (igual ao de Ruptura)
      const caption = `🏷️ *RELATÓRIO DE AUDITORIA DE ETIQUETAS*\n\n` +
                     `📋 Auditoria: ${audit.titulo}\n` +
                     `📅 Data: ${new Date().toLocaleString('pt-BR')}\n\n` +
                     `📦 Total de Itens: ${totalItens}\n` +
                     `✅ Preço Correto: ${itensCorretos}\n` +
                     `❌ Preço Divergente: ${itensDivergentes}\n\n` +
                     `📄 Confira o relatório detalhado em PDF anexo.`;

      await WhatsAppService.sendDocument(groupId, filePath, caption);
      console.log(`✅ PDF enviado via WhatsApp: ${fileName}`);
    } finally {
      // Limpar arquivo temporário
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  /**
   * Buscar resultados agregados de múltiplas auditorias com filtros
   */
  static async getAgregatedResults(filters: {
    data_inicio: string;
    data_fim: string;
    produto?: string;
    fornecedor?: string;
    auditor?: string;
  }): Promise<any> {
    const itemRepository = AppDataSource.getRepository(LabelAuditItem);
    const auditRepository = AppDataSource.getRepository(LabelAudit);

    // Buscar auditorias no período
    const audits = await auditRepository
      .createQueryBuilder('audit')
      .where('audit.data_referencia >= :dataInicio', { dataInicio: filters.data_inicio })
      .andWhere('audit.data_referencia <= :dataFim', { dataFim: filters.data_fim })
      .getMany();

    const auditIds = audits.map(a => a.id);

    if (auditIds.length === 0) {
      return {
        estatisticas: {
          total_itens_verificados: 0,
          total_corretos: 0,
          total_divergentes: 0,
          taxa_conformidade: 0,
        },
        itens_divergentes: [],
        secoes_ranking: [],
      };
    }

    // Query builder com filtros
    let query = itemRepository
      .createQueryBuilder('item')
      .where('item.audit_id IN (:...auditIds)', { auditIds });

    // Filtro de produto
    if (filters.produto && filters.produto !== 'todos') {
      query = query.andWhere('item.descricao = :produto', { produto: filters.produto });
    }

    // Filtro de auditor
    if (filters.auditor && filters.auditor !== 'todos') {
      query = query.andWhere('item.verificado_por = :auditor', { auditor: filters.auditor });
    }

    const items = await query.getMany();

    // Calcular estatísticas
    const itensVerificados = items.filter(i => i.status_verificacao !== 'pendente');
    const itensCorretos = items.filter(i => i.status_verificacao === 'preco_correto');
    const itensDivergentes = items.filter(i => i.status_verificacao === 'preco_divergente');

    const totalItensVerificados = itensVerificados.length;
    const totalCorretos = itensCorretos.length;
    const totalDivergentes = itensDivergentes.length;
    const taxaConformidade = totalItensVerificados > 0 ? (totalCorretos / totalItensVerificados) * 100 : 0;

    // Agrupar divergentes por produto (contar ocorrências)
    const divergentesPorProduto: { [key: string]: any } = {};

    itensDivergentes.forEach(item => {
      const key = item.descricao;
      if (!divergentesPorProduto[key]) {
        divergentesPorProduto[key] = {
          descricao: item.descricao,
          codigo_barras: item.codigo_barras || '-',
          secao: item.secao || 'Sem seção',
          valor_venda: item.valor_venda || 0,
          valor_oferta: item.valor_oferta || 0,
          margem_lucro: item.margem_pratica || '0,0%', // Adicionar margem_pratica
          ocorrencias: 0,
        };
      }
      divergentesPorProduto[key].ocorrencias++;
    });

    // Converter para array e ordenar por ocorrências
    const itensDivergentesAgrupados = Object.values(divergentesPorProduto)
      .sort((a: any, b: any) => b.ocorrencias - a.ocorrencias);

    // Criar mapa de audit_id -> data_referencia para usar no dia da semana
    const auditDateMap: { [key: number]: Date } = {};
    audits.forEach(audit => {
      auditDateMap[audit.id] = new Date(audit.data_referencia);
    });

    // Ranking de seções com mais divergências e valores por seção
    const divergentesPorSecao: { [key: string]: number } = {};
    const valoresPorSecao: { [key: string]: number } = {};

    // Agrupar por dia da semana (usando data_referencia da auditoria)
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const divergentesPorDiaSemana: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    // Helper para converter valor decimal do PostgreSQL (pode vir como string, number ou Decimal)
    const parseDecimal = (value: any): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseFloat(value) || 0;
      if (typeof value === 'object' && value.toString) return parseFloat(value.toString()) || 0;
      return 0;
    };

    itensDivergentes.forEach(item => {
      const secao = item.secao || 'Sem seção';
      const valorVenda = parseDecimal(item.valor_venda);

      // Contagem por seção
      divergentesPorSecao[secao] = (divergentesPorSecao[secao] || 0) + 1;

      // Valores por seção
      valoresPorSecao[secao] = (valoresPorSecao[secao] || 0) + valorVenda;

      // Dia da semana (usa data da auditoria)
      const auditDate = auditDateMap[item.audit_id];
      if (auditDate) {
        const diaSemana = auditDate.getDay(); // 0 = Domingo, 6 = Sábado
        divergentesPorDiaSemana[diaSemana]++;
      }
    });

    const secoesRanking = Object.entries(divergentesPorSecao)
      .map(([secao, quantidade]) => ({ secao, rupturas: quantidade }))
      .sort((a, b) => b.rupturas - a.rupturas);

    // Ranking de valores por seção
    const valoresSecoesRanking = Object.entries(valoresPorSecao)
      .map(([secao, valor]) => ({ secao, valor: parseFloat(valor.toFixed(2)) }))
      .sort((a, b) => b.valor - a.valor);

    const divergentesPorDia = diasSemana.map((nome, index) => ({
      dia: nome,
      quantidade: divergentesPorDiaSemana[index]
    }));

    // Calcular taxa de divergência (o frontend espera taxa_ruptura)
    const taxaDivergencia = totalItensVerificados > 0 ? (totalDivergentes / totalItensVerificados) * 100 : 0;

    // Calcular valor total dos itens divergentes (produtos com preço incorreto)
    const valorTotalDivergentes = itensDivergentes.reduce((acc, item) => {
      return acc + parseDecimal(item.valor_venda);
    }, 0);

    // DEBUG: Log para verificar os valores
    console.log('📊 [ETIQUETAS DEBUG] Total itens divergentes:', itensDivergentes.length);
    if (itensDivergentes.length > 0) {
      console.log('📊 [ETIQUETAS DEBUG] Amostra de itens divergentes:');
      itensDivergentes.slice(0, 3).forEach((item, idx) => {
        console.log(`  Item ${idx + 1}: valor_venda=${item.valor_venda} (tipo: ${typeof item.valor_venda}), parseDecimal=${parseDecimal(item.valor_venda)}`);
      });
    }
    console.log('📊 [ETIQUETAS DEBUG] Valor total calculado:', valorTotalDivergentes);
    console.log('📊 [ETIQUETAS DEBUG] Valores por seção:', valoresPorSecao);
    console.log('📊 [ETIQUETAS DEBUG] Divergentes por dia:', divergentesPorDiaSemana);

    // Buscar descontos PDV do Oracle (mesma fonte do Frente de Caixa)
    const descontosPDV = await this.getDescontosPDV(filters.data_inicio, filters.data_fim);
    console.log('📊 [ETIQUETAS DEBUG] Descontos PDV do Oracle:', descontosPDV);

    return {
      estatisticas: {
        total_itens_verificados: totalItensVerificados,
        total_encontrados: totalCorretos, // Frontend espera total_encontrados
        total_rupturas: totalDivergentes, // Frontend espera total_rupturas
        rupturas_nao_encontrado: 0, // Não aplicável para etiquetas
        rupturas_em_estoque: totalDivergentes, // Considerar divergentes como "em estoque"
        taxa_ruptura: parseFloat(taxaDivergencia.toFixed(2)), // Frontend espera taxa_ruptura
        perda_venda_periodo: 0, // Não calculamos perda para etiquetas
        perda_lucro_periodo: 0, // Não calculamos perda para etiquetas
        valor_total_divergentes: parseFloat(valorTotalDivergentes.toFixed(2)), // Valor total dos itens com preço divergente
      },
      itens_ruptura: itensDivergentesAgrupados, // Frontend espera itens_ruptura
      fornecedores_ranking: [], // Frontend pode esperar isso
      secoes_ranking: secoesRanking,
      valores_secoes_ranking: valoresSecoesRanking, // Valores por seção
      divergentes_por_dia: divergentesPorDia, // Divergentes por dia da semana
      descontos_pdv: descontosPDV, // Descontos PDV do Oracle (Intersolid)
    };
  }

  /**
   * Busca descontos PDV do Oracle (Intersolid) para o período
   * Usa a mesma fonte de dados da Frente de Caixa (TAB_PRODUTO_PDV)
   */
  static async getDescontosPDV(dataInicio: string, dataFim: string): Promise<{
    total: number;
    porSetor: Array<{ secao: string; valor: number }>;
  }> {
    try {
      console.log('📊 [ETIQUETAS] Buscando descontos PDV do Oracle...');
      console.log(`📅 Período recebido: ${dataInicio} a ${dataFim}`);

      // Obter schema e nomes de tabelas dinamicamente via MappingService
      const schema = await MappingService.getSchema();
      const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;

      // Converter formato YYYY-MM-DD para DD/MM/YYYY (formato Oracle)
      const formatDateForOracle = (dateStr: string): string => {
        if (!dateStr) return dateStr;
        // Se já estiver no formato DD/MM/YYYY, retorna como está
        if (dateStr.includes('/')) return dateStr;
        // Converte YYYY-MM-DD para DD/MM/YYYY
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };

      const dataInicioOracle = formatDateForOracle(dataInicio);
      const dataFimOracle = formatDateForOracle(dataFim);
      console.log(`📅 Período Oracle: ${dataInicioOracle} a ${dataFimOracle}`);

      const params = { dataInicio: dataInicioOracle, dataFim: dataFimOracle };

      // Resolver colunas via MappingService
      const colValDesconto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_desconto');
      const colDtaVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
      const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
      const colCodProdutoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colCodSecaoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
      const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
      const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

      // Query para total de descontos (IGUAL ao Frente de Caixa - getTotais)
      const sqlTotal = `
        SELECT SUM(${colValDesconto}) as TOTAL_DESCONTOS
        FROM ${tabProdutoPdv}
        WHERE ${colDtaVendaPdv} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND ${colDtaVendaPdv} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND ${colValDesconto} > 0
      `;

      console.log('🔍 [ETIQUETAS] Executando query de descontos totais...');
      const totalResult = await OracleService.query<any>(sqlTotal, params);
      const totalDescontos = totalResult[0]?.TOTAL_DESCONTOS || 0;
      console.log('✅ [ETIQUETAS] Total de descontos PDV:', totalDescontos);

      // Query para descontos agrupados por seção (mesma lógica do Frente de Caixa)
      // TAB_PRODUTO_PDV tem COD_PRODUTO, e TAB_PRODUTO tem COD_SECAO
      const sqlPorSecao = `
        SELECT
          NVL(s.${colDesSecao}, 'SEM SEÇÃO') as SECAO,
          SUM(pp.${colValDesconto}) as VALOR_DESCONTO
        FROM ${tabProdutoPdv} pp
        LEFT JOIN ${tabProduto} p ON pp.${colCodProdutoPdv} = p.${colCodProdutoP}
        LEFT JOIN ${tabSecao} s ON p.${colCodSecaoP} = s.${colCodSecao}
        WHERE pp.${colDtaVendaPdv} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND pp.${colDtaVendaPdv} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND pp.${colValDesconto} > 0
        GROUP BY s.${colDesSecao}
        ORDER BY VALOR_DESCONTO DESC
      `;

      console.log('🔍 [ETIQUETAS] Executando query de descontos por seção...');
      const secaoResult = await OracleService.query<any>(sqlPorSecao, params);
      console.log(`✅ [ETIQUETAS] Descontos por seção: ${secaoResult.length} seções`);

      const porSetor = secaoResult.map((row: any) => ({
        secao: row.SECAO || 'Sem seção',
        valor: parseFloat(row.VALOR_DESCONTO) || 0
      }));

      return {
        total: parseFloat(totalDescontos) || 0,
        porSetor
      };
    } catch (error: any) {
      console.error('❌ [ETIQUETAS] Erro ao buscar descontos PDV:', error.message);
      // Retornar valores zerados em caso de erro para não quebrar a tela
      return {
        total: 0,
        porSetor: []
      };
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
