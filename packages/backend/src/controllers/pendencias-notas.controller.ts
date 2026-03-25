import { Request, Response } from 'express';
import { MappingService } from '../services/mapping.service';
import { OracleService } from '../services/oracle.service';

interface AuthRequest extends Request {
  user?: any;
}

export class PendenciasNotasController {
  /**
   * GET /pendencias-notas
   * Lista notas fiscais da SNFETNE com filtros
   */
  static async listarNotas(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, fornecedor, codLoja, numNf, manifesto, statusNfe } = req.query;

      const schema = await MappingService.getSchema();

      const conditions: string[] = [];
      const params: any = {};

      if (dataInicio) {
        conditions.push(`TRUNC(n.DT_EMISSAO) >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`);
        params.dataInicio = dataInicio;
      }
      if (dataFim) {
        conditions.push(`TRUNC(n.DT_EMISSAO) <= TO_DATE(:dataFim, 'YYYY-MM-DD')`);
        params.dataFim = dataFim;
      }
      if (fornecedor) {
        conditions.push(`(UPPER(e.DS_NOME) LIKE UPPER(:fornecedor) OR n.NR_CNPJE LIKE :fornecedorCnpj)`);
        params.fornecedor = `%${fornecedor}%`;
        params.fornecedorCnpj = `%${fornecedor}%`;
      }
      if (numNf) {
        conditions.push(`n.NR_NOTA = :numNf`);
        params.numNf = parseInt(numNf as string, 10);
      }
      if (manifesto !== undefined && manifesto !== '' && manifesto !== 'todos') {
        conditions.push(`n.ST_MANIFESTO = :manifesto`);
        params.manifesto = parseInt(manifesto as string, 10);
      }
      if (statusNfe !== undefined && statusNfe !== '' && statusNfe !== 'todos') {
        conditions.push(`n.ST_NFE = :statusNfe`);
        params.statusNfe = parseInt(statusNfe as string, 10);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Buscar entidade (fornecedor) pelo CNPJ - SNFETE é a tabela de entidades
      const sql = `
        SELECT
          n.ID_NOTA,
          n.NR_NOTA as NUM_NF,
          n.DS_SERIE as SERIE,
          n.DT_EMISSAO,
          n.VR_TOTAL as VALOR_TOTAL,
          n.NR_CNPJE as CNPJ_EMITENTE,
          n.NR_CHAVE as CHAVE_ACESSO,
          n.TIPO_STATUS,
          n.ST_NFE,
          n.TIPO_MANIFESTO,
          n.ST_MANIFESTO,
          n.FG_ENT as FLAG_ENTRADA,
          n.DT_RECMERC as DTA_RECEBIMENTO,
          e.DS_NOME as FORNECEDOR
        FROM ${schema}.SNFETNE n
        LEFT JOIN ${schema}.SNFETE e ON e.NR_CNPJ = n.NR_CNPJE
        ${where}
        ORDER BY n.DT_EMISSAO DESC, n.NR_NOTA DESC
      `;

      const rows = await OracleService.query<any>(sql, params);

      const manifestoLabel = (st: number) => {
        switch(st) {
          case 0: return 'Pendente';
          case 1: return 'Confirmada';
          case 2: return 'Ciencia';
          case 3: return 'Desconhecida';
          case 4: return 'Nao Realizada';
          default: return `Status ${st}`;
        }
      };

      const nfeLabel = (st: number) => {
        switch(st) {
          case 100: return 'Autorizada';
          case 101: return 'Cancelada';
          case 999: return 'Rejeitada';
          default: return `Status ${st}`;
        }
      };

      res.json({
        success: true,
        total: rows.length,
        data: rows.map(r => ({
          idNota: r.ID_NOTA,
          numNf: r.NUM_NF,
          serie: r.SERIE,
          dtaEmissao: r.DT_EMISSAO,
          valorTotal: r.VALOR_TOTAL || 0,
          cnpj: r.CNPJ_EMITENTE,
          chaveAcesso: r.CHAVE_ACESSO,
          fornecedor: r.FORNECEDOR || r.CNPJ_EMITENTE,
          tipoStatus: r.TIPO_STATUS,
          statusNfe: r.ST_NFE,
          statusNfeLabel: nfeLabel(r.ST_NFE),
          tipoManifesto: r.TIPO_MANIFESTO,
          statusManifesto: r.ST_MANIFESTO,
          statusManifestoLabel: manifestoLabel(r.ST_MANIFESTO),
          flagEntrada: r.FLAG_ENTRADA,
          dtaRecebimento: r.DTA_RECEBIMENTO
        }))
      });
    } catch (error: any) {
      console.error('❌ [PendenciasNotas] Erro:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /pendencias-notas/:idNota/itens
   * Lista itens de uma nota fiscal da SNFETNEI
   */
  static async listarItensNota(req: AuthRequest, res: Response) {
    try {
      const { idNota } = req.params;

      const schema = await MappingService.getSchema();

      const sql = `
        SELECT
          i.NR_ITEM,
          i.CD_PROD as COD_PRODUTO,
          i.CD_EAN as EAN,
          i.DS_PROD as DESCRICAO,
          i.NR_NCM as NCM,
          i.NR_CFOP as CFOP,
          i.DS_UNID as UNIDADE,
          i.QT_PROD as QUANTIDADE,
          i.VR_UNIT as VALOR_UNITARIO,
          i.VR_TOTAL as VALOR_TOTAL,
          i.VR_ICMS_VICMS as ICMS,
          i.VR_PIS_VPIS as PIS,
          i.VR_COFINS_VCOFINS as COFINS,
          i.VR_DESC as DESCONTO
        FROM ${schema}.SNFETNEI i
        WHERE i.ID_NOTA = :idNota
        ORDER BY i.NR_ITEM
      `;

      const rows = await OracleService.query<any>(sql, { idNota: parseInt(idNota, 10) });

      res.json({
        success: true,
        total: rows.length,
        data: rows.map(r => ({
          numItem: r.NR_ITEM,
          codProduto: r.COD_PRODUTO,
          ean: r.EAN,
          descricao: r.DESCRICAO,
          ncm: r.NCM,
          cfop: r.CFOP,
          unidade: r.UNIDADE,
          quantidade: r.QUANTIDADE || 0,
          valorUnitario: r.VALOR_UNITARIO || 0,
          valorTotal: r.VALOR_TOTAL || 0,
          icms: r.ICMS || 0,
          pis: r.PIS || 0,
          cofins: r.COFINS || 0,
          desconto: r.DESCONTO || 0
        }))
      });
    } catch (error: any) {
      console.error('❌ [PendenciasNotas] Erro itens:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}
