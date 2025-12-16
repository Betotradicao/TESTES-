import { Request } from 'express';
import multer from 'multer';
import { minioService } from './minio.service';

/**
 * Serviço unificado de upload que usa MinIO para armazenamento
 * Substitui ImageUploadService e VideoUploadService
 */
export class UploadService {
  /**
   * Configuração do multer para upload de imagens
   */
  getImageMulterConfig() {
    const storage = multer.memoryStorage(); // Armazena em memória para enviar ao MinIO

    const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff'
      ];

      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos de imagem são permitidos (JPG, PNG, GIF, WebP, BMP, TIFF)'));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB máximo
      }
    });
  }

  /**
   * Configuração do multer para upload de vídeos
   */
  getVideoMulterConfig() {
    const storage = multer.memoryStorage();

    const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      const allowedMimes = [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
        'video/webm'
      ];

      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos de vídeo são permitidos (MP4, AVI, MOV, MKV, WebM)'));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 100 * 1024 * 1024 // 100 MB máximo
      }
    });
  }

  /**
   * Faz upload de uma imagem para o MinIO
   * @param file Arquivo do multer
   * @param bipId ID da bipagem
   * @returns URL completa do arquivo no MinIO
   */
  async uploadImage(file: Express.Multer.File, bipId: number): Promise<string> {
    const timestamp = Date.now();
    const ext = this.getFileExtension(file.originalname);
    const filename = `bip_${bipId}_${timestamp}${ext}`;

    console.log(`📸 Iniciando upload de imagem: ${filename} (${(file.buffer.length / 1024).toFixed(2)} KB)`);
    const startTime = Date.now();

    try {
      const url = await minioService.uploadFile(
        filename,
        file.buffer,
        file.mimetype
      );

      const duration = Date.now() - startTime;
      console.log(`✅ Imagem enviada para MinIO em ${duration}ms: ${filename}`);
      console.log(`🔗 URL: ${url}`);
      return url;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Erro ao enviar imagem após ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Faz upload de um vídeo para o MinIO
   * @param file Arquivo do multer
   * @param bipId ID da bipagem
   * @returns URL completa do arquivo no MinIO
   */
  async uploadVideo(file: Express.Multer.File, bipId: number): Promise<string> {
    const timestamp = Date.now();
    const ext = this.getFileExtension(file.originalname);
    const filename = `bip_${bipId}_${timestamp}${ext}`;

    console.log(`🎥 Iniciando upload de vídeo: ${filename} (${(file.buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    const startTime = Date.now();

    try {
      const url = await minioService.uploadFile(
        filename,
        file.buffer,
        file.mimetype
      );

      const duration = Date.now() - startTime;
      console.log(`✅ Vídeo enviado para MinIO em ${duration}ms: ${filename}`);
      console.log(`🔗 URL: ${url}`);
      return url;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Erro ao enviar vídeo após ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Deleta um arquivo do MinIO
   * @param url URL completa do arquivo
   */
  async deleteFile(url: string): Promise<void> {
    if (!url) return;

    // Extrair o filename da URL
    const filename = minioService.extractFileNameFromUrl(url);
    await minioService.deleteFile(filename);
    console.log(`🗑️ Arquivo deletado do MinIO: ${filename}`);
  }

  /**
   * Extrai a extensão do arquivo
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }

  /**
   * Extrai o nome do arquivo da URL (compatibilidade com código antigo)
   */
  extractFilenameFromUrl(url: string): string {
    return minioService.extractFileNameFromUrl(url);
  }

  /**
   * Deleta imagem (alias para deleteFile, mantido para compatibilidade)
   */
  async deleteImage(filenameOrUrl: string): Promise<void> {
    return this.deleteFile(filenameOrUrl);
  }

  /**
   * Deleta vídeo (alias para deleteFile, mantido para compatibilidade)
   */
  async deleteVideo(filenameOrUrl: string): Promise<void> {
    return this.deleteFile(filenameOrUrl);
  }
}

// Singleton instance
export const uploadService = new UploadService();
