/**
 * GarimpadorDecomposerService
 *
 * Decompoe descricoes de produtos em categorias semanticas:
 * - Marca (peso alto no matching)
 * - Gramatura/Peso/Volume (com tolerancia %)
 * - Embalagem (lata, cx, pet, etc)
 * - Variante/Sabor (pilsen, zero, alecrim, etc)
 * - Descricao (termos genericos restantes)
 *
 * Marcas sao carregadas de 3 fontes:
 * 1. Oracle TAB_MARCA (fonte principal - carregada do banco do cliente)
 * 2. Lista estatica (fallback/complemento)
 * 3. Heuristica posicional (2o termo da descricao = provavel marca)
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';
import { ConfigurationService } from './configuration.service';
import axios from 'axios';

// Prompt default de decomposicao - usado se nao houver configuracao customizada
const DEFAULT_PROMPT_DECOMPOSICAO = `Voce e um especialista em produtos de supermercado brasileiro. Decomponha a descricao do produto em categorias.

Retorne APENAS um JSON valido sem markdown, neste formato exato:
{"marca":"NOME DA MARCA","tipo":"TIPO DO PRODUTO","gramatura":"PESO OU VOLUME (ex: 500G, 1L, 750ML)","embalagem":"TIPO EMBALAGEM (ex: CX, PT, LT, LATA, PET, TP, FD, SACHE)","variante":"SABOR OU VARIACAO (ex: TRADICIONAL, LIMAO, ZERO, INTEGRAL)","quantidade":"QUANTIDADE DE UNIDADES (ex: 12, 6, 24)"}

Regras:
- Se nao identificar algum campo, use string vazia ""
- Marca: nome comercial do fabricante (ex: HELLMANNS, YPE, V FORT, NUGGET, PIRISA)
- Tipo: categoria generica do produto INCLUINDO o sub-tipo se houver (ex: OLEO DE SOJA, OLEO DE MILHO, LEITE INTEGRAL, FARINHA DE TRIGO, CERVEJA PILSEN)
- Gramatura: peso ou volume com unidade
- Embalagem: sigla do tipo de embalagem
- Variante: sabor, fragrancia, cor ou variacao especifica
- Quantidade: se houver pack/fardo (ex: C/10, COM 5, 12UN, PACK 6)`;

export interface GramaturaParsed {
  valor: number;
  unidade: string;      // G, ML, KG, L, UN
  textoOriginal: string; // "85G", "350ML"
}

export interface ProdutoDecomposto {
  original: string;
  marcas: string[];
  marcaFonte?: 'oracle' | 'estatica' | 'posicional' | 'ia'; // de onde veio a marca
  gramaturas: GramaturaParsed[];
  embalagens: string[];
  variantes: string[];
  descricao: string[];
  todosTermos: string[];
}

// =====================================================
// LISTAS ESTATICAS
// =====================================================

const MARCAS_CONHECIDAS: string[] = [
  // Bebidas alcoolicas
  'SKOL', 'BRAHMA', 'ANTARTICA', 'ANTARCTICA', 'HEINEKEN', 'BUDWEISER', 'STELLA',
  'CORONA', 'BECKS', 'BOHEMIA', 'ORIGINAL', 'DEVASSA', 'EISENBAHN', 'BADEN',
  'AMSTEL', 'SPATEN', 'BAVARIA', 'KAISER', 'CRYSTAL', 'ITAIPAVA', 'PETRA',
  'COLORADO', 'WALS', 'DADO', 'THEREZOPOLIS',
  // Refrigerantes e sucos
  'COCA', 'PEPSI', 'GUARANA', 'FANTA', 'SPRITE', 'DOLLY', 'KUAT',
  'SCHWEPPES', 'SUKITA', 'TUBAINA', 'CONVENCION', 'SCHIN',
  'DEL VALLE', 'DELVALLE', 'TROPICANA', 'SUFRESH', 'JANDAIA', 'MAGUARY',
  'TIAL', 'DAFRUTA', 'TAMPICO', 'KAPO',
  // Aguas
  'CRYSTAL', 'MINALBA', 'INDAIA', 'BONAFONT', 'LINDOYA', 'OURO FINO',
  // Energeticos
  'REDBULL', 'RED BULL', 'MONSTER', 'TNT', 'BURN',
  // Laticinios
  'ITAMBE', 'NESTLE', 'PIRACANJUBA', 'ITALAC', 'DANONE', 'VIGOR',
  'PARMALAT', 'TIROL', 'BATAVO', 'QUATA', 'ELEGE', 'ELEGÊ',
  'CATUPIRY', 'POLENGHI', 'PRESIDENT', 'SANCOR', 'MOCA', 'NINHO',
  'MOLICO', 'CHAMYTO', 'ACTIVIA', 'YOPRO', 'YAKULT', 'LACTOBAC',
  'PHOEBE', 'SHEFA', 'QUATÁ', 'CCGL', 'TIROLEZ',
  // Limpeza
  'YPE', 'YPÊ', 'BOMBRIL', 'BRILHANTE', 'OMO', 'ACE', 'LIMPOL',
  'MINUANO', 'VEJA', 'LYSOL', 'PINHO', 'QBOA', 'CANDIDA',
  'BRISE', 'GLADE', 'VANISH', 'FINISH', 'CLOROX', 'SANITEK',
  'UFE', 'BOM BRIL', 'TRIEX', 'TIXAN', 'ASSIM', 'DOWNY', 'COMFORT',
  'FLOR DE IPE', 'FLOR IPE', 'GIRANDO SOL', 'BRILUX', 'DRAGAO',
  'URCA', 'COCO VARELA', 'ZULU', 'PANDA', 'ZUPP', 'CRISTAL',
  'BRILHO FACIL', 'BRAVO', 'CERA INGLESA', 'POLIFLOR', 'DESTAC',
  'SCOTCH BRITE', 'SCOTCHBRITE', 'ESFREBOM', 'ASSOLAN', 'SAPÓLIO',
  'TAY', 'OLIMPO', 'CONDE', 'SUPREMA', 'FLOPS', 'COPERALCOOL',
  'SUPRE LIMP', 'SUPRELIMP', 'HIGIPLAST', 'V FORT', 'VFORT', 'DOVER',
  'EMBALIXO', 'FLEX', 'NOVICA',
  // Inseticidas
  'RAID', 'SBP', 'BAYGON', 'MORTEIN', 'DETEFON', 'PIRISA',
  'JIMO', 'CITROMAX', 'ULTRA INSET',
  // Ceras e calcados
  'NUGGET', 'KIWI', 'CHERRY', 'BRILHO FACIL',
  // Higiene pessoal
  'NIVEA', 'DOVE', 'PALMOLIVE', 'LUX', 'PROTEX', 'FRANCIS',
  'COLGATE', 'ORAL', 'SENSODYNE', 'CLOSEUP', 'SORRISO',
  'REXONA', 'AXE', 'OLD SPICE', 'GILLETTE', 'BIC',
  'PANTENE', 'HEAD', 'SEDA', 'TRESEMME', 'ELSEVE', 'LOREAL',
  'HUGGIES', 'PAMPERS', 'BIGFRAL', 'TURMA DA MONICA', 'TURMADOMONICA',
  'JOHNSONS', 'JOHNSON', 'LISTERINE', 'ALWAYS', 'INTIMUS', 'OB',
  'SUNDOWN', 'CENOURA', 'NÍVEA', 'PHEBO', 'GRANADO', 'LIFEBUOY',
  'NATIVA SPA', 'NATURA', 'BOTICARIO', 'AVON',
  // Carnes e frios
  'SADIA', 'PERDIGAO', 'PERDIGÃO', 'SEARA', 'AURORA', 'FRIBOI',
  'MARFRIG', 'MINERVA', 'JBS', 'BRF', 'SWIFT', 'MATURATTA',
  'CERATTI', 'CICOPAL', 'COPACOL', 'DALIA', 'REZENDE',
  // Massas e biscoitos
  'BAUDUCCO', 'VISCONTI', 'RENATA', 'BARILLA', 'ADRIA',
  'MARILAN', 'PIRAQUE', 'VITARELLA', 'FORTALEZA', 'ISABELA',
  'PARATI', 'LIANE', 'TRAKINAS', 'OREO', 'BONO', 'PASSATEMPO',
  'CLUB SOCIAL', 'TRIUNFO', 'ZABET', 'RICHESTER', 'PANCO',
  // Cafe
  'TRES CORACOES', '3CORACOES', '3 CORACOES', 'MELITTA', 'PILAO',
  'CABOCLO', 'CAFE DO PONTO', 'IGUACU', 'NESCAFE', 'DOLCE GUSTO',
  'UTAM', 'BOM DIA', 'BAGGIO',
  // Arroz e graos
  'CAMIL', 'KICALDO', 'URBANO', 'TIO JOAO', 'BLUE VILLE', 'NAMORADO',
  'BROTO LEGAL', 'FRITZ', 'YOKI', 'HIKARI',
  // Oleos e temperos
  'SOYA', 'LIZA', 'SALADA', 'BUNGE', 'CARGILL', 'COCAMAR',
  'ABC', 'SAZON', 'KITANO', 'MAGGI', 'KNORR', 'AJINOMOTO',
  // Molhos e conservas
  'HELLMANNS', 'HELLMANN', 'QUERO', 'FUGINI', 'PREDILECTA',
  'HEINZ', 'CICA', 'ELEFANTE', 'POMAROLA', 'RAGU', 'SACHE',
  'HEMMER', 'SAKURA',
  // Farinhas e misturas
  'DONA BENTA', 'DONABENTA', 'SOL', 'VILMA', 'ANACONDA',
  // Acucar e adocantes
  'UNIAO', 'GUARANI', 'CARAVELAS', 'ZERO CAL', 'LINEA', 'STEVIA',
  // Chocolates e doces
  'LACTA', 'GAROTO', 'NESTLE', 'FERRERO', 'KOPENHAGEN',
  'HERSHEYS', 'TWIX', 'SNICKERS', 'KITKAT', 'BIS', 'OURO BRANCO',
  'SONHO DE VALSA', 'FINI', 'HARIBO', 'ARCOR', 'NEUGEBAUER',
  // Leite condensado e creme
  'MOCA', 'PIRACANJUBA', 'ITALAC', 'ELEGÊ', 'NESTLE',
  // Papel e descartaveis
  'NEVE', 'PERSONAL', 'SCOTT', 'KLEENEX', 'KITCHEN',
  // Racoes e pet
  'PEDIGREE', 'WHISKAS', 'ROYAL CANIN', 'PREMIER', 'GOLDEN',
  // Bebidas vegetais
  'ADES', 'ALPRO', 'SILK', 'NOTCO',
  // Whey/suplementos
  'WHEY', 'PIRACANJUBA', 'YOPRO',
  // Outras marcas comuns
  'TANG', 'CLIGHT', 'NESCAU', 'TODDY', 'OVOMALTINE', 'ACHOCOLATADO',
  'TODDYNHO', 'MOCOCA', 'PIRATININGA',
  'AMBEV', 'PEPSICO', 'UNILEVER', 'PG',
  'RUFFLES', 'DORITOS', 'CHEETOS', 'LAYS', 'ELMA CHIPS',
  'NISSIN', 'MIOJO', 'CUP NOODLES',
];

const EMBALAGENS_CONHECIDAS: string[] = [
  'LATA', 'LT', 'LONG', 'LONGNECK', 'LN', 'GARRAFA', 'GRF', 'RETORNAVEL',
  'CX', 'CAIXA', 'SACHE', 'SACHÊ', 'PET', 'TP', 'TN', 'TETRAPACK',
  'PT', 'PACOTE', 'PCT', 'BD', 'BALDE', 'VIDRO', 'VD', 'BAG',
  'PACK', 'PK', 'FD', 'FARDO', 'BISNAGA', 'BISN', 'POTE',
  'SQUEEZE', 'REFIL', 'GALAO', 'GAL', 'BOMBONA', 'SACHETA',
  'TABLETE', 'TAB', 'CARTELA', 'CART', 'ROLO', 'DISPLAY', 'DISP',
  'BANDEJA', 'BJ', 'FLOW', 'FLOWPACK', 'UNIDADE', 'GRANEL',
];

const VARIANTES_CONHECIDAS: string[] = [
  // Sabores cerveja
  'PILSEN', 'PURO MALTE', 'MALTE', 'IPA', 'APA', 'LAGER', 'STOUT',
  'WEISS', 'TRIGO', 'SESSION', 'MUNICH', 'PALE ALE',
  // Diet/light/zero
  'ZERO', 'LIGHT', 'DIET', 'SEM ACUCAR', 'SUGAR FREE', 'FIT',
  // Leite
  'INTEGRAL', 'DESNATADO', 'SEMI', 'SEMIDESNATADO',
  // Geral
  'ORIGINAL', 'PURO', 'EXTRA', 'PREMIUM', 'ESPECIAL', 'RESERVA',
  'TRADICIONAL', 'CLASSICO', 'GOURMET', 'ARTESANAL', 'CASEIRO',
  // Fragrancias/sabores
  'ALECRIM', 'PESSEGO', 'PÊSSEGO', 'DAMASCO', 'FRAMBOESA',
  'MORANGO', 'LIMAO', 'LIMÃO', 'LARANJA', 'MACA', 'MAÇÃ',
  'UVA', 'MANGA', 'COCO', 'BAUNILHA', 'CHOCOLATE', 'MENTA',
  'HORTELÃ', 'HORTELA', 'CAMOMILA', 'LAVANDA', 'ERVA DOCE',
  'MARACUJA', 'MARACUJÁ', 'ABACAXI', 'GOIABA', 'ACEROLA',
  'PITAYA', 'JABUTICABA', 'TANGERINA', 'CEREJA', 'AMEIXA',
  'MELANCIA', 'MELAO', 'MAMAO', 'BANANA', 'KIWI', 'PESSEGO',
  'CANELA', 'CRAVO', 'GENGIBRE', 'CAPIM LIMAO', 'FRUTAS VERMELHAS',
  'FRUTAS TROPICAIS', 'TUTTI FRUTTI', 'MISTO',
  // Tipos de produto
  'GLICERINADO', 'ANTIBACTERIANO', 'HIDRATANTE', 'SUAVE',
  'INTENSO', 'FORTE', 'LEVE', 'NEUTRO', 'NATURAL',
  'CREMOSO', 'LIQUIDO', 'BARRA', 'GEL', 'SPRAY', 'AEROSSOL',
  'BRANCO', 'PRETO', 'ROSA', 'AZUL', 'VERDE',
  // Composicoes
  'COM CALCIO', 'COM FERRO', 'COM VITAMINA', 'VITAMINADO',
  'SEM LACTOSE', 'SEM GLUTEN', 'VEGANO', 'ORGANICO',
  // Fragancias de sabonete/limpeza
  'FRAGANCIAS', 'FRAGANCIA', 'FLORAL', 'CITRUS', 'HERBAL',
  'FRESH', 'BABY', 'SENSIVEL', 'DERMA', 'GLICERINA',
];

// Termos ignorados (nao agregam valor ao matching)
const TERMOS_IGNORADOS: string[] = [
  'DE', 'DO', 'DA', 'DOS', 'DAS', 'COM', 'SEM', 'EM', 'POR', 'PARA',
  'NO', 'NA', 'AO', 'AS', 'OS', 'UM', 'UMA', 'UNS', 'UMAS',
  'E', 'OU', 'A', 'O',
];

// =====================================================
// TIPOS DE PRODUTO COMUNS (1a palavra da descricao)
// Usados na heuristica posicional: se o 1o termo e um tipo,
// o 2o termo e provavelmente a marca.
// =====================================================
const TIPOS_PRODUTO: string[] = [
  'BISC', 'BISCOITO', 'SAB', 'SABAO', 'SABONETE', 'SABONTE',
  'CERV', 'CERVEJA', 'REFRI', 'REFRIGERANTE',
  'LEITE', 'IOGURTE', 'IOG', 'QUEIJO', 'REQUEIJAO',
  'CAFE', 'CHA', 'ACHOC', 'ACHOCOLATADO',
  'ARROZ', 'FEIJAO', 'MACARRAO', 'MASSA', 'MAC',
  'OLEO', 'AZEITE', 'VINAGRE', 'MOLHO',
  'DET', 'DETERGENTE', 'AMACIANTE', 'ALVEJ', 'ALVEJANTE',
  'DESINF', 'DESINFETANTE', 'LIMP', 'LIMPADOR', 'MULTIUSO',
  'SHAMPOO', 'SHAMP', 'COND', 'CONDICIONADOR', 'CREME',
  'PAPEL', 'FRALDA', 'ABSORV', 'ABSORVENTE',
  'CARNE', 'FRANGO', 'LINGUICA', 'LING', 'PRESUNTO', 'MORTADELA',
  'SALSICHA', 'HAMBURGUER', 'HAMB', 'NUGGETS', 'NUG',
  'MARG', 'MARGARINA', 'MANTEIGA', 'MANT',
  'FARINHA', 'FAR', 'FUBA', 'AMIDO', 'FECULA',
  'ACUCAR', 'SAL', 'TEMPERO', 'TEMP',
  'AGUA', 'SUCO', 'NECTAR', 'ENERGETICO',
  'CHOC', 'CHOCOLATE', 'BOMBOM', 'BALA',
  'SORVETE', 'SORV', 'PICOLE',
  'RACAO', 'PET', 'DOG', 'CAT',
  'CIGARRO', 'CIG',
  'PAO', 'BOLO', 'TORRADA', 'BOLACHA',
  'CATCHUP', 'KETCHUP', 'MOSTARDA', 'MAIONESE', 'MAIO',
  'CONSERVA', 'MILHO', 'ERVILHA', 'EXTRATO', 'POLPA',
  'DESOD', 'DESODORANTE', 'ANTITRANSP',
  'PASTA', 'ESC', 'ESCOVA', 'FIO', 'ENXAG', 'ENXAGUANTE',
  // Utilidades domesticas
  'CERA', 'INSET', 'INSETICIDA', 'REPELENTE',
  'SACO', 'SACOLIXO', 'ESPONJA', 'PALHA',
  'LUVA', 'PANO', 'RODO', 'VASSOURA', 'BALDE',
  'TRAT', 'TRATAMENTO', 'CALC', 'CALCADO',
  'VELA', 'FOSFORO', 'ISQUEIRO',
  'PILHA', 'BATERIA', 'LAMPADA',
];

// =====================================================
// SERVICO
// =====================================================

export class GarimpadorDecomposerService {

  // Cache de marcas carregadas do Oracle
  private static _marcasOracle: string[] = [];
  private static _marcasOracleTimestamp: number = 0;
  private static _marcasOracleCarregando: boolean = false;
  private static readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

  // Cache de decomposicoes por IA (evita chamadas repetidas)
  private static _cacheIA = new Map<string, ProdutoDecomposto>();

  /**
   * Decomposicao inteligente usando IA (GPT).
   * A IA identifica marca, tipo, gramatura, embalagem e variante.
   * Resultado e cacheado para evitar chamadas repetidas.
   */
  static async decomporComIA(descricao: string): Promise<ProdutoDecomposto> {
    const chave = descricao.toUpperCase().trim();

    // Retorna do cache se ja foi decomposto
    if (this._cacheIA.has(chave)) {
      return this._cacheIA.get(chave)!;
    }

    try {
      const apiKey = await ConfigurationService.get('openai_api_key');
      const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');

      if (!apiKey) {
        // Sem chave OpenAI, usa decomposicao local
        console.log('[Decomposer IA] Sem chave OpenAI, usando decomposicao local');
        return this.decompor(descricao);
      }

      // Ler prompt customizado ou usar default
      const promptDecomp = (await ConfigurationService.get('garimpador_prompt_decomposicao')) || DEFAULT_PROMPT_DECOMPOSICAO;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: promptDecomp
            },
            {
              role: 'user',
              content: descricao,
            },
          ],
          temperature: 0,
          max_tokens: 150,
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      const resposta = response.data.choices?.[0]?.message?.content?.trim();
      let parsed: any;
      try {
        // Limpar possivel markdown
        const clean = resposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        console.error('[Decomposer IA] Erro ao parsear resposta:', resposta);
        const fallback = this.decompor(descricao);
        this._cacheIA.set(chave, fallback);
        return fallback;
      }

      // Montar ProdutoDecomposto a partir da resposta da IA
      const marcas: string[] = [];
      if (parsed.marca) {
        marcas.push(this.normalizar(parsed.marca));
      }

      const gramaturas: GramaturaParsed[] = [];
      if (parsed.gramatura) {
        const gramStr = parsed.gramatura.toUpperCase().replace(/\s+/g, '');
        const gramMatch = gramStr.match(/(\d+[\.,]?\d*)\s*(ML|G|GR|KG|L|LT|UN|UND|PC|PCS|PCT|FD)/i);
        if (gramMatch) {
          gramaturas.push({
            valor: parseFloat(gramMatch[1].replace(',', '.')),
            unidade: gramMatch[2].toUpperCase().replace('GR', 'G').replace('LT', 'L'),
            textoOriginal: gramMatch[0],
          });
        }
      }

      // Normalizar descricao original para validacao
      const descNorm = this.normalizar(descricao);

      const embalagens: string[] = [];
      if (parsed.embalagem) {
        const embNorm = this.normalizar(parsed.embalagem);
        // So usar embalagem da IA se ela aparece na descricao original
        // Evita termos fantasma (ex: IA diz "LT" mas nao tem "LT" no texto)
        if (descNorm.includes(embNorm) || embNorm.split(/\s+/).some(t => descNorm.split(/\s+/).includes(t))) {
          embalagens.push(embNorm);
        }
      }

      const variantes: string[] = [];
      if (parsed.variante) {
        const varNorm = this.normalizar(parsed.variante);
        // So usar variante da IA se aparece na descricao original
        if (descNorm.includes(varNorm) || varNorm.split(/\s+/).some(t => t.length >= 3 && descNorm.includes(t))) {
          variantes.push(varNorm);
        }
      }

      const descTermos: string[] = [];
      if (parsed.tipo) {
        // Separar tipo em termos individuais, ignorar preposicoes e termos curtos
        const ignorar = new Set(['DE', 'DO', 'DA', 'DOS', 'DAS', 'COM', 'SEM', 'EM', 'POR', 'PARA', 'NO', 'NA', 'AO', 'AS', 'OS', 'UM', 'UMA', 'E', 'OU', 'A', 'O']);
        const tipoTermos = this.normalizar(parsed.tipo).split(/\s+/).filter(t => t.length >= 3 && !ignorar.has(t));
        descTermos.push(...tipoTermos);
      }

      // todosTermos = todos os termos originais
      const todosTermos = descricao
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 2);

      const resultado: ProdutoDecomposto = {
        original: descricao,
        marcas,
        marcaFonte: marcas.length > 0 ? 'ia' : undefined,
        gramaturas,
        embalagens,
        variantes,
        descricao: descTermos,
        todosTermos,
      };

      console.log(`[Decomposer IA] "${descricao}" -> marca=[${marcas}] tipo=[${descTermos}] gram=[${gramaturas.map(g=>g.textoOriginal)}] emb=[${embalagens}] var=[${variantes}]`);

      this._cacheIA.set(chave, resultado);
      return resultado;

    } catch (error: any) {
      console.error('[Decomposer IA] Erro:', error.message);
      const fallback = this.decompor(descricao);
      this._cacheIA.set(chave, fallback);
      return fallback;
    }
  }

  /**
   * Carrega marcas do Oracle TAB_MARCA (com cache de 30min)
   * Retorna lista de marcas normalizadas (uppercase, sem acentos)
   */
  static async carregarMarcasOracle(): Promise<string[]> {
    // Se cache ainda valido, retorna direto
    if (this._marcasOracle.length > 0 && (Date.now() - this._marcasOracleTimestamp) < this.CACHE_TTL_MS) {
      return this._marcasOracle;
    }

    // Evita multiplas cargas simultaneas
    if (this._marcasOracleCarregando) {
      return this._marcasOracle;
    }

    this._marcasOracleCarregando = true;
    try {
      const schema = await MappingService.getSchema();

      // Tentar buscar TAB_MARCA
      let tabMarca: string | null = null;
      let colCodMarca: string | null = null;
      let colDesMarca: string | null = null;

      try {
        const mappings = await (MappingService as any).getMappings();
        if (mappings?.version === 2 && mappings?.tabelas?.TAB_MARCA?.nome_real) {
          tabMarca = `${schema}.${mappings.tabelas.TAB_MARCA.nome_real}`;
          colCodMarca = mappings.tabelas.TAB_MARCA.colunas?.codigo_marca || 'COD_MARCA';
          colDesMarca = mappings.tabelas.TAB_MARCA.colunas?.descricao_marca || 'DES_MARCA';
        }
      } catch { /* TAB_MARCA nao mapeada */ }

      if (!tabMarca || !colDesMarca) {
        console.log('[Decomposer] TAB_MARCA nao mapeada, usando apenas lista estatica');
        this._marcasOracleCarregando = false;
        return this._marcasOracle;
      }

      const sql = `SELECT DISTINCT ${colDesMarca} AS DES_MARCA FROM ${tabMarca} WHERE ${colDesMarca} IS NOT NULL ORDER BY ${colDesMarca}`;
      const rows = await OracleService.query<any>(sql, {});

      const marcas: string[] = [];
      for (const row of rows) {
        const nome = String(row.DES_MARCA || '').trim();
        if (nome.length >= 2) {
          marcas.push(this.normalizar(nome));
        }
      }

      this._marcasOracle = marcas;
      this._marcasOracleTimestamp = Date.now();
      console.log(`[Decomposer] Carregadas ${marcas.length} marcas do Oracle TAB_MARCA (ex: ${marcas.slice(0, 5).join(', ')})`);
      return marcas;
    } catch (err: any) {
      console.error('[Decomposer] Erro ao carregar marcas Oracle:', err.message);
      return this._marcasOracle; // retorna cache antigo se tiver
    } finally {
      this._marcasOracleCarregando = false;
    }
  }

  /**
   * Retorna todas as marcas combinadas (Oracle + estatica), normalizadas e deduplicadas
   */
  static getTodasMarcas(): string[] {
    const estaticas = MARCAS_CONHECIDAS.map(m => this.normalizar(m));
    const todas = [...new Set([...this._marcasOracle, ...estaticas])];
    return todas;
  }

  /**
   * Forca recarregamento do cache de marcas Oracle
   */
  static invalidarCacheMarcas(): void {
    this._marcasOracleTimestamp = 0;
    this._marcasOracle = [];
  }

  // Mapa de numeros por extenso <-> digitos (bidirecional)
  private static readonly NUMEROS_EXTENSO: Record<string, string> = {
    'ZERO': '0', 'UM': '1', 'DOIS': '2', 'TRES': '3', 'QUATRO': '4',
    'CINCO': '5', 'SEIS': '6', 'SETE': '7', 'OITO': '8', 'NOVE': '9',
    'DEZ': '10', 'ONZE': '11', 'DOZE': '12',
    '0': 'ZERO', '1': 'UM', '2': 'DOIS', '3': 'TRES', '4': 'QUATRO',
    '5': 'CINCO', '6': 'SEIS', '7': 'SETE', '8': 'OITO', '9': 'NOVE',
    '10': 'DEZ', '11': 'ONZE', '12': 'DOZE',
  };

  /**
   * Normaliza texto: uppercase, remove acentos, remove chars especiais
   */
  static normalizar(texto: string): string {
    return texto
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Gera variantes de uma marca substituindo numeros extenso <-> digitos.
   * Ex: "TRES CORACOES" -> ["3 CORACOES", "3CORACOES"]
   * Ex: "3 CORACOES" -> ["TRES CORACOES"]
   * Retorna array com a marca original + todas variantes
   */
  static gerarVariantesMarca(marca: string): string[] {
    const variantes = new Set<string>();
    variantes.add(marca);

    const termos = marca.split(/\s+/);
    for (let i = 0; i < termos.length; i++) {
      const alt = this.NUMEROS_EXTENSO[termos[i]];
      if (alt) {
        // Substituir o termo e gerar variante
        const novos = [...termos];
        novos[i] = alt;
        variantes.add(novos.join(' '));
        // Tambem gerar versao sem espaco (ex: "3CORACOES")
        variantes.add(novos.join(''));
      }
    }

    return [...variantes];
  }

  /**
   * Decompoe uma descricao de produto em categorias semanticas
   */
  static decompor(descricao: string): ProdutoDecomposto {
    const normalizado = this.normalizar(descricao);
    const todosTermos = normalizado.split(/\s+/).filter(t => t.length >= 2);

    const marcas: string[] = [];
    const gramaturas: GramaturaParsed[] = [];
    const embalagens: string[] = [];
    const variantes: string[] = [];
    const desc: string[] = [];
    const usados = new Set<string>();

    // Passo 1: Extrair gramaturas (regex)
    const gramRegex = /\b(\d+[\.,]?\d*)\s*(ML|G|GR|KG|L|LT|UN|UND|PC|PCS|PCT|FD)\b/gi;
    let match: RegExpExecArray | null;
    const normalParaGram = normalizado;
    while ((match = gramRegex.exec(normalParaGram)) !== null) {
      const valorStr = match[1].replace(',', '.');
      const valor = parseFloat(valorStr);
      const unidade = this.normalizarUnidade(match[2].toUpperCase());
      const textoOrig = match[0].replace(/\s/g, '').toUpperCase();
      if (valor > 0) {
        gramaturas.push({ valor, unidade, textoOriginal: textoOrig });
        // Marcar os termos como usados
        const termosGram = match[0].toUpperCase().split(/\s+/);
        termosGram.forEach(t => usados.add(t));
        // Tambem marcar a versao sem espaco
        usados.add(textoOrig);
      }
    }

    // Tambem tentar extrair gramaturas coladas (ex: "85G", "350ML")
    for (const termo of todosTermos) {
      if (usados.has(termo)) continue;
      const colado = /^(\d+[\.,]?\d*)(ML|G|GR|KG|L|LT|UN|UND|PC|PCS|PCT|FD)$/i.exec(termo);
      if (colado) {
        const valorStr = colado[1].replace(',', '.');
        const valor = parseFloat(valorStr);
        const unidade = this.normalizarUnidade(colado[2].toUpperCase());
        if (valor > 0) {
          gramaturas.push({ valor, unidade, textoOriginal: termo.toUpperCase() });
          usados.add(termo);
        }
      }
    }

    // Passo 2: Extrair embalagens
    const embNorm = EMBALAGENS_CONHECIDAS.map(e => this.normalizar(e));
    for (const termo of todosTermos) {
      if (usados.has(termo)) continue;
      if (embNorm.includes(termo)) {
        embalagens.push(termo);
        usados.add(termo);
      }
    }

    // Passo 3: Extrair marcas (Oracle + estaticas + heuristica posicional)
    // Combina marcas do Oracle TAB_MARCA com lista estatica
    const todasMarcas = this.getTodasMarcas();
    const marcasSet = new Set(todasMarcas);
    let marcaFonte: 'oracle' | 'estatica' | 'posicional' | undefined;

    // Check triplas de termos (ex: "FLOR DE IPE", "TRES CORACOES", "CAFE DO PONTO")
    for (let i = 0; i < todosTermos.length - 2; i++) {
      if (usados.has(todosTermos[i])) continue;
      const tripla = `${todosTermos[i]} ${todosTermos[i + 1]} ${todosTermos[i + 2]}`;
      if (marcasSet.has(tripla)) {
        marcas.push(tripla);
        usados.add(todosTermos[i]);
        usados.add(todosTermos[i + 1]);
        usados.add(todosTermos[i + 2]);
        marcaFonte = this._marcasOracle.includes(tripla) ? 'oracle' : 'estatica';
      }
    }

    // Check pares de termos (ex: "RED BULL", "FLOR IPE")
    for (let i = 0; i < todosTermos.length - 1; i++) {
      if (usados.has(todosTermos[i])) continue;
      const par = `${todosTermos[i]} ${todosTermos[i + 1]}`;
      if (marcasSet.has(par)) {
        marcas.push(par);
        usados.add(todosTermos[i]);
        usados.add(todosTermos[i + 1]);
        if (!marcaFonte) marcaFonte = this._marcasOracle.includes(par) ? 'oracle' : 'estatica';
      }
    }

    // Depois check termos individuais
    for (const termo of todosTermos) {
      if (usados.has(termo)) continue;
      if (TERMOS_IGNORADOS.includes(termo)) continue;
      if (marcasSet.has(termo)) {
        marcas.push(termo);
        usados.add(termo);
        if (!marcaFonte) marcaFonte = this._marcasOracle.includes(termo) ? 'oracle' : 'estatica';
      }
    }

    // HEURISTICA POSICIONAL: se nenhuma marca foi encontrada nas listas,
    // o 2o termo (apos o tipo do produto) e provavelmente a marca.
    // Padrao: BISC TRAKINAS MORANGO 180G → posicao 0=tipo, posicao 1=marca
    if (marcas.length === 0 && todosTermos.length >= 3) {
      const tiposSet = new Set(TIPOS_PRODUTO.map(t => this.normalizar(t)));
      const embSet = new Set(EMBALAGENS_CONHECIDAS.map(e => this.normalizar(e)));
      const varSet2 = new Set(VARIANTES_CONHECIDAS.map(v => this.normalizar(v)));

      // Encontrar o indice do tipo do produto (geralmente posicao 0)
      let tipoIdx = -1;
      for (let i = 0; i < Math.min(todosTermos.length, 2); i++) {
        if (tiposSet.has(todosTermos[i]) && !usados.has(todosTermos[i])) {
          tipoIdx = i;
          break;
        }
      }

      // Se encontrou tipo, o proximo termo nao-usado e nao-classificado e provavelmente a marca
      if (tipoIdx >= 0) {
        for (let i = tipoIdx + 1; i < todosTermos.length; i++) {
          const t = todosTermos[i];
          if (usados.has(t)) continue;
          if (TERMOS_IGNORADOS.includes(t)) continue;
          if (embSet.has(t)) continue;
          if (varSet2.has(t)) continue;
          if (/^\d+$/.test(t) || /^\d+X\d+$/.test(t)) continue;

          // Este termo e provavelmente a marca!
          marcas.push(t);
          usados.add(t);
          marcaFonte = 'posicional';
          break;
        }
      }
    }

    // Passo 4: Extrair variantes
    const varNorm = VARIANTES_CONHECIDAS.map(v => this.normalizar(v));
    const varSet = new Set(varNorm);

    // Check pares de variantes (ex: "PURO MALTE", "ERVA DOCE")
    for (let i = 0; i < todosTermos.length - 1; i++) {
      if (usados.has(todosTermos[i])) continue;
      const par = `${todosTermos[i]} ${todosTermos[i + 1]}`;
      if (varSet.has(par)) {
        variantes.push(par);
        usados.add(todosTermos[i]);
        usados.add(todosTermos[i + 1]);
      }
    }

    for (const termo of todosTermos) {
      if (usados.has(termo)) continue;
      if (TERMOS_IGNORADOS.includes(termo)) continue;
      if (varSet.has(termo)) {
        variantes.push(termo);
        usados.add(termo);
      }
    }

    // Passo 5: Tudo que sobrou e descricao generica
    for (const termo of todosTermos) {
      if (usados.has(termo)) continue;
      if (TERMOS_IGNORADOS.includes(termo)) continue;
      // Ignorar numeros puros (ex: "1X24", "12")
      if (/^\d+$/.test(termo)) continue;
      // Ignorar patterns de pack (1X24, 12X80, etc)
      if (/^\d+X\d+$/.test(termo)) continue;
      desc.push(termo);
    }

    return {
      original: descricao,
      marcas,
      marcaFonte,
      gramaturas,
      embalagens,
      variantes,
      descricao: desc,
      todosTermos,
    };
  }

  /**
   * Normaliza unidade de gramatura
   */
  static normalizarUnidade(unidade: string): string {
    const map: Record<string, string> = {
      'G': 'G', 'GR': 'G',
      'KG': 'KG',
      'ML': 'ML',
      'L': 'L', 'LT': 'L',
      'UN': 'UN', 'UND': 'UN',
      'PC': 'UN', 'PCS': 'UN', 'PCT': 'UN',
      'FD': 'FD',
    };
    return map[unidade] || unidade;
  }

  /**
   * Converte gramatura para gramas (ou ml) base para comparacao
   */
  static converterParaBase(gram: GramaturaParsed): number {
    switch (gram.unidade) {
      case 'KG': return gram.valor * 1000; // KG -> G
      case 'L': return gram.valor * 1000;  // L -> ML
      case 'G': return gram.valor;
      case 'ML': return gram.valor;
      default: return gram.valor;
    }
  }

  /**
   * Verifica se duas gramaturas estao dentro da tolerancia %
   */
  static gramaturasDentroTolerancia(
    g1: GramaturaParsed,
    g2: GramaturaParsed,
    toleranciaPct: number
  ): boolean {
    // Mesma familia de unidade?
    const familia1 = ['G', 'KG'].includes(g1.unidade) ? 'peso' : ['ML', 'L'].includes(g1.unidade) ? 'volume' : 'outro';
    const familia2 = ['G', 'KG'].includes(g2.unidade) ? 'peso' : ['ML', 'L'].includes(g2.unidade) ? 'volume' : 'outro';
    if (familia1 !== familia2) return false;

    const base1 = this.converterParaBase(g1);
    const base2 = this.converterParaBase(g2);
    if (base1 === 0 || base2 === 0) return false;

    const diff = Math.abs(base1 - base2);
    const media = (base1 + base2) / 2;
    const pctDiff = (diff / media) * 100;
    return pctDiff <= toleranciaPct;
  }

  /**
   * Retorna a lista de marcas conhecidas (Oracle + estaticas, para uso na penalidade SQL)
   */
  static getMarcasConhecidas(): string[] {
    return this.getTodasMarcas();
  }

  /**
   * Gera variantes de gramatura dentro da tolerancia para uso em SQL
   * Ex: 85G com 15% -> retorna ["72G", "73G", ..., "98G"] (apenas valores discretos chave)
   */
  static gerarVariantesGramatura(gram: GramaturaParsed, toleranciaPct: number): string[] {
    const fator = toleranciaPct / 100;
    const minVal = Math.floor(gram.valor * (1 - fator));
    const maxVal = Math.ceil(gram.valor * (1 + fator));
    const variantes: string[] = [];

    // Gerar valores discretos a cada 5 unidades (ou 1 se range pequeno)
    const step = (maxVal - minVal) <= 20 ? 1 : 5;
    for (let v = minVal; v <= maxVal; v += step) {
      if (v > 0 && v !== gram.valor) {
        variantes.push(`${v}${gram.unidade}`);
      }
    }

    return variantes;
  }
}
