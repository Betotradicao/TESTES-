import { AppDataSource } from '../config/database';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';
import { GarimpadorContato } from '../entities/GarimpadorContato';
import { ConfigurationService } from './configuration.service';
import { MappingService } from './mapping.service';
import { OracleService } from './oracle.service';
import { WhatsAppService } from './whatsapp.service';
import { GarimpadorDecomposerService } from './garimpador-decomposer.service';
import axios from 'axios';

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

interface ResultadoComparacao {
  produtoOfertado: string;
  precoOferta: number;
  condicao?: string;
  condicoes?: CondicaoPreco[];
  produtoLoja: ProdutoOracle | null;
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
        // 1. Buscar produto no Oracle
        const produtoOracle = await this.buscarProdutoOracle(prod.produto);

        if (!produtoOracle) {
          console.log(`[Garimpador Comparador] Produto nao encontrado: ${prod.produto}`);
          continue;
        }

        // 2. Comparar precos e calcular margens
        const resultado = this.calcularComparacao(prod, produtoOracle);

        // 3. Classificar (Ouro/Prata/Bronze)
        resultado.classificacao = await this.classificar(resultado.diferencaMargem);

        resultados.push(resultado);

        // 4. Verificar se produto esta excluido
        const codProdStr = String(produtoOracle.codProduto);
        if (produtosExcluidos.includes(codProdStr)) {
          console.log(`[Garimpador Comparador] Produto ${codProdStr} excluido - nao envia pro WhatsApp`);
          continue;
        }

        // 5. Se for boa oferta (preco oferta < custo), enviar para WhatsApp
        if (resultado.boaOferta) {
          const msgFormatada = this.formatarMensagem(resultado, tipoContato, contato);
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
   * Busca produto no Oracle - Abordagem inspirada no n8n:
   * 1. IA decompoe o produto de entrada (marca, tipo, gramatura, etc)
   * 2. SQL busca AMPLA com OR de todos os termos - pega top 15 candidatos
   * 3. IA (GPT-mini) avalia todos os candidatos e escolhe o correto
   * Se IA diz "nenhum" -> Fora do Mix
   */
  static async buscarProdutoOracle(descricaoBusca: string): Promise<ProdutoOracle | null> {
    try {
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
      const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo', 'VAL_CUSTO_REP');
      const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA');
      const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual', 'QTD_EST_ATUAL');
      const colCobertura = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura', 'QTD_COBERTURA');
      const colPedidoCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pedido_compra', 'QTD_PEDIDO_COMPRA');
      const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva', 'DES_RANK_PRODLOJA');
      const colVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media', 'VAL_VENDA_MEDIA');
      const colMargem = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem', 'VAL_MARGEM');
      const colPesquisaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media', 'VAL_PESQUISA_MEDIA');
      const colCodFornUltCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra', 'COD_FORN_ULT_COMPRA');
      const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja', 'COD_LOJA');

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

      const codLoja = parseInt((await ConfigurationService.get('garimpador_cod_loja', '1')) || '1');

      // ========== PASSO 1: IA DECOMPOE O PRODUTO DE ENTRADA ==========
      await GarimpadorDecomposerService.carregarMarcasOracle();
      const decomp = await GarimpadorDecomposerService.decomporComIA(descricaoBusca);

      console.log(`[Garimpador] Buscando "${descricaoBusca}" → decomp: marcas=[${decomp.marcas}] gram=[${decomp.gramaturas.map(g=>g.textoOriginal)}] desc=[${decomp.descricao}] emb=[${decomp.embalagens}] var=[${decomp.variantes}]`);

      // ========== PASSO 2: SQL BUSCA AMPLA - PEGAR CANDIDATOS ==========
      // Montar termos de busca com variantes para abreviacoes
      const termosLike: string[] = [];
      const params: any = { codLoja };
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

      // Gramaturas - variantes (1L->1LT, 500G->500GR)
      for (const gram of decomp.gramaturas) {
        const gramVariants: string[] = [gram.textoOriginal];
        if (gram.unidade === 'L') gramVariants.push(`${gram.valor}LT`);
        if (gram.unidade === 'G') gramVariants.push(`${gram.valor}GR`);
        for (const gv of gramVariants) {
          const k = `p${pi++}`;
          params[k] = `%${gv}%`;
          termosLike.push(`UPPER(p.${colDescricao}) LIKE :${k}`);
        }
      }

      // Descricao/tipo - truncar pra 3 chars pra pegar abreviacoes Oracle
      for (const d of decomp.descricao) {
        const searchTerm = d.length >= 5 ? d.substring(0, 3) : d;
        const k = `p${pi++}`;
        params[k] = `%${searchTerm}%`;
        termosLike.push(`UPPER(p.${colDescricao}) LIKE :${k}`);
      }

      // Embalagens e variantes
      for (const emb of decomp.embalagens) {
        const k = `p${pi++}`;
        params[k] = `%${emb}%`;
        termosLike.push(`UPPER(p.${colDescricao}) LIKE :${k}`);
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

      if (termosLike.length === 0) return null;

      // Busca com OR amplo + score simples (contagem de termos que batem)
      const scoreCalc = termosLike.map(cond => `CASE WHEN ${cond.replace(`UPPER(p.${colDescricao}) LIKE`, `UPPER(p.${colDescricao}) LIKE`)} THEN 1 ELSE 0 END`).join(' + ');
      const orConds = termosLike.join(' OR ');

      const sql = `
        SELECT * FROM (
          SELECT
            p.${colCodProduto} AS COD_PRODUTO,
            p.${colCodBarras} AS CODIGO_BARRAS,
            p.${colDescricao} AS DESCRICAO,
            NVL(pl.${colPrecoCusto}, 0) AS PRECO_CUSTO,
            NVL(pl.${colPrecoVenda}, 0) AS PRECO_VENDA,
            NVL(pl.${colPesquisaMedia}, 0) AS PRECO_VENDA_CONCORRENTE,
            NVL(pl.${colEstoque}, 0) AS ESTOQUE_ATUAL,
            NVL(pl.${colCobertura}, 0) AS COBERTURA,
            NVL(pl.${colPedidoCompra}, 0) AS PEDIDO_COMPRA,
            NVL(pl.${colCurva}, '-') AS CURVA,
            NVL(pl.${colVendaMedia}, 0) AS VENDA_MEDIA_DIA,
            NVL(pl.${colMargem}, 0) AS MARGEM_REFERENCIA,
            NVL(s.${colDesSecao}, '-') AS SECAO,
            NVL(g.${colDesGrupo}, '-') AS GRUPO,
            NVL(sg.${colDesSubgrupo}, '-') AS SUBGRUPO,
            NVL(f.${colRazaoSocial}, '-') AS FORNECEDOR,
            (
              SELECT NVL(SUM(pdv.${colQtdVendaPdv}), 0)
              FROM ${schema}.${tabProdutoPdv} pdv
              WHERE pdv.${colCodProdutoPdv} = p.${colCodProduto}
                AND pdv.${colDataVendaPdv} >= SYSDATE - 30
            ) AS VENDA_30D,
            (${scoreCalc}) AS MATCH_SCORE
          FROM ${schema}.${tabProduto} p
          LEFT JOIN ${schema}.${tabProdutoLoja} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto} AND pl.${colCodLojaLoja} = :codLoja
          LEFT JOIN ${schema}.${tabSecao} s ON s.${colCodSecaoSecao} = p.${colCodSecao}
          LEFT JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupoGrupo} = p.${colCodGrupo} AND g.${colCodSecaoGrupo} = p.${colCodSecao}
          LEFT JOIN ${schema}.${tabSubgrupo} sg ON sg.${colCodSubgrupoSub} = p.${colCodSubgrupo} AND sg.${colCodSecaoSub} = p.${colCodSecao} AND sg.${colCodGrupoSub} = p.${colCodGrupo}
          LEFT JOIN ${schema}.${tabFornecedor} f ON f.${colCodForn} = pl.${colCodFornUltCompra}
          WHERE (${orConds})
          ORDER BY (${scoreCalc}) DESC, NVL(pl.${colPrecoVenda}, 0) DESC
        ) WHERE ROWNUM <= 15
      `;

      let rows: any[];
      try {
        rows = await OracleService.query<any>(sql, params);
      } catch (queryErr: any) {
        console.error(`[Garimpador] Erro na query Oracle:`, queryErr.message);
        return null;
      }

      console.log(`[Garimpador] SQL encontrou ${rows.length} candidatos para "${descricaoBusca}"`);

      if (rows.length === 0) return null;

      // ========== PASSO 3: IA DECIDE QUAL CANDIDATO E O CORRETO ==========
      const apiKey = await ConfigurationService.get('openai_api_key');
      const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');

      if (!apiKey) {
        // Sem IA, usa primeiro resultado (fallback)
        return this.mapearProdutoOracle(rows[0], 50);
      }

      // Montar lista de candidatos para a IA avaliar
      const listaCandidatos = rows.map((r: any, i: number) => `${i + 1}. ${r.DESCRICAO}`).join('\n');

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Voce e um especialista em matching de produtos de supermercado brasileiro.

Seu trabalho: dado um produto buscado e uma lista de candidatos do sistema, identifique qual candidato e o MESMO produto.

REGRAS IMPORTANTES:
- Descricoes no sistema podem estar ABREVIADAS: "achocolatado"="achoc", "cerveja"="cerv", "detergente"="deterg", "absorvente"="abs", "biscoito"="bisc", "refrigerante"="refrig", "amaciante"="amac", "acucar"="acucar" ou "acuc", "refinado"="ref", "sanitaria"="sanit", etc.
- O PRODUTO deve ser o MESMO tipo (cerveja=cerveja, detergente=detergente, nao detergente=amaciante)
- A MARCA deve ser a MESMA (Skol=Skol, Ype=Ype, nao misturar marcas)
- A GRAMATURA/VOLUME deve ser compativel (350ml=350ml, 1L=1LT, 500g=500gr)
- Se encontrar o produto, retorne APENAS o numero. Se NENHUM candidato corresponder ao produto buscado, retorne 0.
- Retorne APENAS um numero, nada mais.`
            },
            {
              role: 'user',
              content: `Produto buscado: "${descricaoBusca}"

Candidatos do sistema:
${listaCandidatos}

Qual numero corresponde ao produto buscado? (0 se nenhum):`,
            },
          ],
          temperature: 0,
          max_tokens: 10,
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const resposta = response.data.choices?.[0]?.message?.content?.trim();
      const escolha = parseInt(resposta);

      if (escolha === 0 || isNaN(escolha)) {
        console.log(`[Garimpador] IA decidiu: NENHUM candidato corresponde a "${descricaoBusca}" → Fora do Mix`);
        return null;
      }

      const idx = escolha - 1;
      if (idx < 0 || idx >= rows.length) {
        console.log(`[Garimpador] IA retornou indice invalido ${escolha} para "${descricaoBusca}"`);
        return null;
      }

      const escolhido = rows[idx];
      console.log(`[Garimpador] IA decidiu: "${descricaoBusca}" → "${escolhido.DESCRICAO}" (candidato ${escolha}/${rows.length})`);

      return this.mapearProdutoOracle(escolhido, 90);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao buscar produto no Oracle:', error.message);
      return null;
    }
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

      const sql = `
        SELECT p.${colCodProduto} AS COD, p.${colDescricao} AS DESC_PROD,
               NVL(pl.${colPrecoVenda}, 0) AS PRC_VENDA
        FROM ${schema}.${tabProduto} p
        LEFT JOIN ${schema}.${tabProdutoLoja} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto}
        WHERE (${likeConds})
          AND ROWNUM <= 20
        ORDER BY NVL(pl.${colPrecoVenda}, 0) DESC
      `;

      const candidatos = await OracleService.query<any>(sql, params);
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
              content: 'Voce e um comparador de produtos de supermercado brasileiro. Dado um produto buscado e uma lista de candidatos, retorne APENAS o numero do melhor match. Considere abreviacoes comuns (CERV=CERVEJA, DET=DETERGENTE, AG SANIT=AGUA SANITARIA, FEIJ=FEIJAO, etc). A MARCA deve ser a MESMA - se o produto buscado e de uma marca e nenhum candidato e da mesma marca, retorne 0. Se nenhum candidato for o mesmo tipo de produto, retorne 0.'
            },
            {
              role: 'user',
              content: `Produto buscado: "${descricaoBusca}"\n\nCandidatos:\n${listaDescricoes}\n\nRetorne apenas o numero (1, 2, 3...):`,
            },
          ],
          temperature: 0,
          max_tokens: 10,
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
      const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo', 'VAL_CUSTO_REP');
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

      // COD_LOJA: busca da config ou default 1
      const codLoja = parseInt((await ConfigurationService.get('garimpador_cod_loja', '1')) || '1');

      const sql = `
        SELECT
          p.${colCodProduto} AS COD_PRODUTO,
          p.${colCodBarras} AS CODIGO_BARRAS,
          p.${colDescricao} AS DESCRICAO,
          NVL(pl.${colPrecoCusto}, 0) AS PRECO_CUSTO,
          NVL(pl.${colPrecoVenda}, 0) AS PRECO_VENDA,
          NVL(pl.${colPesquisaMedia}, 0) AS PRECO_VENDA_CONCORRENTE,
          NVL(pl.${colEstoque}, 0) AS ESTOQUE_ATUAL,
          NVL(pl.${colCobertura}, 0) AS COBERTURA,
          NVL(pl.${colPedidoCompra}, 0) AS PEDIDO_COMPRA,
          NVL(pl.${colCurva}, '-') AS CURVA,
          NVL(pl.${colVendaMedia}, 0) AS VENDA_MEDIA_DIA,
          NVL(pl.${colMargem}, 0) AS MARGEM_REFERENCIA,
          NVL(s.${colDesSecao}, '-') AS SECAO,
          NVL(g.${colDesGrupo}, '-') AS GRUPO,
          NVL(sg.${colDesSubgrupo}, '-') AS SUBGRUPO,
          NVL(f.${colRazaoSocial}, '-') AS FORNECEDOR,
          (
            SELECT NVL(SUM(pdv.${colQtdVendaPdv}), 0)
            FROM ${schema}.${tabProdutoPdv} pdv
            WHERE pdv.${colCodProdutoPdv} = p.${colCodProduto}
              AND pdv.${colDataVendaPdv} >= SYSDATE - 30
          ) AS VENDA_30D
        FROM ${schema}.${tabProduto} p
        LEFT JOIN ${schema}.${tabProdutoLoja} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto} AND pl.${colCodLojaLoja} = :codLoja
        LEFT JOIN ${schema}.${tabSecao} s ON s.${colCodSecaoSecao} = p.${colCodSecao}
        LEFT JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupoGrupo} = p.${colCodGrupo} AND g.${colCodSecaoGrupo} = p.${colCodSecao}
        LEFT JOIN ${schema}.${tabSubgrupo} sg ON sg.${colCodSubgrupoSub} = p.${colCodSubgrupo} AND sg.${colCodSecaoSub} = p.${colCodSecao} AND sg.${colCodGrupoSub} = p.${colCodGrupo}
        LEFT JOIN ${schema}.${tabFornecedor} f ON f.${colCodForn} = pl.${colCodFornUltCompra}
        WHERE p.${colCodProduto} = :codProduto
      `;

      const rows = await OracleService.query<any>(sql, { codProduto, codLoja });
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
              content: 'Voce e um comparador de produtos de supermercado brasileiro. Dado um produto buscado e uma lista de candidatos, retorne APENAS o numero do melhor match. Considere abreviacoes comuns no Oracle (CERV=CERVEJA, DET=DETERGENTE, AG SANIT=AGUA SANITARIA, FEIJ=FEIJAO, BISC=BISCOITO, etc). Priorize: mesma marca, mesmo tipo de produto, mesma gramatura. Se nenhum for compativel, retorne 0.'
            },
            {
              role: 'user',
              content: `Produto buscado: "${descricaoBusca}"\n\nCandidatos:\n${lista}\n\nRetorne apenas o numero:`,
            },
          ],
          temperature: 0,
          max_tokens: 10,
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
