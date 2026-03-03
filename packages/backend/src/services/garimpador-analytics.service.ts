import { AppDataSource } from '../config/database';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';
import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';
import { ConfigurationService } from './configuration.service';
import { GarimpadorDecomposerService } from './garimpador-decomposer.service';

interface RankingFornecedor {
  contatoId: number;
  nome: string;
  telefone: string;
  tipo: string;
  fotoUrl: string | null;
  totalOfertas: number;
  ouro: number;
  prata: number;
  bronze: number;
  ruim: number;
  totalEconomia: number;
  margemMediaMelhoria: number;
  ultimaMensagem: string | null;
  diasAtivos: number[]; // dias da semana com atividade (0=Dom, 1=Seg, ..., 6=Sab)
}

interface DetalheItem {
  produtoOfertado: string;
  precoOferta: number;
  produtoLoja: string | null;
  codProdutoLoja: string | null;
  codBarrasLoja: string | null;
  precoVendaLoja: number;
  precoCustoLoja: number;
  diferenca: number;
  boaOferta: boolean;
  margemAtual: number;
  margemFutura: number;
  diferencaMargem: number;
  classificacao: string;
  curva: string;
  fornecedorAtual: string;
  data: string;
  mediaUrl: string | null;
  secao: string | null;
  grupo: string | null;
  subgrupo: string | null;
  matchScore: number;
  qtdEncontrado: number;
}

interface PontoProjecao {
  data: string;
  preco: number;
  fornecedor: string;
  produtoOfertado: string;
  produtoLoja: string | null;
  classificacao: string | null;
}

interface ProdutoForaMix {
  produtoNome: string;
  preco: number;
  fornecedor: string;
  fornecedorTelefone: string;
  dataRecebido: string;
  mensagemId: number;
  ocorrencias: number;
  mediaUrl: string | null;
}

interface ResumoAnalytics {
  totalMensagensComparadas: number;
  totalProdutosAnalisados: number;
  totalOuro: number;
  totalPrata: number;
  totalBronze: number;
  totalRuim: number;
  economiaTotal: number;
  margemMediaMelhoria: number;
  topCategorias: Array<{ categoria: string; count: number }>;
  totalForaMix: number;
}

/**
 * Service de analytics do Garimpador.
 * Agrega dados de comparacoes para ranking, projecao e fora do mix.
 */
export class GarimpadorAnalyticsService {

  /**
   * Busca mensagens comparadas com JOIN de contato, filtradas por periodo
   */
  private static async buscarMensagensComparadas(dataInicio?: string, dataFim?: string) {
    const repo = AppDataSource.getRepository(GarimpadorMensagem);
    const qb = repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contato', 'c')
      .where('m.processado = true')
      .andWhere("m.conteudo_extraido LIKE '%resultados_comparacao%'");

    if (dataInicio) {
      qb.andWhere('m.received_at >= :dataInicio', { dataInicio: new Date(dataInicio) });
    }
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setDate(fim.getDate() + 1);
      qb.andWhere('m.received_at < :dataFim', { dataFim: fim });
    }

    qb.orderBy('m.received_at', 'DESC');
    return qb.getMany();
  }

  /**
   * Parse seguro do conteudo_extraido
   */
  private static parseExtraido(msg: GarimpadorMensagem): { produtos_originais: any[]; resultados_comparacao: any[] } | null {
    try {
      const dados = JSON.parse(msg.conteudo_extraido || '{}');
      if (dados.produtos_originais && dados.resultados_comparacao) {
        return dados;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Ranking de fornecedores por quantidade de ouro/prata/bronze
   */
  static async getRankingFornecedores(dataInicio?: string, dataFim?: string, tipo?: string): Promise<RankingFornecedor[]> {
    let mensagens = await this.buscarMensagensComparadas(dataInicio, dataFim);

    // Filtrar por tipo de contato se especificado
    if (tipo) {
      mensagens = mensagens.filter(m => m.contato?.tipo === tipo);
    }

    // Agregar por contato
    const mapa = new Map<number, RankingFornecedor & { _diasSet: Set<number> }>();

    for (const msg of mensagens) {
      const dados = this.parseExtraido(msg);
      if (!dados || !msg.contato) continue;

      const cId = msg.contato.id;
      if (!mapa.has(cId)) {
        mapa.set(cId, {
          contatoId: cId,
          nome: msg.contato.nome || msg.contato.telefone,
          telefone: msg.contato.telefone,
          tipo: msg.contato.tipo,
          fotoUrl: msg.contato.foto_url,
          totalOfertas: 0,
          ouro: 0,
          prata: 0,
          bronze: 0,
          ruim: 0,
          totalEconomia: 0,
          margemMediaMelhoria: 0,
          ultimaMensagem: null,
          diasAtivos: [],
          _diasSet: new Set<number>(),
        });
      }

      const rank = mapa.get(cId)!;
      if (!rank.ultimaMensagem && msg.received_at) {
        rank.ultimaMensagem = msg.received_at.toISOString();
      }

      // Registrar dia da semana desta mensagem
      if (msg.received_at) {
        rank._diasSet.add(msg.received_at.getDay());
      }

      let somaMargemMelhoria = 0;
      let countMelhoria = 0;

      for (const r of dados.resultados_comparacao) {
        rank.totalOfertas++;
        const classif = r.classificacao || 'ruim';
        if (classif === 'ouro') rank.ouro++;
        else if (classif === 'prata') rank.prata++;
        else if (classif === 'bronze') rank.bronze++;
        else rank.ruim++;

        if (r.boaOferta && r.diferenca > 0) {
          rank.totalEconomia += r.diferenca;
        }
        if (r.diferencaMargem > 0) {
          somaMargemMelhoria += r.diferencaMargem;
          countMelhoria++;
        }
      }

      if (countMelhoria > 0) {
        rank.margemMediaMelhoria = parseFloat((somaMargemMelhoria / countMelhoria).toFixed(2));
      }
    }

    // Ordenar: ouro DESC, prata DESC, bronze DESC
    const ranking = Array.from(mapa.values());
    ranking.sort((a, b) => {
      if (b.ouro !== a.ouro) return b.ouro - a.ouro;
      if (b.prata !== a.prata) return b.prata - a.prata;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.totalOfertas - a.totalOfertas;
    });

    // Arredondar economia e converter diasAtivos
    ranking.forEach(r => {
      r.totalEconomia = parseFloat(r.totalEconomia.toFixed(2));
      r.diasAtivos = [...(r as any)._diasSet].sort();
      delete (r as any)._diasSet;
    });

    return ranking;
  }

  /**
   * Detalhes de um fornecedor especifico com filtro de classificacao
   */
  static async getDetalhesFornecedor(contatoId: number, classificacao?: string, dataInicio?: string, dataFim?: string): Promise<DetalheItem[]> {
    const repo = AppDataSource.getRepository(GarimpadorMensagem);
    const qb = repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contato', 'c')
      .where('m.contato_id = :contatoId', { contatoId })
      .andWhere('m.processado = true')
      .andWhere("m.conteudo_extraido LIKE '%resultados_comparacao%'");

    if (dataInicio) {
      qb.andWhere('m.received_at >= :dataInicio', { dataInicio: new Date(dataInicio) });
    }
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setDate(fim.getDate() + 1);
      qb.andWhere('m.received_at < :dataFim', { dataFim: fim });
    }

    qb.orderBy('m.received_at', 'DESC');
    const mensagens = await qb.getMany();

    // Contar quantas vezes cada produto Oracle (por codProduto) aparece em TODAS as mensagens do periodo
    const todasMensagens = await this.buscarMensagensComparadas(dataInicio, dataFim);
    const contagemProduto = new Map<string, number>();
    for (const msg of todasMensagens) {
      const dados = this.parseExtraido(msg);
      if (!dados) continue;
      for (const r of dados.resultados_comparacao) {
        const cod = r.produtoLoja?.codProduto ? String(r.produtoLoja.codProduto) : null;
        if (cod) {
          contagemProduto.set(cod, (contagemProduto.get(cod) || 0) + 1);
        }
      }
    }

    const itens: DetalheItem[] = [];

    for (const msg of mensagens) {
      const dados = this.parseExtraido(msg);
      if (!dados) continue;

      for (const r of dados.resultados_comparacao) {
        if (classificacao && r.classificacao !== classificacao) continue;

        const codProd = r.produtoLoja?.codProduto ? String(r.produtoLoja.codProduto) : null;

        itens.push({
          produtoOfertado: r.produtoOfertado || '',
          precoOferta: r.precoOferta || 0,
          produtoLoja: r.produtoLoja?.descricao || null,
          codProdutoLoja: codProd,
          codBarrasLoja: r.produtoLoja?.codigo_barras || null,
          precoVendaLoja: r.produtoLoja?.preco_venda || 0,
          precoCustoLoja: r.produtoLoja?.preco_custo || 0,
          diferenca: r.diferenca || 0,
          boaOferta: r.boaOferta || false,
          margemAtual: r.margemAtual || 0,
          margemFutura: r.margemFutura || 0,
          diferencaMargem: r.diferencaMargem || 0,
          classificacao: r.classificacao || 'ruim',
          curva: r.produtoLoja?.curva || '-',
          fornecedorAtual: r.produtoLoja?.fornecedor || '-',
          data: (msg.received_at || msg.created_at)?.toISOString() || '',
          mediaUrl: msg.media_url || null,
          secao: r.produtoLoja?.secao || null,
          grupo: r.produtoLoja?.grupo || null,
          subgrupo: r.produtoLoja?.subgrupo || null,
          matchScore: r.matchScore ?? r.produtoLoja?.matchScore ?? 0,
          qtdEncontrado: codProd ? (contagemProduto.get(codProd) || 1) : 0,
        });
      }
    }

    return itens;
  }

  /**
   * Projecao de preco: historico de precos para um produto
   */
  static async getProjecaoPreco(termo: string, dataInicio?: string, dataFim?: string): Promise<{
    produtoBusca: string;
    pontos: PontoProjecao[];
    precoMinimo: number;
    precoMaximo: number;
    precoMedio: number;
    totalRegistros: number;
  }> {
    const mensagens = await this.buscarMensagensComparadas(dataInicio, dataFim);
    const termoUpper = termo.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const pontos: PontoProjecao[] = [];

    for (const msg of mensagens) {
      const dados = this.parseExtraido(msg);
      if (!dados) continue;

      const fornecedor = msg.contato?.nome || msg.contato?.telefone || 'Desconhecido';
      const dataMsg = (msg.received_at || msg.created_at)?.toISOString() || '';

      // Busca nos produtos originais + resultados
      for (const prod of dados.produtos_originais) {
        const nomeNorm = (prod.produto || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!nomeNorm.includes(termoUpper)) continue;

        // Encontra o resultado de comparacao correspondente
        const match = dados.resultados_comparacao.find(
          (r: any) => r.produtoOfertado === prod.produto
        );

        pontos.push({
          data: dataMsg,
          preco: prod.preco || 0,
          fornecedor,
          produtoOfertado: prod.produto,
          produtoLoja: match?.produtoLoja?.descricao || null,
          classificacao: match?.classificacao || null,
        });
      }

      // Busca tambem nos produtos loja (match pelo termo)
      for (const r of dados.resultados_comparacao) {
        const lojaDesc = (r.produtoLoja?.descricao || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const ofertaDesc = (r.produtoOfertado || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Se ja foi adicionado pelo loop acima, pula
        if (ofertaDesc.includes(termoUpper)) continue;

        if (lojaDesc.includes(termoUpper)) {
          pontos.push({
            data: dataMsg,
            preco: r.precoOferta || 0,
            fornecedor,
            produtoOfertado: r.produtoOfertado,
            produtoLoja: r.produtoLoja?.descricao || null,
            classificacao: r.classificacao || null,
          });
        }
      }
    }

    // Ordena por data
    pontos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    const precos = pontos.map(p => p.preco).filter(p => p > 0);
    const precoMinimo = precos.length > 0 ? Math.min(...precos) : 0;
    const precoMaximo = precos.length > 0 ? Math.max(...precos) : 0;
    const precoMedio = precos.length > 0 ? parseFloat((precos.reduce((a, b) => a + b, 0) / precos.length).toFixed(2)) : 0;

    return {
      produtoBusca: termo,
      pontos,
      precoMinimo,
      precoMaximo,
      precoMedio,
      totalRegistros: pontos.length,
    };
  }

  /**
   * Produtos fora do mix: extraidos mas nao encontrados no sistema
   */
  static async getProdutosForaMix(dataInicio?: string, dataFim?: string): Promise<ProdutoForaMix[]> {
    const mensagens = await this.buscarMensagensComparadas(dataInicio, dataFim);

    // Tambem buscar mensagens processadas SEM comparacao (pode ter itens nao encontrados)
    const repo = AppDataSource.getRepository(GarimpadorMensagem);
    const qb2 = repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contato', 'c')
      .where('m.processado = true')
      .andWhere('m.conteudo_extraido IS NOT NULL')
      .andWhere("m.conteudo_extraido NOT LIKE '%resultados_comparacao%'");

    if (dataInicio) {
      qb2.andWhere('m.received_at >= :dataInicio', { dataInicio: new Date(dataInicio) });
    }
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setDate(fim.getDate() + 1);
      qb2.andWhere('m.received_at < :dataFim', { dataFim: fim });
    }

    const msgSemComparacao = await qb2.getMany();
    const todasMensagens = [...mensagens, ...msgSemComparacao];

    // Mapa para agregar: chave = nome normalizado
    const mapa = new Map<string, ProdutoForaMix>();

    for (const msg of todasMensagens) {
      const fornecedor = msg.contato?.nome || msg.contato?.telefone || 'Desconhecido';
      const fornecedorTel = msg.contato?.telefone || '';
      const dataMsg = (msg.received_at || msg.created_at)?.toISOString() || '';

      let dados: any;
      try {
        dados = JSON.parse(msg.conteudo_extraido || '{}');
      } catch { continue; }

      // Caso 1: mensagem com comparacao - produtos sem match
      if (dados.produtos_originais && dados.resultados_comparacao) {
        const produtosMatcheados = new Set(
          dados.resultados_comparacao.map((r: any) => r.produtoOfertado)
        );

        for (const prod of dados.produtos_originais) {
          if (!produtosMatcheados.has(prod.produto)) {
            const chave = (prod.produto || '').toUpperCase().trim();
            if (!chave) continue;

            if (mapa.has(chave)) {
              const existente = mapa.get(chave)!;
              existente.ocorrencias++;
              // Mantém o preço mais recente
              if (dataMsg > existente.dataRecebido) {
                existente.preco = prod.preco || 0;
                existente.dataRecebido = dataMsg;
                existente.fornecedor = fornecedor;
                existente.fornecedorTelefone = fornecedorTel;
              }
            } else {
              mapa.set(chave, {
                produtoNome: prod.produto,
                preco: prod.preco || 0,
                fornecedor,
                fornecedorTelefone: fornecedorTel,
                dataRecebido: dataMsg,
                mensagemId: msg.id,
                ocorrencias: 1,
                mediaUrl: msg.media_url || null,
              });
            }
          }
        }
      }

      // Caso 2: mensagem so com extracao (array de produtos), sem comparacao
      if (Array.isArray(dados) && dados.length > 0 && dados[0].produto) {
        for (const prod of dados) {
          const chave = (prod.produto || '').toUpperCase().trim();
          if (!chave) continue;

          if (mapa.has(chave)) {
            mapa.get(chave)!.ocorrencias++;
          } else {
            mapa.set(chave, {
              produtoNome: prod.produto,
              preco: prod.preco || 0,
              fornecedor,
              fornecedorTelefone: fornecedorTel,
              dataRecebido: dataMsg,
              mensagemId: msg.id,
              ocorrencias: 1,
              mediaUrl: msg.media_url || null,
            });
          }
        }
      }
    }

    // Filtro de qualidade: remover produtos com descricao muito generica
    // Ex: "Chocolate Lacta" (so marca + tipo, sem gramatura/sabor) = muito vago
    // Ex: "Cobertura de Chocolate Harald 1kg Meio Amargo" = OK, tem detalhes
    for (const [chave, item] of mapa.entries()) {
      const decomp = GarimpadorDecomposerService.decompor(item.produtoNome);
      const totalTermosUteis = decomp.marcas.length + decomp.gramaturas.length +
        decomp.embalagens.length + decomp.variantes.length + decomp.descricao.length;

      // Criterios de exclusao (muito generico):
      // 1. Menos de 3 termos uteis (ex: "Chocolate Lacta" = 2 termos)
      // 2. Sem gramatura E sem embalagem (nao da pra saber qual SKU e)
      // 3. Descricao original muito curta (menos de 12 chars)
      const temGramOuEmb = decomp.gramaturas.length > 0 || decomp.embalagens.length > 0;
      const descCurta = item.produtoNome.trim().length < 12;

      if (totalTermosUteis < 3 || (!temGramOuEmb && totalTermosUteis < 4) || descCurta) {
        mapa.delete(chave);
      }
    }

    // Ordenar por ocorrencias DESC, depois por nome
    const resultado = Array.from(mapa.values());
    resultado.sort((a, b) => b.ocorrencias - a.ocorrencias || a.produtoNome.localeCompare(b.produtoNome));

    return resultado;
  }

  /**
   * Resumo geral de analytics
   */
  static async getResumoAnalytics(dataInicio?: string, dataFim?: string): Promise<ResumoAnalytics> {
    const mensagens = await this.buscarMensagensComparadas(dataInicio, dataFim);

    let totalProdutos = 0;
    let totalOuro = 0;
    let totalPrata = 0;
    let totalBronze = 0;
    let totalRuim = 0;
    let economia = 0;
    let somaMargemMelhoria = 0;
    let countMelhoria = 0;
    const categoriasMap = new Map<string, number>();

    for (const msg of mensagens) {
      const dados = this.parseExtraido(msg);
      if (!dados) continue;

      for (const r of dados.resultados_comparacao) {
        totalProdutos++;
        const classif = r.classificacao || 'ruim';
        if (classif === 'ouro') totalOuro++;
        else if (classif === 'prata') totalPrata++;
        else if (classif === 'bronze') totalBronze++;
        else totalRuim++;

        if (r.boaOferta && r.diferenca > 0) {
          economia += r.diferenca;
        }
        if (r.diferencaMargem > 0) {
          somaMargemMelhoria += r.diferencaMargem;
          countMelhoria++;
        }

        // Top categorias
        const cat = r.produtoLoja?.grupo || r.produtoLoja?.secao;
        if (cat && cat !== '-') {
          categoriasMap.set(cat, (categoriasMap.get(cat) || 0) + 1);
        }
      }
    }

    // Top 5 categorias
    const topCategorias = Array.from(categoriasMap.entries())
      .map(([categoria, count]) => ({ categoria, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Fora do mix count
    const foraMix = await this.getProdutosForaMix(dataInicio, dataFim);

    return {
      totalMensagensComparadas: mensagens.length,
      totalProdutosAnalisados: totalProdutos,
      totalOuro,
      totalPrata,
      totalBronze,
      totalRuim,
      economiaTotal: parseFloat(economia.toFixed(2)),
      margemMediaMelhoria: countMelhoria > 0 ? parseFloat((somaMargemMelhoria / countMelhoria).toFixed(2)) : 0,
      topCategorias,
      totalForaMix: foraMix.length,
    };
  }

  /**
   * Lista produtos Oracle para pesquisa, com filtros de secao/grupo/subgrupo/especie/evento
   */
  static async getProdutosPesquisar(filtros: {
    codSecao?: string;
    codGrupo?: string;
    codSubGrupo?: string;
    tipoEspecie?: string;
    tipoEvento?: string;
  }): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO');
    const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA');
    const tabSecao = await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO');
    const tabGrupo = await MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO');
    const tabSubgrupo = await MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO');
    const tabFornecedor = await MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR');

    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
    const colDescricao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao', 'DES_PRODUTO');
    const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras', 'COD_BARRA');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao', 'COD_SECAO');
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo', 'COD_GRUPO');
    const colCodSubgrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo', 'COD_SUBGRUPO');
    const colTipoEspecie = await MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_especie', 'TIP_ESPECIE');
    const colTipoEvento = await MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_evento', 'TIP_EVENTO');

    const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto', 'COD_PRODUTO');
    const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja', 'COD_LOJA');
    const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo', 'VAL_CUSTO_REP');
    const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA');
    const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual', 'QTD_EST_ATUAL');
    const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva', 'DES_RANK_PRODLOJA');
    const colMargem = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem', 'VAL_MARGEM');
    const colCodFornUltCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra', 'COD_FORN_ULT_COMPRA');

    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao', 'DES_SECAO');
    const colCodSecaoSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao', 'COD_SECAO');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo', 'DES_GRUPO');
    const colCodGrupoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo', 'COD_GRUPO');
    const colCodSecaoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao', 'COD_SECAO');
    const colDesSubgrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo', 'DES_SUB_GRUPO');
    const colCodSubgrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo', 'COD_SUB_GRUPO');
    const colCodSecaoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_secao', 'COD_SECAO');
    const colCodGrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo', 'COD_GRUPO');
    const colCodForn = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor', 'COD_FORNECEDOR');
    const colRazaoSocial = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social', 'DES_FORNECEDOR');

    const codLoja = parseInt((await ConfigurationService.get('garimpador_cod_loja', '1')) || '1');

    // Montar WHERE dinamico
    const where: string[] = ['1=1'];
    const params: any = { codLoja };

    if (filtros.codSecao) {
      where.push(`p.${colCodSecao} = :codSecao`);
      params.codSecao = filtros.codSecao;
    }
    if (filtros.codGrupo) {
      where.push(`p.${colCodGrupo} = :codGrupo`);
      params.codGrupo = filtros.codGrupo;
    }
    if (filtros.codSubGrupo) {
      where.push(`p.${colCodSubgrupo} = :codSubGrupo`);
      params.codSubGrupo = filtros.codSubGrupo;
    }
    if (filtros.tipoEspecie !== undefined && filtros.tipoEspecie !== '') {
      where.push(`NVL(p.${colTipoEspecie}, 0) = :tipoEspecie`);
      params.tipoEspecie = parseInt(filtros.tipoEspecie);
    }
    if (filtros.tipoEvento !== undefined && filtros.tipoEvento !== '') {
      where.push(`NVL(p.${colTipoEvento}, 0) = :tipoEvento`);
      params.tipoEvento = parseInt(filtros.tipoEvento);
    }

    const sql = `
      SELECT
        p.${colCodProduto} AS COD_PRODUTO,
        p.${colCodBarras} AS COD_BARRAS,
        p.${colDescricao} AS DESCRICAO,
        NVL(pl.${colPrecoCusto}, 0) AS CUSTO,
        NVL(pl.${colPrecoVenda}, 0) AS VENDA,
        NVL(pl.${colEstoque}, 0) AS ESTOQUE,
        NVL(pl.${colCurva}, '-') AS CURVA,
        NVL(pl.${colMargem}, 0) AS MARGEM,
        NVL(s.${colDesSecao}, '-') AS SECAO,
        NVL(g.${colDesGrupo}, '-') AS GRUPO,
        NVL(sg.${colDesSubgrupo}, '-') AS SUBGRUPO,
        NVL(f.${colRazaoSocial}, '-') AS FORNECEDOR,
        CASE NVL(p.${colTipoEspecie}, 0)
          WHEN 0 THEN 'MERCADORIA'
          WHEN 2 THEN 'SERVICO'
          WHEN 3 THEN 'IMOBILIZADO'
          WHEN 4 THEN 'INSUMO'
          ELSE 'OUTROS'
        END AS TIPO_ESPECIE,
        CASE NVL(p.${colTipoEvento}, 0)
          WHEN 0 THEN 'DIRETA'
          WHEN 1 THEN 'COMPOSICAO'
          WHEN 2 THEN 'DECOMPOSICAO'
          WHEN 3 THEN 'PRODUCAO'
          ELSE 'OUTROS'
        END AS TIPO_EVENTO
      FROM ${schema}.${tabProduto} p
      LEFT JOIN ${schema}.${tabProdutoLoja} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto} AND pl.${colCodLojaLoja} = :codLoja
      LEFT JOIN ${schema}.${tabSecao} s ON s.${colCodSecaoSecao} = p.${colCodSecao}
      LEFT JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupoGrupo} = p.${colCodGrupo} AND g.${colCodSecaoGrupo} = p.${colCodSecao}
      LEFT JOIN ${schema}.${tabSubgrupo} sg ON sg.${colCodSubgrupoSub} = p.${colCodSubgrupo} AND sg.${colCodSecaoSub} = p.${colCodSecao} AND sg.${colCodGrupoSub} = p.${colCodGrupo}
      LEFT JOIN ${schema}.${tabFornecedor} f ON f.${colCodForn} = pl.${colCodFornUltCompra}
      WHERE ${where.join(' AND ')}
      ORDER BY p.${colDescricao}
    `;

    const rows = await OracleService.query<any>(sql, params);

    return rows.map((r: any) => ({
      codProduto: r.COD_PRODUTO,
      codBarras: r.COD_BARRAS || '',
      descricao: r.DESCRICAO || '',
      custo: parseFloat(r.CUSTO) || 0,
      venda: parseFloat(r.VENDA) || 0,
      estoque: parseFloat(r.ESTOQUE) || 0,
      curva: r.CURVA || '-',
      margem: parseFloat(r.MARGEM) || 0,
      secao: r.SECAO || '-',
      grupo: r.GRUPO || '-',
      subgrupo: r.SUBGRUPO || '-',
      fornecedor: r.FORNECEDOR || '-',
      tipoEspecie: r.TIPO_ESPECIE || 'OUTROS',
      tipoEvento: r.TIPO_EVENTO || 'OUTROS',
    }));
  }
}
