import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';
import { MappingService } from './mapping.service';
import { OracleService } from './oracle.service';

/**
 * Grupo de similares na ruptura.
 *
 * Regra do Roberto (22/08/2026): produtos com o MESMO numero de grupo sao
 * substitutos entre si. Se QUALQUER um do grupo tem estoque, o cliente acha o
 * que precisa na gondola — entao nenhum item daquele grupo entra na pesquisa
 * de ruptura. Ex.: os 9 leites integrais 1L no grupo 5; se o Italac tem estoque,
 * o Parmalat zerado nao e ruptura de verdade.
 *
 * O grupo e configurado na tela "Configurar Peculiaridades" (products.grupo_similar).
 *
 * ATENCAO: nao da pra decidir so com os itens candidatos. O item com estoque
 * normalmente NAO esta na lista de ruptura — justamente por ter estoque. Por isso
 * o estoque do grupo inteiro e consultado no Oracle.
 */
export class GrupoSimilarService {
  /** Cache curto: a mesma tela chama os dois endpoints de ruptura em sequencia. */
  private static cache: { loja: number; cobertos: Set<number>; grupos: Map<string, number>; ts: number } | null = null;
  private static readonly CACHE_MS = 60000;

  /**
   * Devolve, para uma loja: o mapa produto->grupo e o conjunto de grupos que tem
   * pelo menos um produto com estoque (os "cobertos").
   */
  private static async carregar(codLoja: number) {
    if (this.cache && this.cache.loja === codLoja && Date.now() - this.cache.ts < this.CACHE_MS) {
      return this.cache;
    }

    const productRepository = AppDataSource.getRepository(Product);
    const configurados = await productRepository
      .createQueryBuilder('p')
      .select(['p.erp_product_id', 'p.grupo_similar'])
      .where('p.grupo_similar IS NOT NULL')
      .andWhere('p.grupo_similar > 0')
      .getMany();

    const grupos = new Map<string, number>();
    for (const p of configurados) {
      grupos.set(String(p.erp_product_id), Number(p.grupo_similar));
    }

    const cobertos = new Set<number>();

    if (grupos.size > 0) {
      const schema = await MappingService.getSchema();
      const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
      const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
      const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
      const colCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');

      // Oracle nao aceita mais de 1000 itens numa lista IN — vai em blocos.
      const codigos = [...grupos.keys()];
      const estoquePorProduto = new Map<string, number>();

      for (let i = 0; i < codigos.length; i += 900) {
        const bloco = codigos.slice(i, i + 900);
        const binds: any = { codLoja };
        const placeholders = bloco.map((cod, idx) => {
          binds[`p${idx}`] = cod;
          return `:p${idx}`;
        });

        const rows = await OracleService.query(
          `SELECT ${colCodProduto} AS COD, NVL(${colEstoque}, 0) AS ESTOQUE
             FROM ${tabProdutoLoja}
            WHERE ${colCodLoja} = :codLoja
              AND ${colCodProduto} IN (${placeholders.join(',')})`,
          binds
        );

        for (const r of rows) {
          estoquePorProduto.set(String(r.COD), Number(r.ESTOQUE) || 0);
        }
      }

      for (const [cod, grupo] of grupos) {
        if ((estoquePorProduto.get(cod) || 0) > 0) cobertos.add(grupo);
      }
    }

    this.cache = { loja: codLoja, cobertos, grupos, ts: Date.now() };
    return this.cache;
  }

  /** Zera o cache — chamar quando os grupos forem reconfigurados na tela. */
  static invalidarCache(): void {
    this.cache = null;
  }

  /**
   * Tira da lista os itens cujo grupo ja tem substituto com estoque.
   * `getCodigo` diz onde esta o codigo do produto em cada item (varia por endpoint).
   */
  static async filtrar<T>(
    items: T[],
    codLoja: number,
    getCodigo: (item: T) => string
  ): Promise<{ items: T[]; removidos: number }> {
    if (!items.length) return { items, removidos: 0 };

    try {
      const { cobertos, grupos } = await this.carregar(codLoja);
      if (!cobertos.size) return { items, removidos: 0 };

      const filtrados = items.filter(item => {
        const grupo = grupos.get(String(getCodigo(item)));
        return !grupo || !cobertos.has(grupo);
      });

      const removidos = items.length - filtrados.length;
      if (removidos > 0) {
        console.log(`🔗 [GRUPO SIMILAR] ${removidos} itens fora da ruptura — o grupo tem substituto com estoque`);
      }
      return { items: filtrados, removidos };
    } catch (err: any) {
      // Grupo similar e refinamento, nao pode derrubar a pesquisa de ruptura.
      console.error('[GRUPO SIMILAR] falhou, seguindo sem filtrar:', err?.message || err);
      return { items, removidos: 0 };
    }
  }
}
