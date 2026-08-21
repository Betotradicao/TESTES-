import ExcelJS from 'exceljs';

/**
 * Gerador de planilhas para os relatorios que hoje so saem em PDF.
 *
 * POR QUE existe: o PDF e otimo pra ler no celular, mas nao da pra filtrar,
 * ordenar nem somar. Quem recebe a auditoria precisa trabalhar os numeros
 * (por fornecedor, por secao, por perda) e no PDF isso e impossivel.
 *
 * A planilha nasce com as MESMAS colunas do PDF — se divergir, o usuario
 * perde a confianca nos dois. Mudou coluna no PDF, muda aqui.
 */

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  /** 'texto' | 'inteiro' | 'decimal' | 'dinheiro' | 'percentual' */
  tipo?: 'texto' | 'inteiro' | 'decimal' | 'dinheiro' | 'percentual';
  /** Soma esta coluna na linha de TOTAL do rodape */
  somar?: boolean;
}

export interface ExcelSheet {
  nome: string;
  columns: ExcelColumn[];
  rows: Record<string, any>[];
}

export interface ExcelResumo {
  titulo: string;
  linhas: Array<{ campo: string; valor: string | number }>;
}

const LARANJA = 'FFFF5500';
const CINZA_ZEBRA = 'FFF5F5F5';

/** Formato numerico do Excel por tipo de coluna. */
function formatoDe(tipo?: ExcelColumn['tipo']): string | undefined {
  switch (tipo) {
    case 'inteiro':    return '#,##0';
    case 'decimal':    return '#,##0.00';
    case 'dinheiro':   return 'R$ #,##0.00';
    case 'percentual': return '0.0"%"';
    default:           return undefined;
  }
}

export class ReportExcelService {
  /**
   * Monta a planilha e devolve o buffer pronto pra anexar no WhatsApp.
   * Nao escreve em disco: o PDF usa arquivo temporario e ja deu problema de
   * sobra em /uploads/temp — aqui o buffer morre junto com a requisicao.
   */
  static async gerar(sheets: ExcelSheet[], resumo?: ExcelResumo): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Radar 360';
    // NAO usar new Date() aqui: exceljs grava created/modified no arquivo e
    // isso muda o binario a cada geracao. Irrelevante pro usuario, mas deixa
    // qualquer comparacao de arquivo inutil.

    if (resumo) {
      const ws = wb.addWorksheet('Resumo');
      ws.columns = [{ width: 34 }, { width: 26 }];

      const tit = ws.addRow([resumo.titulo]);
      tit.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      tit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
      ws.mergeCells(tit.number, 1, tit.number, 2);
      tit.height = 24;
      tit.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.addRow([]);

      resumo.linhas.forEach(({ campo, valor }) => {
        const r = ws.addRow([campo, valor]);
        r.getCell(1).font = { bold: true };
      });
    }

    for (const sheet of sheets) {
      // Nome de aba no Excel: max 31 caracteres e sem : \ / ? * [ ]
      const nomeAba = sheet.nome.replace(/[:\\/\?\*\[\]]/g, '-').substring(0, 31);
      const ws = wb.addWorksheet(nomeAba);

      ws.columns = sheet.columns.map((c) => ({
        header: c.header,
        key: c.key,
        width: c.width ?? 16,
      }));

      const header = ws.getRow(1);
      header.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
      header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      header.height = 22;

      sheet.rows.forEach((row, idx) => {
        const r = ws.addRow(row);
        if (idx % 2 === 1) {
          r.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_ZEBRA } };
          });
        }
      });

      // Formato numerico coluna a coluna (depois das linhas, senao nao pega)
      sheet.columns.forEach((c, i) => {
        const fmt = formatoDe(c.tipo);
        if (fmt) ws.getColumn(i + 1).numFmt = fmt;
      });

      // Linha de TOTAL — o que o PDF nunca deu por item
      const temSoma = sheet.columns.some((c) => c.somar);
      if (temSoma && sheet.rows.length > 0) {
        const total: Record<string, any> = {};
        sheet.columns.forEach((c) => {
          if (c.somar) {
            total[c.key] = sheet.rows.reduce(
              (acc, r) => acc + (parseFloat(r[c.key]) || 0),
              0
            );
          }
        });
        const primeira = sheet.columns[0];
        if (primeira && !primeira.somar) total[primeira.key] = 'TOTAL';

        const r = ws.addRow(total);
        r.font = { bold: true };
        r.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0CC' } };
          cell.border = { top: { style: 'double', color: { argb: LARANJA } } };
        });
      }

      // Congela o cabecalho e liga o filtro — e o motivo de existir a planilha
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      if (sheet.rows.length > 0) {
        ws.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: sheet.columns.length },
        };
      }
    }

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }

  /** MIME do xlsx — a Evolution precisa dele, senao o anexo chega como generico. */
  static readonly MIME_XLSX =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}
