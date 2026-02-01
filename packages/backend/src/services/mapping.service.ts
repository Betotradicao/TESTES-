import { AppDataSource } from '../config/database';
import { DatabaseConnection } from '../entities/DatabaseConnection';

/**
 * Interface para representar um mapeamento de campo
 */
interface FieldMapping {
  table: string;
  column: string;
}

/**
 * Interface para os mapeamentos de um módulo
 */
interface ModuleMappings {
  [fieldKey: string]: string; // formato: campo_table ou campo_column
}

/**
 * Interface para todos os mapeamentos
 */
interface AllMappings {
  [moduleKey: string]: ModuleMappings;
}

/**
 * Cache de mapeamentos em memória
 */
let mappingsCache: AllMappings | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * MappingService - Serviço para buscar mapeamentos de tabelas/colunas dinamicamente
 *
 * Este serviço permite que as queries do sistema usem campos configurados
 * em "Configurações de Tabelas" ao invés de valores hardcoded.
 *
 * Exemplo de uso:
 * ```typescript
 * const { table, column } = await MappingService.getField('produtos', 'embalagem');
 * // Retorna: { table: 'TAB_PRODUTO', column: 'DES_EMBALAGEM' }
 *
 * // Usar na query:
 * const sql = `SELECT ${column} FROM ${schema}.${table} WHERE ...`;
 * ```
 */
export class MappingService {

  /**
   * Busca os mapeamentos da conexão padrão (ou primeira ativa)
   * e faz cache em memória por 5 minutos
   */
  static async getMappings(): Promise<AllMappings> {
    const now = Date.now();

    // Verifica se o cache ainda é válido
    if (mappingsCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
      return mappingsCache;
    }

    try {
      const connectionRepo = AppDataSource.getRepository(DatabaseConnection);

      // Busca a conexão padrão ou a primeira ativa
      let connection = await connectionRepo.findOne({
        where: { is_default: true }
      });

      if (!connection) {
        connection = await connectionRepo.findOne({
          where: { status: 'active' as any }
        });
      }

      if (!connection) {
        console.warn('[MappingService] Nenhuma conexão de banco configurada');
        return {};
      }

      if (!connection.mappings) {
        console.warn('[MappingService] Conexão não possui mapeamentos configurados');
        return {};
      }

      // Parseia o JSON de mapeamentos
      const parsed = typeof connection.mappings === 'string'
        ? JSON.parse(connection.mappings)
        : connection.mappings;

      // Atualiza o cache
      mappingsCache = parsed;
      cacheTimestamp = now;

      console.log('[MappingService] Mapeamentos carregados do banco');
      return parsed;

    } catch (error) {
      console.error('[MappingService] Erro ao buscar mapeamentos:', error);
      return {};
    }
  }

  /**
   * Busca a tabela e coluna de um campo específico
   *
   * @param module - Nome do módulo (produtos, vendas, estoque, etc)
   * @param field - Nome do campo (codigo, descricao, embalagem, etc)
   * @returns Object com table e column, ou null se não encontrado
   *
   * @example
   * const mapping = await MappingService.getField('produtos', 'embalagem');
   * // Retorna: { table: 'TAB_PRODUTO', column: 'DES_EMBALAGEM' }
   */
  static async getField(module: string, field: string): Promise<FieldMapping | null> {
    const mappings = await this.getMappings();

    // Busca pelos formatos possíveis de chaves
    // Formato novo (hierárquico): mappings.produtos.embalagem_table
    // Formato antigo (flat): mappings['produtos_embalagem_table']

    let table: string | undefined;
    let column: string | undefined;

    // Tenta formato hierárquico primeiro
    if (mappings[module]) {
      table = mappings[module][`${field}_table`];
      column = mappings[module][`${field}_column`];
    }

    // Se não encontrou, tenta formato flat
    if (!table || !column) {
      table = (mappings as any)[`${module}_${field}_table`];
      column = (mappings as any)[`${module}_${field}_column`];
    }

    if (!table || !column) {
      console.warn(`[MappingService] Mapeamento não encontrado para ${module}.${field}`);
      return null;
    }

    return { table, column };
  }

  /**
   * Busca apenas a coluna de um campo (quando a tabela já é conhecida)
   * Retorna o valor padrão (fallback) se não encontrar mapeamento
   *
   * @param module - Nome do módulo
   * @param field - Nome do campo
   * @param fallback - Valor padrão se não encontrar mapeamento
   * @returns Nome da coluna configurada ou o fallback
   *
   * @example
   * const col = await MappingService.getColumn('produtos', 'embalagem', 'DES_EMBALAGEM');
   * // Retorna a coluna configurada ou 'DES_EMBALAGEM' se não houver mapeamento
   */
  static async getColumn(module: string, field: string, fallback: string): Promise<string> {
    const mapping = await this.getField(module, field);
    return mapping?.column || fallback;
  }

  /**
   * Busca apenas a tabela de um campo (quando a coluna já é conhecida)
   * Retorna o valor padrão (fallback) se não encontrar mapeamento
   *
   * @param module - Nome do módulo
   * @param field - Nome do campo
   * @param fallback - Valor padrão se não encontrar mapeamento
   * @returns Nome da tabela configurada ou o fallback
   */
  static async getTable(module: string, field: string, fallback: string): Promise<string> {
    const mapping = await this.getField(module, field);
    return mapping?.table || fallback;
  }

  /**
   * Busca a tabela e coluna com fallbacks
   * Útil para manter compatibilidade com código legado
   *
   * @param module - Nome do módulo
   * @param field - Nome do campo
   * @param fallbackTable - Tabela padrão se não encontrar
   * @param fallbackColumn - Coluna padrão se não encontrar
   * @returns Object com table e column (sempre retorna valores)
   *
   * @example
   * const { table, column } = await MappingService.getFieldWithFallback(
   *   'produtos', 'embalagem', 'TAB_PRODUTO', 'DES_EMBALAGEM'
   * );
   * // Sempre retorna valores, seja do mapeamento ou do fallback
   */
  static async getFieldWithFallback(
    module: string,
    field: string,
    fallbackTable: string,
    fallbackColumn: string
  ): Promise<FieldMapping> {
    const mapping = await this.getField(module, field);
    return {
      table: mapping?.table || fallbackTable,
      column: mapping?.column || fallbackColumn
    };
  }

  /**
   * Limpa o cache de mapeamentos (útil após atualizar configurações)
   */
  static clearCache(): void {
    mappingsCache = null;
    cacheTimestamp = 0;
    console.log('[MappingService] Cache de mapeamentos limpo');
  }

  /**
   * Busca o schema configurado na conexão
   * @returns Schema ou 'INTERSOLID' como fallback
   */
  static async getSchema(): Promise<string> {
    try {
      const connectionRepo = AppDataSource.getRepository(DatabaseConnection);

      let connection = await connectionRepo.findOne({
        where: { is_default: true }
      });

      if (!connection) {
        connection = await connectionRepo.findOne({
          where: { status: 'active' as any }
        });
      }

      return connection?.schema || 'INTERSOLID';
    } catch (error) {
      console.error('[MappingService] Erro ao buscar schema:', error);
      return 'INTERSOLID';
    }
  }
}
