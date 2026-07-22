import { AppDataSource } from '../config/database';
import { ConciliacaoAmarracao } from '../entities/ConciliacaoAmarracao';
import { PlanoConta } from '../entities/PlanoConta';

/**
 * Lê o PDF de uma fatura de cartão e devolve os lançamentos (data, descrição,
 * valor) — mais uma sugestão de conta pra cada, aprendida das amarrações que o
 * usuário já fez.
 *
 * Validado com fatura Santander Empresas (soma dos itens fechou no centavo com
 * o "Total Desta Fatura"). O parser é por REGEX no texto do PDF — funciona pra
 * fatura com texto selecionável (a normal do internet banking). Fatura
 * escaneada (imagem) não tem texto e cairia vazia — nesse caso o front avisa.
 */

export interface LancamentoFatura {
  data: string;         // dd/mm/aaaa como veio no PDF
  descricao: string;
  valor: number;        // sempre positivo; despesa
  plano_conta_id?: number | null;   // sugestão aprendida
  conta_nome?: string | null;
}

export interface FaturaParseResult {
  lancamentos: LancamentoFatura[];
  totalItens: number;
  somaLancamentos: number;
  totalFaturaDetectadoPdf: number | null;  // "Total Desta Fatura" se achado
  bateComPdf: boolean;                      // soma == total do PDF?
}

export class FaturaPdfService {
  /**
   * Linhas que NÃO são despesa real e não podem entrar na soma:
   * - pagamento da fatura anterior (vem negativo, "DEB AUTOM DE FATURA")
   * - anuidade parcelada com valor 0,00
   * - encargos/juros zerados
   * O teste mostrou que ignorar isso faz a soma bater exatamente com o total.
   */
  private static ehLancamentoValido(desc: string, valor: number): boolean {
    if (valor <= 0) return false;                        // pagamento (negativo) ou 0,00
    const d = desc.toUpperCase();
    if (d.includes('DEB AUTOM DE FATURA')) return false; // pagamento da anterior
    if (d.includes('DEB AUTOM DE FATURA EM C')) return false;
    return true;
  }

  /** Extrai o "Total Desta Fatura: R$ X" pra conferência (se existir no PDF). */
  private static extrairTotalFatura(texto: string): number | null {
    const m = texto.match(/Total\s+Desta\s+Fatura:?\s*R\$?\s*([\d.]+,\d{2})/i);
    return m ? this.brToNumber(m[1]) : null;
  }

  /** "1.460,00" -> 1460.00 ; "-34.115,45" -> -34115.45 */
  private static brToNumber(s: string): number {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }

  /**
   * Varre o texto do PDF procurando linhas no formato:
   *   dd/mm/aaaa  <descrição>  <valor R$>  <valor US$>  <cotação>
   * Pega o PRIMEIRO valor monetário depois da descrição (a coluna R$).
   */
  private static parsearLinhas(texto: string): LancamentoFatura[] {
    const out: LancamentoFatura[] = [];
    // Data no início + descrição + valor (aceita negativo) na coluna R$.
    // O valor US$/cotação depois são ignorados (só queremos o R$).
    const re = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})\s+[\d.]+,\d{2}\s+[\d.]+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      const data = m[1];
      const descricao = m[2].replace(/\s+/g, ' ').trim();
      const valor = this.brToNumber(m[3]);
      if (!this.ehLancamentoValido(descricao, valor)) continue;
      out.push({ data, descricao, valor });
    }
    return out;
  }

  /**
   * Sugere conta por AMARRAÇÃO já existente. Casa por prefixo do estabelecimento:
   * "ATACADAO 737 AS PARC 02/02" e "ATACADAO 737 AS" batem no mesmo comerciante.
   * É o "aprender pro futuro" que o Roberto pediu — reaproveita o que ele já
   * classificou em faturas anteriores.
   */
  private static async sugerirContas(
    lancamentos: LancamentoFatura[],
    codLoja: number,
  ): Promise<void> {
    if (!AppDataSource.isInitialized || !lancamentos.length) return;

    const amRepo = AppDataSource.getRepository(ConciliacaoAmarracao);
    const pcRepo = AppDataSource.getRepository(PlanoConta);
    const [amarracoes, contas] = await Promise.all([
      amRepo.find({ where: { cod_loja: codLoja } }),
      pcRepo.find({ where: { cod_loja: codLoja } }),
    ]);
    const nomeById = new Map<number, string>();
    for (const c of contas) nomeById.set(c.id, c.nome);

    // Normaliza pra comparar: maiúsculo, sem acento, colapsa espaço.
    const norm = (s: string) =>
      (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

    // Índice das amarrações de fatura (texto_exato -> conta). Guardamos o texto
    // normalizado pra casar por "um contém o outro" (prefixo do comerciante).
    const idx = amarracoes.map(a => ({ txt: norm(a.texto_exato), id: a.plano_conta_id }));

    for (const l of lancamentos) {
      const alvo = norm(l.descricao);
      // Melhor match = amarração cujo texto é o maior prefixo comum do alvo.
      let melhor: { id: number; len: number } | null = null;
      for (const a of idx) {
        if (!a.txt) continue;
        if (alvo.startsWith(a.txt) || a.txt.startsWith(alvo) || alvo.includes(a.txt)) {
          if (!melhor || a.txt.length > melhor.len) melhor = { id: a.id, len: a.txt.length };
        }
      }
      if (melhor) {
        l.plano_conta_id = melhor.id;
        l.conta_nome = nomeById.get(melhor.id) || null;
      }
    }
  }

  static async parse(buffer: Buffer, codLoja: number): Promise<FaturaParseResult> {
    // pdf-parse 2.x (classe PDFParse). Escolhida de propósito: ela separa as
    // colunas com ESPAÇO ("15/06 SCP... 11,40 0,00 5,387"), o que dá pra
    // parsear. A 1.x cola tudo ("SCP...11,400,005,387") e vira ambíguo.
    // Requer Node 20+ (process.getBuiltinModule/DOMMatrix) — o backend roda
    // Node 20 (ver Dockerfile).
    const { PDFParse } = await import('pdf-parse') as any;
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    const texto: string = parsed?.text || '';

    const lancamentos = this.parsearLinhas(texto);
    await this.sugerirContas(lancamentos, codLoja);

    const soma = Math.round(lancamentos.reduce((s, l) => s + l.valor, 0) * 100) / 100;
    const totalPdf = this.extrairTotalFatura(texto);

    return {
      lancamentos,
      totalItens: lancamentos.length,
      somaLancamentos: soma,
      totalFaturaDetectadoPdf: totalPdf,
      bateComPdf: totalPdf != null && Math.abs(totalPdf - soma) < 0.01,
    };
  }
}
