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
 * Interface para os mapeamentos de um módulo (formato v1)
 */
interface ModuleMappings {
  [fieldKey: string]: string; // formato: campo_table ou campo_column
}

/**
 * Interface para todos os mapeamentos (formato v1)
 */
interface AllMappings {
  [moduleKey: string]: ModuleMappings;
}

/**
 * Interface para mapeamento de tabela (formato v2)
 */
interface TableMapping {
  nome_real: string;
  colunas: {
    [fieldName: string]: string; // Ex: { "codigo_produto": "COD_PRODUTO" }
  };
}

/**
 * Interface para configuração de módulo (formato v2)
 */
interface ModuleConfig {
  nome: string;
  icone: string;
  tabelas_usadas: string[];
  campos_por_tabela: {
    [tableName: string]: string[]; // campos que esse módulo usa de cada tabela
  };
}

/**
 * Interface para mapeamentos formato v2 (por tabelas)
 */
interface MappingsV2 {
  version: 2;
  tabelas: {
    [tableId: string]: TableMapping;
  };
  modulos: {
    [moduleId: string]: ModuleConfig;
  };
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
   * Modo estrito: quando true, IGNORA fallbacks e exige que o mapeamento exista.
   * Se o mapeamento não for encontrado, lança erro claro.
   * Isso garante que o sistema roda 100% pela configuração, sem valores hardcoded.
   */
  static STRICT_MODE = false; // Ligar após migrar todos os callers V1 para V2

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
    if (mapping?.column) {
      return mapping.column;
    }

    // Modo estrito: não usa fallback, exige mapeamento
    if (this.STRICT_MODE) {
      throw new Error(`[MappingService] Coluna não mapeada: ${module}.${field}. Configure em Configurações > Mapeamento.`);
    }

    return fallback;
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
    if (mapping?.table) {
      return mapping.table;
    }

    if (this.STRICT_MODE) {
      throw new Error(`[MappingService] Tabela não mapeada: ${module}.${field}. Configure em Configurações > Mapeamento.`);
    }

    return fallback;
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

    if (!mapping && this.STRICT_MODE) {
      throw new Error(`[MappingService] Campo não mapeado: ${module}.${field}. Configure em Configurações > Mapeamento.`);
    }

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

      if (!connection?.schema) {
        throw new Error('[MappingService] Schema não configurado. Configure em Configurações > Conexões.');
      }

      return connection.schema;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Schema não configurado')) {
        throw error;
      }
      console.error('[MappingService] Erro ao buscar schema:', error);
      throw new Error('[MappingService] Erro ao buscar schema do banco. Verifique a conexão configurada.');
    }
  }

  // ==========================================
  // NOVOS MÉTODOS PARA FORMATO V2 (POR TABELAS)
  // ==========================================

  /**
   * Verifica se os mapeamentos estão no formato v2
   */
  static isV2Format(mappings: any): mappings is MappingsV2 {
    return mappings && mappings.version === 2 && mappings.tabelas;
  }

  /**
   * Busca o mapeamento de uma tabela específica (formato v2)
   *
   * @param tableId - ID da tabela (ex: 'TAB_PRODUTO')
   * @returns Mapeamento da tabela ou null
   *
   * @example
   * const tableMapping = await MappingService.getTableMapping('TAB_PRODUTO');
   * // Retorna: { nome_real: 'TAB_PRODUTO', colunas: { codigo_produto: 'COD_PRODUTO', ... } }
   */
  static async getTableMapping(tableId: string): Promise<TableMapping | null> {
    const mappings = await this.getMappings();

    if (this.isV2Format(mappings)) {
      return mappings.tabelas[tableId] || null;
    }

    return null;
  }

  /**
   * Busca uma coluna específica de uma tabela (formato v2)
   * Retorna o fallback se não encontrar
   *
   * @param tableId - ID da tabela (ex: 'TAB_PRODUTO')
   * @param fieldName - Nome do campo (ex: 'codigo_produto')
   * @param fallback - Valor padrão se não encontrar
   * @returns Nome da coluna real ou fallback
   *
   * @example
   * const col = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
   */
  static async getColumnFromTable(
    tableId: string,
    fieldName: string,
    fallback?: string
  ): Promise<string> {
    const mappings = await this.getMappings();

    // Formato v2
    if (this.isV2Format(mappings)) {
      const tableMapping = mappings.tabelas[tableId];
      if (tableMapping?.colunas?.[fieldName]) {
        return tableMapping.colunas[fieldName];
      }
    }

    // Modo estrito: ignora fallback, exige mapeamento
    if (this.STRICT_MODE) {
      throw new Error(`[MappingService] Coluna não mapeada: ${tableId}.${fieldName}. Configure em Configurações > Mapeamento.`);
    }

    return fallback || fieldName.toUpperCase();
  }

  /**
   * Busca o nome real de uma tabela (formato v2)
   *
   * @param tableId - ID da tabela (ex: 'TAB_PRODUTO')
   * @param fallback - Valor padrão se não encontrar
   * @returns Nome real da tabela ou fallback
   *
   * @example
   * const tableName = await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO');
   */
  static async getRealTableName(tableId: string, fallback?: string): Promise<string> {
    const mappings = await this.getMappings();

    if (this.isV2Format(mappings)) {
      const tableMapping = mappings.tabelas[tableId];
      if (tableMapping?.nome_real) {
        return tableMapping.nome_real;
      }
    }

    // Modo estrito: ignora fallback, exige mapeamento
    if (this.STRICT_MODE) {
      throw new Error(`[MappingService] Tabela não mapeada: ${tableId}. Configure em Configurações > Mapeamento.`);
    }

    return fallback || tableId;
  }

  /**
   * Busca tabela e coluna de uma vez (formato v2)
   * Com fallbacks para valores padrão
   *
   * @param tableId - ID da tabela
   * @param fieldName - Nome do campo
   * @param fallbackTable - Tabela padrão
   * @param fallbackColumn - Coluna padrão
   * @returns Object com table e column
   *
   * @example
   * const { table, column } = await MappingService.getTableAndColumn(
   *   'TAB_PRODUTO', 'codigo_produto', 'TAB_PRODUTO', 'COD_PRODUTO'
   * );
   */
  static async getTableAndColumn(
    tableId: string,
    fieldName: string,
    fallbackTable: string,
    fallbackColumn: string
  ): Promise<FieldMapping> {
    const mappings = await this.getMappings();

    if (this.isV2Format(mappings)) {
      const tableMapping = mappings.tabelas[tableId];
      if (tableMapping) {
        return {
          table: tableMapping.nome_real || fallbackTable,
          column: tableMapping.colunas?.[fieldName] || fallbackColumn
        };
      }
    }

    if (this.STRICT_MODE) {
      throw new Error(`[MappingService] Tabela/coluna não mapeada: ${tableId}.${fieldName}. Configure em Configurações > Mapeamento.`);
    }

    return {
      table: fallbackTable,
      column: fallbackColumn
    };
  }

  /**
   * Verifica se um módulo está configurado (todas as tabelas necessárias preenchidas)
   *
   * @param moduleId - ID do módulo (ex: 'prevencao', 'gestao')
   * @param requiredTables - Lista de tabelas obrigatórias para o módulo
   * @returns true se o módulo está configurado
   */
  static async isModuleConfigured(moduleId: string, requiredTables: string[]): Promise<boolean> {
    const mappings = await this.getMappings();

    if (!this.isV2Format(mappings)) {
      // Para formato v1, verifica se o módulo existe
      return !!mappings[moduleId];
    }

    // Para formato v2, verifica se todas as tabelas obrigatórias estão configuradas
    for (const tableId of requiredTables) {
      const tableMapping = mappings.tabelas[tableId];
      if (!tableMapping || !tableMapping.nome_real) {
        return false;
      }
    }

    return true;
  }

  /**
   * Retorna lista de tabelas compartilhadas entre módulos
   *
   * @param tableId - ID da tabela
   * @returns Lista de módulos que usam essa tabela
   */
  static async getTableSharingModules(tableId: string): Promise<string[]> {
    const mappings = await this.getMappings();

    if (!this.isV2Format(mappings)) {
      return [];
    }

    const sharingModules: string[] = [];
    for (const [moduleId, moduleConfig] of Object.entries(mappings.modulos)) {
      if (moduleConfig.tabelas_usadas?.includes(tableId)) {
        sharingModules.push(moduleId);
      }
    }

    return sharingModules;
  }
}
