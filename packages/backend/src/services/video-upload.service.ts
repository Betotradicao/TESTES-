import * as fs from 'fs';
import * as path from 'path';
import { Request } from 'express';
import multer from 'multer';

export class VideoUploadService {
  private uploadDir: string;

  constructor() {
    // Pasta onde os vídeos serão salvos
    this.uploadDir = path.join(__dirname, '../../uploads/videos');
    this.ensureUploadDirExists();
  }

  // Garante que a pasta de uploads existe
  private ensureUploadDirExists() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      console.log(`📁 Pasta de uploads criada: ${this.uploadDir}`);
    }
  }

  // Configuração do multer para upload
  getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        // Gera nome único: bip_{bipId}_{timestamp}.{extensão}
        const bipId = req.params.id;
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `bip_${bipId}_${timestamp}${ext}`;
        cb(null, filename);
      }
    });

    const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      // Aceita apenas vídeos
      const allowedMimes = [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-ms-wmv',
        'video/webm'
      ];

      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos de vídeo são permitidos (mp4, mpeg, mov, avi, wmv, webm)'));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 500 * 1024 * 1024 // 500 MB máximo
      }
    });
  }

  // Deleta um vídeo do sistema de arquivos
  deleteVideo(filename: string): boolean {
    try {
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Vídeo deletado: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Erro ao deletar vídeo ${filename}:`, error);
      return false;
    }
  }

  // Extrai o nome do arquivo da URL completa
  extractFilenameFromUrl(videoUrl: string): string {
    return path.basename(videoUrl);
  }
}
