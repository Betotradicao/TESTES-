import { response, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';
import { ProductActivationHistory } from '../entities/ProductActivationHistory';
import { AuthRequest } from '../middleware/auth';
import { CacheService } from '../services/cache.service';
import { ConfigurationService } from '../services/configuration.service';
import axios from 'axios';
import * as path from 'path';

export class ProductsController {
  static async getProducts(req: AuthRequest, res: Response) {
    try {
      // Busca configurações do banco de dados (fallback para .env)
      const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
      const port = await ConfigurationService.get('intersolid_port', null);
      const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');

      // Monta a URL completa
      const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
      const erpApiUrl = baseUrl
        ? `${baseUrl}${productsEndpoint}`
        : process.env.ERP_PRODUCTS_API_URL || 'http://mock-erp-api.com';

      // Use cache service to fetch ERP products
      const erpProducts = await CacheService.executeWithCache(
        'erp-products',
        async () => {
          console.log('Fetching products from ERP API:', erpApiUrl);
          const response = await axios.get(`${erpApiUrl}`);
          return response.data;
        }
      );

      // Get active products from our database
      const productRepository = AppDataSource.getRepository(Product);
      const activeProducts = await productRepository.find({
        select: ['erp_product_id', 'active']
      });

      // Create a map for quick lookup
      const activeProductsMap = new Map(
        activeProducts.map(p => [p.erp_product_id, p.active])
      );

      // Enrich ERP products with active status and filter fields
      const enrichedProducts = erpProducts.map((product: any) => ({
        codigo: product.codigo,
        ean: product.ean,
        descricao: product.descricao,
        desReduzida: product.desReduzida,
        valvenda: product.valvenda,
        valOferta: product.valOferta,
        desSecao: product.desSecao,
        desGrupo: product.desGrupo,
        desSubGrupo: product.desSubGrupo,
        active: activeProductsMap.get(product.codigo) || false
      }));

      res.json({
        data: enrichedProducts,
        total: enrichedProducts.length
      });

    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async activateProduct(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // This is the ERP product ID (codigo)
      const { active } = req.body;

      if (typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Active field must be a boolean' });
      }

      const productRepository = AppDataSource.getRepository(Product);
      const historyRepository = AppDataSource.getRepository(ProductActivationHistory);

      // Check if product exists in our database
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        // Fetch product info from ERP to create it
        // Busca configurações do banco de dados (fallback para .env)
        const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
        const port = await ConfigurationService.get('intersolid_port', null);
        const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');

        // Monta a URL completa
        const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
        const erpApiUrl = baseUrl
          ? `${baseUrl}${productsEndpoint}`
          : process.env.ERP_PRODUCTS_API_URL || 'http://mock-erp-api.com';

        let erpProduct = null;

        let response: any = null;

        try {
          // Use cache to get products and find the specific one
          const products = await CacheService.executeWithCache(
            'erp-products',
            async () => {
              console.log('Fetching products from ERP API for activation...', erpApiUrl);
              const params = { id: id};
              if (process.env.NODE_ENV === 'development') {
                response = await axios.get(`${erpApiUrl}`, { params });
              } else {
                response = await axios.get(`${erpApiUrl}/${id}`);
              }
              return response.data;
            }
          );

          erpProduct = products.find((p: any) => p.codigo === id);
        } catch (error) {
        }

        if (!erpProduct) {
          return res.status(404).json({ error: 'Product not found in ERP' });
        }

        // Create new product
        product = productRepository.create({
          erp_product_id: erpProduct.codigo,
          description: erpProduct.descricao,
          short_description: erpProduct.desReduzida,
          ean: erpProduct.ean,
          weighable: erpProduct.pesavel === 'S',
          section_code: erpProduct.codSecao,
          section_name: erpProduct.desSecao,
          group_code: erpProduct.codGrupo,
          group_name: erpProduct.desGrupo,
          subgroup_code: erpProduct.codSubGrupo,
          subgroup_name: erpProduct.desSubGrupo,
          supplier_code: erpProduct.codForn,
          supplier_name: erpProduct.razaoForn,
          active
        });
      } else {
        // Update existing product
        product.active = active;
      }

      // Save product
      await productRepository.save(product);

      // Create history entry
      const history = historyRepository.create({
        user_id: req.user!.id,
        product_id: product.id,
        active
      });
      await historyRepository.save(history);

      res.json({
        message: `Product ${active ? 'activated' : 'deactivated'} successfully`,
        product: {
          id: product.id,
          erp_product_id: product.erp_product_id,
          description: product.description,
          active: product.active
        }
      });

    } catch (error) {
      console.error('Activate product error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async bulkActivateProducts(req: AuthRequest, res: Response) {
    try {
      const { productIds, active } = req.body;

      if (!Array.isArray(productIds) || typeof active !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid request. Provide productIds array and active boolean'
        });
      }

      if (productIds.length === 0) {
        return res.status(400).json({ error: 'No products selected' });
      }

      const productRepository = AppDataSource.getRepository(Product);
      const historyRepository = AppDataSource.getRepository(ProductActivationHistory);

      type ProductResult = {
        productId: string;
        success: true;
        description: string;
      } | {
        productId: string;
        error: string;
      };

      const results: any[] = [];
      const errors: any[] = [];

      // Process products in parallel using Promise.allSettled with batching
      const BATCH_SIZE = 100; // Process 10 products simultaneously
      const batches = [];

      // Split productIds into batches
      for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
        batches.push(productIds.slice(i, i + BATCH_SIZE));
      }

      console.log(`Processing ${productIds.length} products in ${batches.length} batches of ${BATCH_SIZE}`);

      // Process each batch in parallel
      for (const [batchIndex, batch] of batches.entries()) {
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} products`);

        const batchPromises = batch.map(async (productId) => {
          try {
            // Check if product exists in our database
            let product = await productRepository.findOne({
              where: { erp_product_id: productId }
            });

            if (!product) {
              // Fetch product info from ERP to create it
              // Busca configurações do banco de dados (fallback para .env)
              const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
              const port = await ConfigurationService.get('intersolid_port', null);
              const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');

              // Monta a URL completa
              const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
              const erpApiUrl = baseUrl
                ? `${baseUrl}${productsEndpoint}`
                : process.env.ERP_PRODUCTS_API_URL || 'http://mock-erp-api.com';

              let erpProduct = null;
              let response: any = null;

              try {
                // Use cache to get products and find the specific one
                const products = await CacheService.executeWithCache(
                  'erp-products',
                  async () => {
                    console.log(`Fetching product ${productId} from ERP API for bulk activation...`, erpApiUrl);
                    const params = { id: productId };
                    if (process.env.NODE_ENV === 'development') {
                      response = await axios.get(`${erpApiUrl}`, { params });
                    } else {
                      response = await axios.get(`${erpApiUrl}/${productId}`);
                    }
                    return response.data;
                  }
                );

                erpProduct = products.find((p: any) => p.codigo === productId);
              } catch (error) {
                return { productId, error: 'Failed to fetch from ERP' };
              }

              if (!erpProduct) {
                return { productId, error: 'Product not found in ERP' };
              }

              // Create new product
              product = productRepository.create({
                erp_product_id: erpProduct.codigo,
                description: erpProduct.descricao,
                short_description: erpProduct.desReduzida,
                ean: erpProduct.ean,
                weighable: erpProduct.pesavel === 'S',
                section_code: erpProduct.codSecao,
                section_name: erpProduct.desSecao,
                group_code: erpProduct.codGrupo,
                group_name: erpProduct.desGrupo,
                subgroup_code: erpProduct.codSubGrupo,
                subgroup_name: erpProduct.desSubGrupo,
                supplier_code: erpProduct.codForn,
                supplier_name: erpProduct.razaoForn,
                active
              });
            } else {
              // Update existing product
              product.active = active;
            }

            // Save product
            await productRepository.save(product);

            // Create history entry
            const history = historyRepository.create({
              user_id: req.user!.id,
              product_id: product.id,
              active
            });
            await historyRepository.save(history);

            return {
              productId,
              success: true,
              description: product.description
            };

          } catch (error) {
            console.error(`Error processing product ${productId}:`, error);
            return { productId, error: 'Internal processing error' };
          }
        });

        // Execute batch in parallel using Promise.allSettled
        const batchResults = await Promise.allSettled(batchPromises);

        // Process batch results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const productResult = result.value;
            if ('success' in productResult && productResult.success) {
              results.push(productResult);
            } else if ('error' in productResult) {
              errors.push(productResult);
            }
          } else {
            console.error(`Batch promise rejected for product ${batch[index]}:`, result.reason);
            errors.push({
              productId: batch[index],
              error: 'Promise execution failed'
            });
          }
        });

        console.log(`Batch ${batchIndex + 1} completed. Success: ${results.length}, Errors: ${errors.length}`);
      }

      res.json({
        message: `Bulk ${active ? 'activation' : 'deactivation'} completed`,
        processed: results.length,
        errorCount: errors.length,
        results,
        errors
      });

    } catch (error) {
      console.error('Bulk activate products error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Upload de foto e análise automática por IA
   * POST /api/products/:id/upload-photo
   */
  static async uploadAndAnalyzePhoto(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID
      const file = req.file; // Multer file

      if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // Importar service de análise
      const { ImageAnalysisService } = await import('../services/image-analysis.service');
      const analysisService = new ImageAnalysisService();

      // Validar se é imagem
      if (!analysisService.isValidImage(file.path)) {
        return res.status(400).json({ error: 'Arquivo não é uma imagem válida' });
      }

      // Analisar imagem com IA
      const analysis = await analysisService.analyzeProductImage(file.path);

      // Salvar foto e características no produto
      const productRepository = AppDataSource.getRepository(Product);
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // Atualizar produto com dados da análise
      product.foto_referencia = `/uploads/products/${file.filename}`;
      product.coloracao = analysis.coloracao;
      product.formato = analysis.formato;
      product.gordura_visivel = analysis.gordura_visivel;
      product.presenca_osso = analysis.presenca_osso;

      await productRepository.save(product);

      console.log(`✅ Foto analisada e salva para produto ${id}`);
      console.log(`   Confiança: ${analysis.confianca}%`);

      res.json({
        message: 'Foto analisada com sucesso',
        foto_url: product.foto_referencia,
        analysis: {
          coloracao: analysis.coloracao,
          coloracao_rgb: analysis.coloracao_rgb,
          formato: analysis.formato,
          gordura_visivel: analysis.gordura_visivel,
          presenca_osso: analysis.presenca_osso,
          confianca: analysis.confianca,
          descricao: analysis.descricao_detalhada
        }
      });

    } catch (error) {
      console.error('Upload and analyze photo error:', error);
      res.status(500).json({ error: 'Erro ao processar imagem' });
    }
  }

  /**
   * Atualizar características de IA do produto
   * PUT /api/products/:id/ai-characteristics
   */
  static async updateAICharacteristics(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        coloracao,
        formato,
        gordura_visivel,
        presenca_osso,
        peso_min_kg,
        peso_max_kg,
        posicao_balcao
      } = req.body;

      const productRepository = AppDataSource.getRepository(Product);
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // Atualizar campos
      if (coloracao !== undefined) product.coloracao = coloracao;
      if (formato !== undefined) product.formato = formato;
      if (gordura_visivel !== undefined) product.gordura_visivel = gordura_visivel;
      if (presenca_osso !== undefined) product.presenca_osso = presenca_osso;
      if (peso_min_kg !== undefined) product.peso_min_kg = peso_min_kg;
      if (peso_max_kg !== undefined) product.peso_max_kg = peso_max_kg;
      if (posicao_balcao !== undefined) product.posicao_balcao = posicao_balcao;

      await productRepository.save(product);

      res.json({
        message: 'Características atualizadas com sucesso',
        product: {
          erp_product_id: product.erp_product_id,
          coloracao: product.coloracao,
          formato: product.formato,
          gordura_visivel: product.gordura_visivel,
          presenca_osso: product.presenca_osso,
          peso_min_kg: product.peso_min_kg,
          peso_max_kg: product.peso_max_kg,
          posicao_balcao: product.posicao_balcao
        }
      });

    } catch (error) {
      console.error('Update AI characteristics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Captura foto da câmera do DVR e analisa com YOLO
   * POST /api/products/:id/capture-from-camera
   */
  static async captureFromCamera(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID
      const { cameraId = 15 } = req.body; // Default: câmera 15 (balança)

      console.log(`📸 Capturando foto da câmera ${cameraId} para produto ${id}...`);

      // Importar serviço DVR
      const { dvrSnapshotService } = await import('../services/dvr-snapshot.service');

      // Capturar e analisar
      const { imagePath, analysis } = await dvrSnapshotService.captureAndAnalyze(cameraId);

      // Salvar no produto
      const productRepository = AppDataSource.getRepository(Product);
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // Atualizar produto com dados da análise
      const filename = path.basename(imagePath);
      product.foto_referencia = `/uploads/dvr-snapshots/${filename}`;
      product.coloracao = analysis.coloracao;
      product.formato = analysis.formato;
      product.gordura_visivel = analysis.gordura_visivel;
      product.presenca_osso = analysis.presenca_osso;

      await productRepository.save(product);

      console.log(`✅ Foto capturada e analisada para produto ${id}`);

      res.json({
        message: 'Foto capturada e analisada com sucesso',
        foto_url: product.foto_referencia,
        analysis: {
          coloracao: analysis.coloracao,
          coloracao_rgb: analysis.coloracao_rgb,
          formato: analysis.formato,
          gordura_visivel: analysis.gordura_visivel,
          presenca_osso: analysis.presenca_osso,
          confianca: analysis.confianca
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao capturar foto da câmera:', error);
      res.status(500).json({
        error: error.message || 'Erro ao capturar foto da câmera'
      });
    }
  }
}