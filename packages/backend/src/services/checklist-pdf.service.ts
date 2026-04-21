import PDFDocument from 'pdfkit';
import { AppDataSource } from '../config/database';
import { AuditInspection } from '../entities/AuditInspection';
import { AuditResponse } from '../entities/AuditResponse';
import { AuditTemplate } from '../entities/AuditTemplate';
import { AuditAlternativeModel } from '../entities/AuditAlternativeModel';

export class ChecklistPDFService {
  private static norm(t: string | null | undefined): string {
    if (!t) return '-';
    return t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\x00-\x7F]/g, '');
  }

  /**
   * Baixa imagem como Buffer (com timeout). Retorna null se falhar.
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

  static async gerarPDFAuditoria(inspectionId: number): Promise<Buffer> {
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

    const respostas = await respRepo.find({ where: { inspection_id: inspectionId } });
    const respostaPorQuestion = new Map<number, AuditResponse>();
    for (const r of respostas) respostaPorQuestion.set(r.question_id, r);

    // Carrega modelos para mostrar labels
    const modeloIds = new Set<number>();
    template?.sections?.forEach(s => (s.questions || []).forEach(q => q.modelo_alternativa_id && modeloIds.add(q.modelo_alternativa_id)));
    const modelos = modeloIds.size > 0
      ? await modeloRepo.find({ where: Array.from(modeloIds).map(id => ({ id })) })
      : [];
    const modeloMap = new Map(modelos.map(m => [m.id, m]));

    const pct = Number(inspection.percentual_conformidade) || 0;
    const meta = Number(template?.minimo_esperado) || 95;
    const atingiu = pct >= meta;

    // Download de imagens das respostas (max 3 por resposta)
    const fotosPorResposta = new Map<number, Buffer[]>();
    for (const r of respostas) {
      if (!Array.isArray(r.fotos) || r.fotos.length === 0) continue;
      const urls = r.fotos.slice(0, 3).map((f: any) => f.url).filter(Boolean);
      const buffers: Buffer[] = [];
      for (const u of urls) {
        const buf = await this.downloadImage(u);
        if (buf) buffers.push(buf);
      }
      if (buffers.length > 0) fotosPorResposta.set(r.id, buffers);
    }

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const brDate = new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      // ===== CABECALHO LARANJA =====
      const pageWidth = 595;
      doc.rect(0, 0, pageWidth, 45).fillAndStroke('#FF5500', '#FF5500');
      doc.fontSize(16).fillColor('#FFF').font('Helvetica-Bold')
        .text(this.norm('RELATORIO DE AUDITORIA - CHECK LIST'), 30, 15, { align: 'center', width: pageWidth - 60 });
      doc.moveDown(2.5);

      // ===== BOX RESUMO =====
      const boxY = doc.y + 8;
      doc.rect(30, boxY, 535, 110).fillAndStroke('#F8F9FA', '#FF5500');
      doc.fontSize(11).fillColor('#FF5500').font('Helvetica-Bold')
        .text('RESUMO GERAL', 40, boxY + 8);

      const colL = 40;
      const colR = 310;
      let lineY = boxY + 26;
      const lineH = 13;
      doc.fontSize(9).fillColor('#000').font('Helvetica');

      doc.text(this.norm(`Roteiro: ${template?.nome || '-'}`), colL, lineY);
      doc.text(this.norm(`Data: ${brDate}`), colR, lineY);
      lineY += lineH;
      doc.text(this.norm(`Auditor: ${inspection.auditor?.name || '-'}`), colL, lineY);
      doc.text(this.norm(`Auditado: ${inspection.auditado?.name || '-'}`), colR, lineY);
      lineY += lineH;
      doc.text(this.norm(`Loja: ${inspection.cod_loja != null ? 'Loja ' + inspection.cod_loja : '-'}`), colL, lineY);
      doc.text(this.norm(`Status: ${inspection.status || '-'}`), colR, lineY);
      lineY += lineH;

      // Linha do resultado
      lineY += 4;
      doc.font('Helvetica-Bold').fontSize(10);
      doc.fillColor(atingiu ? '#15803D' : '#B91C1C')
        .text(this.norm(`Conformidade: ${pct.toFixed(1)}%`), colL, lineY);
      doc.fillColor('#000')
        .text(this.norm(`Meta minima: ${meta.toFixed(0)}%`), colR, lineY);
      lineY += lineH;
      doc.fontSize(9).font('Helvetica');
      doc.fillColor('#000')
        .text(this.norm(`Score: ${Number(inspection.score_final || 0).toFixed(2)} / ${Number(inspection.score_max || 0).toFixed(2)}`), colL, lineY);
      doc.fillColor(atingiu ? '#15803D' : '#B91C1C')
        .text(this.norm(atingiu ? 'Meta atingida' : 'Abaixo da meta'), colR, lineY);

      doc.moveDown(7);
      doc.fillColor('#000');

      if (inspection.observacao_geral) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#555')
          .text(this.norm('Observacao geral:'), 30);
        doc.fontSize(9).font('Helvetica').fillColor('#000')
          .text(this.norm(inspection.observacao_geral), 30, doc.y, { width: 535 });
        doc.moveDown(1);
      }

      // ===== SECOES E PERGUNTAS =====
      for (const section of (template?.sections || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))) {
        if (doc.y > 720) doc.addPage();
        // cabecalho da secao
        doc.rect(30, doc.y, 535, 22).fillAndStroke('#FFEDD5', '#FF5500');
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#9A3412')
          .text(this.norm(section.nome?.toUpperCase() || 'SECAO'), 40, doc.y - 17);
        doc.moveDown(1.5);

        for (const q of (section.questions || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))) {
          if (doc.y > 720) doc.addPage();

          const resp = respostaPorQuestion.get(q.id);
          const conforme = resp?.conforme;
          const bandColor = conforme === 'C' ? '#DCFCE7' : conforme === 'NC' ? '#FEE2E2' : conforme === 'NA' ? '#DBEAFE' : '#FEF3C7';
          const bandBorder = conforme === 'C' ? '#15803D' : conforme === 'NC' ? '#B91C1C' : conforme === 'NA' ? '#1E40AF' : '#F59E0B';

          // caixa da pergunta
          const startY = doc.y;
          doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111')
            .text(this.norm(q.texto || ''), 40, startY, { width: 515 });
          doc.moveDown(0.3);

          // resposta
          if (resp) {
            const labelResp = resp.valor_opcao || (conforme === 'C' ? 'Conforme' : conforme === 'NC' ? 'Nao conforme' : conforme === 'NA' ? 'N/A' : '-');
            const yR = doc.y;
            doc.rect(40, yR, 180, 16).fillAndStroke(bandColor, bandBorder);
            doc.fontSize(9).font('Helvetica-Bold').fillColor(bandBorder)
              .text(this.norm(`Resposta: ${labelResp}`), 45, yR + 3, { width: 170 });
            doc.moveDown(1.2);
            doc.fillColor('#000');

            if (resp.observacao) {
              doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#555')
                .text(this.norm(`Obs: ${resp.observacao}`), 40, doc.y, { width: 515 });
              doc.moveDown(0.3);
            }

            // fotos embutidas (ate 3, 140x105)
            const bufs = fotosPorResposta.get(resp.id) || [];
            if (bufs.length > 0) {
              if (doc.y > 680) doc.addPage();
              const imgY = doc.y + 3;
              let imgX = 40;
              for (const b of bufs) {
                try {
                  doc.image(b, imgX, imgY, { fit: [140, 105] });
                } catch { /* pula imagem invalida */ }
                imgX += 148;
              }
              doc.moveDown(0.1);
              doc.y = imgY + 110;
            }
          } else {
            doc.fontSize(9).font('Helvetica-Oblique').fillColor('#999')
              .text(this.norm('(sem resposta)'), 40);
            doc.moveDown(0.5);
            doc.fillColor('#000');
          }

          // separador
          doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).strokeColor('#EEE').stroke();
          doc.moveDown(0.6);
        }

        doc.moveDown(0.5);
      }

      // Assinaturas
      if (inspection.assinatura_auditor_url || inspection.assinatura_auditado_url) {
        if (doc.y > 650) doc.addPage();
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#111')
          .text(this.norm('Assinaturas'), 30);
        doc.moveDown(0.5);
        // Nao embutimos assinaturas (sao URLs). Apenas registramos que ha.
        doc.fontSize(8).font('Helvetica').fillColor('#555')
          .text(this.norm('Assinatura do auditor e do auditado registradas eletronicamente no sistema.'));
      }

      // Rodape
      doc.fontSize(7).fillColor('#999')
        .text(this.norm(`Gerado em ${brDate} - Prevencao no Radar - Check List`), 30, 810, { align: 'center', width: 535 });

      doc.end();
    });
  }
}
