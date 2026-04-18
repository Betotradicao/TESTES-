import { AppDataSource } from '../config/database';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';
import { GarimpadorContato } from '../entities/GarimpadorContato';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';
import { ConfigurationService } from './configuration.service';
import { MappingService } from './mapping.service';
import { OracleService } from './oracle.service';
import { PostgresErpService } from './postgres-erp.service';
import { WhatsAppService } from './whatsapp.service';
import { GarimpadorDecomposerService } from './garimpador-decomposer.service';
import { GarimpadorVectorStoreService } from './garimpador-vectorstore.service';
import axios from 'axios';

// Helper: GPT-5+ usa max_completion_tokens e nao suporta temperature customizado
function isNewOpenAIModel(model: string): boolean {
  return model.startsWith('gpt-5') || model.startsWith('gpt-4.1');
}
function buildModelParams(model: string, tokens: number, temperature?: number): Record<string, any> {
  const isNew = isNewOpenAIModel(model);
  return {
    ...(isNew ? { max_completion_tokens: tokens } : { max_tokens: tokens }),
    ...(isNew ? {} : { temperature: temperature ?? 0 }),
  };
}

// Prompts default - usados se nao houver configuracao customizada
const DEFAULT_PROMPT_MATCHING_SQL = `Voce e um especialista em matching de produtos de supermercado brasileiro.

Seu trabalho: dado um produto buscado e uma lista de candidatos do sistema ERP, identifique qual candidato e o MESMO produto.

REGRAS CRITICAS - O SISTEMA ERP USA ABREVIACOES PESADAS:
- CERVEJA = "CERV", DETERGENTE = "DETERG" ou "DET", REFRIGERANTE = "REFRIG", AMACIANTE = "AMAC"
- ACHOCOLATADO = "ACHOC", ABSORVENTE = "ABS", BISCOITO = "BISC", DESODORANTE = "DESOD"
- SANITARIA = "SANIT", MARGARINA = "MARG", MAIONESE = "MAIO", ACUCAR = "ACUC"
- LATA = "LT" ou "LTA", GARRAFA = "GRF", LONGNECK = "LN", CAIXA = "CX", PACOTE = "PCT" ou "PT"
- TETRA PAK = "TP", FARDO = "FD", PET = "PET"
- O nome do produto NO SISTEMA pode estar TOTALMENTE abreviado: "CERV SKOL LT 350ML" = "CERVEJA SKOL LATA 350ML"

PESOS DE IMPORTANCIA (use para decidir):
- MARCA (30%): Criterio MAIS importante. NUNCA misture marcas. Bono!=Negresco, Peroba!=Destac, 88!=Coqueiro, Ducoco!=Kero Coco. Se a marca nao bate, retorne 0.
- PRODUTO/CATEGORIA (25%): Biscoito, Macarrao, Molho, Sardinha, Lustra Movel, Agua de Coco, etc. Deve ser o mesmo tipo.
- GRAMATURA (20%): 350ml=350ml, 1L=1LT, 500g=500gr, 200ml=200ml. Gramaturas diferentes = produto diferente.
- TIPO/VARIANTE (10%): Recheado, Pilsen, Zero, Integral, etc. Deve ser compativel.
- EMBALAGEM (10%): Lata, Long Neck, Pacote, Pote, Tetra Pak. Considerar abreviacoes.
- SABOR/FRAGRANCIA (5%): Uva, Limao, Jasmin, Lavanda, Chocolate. Menor peso mas ainda relevante.

REGRAS DE MATCHING:
- Se a MARCA do produto buscado NAO aparece em NENHUM candidato, retorne 0
- Se a GRAMATURA e diferente, retorne 0 (ex: 200ml != 1L)
- Se o TIPO/CATEGORIA e diferente, retorne 0 (ex: sardinha != atum)
- Se encontrar o produto, retorne APENAS o numero. Se NENHUM corresponder, retorne 0.
- Retorne APENAS um numero, nada mais.`;

const DEFAULT_PROMPT_MATCHING_VETORIAL = `Voce e um especialista em matching de produtos de supermercado brasileiro.

Seu trabalho: dado um produto buscado e uma lista de candidatos do sistema ERP, identifique qual candidato e o MESMO produto.

REGRAS CRITICAS - O SISTEMA ERP USA ABREVIACOES PESADAS:
- CERVEJA = "CERV", DETERGENTE = "DETERG" ou "DET", REFRIGERANTE = "REFRIG", AMACIANTE = "AMAC"
- ACHOCOLATADO = "ACHOC", ABSORVENTE = "ABS", BISCOITO = "BISC", DESODORANTE = "DESOD"
- SANITARIA = "SANIT", MARGARINA = "MARG", MAIONESE = "MAIO", ACUCAR = "ACUC"
- LATA = "LT" ou "LTA", GARRAFA = "GRF", LONGNECK = "LN", CAIXA = "CX", PACOTE = "PCT" ou "PT"
- TETRA PAK = "TP", FARDO = "FD", PET = "PET"
- O nome do produto NO SISTEMA pode estar TOTALMENTE abreviado: "CERV SKOL LT 350ML" = "CERVEJA SKOL LATA 350ML"

PESOS DE IMPORTANCIA (use para decidir):
- MARCA (30%): Criterio MAIS importante. NUNCA misture marcas. Bono!=Negresco, Peroba!=Destac, 88!=Coqueiro, Ducoco!=Kero Coco. Se a marca nao bate, retorne 0.
- PRODUTO/CATEGORIA (25%): Biscoito, Macarrao, Molho, Sardinha, Lustra Movel, Agua de Coco, etc. Deve ser o mesmo tipo.
- GRAMATURA (20%): 350ml=350ml, 1L=1LT, 500g=500gr, 200ml=200ml. Gramaturas diferentes = produto diferente.
- TIPO/VARIANTE (10%): Recheado, Pilsen, Zero, Integral, etc. Deve ser compativel.
- EMBALAGEM (10%): Lata, Long Neck, Pacote, Pote, Tetra Pak. Considerar abreviacoes.
- SABOR/FRAGRANCIA (5%): Uva, Limao, Jasmin, Lavanda, Chocolate. Menor peso mas ainda relevante.

REGRAS DE MATCHING:
- Se a MARCA do produto buscado NAO aparece em NENHUM candidato, retorne 0
- Se a GRAMATURA e diferente, retorne 0 (ex: 200ml != 1L)
- Se o TIPO/CATEGORIA e diferente, retorne 0 (ex: sardinha != atum)
- Use Secao/Grupo/Fornecedor como contexto adicional para desambiguar
- Se encontrar o produto, retorne APENAS o numero. Se NENHUM corresponder, retorne 0.
- Retorne APENAS um numero, nada mais.`;

// Dicionario de abreviacoes comuns em supermercados (Oracle usa formas curtas)
// Formato: palavra completa -> [abreviacoes possiveis no Oracle]
const ABREVIACOES_PRODUTO: Record<string, string[]> = {
  'CERVEJA': ['CERV'],
  'REFRIGERANTE': ['REFRIG', 'REFRI'],
  'DETERGENTE': ['DETERG', 'DET'],
  'AMACIANTE': ['AMAC'],
  'DESINFETANTE': ['DESINF'],
  'ACHOCOLATADO': ['ACHOC'],
  'ABSORVENTE': ['ABS', 'ABSORV'],
  'BISCOITO': ['BISC'],
  'CHOCOLATE': ['CHOC'],
  'DESODORANTE': ['DESOD'],
  'SANITARIA': ['SANIT'],
  'MARGARINA': ['MARG'],
  'MAIONESE': ['MAIO'],
  'SABONETE': ['SAB'],
  'SHAMPOO': ['SHAM'],
  'CONDICIONADOR': ['COND'],
  'ACUCAR': ['ACUC'],
  'FEIJAO': ['FEIJ'],
  'FARINHA': ['FAR'],
  'MACARRAO': ['MAC'],
  'MISTURA': ['MIST'],
  'MANTEIGA': ['MANT'],
  'IOGURTE': ['IOG'],
  'MOLHO': ['MOL'],
  'LINGUICA': ['LING'],
  'MORTADELA': ['MORT'],
  'PRESUNTO': ['PRES'],
  'REQUEIJAO': ['REQ'],
  'QUEIJO': ['QJ'],
  'VINAGRE': ['VIN'],
  'EXTRATO': ['EXT'],
  'CATCHUP': ['CATCH', 'KETCHUP'],
  'MOSTARDA': ['MOST'],
  'INSETICIDA': ['INSET'],
  'ESPONJA': ['ESP'],
  'PAPEL': ['PAP'],
  'TOALHA': ['TOAL'],
  'GUARDANAPO': ['GUARD'],
  'CAFE': ['CAF'],
  'LEITE': ['LT'],
  'SUCO': ['SUC'],
  'CREME': ['CR'],
  'OLEO': ['OL'],
};

// Dicionario de abreviacoes de EMBALAGEM (Oracle usa siglas)
const ABREVIACOES_EMBALAGEM: Record<string, string[]> = {
  'LATA': ['LT', 'LTA'],
  'LATAO': ['LT', 'LTAO'],
  'GARRAFA': ['GRF', 'GF'],
  'LONGNECK': ['LN', 'LONG'],
  'CAIXA': ['CX'],
  'PACOTE': ['PCT', 'PC', 'PT'],
  'SACHE': ['SACHE', 'SCH'],
  'FARDO': ['FD'],
  'VIDRO': ['VD'],
  'POTE': ['PT'],
  'BISNAGA': ['BSN'],
  'BANDEJA': ['BDJ', 'BAND'],
  'UNIDADE': ['UN', 'UND'],
  'LITRO': ['LT'],
  'PET': ['PET'],
  'TETRA': ['TP'],
  'TETRA PAK': ['TP'],
  'SQUEEZE': ['SQZ'],
  'REFIL': ['REF'],
};

const DEFAULT_PROMPT_MATCHING_FALLBACK = 'Voce e um comparador de produtos de supermercado brasileiro. Dado um produto buscado e uma lista de candidatos, retorne APENAS o numero do melhor match. Considere abreviacoes comuns (CERV=CERVEJA, DET=DETERGENTE, AG SANIT=AGUA SANITARIA, FEIJ=FEIJAO, etc). PESOS: MARCA(30%) > PRODUTO(25%) > GRAMATURA(20%) > TIPO(10%) > EMBALAGEM(10%) > SABOR(5%). A MARCA e o criterio MAIS importante - se a marca nao bate, retorne 0. Se a gramatura e diferente, retorne 0. Se nenhum candidato for o mesmo tipo de produto, retorne 0.';

// Correcao de erros de digitacao comuns em produtos
const CORRECAO_TYPOS: Record<string, string> = {
  'CERVEIA': 'CERVEJA',
  'CERVEIJA': 'CERVEJA',
  'CERVEGA': 'CERVEJA',
  'REFRIGERENTE': 'REFRIGERANTE',
  'REFIRGERANTE': 'REFRIGERANTE',
  'DETERJENTE': 'DETERGENTE',
  'DETERGENETE': 'DETERGENTE',
  'SHAMPPO': 'SHAMPOO',
  'SHAMPO': 'SHAMPOO',
  'XAMPU': 'SHAMPOO',
  'MARGARINA': 'MARGARINA',
  'MAIONEZE': 'MAIONESE',
  'MAIONSE': 'MAIONESE',
  'ACUÇAR': 'ACUCAR',
  'ASSUCAR': 'ACUCAR',
  'BISCOUTO': 'BISCOITO',
  'BISCOTO': 'BISCOITO',
  'CHOCLATE': 'CHOCOLATE',
  'CHOCOLOTE': 'CHOCOLATE',
  'DESODORANETE': 'DESODORANTE',
  'DESODORENTE': 'DESODORANTE',
  'SABONETTE': 'SABONETE',
  'CONDISIONADOR': 'CONDICIONADOR',
  'LINGUISA': 'LINGUICA',
  'LINGUÇA': 'LINGUICA',
  'REQUEIJÃO': 'REQUEIJAO',
  'MORATDELA': 'MORTADELA',
  'MORTADELLA': 'MORTADELA',
  'PRESUNTO': 'PRESUNTO',
  'IOGURTHE': 'IOGURTE',
  'YOGURT': 'IOGURTE',
  'YOGURTE': 'IOGURTE',
  'CATCHAP': 'CATCHUP',
  'KATCHUP': 'CATCHUP',
  'KETCCHUP': 'KETCHUP',
  'INSENTICIDA': 'INSETICIDA',
  'GUARADNAPO': 'GUARDANAPO',
  'EZPONJA': 'ESPONJA',
  'AMASIANTE': 'AMACIANTE',
  'AMAZIANTE': 'AMACIANTE',
  'DEZINFETANTE': 'DESINFETANTE',
};

/**
 * Corrige erros de digitacao comuns na descricao do produto
 */
function corrigirTypos(texto: string): string {
  let corrigido = texto.toUpperCase();
  for (const [errado, certo] of Object.entries(CORRECAO_TYPOS)) {
    corrigido = corrigido.replace(new RegExp(`\\b${errado}\\b`, 'g'), certo);
  }
  return corrigido;
}

/**
 * Converte termos completos para abreviacoes do Oracle.
 * Ex: "ITAIPAVA CERVEJA LATA 269ML" -> "ITAIPAVA CERV LT 269ML"
 * Isso melhora a busca vetorial pois os embeddings no VectorStore sao das descricoes abreviadas.
 */
function abreviarParaOracle(texto: string): string {
  let result = texto.toUpperCase();
  // Aplicar abreviacoes de produto (usar primeira abreviacao)
  for (const [completo, abrevs] of Object.entries(ABREVIACOES_PRODUTO)) {
    result = result.replace(new RegExp(`\\b${completo}\\b`, 'g'), abrevs[0]);
  }
  // Aplicar abreviacoes de embalagem
  for (const [completo, abrevs] of Object.entries(ABREVIACOES_EMBALAGEM)) {
    result = result.replace(new RegExp(`\\b${completo}\\b`, 'g'), abrevs[0]);
  }
  return result;
}

interface CondicaoPreco {
  tipo: string;
  preco: number;
}

interface ProdutoExtraido {
  produto: string;
  preco: number;
  condicao?: string;
  condicoes?: CondicaoPreco[];
}

interface ProdutoOracle {
  codProduto: string;
  codigo_barras: string;
  descricao: string;
  preco_custo: number;
  preco_venda: number;
  preco_venda_concorrente: number;
  estoque_atual: number;
  cobertura: number;
  pedido_compra: number;
  curva: string;
  venda_media_dia: number;
  venda_30d: number;
  margem_referencia: number;
  secao: string;
  grupo: string;
  subgrupo: string;
  fornecedor: string;
  matchScore: number;
}

interface CandidatoInfo {
  descricao: string;
  similarity?: number;
  secao?: string;
  grupo?: string;
  fornecedor?: string;
}

interface ResultadoComparacao {
  produtoOfertado: string;
  precoOferta: number;
  condicao?: string;
  condicoes?: CondicaoPreco[];
  produtoLoja: ProdutoOracle | null;
  candidatos?: CandidatoInfo[];
  diferenca: number;
  boaOferta: boolean;
  margemAtual: number;
  margemFutura: number;
  margemMeta: number;
  diferencaMargem: number;
  classificacao: 'ouro' | 'prata' | 'bronze' | 'ruim';
  matchScore: number;
}

/**
 * Service responsavel por comparar produtos extraidos com o banco Oracle,
 * classificar oportunidades e enviar para grupos WhatsApp.
 */
export class GarimpadorComparadorService {

  /**
   * Detecta tipo do banco ativo (oracle/postgresql). Usa o mesmo padrao de outras telas.
   */
  private static async detectDbType(): Promise<'oracle' | 'postgresql'> {
    try {
      if (!AppDataSource.isInitialized) return 'oracle';
      const repo = AppDataSource.getRepository(DatabaseConnection);
      let conn = await repo.findOne({ where: { is_default: true, status: ConnectionStatus.ACTIVE } });
      if (!conn) conn = await repo.findOne({ where: { status: ConnectionStatus.ACTIVE } });
      if (!conn) conn = await repo.findOne({ where: {}, order: { id: 'ASC' } });
      if (conn?.type === DatabaseType.POSTGRESQL) return 'postgresql';
      return 'oracle';
    } catch { return 'oracle'; }
  }

  /**
   * Retorna helpers de SQL vendor-specific para NVL/SYSDATE/LIMIT.
   */
  private static sqlVendor(type: 'oracle' | 'postgresql') {
    const isPg = type === 'postgresql';
    return {
      isPg,
      nvl: (field: string, def: string | number): string => isPg ? `COALESCE(${field}, ${def})` : `NVL(${field}, ${def})`,
      sysdateMinus: (n: number): string => isPg ? `(CURRENT_DATE - ${n})` : `(SYSDATE - ${n})`,
      wrapLimit: (innerSql: string, n: number): string => isPg ? `${innerSql} LIMIT ${n}` : `SELECT * FROM (${innerSql}) WHERE ROWNUM <= ${n}`,
      upper: (f: string): string => `UPPER(${f})`,
    };
  }

  /**
   * Executa query no banco ativo (Oracle ou PostgreSQL).
   * Em PG, converte :nome -> $N na ordem que aparece.
   */
  private static async runQuery<T = any>(type: 'oracle' | 'postgresql', sql: string, params: Record<string, any>): Promise<T[]> {
    let rows: any[];
    if (type === 'postgresql') {
      const paramArray: any[] = [];
      const seen: Map<string, number> = new Map();
      let counter = 0;
      const pgSql = sql.replace(/:(\w+)/g, (_m, name) => {
        if (seen.has(name)) return `$${seen.get(name)}`;
        counter++;
        seen.set(name, counter);
        paramArray.push(params[name]);
        return `$${counter}`;
      });
      rows = await PostgresErpService.query<any>(pgSql, paramArray);
      // Normaliza chaves pra uppercase (codigo legado espera formato Oracle)
      rows = rows.map(r => {
        const up: any = {};
        for (const k of Object.keys(r)) up[k.toUpperCase()] = r[k];
        return up;
      });
    } else {
      rows = await OracleService.query<any>(sql, params);
    }
    return rows as T[];
  }

  /**
   * Busca coluna mapeada sem fallback. Retorna null se nao mapeada.
   * Usado pra colunas opcionais (cobertura, pedido_compra, subgrupo) que podem nao existir em todos os ERPs.
   */
  private static async getOptionalCol(tableId: string, fieldName: string): Promise<string | null> {
    try {
      const mappings = await MappingService.getMappings();
      const t = (mappings as any)?.tabelas?.[tableId];
      if (t?.colunas?.[fieldName]) return t.colunas[fieldName];
      return null;
    } catch { return null; }
  }

  /**
   * Retorna as lojas participantes e o modo de referencia de custo/preco.
   * Defaults: lojas=[1], refCusto='menor'
   */
  private static async getLojasGarimpador(): Promise<{ lojas: number[]; refCusto: 'menor' | 'medio' }> {
    const lojasStr = (await ConfigurationService.get('garimpador_lojas_participantes', '[1]')) || '[1]';
    const refRaw = (await ConfigurationService.get('garimpador_ref_custo', 'menor')) || 'menor';
    let lojas: number[] = [1];
    try {
      const parsed = JSON.parse(lojasStr);
      if (Array.isArray(parsed)) {
        lojas = parsed.map((n: any) => parseInt(String(n))).filter((n: number) => !isNaN(n));
      }
    } catch { /* usa default */ }
    if (lojas.length === 0) {
      const legacy = parseInt((await ConfigurationService.get('garimpador_cod_loja', '1')) || '1');
      lojas = [isNaN(legacy) ? 1 : legacy];
    }
    const refCusto: 'menor' | 'medio' = refRaw === 'medio' ? 'medio' : 'menor';
    return { lojas, refCusto };
  }

  /**
   * Monta o fragmento SQL da subquery de TAB_PRODUTO_LOJA agregada por lojas.
   * Quando ha varias lojas selecionadas, aplica MIN ou AVG (refCusto) em custo/preco
   * e SUM em estoque/cobertura/pedido. Para loja unica, agrega mesmo assim (idempotente).
   */
  private static buildPlSubquery(args: {
    schema: string;
    tabProdutoLoja: string;
    colCodProdutoLoja: string;
    colCodLojaLoja: string;
    colPrecoCusto: string;
    colPrecoVenda: string;
    colPesquisaMedia: string;
    colEstoque: string;
    colCobertura: string | null;
    colPedidoCompra: string | null;
    colCurva: string;
    colVendaMedia: string | null;
    colMargem: string;
    colCodFornUltCompra: string;
    colInativo: string;
    lojas: number[];
    refCusto: 'menor' | 'medio';
  }): { sql: string; params: Record<string, any> } {
    const agg = args.refCusto === 'medio' ? 'AVG' : 'MIN';
    const binds = args.lojas.map((_, i) => `:l${i}`).join(',');
    const params: Record<string, any> = {};
    args.lojas.forEach((v, i) => { params[`l${i}`] = v; });
    // Helpers pra colunas opcionais (retornam "0 AS alias" quando nao mapeadas)
    const aggOrZero = (col: string | null, aggFn: string, alias: string) =>
      col ? `${aggFn}(${col}) AS ${col}` : `0 AS ${alias}`;
    const sql = `(
      SELECT
        ${args.colCodProdutoLoja} AS ${args.colCodProdutoLoja},
        ${agg}(${args.colPrecoCusto}) AS ${args.colPrecoCusto},
        ${agg}(${args.colPrecoVenda}) AS ${args.colPrecoVenda},
        ${agg}(${args.colPesquisaMedia}) AS ${args.colPesquisaMedia},
        SUM(${args.colEstoque}) AS ${args.colEstoque},
        ${aggOrZero(args.colCobertura, 'SUM', 'QTD_COBERTURA')},
        ${aggOrZero(args.colPedidoCompra, 'SUM', 'QTD_PEDIDO_COMPRA')},
        MIN(${args.colCurva}) AS ${args.colCurva},
        ${aggOrZero(args.colVendaMedia, agg, 'VAL_VENDA_MEDIA')},
        ${agg}(${args.colMargem}) AS ${args.colMargem},
        MIN(${args.colCodFornUltCompra}) AS ${args.colCodFornUltCompra},
        MIN(${args.colInativo}) AS ${args.colInativo}
      FROM ${args.schema}.${args.tabProdutoLoja}
      WHERE CAST(${args.colCodLojaLoja} AS INTEGER) IN (${binds})
      GROUP BY ${args.colCodProdutoLoja}
    )`;
    return { sql, params };
  }


  /**
   * Processa uma mensagem: busca produtos no Oracle, compara e envia para WhatsApp
   */
  static async compararEEnviar(mensagemId: number): Promise<{ total: number; enviadas: number; resultados: ResultadoComparacao[] }> {
    const msgRepo = AppDataSource.getRepository(GarimpadorMensagem);
    const mensagem = await msgRepo.findOne({ where: { id: mensagemId }, relations: ['contato'] });

    if (!mensagem) throw new Error('Mensagem nao encontrada');
    if (!mensagem.conteudo_extraido) throw new Error('Mensagem nao possui conteudo extraido');

    let produtos: ProdutoExtraido[];
    try {
      produtos = JSON.parse(mensagem.conteudo_extraido);
      if (!Array.isArray(produtos) || produtos.length === 0) {
        throw new Error('Nenhum produto extraido');
      }
    } catch (e: any) {
      throw new Error(`Erro ao parsear conteudo_extraido: ${e.message}`);
    }

    // Buscar tipo do contato (fornecedor ou concorrente)
    const contato = mensagem.contato;
    const tipoContato = contato?.tipo || 'nao_classificado';

    const resultados: ResultadoComparacao[] = [];
    let enviadas = 0;

    // Carregar produtos excluidos
    let produtosExcluidos: string[] = [];
    try {
      const raw = await ConfigurationService.get('garimpador_produtos_excluidos', '[]');
      produtosExcluidos = JSON.parse(raw || '[]');
    } catch { }

    for (const prod of produtos) {
      try {
        // 1. Buscar produto no Oracle (retorna match + candidatos encontrados)
        const busca = await this.buscarProdutoOracle(prod.produto);

        if (!busca.match) {
          console.log(`[Garimpador Comparador] Produto nao encontrado: ${prod.produto} (${busca.candidatos.length} candidatos rejeitados)`);
          // Incluir nos resultados com produtoLoja null + candidatos para visibilidade
          resultados.push({
            produtoOfertado: prod.produto,
            precoOferta: prod.preco,
            condicao: prod.condicao,
            condicoes: prod.condicoes,
            produtoLoja: null,
            candidatos: busca.candidatos.slice(0, 10), // top 10 candidatos
            diferenca: 0,
            boaOferta: false,
            margemAtual: 0,
            margemFutura: 0,
            margemMeta: 0,
            diferencaMargem: 0,
            classificacao: 'ruim',
            matchScore: 0,
          });
          continue;
        }

        // 2. Comparar precos e calcular margens
        const resultado = this.calcularComparacao(prod, busca.match);

        // 3. Classificar (Ouro/Prata/Bronze)
        resultado.classificacao = await this.classificar(resultado.diferencaMargem);

        // Incluir candidatos para visibilidade no frontend
        resultado.candidatos = busca.candidatos.slice(0, 10);

        resultados.push(resultado);

        // 4. Verificar se produto esta excluido
        const codProdStr = String(busca.match.codProduto);
        if (produtosExcluidos.includes(codProdStr)) {
          console.log(`[Garimpador Comparador] Produto ${codProdStr} excluido - nao envia pro WhatsApp`);
          continue;
        }

        // 5. Se for boa oferta (preco oferta < custo), enviar para WhatsApp
        if (resultado.boaOferta) {
          const msgFormatada = this.formatarMensagem(resultado, tipoContato, contato, mensagem.media_url);
          const enviou = await this.enviarParaGrupo(msgFormatada, resultado.classificacao, tipoContato);
          if (enviou) enviadas++;
        }
      } catch (err: any) {
        console.error(`[Garimpador Comparador] Erro ao processar "${prod.produto}":`, err.message);
      }
    }

    // Salvar resultados na mensagem
    await msgRepo.update(mensagemId, {
      conteudo_extraido: JSON.stringify({
        produtos_originais: produtos,
        resultados_comparacao: resultados,
        total_enviadas: enviadas,
        data_comparacao: new Date().toISOString(),
      }),
    });

    console.log(`[Garimpador Comparador] Mensagem ${mensagemId}: ${resultados.length} comparados, ${enviadas} enviadas`);
    return { total: produtos.length, enviadas, resultados };
  }

  /**
   * Busca produto - Abordagem vetorial (inspirada no Garimpador 2.0 n8n):
   * 1. Busca vetorial via PGVector (embedding semantico) -> top 15 candidatos
   * 2. GPT avalia candidatos COM dados completos (secao, grupo, fornecedor)
   * 3. Fallback: se cache vazio, usa SQL LIKE no Oracle (metodo antigo)
   * Retorna { match, candidatos } para transparencia (mostrar candidatos no frontend)
   */
  static async buscarProdutoOracle(descricaoBusca: string): Promise<{ match: ProdutoOracle | null; candidatos: CandidatoInfo[] }> {
    try {
      // Corrigir typos comuns antes de buscar
      const descCorrigida = corrigirTypos(descricaoBusca);
      if (descCorrigida !== descricaoBusca.toUpperCase()) {
        console.log(`[Garimpador] Typo corrigido: "${descricaoBusca}" -> "${descCorrigida}"`);
      }
      const termoBusca = descCorrigida !== descricaoBusca.toUpperCase() ? descCorrigida : descricaoBusca;

      // === TENTAR BUSCA VETORIAL PRIMEIRO ===
      const resultadoVetorial = await this.buscarProdutoVetorial(termoBusca);
      if (resultadoVetorial !== undefined) {
        // undefined = cache vazio (fallback pra LIKE), { match, candidatos }
        return resultadoVetorial;
      }

      // === FALLBACK: SQL LIKE (metodo antigo, quando cache PGVector vazio) ===
      console.log(`[Garimpador] Cache vetorial vazio, usando fallback SQL LIKE para "${descricaoBusca}"`);
      const schema = await MappingService.getSchema();

      // Tabelas
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO');
      const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA');
      const tabProdutoPdv = await MappingService.getRealTableName('TAB_PRODUTO_PDV', 'TAB_PRODUTO_PDV');
      const tabFornecedor = await MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR');
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO');
      const tabGrupo = await MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO');
      const tabSubgrupo = await MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO');

      // Colunas TAB_PRODUTO
      const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
      const colDescricao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao', 'DES_PRODUTO');
      const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras', 'COD_BARRA');
      const colCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo', 'COD_GRUPO');
      const colCodSubgrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo', 'COD_SUBGRUPO');

      // Colunas TAB_PRODUTO_LOJA
      const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'custo_medio', 'VAL_CUSTO_MEDIO');
      const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA');
      const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual', 'QTD_EST_ATUAL');
      const colCobertura = await this.getOptionalCol('TAB_PRODUTO_LOJA', 'cobertura');
      const colPedidoCompra = await this.getOptionalCol('TAB_PRODUTO_LOJA', 'pedido_compra');
      const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva', 'DES_RANK_PRODLOJA');
      const colVendaMedia = await this.getOptionalCol('TAB_PRODUTO_LOJA', 'venda_media');
      const colMargem = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem', 'VAL_MARGEM');
      const colPesquisaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media', 'VAL_PESQUISA_MEDIA');
      const colCodFornUltCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra', 'COD_FORN_ULT_COMPRA');
      const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja', 'COD_LOJA');

      // Coluna de produto inativo (fora do mix)
      let colInativo = 'INATIVO';
      try {
        const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
        if (mapped) colInativo = mapped;
      } catch (e) { /* usa default */ }

      // Colunas de descricao das categorias
      const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao', 'DES_SECAO');
      const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo', 'DES_GRUPO');
      const colDesSubgrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo', 'DES_SUB_GRUPO');

      // Coluna fornecedor
      const colCodForn = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor', 'COD_FORNECEDOR');
      const colRazaoSocial = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social', 'DES_FORNECEDOR');

      // Colunas TAB_PRODUTO_PDV para vendas 30 dias
      const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto', 'COD_PRODUTO');
      const colQtdVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade', 'QTD_TOTAL_PRODUTO');
      const colDataVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda', 'DTA_SAIDA');

      // Colunas de join
      const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto', 'COD_PRODUTO');
      const colCodSecaoSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo', 'COD_GRUPO');
      const colCodSecaoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao', 'COD_SECAO');
      const colCodSubgrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo', 'COD_SUB_GRUPO');
      const colCodSecaoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo', 'COD_GRUPO');

      const { lojas, refCusto } = await this.getLojasGarimpador();
      const plSub = this.buildPlSubquery({
        schema, tabProdutoLoja, colCodProdutoLoja, colCodLojaLoja,
        colPrecoCusto, colPrecoVenda, colPesquisaMedia, colEstoque, colCobertura,
        colPedidoCompra, colCurva, colVendaMedia, colMargem, colCodFornUltCompra,
        colInativo, lojas, refCusto,
      });

      const dbType = await this.detectDbType();
      const vendor = this.sqlVendor(dbType);
      const hasSubgrupo = tabSubgrupo !== 'TAB_SUBGRUPO';

      // ========== PASSO 1: IA DECOMPOE O PRODUTO DE ENTRADA ==========
      await GarimpadorDecomposerService.carregarMarcasOracle();
      const decomp = await GarimpadorDecomposerService.decomporComIA(descricaoBusca);

      console.log(`[Garimpador] Buscando "${descricaoBusca}" → decomp: marcas=[${decomp.marcas}] gram=[${decomp.gramaturas.map(g=>g.textoOriginal)}] desc=[${decomp.descricao}] emb=[${decomp.embalagens}] var=[${decomp.variantes}]`);

      // ========== PASSO 2: SQL BUSCA AMPLA - PEGAR CANDIDATOS ==========
      // Montar termos de busca com variantes para abreviacoes
      const termosLike: string[] = [];
      const params: any = { ...plSub.params };
      let pi = 0;

      // Marcas - buscar com variantes (ex: TRES CORACOES -> 3 CORACOES)
      for (const marca of decomp.marcas) {
        const variantes = GarimpadorDecomposerService.gerarVariantesMarca(marca);
        for (const v of variantes) {
          const k = `p${pi++}`;
          params[k] = `%${v}%`;
          termosLike.push(`UPPER(p.${colDescricao}) LIKE :${k}`);
        }
      }

      // Gramaturas - variantes (1L->1LT, 500G->500GR, 269ML->"269 ML")
      for (const gram of decomp.gramaturas) {
        const gramVariants: string[] = [gram.textoOriginal];
        // Variante COM espaco (Oracle pode ter "269 ML" em vez de "269ML")
        gramVariants.push(`${gram.valor} ${gram.unidade}`);
        if (gram.unidade === 'L') { gramVariants.push(`${gram.valor}LT`); gramVariants.push(`${gram.valor} LT`); }
        if (gram.unidade === 'G') { gramVariants.push(`${gram.valor}GR`); gramVariants.push(`${gram.valor} GR`); }
        if (gram.unidade === 'ML') { gramVariants.push(`${gram.valor} ML`); }
        if (gram.unidade === 'KG') { gramVariants.push(`${gram.valor} KG`); }
        // Deduplicar
        const uniqueGram = [...new Set(gramVariants)];
        for (const gv of uniqueGram) {
          const k = `p${pi++}`;
          params[k] = `%${gv}%`;
          termosLike.push(`UPPER(p.${colDescricao}) LIKE :${k}`);
        }
      }

      // Descricao/tipo - usar dicionario de abreviacoes em vez de truncar cegamente
      for (const d of decomp.descricao) {
        const variantes: string[] = [d]; // termo original sempre
        // Buscar abreviacoes conhecidas
        const abrevs = ABREVIACOES_PRODUTO[d];
        if (abrevs) {
          variantes.push(...abrevs);
        } else if (d.length >= 6) {
          // Se nao tem no dicionario e e longo, truncar em 4 chars (nao 3!)
          variantes.push(d.substring(0, 4));
        }
        // Deduplicar
        const uniqueDesc = [...new Set(variantes)];
        for (const v of uniqueDesc) {
          const k = `p${pi++}`;
          params[k] = `%${v}%`;
          termosLike.push(`UPPER(p.${colDescricao}) LIKE :${k}`);
        }
      }

      // Embalagens - usar dicionario de abreviacoes de embalagem
      for (const emb of decomp.embalagens) {
        const embVariantes: string[] = [emb];
        const abrevs = ABREVIACOES_EMBALAGEM[emb];
        if (abrevs) {
          embVariantes.push(...abrevs);
        }
        const uniqueEmb = [...new Set(embVariantes)];
        for (const v of uniqueEmb) {
          const k = `p${pi++}`;
          params[k] = `%${v}%`;
          termosLike.push(`UPPER(p.${colDescricao}) LIKE :${k}`);
        }
      }
      for (const v of decomp.variantes) {
        const k = `p${pi++}`;
        params[k] = `%${v}%`;
        termosLike.push(`UPPER(p.${colDescricao}) LIKE :${k}`);
      }

      // Fallback: se nenhum termo decomposto, usar termos brutos da descricao
      if (termosLike.length === 0) {
        const termosBrutos = descricaoBusca
          .toUpperCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(t => t.length >= 3);
        for (const t of termosBrutos) {
          const k = `p${pi++}`;
          params[k] = `%${t}%`;
          termosLike.push(`UPPER(p.${colDescricao}) LIKE :${k}`);
        }
      }

      if (termosLike.length === 0) return { match: null, candidatos: [] };

      // Busca com OR amplo + score simples (contagem de termos que batem)
      const scoreCalc = termosLike.map(cond => `CASE WHEN ${cond.replace(`UPPER(p.${colDescricao}) LIKE`, `UPPER(p.${colDescricao}) LIKE`)} THEN 1 ELSE 0 END`).join(' + ');
      const orConds = termosLike.join(' OR ');

      const subgrupoSelect = hasSubgrupo ? `${vendor.nvl(`sg.${colDesSubgrupo}`, `'-'`)} AS SUBGRUPO,` : `'-' AS SUBGRUPO,`;
      const subgrupoJoin = hasSubgrupo ? `LEFT JOIN ${schema}.${tabSubgrupo} sg ON sg.${colCodSubgrupoSub} = p.${colCodSubgrupo} AND sg.${colCodSecaoSub} = p.${colCodSecao} AND sg.${colCodGrupoSub} = p.${colCodGrupo}` : '';
      const innerSql = `
        SELECT
          p.${colCodProduto} AS COD_PRODUTO,
          p.${colCodBarras} AS CODIGO_BARRAS,
          p.${colDescricao} AS DESCRICAO,
          ${vendor.nvl(`pl.${colPrecoCusto}`, 0)} AS PRECO_CUSTO,
          ${vendor.nvl(`pl.${colPrecoVenda}`, 0)} AS PRECO_VENDA,
          ${vendor.nvl(`pl.${colPesquisaMedia}`, 0)} AS PRECO_VENDA_CONCORRENTE,
          ${vendor.nvl(`pl.${colEstoque}`, 0)} AS ESTOQUE_ATUAL,
          ${colCobertura ? vendor.nvl(`pl.${colCobertura}`, 0) : '0'} AS COBERTURA,
          ${colPedidoCompra ? vendor.nvl(`pl.${colPedidoCompra}`, 0) : '0'} AS PEDIDO_COMPRA,
          ${vendor.nvl(`pl.${colCurva}`, `'-'`)} AS CURVA,
          ${colVendaMedia ? vendor.nvl(`pl.${colVendaMedia}`, 0) : '0'} AS VENDA_MEDIA_DIA,
          ${vendor.nvl(`pl.${colMargem}`, 0)} AS MARGEM_REFERENCIA,
          ${vendor.nvl(`s.${colDesSecao}`, `'-'`)} AS SECAO,
          ${vendor.nvl(`g.${colDesGrupo}`, `'-'`)} AS GRUPO,
          ${subgrupoSelect}
          ${vendor.nvl(`f.${colRazaoSocial}`, `'-'`)} AS FORNECEDOR,
          (
            SELECT ${vendor.nvl(`SUM(pdv.${colQtdVendaPdv})`, 0)}
            FROM ${schema}.${tabProdutoPdv} pdv
            WHERE pdv.${colCodProdutoPdv} = p.${colCodProduto}
              AND pdv.${colDataVendaPdv} >= ${vendor.sysdateMinus(30)}
          ) AS VENDA_30D,
          (${scoreCalc}) AS MATCH_SCORE
        FROM ${schema}.${tabProduto} p
        LEFT JOIN ${plSub.sql} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto}
        LEFT JOIN ${schema}.${tabSecao} s ON s.${colCodSecaoSecao} = p.${colCodSecao}
        LEFT JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupoGrupo} = p.${colCodGrupo} AND g.${colCodSecaoGrupo} = p.${colCodSecao}
        ${subgrupoJoin}
        LEFT JOIN ${schema}.${tabFornecedor} f ON f.${colCodForn} = pl.${colCodFornUltCompra}
        WHERE (${orConds})
          AND ${vendor.nvl(`pl.${colInativo}`, `'N'`)} != 'S'
        ORDER BY (${scoreCalc}) DESC, ${vendor.nvl(`pl.${colPrecoVenda}`, 0)} DESC
      `;
      const sql = vendor.wrapLimit(innerSql, 15);

      let rows: any[];
      try {
        rows = await this.runQuery<any>(dbType, sql, params);
      } catch (queryErr: any) {
        console.error(`[Garimpador] Erro na query ${dbType}:`, queryErr.message);
        return { match: null, candidatos: [] };
      }

      console.log(`[Garimpador] SQL encontrou ${rows.length} candidatos para "${descricaoBusca}"`);

      // Extrair info dos candidatos SQL para retornar ao frontend
      const candidatosSql: CandidatoInfo[] = rows.map((r: any) => ({
        descricao: r.DESCRICAO,
        secao: r.SECAO,
        grupo: r.GRUPO,
        fornecedor: r.FORNECEDOR,
      }));

      if (rows.length === 0) return { match: null, candidatos: [] };

      // ========== PASSO 3: IA DECIDE QUAL CANDIDATO E O CORRETO ==========
      const apiKey = await ConfigurationService.get('openai_api_key');
      const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');

      if (!apiKey) {
        // Sem IA, usa primeiro resultado (fallback)
        return { match: this.mapearProdutoOracle(rows[0], 50), candidatos: candidatosSql };
      }

      // Montar lista de candidatos para a IA avaliar
      const listaCandidatos = rows.map((r: any, i: number) => `${i + 1}. ${r.DESCRICAO}`).join('\n');

      console.log(`[Garimpador SQL] Candidatos para GPT:\n${listaCandidatos}`);

      // Ler prompt customizado ou usar default
      const promptSql = (await ConfigurationService.get('garimpador_prompt_matching_sql')) || DEFAULT_PROMPT_MATCHING_SQL;

      // User message com decomposicao e reforco de abreviacoes
      const marcaInfo = decomp.marcas.length > 0 ? `MARCA identificada: "${decomp.marcas.join(', ')}" - o candidato DEVE conter esta marca!` : '';
      const gramInfo = decomp.gramaturas.length > 0 ? `GRAMATURA: ${decomp.gramaturas.map(g => g.textoOriginal).join(', ')}` : '';
      const tipoInfo = decomp.descricao.length > 0 ? `TIPO: ${decomp.descricao.join(' ')}` : '';

      const userMsgSql = `Produto buscado: "${descricaoBusca}"
${marcaInfo ? `\n${marcaInfo}` : ''}${gramInfo ? `\n${gramInfo}` : ''}${tipoInfo ? `\n${tipoInfo}` : ''}

LEMBRETE: Os nomes no sistema ERP sao ABREVIADOS. Exemplos reais:
- "CERVEJA" aparece como "CERV"
- "LATA" aparece como "LT"
- "GARRAFA" aparece como "GRF"
- "DETERGENTE" aparece como "DET"
- "REFRIGERANTE" aparece como "REFRIG"
Portanto "CERV ITAIPAVA LT 269ML" = "CERVEJA ITAIPAVA LATA 269ML"

Candidatos do sistema:
${listaCandidatos}

Qual numero corresponde ao produto buscado? (0 se nenhum):`;

      const effectiveModel = model || 'gpt-4o-mini';
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: effectiveModel,
          messages: [
            {
              role: 'system',
              content: promptSql
            },
            {
              role: 'user',
              content: userMsgSql,
            },
          ],
          ...buildModelParams(effectiveModel, 10),
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const resposta = response.data.choices?.[0]?.message?.content?.trim();
      console.log(`[Garimpador SQL] GPT raw response: "${resposta}" para "${descricaoBusca}"`);
      const escolha = parseInt(resposta);

      if (escolha === 0 || isNaN(escolha)) {
        console.log(`[Garimpador] IA decidiu: NENHUM candidato corresponde a "${descricaoBusca}" → Fora do Mix`);
        return { match: null, candidatos: candidatosSql };
      }

      const idx = escolha - 1;
      if (idx < 0 || idx >= rows.length) {
        console.log(`[Garimpador] IA retornou indice invalido ${escolha} para "${descricaoBusca}"`);
        return { match: null, candidatos: candidatosSql };
      }

      const escolhido = rows[idx];
      console.log(`[Garimpador] IA decidiu: "${descricaoBusca}" → "${escolhido.DESCRICAO}" (candidato ${escolha}/${rows.length})`);

      return { match: this.mapearProdutoOracle(escolhido, 90), candidatos: candidatosSql };
    } catch (error: any) {
      console.error('[Garimpador] Erro ao buscar produto no Oracle:', error.message);
      return { match: null, candidatos: [] };
    }
  }

  /**
   * Busca produto via PGVector (busca vetorial semantica)
   * Retorna: { match, candidatos } | undefined (cache vazio -> fallback LIKE)
   */
  private static async buscarProdutoVetorial(descricaoBusca: string): Promise<{ match: ProdutoOracle | null; candidatos: CandidatoInfo[] } | undefined> {
    try {
      // Verificar se cache tem dados
      const stats = await GarimpadorVectorStoreService.stats();
      if (stats.comEmbedding === 0) {
        return undefined; // Sinaliza para usar fallback LIKE
      }

      // Busca hibrida: vetorial + trigram + abreviado
      // 1. buscarHibrido com termo original (vetorial + texto)
      // 2. buscarSimilares com termo abreviado (estilo Oracle)
      const termoAbreviado = abreviarParaOracle(descricaoBusca);
      const buscas: Promise<any[]>[] = [GarimpadorVectorStoreService.buscarHibrido(descricaoBusca, 15)];
      if (termoAbreviado !== descricaoBusca.toUpperCase()) {
        console.log(`[Garimpador Vetorial] + busca abreviada: "${termoAbreviado}"`);
        buscas.push(GarimpadorVectorStoreService.buscarSimilares(termoAbreviado, 10));
      }
      const resultados = await Promise.all(buscas);

      // Combinar e deduplicar por cod_produto, mantendo maior similarity
      const candidatosMap = new Map<string, any>();
      for (const lista of resultados) {
        for (const c of lista) {
          const existing = candidatosMap.get(c.cod_produto);
          if (!existing || c.similarity > existing.similarity) {
            candidatosMap.set(c.cod_produto, c);
          }
        }
      }
      const candidatos = Array.from(candidatosMap.values())
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 15);

      // Extrair info dos candidatos para retornar ao frontend
      const candidatosInfo: CandidatoInfo[] = candidatos.map(c => ({
        descricao: c.descricao,
        similarity: c.similarity,
        secao: c.secao,
        grupo: c.grupo,
        fornecedor: c.fornecedor,
      }));

      if (candidatos.length === 0) {
        console.log(`[Garimpador Vetorial] Nenhum candidato para "${descricaoBusca}"`);
        return { match: null, candidatos: [] };
      }

      console.log(`[Garimpador Vetorial] ${candidatos.length} candidatos para "${descricaoBusca}" (sim: ${candidatos[0]?.similarity.toFixed(3)} ~ ${candidatos[candidatos.length-1]?.similarity.toFixed(3)})`);

      // GPT decide com dados completos (secao, grupo, fornecedor, custo)
      const apiKey = await ConfigurationService.get('openai_api_key');
      const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');

      if (!apiKey) {
        // Sem GPT, usa primeiro candidato se similaridade > 0.7
        if (candidatos[0].similarity >= 0.7) {
          return { match: this.candidatoParaProdutoOracle(candidatos[0], Math.round(candidatos[0].similarity * 100)), candidatos: candidatosInfo };
        }
        return { match: null, candidatos: candidatosInfo };
      }

      // Montar lista com dados completos para GPT avaliar
      const listaCandidatos = candidatos.map((c, i) =>
        `${i + 1}. ${c.descricao} | Secao: ${c.secao} | Grupo: ${c.grupo} | Custo: R$${c.preco_custo.toFixed(2)} | Fornecedor: ${c.fornecedor} | Sim: ${(c.similarity * 100).toFixed(0)}%`
      ).join('\n');

      console.log(`[Garimpador Vetorial] Candidatos para GPT:\n${listaCandidatos}`);

      // Ler prompt customizado ou usar default
      const promptVetorial = (await ConfigurationService.get('garimpador_prompt_matching_vetorial')) || DEFAULT_PROMPT_MATCHING_VETORIAL;

      // User message com decomposicao e reforco de abreviacoes
      const decompVet = await GarimpadorDecomposerService.decomporComIA(descricaoBusca);
      const marcaInfoV = decompVet.marcas.length > 0 ? `MARCA identificada: "${decompVet.marcas.join(', ')}" - o candidato DEVE conter esta marca!` : '';
      const gramInfoV = decompVet.gramaturas.length > 0 ? `GRAMATURA: ${decompVet.gramaturas.map(g => g.textoOriginal).join(', ')}` : '';
      const tipoInfoV = decompVet.descricao.length > 0 ? `TIPO: ${decompVet.descricao.join(' ')}` : '';

      const userMessage = `Produto buscado: "${descricaoBusca}"
${marcaInfoV ? `\n${marcaInfoV}` : ''}${gramInfoV ? `\n${gramInfoV}` : ''}${tipoInfoV ? `\n${tipoInfoV}` : ''}

LEMBRETE: Os nomes no sistema ERP sao ABREVIADOS. Exemplos reais:
- "CERVEJA" aparece como "CERV"
- "LATA" aparece como "LT"
- "GARRAFA" aparece como "GRF"
- "DETERGENTE" aparece como "DET"
- "REFRIGERANTE" aparece como "REFRIG"
Portanto "CERV ITAIPAVA LT 269ML" = "CERVEJA ITAIPAVA LATA 269ML"

Candidatos do sistema:
${listaCandidatos}

Qual numero corresponde ao produto buscado? (0 se nenhum):`;

      const effectiveModelV = model || 'gpt-4o-mini';
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: effectiveModelV,
          messages: [
            {
              role: 'system',
              content: promptVetorial
            },
            {
              role: 'user',
              content: userMessage
            },
          ],
          ...buildModelParams(effectiveModelV, 10),
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const resposta = response.data.choices?.[0]?.message?.content?.trim();
      console.log(`[Garimpador Vetorial] GPT raw response: "${resposta}" para "${descricaoBusca}"`);
      const escolha = parseInt(resposta);

      if (escolha === 0 || isNaN(escolha)) {
        console.log(`[Garimpador Vetorial] GPT: NENHUM match para "${descricaoBusca}" -> Fora do Mix`);
        return { match: null, candidatos: candidatosInfo };
      }

      const idx = escolha - 1;
      if (idx < 0 || idx >= candidatos.length) {
        console.log(`[Garimpador Vetorial] GPT retornou indice invalido ${escolha}`);
        return { match: null, candidatos: candidatosInfo };
      }

      const escolhido = candidatos[idx];
      console.log(`[Garimpador Vetorial] GPT: "${descricaoBusca}" -> "${escolhido.descricao}" (sim: ${(escolhido.similarity * 100).toFixed(0)}%)`);

      return { match: this.candidatoParaProdutoOracle(escolhido, Math.round(escolhido.similarity * 100)), candidatos: candidatosInfo };
    } catch (error: any) {
      console.error(`[Garimpador Vetorial] Erro:`, error.message);
      return undefined; // Erro -> fallback para LIKE
    }
  }

  /**
   * Converte candidato vetorial para ProdutoOracle
   */
  private static candidatoParaProdutoOracle(c: any, matchScore: number): ProdutoOracle {
    return {
      codProduto: c.cod_produto,
      codigo_barras: c.codigo_barras,
      descricao: c.descricao,
      preco_custo: c.preco_custo,
      preco_venda: c.preco_venda,
      preco_venda_concorrente: 0,
      estoque_atual: c.estoque_atual,
      cobertura: c.cobertura,
      pedido_compra: 0,
      curva: c.curva,
      venda_media_dia: c.venda_media_dia,
      venda_30d: c.venda_30d,
      margem_referencia: c.margem_referencia,
      secao: c.secao,
      grupo: c.grupo,
      subgrupo: c.subgrupo,
      fornecedor: c.fornecedor,
      matchScore,
    };
  }

  /**
   * Mapeia resultado Oracle para interface ProdutoOracle
   */
  private static mapearProdutoOracle(row: any, matchScore: number = 0): ProdutoOracle {
    return {
      codProduto: String(row.COD_PRODUTO || ''),
      codigo_barras: String(row.CODIGO_BARRAS || ''),
      descricao: String(row.DESCRICAO || ''),
      preco_custo: parseFloat(row.PRECO_CUSTO) || 0,
      preco_venda: parseFloat(row.PRECO_VENDA) || 0,
      preco_venda_concorrente: parseFloat(row.PRECO_VENDA_CONCORRENTE) || 0,
      estoque_atual: parseFloat(row.ESTOQUE_ATUAL) || 0,
      cobertura: parseFloat(row.COBERTURA) || 0,
      pedido_compra: parseFloat(row.PEDIDO_COMPRA) || 0,
      curva: String(row.CURVA || '-'),
      venda_media_dia: parseFloat(row.VENDA_MEDIA_DIA) || 0,
      venda_30d: parseFloat(row.VENDA_30D) || 0,
      margem_referencia: parseFloat(row.MARGEM_REFERENCIA) || 0,
      secao: String(row.SECAO || '-'),
      grupo: String(row.GRUPO || '-'),
      subgrupo: String(row.SUBGRUPO || '-'),
      fornecedor: String(row.FORNECEDOR || '-'),
      matchScore,
    };
  }

  /**
   * Reranking pos-SQL: aplica penalidade de marca e tolerancia de gramatura
   * Decompoe cada candidato Oracle e compara semanticamente com o input
   */
  private static rerankCandidatos(
    rows: any[],
    decompInput: import('./garimpador-decomposer.service').ProdutoDecomposto,
    penalMarca: number,
    toleranciaGram: number,
    maxScore: number,
  ): Array<{ row: any; adjustedScore: number; matchPct: number }> {
    const results = rows.map(row => {
      let adjustedScore = parseFloat(row.MATCH_SCORE) || 0;
      const descOracle = String(row.DESCRICAO || '');
      const decompOracle = GarimpadorDecomposerService.decompor(descOracle);

      // PENALIDADE DE MARCA: se input tem marca X e Oracle nao contem essa marca -> penalizar forte
      // Verifica de 2 formas:
      // 1. Decomposicao local do Oracle (se ambos tem marca detectada e sao diferentes)
      // 2. Presenca direta da marca do input no texto Oracle (para marcas nao conhecidas pelo decomposer)
      if (decompInput.marcas.length > 0) {
        const descOracleNorm = GarimpadorDecomposerService.normalizar(descOracle);
        // Verificar se a marca do input aparece no texto Oracle (direto ou via variantes)
        const variantesInput = decompInput.marcas.flatMap(m => GarimpadorDecomposerService.gerarVariantesMarca(m));
        const marcaNoTexto = variantesInput.some(v => descOracleNorm.includes(v));

        if (!marcaNoTexto) {
          // Marca do input NAO esta no texto Oracle -> penalidade forte
          adjustedScore -= penalMarca;
        } else if (decompOracle.marcas.length > 0) {
          // Marca esta no texto mas decomposer local detectou outra marca - sem penalidade
          // (a presenca direta no texto e mais confiavel que o decomposer local)
        }
      }

      // PENALIDADE VARIANTE EXTRA: se input NAO tem variante/sabor mas Oracle TEM,
      // penalizar para preferir o produto TRADICIONAL/sem sabor especifico.
      // Ex: input "MAIONESE HELLMANNS 500G" (sem sabor) deve preferir a tradicional,
      // nao "MAIONESE HELLMANNS 500G LIMAO" (com sabor)
      if (decompInput.variantes.length === 0 && decompOracle.variantes.length > 0) {
        // Qualquer variante extra no Oracle que nao foi pedida no input = penalidade
        // Isso faz preferir o produto TRADICIONAL/generico quando nao se especifica sabor
        adjustedScore -= 1.5; // penalidade por variante nao solicitada
      }

      // PENALIDADE TIPO PRODUTO: se input tem tipo (ex: DETERGENTE) mas Oracle tem tipo diferente
      // (ex: AMACIANTE), penalizar. Compara termos do campo descricao (tipo generico).
      if (decompInput.descricao.length > 0 && decompOracle.descricao.length > 0) {
        // Verificar se pelo menos um termo do tipo do input aparece na descricao Oracle
        const tiposInput = new Set(decompInput.descricao.map(d => d.length >= 5 ? d.substring(0, 3) : d));
        const descOracleNorm = GarimpadorDecomposerService.normalizar(descOracle);
        const temTipoCorreto = [...tiposInput].some(t => descOracleNorm.includes(t));
        if (!temTipoCorreto) {
          adjustedScore -= 2.0; // penalidade forte por tipo de produto diferente
        }
      }

      // BONUS GRAMATURA TOLERANCIA: se gramatura nao bateu exato mas esta dentro da tolerancia
      if (decompInput.gramaturas.length > 0 && decompOracle.gramaturas.length > 0) {
        for (const gramInput of decompInput.gramaturas) {
          const temExata = decompOracle.gramaturas.some(g => g.textoOriginal === gramInput.textoOriginal);
          if (!temExata) {
            const temTolerancia = decompOracle.gramaturas.some(g =>
              GarimpadorDecomposerService.gramaturasDentroTolerancia(gramInput, g, toleranciaGram)
            );
            if (temTolerancia) {
              adjustedScore += 0.5; // meio ponto bonus por gramatura proxima
            }
          }
        }
      }

      const matchPct = maxScore > 0
        ? Math.max(0, Math.min(100, Math.round((adjustedScore / maxScore) * 100)))
        : 0;

      return { row, adjustedScore, matchPct };
    });

    // Ordenar por score ajustado decrescente
    results.sort((a, b) => b.adjustedScore - a.adjustedScore);

    // Filtrar candidatos com score negativo ou zero
    return results.filter(r => r.adjustedScore > 0);
  }

  /**
   * Busca produto usando GPT para matching inteligente
   * Quando LIKE nao encontra, monta uma busca mais ampla e usa GPT para escolher
   */
  private static async buscarProdutoComGPT(descricaoBusca: string): Promise<ProdutoOracle | null> {
    try {
      const schema = await MappingService.getSchema();
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO');
      const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA');
      const colDescricao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao', 'DES_PRODUTO');
      const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
      const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto', 'COD_PRODUTO');
      const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA');

      // Coluna de produto inativo (fora do mix)
      let colInativoFb = 'INATIVO';
      try {
        const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
        if (mapped) colInativoFb = mapped;
      } catch (e) { /* usa default */ }

      // Usar a decomposicao IA para termos de busca mais inteligentes
      const decomp = await GarimpadorDecomposerService.decomporComIA(descricaoBusca);

      // Montar termos: marca (mais importante) + tipo truncado (pra pegar abreviacoes)
      const termos: string[] = [];
      for (const marca of decomp.marcas) {
        termos.push(marca);
      }
      for (const d of decomp.descricao) {
        // Truncar termos longos pra pegar abreviacoes no Oracle (3 chars)
        termos.push(d.length >= 5 ? d.substring(0, 3) : d);
      }
      // Adicionar gramatura se tiver
      for (const g of decomp.gramaturas) {
        termos.push(g.textoOriginal);
      }

      if (termos.length === 0) {
        // Fallback: pega os 2 termos mais longos da descricao original
        const termosOrig = descricaoBusca
          .toUpperCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(t => t.length >= 3)
          .sort((a, b) => b.length - a.length)
          .slice(0, 2);
        termos.push(...termosOrig);
      }

      if (termos.length === 0) return null;

      // Busca com OR para ser mais abrangente
      const likeConds = termos.map((_, i) => `UPPER(p.${colDescricao}) LIKE :t${i}`).join(' OR ');
      const params: any = {};
      termos.forEach((t, i) => { params[`t${i}`] = `%${t}%`; });

      const dbTypeFb = await this.detectDbType();
      const vFb = this.sqlVendor(dbTypeFb);
      const baseSql = `
        SELECT p.${colCodProduto} AS COD, p.${colDescricao} AS DESC_PROD,
               ${vFb.nvl(`pl.${colPrecoVenda}`, 0)} AS PRC_VENDA
        FROM ${schema}.${tabProduto} p
        LEFT JOIN ${schema}.${tabProdutoLoja} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto}
        WHERE (${likeConds})
          AND ${vFb.nvl(`pl.${colInativoFb}`, `'N'`)} != 'S'
        ORDER BY ${vFb.nvl(`pl.${colPrecoVenda}`, 0)} DESC
      `;
      const sql = vFb.wrapLimit(baseSql, 20);

      const candidatos = await this.runQuery<any>(dbTypeFb, sql, params);
      if (candidatos.length === 0) return null;

      // Usa GPT para escolher o melhor match
      const apiKey = await ConfigurationService.get('openai_api_key');
      const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');

      if (!apiKey) {
        // Sem GPT, retorna o primeiro resultado
        return this.buscarProdutoCompleto(candidatos[0].COD);
      }

      const listaDescricoes = candidatos.map((c: any, i: number) => `${i + 1}. ${c.DESC_PROD}`).join('\n');

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: (await ConfigurationService.get('garimpador_prompt_matching_fallback')) || DEFAULT_PROMPT_MATCHING_FALLBACK
            },
            {
              role: 'user',
              content: `Produto buscado: "${descricaoBusca}"\n\nCandidatos:\n${listaDescricoes}\n\nRetorne apenas o numero (1, 2, 3...):`,
            },
          ],
          ...buildModelParams(model || 'gpt-4o-mini', 10),
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const resposta = response.data.choices?.[0]?.message?.content?.trim();
      const escolha = parseInt(resposta);
      console.log(`[Garimpador Comparador] GPT fallback: "${descricaoBusca}" -> escolheu ${escolha} de ${candidatos.length} candidatos`);

      // GPT retorna 0 se nenhum candidato for compativel
      if (escolha === 0) return null;

      const idx = escolha - 1;
      if (isNaN(idx) || idx < 0 || idx >= candidatos.length) return null;

      // Buscar dados completos do produto escolhido
      return this.buscarProdutoCompleto(candidatos[idx].COD);
    } catch (error: any) {
      console.error('[Garimpador Comparador] Erro busca GPT:', error.message);
      return null;
    }
  }

  /**
   * Busca dados completos de um produto pelo codigo
   */
  private static async buscarProdutoCompleto(codProduto: string | number): Promise<ProdutoOracle | null> {
    try {
      const schema = await MappingService.getSchema();
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO');
      const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA');
      const tabProdutoPdv = await MappingService.getRealTableName('TAB_PRODUTO_PDV', 'TAB_PRODUTO_PDV');
      const tabFornecedor = await MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR');
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO');
      const tabGrupo = await MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO');
      const tabSubgrupo = await MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO');

      const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
      const colDescricao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao', 'DES_PRODUTO');
      const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras', 'COD_BARRA');
      const colCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo', 'COD_GRUPO');
      const colCodSubgrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo', 'COD_SUBGRUPO');
      const colCodFornecedor = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_fornecedor', 'COD_FORNECEDOR');

      const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto', 'COD_PRODUTO');
      const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'custo_medio', 'VAL_CUSTO_MEDIO');
      const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA');
      const colPesquisaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media', 'VAL_PESQUISA_MEDIA');
      const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual', 'QTD_EST_ATUAL');
      const colCobertura = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura', 'QTD_COBERTURA');
      const colPedidoCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pedido_compra', 'QTD_PEDIDO_COMPRA');
      const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva', 'DES_RANK_PRODLOJA');
      const colVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media', 'VAL_VENDA_MEDIA');
      const colMargem = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem', 'VAL_MARGEM');
      const colCodFornUltCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra', 'COD_FORN_ULT_COMPRA');

      const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao', 'DES_SECAO');
      const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo', 'DES_GRUPO');
      const colDesSubgrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo', 'DES_SUB_GRUPO');
      const colCodForn = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor', 'COD_FORNECEDOR');
      const colRazaoSocial = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social', 'DES_FORNECEDOR');

      const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja', 'COD_LOJA');
      const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto', 'COD_PRODUTO');
      const colQtdVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade', 'QTD_TOTAL_PRODUTO');
      const colDataVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda', 'DTA_SAIDA');
      const colCodSecaoSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo', 'COD_GRUPO');
      const colCodSecaoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao', 'COD_SECAO');
      const colCodSubgrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo', 'COD_SUB_GRUPO');
      const colCodSecaoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo', 'COD_GRUPO');

      // Multi-loja: aggregated subquery
      const { lojas: lojasG, refCusto: refG } = await this.getLojasGarimpador();
      const plSub = this.buildPlSubquery({
        schema, tabProdutoLoja, colCodProdutoLoja, colCodLojaLoja,
        colPrecoCusto, colPrecoVenda, colPesquisaMedia, colEstoque, colCobertura,
        colPedidoCompra, colCurva, colVendaMedia, colMargem, colCodFornUltCompra,
        colInativo: 'INATIVO', lojas: lojasG, refCusto: refG,
      });
      const dbTypeC = await this.detectDbType();
      const vC = this.sqlVendor(dbTypeC);
      const hasSubgrupoC = tabSubgrupo !== 'TAB_SUBGRUPO';
      const subgrupoSelC = hasSubgrupoC ? `${vC.nvl(`sg.${colDesSubgrupo}`, `'-'`)} AS SUBGRUPO,` : `'-' AS SUBGRUPO,`;
      const subgrupoJoinC = hasSubgrupoC ? `LEFT JOIN ${schema}.${tabSubgrupo} sg ON sg.${colCodSubgrupoSub} = p.${colCodSubgrupo} AND sg.${colCodSecaoSub} = p.${colCodSecao} AND sg.${colCodGrupoSub} = p.${colCodGrupo}` : '';

      const sql = `
        SELECT
          p.${colCodProduto} AS COD_PRODUTO,
          p.${colCodBarras} AS CODIGO_BARRAS,
          p.${colDescricao} AS DESCRICAO,
          ${vC.nvl(`pl.${colPrecoCusto}`, 0)} AS PRECO_CUSTO,
          ${vC.nvl(`pl.${colPrecoVenda}`, 0)} AS PRECO_VENDA,
          ${vC.nvl(`pl.${colPesquisaMedia}`, 0)} AS PRECO_VENDA_CONCORRENTE,
          ${vC.nvl(`pl.${colEstoque}`, 0)} AS ESTOQUE_ATUAL,
          ${vC.nvl(`pl.${colCobertura}`, 0)} AS COBERTURA,
          ${vC.nvl(`pl.${colPedidoCompra}`, 0)} AS PEDIDO_COMPRA,
          ${vC.nvl(`pl.${colCurva}`, `'-'`)} AS CURVA,
          ${vC.nvl(`pl.${colVendaMedia}`, 0)} AS VENDA_MEDIA_DIA,
          ${vC.nvl(`pl.${colMargem}`, 0)} AS MARGEM_REFERENCIA,
          ${vC.nvl(`s.${colDesSecao}`, `'-'`)} AS SECAO,
          ${vC.nvl(`g.${colDesGrupo}`, `'-'`)} AS GRUPO,
          ${subgrupoSelC}
          ${vC.nvl(`f.${colRazaoSocial}`, `'-'`)} AS FORNECEDOR,
          (
            SELECT ${vC.nvl(`SUM(pdv.${colQtdVendaPdv})`, 0)}
            FROM ${schema}.${tabProdutoPdv} pdv
            WHERE pdv.${colCodProdutoPdv} = p.${colCodProduto}
              AND pdv.${colDataVendaPdv} >= ${vC.sysdateMinus(30)}
          ) AS VENDA_30D
        FROM ${schema}.${tabProduto} p
        LEFT JOIN ${plSub.sql} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto}
        LEFT JOIN ${schema}.${tabSecao} s ON s.${colCodSecaoSecao} = p.${colCodSecao}
        LEFT JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupoGrupo} = p.${colCodGrupo} AND g.${colCodSecaoGrupo} = p.${colCodSecao}
        ${subgrupoJoinC}
        LEFT JOIN ${schema}.${tabFornecedor} f ON f.${colCodForn} = pl.${colCodFornUltCompra}
        WHERE p.${colCodProduto} = :codProduto
      `;

      const rows = await this.runQuery<any>(dbTypeC, sql, { codProduto, ...plSub.params });
      if (rows.length === 0) return null;

      return this.mapearProdutoOracle(rows[0]);
    } catch (error: any) {
      console.error('[Garimpador Comparador] Erro buscarProdutoCompleto:', error.message);
      return null;
    }
  }

  /**
   * Usa GPT para escolher o melhor match entre candidatos
   */
  private static async escolherMelhorMatch(descricaoBusca: string, candidatos: any[]): Promise<any | null> {
    try {
      const apiKey = await ConfigurationService.get('openai_api_key');
      if (!apiKey) return null;

      const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');
      const lista = candidatos.map((c: any, i: number) => `${i + 1}. ${c.DESCRICAO}`).join('\n');

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: (await ConfigurationService.get('garimpador_prompt_matching_fallback')) || DEFAULT_PROMPT_MATCHING_FALLBACK
            },
            {
              role: 'user',
              content: `Produto buscado: "${descricaoBusca}"\n\nCandidatos:\n${lista}\n\nRetorne apenas o numero:`,
            },
          ],
          ...buildModelParams(model || 'gpt-4o-mini', 10),
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const resposta = response.data.choices?.[0]?.message?.content?.trim();
      const idx = parseInt(resposta) - 1;
      if (isNaN(idx) || idx < 0 || idx >= candidatos.length) return null;
      return candidatos[idx];
    } catch {
      return null;
    }
  }

  /**
   * Calcula comparacao de precos e margens
   */
  static calcularComparacao(prodExtraido: ProdutoExtraido, prodOracle: ProdutoOracle): ResultadoComparacao {
    const precoOferta = prodExtraido.preco;
    const custoLoja = prodOracle.preco_custo;
    const precoVenda = prodOracle.preco_venda;

    // Diferenca: Custo c/Imp - Preco Oferta (positivo = boa oferta)
    const diferenca = custoLoja - precoOferta;
    const boaOferta = precoOferta < custoLoja;

    // Margem Atual: ((Preco Venda - Custo) / Preco Venda) * 100
    const margemAtual = precoVenda > 0 ? ((precoVenda - custoLoja) / precoVenda) * 100 : 0;

    // Margem Futura: ((Preco Venda - Preco Oferta) / Preco Venda) * 100
    const margemFutura = precoVenda > 0 ? ((precoVenda - precoOferta) / precoVenda) * 100 : 0;

    // Diferenca de Margem (para classificacao Ouro/Prata/Bronze)
    const diferencaMargem = margemFutura - margemAtual;

    return {
      produtoOfertado: prodExtraido.produto,
      precoOferta,
      condicao: prodExtraido.condicao,
      condicoes: prodExtraido.condicoes,
      produtoLoja: prodOracle,
      diferenca: parseFloat(diferenca.toFixed(2)),
      boaOferta,
      margemAtual: parseFloat(margemAtual.toFixed(2)),
      margemFutura: parseFloat(margemFutura.toFixed(2)),
      margemMeta: prodOracle.margem_referencia,
      diferencaMargem: parseFloat(diferencaMargem.toFixed(2)),
      classificacao: 'bronze', // sera reclassificado
      matchScore: prodOracle.matchScore || 0,
    };
  }

  /**
   * Classifica a oportunidade baseado na diferenca de margem e % configurados
   */
  static async classificar(diferencaMargem: number): Promise<'ouro' | 'prata' | 'bronze' | 'ruim'> {
    const pctOuro = parseFloat((await ConfigurationService.get('garimpador_pct_ouro', '10')) || '10');
    const pctPrata = parseFloat((await ConfigurationService.get('garimpador_pct_prata', '5')) || '5');

    if (diferencaMargem >= pctOuro) return 'ouro';
    if (diferencaMargem >= pctPrata) return 'prata';
    if (diferencaMargem >= 0) return 'bronze';
    return 'ruim';
  }

  /**
   * Formata mensagem IDENTICA ao n8n para enviar no WhatsApp
   * Com emojis, tabelada, formatacao do n8n
   */
  static formatarMensagem(
    resultado: ResultadoComparacao,
    tipoContato: string,
    contato?: GarimpadorContato | null,
    mediaUrl?: string | null,
  ): string {
    const p = resultado.produtoLoja!;
    const fmtBRL = (v: number) => v.toFixed(2).replace('.', ',');

    // Header baseado no tipo de contato
    let header: string;
    if (tipoContato === 'concorrente') {
      header = `🟠 CONCORRENTE GARIMPADO ⛏️`;
    } else {
      header = `🟠 Oportunidade encontrada!`;
    }

    // Monta a mensagem identica ao n8n
    let msg = `${header}\n\n`;
    msg += `🏷️ Produto *OFERTADO*: ${resultado.produtoOfertado}\n`;
    msg += `🏷️ Produto *LOJA*: ${p.descricao}\n\n`;

    msg += `💲 Preço Venda Loja: R$ ${fmtBRL(p.preco_venda)}\n`;
    if (p.preco_venda_concorrente > 0) {
      msg += `💲 Preço Venda Concorrente: R$ ${fmtBRL(p.preco_venda_concorrente)}\n`;
    }
    msg += `💲 Custo Loja: R$ ${fmtBRL(p.preco_custo)}\n`;

    if (tipoContato === 'concorrente') {
      msg += `💲 OFERTA Concorrente: R$ ${fmtBRL(resultado.precoOferta)}\n`;
    } else {
      msg += `💲 Custo Fornecedor: R$ ${fmtBRL(resultado.precoOferta)}\n`;
    }
    msg += `📉 Diferença: R$ ${fmtBRL(resultado.diferenca)}\n\n`;

    // Condicoes de preco (Normal, APP, Cartao, etc)
    if (resultado.condicoes && resultado.condicoes.length > 1) {
      msg += `🔖 *Condições de Preço:*\n`;
      for (const cond of resultado.condicoes) {
        const isUsado = Math.abs(cond.preco - resultado.precoOferta) < 0.01;
        msg += `   ${isUsado ? '👉' : '  '} ${cond.tipo}: R$ ${fmtBRL(cond.preco)}\n`;
      }
    } else if (resultado.condicao) {
      msg += `🔖 Condição: ${resultado.condicao}\n`;
    }

    msg += `📊 Curva: ${p.curva}\n`;
    msg += `📈 Média Venda Dia: ${fmtBRL(p.venda_media_dia)}\n`;
    msg += `📈 Média Venda Mês: ${fmtBRL(p.venda_30d)}\n`;
    msg += `📦 Estoque Atual: ${fmtBRL(p.estoque_atual)}\n`;
    msg += `📦 Pedido de Compra: ${fmtBRL(p.pedido_compra)}\n`;
    msg += `⏳ Dias de Cobertura: ${fmtBRL(p.cobertura)}\n`;
    msg += `👨‍🌾 Fornecedor Atual: ${p.fornecedor}\n\n`;

    msg += `📊 Margem Meta: ${fmtBRL(resultado.margemMeta)}%\n`;
    msg += `📊 Margem Atual: ${fmtBRL(resultado.margemAtual)}%\n`;

    if (tipoContato === 'concorrente') {
      // Margem Cobrindo Oferta: ((Preco Oferta - Custo) / Preco Oferta) * 100
      const margemCobrindo = resultado.precoOferta > 0
        ? ((resultado.precoOferta - p.preco_custo) / resultado.precoOferta) * 100
        : 0;
      msg += `📊 Margem Cobrindo Oferta: ${fmtBRL(margemCobrindo)}%\n`;
    } else {
      msg += `📊 Margem Futura: ${fmtBRL(resultado.margemFutura)}%\n`;
    }

    // Rodape com info do fornecedor/concorrente
    msg += `\n👨‍🌾 Fornecedor: ${contato?.nome || 'Desconhecido'}`;
    msg += `\n📲 Contato: https://wa.me/${contato?.telefone || ''}`;

    // Link do tabloid/encarte (se disponivel)
    if (mediaUrl) {
      msg += `\n\n📰 Tabloid: ${mediaUrl}`;
    }

    return msg;
  }

  /**
   * Envia mensagem para o grupo WhatsApp correto baseado na classificacao
   */
  static async enviarParaGrupo(
    mensagem: string,
    classificacao: 'ouro' | 'prata' | 'bronze' | 'ruim',
    tipoContato: string,
  ): Promise<boolean> {
    try {
      let groupId: string | null = null;

      if (tipoContato === 'concorrente') {
        groupId = await ConfigurationService.get('whatsapp_group_garimpador_concorrente', '');
      } else {
        switch (classificacao) {
          case 'ouro':
            groupId = await ConfigurationService.get('whatsapp_group_garimpador_ouro', '');
            break;
          case 'prata':
            groupId = await ConfigurationService.get('whatsapp_group_garimpador_prata', '');
            break;
          case 'bronze':
            groupId = await ConfigurationService.get('whatsapp_group_garimpador_bronze', '');
            break;
          default:
            console.log(`[Garimpador Comparador] Classificacao "${classificacao}" - nao envia`);
            return false;
        }
      }

      if (!groupId || groupId.trim() === '') {
        console.log(`[Garimpador Comparador] Grupo WhatsApp nao configurado para ${tipoContato}/${classificacao}`);
        return false;
      }

      const enviou = await WhatsAppService.sendMessage(groupId, mensagem);
      if (enviou) {
        console.log(`[Garimpador Comparador] ✅ Mensagem enviada para grupo ${classificacao.toUpperCase()}`);
      }
      return enviou;
    } catch (error: any) {
      console.error('[Garimpador Comparador] Erro ao enviar:', error.message);
      return false;
    }
  }

  /**
   * Processa todas as mensagens com conteudo extraido mas nao comparadas
   */
  static async processarPendentes(): Promise<{ total: number; processadas: number; enviadas: number }> {
    const repo = AppDataSource.getRepository(GarimpadorMensagem);

    // Busca mensagens que foram processadas (tem conteudo_extraido) mas nao comparadas
    // Identifica se ja foi comparado verificando se conteudo_extraido contem "resultados_comparacao"
    const mensagens = await repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contato', 'c')
      .where('m.processado = true')
      .andWhere('m.conteudo_extraido IS NOT NULL')
      .andWhere("m.conteudo_extraido NOT LIKE '%resultados_comparacao%'")
      .andWhere("c.tipo != 'nao_classificado'")
      .orderBy('m.received_at', 'ASC')
      .take(20)
      .getMany();

    let processadas = 0;
    let enviadas = 0;

    for (const msg of mensagens) {
      try {
        const result = await this.compararEEnviar(msg.id);
        processadas++;
        enviadas += result.enviadas;
      } catch (err: any) {
        console.error(`[Garimpador Comparador] Erro msg ${msg.id}:`, err.message);
        processadas++;
      }
    }

    return { total: mensagens.length, processadas, enviadas };
  }
}
