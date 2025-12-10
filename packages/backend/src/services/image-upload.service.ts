import * as fs from 'fs';
import * as path from 'path';
import { Request } from 'express';
import multer from 'multer';

export class ImageUploadService {
  private uploadDir: string;

  constructor() {
    // Pasta onde as imagens serão salvas
    this.uploadDir = path.join(__dirname, '../../uploads/images');
    this.ensureUploadDirExists();
  }

  // Garante que a pasta de uploads existe
  private ensureUploadDirExists() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      console.log(`📁 Pasta de imagens criada: ${this.uploadDir}`);
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
      // Aceita apenas imagens
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

  // Deleta uma imagem do sistema de arquivos
  deleteImage(filename: string): boolean {
    try {
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Imagem deletada: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Erro ao deletar imagem ${filename}:`, error);
      return false;
    }
  }

  // Extrai o nome do arquivo da URL completa
  extractFilenameFromUrl(imageUrl: string): string {
    return path.basename(imageUrl);
  }
}
