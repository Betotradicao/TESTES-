import { AppDataSource } from '../config/database';
import { RuptureSurvey } from '../entities/RuptureSurvey';
import { RuptureSurveyItem } from '../entities/RuptureSurveyItem';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import PDFDocument from 'pdfkit';
import { WhatsAppService } from './whatsapp.service';

export class RuptureSurveyService {
  /**
   * Processa arquivo CSV/Excel e cria pesquisa de ruptura
   */
  static async createSurveyFromFile(
    filePath: string,
    nomePesquisa: string,
    userId: string
  ): Promise<RuptureSurvey> {
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
        line.includes('Código Barras') || line.includes('C�digo Barras')
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
        const descricao = row['Descrição'] || row['Descri��o'] || row['Descricao'] || row['descricao'];

        // Aceitar linha se tiver código de barras OU descrição, e não for linha de cabeçalho
        return (codigoBarras || descricao) &&
               !String(codigoBarras || '').includes('SUPERMERCADO') &&
               !String(codigoBarras || '').includes('CEP') &&
               !String(codigoBarras || '').includes('CNPJ') &&
               !String(codigoBarras || '').includes('Código Barras');
      });

      console.log(`✅ ${validRows.length} produtos válidos encontrados`);

      // Criar pesquisa
      const surveyRepository = AppDataSource.getRepository(RuptureSurvey);
      const survey = surveyRepository.create({
        nome_pesquisa: nomePesquisa,
        user_id: userId,
        total_itens: validRows.length,
        status: 'rascunho',
      });

      await surveyRepository.save(survey);
      console.log(`✅ Pesquisa criada: ID ${survey.id}`);

      // Criar itens
      const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);
      const items: RuptureSurveyItem[] = [];

      for (const row of validRows) {
        // Função helper para limpar valores numéricos
        const parseNumber = (value: any): number | null => {
          if (!value) return null;
          const cleaned = String(value).replace(',', '.');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? null : parsed;
        };

        // Função para limpar percentual (ex: "31,52%" -> 31.52)
        const parsePercentage = (value: any): number | null => {
          if (!value) return null;
          const cleaned = String(value).replace('%', '').replace(',', '.');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? null : parsed;
        };

        // Debug: verificar valor da coluna Pedido
        const pedidoValue = row['PEDIDO'] || row['Pedido'] || row['Pedido?'] || null;
        if (items.length === 0) {
          console.log('🔍 Valor Pedido? =', row['Pedido?']);
          console.log('🔍 pedidoValue final =', pedidoValue);
        }

        const item = itemRepository.create({
          survey_id: survey.id,
          codigo_barras: row['Código Barras'] || row['C�digo Barras'] || null,
          descricao: row['Descrição'] || row['Descri��o'] || '',
          curva: row['Curva'] || null,
          estoque_atual: parseNumber(row['Estoque Atual']),
          cobertura_dias: parseNumber(row['Cobertura']),
          grupo: row['Descrição Grupo'] || row['Descri��o Grupo'] || null,
          secao: row['Descrição Seção'] || row['Descri��o Se��o'] || null,
          subgrupo: row['Descrição SubGrupo'] || row['Descri��o SubGrupo'] || null,
          fornecedor: row['Desc. Fornecedor Pref'] || null,
          margem_lucro: parsePercentage(row['Mark-Down']),
          qtd_embalagem: parseNumber(row['Qtd.Embalagem Compra']),
          valor_venda: parseNumber(row['Valor Venda']),
          custo_com_imposto: parseNumber(row['Custo c/Imp']),
          venda_media_dia: parseNumber(row['Venda Média'] || row['Venda M�dia']),
          tem_pedido: pedidoValue,
          status_verificacao: 'pendente',
        });

        items.push(item);
      }

      await itemRepository.save(items);
      console.log(`✅ ${items.length} itens criados`);

      return survey;
    } catch (error: any) {
      console.error('❌ Erro ao criar pesquisa de ruptura:', error.message);
      throw error;
    }
  }

  /**
   * Atualizar status de um item da pesquisa
   */
  static async updateItemStatus(
    itemId: number,
    status: 'encontrado' | 'nao_encontrado' | 'ruptura_estoque',
    verificadoPor: string,
    observacao?: string
  ): Promise<RuptureSurveyItem> {
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);
    const item = await itemRepository.findOne({ where: { id: itemId } });

    if (!item) {
      throw new Error('Item não encontrado');
    }

    item.status_verificacao = status;
    item.data_verificacao = new Date();
    item.verificado_por = verificadoPor;
    if (observacao) {
      item.observacao_item = observacao;
    }

    await itemRepository.save(item);

    // Atualizar contadores da pesquisa
    await this.updateSurveyCounters(item.survey_id);

    return item;
  }

  /**
   * Atualizar contadores da pesquisa (itens verificados, encontrados, etc)
   */
  static async updateSurveyCounters(surveyId: number): Promise<void> {
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);

    const survey = await surveyRepository.findOne({ where: { id: surveyId } });
    if (!survey) return;

    // Contar status dos itens
    const items = await itemRepository.find({ where: { survey_id: surveyId } });

    survey.itens_verificados = items.filter((i: RuptureSurveyItem) => i.status_verificacao !== 'pendente').length;
    survey.itens_encontrados = items.filter((i: RuptureSurveyItem) => i.status_verificacao === 'encontrado').length;
    // IMPORTANTE: Contar tanto 'nao_encontrado' quanto 'ruptura_estoque' como rupturas
    survey.itens_nao_encontrados = items.filter((i: RuptureSurveyItem) =>
      i.status_verificacao === 'nao_encontrado' || i.status_verificacao === 'ruptura_estoque'
    ).length;

    // Atualizar status da pesquisa
    if (survey.itens_verificados === survey.total_itens && survey.status === 'em_andamento') {
      survey.status = 'concluida';
      survey.data_fim_coleta = new Date();
    }

    await surveyRepository.save(survey);
  }

  /**
   * Iniciar pesquisa (mudar status para em_andamento)
   */
  static async startSurvey(surveyId: number): Promise<RuptureSurvey> {
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);
    const survey = await surveyRepository.findOne({ where: { id: surveyId } });

    if (!survey) {
      throw new Error('Pesquisa não encontrada');
    }

    if (survey.status !== 'rascunho') {
      throw new Error('Pesquisa já foi iniciada');
    }

    survey.status = 'em_andamento';
    survey.data_inicio_coleta = new Date();

    await surveyRepository.save(survey);
    return survey;
  }

  /**
   * Buscar pesquisa com itens e estatísticas
   */
  static async getSurveyWithStats(surveyId: number): Promise<any> {
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);

    const survey = await surveyRepository.findOne({
      where: { id: surveyId },
      relations: ['user'],
    });

    if (!survey) {
      throw new Error('Pesquisa não encontrada');
    }

    const items = await itemRepository.find({
      where: { survey_id: surveyId },
      order: {
        secao: 'ASC',
        descricao: 'ASC',
      },
    });

    // Calcular perdas - incluir AMBOS os tipos de ruptura
    const itensRuptura = items.filter((i: RuptureSurveyItem) =>
      i.status_verificacao === 'nao_encontrado' || i.status_verificacao === 'ruptura_estoque'
    );

    const perdasVenda = itensRuptura.reduce((total: number, item: RuptureSurveyItem) => {
      return total + item.perda_venda_dia;
    }, 0);

    const perdasLucro = itensRuptura.reduce((total: number, item: RuptureSurveyItem) => {
      return total + item.perda_lucro_dia;
    }, 0);

    // Agrupar rupturas por fornecedor
    const rupturasPorFornecedor: { [key: string]: { count: number; perda: number } } = {};

    itensRuptura.forEach((item: RuptureSurveyItem) => {
      const fornecedor = item.fornecedor || 'Sem fornecedor';
      if (!rupturasPorFornecedor[fornecedor]) {
        rupturasPorFornecedor[fornecedor] = { count: 0, perda: 0 };
      }
      rupturasPorFornecedor[fornecedor].count++;
      rupturasPorFornecedor[fornecedor].perda += item.perda_venda_dia;
    });

    // Ordenar fornecedores por número de rupturas
    const fornecedoresRanking = Object.entries(rupturasPorFornecedor)
      .map(([fornecedor, stats]) => ({
        fornecedor,
        rupturas: stats.count,
        perda_total: stats.perda,
      }))
      .sort((a, b) => b.rupturas - a.rupturas);

    return {
      ...survey,
      items,
      estatisticas: {
        taxa_ruptura: survey.taxa_ruptura,
        progresso_percentual: survey.progresso_percentual,
        perda_venda_dia: perdasVenda,
        perda_lucro_dia: perdasLucro,
        perda_venda_semanal: perdasVenda * 7,
        perda_lucro_semanal: perdasLucro * 7,
        itens_ruptura: itensRuptura.length,
        itens_curva_a_ruptura: itensRuptura.filter((i: RuptureSurveyItem) => i.curva === 'A').length,
        fornecedores_ranking: fornecedoresRanking,
      },
    };
  }

  /**
   * Listar todas as pesquisas COM estatísticas
   */
  static async getAllSurveys(): Promise<any[]> {
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);

    const surveys = await surveyRepository.find({
      relations: ['user'],
      order: { data_criacao: 'DESC' },
    });

    // Adicionar estatísticas para cada pesquisa
    const surveysWithStats = await Promise.all(
      surveys.map(async (survey) => {
        const items = await itemRepository.find({
          where: { survey: { id: survey.id } },
        });

        const totalItens = items.length;
        const itensVerificados = items.filter(
          (item) => item.status_verificacao !== 'pendente'
        ).length;
        const itensEncontrados = items.filter(
          (item) => item.status_verificacao === 'encontrado'
        ).length;
        const itensNaoEncontrados = items.filter(
          (item) => item.status_verificacao === 'nao_encontrado'
        ).length;

        return {
          ...survey,
          total_itens: totalItens,
          itens_verificados: itensVerificados,
          itens_encontrados: itensEncontrados,
          itens_nao_encontrados: itensNaoEncontrados,
        };
      })
    );

    return surveysWithStats;
  }

  /**
   * Deletar pesquisa e seus itens
   */
  static async deleteSurvey(surveyId: number): Promise<void> {
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);
    const survey = await surveyRepository.findOne({ where: { id: surveyId } });

    if (!survey) {
      throw new Error('Pesquisa não encontrada');
    }

    await surveyRepository.remove(survey);
    console.log(`🗑️ Pesquisa ${surveyId} deletada`);
  }

  /**
   * Buscar resultados agregados de múltiplas pesquisas com filtros
   */
  static async getAgregatedResults(filters: {
    data_inicio: string;
    data_fim: string;
    produto?: string;
    fornecedor?: string;
    auditor?: string;
  }): Promise<any> {
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);

    // Buscar surveys no período
    const surveys = await surveyRepository
      .createQueryBuilder('survey')
      .where('survey.data_criacao >= :dataInicio', { dataInicio: filters.data_inicio })
      .andWhere('survey.data_criacao <= :dataFim', { dataFim: filters.data_fim + ' 23:59:59' })
      .getMany();

    const surveyIds = surveys.map(s => s.id);

    if (surveyIds.length === 0) {
      return {
        estatisticas: {
          total_itens_verificados: 0,
          total_encontrados: 0,
          total_rupturas: 0,
          taxa_ruptura: 0,
          perda_venda_periodo: 0,
          perda_lucro_periodo: 0,
        },
        itens_ruptura: [],
        fornecedores_ranking: [],
      };
    }

    // Query builder com filtros
    let query = itemRepository
      .createQueryBuilder('item')
      .where('item.survey_id IN (:...surveyIds)', { surveyIds });

    // Filtro de produto
    if (filters.produto && filters.produto !== 'todos') {
      query = query.andWhere('item.descricao = :produto', { produto: filters.produto });
    }

    // Filtro de fornecedor
    if (filters.fornecedor && filters.fornecedor !== 'todos') {
      query = query.andWhere('item.fornecedor = :fornecedor', { fornecedor: filters.fornecedor });
    }

    // Filtro de auditor
    if (filters.auditor && filters.auditor !== 'todos') {
      query = query.andWhere('item.verificado_por = :auditor', { auditor: filters.auditor });
    }

    const items = await query.getMany();

    // Calcular estatísticas
    const itensVerificados = items.filter((i: RuptureSurveyItem) => i.status_verificacao !== 'pendente');
    const itensEncontrados = items.filter((i: RuptureSurveyItem) => i.status_verificacao === 'encontrado');
    // IMPORTANTE: Considerar tanto 'nao_encontrado' quanto 'ruptura_estoque' como rupturas
    const itensRuptura = items.filter((i: RuptureSurveyItem) =>
      i.status_verificacao === 'nao_encontrado' || i.status_verificacao === 'ruptura_estoque'
    );

    // Contar rupturas por tipo
    const rupturasNaoEncontrado = items.filter((i: RuptureSurveyItem) => i.status_verificacao === 'nao_encontrado').length;
    const rupturasEmEstoque = items.filter((i: RuptureSurveyItem) => i.status_verificacao === 'ruptura_estoque').length;

    const totalItensVerificados = itensVerificados.length;
    const totalEncontrados = itensEncontrados.length;
    const totalRupturas = itensRuptura.length;
    const taxaRuptura = totalItensVerificados > 0 ? (totalRupturas / totalItensVerificados) * 100 : 0;

    // Calcular perdas do período (soma de todas as médias diárias)
    const perdaVendaPeriodo = itensRuptura.reduce((total: number, item: RuptureSurveyItem) => {
      return total + item.perda_venda_dia;
    }, 0);

    const perdaLucroPeriodo = itensRuptura.reduce((total: number, item: RuptureSurveyItem) => {
      return total + item.perda_lucro_dia;
    }, 0);

    // Agrupar rupturas por produto (contar ocorrências e incluir todos os dados)
    const rupturasPorProduto: { [key: string]: any } = {};

    itensRuptura.forEach((item: RuptureSurveyItem) => {
      const key = item.descricao;
      if (!rupturasPorProduto[key]) {
        rupturasPorProduto[key] = {
          descricao: item.descricao,
          fornecedor: item.fornecedor || 'Sem fornecedor',
          secao: item.secao || 'Sem seção',
          curva: item.curva || '-',
          estoque_atual: item.estoque_atual || 0,
          valor_venda: item.valor_venda || 0,
          venda_media_dia: item.venda_media_dia || 0,
          margem_lucro: item.margem_lucro || 0,
          tem_pedido: item.tem_pedido || null,
          status_verificacao: item.status_verificacao, // Adicionar status para filtro
          ocorrencias: 0,
          ocorrencias_nao_encontrado: 0,
          ocorrencias_em_estoque: 0,
          perda_total: 0,
        };
      }
      rupturasPorProduto[key].ocorrencias++;
      rupturasPorProduto[key].perda_total += item.perda_venda_dia;

      // Contar ocorrências por tipo
      if (item.status_verificacao === 'nao_encontrado') {
        rupturasPorProduto[key].ocorrencias_nao_encontrado++;
      } else if (item.status_verificacao === 'ruptura_estoque') {
        rupturasPorProduto[key].ocorrencias_em_estoque++;
      }
    });

    const produtosRanking = Object.values(rupturasPorProduto)
      .sort((a, b) => b.perda_total - a.perda_total);

    // Agrupar rupturas por fornecedor
    const rupturasPorFornecedor: { [key: string]: { count: number; perda: number } } = {};

    itensRuptura.forEach((item: RuptureSurveyItem) => {
      const fornecedor = item.fornecedor || 'Sem fornecedor';
      if (!rupturasPorFornecedor[fornecedor]) {
        rupturasPorFornecedor[fornecedor] = { count: 0, perda: 0 };
      }
      rupturasPorFornecedor[fornecedor].count++;
      rupturasPorFornecedor[fornecedor].perda += item.perda_venda_dia;
    });

    const fornecedoresRanking = Object.entries(rupturasPorFornecedor)
      .map(([fornecedor, stats]) => ({
        fornecedor,
        rupturas: stats.count,
        perda_total: stats.perda,
      }))
      .sort((a, b) => b.rupturas - a.rupturas);

    // Agrupar rupturas por seção (setor)
    const rupturasPorSecao: { [key: string]: { count: number; perda: number } } = {};

    itensRuptura.forEach((item: RuptureSurveyItem) => {
      const secao = item.secao || 'Sem seção';
      if (!rupturasPorSecao[secao]) {
        rupturasPorSecao[secao] = { count: 0, perda: 0 };
      }
      rupturasPorSecao[secao].count++;
      rupturasPorSecao[secao].perda += item.perda_venda_dia;
    });

    const secoesRanking = Object.entries(rupturasPorSecao)
      .map(([secao, stats]) => ({
        secao,
        rupturas: stats.count,
        perda_total: stats.perda,
      }))
      .sort((a, b) => b.rupturas - a.rupturas);

    return {
      estatisticas: {
        total_itens_verificados: totalItensVerificados,
        total_encontrados: totalEncontrados,
        total_rupturas: totalRupturas,
        rupturas_nao_encontrado: rupturasNaoEncontrado,
        rupturas_em_estoque: rupturasEmEstoque,
        taxa_ruptura: taxaRuptura,
        perda_venda_periodo: perdaVendaPeriodo,
        perda_lucro_periodo: perdaLucroPeriodo,
      },
      itens_ruptura: produtosRanking,
      fornecedores_ranking: fornecedoresRanking,
      secoes_ranking: secoesRanking,
    };
  }

  /**
   * Buscar produtos únicos para filtro
   */
  static async getUniqueProdutos(): Promise<string[]> {
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);
    const items = await itemRepository
      .createQueryBuilder('item')
      .select('DISTINCT item.descricao', 'descricao')
      .where('item.descricao IS NOT NULL')
      .getRawMany();

    return items.map((i: any) => i.descricao);
  }

  /**
   * Buscar fornecedores únicos para filtro
   */
  static async getUniqueFornecedores(): Promise<string[]> {
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);
    const items = await itemRepository
      .createQueryBuilder('item')
      .select('DISTINCT item.fornecedor', 'fornecedor')
      .where('item.fornecedor IS NOT NULL')
      .getRawMany();

    return items.map((i: any) => i.fornecedor);
  }

  /**
   * Finaliza auditoria, gera PDF e envia para WhatsApp
   */
  static async finalizeSurveyAndSendReport(surveyId: number): Promise<{ success: boolean; message: string }> {
    try {
      // Buscar auditoria com itens
      const survey = await this.getSurveyWithStats(surveyId);

      if (!survey) {
        throw new Error('Auditoria não encontrada');
      }

      // Filtrar itens de ruptura (nao_encontrado + ruptura_estoque)
      const itensRuptura = survey.items.filter(
        (item: RuptureSurveyItem) =>
          item.status_verificacao === 'nao_encontrado' ||
          item.status_verificacao === 'ruptura_estoque'
      );

      const naoEncontrado = survey.items.filter(
        (item: RuptureSurveyItem) => item.status_verificacao === 'nao_encontrado'
      ).length;

      const emEstoque = survey.items.filter(
        (item: RuptureSurveyItem) => item.status_verificacao === 'ruptura_estoque'
      ).length;

      // Calcular perda de venda e lucro
      let perdaVenda = 0;
      let perdaLucro = 0;

      itensRuptura.forEach((item: RuptureSurveyItem) => {
        const valorVenda = parseFloat(item.valor_venda as any) || 0;
        const margemLucro = parseFloat(item.margem_lucro as any) || 0;
        const vendaMediaDia = parseFloat(item.venda_media_dia as any) || 0;

        // Perda de venda = Valor de venda × Venda média/dia
        perdaVenda += valorVenda * vendaMediaDia;

        // Perda de lucro = Perda de venda × Margem de lucro
        perdaLucro += (valorVenda * vendaMediaDia) * (margemLucro / 100);
      });

      // Gerar PDF
      const pdfPath = await this.generateRupturePDF(survey, itensRuptura);

      // Enviar para WhatsApp
      const whatsappSuccess = await WhatsAppService.sendRuptureReport(
        pdfPath,
        survey.nome_pesquisa,
        itensRuptura.length,
        naoEncontrado,
        emEstoque,
        perdaVenda,
        perdaLucro
      );

      // Remover PDF temporário após envio
      try {
        fs.unlinkSync(pdfPath);
      } catch (err) {
        console.warn('⚠️  Não foi possível remover PDF temporário:', pdfPath);
      }

      // Sempre retornar sucesso - o envio para WhatsApp é opcional
      if (whatsappSuccess) {
        return {
          success: true,
          message: 'Relatório gerado e enviado para o WhatsApp com sucesso'
        };
      } else {
        return {
          success: true,
          message: 'Relatório gerado com sucesso (WhatsApp não disponível)'
        };
      }
    } catch (error: any) {
      console.error('❌ Erro ao finalizar auditoria e enviar relatório:', error);
      throw error;
    }
  }

  /**
   * Gera PDF do relatório de ruptura com tabelas formatadas
   */
  private static async generateRupturePDF(
    survey: any,
    itensRuptura: RuptureSurveyItem[]
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Criar diretório temporário se não existir
        const tempDir = path.join(__dirname, '../../uploads/temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const pdfPath = path.join(
          tempDir,
          `ruptura-${survey.id}-${Date.now()}.pdf`
        );

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const stream = fs.createWriteStream(pdfPath);

        doc.pipe(stream);

        // Separar por status
        const naoEncontrado = itensRuptura.filter(i => i.status_verificacao === 'nao_encontrado');
        const emEstoque = itensRuptura.filter(i => i.status_verificacao === 'ruptura_estoque');

        // Calcular perda total
        let perdaVendaTotal = 0;
        let perdaLucroTotal = 0;
        itensRuptura.forEach(item => {
          const valorVenda = parseFloat(item.valor_venda as any) || 0;
          const margemLucro = parseFloat(item.margem_lucro as any) || 0;
          const vendaMediaDia = parseFloat(item.venda_media_dia as any) || 0;
          perdaVendaTotal += valorVenda * vendaMediaDia;
          perdaLucroTotal += (valorVenda * vendaMediaDia) * (margemLucro / 100);
        });

        // Cabeçalho com fundo laranja forte
        const headerHeight = 45;
        doc.rect(0, 0, 842, headerHeight).fillAndStroke('#FF5500', '#FF5500');
        doc.fontSize(16).fillColor('#FFF').text('RELATORIO DE AUDITORIA DE RUPTURAS', 30, 15, { align: 'center' });
        doc.moveDown(2.5);

        // Calcular taxa de ruptura corretamente
        const taxaRuptura = survey.itens_verificados > 0
          ? (itensRuptura.length / survey.itens_verificados) * 100
          : 0;

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

        // Box do Resumo Geral - menor e mais compacto
        const boxY = doc.y + 8;
        doc.rect(30, boxY, 770, 90).fillAndStroke('#F8F9FA', '#FF5500');

        // Título do Resumo
        doc.fontSize(11).fillColor('#FF5500').text('RESUMO GERAL', 40, boxY + 8);

        // Informações do resumo em duas colunas
        const colLeft = 40;
        const colRight = 420;
        let lineY = boxY + 26;
        const lineHeight = 13;

        doc.fontSize(8.5).fillColor('#000');

        // Coluna esquerda
        doc.text(`Auditor: ${itensRuptura[0]?.verificado_por || 'N/A'}`, colLeft, lineY);
        lineY += lineHeight;
        doc.text(`Total de Itens Verificados: ${survey.itens_verificados}`, colLeft, lineY);
        lineY += lineHeight;
        doc.text(`Itens Encontrados: ${survey.itens_verificados - itensRuptura.length}`, colLeft, lineY);
        lineY += lineHeight;
        doc.text(`Total de Rupturas: ${itensRuptura.length} (${naoEncontrado.length} Nao Encontrado + ${emEstoque.length} Em Estoque)`, colLeft, lineY);

        // Coluna direita
        lineY = boxY + 26;
        doc.text(`Taxa de Ruptura: ${taxaRuptura.toFixed(1)}%`, colRight, lineY);
        lineY += lineHeight;
        doc.text(`Perda de Venda/Dia: R$ ${perdaVendaTotal.toFixed(2)}`, colRight, lineY);
        lineY += lineHeight;
        doc.text(`Perda de Lucro/Dia: R$ ${perdaLucroTotal.toFixed(2)}`, colRight, lineY);
        lineY += lineHeight;
        doc.text(`Data: ${brazilDate}`, colRight, lineY);

        doc.moveDown(8);

        // Função para desenhar tabela
        const drawTable = (title: string, items: RuptureSurveyItem[], startY: number) => {
          if (items.length === 0) return startY;

          // Título da seção
          doc.fontSize(12).fillColor('#000').text(title, 30, startY);
          startY += 20;

          // Definir colunas - adicionando Código de Barras e reordenando PEDIDO após PRODUTO
          const colX = [30, 50, 120, 260, 320, 360, 395, 445, 500, 560, 615, 670, 735];
          const colWidth = [20, 70, 140, 60, 40, 35, 50, 55, 60, 55, 55, 65, 75];
          const rowHeight = 18;

          // Cabeçalho da tabela (laranja forte)
          doc.rect(30, startY, 780, rowHeight).fillAndStroke('#FF6600', '#000');
          doc.fontSize(6).fillColor('#FFF');
          doc.text('#', colX[0] + 2, startY + 5, { width: colWidth[0], align: 'left' });
          doc.text('COD.BARRAS', colX[1] + 2, startY + 5, { width: colWidth[1], align: 'left' });
          doc.text('PRODUTO', colX[2] + 2, startY + 5, { width: colWidth[2], align: 'left' });
          doc.text('PEDIDO', colX[3] + 2, startY + 5, { width: colWidth[3], align: 'center' });
          doc.text('FORNECEDOR', colX[4] + 2, startY + 5, { width: colWidth[4], align: 'left' });
          doc.text('SEÇÃO', colX[5] + 2, startY + 5, { width: colWidth[5], align: 'left' });
          doc.text('CURVA', colX[6] + 2, startY + 5, { width: colWidth[6], align: 'center' });
          doc.text('ESTOQUE', colX[7] + 2, startY + 5, { width: colWidth[7], align: 'right' });
          doc.text('V.MÉD/DIA', colX[8] + 2, startY + 5, { width: colWidth[8], align: 'right' });
          doc.text('VL.VENDA', colX[9] + 2, startY + 5, { width: colWidth[9], align: 'right' });
          doc.text('MARGEM', colX[10] + 2, startY + 5, { width: colWidth[10], align: 'right' });
          doc.text('P.VENDA', colX[11] + 2, startY + 5, { width: colWidth[11], align: 'right' });
          doc.text('P.LUCRO', colX[12] + 2, startY + 5, { width: colWidth[12], align: 'right' });

          startY += rowHeight;

          // Linhas de dados (zebradas) - usar for loop para permitir break após recursão
          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            const bgColor = idx % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
            doc.rect(30, startY, 780, rowHeight).fillAndStroke(bgColor, '#DDD');
            doc.fontSize(5.5).fillColor('#000');

            // Parse values with proper defaults
            const estoque = parseFloat(item.estoque_atual as any) || 0;
            const vendaMedia = parseFloat(item.venda_media_dia as any) || 0;
            const valorVenda = parseFloat(item.valor_venda as any) || 0;
            const margem = parseFloat(item.margem_lucro as any) || 0;
            const perdaVenda = valorVenda * vendaMedia;
            const perdaLucro = perdaVenda * (margem / 100);

            doc.text(`${idx + 1}`, colX[0] + 2, startY + 5, { width: colWidth[0], align: 'left' });
            doc.text(item.codigo_barras?.substring(0, 13) || '-', colX[1] + 2, startY + 5, { width: colWidth[1], align: 'left' });
            doc.text(item.descricao?.substring(0, 35) || '', colX[2] + 2, startY + 5, { width: colWidth[2], align: 'left' });
            doc.text(item.tem_pedido || '-', colX[3] + 2, startY + 5, { width: colWidth[3], align: 'center' });
            doc.text(item.fornecedor?.substring(0, 10) || '-', colX[4] + 2, startY + 5, { width: colWidth[4], align: 'left' });
            doc.text(item.secao?.substring(0, 8) || '-', colX[5] + 2, startY + 5, { width: colWidth[5], align: 'left' });
            doc.text(item.curva || '-', colX[6] + 2, startY + 5, { width: colWidth[6], align: 'center' });
            doc.text(estoque.toFixed(0), colX[7] + 2, startY + 5, { width: colWidth[7], align: 'right' });
            doc.text(vendaMedia.toFixed(2), colX[8] + 2, startY + 5, { width: colWidth[8], align: 'right' });
            doc.text(`${valorVenda.toFixed(2)}`, colX[9] + 2, startY + 5, { width: colWidth[9], align: 'right' });
            doc.text(`${margem.toFixed(1)}%`, colX[10] + 2, startY + 5, { width: colWidth[10], align: 'right' });
            doc.text(`${perdaVenda.toFixed(2)}`, colX[11] + 2, startY + 5, { width: colWidth[11], align: 'right' });
            doc.text(`${perdaLucro.toFixed(2)}`, colX[12] + 2, startY + 5, { width: colWidth[12], align: 'right' });

            startY += rowHeight;

            // Nova página se necessário - usar break para parar o loop após recursão
            if (startY > 500 && idx < items.length - 1) {
              doc.addPage();
              startY = 30;
              drawTable(title, items.slice(idx + 1), startY);
              break; // ✅ CRITICAL: Para o loop para evitar duplicação
            }
          }

          return startY + 20;
        };

        // Desenhar tabelas separadas
        let currentY = doc.y;

        if (naoEncontrado.length > 0) {
          currentY = drawTable('RUPTURA - NÃO ENCONTRADO', naoEncontrado, currentY);
        }

        if (emEstoque.length > 0) {
          if (currentY > 400) {
            doc.addPage();
            currentY = 30;
          }
          currentY = drawTable('RUPTURA - EM ESTOQUE', emEstoque, currentY);
        }

        doc.end();

        stream.on('finish', () => {
          console.log(`✅ PDF gerado: ${pdfPath}`);
          resolve(pdfPath);
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
   * Excluir itens de ruptura por código do produto em um período
   */
  static async deleteByProductCode(
    codigo: string,
    dataInicio: string,
    dataFim: string
  ): Promise<number> {
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);

    // Buscar surveys no período (usando data_criacao que é o campo correto)
    const surveys = await surveyRepository
      .createQueryBuilder('survey')
      .where('DATE(survey.data_criacao) >= :dataInicio', { dataInicio })
      .andWhere('DATE(survey.data_criacao) <= :dataFim', { dataFim })
      .getMany();

    if (surveys.length === 0) {
      return 0;
    }

    const surveyIds = surveys.map(s => s.id);

    // Buscar e excluir itens com a descrição do produto nas surveys do período
    // Usamos descricao porque é o campo usado para agrupar produtos na agregação
    const result = await itemRepository
      .createQueryBuilder()
      .delete()
      .from(RuptureSurveyItem)
      .where('survey_id IN (:...surveyIds)', { surveyIds })
      .andWhere('descricao = :codigo', { codigo })
      .execute();

    // Recalcular totais de cada survey afetada
    for (const surveyId of surveyIds) {
      await this.recalculateSurveyTotals(surveyId);
    }

    return result.affected || 0;
  }

  /**
   * Recalcula os totais de uma survey baseado nos itens atuais
   */
  static async recalculateSurveyTotals(surveyId: number): Promise<void> {
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);

    // Buscar todos os itens da survey
    const items = await itemRepository.find({ where: { survey_id: surveyId } });

    // Calcular totais
    const total_itens = items.length;
    const itens_verificados = items.filter(i => i.status_verificacao !== 'pendente').length;
    const itens_encontrados = items.filter(i => i.status_verificacao === 'encontrado').length;
    const itens_nao_encontrados = items.filter(i =>
      i.status_verificacao === 'nao_encontrado' || i.status_verificacao === 'ruptura_estoque'
    ).length;

    // Atualizar survey
    await surveyRepository.update(surveyId, {
      total_itens,
      itens_verificados,
      itens_encontrados,
      itens_nao_encontrados
    });
  }
}
