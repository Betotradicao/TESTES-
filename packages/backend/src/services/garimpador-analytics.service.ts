import { AppDataSource } from '../config/database';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';

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
}

interface DetalheItem {
  produtoOfertado: string;
  precoOferta: number;
  produtoLoja: string | null;
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
  static async getRankingFornecedores(dataInicio?: string, dataFim?: string): Promise<RankingFornecedor[]> {
    const mensagens = await this.buscarMensagensComparadas(dataInicio, dataFim);

    // Agregar por contato
    const mapa = new Map<number, RankingFornecedor>();

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
        });
      }

      const rank = mapa.get(cId)!;
      if (!rank.ultimaMensagem && msg.received_at) {
        rank.ultimaMensagem = msg.received_at.toISOString();
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

    // Arredondar economia
    ranking.forEach(r => {
      r.totalEconomia = parseFloat(r.totalEconomia.toFixed(2));
    });

    return ranking;
  }

  /**
   * Detalhes de um fornecedor especifico com filtro de classificacao
   */
  static async getDetalhesFornecedor(contatoId: number, classificacao?: string): Promise<DetalheItem[]> {
    const repo = AppDataSource.getRepository(GarimpadorMensagem);
    const mensagens = await repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contato', 'c')
      .where('m.contato_id = :contatoId', { contatoId })
      .andWhere('m.processado = true')
      .andWhere("m.conteudo_extraido LIKE '%resultados_comparacao%'")
      .orderBy('m.received_at', 'DESC')
      .getMany();

    const itens: DetalheItem[] = [];

    for (const msg of mensagens) {
      const dados = this.parseExtraido(msg);
      if (!dados) continue;

      for (const r of dados.resultados_comparacao) {
        if (classificacao && r.classificacao !== classificacao) continue;

        itens.push({
          produtoOfertado: r.produtoOfertado || '',
          precoOferta: r.precoOferta || 0,
          produtoLoja: r.produtoLoja?.descricao || null,
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
            });
          }
        }
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
}
