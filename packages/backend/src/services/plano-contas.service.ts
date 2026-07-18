/**
 * Plano de Contas manual (Conciliação "Direto Manual").
 * CRUD hierárquico (grupo -> conta) no Postgres + importação do plano atual do ERP (Oracle).
 */
import { AppDataSource } from '../config/database';
import { PlanoConta } from '../entities/PlanoConta';
import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

interface ContaNode {
  id: number;
  nome: string;
  num_ordem: number;
  ativo: boolean;
  is_receita: boolean;
}
interface GrupoNode extends ContaNode {
  tipo: 'grupo';
  contas: ContaNode[];
}

export class PlanoContasService {
  private static repo() {
    return AppDataSource.getRepository(PlanoConta);
  }

  /** Retorna a árvore Grupo -> Contas de uma loja */
  static async listarArvore(codLoja: number): Promise<GrupoNode[]> {
    const all = await this.repo().find({
      where: { cod_loja: codLoja },
      order: { num_ordem: 'ASC', id: 'ASC' },
    });
    const grupos = all.filter(p => p.tipo === 'grupo');
    const contasByParent = new Map<number, PlanoConta[]>();
    for (const c of all) {
      if (c.tipo === 'conta' && c.parent_id != null) {
        const arr = contasByParent.get(c.parent_id) || [];
        arr.push(c);
        contasByParent.set(c.parent_id, arr);
      }
    }
    return grupos.map(g => ({
      id: g.id,
      tipo: 'grupo' as const,
      nome: g.nome,
      num_ordem: g.num_ordem,
      ativo: g.ativo,
      is_receita: g.is_receita,
      contas: (contasByParent.get(g.id) || []).map(c => ({
        id: c.id,
        nome: c.nome,
        num_ordem: c.num_ordem,
        ativo: c.ativo,
        is_receita: c.is_receita,
      })),
    }));
  }

  /** Cria grupo ou conta */
  static async criar(data: {
    cod_loja: number;
    tipo: 'grupo' | 'conta';
    parent_id?: number | null;
    nome: string;
    is_receita?: boolean;
    num_ordem?: number;
  }): Promise<PlanoConta> {
    if (!data.nome?.trim()) throw new Error('Nome é obrigatório');
    if (data.tipo === 'conta' && !data.parent_id) throw new Error('Conta precisa de um grupo (parent_id)');

    // num_ordem: se não informado, coloca no fim do escopo (grupo ou dentro do grupo pai)
    let numOrdem = data.num_ordem;
    if (numOrdem == null) {
      const scope = data.tipo === 'grupo'
        ? { cod_loja: data.cod_loja, tipo: 'grupo' }
        : { cod_loja: data.cod_loja, parent_id: data.parent_id! };
      const last = await this.repo().find({ where: scope as any, order: { num_ordem: 'DESC' }, take: 1 });
      numOrdem = (last[0]?.num_ordem ?? 0) + 1;
    }

    // conta herda is_receita do grupo pai quando não informado
    let isReceita = data.is_receita ?? false;
    if (data.tipo === 'conta' && data.is_receita == null && data.parent_id) {
      const pai = await this.repo().findOne({ where: { id: data.parent_id } });
      if (pai) isReceita = pai.is_receita;
    }

    const row = this.repo().create({
      cod_loja: data.cod_loja,
      tipo: data.tipo,
      parent_id: data.tipo === 'grupo' ? null : data.parent_id!,
      nome: data.nome.trim(),
      is_receita: isReceita,
      num_ordem: numOrdem,
      ativo: true,
    });
    return this.repo().save(row);
  }

  static async editar(id: number, patch: Partial<Pick<PlanoConta, 'nome' | 'is_receita' | 'num_ordem' | 'ativo'>>): Promise<PlanoConta | null> {
    const row = await this.repo().findOne({ where: { id } });
    if (!row) return null;
    if (patch.nome !== undefined) row.nome = String(patch.nome).trim();
    if (patch.is_receita !== undefined) row.is_receita = !!patch.is_receita;
    if (patch.num_ordem !== undefined) row.num_ordem = Number(patch.num_ordem);
    if (patch.ativo !== undefined) row.ativo = !!patch.ativo;
    return this.repo().save(row);
  }

  /** Exclui grupo (e suas contas via ON DELETE CASCADE) ou uma conta */
  static async excluir(id: number): Promise<boolean> {
    const res = await this.repo().delete(id);
    return (res.affected || 0) > 0;
  }

  /**
   * Importa o plano de contas atual do ERP (TAB_CATEGORIA -> grupos, TAB_SUBCATEGORIA -> contas).
   * Idempotente: pula o que já existe (rastreado por cod_categoria_oracle/cod_subcategoria_oracle).
   */
  static async importarDoOracle(codLoja: number): Promise<{ gruposCriados: number; contasCriadas: number }> {
    const schema = await MappingService.getSchema();
    const tabCategoria = `${schema}.${await MappingService.getRealTableName('TAB_CATEGORIA')}`;
    const tabSubcategoria = `${schema}.${await MappingService.getRealTableName('TAB_SUBCATEGORIA')}`;
    const catCod = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'cod_categoria');
    const catDes = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'des_categoria');
    const catOrdem = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'num_ordem');
    const catInativo = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'flg_inativo');
    const subCatCod = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'cod_categoria');
    const subCod = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'cod_subcategoria');
    const subDes = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'des_subcategoria');
    const subOrdem = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'num_ordem');
    let subInativo = 'FLG_INATIVO';
    try { const v = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'flg_inativo'); if (v) subInativo = v; } catch {}

    const categorias = await OracleService.query<any>(`
      SELECT ${catCod} AS COD, ${catDes} AS DES, ${catOrdem} AS ORDEM
      FROM ${tabCategoria}
      WHERE NVL(${catInativo}, 'N') = 'N'
      ORDER BY ${catOrdem}
    `);
    const subcategorias = await OracleService.query<any>(`
      SELECT ${subCatCod} AS COD_CAT, ${subCod} AS COD_SUB, ${subDes} AS DES, ${subOrdem} AS ORDEM
      FROM ${tabSubcategoria}
      WHERE NVL(${subInativo}, 'N') = 'N'
        AND ${subDes} NOT LIKE '##%' AND ${subDes} NOT LIKE '*%'
      ORDER BY ${subCatCod}, ${subOrdem}, ${subCod}
    `);

    const repo = this.repo();
    let gruposCriados = 0;
    let contasCriadas = 0;

    // Mapa cod_categoria_oracle -> id do grupo (existentes + criados agora)
    const grupoIdByOracle = new Map<number, number>();
    const existentes = await repo.find({ where: { cod_loja: codLoja } });
    for (const e of existentes) {
      if (e.tipo === 'grupo' && e.cod_categoria_oracle != null) grupoIdByOracle.set(e.cod_categoria_oracle, e.id);
    }
    const contaExiste = new Set(
      existentes.filter(e => e.tipo === 'conta' && e.cod_categoria_oracle != null && e.cod_subcategoria_oracle != null)
        .map(e => `${e.cod_categoria_oracle}_${e.cod_subcategoria_oracle}`)
    );

    for (const cat of categorias) {
      const codCat = Number(cat.COD);
      const nome = (cat.DES || '').trim();
      if (!nome) continue;
      const isReceita = nome.toUpperCase().startsWith('RECEITA');

      let grupoId = grupoIdByOracle.get(codCat);
      if (!grupoId) {
        const g = await repo.save(repo.create({
          cod_loja: codLoja,
          tipo: 'grupo',
          parent_id: null,
          nome,
          is_receita: isReceita,
          num_ordem: Number(cat.ORDEM) || 0,
          ativo: true,
          cod_categoria_oracle: codCat,
          cod_subcategoria_oracle: null,
        }));
        grupoId = g.id;
        grupoIdByOracle.set(codCat, grupoId);
        gruposCriados++;
      }

      const subs = subcategorias.filter((s: any) => Number(s.COD_CAT) === codCat);
      for (const sub of subs) {
        const codSub = Number(sub.COD_SUB);
        const key = `${codCat}_${codSub}`;
        if (contaExiste.has(key)) continue;
        const desSub = (sub.DES || '').trim();
        if (!desSub) continue;
        await repo.save(repo.create({
          cod_loja: codLoja,
          tipo: 'conta',
          parent_id: grupoId,
          nome: desSub,
          is_receita: isReceita,
          num_ordem: Number(sub.ORDEM) || 0,
          ativo: true,
          cod_categoria_oracle: codCat,
          cod_subcategoria_oracle: codSub,
        }));
        contaExiste.add(key);
        contasCriadas++;
      }
    }

    console.log(`[PlanoContas] Import loja ${codLoja}: ${gruposCriados} grupos, ${contasCriadas} contas`);
    return { gruposCriados, contasCriadas };
  }
}
