import { AppDataSource } from '../config/database';
import { Loss } from '../entities/Loss';
import * as fs from 'fs';
import Papa from 'papaparse';
import { Between, In } from 'typeorm';

// Mapeamento de número da seção para nome
const SECAO_MAP: Record<string, string> = {
  '1': 'Açougue',
  '2': 'Padaria',
  '3': 'Bebidas',
  '4': 'Bebidas',
  '5': 'Mercearia',
  '6': 'Limpeza',
  '7': 'Higiene/Perfumaria',
  '8': 'Frios/Laticínios',
  '9': 'Limpeza',
  '10': 'Bazar',
  '11': 'Mercearia',
  '12': 'FLV (Frutas, Legumes e Verduras)',
  '13': 'Congelados',
  '14': 'Têxtil',
  '15': 'Outros',
  '16': 'Mercearia',
};

export class LossService {
  /**
   * Processa arquivo CSV e importa perdas
   */
  static async importFromFile(
    filePath: string,
    nomeLote: string,
    companyId: string | null,
    dataInicioCustom?: string,
    dataFimCustom?: string
  ): Promise<{ total: number; perdas: number; entradas: number }> {
    try {
      console.log(`📂 Processando arquivo de perdas: ${filePath}`);

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

      // Encontrar a linha que contém "Código de Barras" (header real)
      let headerLineIndex = lines.findIndex(line =>
        line.includes('C�digo de Barras') || line.includes('Código de Barras')
      );

      // Se não encontrou, tentar pular as primeiras 4 linhas (padrão do CSV)
      if (headerLineIndex === -1) {
        headerLineIndex = 4;
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

      // Filtrar linhas válidas
      const validRows = rows.filter(row => {
        const codigoBarras = row['C�digo de Barras'] || row['Código de Barras'];
        const descricao = row['Descri��o Reduzida'] || row['Descrição Reduzida'];

        // Aceitar linha se tiver código de barras OU descrição, e não for linha de cabeçalho
        return (codigoBarras || descricao) &&
               !String(codigoBarras || '').includes('SUPERMERCADO') &&
               !String(codigoBarras || '').includes('CEP') &&
               !String(codigoBarras || '').includes('CNPJ') &&
               !String(codigoBarras || '').includes('C�digo de Barras');
      });

      console.log(`✅ ${validRows.length} registros válidos encontrados`);

      // Importar registros
      const lossRepository = AppDataSource.getRepository(Loss);

      // dataImportacao = data ATUAL (quando o lote foi criado)
      // dataInicioPeriodo/dataFimPeriodo = período escolhido pelo usuário
      const dataImportacao = new Date(); // SEMPRE a data atual
      const dataInicioPeriodo = dataInicioCustom ? new Date(dataInicioCustom + 'T12:00:00') : new Date();
      const dataFimPeriodo = dataFimCustom ? new Date(dataFimCustom + 'T12:00:00') : dataInicioPeriodo;

      console.log(`📅 Data de importação: ${dataImportacao.toLocaleDateString('pt-BR')}`);
      console.log(`📅 Período: ${dataInicioPeriodo.toLocaleDateString('pt-BR')} até ${dataFimPeriodo.toLocaleDateString('pt-BR')}`);

      let perdas = 0;
      let entradas = 0;

      // Importar cada linha do CSV apenas UMA VEZ
      for (const row of validRows) {
        const quantidadeStr = (row['Quantidade Ajuste'] || '0').replace(',', '.');
        const quantidade = parseFloat(quantidadeStr);
        const custoStr = (row['Custo Reposi��o'] || row['Custo Reposição'] || '0').replace(',', '.');
        const custo = parseFloat(custoStr);
        const secao = (row['Se��o'] || row['Seção'] || '0').trim();

        // Contar perdas vs entradas
        if (quantidade < 0) {
          perdas++;
        } else {
          entradas++;
        }

        const loss = lossRepository.create({
          ...(companyId && { companyId }),
          codigoBarras: row['C�digo de Barras'] || row['Código de Barras'] || '',
          descricaoReduzida: row['Descri��o Reduzida'] || row['Descrição Reduzida'] || '',
          quantidadeAjuste: quantidade,
          custoReposicao: custo,
          descricaoAjusteCompleta: row['Descri��o Ajuste Completa'] || row['Descrição Ajuste Completa'] || '',
          secao: secao,
          secaoNome: SECAO_MAP[secao] || 'Outros',
          dataImportacao,
          dataInicioPeriodo,
          dataFimPeriodo,
          nomeLote,
        });

        await lossRepository.save(loss);
      }

      console.log(`✅ Importação concluída: ${validRows.length} registros (${perdas} perdas, ${entradas} entradas)`);

      // Gerar e enviar PDF de relatório ao WhatsApp
      try {
        console.log(`📄 Gerando PDF de relatório de quebras...`);

        // Buscar todos os itens importados para o PDF
        const lossItems = await lossRepository.find({
          where: {
            nomeLote,
            ...(companyId && { companyId })
          }
        });

        // Importar serviços (evitar import circular no topo do arquivo)
        const { LossPDFService } = await import('./loss-pdf.service');
        const { WhatsAppService } = await import('./whatsapp.service');
        const { LossReasonConfig } = await import('../entities/LossReasonConfig');

        // Buscar motivos ignorados para filtrar da mensagem WhatsApp
        const reasonConfigRepository = AppDataSource.getRepository(LossReasonConfig);
        const motivosIgnorados = await reasonConfigRepository.find({
          where: {
            ...(companyId && { companyId }),
            ignorarCalculo: true,
          },
        });
        const motivosIgnoradosSet = new Set(motivosIgnorados.map(m => m.motivo));

        // Filtrar itens para WhatsApp (apenas motivos ATIVOS)
        const lossItemsAtivos = lossItems.filter(item =>
          !motivosIgnoradosSet.has(item.descricaoAjusteCompleta)
        );

        // Gerar resumo para WhatsApp (apenas com motivos ativos)
        const summary = LossPDFService.generateWhatsAppSummary(lossItemsAtivos.map(item => ({
          codigoBarras: item.codigoBarras,
          descricaoReduzida: item.descricaoReduzida,
          quantidadeAjuste: item.quantidadeAjuste,
          custoReposicao: item.custoReposicao,
          descricaoAjusteCompleta: item.descricaoAjusteCompleta,
          secao: item.secao,
          secaoNome: item.secaoNome
        })));

        // Gerar PDF (apenas com motivos ativos)
        const pdfPath = await LossPDFService.generateLossesPDF(
          nomeLote,
          dataInicioPeriodo.toLocaleDateString('pt-BR'),
          dataFimPeriodo.toLocaleDateString('pt-BR'),
          lossItemsAtivos.map(item => ({
            codigoBarras: item.codigoBarras,
            descricaoReduzida: item.descricaoReduzida,
            quantidadeAjuste: item.quantidadeAjuste,
            custoReposicao: item.custoReposicao,
            descricaoAjusteCompleta: item.descricaoAjusteCompleta,
            secao: item.secao,
            secaoNome: item.secaoNome
          }))
        );

        console.log(`✅ PDF gerado: ${pdfPath}`);

        // Enviar para WhatsApp (com totais apenas dos motivos ativos)
        const whatsappSuccess = await WhatsAppService.sendLossesReport(
          pdfPath,
          nomeLote,
          lossItemsAtivos.length,
          summary.totalSaidas,
          summary.totalEntradas,
          summary.valorTotalSaidas,
          summary.valorTotalEntradas,
          summary.saidas,
          summary.entradas
        );

        if (whatsappSuccess) {
          console.log(`✅ Relatório enviado ao WhatsApp com sucesso`);
        } else {
          console.warn(`⚠️  Falha ao enviar relatório ao WhatsApp`);
        }

        // Limpar arquivo temporário
        const fs = require('fs');
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
          console.log(`🗑️  Arquivo temporário removido: ${pdfPath}`);
        }
      } catch (pdfError) {
        console.error('❌ Erro ao gerar/enviar PDF (importação concluída normalmente):', pdfError);
        // Não falha a importação se o PDF falhar
      }

      return {
        total: validRows.length,
        perdas,
        entradas,
      };
    } catch (error) {
      console.error('❌ Erro ao importar perdas:', error);
      throw error;
    }
  }

  /**
   * Buscar todos os lotes
   */
  static async getAllLotes(companyId?: string): Promise<any[]> {
    const lossRepository = AppDataSource.getRepository(Loss);

    const query = lossRepository
      .createQueryBuilder('loss')
      .select('loss.nome_lote', 'nomeLote')
      .addSelect('loss.data_importacao', 'dataImportacao')
      .addSelect('loss.data_inicio_periodo', 'dataInicioPeriodo')
      .addSelect('loss.data_fim_periodo', 'dataFimPeriodo')
      .addSelect('COUNT(*)', 'totalRegistros')
      .addSelect('SUM(CASE WHEN loss.quantidade_ajuste < 0 THEN 1 ELSE 0 END)', 'totalPerdas')
      .addSelect('SUM(CASE WHEN loss.quantidade_ajuste >= 0 THEN 1 ELSE 0 END)', 'totalEntradas')
      .addSelect('SUM(CASE WHEN loss.quantidade_ajuste < 0 THEN ABS(loss.quantidade_ajuste * loss.custo_reposicao) ELSE 0 END)', 'valorPerdas');

    // Adicionar filtro de company apenas se estiver definido
    if (companyId) {
      query.where('loss.company_id = :companyId', { companyId });
    }

    const result = await query
      .groupBy('loss.nome_lote')
      .addGroupBy('loss.data_importacao')
      .addGroupBy('loss.data_inicio_periodo')
      .addGroupBy('loss.data_fim_periodo')
      .orderBy('loss.data_importacao', 'DESC')
      .getRawMany();

    return result.map((r: any) => ({
      nomeLote: r.nomeLote,
      dataImportacao: r.dataImportacao,
      dataInicioPeriodo: r.dataInicioPeriodo,
      dataFimPeriodo: r.dataFimPeriodo,
      totalRegistros: parseInt(r.totalRegistros),
      totalPerdas: parseInt(r.totalPerdas),
      totalEntradas: parseInt(r.totalEntradas),
      valorPerdas: parseFloat(r.valorPerdas || 0),
    }));
  }

  /**
   * Buscar perdas por lote
   */
  static async getByLote(nomeLote: string, companyId?: string): Promise<Loss[]> {
    const lossRepository = AppDataSource.getRepository(Loss);

    return await lossRepository.find({
      where: {
        nomeLote,
        ...(companyId && { companyId }),
      },
      order: {
        quantidadeAjuste: 'ASC', // Perdas primeiro (valores negativos)
      },
    });
  }

  /**
   * Buscar perdas agregadas por seção
   */
  static async getAggregatedBySection(
    nomeLote: string,
    companyId?: string
  ): Promise<any[]> {
    const lossRepository = AppDataSource.getRepository(Loss);

    const query = lossRepository
      .createQueryBuilder('loss')
      .select('loss.secao', 'secao')
      .addSelect('loss.secao_nome', 'secaoNome')
      .addSelect('COUNT(*)', 'totalItens')
      .addSelect('SUM(CASE WHEN loss.quantidade_ajuste < 0 THEN 1 ELSE 0 END)', 'totalPerdas')
      .addSelect('SUM(CASE WHEN loss.quantidade_ajuste >= 0 THEN 1 ELSE 0 END)', 'totalEntradas')
      .addSelect('SUM(CASE WHEN loss.quantidade_ajuste < 0 THEN ABS(loss.quantidade_ajuste * loss.custo_reposicao) ELSE 0 END)', 'valorPerdas')
      .addSelect('SUM(CASE WHEN loss.quantidade_ajuste >= 0 THEN (loss.quantidade_ajuste * loss.custo_reposicao) ELSE 0 END)', 'valorEntradas')
      .where('loss.nome_lote = :nomeLote', { nomeLote });

    // Adicionar filtro de company apenas se estiver definido
    if (companyId) {
      query.andWhere('loss.company_id = :companyId', { companyId });
    }

    const result = await query
      .groupBy('loss.secao')
      .addGroupBy('loss.secao_nome')
      .orderBy('valorPerdas', 'DESC')
      .getRawMany();

    return result.map((r: any) => ({
      secao: r.secao,
      secaoNome: r.secaoNome,
      totalItens: parseInt(r.totalItens),
      totalPerdas: parseInt(r.totalPerdas),
      totalEntradas: parseInt(r.totalEntradas),
      valorPerdas: parseFloat(r.valorPerdas || 0),
      valorEntradas: parseFloat(r.valorEntradas || 0),
    }));
  }

  /**
   * Deletar lote
   */
  static async deleteLote(nomeLote: string, companyId?: string): Promise<void> {
    const lossRepository = AppDataSource.getRepository(Loss);

    await lossRepository.delete({
      nomeLote,
      ...(companyId && { companyId }),
    });

    console.log(`🗑️ Lote "${nomeLote}" deletado com sucesso`);
  }

  /**
   * Buscar resultados agregados com filtros
   */
  static async getAgregatedResults(filters: {
    data_inicio: string;
    data_fim: string;
    motivo?: string;
    produto?: string;
    tipo?: string;
    companyId?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const lossRepository = AppDataSource.getRepository(Loss);
    const { LossReasonConfig } = await import('../entities/LossReasonConfig');
    const reasonConfigRepository = AppDataSource.getRepository(LossReasonConfig);

    // Buscar motivos ignorados
    const motivosIgnorados = await reasonConfigRepository.find({
      where: {
        ...(filters.companyId && { companyId: filters.companyId }),
        ignorarCalculo: true,
      },
    });

    const motivosIgnoradosSet = new Set(motivosIgnorados.map(m => m.motivo));

    // Construir query com filtros
    const query = lossRepository
      .createQueryBuilder('loss')
      .where('loss.data_importacao >= :dataInicio', { dataInicio: filters.data_inicio })
      .andWhere('loss.data_importacao <= :dataFim', { dataFim: filters.data_fim });

    // Adicionar filtro de company apenas se estiver definido
    if (filters.companyId) {
      query.andWhere('loss.company_id = :companyId', { companyId: filters.companyId });
    }

    // Filtro por motivo
    if (filters.motivo && filters.motivo !== 'todos') {
      query.andWhere('loss.descricao_ajuste_completa = :motivo', { motivo: filters.motivo });
    }

    // Filtro por produto (busca parcial na descrição)
    if (filters.produto && filters.produto !== 'todos') {
      query.andWhere('LOWER(loss.descricao_reduzida) LIKE LOWER(:produto)', {
        produto: `%${filters.produto}%`,
      });
    }

    const items = await query.getMany();

    // Separar TODAS as perdas e entradas (incluindo ignorados para mostrar nos cards)
    const todasPerdas = items.filter(i => i.quantidadeAjuste < 0);
    const todasEntradas = items.filter(i => i.quantidadeAjuste >= 0);

    // Perdas NÃO ignoradas (para cálculos de estatísticas)
    const perdasNaoIgnoradas = todasPerdas.filter(i =>
      !motivosIgnoradosSet.has(i.descricaoAjusteCompleta)
    );

    // Entradas NÃO ignoradas (para cálculos de estatísticas)
    const entradasNaoIgnoradas = todasEntradas.filter(i =>
      !motivosIgnoradosSet.has(i.descricaoAjusteCompleta)
    );

    // Calcular totais (apenas com itens NÃO ignorados)
    const totalItens = items.length;
    const totalPerdas = perdasNaoIgnoradas.length;
    const totalEntradas = entradasNaoIgnoradas.length;

    const valorTotalPerdas = perdasNaoIgnoradas.reduce((total, item) => {
      return total + Math.abs(item.quantidadeAjuste * item.custoReposicao);
    }, 0);

    const valorTotalEntradas = entradasNaoIgnoradas.reduce((total, item) => {
      return total + (item.quantidadeAjuste * item.custoReposicao);
    }, 0);

    // Agrupar TODAS as perdas por MOTIVO (incluindo ignorados para exibir nos cards)
    const perdasPorMotivo: { [key: string]: { count: number; valor: number; ignorado: boolean } } = {};

    todasPerdas.forEach(item => {
      const motivo = item.descricaoAjusteCompleta || 'Sem descrição';
      const isIgnorado = motivosIgnoradosSet.has(motivo);

      if (!perdasPorMotivo[motivo]) {
        perdasPorMotivo[motivo] = {
          count: 0,
          valor: 0,
          ignorado: isIgnorado,
        };
      }
      perdasPorMotivo[motivo].count++;
      perdasPorMotivo[motivo].valor += Math.abs(item.quantidadeAjuste * item.custoReposicao);
    });

    const motivosRanking = Object.entries(perdasPorMotivo)
      .map(([motivo, stats]) => ({
        motivo,
        totalPerdas: stats.count,
        valorPerdas: stats.valor,
        ignorado: stats.ignorado,
      }))
      .sort((a, b) => b.valorPerdas - a.valorPerdas);

    // Agrupar TODAS as entradas por MOTIVO (incluindo ignorados para exibir nos cards)
    const entradasPorMotivo: { [key: string]: { count: number; valor: number; ignorado: boolean } } = {};

    todasEntradas.forEach(item => {
      const motivo = item.descricaoAjusteCompleta || 'Sem descrição';
      const isIgnorado = motivosIgnoradosSet.has(motivo);

      if (!entradasPorMotivo[motivo]) {
        entradasPorMotivo[motivo] = {
          count: 0,
          valor: 0,
          ignorado: isIgnorado,
        };
      }
      entradasPorMotivo[motivo].count++;
      entradasPorMotivo[motivo].valor += (item.quantidadeAjuste * item.custoReposicao);
    });

    const entradasRanking = Object.entries(entradasPorMotivo)
      .map(([motivo, stats]) => ({
        motivo,
        totalEntradas: stats.count,
        valorEntradas: stats.valor,
        ignorado: stats.ignorado,
      }))
      .sort((a, b) => b.valorEntradas - a.valorEntradas);

    // Produtos com maiores perdas e entradas (com paginação)
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    // Mapear perdas (NÃO ignoradas)
    const perdasMapeadas = perdasNaoIgnoradas.map(item => ({
      codigoBarras: item.codigoBarras,
      descricao: item.descricaoReduzida,
      secao: item.secaoNome || 'Outros',
      quantidade: item.quantidadeAjuste, // Manter negativo para identificar
      custoReposicao: item.custoReposicao,
      valorPerda: Math.abs(item.quantidadeAjuste * item.custoReposicao),
      motivo: item.descricaoAjusteCompleta,
      tipo: 'perda',
    }));

    // Mapear entradas (NÃO ignoradas)
    const entradasMapeadas = entradasNaoIgnoradas.map(item => ({
      codigoBarras: item.codigoBarras,
      descricao: item.descricaoReduzida,
      secao: item.secaoNome || 'Outros',
      quantidade: item.quantidadeAjuste, // Manter positivo para identificar
      custoReposicao: item.custoReposicao,
      valorPerda: item.quantidadeAjuste * item.custoReposicao,
      motivo: item.descricaoAjusteCompleta,
      tipo: 'entrada',
    }));

    // Filtrar por tipo ANTES da paginação
    let todosProdutos = [];
    if (filters.tipo === 'perdas') {
      todosProdutos = perdasMapeadas;
    } else if (filters.tipo === 'entradas') {
      todosProdutos = entradasMapeadas;
    } else {
      // 'ambos' ou undefined - mostrar tudo
      todosProdutos = [...perdasMapeadas, ...entradasMapeadas];
    }

    const produtosSorted = todosProdutos.sort((a, b) => Math.abs(b.valorPerda) - Math.abs(a.valorPerda));

    const totalProdutos = produtosSorted.length;
    const totalPages = Math.ceil(totalProdutos / limit);
    const produtosRanking = produtosSorted.slice(offset, offset + limit);

    return {
      estatisticas: {
        total_itens: totalItens,
        total_perdas: totalPerdas,
        total_entradas: totalEntradas,
        valor_total_perdas: valorTotalPerdas,
        valor_total_entradas: valorTotalEntradas,
      },
      motivos_ranking: motivosRanking,
      entradas_ranking: entradasRanking,
      produtos_ranking: produtosRanking,
      paginacao: {
        page,
        limit,
        total: totalProdutos,
        totalPages,
      },
    };
  }

  /**
   * Buscar seções únicas para filtro
   */
  static async getUniqueSecoes(companyId?: string): Promise<any[]> {
    const lossRepository = AppDataSource.getRepository(Loss);
    const query = lossRepository
      .createQueryBuilder('loss')
      .select('DISTINCT loss.secao', 'secao')
      .addSelect('loss.secao_nome', 'secaoNome')
      .where('loss.secao IS NOT NULL');

    // Adicionar filtro de company apenas se estiver definido
    if (companyId) {
      query.andWhere('loss.company_id = :companyId', { companyId });
    }

    const items = await query.getRawMany();

    return items.map((i: any) => ({
      secao: i.secao,
      secaoNome: i.secaoNome || 'Outros',
    }));
  }

  /**
   * Buscar produtos únicos para filtro
   */
  static async getUniqueProdutos(companyId?: string): Promise<string[]> {
    const lossRepository = AppDataSource.getRepository(Loss);
    const query = lossRepository
      .createQueryBuilder('loss')
      .select('DISTINCT loss.descricao_reduzida', 'descricao')
      .where('loss.descricao_reduzida IS NOT NULL');

    // Adicionar filtro de company apenas se estiver definido
    if (companyId) {
      query.andWhere('loss.company_id = :companyId', { companyId });
    }

    const items = await query.limit(500).getRawMany();

    return items.map((i: any) => i.descricao);
  }

  /**
   * Buscar motivos únicos
   */
  static async getUniqueMotivos(companyId?: string): Promise<string[]> {
    const lossRepository = AppDataSource.getRepository(Loss);
    const query = lossRepository
      .createQueryBuilder('loss')
      .select('DISTINCT loss.descricao_ajuste_completa', 'motivo')
      .where('loss.descricao_ajuste_completa IS NOT NULL');

    // Adicionar filtro de company apenas se estiver definido
    if (companyId) {
      query.andWhere('loss.company_id = :companyId', { companyId });
    }

    const items = await query.getRawMany();

    return items.map((i: any) => i.motivo);
  }

  /**
   * Alternar motivo ignorado
   */
  static async toggleMotivoIgnorado(motivo: string, companyId?: string): Promise<any> {
    const { LossReasonConfig } = await import('../entities/LossReasonConfig');
    const reasonConfigRepository = AppDataSource.getRepository(LossReasonConfig);

    // Verificar se já existe
    const existing = await reasonConfigRepository.findOne({
      where: {
        ...(companyId && { companyId }),
        motivo,
      },
    });

    if (existing) {
      // Alternar o valor
      existing.ignorarCalculo = !existing.ignorarCalculo;
      await reasonConfigRepository.save(existing);
      return existing;
    } else {
      // Criar novo com ignorar = true
      const newConfig = reasonConfigRepository.create({
        ...(companyId && { companyId }),
        motivo,
        ignorarCalculo: true,
      });
      await reasonConfigRepository.save(newConfig);
      return newConfig;
    }
  }

  /**
   * Listar motivos ignorados
   */
  static async getMotivosIgnorados(companyId?: string): Promise<any[]> {
    const { LossReasonConfig } = await import('../entities/LossReasonConfig');
    const reasonConfigRepository = AppDataSource.getRepository(LossReasonConfig);

    return await reasonConfigRepository.find({
      where: {
        ...(companyId && { companyId }),
        ignorarCalculo: true,
      },
    });
  }
}
