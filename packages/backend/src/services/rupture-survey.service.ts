import { AppDataSource } from '../config/database';
import { RuptureSurvey } from '../entities/RuptureSurvey';
import { RuptureSurveyItem } from '../entities/RuptureSurveyItem';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import PDFDocument from 'pdfkit';
import { WhatsAppService } from './whatsapp.service';
import { ReportExcelService, ExcelSheet } from './report-excel.service';
import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

// Interface para dados de pedido do Oracle
interface PedidoInfo {
  status_pedido: string | null; // 'Pendente', 'Parcial', 'Completo'
  data_entrega: string | null;  // Data formatada dd/mm/yyyy
  dias_atraso: number | null;   // Dias em atraso (se > 0, está atrasado)
}

export class RuptureSurveyService {
  /**
   * Busca informações de pedido do Oracle para um produto
   * @param codigoProduto Código do produto no ERP
   * @returns Informações do pedido (status e data de entrega)
   */
  static async getPedidoInfoFromOracle(codigoProduto: string, codLoja?: number): Promise<PedidoInfo | null> {
    try {
      const schema = await MappingService.getSchema();
      const tabPedidoProduto = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO_PRODUTO')}`;
      const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;

      // Resolver colunas via MappingService
      const colNumPedido = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido');
      const colDtaEntrega = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_entrega');
      const colTipoReceb = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_recebimento');
      const colTipoFinaliz = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_finalizado');
      const colFlgCancel = await MappingService.getColumnFromTable('TAB_PEDIDO', 'flag_cancelado');
      const colTipoParceiro = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_parceiro');
      const colDtaEmissao = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_emissao');
      const colCodLojaPed = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_loja');
      const colCodProdutoPp = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'codigo_produto');
      const colNumPedidoPp = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'numero_pedido');

      const lojaFilter = codLoja ? `AND p.${colCodLojaPed} = :codLoja` : '';
      const params: any = { codigoProduto };
      if (codLoja) params.codLoja = codLoja;

      const result = await OracleService.query<any>(`
        SELECT
          p.${colNumPedido},
          p.${colDtaEntrega},
          p.${colTipoReceb},
          p.${colTipoFinaliz},
          p.${colFlgCancel}
        FROM ${tabPedidoProduto} pp
        JOIN ${tabPedido} p ON p.${colNumPedido} = pp.${colNumPedidoPp}
        WHERE pp.${colCodProdutoPp} = :codigoProduto
        AND p.${colTipoParceiro} = 1
        AND (p.${colFlgCancel} IS NULL OR p.${colFlgCancel} = 'N')
        AND p.${colTipoFinaliz} != 2
        ${lojaFilter}
        ORDER BY p.${colDtaEmissao} DESC
      `, params);

      if (result.length === 0) {
        return null;
      }

      // Pega o pedido mais recente
      const pedido = result[0];

      // Determina status do pedido
      let status_pedido: string | null = null;
      if (pedido.TIPO_PED_FINALIZADO === 1) {
        status_pedido = 'Completo';
      } else if (pedido.TIPO_RECEBIMENTO === 1) {
        status_pedido = 'Parcial';
      } else if (pedido.TIPO_RECEBIMENTO === 0 || pedido.TIPO_PED_FINALIZADO === -1) {
        status_pedido = 'Pendente';
      }

      // Formata data de entrega e calcula atraso
      let data_entrega: string | null = null;
      let dias_atraso: number | null = null;
      if (pedido.DTA_ENTREGA) {
        const dtEntrega = new Date(pedido.DTA_ENTREGA);
        data_entrega = dtEntrega.toLocaleDateString('pt-BR');

        // Calcula dias em atraso (só se o pedido não estiver completo)
        if (status_pedido !== 'Completo') {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          dtEntrega.setHours(0, 0, 0, 0);
          const diffTime = hoje.getTime() - dtEntrega.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          dias_atraso = diffDays > 0 ? diffDays : null;
        }
      }

      return { status_pedido, data_entrega, dias_atraso };
    } catch (error: any) {
      console.error(`⚠️ Erro ao buscar pedido do Oracle para produto ${codigoProduto}:`, error.message);
      return null;
    }
  }

  /**
   * Busca informações de pedido do Oracle para múltiplos produtos de uma vez
   * @param codigosProdutos Array de códigos de produtos
   * @returns Map com código do produto -> PedidoInfo
   */
  static async getPedidosInfoFromOracle(codigosProdutos: string[], codLoja?: number): Promise<Map<string, PedidoInfo>> {
    const pedidosMap = new Map<string, PedidoInfo>();

    if (codigosProdutos.length === 0) return pedidosMap;

    try {
      // Busca todos os pedidos pendentes/parciais para os produtos
      const placeholders = codigosProdutos.map((_, i) => `:p${i}`).join(',');
      const params: any = {};
      codigosProdutos.forEach((cod, i) => {
        params[`p${i}`] = cod;
      });

      // Busca APENAS pedidos EM ABERTO (não finalizados, não cancelados)
      // TIPO_PED_FINALIZADO = -1 significa "Em Aberto"
      // TIPO_RECEBIMENTO < 2 significa "Pendente (0) ou Parcial (1)", não "Recebido (2)"
      const schema = await MappingService.getSchema();
      const tabPedidoProduto = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO_PRODUTO')}`;
      const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;

      // Resolver colunas via MappingService
      const colCodProdutoPp = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'codigo_produto');
      const colNumPedidoPp = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'numero_pedido');
      const colNumPedido = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido');
      const colDtaEntrega = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_entrega');
      const colTipoReceb = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_recebimento');
      const colTipoFinaliz = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_finalizado');
      const colFlgCancel = await MappingService.getColumnFromTable('TAB_PEDIDO', 'flag_cancelado');
      const colTipoParceiro = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_parceiro');
      const colDtaEmissao = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_emissao');
      const colCodLojaPed = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_loja');

      const lojaFilter = codLoja ? `AND p.${colCodLojaPed} = :codLoja` : '';
      if (codLoja) params.codLoja = codLoja;

      const result = await OracleService.query<any>(`
        SELECT
          pp.${colCodProdutoPp},
          p.${colNumPedido},
          p.${colDtaEntrega},
          p.${colTipoReceb},
          p.${colTipoFinaliz}
        FROM ${tabPedidoProduto} pp
        JOIN ${tabPedido} p ON p.${colNumPedido} = pp.${colNumPedidoPp}
        WHERE pp.${colCodProdutoPp} IN (${placeholders})
        AND p.${colTipoParceiro} = 1
        AND (p.${colFlgCancel} IS NULL OR p.${colFlgCancel} = 'N')
        AND p.${colTipoFinaliz} = -1
        AND p.${colTipoReceb} < 2
        ${lojaFilter}
        ORDER BY pp.${colCodProdutoPp}, p.${colDtaEmissao} DESC
      `, params);

      // Agrupa por produto (pega o mais recente de cada)
      const pedidosPorProduto = new Map<string, any>();
      for (const row of result) {
        const cod = String(row.COD_PRODUTO);
        if (!pedidosPorProduto.has(cod)) {
          pedidosPorProduto.set(cod, row);
        }
      }

      // Converte para o formato esperado
      for (const [cod, pedido] of pedidosPorProduto) {
        let status_pedido: string | null = null;
        if (pedido.TIPO_PED_FINALIZADO === 1) {
          status_pedido = 'Completo';
        } else if (pedido.TIPO_RECEBIMENTO === 1) {
          status_pedido = 'Parcial';
        } else if (pedido.TIPO_RECEBIMENTO === 0 || pedido.TIPO_PED_FINALIZADO === -1) {
          status_pedido = 'Pendente';
        }

        let data_entrega: string | null = null;
        let dias_atraso: number | null = null;
        if (pedido.DTA_ENTREGA) {
          const dtEntrega = new Date(pedido.DTA_ENTREGA);
          data_entrega = dtEntrega.toLocaleDateString('pt-BR');

          // Calcula dias em atraso (só se o pedido não estiver completo)
          if (status_pedido !== 'Completo') {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            dtEntrega.setHours(0, 0, 0, 0);
            const diffTime = hoje.getTime() - dtEntrega.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            dias_atraso = diffDays > 0 ? diffDays : null;
          }
        }

        pedidosMap.set(cod, { status_pedido, data_entrega, dias_atraso });
      }

      console.log(`📦 Buscados dados de pedido para ${pedidosMap.size} produtos do Oracle`);
    } catch (error: any) {
      console.error('⚠️ Erro ao buscar pedidos do Oracle em lote:', error.message);
    }

    return pedidosMap;
  }

  /**
   * Processa arquivo CSV/Excel e cria pesquisa de ruptura
   */
  static async createSurveyFromFile(
    filePath: string,
    nomePesquisa: string,
    userId: string,
    codLoja?: number
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
        cod_loja: codLoja || null,
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

        // Buscar código do produto - pode estar em várias colunas
        const codigoProduto = row['Código'] || row['C�digo'] || row['Codigo'] ||
                              row['Cod_Produto'] || row['COD_PRODUTO'] || row['Código Produto'] ||
                              row['codigo'] || row['cod'] || row['CodProduto'] || row['CODIGO'] ||
                              row['Cód'] || row['C�d'] || row['Cd Produto'] || row['CD_PRODUTO'] ||
                              row['Codigo Produto'] || row['CodigoProduto'] || row['ID'] || null;

        // Buscar código de barras
        const codigoBarras = row['Código Barras'] || row['C�digo Barras'] || row['Codigo Barras'] ||
                             row['EAN'] || row['ean'] || row['GTIN'] || row['gtin'] ||
                             row['CodBarras'] || row['COD_BARRAS'] || null;

        // Usar código de barras como fallback se não tiver código de produto
        const codigoFinal = codigoProduto || codigoBarras || null;

        const item = itemRepository.create({
          survey_id: survey.id,
          codigo_barras: codigoBarras,
          erp_product_id: codigoFinal ? String(codigoFinal) : null,
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
          status_pedido: row['Status Pedido'] || row['STATUS_PEDIDO'] || null,
          data_entrega: row['Data Entrega'] || row['DTA_ENTREGA'] || row['Dt. Entrega'] || null,
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
   * Cria pesquisa a partir de itens já carregados (Direto Sistema)
   */
  static async createSurveyFromItems(
    nomePesquisa: string,
    items: any[],
    userId: string,
    codLoja?: number
  ): Promise<RuptureSurvey> {
    try {
      console.log(`📊 Criando pesquisa com ${items.length} itens do sistema`);

      // Criar pesquisa
      const surveyRepository = AppDataSource.getRepository(RuptureSurvey);
      const survey = surveyRepository.create({
        nome_pesquisa: nomePesquisa,
        user_id: userId,
        total_itens: items.length,
        status: 'rascunho',
        cod_loja: codLoja || null,
      });

      await surveyRepository.save(survey);
      console.log(`✅ Pesquisa criada: ID ${survey.id}`);

      // Criar itens
      const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);
      const surveyItems: RuptureSurveyItem[] = [];

      for (const item of items) {
        // Usar codigo como fallback se erp_product_id não existir
        const codigoFinal = item.erp_product_id || item.codigo || item.ean || item.codigo_barras || null;

        const surveyItem = itemRepository.create({
          survey_id: survey.id,
          codigo_barras: item.codigo_barras || item.ean || null,
          erp_product_id: codigoFinal ? String(codigoFinal) : null,
          descricao: item.descricao || '',
          curva: item.curva || null,
          estoque_atual: item.estoque_atual || null,
          cobertura_dias: item.cobertura_dias || null,
          grupo: item.grupo || null,
          secao: item.secao || null,
          subgrupo: item.subgrupo || null,
          fornecedor: item.fornecedor || null,
          margem_lucro: item.margem_lucro != null ? Number(item.margem_lucro) : null,
          qtd_embalagem: item.qtd_embalagem || null,
          valor_venda: item.valor_venda != null ? Number(item.valor_venda) : null,
          custo_com_imposto: item.custo_com_imposto != null ? Number(item.custo_com_imposto) : null,
          venda_media_dia: item.venda_media_dia != null ? Number(item.venda_media_dia) : null,
          tem_pedido: item.tem_pedido || null,
          status_pedido: item.status_pedido || null,
          data_entrega: item.data_entrega || null,
          status_verificacao: 'pendente',
        });

        surveyItems.push(surveyItem);
      }

      // Debug: log primeiro item para verificar valores
      if (items.length > 0) {
        const first = items[0];
        console.log(`🔍 [DEBUG] Primeiro item recebido: valor_venda=${first.valor_venda}, venda_media_dia=${first.venda_media_dia}, margem_lucro=${first.margem_lucro}`);
        const firstSaved = surveyItems[0];
        console.log(`🔍 [DEBUG] Primeiro item salvo: valor_venda=${firstSaved.valor_venda}, venda_media_dia=${firstSaved.venda_media_dia}, margem_lucro=${firstSaved.margem_lucro}`);
      }

      await itemRepository.save(surveyItems);
      console.log(`✅ ${surveyItems.length} itens criados`);

      return survey;
    } catch (error: any) {
      console.error('❌ Erro ao criar pesquisa a partir dos itens:', error.message);
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
  static async getAllSurveys(codLoja?: number): Promise<any[]> {
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);

    const whereCondition: any = {};
    if (codLoja) {
      whereCondition.cod_loja = codLoja;
    }

    const surveys = await surveyRepository.find({
      where: whereCondition,
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
          codigo: item.erp_product_id || item.codigo_barras || null, // Código do produto (ERP ou barras como fallback)
          codigo_barras: item.codigo_barras || null,
          descricao: item.descricao,
          fornecedor: item.fornecedor || 'Sem fornecedor',
          secao: item.secao || 'Sem seção',
          curva: item.curva || '-',
          estoque_atual: item.estoque_atual || 0,
          valor_venda: item.valor_venda || 0,
          venda_media_dia: item.venda_media_dia || 0,
          margem_lucro: item.margem_lucro || 0,
          tem_pedido: item.tem_pedido || null,
          status_pedido: item.status_pedido || null, // Status do pedido (Pendente/Parcial)
          data_entrega: item.data_entrega || null, // Data prevista de entrega
          status_verificacao: item.status_verificacao, // Adicionar status para filtro
          ocorrencias: 0,
          ocorrencias_nao_encontrado: 0,
          ocorrencias_em_estoque: 0,
          perda_total: 0,
          datas_ocorrencias: [], // Lista de datas das ocorrências
        };
      }
      rupturasPorProduto[key].ocorrencias++;
      rupturasPorProduto[key].perda_total += item.perda_venda_dia;

      // Adicionar data da ocorrência
      const dataOcorrencia = item.data_verificacao || item.created_at;
      if (dataOcorrencia) {
        const dataFormatada = new Date(dataOcorrencia).toLocaleDateString('pt-BR');
        // Adicionar com detalhes da ocorrência
        rupturasPorProduto[key].datas_ocorrencias.push({
          data: dataFormatada,
          status: item.status_verificacao === 'nao_encontrado' ? 'Não Encontrado' : 'Em Estoque',
          verificado_por: item.verificado_por || 'N/A',
          perda_dia: item.perda_venda_dia || 0,
        });
      }

      // Contar ocorrências por tipo
      if (item.status_verificacao === 'nao_encontrado') {
        rupturasPorProduto[key].ocorrencias_nao_encontrado++;
      } else if (item.status_verificacao === 'ruptura_estoque') {
        rupturasPorProduto[key].ocorrencias_em_estoque++;
      }
    });

    let produtosRanking = Object.values(rupturasPorProduto)
      .sort((a, b) => b.perda_total - a.perda_total);

    // Enriquecer com dados de pedido do Oracle para TODOS os produtos (busca em tempo real)
    try {
      // Buscar códigos de TODOS os produtos com código válido
      const codigosProdutos = produtosRanking
        .map((p: any) => p.codigo)
        .filter((cod: string | null) => cod !== null && cod !== '') as string[];

      if (codigosProdutos.length > 0) {
        console.log(`🔍 Buscando pedidos no Oracle para ${codigosProdutos.length} produtos...`);
        const pedidosInfo = await this.getPedidosInfoFromOracle(codigosProdutos);

        // Atualiza os produtos com as informações do Oracle (tempo real)
        // IMPORTANTE: Ignora completamente o tem_pedido da auditoria - usa APENAS dados atuais do Oracle
        produtosRanking = produtosRanking.map((produto: any) => {
          if (produto.codigo && pedidosInfo.has(produto.codigo)) {
            const info = pedidosInfo.get(produto.codigo);
            return {
              ...produto,
              tem_pedido: 'Sim', // Tem pedido ativo no Oracle AGORA
              status_pedido: info?.status_pedido || null,
              data_entrega: info?.data_entrega || null,
              dias_atraso: info?.dias_atraso || null
            };
          }
          // Produto não tem pedido ativo no Oracle atualmente
          return {
            ...produto,
            tem_pedido: 'Não', // NÃO tem pedido no Oracle AGORA (independente do que foi registrado na auditoria)
            status_pedido: null,
            data_entrega: null,
            dias_atraso: null
          };
        });

        console.log(`✅ Enriquecidos ${pedidosInfo.size} produtos com dados de pedido do Oracle`);
      }
    } catch (oracleError: any) {
      console.error('⚠️ Erro ao enriquecer com dados do Oracle (continuando sem):', oracleError.message);
    }

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
      .sort((a, b) => b.perda_total - a.perda_total); // Ordenar por maior perda

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
      .sort((a, b) => b.perda_total - a.perda_total); // Ordenar por maior perda

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
   * Calcula rupturas automaticamente a partir das tabelas Oracle
   * Identifica produtos com estoque zerado, dias de ruptura, venda e lucro perdidos
   */
  static async getAutomaticRuptureResults(filters: {
    data_inicio: string;
    data_fim: string;
    codLoja?: string;
    considerarProducao?: boolean;
  }): Promise<any> {
    const schema = await MappingService.getSchema();

    // --- Resolver tabelas ---
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
    const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

    // --- Resolver colunas TAB_PRODUTO ---
    const prCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const prDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const prCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
    const prCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const prTipoEvento = await MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_evento');

    // --- Resolver colunas TAB_PRODUTO_LOJA ---
    const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const plCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const plEstoqueAtual = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
    const plPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    const plMargem = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem');
    const plVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media');
    const plDtaUltVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_venda');
    const plCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');
    const plCodFornUlt = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra');
    const plForaLinha = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'fora_linha');

    // --- Resolver colunas TAB_NF ---
    const nfNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
    const nfSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
    const nfDtaEntrada = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada');
    const nfCodParceiro = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');
    const nfTipoOperacao = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao');

    // --- Resolver colunas TAB_NF_ITEM ---
    const niNumNf = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
    const niSerieNf = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
    const niCodParceiro = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
    const niCodItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_item');

    // --- Resolver colunas TAB_SECAO ---
    const secCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const secDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

    // --- Resolver colunas TAB_FORNECEDOR ---
    const fornCodForn = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
    const fornDesRazao = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');

    // Determinar codLoja (usar 1 como default se nao informado)
    const codLoja = filters.codLoja || '1';

    // Filtro de produção: tipo_evento = 3 é "Produção"
    const filtroProducao = filters.considerarProducao ? '' : `AND NVL(p.${prTipoEvento}, 0) != 3`;

    // --- Query 1: Produtos com estoque zero e historico de venda ---
    console.log('🔍 Buscando produtos com estoque zero no Oracle...', { considerarProducao: filters.considerarProducao });
    const produtosZero = await OracleService.query<any>(`
      SELECT
        p.${prCodProduto} AS COD_PRODUTO,
        p.${prDesProduto} AS DESCRICAO,
        p.${prCodBarras} AS CODIGO_BARRAS,
        s.${secDesSecao} AS SECAO,
        f.${fornDesRazao} AS FORNECEDOR,
        NVL(TRIM(pl.${plCurva}), 'X') AS CURVA,
        NVL(pl.${plEstoqueAtual}, 0) AS ESTOQUE_ATUAL,
        NVL(pl.${plPrecoVenda}, 0) AS VALOR_VENDA,
        NVL(pl.${plMargem}, 0) AS MARGEM,
        NVL(pl.${plVendaMedia}, 0) AS VENDA_MEDIA,
        pl.${plDtaUltVenda} AS DTA_ULT_VENDA
      FROM ${tabProduto} p
      INNER JOIN ${tabProdutoLoja} pl ON p.${prCodProduto} = pl.${plCodProduto}
      LEFT JOIN ${tabSecao} s ON p.${prCodSecao} = s.${secCodSecao}
      LEFT JOIN ${tabFornecedor} f ON pl.${plCodFornUlt} = f.${fornCodForn}
      WHERE pl.${plCodLoja} = :codLoja
      AND NVL(pl.${plForaLinha}, 'N') = 'N'
      AND NVL(pl.${plEstoqueAtual}, 0) = 0
      AND NVL(pl.${plVendaMedia}, 0) > 0
      AND pl.${plDtaUltVenda} >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
      AND pl.${plDtaUltVenda} <= TO_DATE(:dataFim, 'YYYY-MM-DD')
      ${filtroProducao}
      ORDER BY NVL(pl.${plVendaMedia}, 0) * NVL(pl.${plPrecoVenda}, 0) DESC
    `, {
      codLoja,
      dataInicio: filters.data_inicio,
      dataFim: filters.data_fim,
    });

    console.log(`📦 Encontrados ${produtosZero.length} produtos com estoque zero`);

    if (produtosZero.length === 0) {
      return {
        estatisticas: {
          total_itens_verificados: 0,
          total_encontrados: 0,
          total_rupturas: 0,
          rupturas_nao_encontrado: 0,
          rupturas_em_estoque: 0,
          taxa_ruptura: 0,
          perda_venda_periodo: 0,
          perda_lucro_periodo: 0,
        },
        itens_ruptura: [],
        fornecedores_ranking: [],
        secoes_ranking: [],
      };
    }

    // --- Query 2: Buscar datas de reposicao (proxima NF de entrada) ---
    const codProdutos = produtosZero.map((p: any) => String(p.COD_PRODUTO));
    const reposicaoMap = new Map<string, Date>();

    // Processar em lotes de 500 para evitar limite de Oracle IN clause
    const BATCH_SIZE = 500;
    for (let i = 0; i < codProdutos.length; i += BATCH_SIZE) {
      const batch = codProdutos.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map((_: string, idx: number) => `:p${i + idx}`).join(',');
      const params: any = {};
      batch.forEach((cod: string, idx: number) => {
        params[`p${i + idx}`] = cod;
      });

      const reposicoes = await OracleService.query<any>(`
        SELECT
          ni.${niCodItem} AS COD_PRODUTO,
          MIN(nf.${nfDtaEntrada}) AS DATA_REPOSICAO
        FROM ${tabNf} nf
        INNER JOIN ${tabNfItem} ni ON nf.${nfNumNf} = ni.${niNumNf}
          AND nf.${nfSerieNf} = ni.${niSerieNf}
          AND nf.${nfCodParceiro} = ni.${niCodParceiro}
        WHERE nf.${nfTipoOperacao} = 1
        AND nf.${nfDtaEntrada} >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
        AND nf.${nfDtaEntrada} <= TO_DATE(:dataFimPlus, 'YYYY-MM-DD')
        AND ni.${niCodItem} IN (${placeholders})
        GROUP BY ni.${niCodItem}
      `, {
        ...params,
        dataInicio: filters.data_inicio,
        dataFimPlus: filters.data_fim,
      });

      for (const row of reposicoes) {
        if (row.DATA_REPOSICAO) {
          reposicaoMap.set(String(row.COD_PRODUTO), new Date(row.DATA_REPOSICAO));
        }
      }
    }

    console.log(`📦 Encontradas ${reposicaoMap.size} reposições para os produtos`);

    // --- Calcular rupturas ---
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataFimDate = new Date(filters.data_fim + 'T23:59:59');

    let perdaVendaPeriodo = 0;
    let perdaLucroPeriodo = 0;
    const itensRuptura: any[] = [];

    for (const prod of produtosZero) {
      const codProduto = String(prod.COD_PRODUTO);
      const dtaUltVenda = prod.DTA_ULT_VENDA ? new Date(prod.DTA_ULT_VENDA) : null;

      if (!dtaUltVenda) continue;
      dtaUltVenda.setHours(0, 0, 0, 0);

      const dataReposicao = reposicaoMap.get(codProduto);
      let diasRuptura: number;
      let dataReposStr: string | null = null;

      if (dataReposicao) {
        // Produto foi reposto - calcular dias entre ultima venda e reposicao
        const dtRepos = new Date(dataReposicao);
        dtRepos.setHours(0, 0, 0, 0);
        diasRuptura = Math.max(0, Math.ceil((dtRepos.getTime() - dtaUltVenda.getTime()) / (1000 * 60 * 60 * 24)));
        dataReposStr = dtRepos.toLocaleDateString('pt-BR');
      } else {
        // Produto ainda sem reposicao - calcular ate hoje ou fim do periodo
        const dataRef = dataFimDate < hoje ? dataFimDate : hoje;
        diasRuptura = Math.max(0, Math.ceil((dataRef.getTime() - dtaUltVenda.getTime()) / (1000 * 60 * 60 * 24)));
      }

      if (diasRuptura <= 0) continue;

      const vendaMedia = Number(prod.VENDA_MEDIA) || 0;
      const valorVenda = Number(prod.VALOR_VENDA) || 0;
      const margem = Number(prod.MARGEM) || 0;

      const perdaVenda = vendaMedia * valorVenda * diasRuptura;
      const perdaLucro = perdaVenda * (margem / 100);

      perdaVendaPeriodo += perdaVenda;
      perdaLucroPeriodo += perdaLucro;

      itensRuptura.push({
        codigo: codProduto,
        codigo_barras: prod.CODIGO_BARRAS || null,
        descricao: prod.DESCRICAO || 'Sem descrição',
        fornecedor: prod.FORNECEDOR || 'Sem fornecedor',
        secao: prod.SECAO || 'Sem seção',
        curva: prod.CURVA || '-',
        estoque_atual: Number(prod.ESTOQUE_ATUAL) || 0,
        valor_venda: valorVenda,
        venda_media_dia: vendaMedia,
        margem_lucro: margem,
        tem_pedido: null,
        status_pedido: null,
        data_entrega: null,
        dias_atraso: null,
        status_verificacao: 'nao_encontrado',
        ocorrencias: 1,
        ocorrencias_nao_encontrado: 1,
        ocorrencias_em_estoque: 0,
        perda_total: perdaVenda,
        perda_lucro: perdaLucro,
        dias_ruptura: diasRuptura,
        data_zerou: dtaUltVenda.toLocaleDateString('pt-BR'),
        data_reposicao: dataReposStr,
        datas_ocorrencias: [],
      });
    }

    // Ordenar por maior perda
    itensRuptura.sort((a, b) => b.perda_total - a.perda_total);

    // --- Enriquecer com dados de pedido (reutilizar metodo existente) ---
    try {
      const codigosProdutos = itensRuptura
        .map((p: any) => p.codigo)
        .filter((cod: string | null) => cod !== null && cod !== '') as string[];

      if (codigosProdutos.length > 0) {
        console.log(`🔍 Buscando pedidos no Oracle para ${codigosProdutos.length} produtos...`);
        const pedidosInfo = await this.getPedidosInfoFromOracle(codigosProdutos);

        for (const item of itensRuptura) {
          if (item.codigo && pedidosInfo.has(item.codigo)) {
            const info = pedidosInfo.get(item.codigo);
            item.tem_pedido = 'Sim';
            item.status_pedido = info?.status_pedido || null;
            item.data_entrega = info?.data_entrega || null;
            item.dias_atraso = info?.dias_atraso || null;
          } else {
            item.tem_pedido = 'Não';
          }
        }
        console.log(`✅ Enriquecidos ${pedidosInfo.size} produtos com dados de pedido`);
      }
    } catch (oracleError: any) {
      console.error('⚠️ Erro ao enriquecer com dados do Oracle:', oracleError.message);
    }

    // --- Agregar rankings ---
    const rupturasPorFornecedor: { [key: string]: { count: number; perda: number } } = {};
    const rupturasPorSecao: { [key: string]: { count: number; perda: number } } = {};

    for (const item of itensRuptura) {
      const forn = item.fornecedor;
      if (!rupturasPorFornecedor[forn]) rupturasPorFornecedor[forn] = { count: 0, perda: 0 };
      rupturasPorFornecedor[forn].count++;
      rupturasPorFornecedor[forn].perda += item.perda_total;

      const sec = item.secao;
      if (!rupturasPorSecao[sec]) rupturasPorSecao[sec] = { count: 0, perda: 0 };
      rupturasPorSecao[sec].count++;
      rupturasPorSecao[sec].perda += item.perda_total;
    }

    const fornecedoresRanking = Object.entries(rupturasPorFornecedor)
      .map(([fornecedor, stats]) => ({ fornecedor, rupturas: stats.count, perda_total: stats.perda }))
      .sort((a, b) => b.perda_total - a.perda_total);

    const secoesRanking = Object.entries(rupturasPorSecao)
      .map(([secao, stats]) => ({ secao, rupturas: stats.count, perda_total: stats.perda }))
      .sort((a, b) => b.perda_total - a.perda_total);

    const totalRupturas = itensRuptura.length;
    const comReposicao = itensRuptura.filter(i => i.data_reposicao !== null).length;
    const semReposicao = totalRupturas - comReposicao;

    return {
      estatisticas: {
        total_itens_verificados: totalRupturas,
        total_encontrados: comReposicao,
        total_rupturas: totalRupturas,
        rupturas_nao_encontrado: semReposicao,
        rupturas_em_estoque: comReposicao,
        taxa_ruptura: 100,
        perda_venda_periodo: perdaVendaPeriodo,
        perda_lucro_periodo: perdaLucroPeriodo,
      },
      itens_ruptura: itensRuptura,
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

      // Gerar planilha com as MESMAS colunas do PDF.
      // Se a planilha falhar, o PDF vai sozinho — nao pode travar a auditoria.
      let excel: { buffer: Buffer; fileName: string } | undefined;
      try {
        excel = await this.generateRuptureExcel(
          survey,
          itensRuptura,
          naoEncontrado,
          emEstoque,
          perdaVenda,
          perdaLucro
        );
      } catch (err) {
        console.error('⚠️  Falha ao gerar a planilha (segue so o PDF):', err);
      }

      // Enviar para WhatsApp
      const whatsappSuccess = await WhatsAppService.sendRuptureReport(
        pdfPath,
        survey.nome_pesquisa,
        itensRuptura.length,
        naoEncontrado,
        emEstoque,
        perdaVenda,
        perdaLucro,
        excel
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
   * Gera a planilha (.xlsx) do relatorio de ruptura.
   *
   * Espelha as 13 colunas do PDF + STATUS. O STATUS existe porque o PDF separa
   * em duas tabelas ("Nao Encontrado" e "Em Estoque") — numa planilha unica
   * essa informacao se perderia, e uma aba por status impediria filtrar tudo
   * junto. Coluna com filtro resolve os dois casos.
   *
   * Diferenca proposital do PDF: aqui os textos NAO sao truncados. O PDF corta
   * descricao em 35 e fornecedor em 10 caracteres por falta de espaco; a
   * planilha nao tem essa limitacao e cortar atrapalharia procv/filtro.
   */
  private static async generateRuptureExcel(
    survey: any,
    itensRuptura: RuptureSurveyItem[],
    naoEncontrado: number,
    emEstoque: number,
    perdaVenda: number,
    perdaLucro: number
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const linhas = itensRuptura.map((item, idx) => {
      const estoque = parseFloat(item.estoque_atual as any) || 0;
      const vendaMedia = parseFloat(item.venda_media_dia as any) || 0;
      const valorVenda = parseFloat(item.valor_venda as any) || 0;
      const margem = parseFloat(item.margem_lucro as any) || 0;
      const pVenda = valorVenda * vendaMedia;
      const pLucro = pVenda * (margem / 100);

      return {
        num: idx + 1,
        status: item.status_verificacao === 'nao_encontrado' ? 'Nao Encontrado' : 'Em Estoque',
        codigo_barras: item.codigo_barras || '-',
        produto: item.descricao || '',
        pedido: item.tem_pedido || '-',
        fornecedor: item.fornecedor || '-',
        secao: item.secao || '-',
        curva: item.curva || '-',
        estoque,
        venda_media: vendaMedia,
        valor_venda: valorVenda,
        margem,
        perda_venda: pVenda,
        perda_lucro: pLucro,
      };
    });

    const sheet: ExcelSheet = {
      nome: 'Rupturas',
      columns: [
        { header: '#',            key: 'num',           width: 6,  tipo: 'inteiro' },
        { header: 'STATUS',       key: 'status',        width: 16 },
        { header: 'COD.BARRAS',   key: 'codigo_barras', width: 16 },
        { header: 'PRODUTO',      key: 'produto',       width: 42 },
        { header: 'PEDIDO',       key: 'pedido',        width: 12 },
        { header: 'FORNECEDOR',   key: 'fornecedor',    width: 24 },
        { header: 'SEÇÃO',        key: 'secao',         width: 16 },
        { header: 'CURVA',        key: 'curva',         width: 9 },
        { header: 'ESTOQUE',      key: 'estoque',       width: 11, tipo: 'decimal' },
        { header: 'V.MÉD/DIA',    key: 'venda_media',   width: 12, tipo: 'decimal' },
        { header: 'VL.VENDA',     key: 'valor_venda',   width: 13, tipo: 'dinheiro' },
        { header: 'MARGEM',       key: 'margem',        width: 11, tipo: 'percentual' },
        { header: 'P.VENDA',      key: 'perda_venda',   width: 14, tipo: 'dinheiro', somar: true },
        { header: 'P.LUCRO',      key: 'perda_lucro',   width: 14, tipo: 'dinheiro', somar: true },
      ],
      rows: linhas,
    };

    const taxaRuptura = survey.itens_verificados > 0
      ? (itensRuptura.length / survey.itens_verificados) * 100
      : 0;

    const brazilDate = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const buffer = await ReportExcelService.gerar([sheet], {
      titulo: 'RELATORIO DE AUDITORIA DE RUPTURAS',
      linhas: [
        { campo: 'Auditoria',                 valor: survey.nome_pesquisa || '-' },
        { campo: 'Auditor',                   valor: itensRuptura[0]?.verificado_por || 'N/A' },
        { campo: 'Data',                      valor: brazilDate },
        { campo: 'Total de Itens Verificados', valor: survey.itens_verificados ?? 0 },
        { campo: 'Itens Encontrados',         valor: (survey.itens_verificados ?? 0) - itensRuptura.length },
        { campo: 'Total de Rupturas',         valor: itensRuptura.length },
        { campo: '   Nao Encontrado',         valor: naoEncontrado },
        { campo: '   Em Estoque',             valor: emEstoque },
        { campo: 'Taxa de Ruptura',           valor: `${taxaRuptura.toFixed(1)}%` },
        { campo: 'Perda de Venda/Dia',        valor: `R$ ${perdaVenda.toFixed(2)}` },
        { campo: 'Perda de Lucro/Dia',        valor: `R$ ${perdaLucro.toFixed(2)}` },
      ],
    });

    // Nome do arquivo entra na conversa do grupo — precisa se explicar sozinho
    const dataArq = brazilDate.substring(0, 10).replace(/\//g, '-');
    const fileName = `ruptura-${survey.id}-${dataArq}.xlsx`;

    return { buffer, fileName };
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

        // Função para desenhar tabela - startNumber mantém a numeração contínua entre páginas
        const drawTable = (title: string, items: RuptureSurveyItem[], startY: number, startNumber: number = 1): number => {
          if (items.length === 0) return startY;

          // Título da seção (só mostra na primeira página da seção)
          if (startNumber === 1) {
            doc.fontSize(12).fillColor('#000').text(title, 30, startY);
            startY += 20;
          }

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
            const rowNumber = startNumber + idx; // Numeração contínua
            const bgColor = rowNumber % 2 === 1 ? '#F5F5F5' : '#FFFFFF';
            doc.rect(30, startY, 780, rowHeight).fillAndStroke(bgColor, '#DDD');
            doc.fontSize(5.5).fillColor('#000');

            // Parse values with proper defaults
            const estoque = parseFloat(item.estoque_atual as any) || 0;
            const vendaMedia = parseFloat(item.venda_media_dia as any) || 0;
            const valorVenda = parseFloat(item.valor_venda as any) || 0;
            const margem = parseFloat(item.margem_lucro as any) || 0;
            const perdaVenda = valorVenda * vendaMedia;
            const perdaLucro = perdaVenda * (margem / 100);

            doc.text(`${rowNumber}`, colX[0] + 2, startY + 5, { width: colWidth[0], align: 'left' });
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

            // Nova página se necessário - passar startNumber correto para manter numeração
            if (startY > 500 && idx < items.length - 1) {
              doc.addPage();
              startY = 30;
              // Passa o próximo número sequencial e os itens restantes
              return drawTable(title, items.slice(idx + 1), startY, rowNumber + 1);
            }
          }

          return startY + 20;
        };

        // Desenhar tabelas separadas
        let currentY = doc.y;

        if (naoEncontrado.length > 0) {
          currentY = drawTable('RUPTURA - NÃO ENCONTRADO', naoEncontrado, currentY, 1);
        }

        if (emEstoque.length > 0) {
          if (currentY > 400) {
            doc.addPage();
            currentY = 30;
          }
          currentY = drawTable('RUPTURA - EM ESTOQUE', emEstoque, currentY, 1);
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

  /**
   * Busca evolução mensal de rupturas para o gráfico
   * @param ano Ano para buscar os dados
   */
  static async getEvolucaoMensal(ano: number): Promise<{
    mes: number;
    mesNome: string;
    totalVerificados: number;
    totalRupturas: number;
    taxaRuptura: number;
    perdaVenda: number;
    perdaLucro: number;
  }[]> {
    const surveyRepository = AppDataSource.getRepository(RuptureSurvey);
    const itemRepository = AppDataSource.getRepository(RuptureSurveyItem);

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const resultado = [];

    for (let mes = 1; mes <= 12; mes++) {
      // Calcular primeiro e último dia do mês
      const primeiroDia = new Date(ano, mes - 1, 1);
      const ultimoDia = new Date(ano, mes, 0);

      // Buscar surveys do mês
      const surveys = await surveyRepository
        .createQueryBuilder('survey')
        .where('survey.data_criacao >= :inicio', { inicio: primeiroDia.toISOString().split('T')[0] })
        .andWhere('survey.data_criacao <= :fim', { fim: ultimoDia.toISOString().split('T')[0] + ' 23:59:59' })
        .getMany();

      if (surveys.length === 0) {
        resultado.push({
          mes,
          mesNome: mesesNomes[mes - 1],
          totalVerificados: 0,
          totalRupturas: 0,
          taxaRuptura: 0,
          perdaVenda: 0,
          perdaLucro: 0
        });
        continue;
      }

      const surveyIds = surveys.map(s => s.id);

      // Buscar todos os itens das surveys do mês
      const items = await itemRepository
        .createQueryBuilder('item')
        .where('item.survey_id IN (:...surveyIds)', { surveyIds })
        .getMany();

      // Calcular estatísticas
      const verificados = items.filter(i => i.status_verificacao !== 'pendente');
      const rupturas = items.filter(i =>
        i.status_verificacao === 'nao_encontrado' || i.status_verificacao === 'ruptura_estoque'
      );

      const totalVerificados = verificados.length;
      const totalRupturas = rupturas.length;
      const taxaRuptura = totalVerificados > 0 ? (totalRupturas / totalVerificados) * 100 : 0;

      // Calcular perdas
      const perdaVenda = rupturas.reduce((total, item) => {
        const vendaMedia = Number(item.venda_media_dia) || 0;
        const valorVenda = Number(item.valor_venda) || 0;
        return total + (vendaMedia * valorVenda);
      }, 0);

      const perdaLucro = rupturas.reduce((total, item) => {
        const vendaMedia = Number(item.venda_media_dia) || 0;
        const valorVenda = Number(item.valor_venda) || 0;
        const margem = Number(item.margem_lucro) || 0;
        return total + (vendaMedia * valorVenda * (margem / 100));
      }, 0);

      resultado.push({
        mes,
        mesNome: mesesNomes[mes - 1],
        totalVerificados,
        totalRupturas,
        taxaRuptura,
        perdaVenda,
        perdaLucro
      });
    }

    return resultado;
  }
}
