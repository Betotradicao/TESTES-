import { AppDataSource } from '../config/database';
import { AuditInspection } from '../entities/AuditInspection';
import { AuditResponse } from '../entities/AuditResponse';
import { AuditTemplate } from '../entities/AuditTemplate';
import { AuditAlternativeModel } from '../entities/AuditAlternativeModel';
import { WhatsAppService } from './whatsapp.service';

/**
 * Envia uma auditoria inteira como uma "thread" de mensagens no WhatsApp,
 * formando um feed sequencial:
 *  - 1 mensagem de cabecalho (resumo)
 *  - Para cada secao: 1 separador
 *  - Para cada pergunta: 1 texto com pergunta/resposta/observacao + N fotos
 */
export class ChecklistFeedService {
  private static async sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * Baixa imagem como Buffer.
   */
  private static async downloadImage(url: string, timeoutMs = 8000): Promise<Buffer | null> {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(t);
      if (!resp.ok) return null;
      const ab = await resp.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }

  /**
   * Envia a auditoria completa como feed de mensagens para o grupo WhatsApp.
   */
  static async enviarFeed(
    inspectionId: number,
    groupId: string
  ): Promise<{ enviadas: number; falhas: number }> {
    const insRepo = AppDataSource.getRepository(AuditInspection);
    const respRepo = AppDataSource.getRepository(AuditResponse);
    const tplRepo = AppDataSource.getRepository(AuditTemplate);
    const modeloRepo = AppDataSource.getRepository(AuditAlternativeModel);

    const inspection = await insRepo.findOne({
      where: { id: inspectionId },
      relations: ['template', 'auditor', 'auditado'],
    });
    if (!inspection) throw new Error(`Inspection ${inspectionId} nao encontrada`);

    const template = await tplRepo.findOne({
      where: { id: inspection.template_id },
      relations: ['sections', 'sections.questions'],
    });
    if (!template) throw new Error(`Template ${inspection.template_id} nao encontrado`);

    const respostas = await respRepo.find({ where: { inspection_id: inspectionId } });
    const respostaPorQuestion = new Map<number, AuditResponse>();
    for (const r of respostas) respostaPorQuestion.set(r.question_id, r);

    const modeloIds = new Set<number>();
    template.sections?.forEach(s => (s.questions || []).forEach(q => q.modelo_alternativa_id && modeloIds.add(q.modelo_alternativa_id)));
    const modelos = modeloIds.size > 0
      ? await modeloRepo.find({ where: Array.from(modeloIds).map(id => ({ id })) })
      : [];
    const modeloMap = new Map(modelos.map(m => [m.id, m]));

    const pct = Number(inspection.percentual_conformidade) || 0;
    const meta = Number(template.minimo_esperado) || 95;
    const atingiu = pct >= meta;

    let enviadas = 0, falhas = 0;
    const delayMs = 900; // delay entre msgs pra nao sobrecarregar

    const send = async (text: string) => {
      const ok = await WhatsAppService.sendMessage(groupId, text);
      if (ok) enviadas++; else falhas++;
      await this.sleep(delayMs);
    };
    const sendImg = async (url: string, caption: string) => {
      const buf = await this.downloadImage(url);
      if (!buf) { falhas++; return; }
      // Envia como imagem inline (aparece renderizada no WhatsApp)
      const ok = await WhatsAppService.sendImageBuffer(groupId, buf, `evid_${Date.now()}.jpg`, caption);
      if (ok) enviadas++; else falhas++;
      await this.sleep(delayMs);
    };

    // 1) Cabecalho
    const cabecalho = [
      '📋 *AUDITORIA - CHECK LIST*',
      '',
      `🗂️ *Roteiro:* ${template.nome}`,
      `👤 *Auditor:* ${inspection.auditor?.name || '—'}`,
      inspection.auditado ? `🎯 *Auditado:* ${inspection.auditado.name}` : null,
      inspection.cod_loja != null ? `🏪 *Loja:* ${inspection.cod_loja}` : null,
      `${atingiu ? '✅' : '⚠️'} *Conformidade:* ${pct.toFixed(1)}% · Meta: ${meta.toFixed(0)}%`,
      `📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      inspection.observacao_geral ? `\n📝 *Obs. geral:* ${inspection.observacao_geral}` : null,
    ].filter(Boolean).join('\n');
    await send(cabecalho);

    // 2) Para cada secao
    const sections = (template.sections || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    let qCount = 0;
    for (const section of sections) {
      // Separador da secao
      await send(`━━━━━━━━━━━━━━━━━\n📂 *${(section.nome || '').toUpperCase()}*\n━━━━━━━━━━━━━━━━━`);

      const questions = (section.questions || []).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));
      for (const q of questions) {
        qCount++;
        const resp = respostaPorQuestion.get(q.id);
        const modelo = q.modelo_alternativa_id ? modeloMap.get(q.modelo_alternativa_id) : null;
        const alternativas: any[] = Array.isArray(modelo?.alternativas) ? (modelo!.alternativas as any[]) : [];
        const altEscolhida = resp?.valor_opcao
          ? alternativas.find(a => (a.label || '').toLowerCase().trim() === (resp.valor_opcao || '').toLowerCase().trim())
          : null;

        let emojiResp = '⚪';
        if (resp?.conforme === 'C') emojiResp = '✅';
        else if (resp?.conforme === 'NC') emojiResp = '❌';
        else if (resp?.conforme === 'NA') emojiResp = '➖';
        if (altEscolhida?.icone === 'warning_yellow') emojiResp = '⚠️';

        const labelResp = resp?.valor_opcao
          || (resp?.conforme === 'C' ? 'Conforme'
              : resp?.conforme === 'NC' ? 'Nao conforme'
              : resp?.conforme === 'NA' ? 'N/A'
              : '(sem resposta)');

        const bloco = [
          `*${qCount}. ${q.texto}*`,
          `${emojiResp} *Resposta:* ${labelResp}`,
          resp?.observacao ? `📝 _${resp.observacao}_` : null,
          (Array.isArray(resp?.fotos) && resp!.fotos.length > 0) ? `📸 ${resp!.fotos.length} evidência(s) abaixo` : null,
        ].filter(Boolean).join('\n');
        await send(bloco);

        // Fotos como imagens em sequencia
        if (Array.isArray(resp?.fotos) && resp!.fotos.length > 0) {
          const fotos = resp!.fotos.slice(0, 5); // limite razoavel por pergunta
          for (let i = 0; i < fotos.length; i++) {
            const url = (fotos[i] as any)?.url;
            if (!url) continue;
            await sendImg(url, `📸 ${qCount}. ${q.texto.substring(0, 80)} — ${i + 1}/${fotos.length}`);
          }
        }
      }
    }

    // 3) Rodape
    await send(`🏁 *Fim da auditoria #${inspection.id}*\nConformidade: *${pct.toFixed(1)}%* · Meta: ${meta.toFixed(0)}%`);

    return { enviadas, falhas };
  }
}
