import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationService } from './configuration.service';

const execAsync = promisify(exec);

export class DVRSnapshotService {
  /**
   * Captura snapshot de uma câmera do DVR Intelbras
   * @param cameraId ID da câmera (ex: 15 para balança)
   * @returns Path do arquivo de imagem salvo
   */
  async captureSnapshot(cameraId: number): Promise<string> {
    try {
      console.log(`📸 Capturando snapshot da câmera ${cameraId}...`);

      // Buscar configurações do DVR
      const configs = await ConfigurationService.getAll();
      const dvrIp = configs.dvr_ip || '10.6.1.123';
      const dvrUsuario = configs.dvr_usuario || 'admin';
      const dvrSenha = configs.dvr_senha || '';

      if (!dvrIp || !dvrUsuario || !dvrSenha) {
        throw new Error('Configurações do DVR não encontradas');
      }

      // URL da API HTTP do DVR Intelbras para snapshot
      const snapshotUrl = `http://${dvrIp}/cgi-bin/snapshot.cgi?channel=${cameraId}`;

      console.log(`🔗 URL snapshot: http://${dvrIp}/cgi-bin/snapshot.cgi?channel=${cameraId}`);
      console.log(`👤 Usuário: ${dvrUsuario}`);

      // Criar diretório de uploads se não existir
      const uploadsDir = path.join(__dirname, '../../uploads/dvr-snapshots');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Salvar imagem com timestamp
      const timestamp = Date.now();
      const filename = `camera${cameraId}_${timestamp}.jpg`;
      const filepath = path.join(uploadsDir, filename);

      // Usar curl com Digest Authentication (funciona melhor que axios)
      const curlCommand = `curl -u "${dvrUsuario}:${dvrSenha}" --digest --connect-timeout 10 "${snapshotUrl}" -o "${filepath}"`;

      console.log('🔄 Executando captura via curl...');

      try {
        await execAsync(curlCommand);
      } catch (execError: any) {
        console.error('❌ Erro ao executar curl:', execError.message);
        throw new Error('Falha ao executar comando de captura');
      }

      // Verificar se arquivo foi criado e tem conteúdo
      if (!fs.existsSync(filepath)) {
        throw new Error('Arquivo de snapshot não foi criado');
      }

      const stats = fs.statSync(filepath);
      if (stats.size === 0) {
        fs.unlinkSync(filepath);
        throw new Error('Snapshot capturado está vazio');
      }

      console.log(`✅ Snapshot capturado: ${filename}`);
      console.log(`📁 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);

      return filepath;

    } catch (error: any) {
      console.error('❌ Erro ao capturar snapshot do DVR:', error.message);

      if (error.message.includes('Connection refused')) {
        throw new Error('Não foi possível conectar ao DVR. Verifique o IP e se o DVR está ligado.');
      }

      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('Credenciais do DVR inválidas. Verifique usuário e senha.');
      }

      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        throw new Error('Timeout ao tentar capturar snapshot. O DVR pode estar ocupado.');
      }

      throw error;
    }
  }

  /**
   * Captura snapshot e analisa com YOLO
   * @param cameraId ID da câmera
   * @returns Análise YOLO da imagem
   */
  async captureAndAnalyze(cameraId: number) {
    try {
      // 1. Capturar snapshot
      const imagePath = await this.captureSnapshot(cameraId);

      // 2. Analisar com YOLO
      const { ImageAnalysisService } = await import('./image-analysis.service');
      const analysisService = new ImageAnalysisService();

      console.log(`🤖 Analisando imagem com YOLO...`);
      const analysis = await analysisService.analyzeProductImage(imagePath);

      console.log(`✅ Análise concluída!`);
      console.log(`   Coloração: ${analysis.coloracao}`);
      console.log(`   Formato: ${analysis.formato}`);
      console.log(`   Gordura: ${analysis.gordura_visivel}`);
      console.log(`   Confiança: ${analysis.confianca}%`);

      return {
        imagePath,
        analysis
      };

    } catch (error) {
      console.error('❌ Erro ao capturar e analisar:', error);
      throw error;
    }
  }
}

export const dvrSnapshotService = new DVRSnapshotService();
