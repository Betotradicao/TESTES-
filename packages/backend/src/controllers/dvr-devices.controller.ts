import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { DvrDevice } from '../entities/DvrDevice';
import * as http from 'http';
import * as crypto from 'crypto';

const repo = () => AppDataSource.getRepository(DvrDevice);

export class DvrDevicesController {
  /**
   * GET /api/dvr-devices
   * Lista todos os DVRs, opcionalmente filtrando por loja (?codigo_loja=N).
   */
  static async list(req: Request, res: Response) {
    try {
      const codigoLoja = req.query.codigo_loja ? parseInt(String(req.query.codigo_loja), 10) : null;
      const where: any = {};
      if (codigoLoja != null) where.codigo_loja = codigoLoja;
      const devices = await repo().find({
        where,
        order: { codigo_loja: 'ASC', is_default: 'DESC', id: 'ASC' }
      });
      // Nao expoe a senha em listas
      const sanitized = devices.map(d => ({ ...d, senha: d.senha ? '***' : '' }));
      return res.json(sanitized);
    } catch (error: any) {
      console.error('[DvrDevices.list] error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/dvr-devices/:id
   */
  static async getOne(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const device = await repo().findOne({ where: { id } });
      if (!device) return res.status(404).json({ error: 'DVR nao encontrado' });
      return res.json({ ...device, senha: device.senha ? '***' : '' });
    } catch (error: any) {
      console.error('[DvrDevices.getOne] error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/dvr-devices
   */
  static async create(req: Request, res: Response) {
    try {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ error: 'name obrigatorio' });
      if (body.codigo_loja == null) return res.status(400).json({ error: 'codigo_loja obrigatorio' });
      if (!body.ip) return res.status(400).json({ error: 'ip obrigatorio' });

      // Se marcou is_default, desmarca outros da mesma loja
      if (body.is_default) {
        await repo().update({ codigo_loja: body.codigo_loja, is_default: true }, { is_default: false });
      }

      const device = repo().create({
        name: body.name,
        codigo_loja: body.codigo_loja,
        ip: body.ip,
        porta_http: body.porta_http ?? 80,
        porta_rtsp: body.porta_rtsp ?? 554,
        usuario: body.usuario || 'admin',
        senha: body.senha || '',
        codec_mode: body.codec_mode || 'transcode',
        canais: Array.isArray(body.canais) ? body.canais : [],
        cameras_pdv: Array.isArray(body.cameras_pdv) ? body.cameras_pdv : [],
        cameras_bipagens: Array.isArray(body.cameras_bipagens) ? body.cameras_bipagens : [],
        cameras_risco: Array.isArray(body.cameras_risco) ? body.cameras_risco : [],
        antecedencia_segundos: body.antecedencia_segundos ?? 15,
        tempo_depois_segundos: body.tempo_depois_segundos ?? 120,
        canal_padrao: body.canal_padrao ?? null,
        is_default: !!body.is_default,
        status: body.status || 'active'
      });
      const saved = await repo().save(device);
      return res.status(201).json({ ...saved, senha: saved.senha ? '***' : '' });
    } catch (error: any) {
      console.error('[DvrDevices.create] error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/dvr-devices/:id
   */
  static async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const device = await repo().findOne({ where: { id } });
      if (!device) return res.status(404).json({ error: 'DVR nao encontrado' });

      const body = req.body || {};
      const newCodigoLoja = body.codigo_loja ?? device.codigo_loja;

      // Se marcou is_default, desmarca outros da mesma loja
      if (body.is_default && (!device.is_default || newCodigoLoja !== device.codigo_loja)) {
        await repo().update({ codigo_loja: newCodigoLoja, is_default: true }, { is_default: false });
      }

      const fields: (keyof DvrDevice)[] = [
        'name', 'codigo_loja', 'ip', 'porta_http', 'porta_rtsp', 'usuario',
        'codec_mode', 'canais', 'cameras_pdv', 'cameras_bipagens', 'cameras_risco',
        'antecedencia_segundos', 'tempo_depois_segundos', 'canal_padrao',
        'is_default', 'status'
      ];
      for (const f of fields) {
        if (body[f] !== undefined) (device as any)[f] = body[f];
      }
      // Senha so atualiza se vier nao-vazia e diferente do mascarado
      if (body.senha && body.senha !== '***') device.senha = body.senha;

      const saved = await repo().save(device);
      return res.json({ ...saved, senha: saved.senha ? '***' : '' });
    } catch (error: any) {
      console.error('[DvrDevices.update] error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/dvr-devices/:id
   */
  static async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await repo().delete(id);
      if (result.affected === 0) return res.status(404).json({ error: 'DVR nao encontrado' });
      return res.json({ success: true });
    } catch (error: any) {
      console.error('[DvrDevices.remove] error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/dvr-devices/:id/test
   * Testa a conexao HTTP no DVR (autentica via Digest, padrao Intelbras/Dahua).
   */
  static async test(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const device = await repo().findOne({ where: { id } });
      if (!device) return res.status(404).json({ error: 'DVR nao encontrado' });

      const result = await DvrDevicesController.tryHttpAuth(device);
      return res.json(result);
    } catch (error: any) {
      console.error('[DvrDevices.test] error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  private static tryHttpAuth(d: DvrDevice): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const host = d.ip;
      const port = d.porta_http || 80;
      const reqOpts: http.RequestOptions = {
        host, port, path: '/cgi-bin/magicBox.cgi?action=getDeviceType', method: 'GET', timeout: 8000
      };
      const reqWithAuth = (authHeader?: string) => {
        const opts = { ...reqOpts };
        if (authHeader) opts.headers = { Authorization: authHeader };
        const r = http.request(opts, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            if (res.statusCode === 200) {
              return resolve({ success: true, message: `Conexao OK (HTTP 200) em ${host}:${port}` });
            }
            if (res.statusCode === 401 && !authHeader && res.headers['www-authenticate']) {
              // Faz digest auth
              const wwwAuth = String(res.headers['www-authenticate']);
              const digest = DvrDevicesController.buildDigestHeader(wwwAuth, d.usuario || 'admin', d.senha || '', 'GET', reqOpts.path!);
              if (digest) return reqWithAuth(digest);
            }
            return resolve({ success: false, message: `Falhou com HTTP ${res.statusCode}` });
          });
        });
        r.on('error', (e) => resolve({ success: false, message: `Erro de rede: ${e.message}` }));
        r.on('timeout', () => { r.destroy(); resolve({ success: false, message: 'Timeout (8s) ao conectar' }); });
        r.end();
      };
      reqWithAuth();
    });
  }

  private static buildDigestHeader(wwwAuth: string, user: string, pass: string, method: string, uri: string): string | null {
    const get = (key: string) => {
      const m = wwwAuth.match(new RegExp(`${key}="?([^",]+)"?`, 'i'));
      return m ? m[1] : '';
    };
    const realm = get('realm');
    const nonce = get('nonce');
    const qop = get('qop');
    if (!realm || !nonce) return null;
    const ha1 = crypto.createHash('md5').update(`${user}:${realm}:${pass}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');
    const response = qop
      ? crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex')
      : crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
    let header = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
    if (qop) header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
    return header;
  }
}
