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
      // Prioriza variável de ambiente (desenvolvimento local), fallback para banco (produção Docker)
      let erpApiUrl: string;

      if (process.env.ERP_PRODUCTS_API_URL) {
        // Usa URL do .env diretamente (desenvolvimento local)
        erpApiUrl = process.env.ERP_PRODUCTS_API_URL;
      } else {
        // Fallback: busca do banco de dados (produção Docker)
        const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
        const port = await ConfigurationService.get('intersolid_port', null);
        const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');
        const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
        erpApiUrl = baseUrl ? `${baseUrl}${productsEndpoint}` : 'http://mock-erp-api.com';
      }

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
        select: ['erp_product_id', 'active', 'peso_medio_kg', 'production_days', 'foto_referencia']
      });

      // Create a map for quick lookup (includes active status, peso_medio_kg, production_days and foto_referencia)
      const productsMap = new Map(
        activeProducts.map(p => [p.erp_product_id, { active: p.active, peso_medio_kg: p.peso_medio_kg, production_days: p.production_days, foto_referencia: p.foto_referencia }])
      );

      // Enrich ERP products with active status and filter fields
      const enrichedProducts = erpProducts.map((product: any) => {
        const dbProduct = productsMap.get(product.codigo);
        return {
          codigo: product.codigo,
          ean: product.ean,
          descricao: product.descricao,
          desReduzida: product.desReduzida,
          valCustoRep: product.valCustoRep,
          valvendaloja: product.valvendaloja,
          valvenda: product.valvenda,
          valOferta: product.valOferta,
          estoque: product.estoque,
          desSecao: product.desSecao,
          desGrupo: product.desGrupo,
          desSubGrupo: product.desSubGrupo,
          fantasiaForn: product.fantasiaForn,
          margemRef: product.margemRef,
          vendaMedia: product.vendaMedia,
          diasCobertura: product.diasCobertura,
          dtaUltCompra: product.dtaUltCompra,
          qtdUltCompra: product.qtdUltCompra,
          qtdPedidoCompra: product.qtdPedidoCompra,
          estoqueMinimo: product.estoqueMinimo,
          tipoEspecie: product.tipoEspecie,
          dtaCadastro: product.dtaCadastro,
          tipoEvento: product.tipoEvento,
          dtaUltMovVenda: product.dtaUltMovVenda,
          pesavel: product.pesavel,
          active: dbProduct?.active || false,
          peso_medio_kg: dbProduct?.peso_medio_kg || null,
          production_days: dbProduct?.production_days || 1,
          foto_referencia: dbProduct?.foto_referencia || null
        };
      });

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
          // Use cache with UNIQUE key per product to avoid race conditions
          const cacheKey = `erp-product-${id}`;

          erpProduct = await CacheService.executeWithCache(
            cacheKey,
            async () => {
              console.log(`[ACTIVATE] Fetching product ${id} from ERP API...`, erpApiUrl);

              if (process.env.NODE_ENV === 'development') {
                // Development: Get all products and filter
                const params = { id: id };
                response = await axios.get(`${erpApiUrl}`, { params });
                const products = Array.isArray(response.data) ? response.data : [response.data];
                return products.find((p: any) => p.codigo === id) || null;
              } else {
                // Production: Get specific product
                response = await axios.get(`${erpApiUrl}/${id}`);
                // Handle both single object and array responses
                if (Array.isArray(response.data)) {
                  return response.data.find((p: any) => p.codigo === id) || response.data[0] || null;
                }
                return response.data || null;
              }
            }
          );

          if (!erpProduct) {
            console.error(`[ACTIVATE] Product ${id} not found in ERP response`);
          }
        } catch (error) {
          console.error(`[ACTIVATE] Failed to fetch product ${id}:`, error);
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

  static async updatePesoMedio(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID (codigo)
      const { peso_medio_kg } = req.body;

      if (typeof peso_medio_kg !== 'number' || peso_medio_kg < 0) {
        return res.status(400).json({ error: 'peso_medio_kg must be a positive number' });
      }

      const productRepository = AppDataSource.getRepository(Product);

      // Find or create product
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        // If product doesn't exist, we need to create it first
        // Fetch product info from ERP
        const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
        const port = await ConfigurationService.get('intersolid_port', null);
        const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');
        const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
        const erpApiUrl = baseUrl ? `${baseUrl}${productsEndpoint}` : process.env.ERP_PRODUCTS_API_URL || 'http://mock-erp-api.com';

        const cacheKey = `erp-product-${id}`;
        const erpProduct = await CacheService.executeWithCache(cacheKey, async () => {
          const response = await axios.get(`${erpApiUrl}/${id}`);
          if (Array.isArray(response.data)) {
            return response.data.find((p: any) => p.codigo === id) || response.data[0] || null;
          }
          return response.data || null;
        });

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
          active: false,
          peso_medio_kg
        });
      } else {
        // Update existing product
        product.peso_medio_kg = peso_medio_kg;
      }

      await productRepository.save(product);

      res.json({
        message: 'Peso médio atualizado com sucesso',
        product: {
          erp_product_id: product.erp_product_id,
          peso_medio_kg: product.peso_medio_kg
        }
      });

    } catch (error) {
      console.error('Update peso medio error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProductionDays(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID (codigo)
      const { production_days } = req.body;

      if (typeof production_days !== 'number' || production_days < 1) {
        return res.status(400).json({ error: 'production_days must be a number >= 1' });
      }

      const productRepository = AppDataSource.getRepository(Product);

      // Find product
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found. Activate it first.' });
      }

      // Update production days
      product.production_days = production_days;
      await productRepository.save(product);

      res.json({
        message: 'Dias de produção atualizados com sucesso',
        product: {
          erp_product_id: product.erp_product_id,
          production_days: product.production_days
        }
      });

    } catch (error) {
      console.error('Update production days error:', error);
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
                // Use cache with UNIQUE key per product to avoid race conditions
                const cacheKey = `erp-product-${productId}`;

                const productData = await CacheService.executeWithCache(
                  cacheKey,
                  async () => {
                    console.log(`[BULK] Fetching product ${productId} from ERP API...`);

                    if (process.env.NODE_ENV === 'development') {
                      // Development: Get all products and filter
                      const params = { id: productId };
                      response = await axios.get(`${erpApiUrl}`, { params });
                      const products = Array.isArray(response.data) ? response.data : [response.data];
                      return products.find((p: any) => p.codigo === productId) || null;
                    } else {
                      // Production: Get specific product
                      response = await axios.get(`${erpApiUrl}/${productId}`);
                      // Handle both single object and array responses
                      if (Array.isArray(response.data)) {
                        return response.data.find((p: any) => p.codigo === productId) || response.data[0] || null;
                      }
                      return response.data || null;
                    }
                  }
                );

                erpProduct = productData;

                if (!erpProduct) {
                  console.error(`[BULK] Product ${productId} not found in ERP response`);
                }
              } catch (error) {
                console.error(`[BULK] Failed to fetch product ${productId} from ERP:`, error);
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
      const file = req.file; // Multer file (em memória)

      if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // Importar serviço do MinIO
      const { minioService } = await import('../services/minio.service');

      // Salvar foto no produto
      const productRepository = AppDataSource.getRepository(Product);
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        // Criar produto se não existir
        product = productRepository.create({
          erp_product_id: id,
          active: false
        });
      }

      // Gerar nome único para o arquivo
      const ext = file.originalname.split('.').pop() || 'jpg';
      const fileName = `products/${id}-${Date.now()}.${ext}`;

      // Upload para MinIO
      const fotoUrl = await minioService.uploadFile(fileName, file.buffer, file.mimetype);

      // Atualizar produto com URL da foto
      product.foto_referencia = fotoUrl;
      await productRepository.save(product);

      console.log(`✅ Foto salva no MinIO para produto ${id}: ${fotoUrl}`);

      res.json({
        message: 'Foto enviada com sucesso',
        foto_url: fotoUrl
      });

    } catch (error) {
      console.error('Upload photo error:', error);
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

  /**
   * Excluir foto do produto
   * DELETE /api/products/:id/photo
   */
  static async deletePhoto(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID

      const productRepository = AppDataSource.getRepository(Product);
      const product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      if (!product.foto_referencia) {
        return res.status(400).json({ error: 'Produto não possui foto' });
      }

      // Tentar deletar o arquivo físico (não bloqueia se falhar)
      try {
        const fs = await import('fs/promises');
        const filePath = path.join(process.cwd(), 'public', product.foto_referencia);
        await fs.unlink(filePath);
        console.log(`🗑️ Arquivo de foto deletado: ${filePath}`);
      } catch (fileError) {
        console.warn('⚠️ Não foi possível deletar o arquivo físico da foto:', fileError);
      }

      // Limpar referência da foto e características de IA no banco
      product.foto_referencia = undefined;
      product.coloracao = undefined;
      product.formato = undefined;
      product.gordura_visivel = undefined;
      product.presenca_osso = undefined;

      await productRepository.save(product);

      console.log(`✅ Foto excluída do produto ${id}`);

      res.json({
        message: 'Foto excluída com sucesso'
      });

    } catch (error) {
      console.error('Delete photo error:', error);
      res.status(500).json({ error: 'Erro ao excluir foto' });
    }
  }
}