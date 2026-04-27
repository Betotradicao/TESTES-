import { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { RhRecrutadorAgentService } from '../services/rh-recrutador-agent.service';
import { ConfigurationService } from '../services/configuration.service';

/**
 * Controller do modulo Entrevistador Digital (RH no Radar > Recrutador IA).
 *
 * Endpoints autenticados (admin):
 *  - VAGAS: CRUD em rh_recrutador_vagas
 *  - PERGUNTAS: CRUD em rh_recrutador_perguntas_banco
 *  - CONFIG: GET/PUT em rh_recrutador_config (1 unica linha)
 *  - ENTREVISTAS: lista/detalhe/criar/disparar
 *
 * Endpoints publicos (candidato, com token):
 *  - GET /publico/:token - dados da vaga + nome candidato (pra carregar pagina)
 *  - POST /publico/:token/responder - envia resposta, recebe proxima pergunta da IA
 */
export class RhRecrutadorController {

  // ===========================================================================
  // VAGAS
  // ===========================================================================

  static async listarVagas(_req: Request, res: Response) {
    try {
      const rows = await AppDataSource.query(`
        SELECT v.*, c.nome AS cargo_nome, d.nome AS departamento_nome,
          (SELECT COUNT(*) FROM rh_recrutador_entrevistas e WHERE e.vaga_id = v.id) AS qtd_entrevistas
        FROM rh_recrutador_vagas v
        LEFT JOIN rh_cargos c ON c.id = v.cargo_id
        LEFT JOIN rh_departamentos d ON d.id = v.departamento_id
        ORDER BY v.ativo DESC, v.id DESC
      `);
      res.json(rows);
    } catch (e: any) {
      console.error('[Recrutador] listarVagas:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async criarVaga(req: Request, res: Response) {
    try {
      const {
        titulo, descricao, cargo_id, departamento_id,
        competencias_chave, perfil_disc_ideal,
        salario_min, salario_max, carga_horaria, beneficios,
        requisitos_obrigatorios, requisitos_desejaveis,
        red_flags, instrucoes_extras_ia, max_perguntas,
        setor, requer_experiencia
      } = req.body;

      if (!titulo) {
        res.status(400).json({ error: 'Titulo e obrigatorio' });
        return;
      }

      const result = await AppDataSource.query(
        `INSERT INTO rh_recrutador_vagas
         (titulo, descricao, cargo_id, departamento_id, competencias_chave, perfil_disc_ideal,
          salario_min, salario_max, carga_horaria, beneficios,
          requisitos_obrigatorios, requisitos_desejaveis, red_flags, instrucoes_extras_ia, max_perguntas,
          setor, requer_experiencia)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          titulo, descricao || null, cargo_id || null, departamento_id || null,
          JSON.stringify(competencias_chave || []), perfil_disc_ideal || null,
          salario_min || null, salario_max || null, carga_horaria || null, beneficios || null,
          requisitos_obrigatorios || null, requisitos_desejaveis || null,
          JSON.stringify(red_flags || []), instrucoes_extras_ia || null,
          max_perguntas || 12,
          setor || null, !!requer_experiencia
        ]
      );
      res.json(result[0]);
    } catch (e: any) {
      console.error('[Recrutador] criarVaga:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async atualizarVaga(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const fields = [
        'titulo', 'descricao', 'cargo_id', 'departamento_id', 'perfil_disc_ideal',
        'salario_min', 'salario_max', 'carga_horaria', 'beneficios',
        'requisitos_obrigatorios', 'requisitos_desejaveis', 'instrucoes_extras_ia',
        'max_perguntas', 'ativo', 'setor', 'requer_experiencia'
      ];
      const sets: string[] = [];
      const params: any[] = [];
      let p = 1;
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          sets.push(`${f} = $${p++}`);
          params.push(req.body[f]);
        }
      }
      if (req.body.competencias_chave !== undefined) {
        sets.push(`competencias_chave = $${p++}`);
        params.push(JSON.stringify(req.body.competencias_chave));
      }
      if (req.body.red_flags !== undefined) {
        sets.push(`red_flags = $${p++}`);
        params.push(JSON.stringify(req.body.red_flags));
      }
      sets.push(`updated_at = NOW()`);
      params.push(id);
      const r = await AppDataSource.query(
        `UPDATE rh_recrutador_vagas SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
        params
      );
      res.json(r[0]);
    } catch (e: any) {
      console.error('[Recrutador] atualizarVaga:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async deletarVaga(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await AppDataSource.query(`DELETE FROM rh_recrutador_vagas WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Recrutador] deletarVaga:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===========================================================================
  // BANCO DE PERGUNTAS
  // ===========================================================================

  static async listarPerguntas(req: Request, res: Response) {
    try {
      const categoria = req.query.categoria as string | undefined;
      const params: any[] = [];
      let where = '1=1';
      if (categoria) {
        params.push(categoria);
        where += ` AND categoria = $${params.length}`;
      }
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_recrutador_perguntas_banco WHERE ${where} ORDER BY ativo DESC, id ASC`,
        params
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Recrutador] listarPerguntas:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async criarPergunta(req: Request, res: Response) {
    try {
      const { pergunta, categoria, competencia, tipo, nivel_dificuldade, dica_avaliacao } = req.body;
      if (!pergunta || !categoria) {
        res.status(400).json({ error: 'pergunta e categoria sao obrigatorios' });
        return;
      }
      const r = await AppDataSource.query(
        `INSERT INTO rh_recrutador_perguntas_banco
         (pergunta, categoria, competencia, tipo, nivel_dificuldade, dica_avaliacao)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [pergunta, categoria, competencia || null, tipo || 'comportamental', nivel_dificuldade || 'medio', dica_avaliacao || null]
      );
      res.json(r[0]);
    } catch (e: any) {
      console.error('[Recrutador] criarPergunta:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async atualizarPergunta(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const fields = ['pergunta', 'categoria', 'competencia', 'tipo', 'nivel_dificuldade', 'dica_avaliacao', 'ativo'];
      const sets: string[] = [];
      const params: any[] = [];
      let p = 1;
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          sets.push(`${f} = $${p++}`);
          params.push(req.body[f]);
        }
      }
      sets.push(`updated_at = NOW()`);
      params.push(id);
      const r = await AppDataSource.query(
        `UPDATE rh_recrutador_perguntas_banco SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`, params
      );
      res.json(r[0]);
    } catch (e: any) {
      console.error('[Recrutador] atualizarPergunta:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async deletarPergunta(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await AppDataSource.query(`DELETE FROM rh_recrutador_perguntas_banco WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Recrutador] deletarPergunta:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===========================================================================
  // CONFIG (1 linha global)
  // ===========================================================================

  static async getConfig(_req: Request, res: Response) {
    try {
      const r = await AppDataSource.query(`SELECT * FROM rh_recrutador_config ORDER BY id ASC LIMIT 1`);
      res.json(r[0] || {});
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async putConfig(req: Request, res: Response) {
    try {
      const fields = [
        'nome_recrutadora', 'persona_descricao', 'tom_comunicacao', 'modelo_ia',
        'max_tokens_resposta', 'timeout_resposta_segundos', 'budget_max_tokens_entrevista',
        'instrucoes_extras', 'anti_fraude_ativo',
        'voz_recrutadora', 'voz_genero'
      ];
      const sets: string[] = [];
      const params: any[] = [];
      let p = 1;
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          sets.push(`${f} = $${p++}`);
          params.push(req.body[f]);
        }
      }
      sets.push(`updated_at = NOW()`);

      const existing = await AppDataSource.query(`SELECT id FROM rh_recrutador_config ORDER BY id ASC LIMIT 1`);
      if (existing && existing.length > 0) {
        params.push(existing[0].id);
        const r = await AppDataSource.query(
          `UPDATE rh_recrutador_config SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`, params
        );
        res.json(r[0]);
      } else {
        // criar primeira linha
        const cols = fields.filter(f => req.body[f] !== undefined);
        const colNames = cols.join(', ');
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const vals = cols.map(f => req.body[f]);
        const r = await AppDataSource.query(
          `INSERT INTO rh_recrutador_config (${colNames}) VALUES (${placeholders}) RETURNING *`, vals
        );
        res.json(r[0]);
      }
    } catch (e: any) {
      console.error('[Recrutador] putConfig:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===========================================================================
  // ENTREVISTAS (admin)
  // ===========================================================================

  static async listarEntrevistas(req: Request, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const vagaId = req.query.vaga_id ? Number(req.query.vaga_id) : undefined;
      const params: any[] = [];
      let where = '1=1';
      if (status) {
        params.push(status);
        where += ` AND e.status = $${params.length}`;
      }
      if (vagaId) {
        params.push(vagaId);
        where += ` AND e.vaga_id = $${params.length}`;
      }
      const rows = await AppDataSource.query(
        `SELECT e.id, e.token, e.candidato_nome, e.candidato_telefone, e.status,
                e.score_final, e.recomendacao, e.disc_inferido,
                e.tokens_consumidos, e.custo_estimado_centavos, e.modelo_usado,
                e.iniciada_em, e.finalizada_em, e.created_at,
                v.titulo AS vaga_titulo
         FROM rh_recrutador_entrevistas e
         LEFT JOIN rh_recrutador_vagas v ON v.id = e.vaga_id
         WHERE ${where}
         ORDER BY e.id DESC LIMIT 200`,
        params
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Recrutador] listarEntrevistas:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async detalheEntrevista(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const ent = await AppDataSource.query(
        `SELECT e.*, v.titulo AS vaga_titulo, v.descricao AS vaga_descricao
         FROM rh_recrutador_entrevistas e
         LEFT JOIN rh_recrutador_vagas v ON v.id = e.vaga_id
         WHERE e.id = $1`, [id]
      );
      if (!ent || ent.length === 0) {
        res.status(404).json({ error: 'Entrevista nao encontrada' });
        return;
      }
      const respostas = await AppDataSource.query(
        `SELECT * FROM rh_recrutador_respostas WHERE entrevista_id = $1 ORDER BY ordem ASC`, [id]
      );
      res.json({ entrevista: ent[0], respostas });
    } catch (e: any) {
      console.error('[Recrutador] detalheEntrevista:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async criarEntrevista(req: Request, res: Response) {
    try {
      const { vaga_id, candidato_nome, candidato_telefone, candidato_email, candidato_id, expira_dias, modo_entrevista, voz_recrutadora } = req.body;
      if (!vaga_id || !candidato_nome) {
        res.status(400).json({ error: 'vaga_id e candidato_nome obrigatorios' });
        return;
      }

      const modo = ['texto', 'voz', 'video'].includes(modo_entrevista) ? modo_entrevista : 'texto';
      const token = crypto.randomBytes(24).toString('hex');
      const dias = Number(expira_dias) || 7;
      const r = await AppDataSource.query(
        `INSERT INTO rh_recrutador_entrevistas
         (token, vaga_id, candidato_nome, candidato_telefone, candidato_email, candidato_id, expira_em, modo_entrevista, voz_recrutadora)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($7 || ' days')::interval, $8, $9)
         RETURNING *`,
        [token, vaga_id, candidato_nome, candidato_telefone || null, candidato_email || null, candidato_id || null, String(dias), modo, voz_recrutadora || null]
      );
      res.json(r[0]);
    } catch (e: any) {
      console.error('[Recrutador] criarEntrevista:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async deletarEntrevista(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await AppDataSource.query(`DELETE FROM rh_recrutador_entrevistas WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Recrutador] deletarEntrevista:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===========================================================================
  // TTS — Text To Speech (3 provedores)
  // POST /api/recrutador/tts/preview { provedor, voz, texto }
  // Retorna audio binario (audio/mpeg)
  // ===========================================================================
  static async ttsPreview(req: Request, res: Response) {
    try {
      const { provedor, voz, texto } = req.body;
      if (!texto || !texto.trim()) {
        res.status(400).json({ error: 'texto obrigatorio' });
        return;
      }
      if (!provedor || !['openai', 'elevenlabs', 'azure'].includes(provedor)) {
        res.status(400).json({ error: 'provedor deve ser openai, elevenlabs ou azure (web_speech roda no client)' });
        return;
      }

      if (provedor === 'azure') {
        const apiKey = await ConfigurationService.get('azure_speech_key', '');
        const region = await ConfigurationService.get('azure_speech_region', 'brazilsouth');
        if (!apiKey) {
          res.status(400).json({
            error: 'Azure Speech key nao configurada. Crie conta gratis em portal.azure.com (Speech Service tier F0 = 500k chars/mes gratis), copie a key e configure em configurations.azure_speech_key + azure_speech_region (default: brazilsouth).'
          });
          return;
        }
        const vozFinal = voz || 'pt-BR-FranciscaNeural';
        const ssml = `<speak version='1.0' xml:lang='pt-BR'><voice name='${vozFinal}'>${texto.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</voice></speak>`;
        const r = await axios.post(
          `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
          ssml,
          {
            headers: {
              'Ocp-Apim-Subscription-Key': apiKey,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
              'User-Agent': 'PrevencaoNoRadar'
            },
            responseType: 'arraybuffer',
            timeout: 30000
          }
        );
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(r.data));
        return;
      }

      if (provedor === 'openai') {
        const apiKey = await ConfigurationService.get('openai_api_key', '');
        if (!apiKey) {
          res.status(400).json({ error: 'OPENAI_API_KEY nao configurada' });
          return;
        }
        const vozFinal = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voz) ? voz : 'nova';
        const r = await axios.post(
          'https://api.openai.com/v1/audio/speech',
          { model: 'tts-1-hd', voice: vozFinal, input: texto, response_format: 'mp3' },
          {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            responseType: 'arraybuffer',
            timeout: 30000
          }
        );
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(r.data));
        return;
      }

      if (provedor === 'elevenlabs') {
        const apiKey = await ConfigurationService.get('elevenlabs_api_key', '');
        if (!apiKey) {
          res.status(400).json({
            error: 'ElevenLabs API key nao configurada. Cadastre-se em elevenlabs.io e adicione a key em Configuracoes.'
          });
          return;
        }
        const vozId = voz || '21m00Tcm4TlvDq8ikWAM';
        const r = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${vozId}`,
          { text: texto, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
          {
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
            responseType: 'arraybuffer',
            timeout: 30000
          }
        );
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(r.data));
        return;
      }
    } catch (e: any) {
      console.error('[Recrutador] ttsPreview:', e?.response?.status, e?.message);
      res.status(500).json({ error: e?.response?.data?.error?.message || e.message || 'Erro TTS' });
    }
  }

  // ===========================================================================
  // ENDPOINTS PUBLICOS (candidato com token)
  // ===========================================================================

  /**
   * GET /api/recrutador/publico/:token
   * Carrega dados pra montar a pagina (sem auth).
   */
  static async publicoCarregar(req: Request, res: Response) {
    try {
      const token = req.params.token;
      const r = await AppDataSource.query(
        `SELECT e.id, e.token, e.candidato_nome, e.status, e.expira_em, e.modo_entrevista,
                e.voz_recrutadora AS voz_entrevista,
                v.titulo AS vaga_titulo
         FROM rh_recrutador_entrevistas e
         LEFT JOIN rh_recrutador_vagas v ON v.id = e.vaga_id
         WHERE e.token = $1`, [token]
      );
      if (!r || r.length === 0) {
        res.status(404).json({ error: 'Link invalido ou expirado' });
        return;
      }
      const e = r[0];
      if (e.expira_em && new Date(e.expira_em) < new Date()) {
        res.status(410).json({ error: 'Este link expirou', candidato_nome: e.candidato_nome });
        return;
      }
      if (e.status === 'finalizada') {
        res.status(409).json({ error: 'Entrevista ja finalizada', candidato_nome: e.candidato_nome });
        return;
      }
      // Histórico de mensagens já trocadas (pra reload de pagina)
      const respostas = await AppDataSource.query(
        `SELECT ordem, pergunta, resposta FROM rh_recrutador_respostas WHERE entrevista_id = $1 ORDER BY ordem ASC`, [e.id]
      );
      // Config da recrutadora (nome + voz pra modo voz)
      const cfg = await AppDataSource.query(
        `SELECT nome_recrutadora, voz_recrutadora, voz_genero FROM rh_recrutador_config ORDER BY id ASC LIMIT 1`
      );
      const c = cfg && cfg.length > 0 ? cfg[0] : {};
      res.json({
        candidato_nome: e.candidato_nome,
        vaga_titulo: e.vaga_titulo,
        status: e.status,
        modo_entrevista: e.modo_entrevista || 'texto',
        nome_recrutadora: c.nome_recrutadora || 'Helen',
        // Prioriza voz da ENTREVISTA, senao usa a global da config
        voz_recrutadora: e.voz_entrevista || c.voz_recrutadora || null,
        voz_genero: c.voz_genero || null,
        historico: respostas
      });
    } catch (e: any) {
      console.error('[Recrutador] publicoCarregar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  /**
   * POST /api/recrutador/publico/:token/responder
   * body: { resposta?: string }   -- vazio = trigger inicial
   * Retorna: { iaMessage, finalizada, ordem }
   */
  static async publicoResponder(req: Request, res: Response) {
    try {
      const token = req.params.token;
      const { resposta } = req.body;

      const r = await AppDataSource.query(
        `SELECT id, status, expira_em FROM rh_recrutador_entrevistas WHERE token = $1`, [token]
      );
      if (!r || r.length === 0) {
        res.status(404).json({ error: 'Link invalido' });
        return;
      }
      const ent = r[0];
      if (ent.expira_em && new Date(ent.expira_em) < new Date()) {
        res.status(410).json({ error: 'Link expirado' });
        return;
      }
      if (ent.status === 'finalizada') {
        res.status(409).json({ error: 'Entrevista ja finalizada' });
        return;
      }

      // Se candidato mandou resposta, registra a ULTIMA pergunta com resposta
      if (resposta && typeof resposta === 'string' && resposta.trim()) {
        const ult = await AppDataSource.query(
          `SELECT id FROM rh_recrutador_respostas
           WHERE entrevista_id = $1 AND resposta IS NULL
           ORDER BY ordem DESC LIMIT 1`, [ent.id]
        );
        if (ult && ult.length > 0) {
          await AppDataSource.query(
            `UPDATE rh_recrutador_respostas SET resposta = $1, respondida_em = NOW() WHERE id = $2`,
            [resposta.trim(), ult[0].id]
          );
        }
      }

      // Roda 1 turno do agente
      const out = await RhRecrutadorAgentService.processarTurno({
        entrevistaId: ent.id,
        candidatoMessage: resposta
      });

      // Persiste a nova pergunta da IA (se houver e nao for finalizacao)
      if (!out.finalizada && out.iaMessage) {
        await AppDataSource.query(
          `INSERT INTO rh_recrutador_respostas (entrevista_id, ordem, pergunta, tokens_consumidos)
           VALUES ($1, $2, $3, $4)`,
          [ent.id, out.ordem, out.iaMessage, out.tokensConsumidos]
        );
      }

      // Se finalizada, salva relatorio
      if (out.finalizada) {
        await AppDataSource.query(
          `UPDATE rh_recrutador_entrevistas
           SET status = 'finalizada', finalizada_em = NOW(),
               score_final = $1, recomendacao = $2,
               disc_inferido = $3, relatorio_json = $4, updated_at = NOW()
           WHERE id = $5`,
          [
            out.scoreFinal || null,
            out.recomendacao || null,
            out.relatorio?.disc_inferido || null,
            out.relatorio ? JSON.stringify(out.relatorio) : null,
            ent.id
          ]
        );
      }

      res.json({
        iaMessage: out.iaMessage,
        finalizada: out.finalizada,
        ordem: out.ordem
      });
    } catch (e: any) {
      console.error('[Recrutador] publicoResponder:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
