import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';

// Tipo para resultado da análise
export interface ImageAnalysisResult {
  coloracao: string;
  coloracao_rgb: string;
  formato: string;
  gordura_visivel: string;
  presenca_osso: boolean;
  confianca: number; // 0-100
  descricao_detalhada: string;
}

export class ImageAnalysisService {
  private yoloServiceUrl: string;

  constructor() {
    // URL do serviço YOLO local (grátis!)
    this.yoloServiceUrl = process.env.YOLO_SERVICE_URL || 'http://localhost:5001';
    console.log(`🤖 Usando YOLO Service em: ${this.yoloServiceUrl}`);
  }

  /**
   * Analisa uma imagem e extrai características do produto usando YOLO
   */
  async analyzeProductImage(imagePath: string): Promise<ImageAnalysisResult> {
    try {
      console.log(`🔍 Analisando imagem com YOLO: ${imagePath}`);

      // Criar form data com a imagem
      const form = new FormData();
      form.append('image', fs.createReadStream(imagePath));

      // Chamar serviço YOLO local (GRÁTIS!)
      const response = await axios.post(`${this.yoloServiceUrl}/analyze`, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 30000 // 30 segundos
      });

      const analysis: ImageAnalysisResult = response.data;

      console.log(`✅ Análise YOLO concluída. Confiança: ${analysis.confianca}%`);
      console.log(`   Cor: ${analysis.coloracao} (${analysis.coloracao_rgb})`);
      console.log(`   Formato: ${analysis.formato}`);
      console.log(`   Gordura: ${analysis.gordura_visivel}`);
      console.log(`   Osso: ${analysis.presenca_osso ? 'Sim' : 'Não'}`);
      console.log(`   💰 Custo: R$ 0,00 (GRÁTIS!)`);

      return analysis;

    } catch (error: any) {
      console.error('❌ Erro ao analisar imagem com YOLO:', error.message);

      // Verificar se serviço YOLO está rodando
      if (error.code === 'ECONNREFUSED') {
        console.error('⚠️  Serviço YOLO não está rodando!');
        console.error('   Execute: cd src/services/yolo-service && start.bat');
      }

      // Retornar análise vazia em caso de erro
      return {
        coloracao: '',
        coloracao_rgb: '',
        formato: '',
        gordura_visivel: '',
        presenca_osso: false,
        confianca: 0,
        descricao_detalhada: `Erro na análise: ${error.message}`
      };
    }
  }

  /**
   * Determina o MIME type baseado na extensão do arquivo
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Valida se um arquivo é uma imagem válida
   */
  isValidImage(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  }

  /**
   * Compara duas imagens e retorna score de similaridade (0-100)
   * Usado para validar se o produto pesado é o mesmo da foto de referência
   */
  async compareImages(image1Path: string, image2Path: string): Promise<number> {
    try {
      console.log(`🔍 Comparando imagens com YOLO: ${path.basename(image1Path)} vs ${path.basename(image2Path)}`);

      // Ler imagens como base64
      const image1Buffer = fs.readFileSync(image1Path);
      const image2Buffer = fs.readFileSync(image2Path);

      const base64Image1 = image1Buffer.toString('base64');
      const base64Image2 = image2Buffer.toString('base64');

      // Chamar serviço YOLO para comparar
      const response = await axios.post(`${this.yoloServiceUrl}/compare`, {
        image1: base64Image1,
        image2: base64Image2
      }, {
        timeout: 30000
      });

      const { similaridade, diferencas, mesmo_produto } = response.data;

      console.log(`✅ Similaridade: ${similaridade}%`);
      console.log(`   Mesmo produto: ${mesmo_produto ? 'Sim' : 'Não'}`);
      if (diferencas.length > 0) {
        console.log(`   Diferenças: ${diferencas.join(', ')}`);
      }
      console.log(`   💰 Custo: R$ 0,00 (GRÁTIS!)`);

      return similaridade;

    } catch (error: any) {
      console.error('❌ Erro ao comparar imagens com YOLO:', error.message);

      if (error.code === 'ECONNREFUSED') {
        console.error('⚠️  Serviço YOLO não está rodando!');
      }

      return 0;
    }
  }
}
