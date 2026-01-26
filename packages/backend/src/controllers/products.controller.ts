import { response, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';
import { ProductActivationHistory } from '../entities/ProductActivationHistory';
import { AuthRequest } from '../middleware/auth';
import { CacheService } from '../services/cache.service';
import { ConfigurationService } from '../services/configuration.service';
import { OracleService } from '../services/oracle.service';
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
          description: `Produto ${id}`, // Campo obrigatório
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
   * Listar seções únicas dos produtos da API
   * GET /api/products/sections
   */
  static async getSections(req: AuthRequest, res: Response) {
    try {
      // Buscar produtos da API
      let erpApiUrl: string;

      if (process.env.ERP_PRODUCTS_API_URL) {
        erpApiUrl = process.env.ERP_PRODUCTS_API_URL;
      } else {
        const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
        const port = await ConfigurationService.get('intersolid_port', null);
        const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');
        const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
        erpApiUrl = baseUrl ? `${baseUrl}${productsEndpoint}` : 'http://mock-erp-api.com';
      }

      const erpProducts = await CacheService.executeWithCache(
        'erp-products',
        async () => {
          console.log('Fetching products from ERP API:', erpApiUrl);
          const response = await axios.get(`${erpApiUrl}`);
          return response.data;
        }
      );

      // Extrair seções únicas
      const sectionsSet = new Set<string>();
      erpProducts.forEach((product: any) => {
        if (product.desSecao) {
          sectionsSet.add(product.desSecao);
        }
      });

      // Converter para array e ordenar
      const sections = Array.from(sectionsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

      res.json(sections);

    } catch (error) {
      console.error('Get sections error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Buscar seções do Oracle com código e nome
   * GET /api/products/sections-oracle
   */
  static async getSectionsOracle(req: AuthRequest, res: Response) {
    try {
      const sql = `
        SELECT COD_SECAO, DES_SECAO
        FROM INTERSOLID.TAB_SECAO
        ORDER BY COD_SECAO
      `;

      const rows = await OracleService.query(sql);

      // Retorna array de objetos com código e nome
      const sections = rows.map((row: any) => ({
        codigo: row.COD_SECAO,
        nome: row.DES_SECAO
      }));

      res.json(sections);
    } catch (error) {
      console.error('Get sections Oracle error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Buscar produtos filtrados por seção do Oracle
   * GET /api/products/by-section-oracle?section=HORT FRUTI&codLoja=1
   */
  static async getProductsBySectionOracle(req: AuthRequest, res: Response) {
    try {
      const { section, codLoja } = req.query;

      if (!section) {
        return res.status(400).json({ error: 'Parâmetro section é obrigatório' });
      }

      const loja = codLoja ? parseInt(codLoja as string) : 1;

      console.log('📦 Buscando produtos por seção do Oracle:', { section, loja });

      // Query para buscar produtos com informações completas
      // VAL_MARGEM_FIXA = margem de referência, VAL_MARGEM = margem atual
      const sql = `
        SELECT
          p.COD_PRODUTO,
          p.COD_BARRA_PRINCIPAL,
          p.DES_PRODUTO,
          s.DES_SECAO,
          g.DES_GRUPO,
          TRIM(pl.DES_RANK_PRODLOJA) as CURVA,
          NVL(pl.VAL_CUSTO_REP, 0) as VAL_CUSTO_REP,
          NVL(pl.VAL_VENDA, 0) as VAL_VENDA,
          NVL(pl.VAL_MARGEM, 0) as VAL_MARGEM,
          NVL(pl.VAL_MARGEM_FIXA, pl.VAL_MARGEM) as VAL_MARGEM_REF
        FROM INTERSOLID.TAB_PRODUTO p
        INNER JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON p.COD_PRODUTO = pl.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_SECAO s ON p.COD_SECAO = s.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
        WHERE pl.COD_LOJA = :codLoja
        AND UPPER(s.DES_SECAO) LIKE :sectionFilter
        AND NVL(pl.INATIVO, 'N') = 'N'
        ORDER BY p.DES_PRODUTO
      `;

      const params = {
        codLoja: loja,
        sectionFilter: `%${String(section).toUpperCase()}%`
      };

      const rows = await OracleService.query(sql, params);

      // Mapear para formato esperado pelo HortFrut
      const items = rows.map((row: any) => ({
        barcode: row.COD_BARRA_PRINCIPAL || String(row.COD_PRODUTO),
        productName: row.DES_PRODUTO || '',
        curve: row.CURVA || '',
        currentCost: parseFloat(row.VAL_CUSTO_REP) || 0,
        currentSalePrice: parseFloat(row.VAL_VENDA) || 0,
        referenceMargin: parseFloat(row.VAL_MARGEM_REF) || 0,
        currentMargin: parseFloat(row.VAL_MARGEM) || 0,
        section: row.DES_SECAO || '',
        productGroup: row.DES_GRUPO || '',
        subGroup: ''
      }));

      console.log(`✅ ${items.length} produtos encontrados na seção "${section}"`);

      res.json({
        section: section,
        total: items.length,
        items
      });

    } catch (error: any) {
      console.error('Get products by section Oracle error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Buscar produtos filtrados por seção
   * GET /api/products/by-section?section=HORTIFRUTI
   */
  static async getProductsBySection(req: AuthRequest, res: Response) {
    try {
      const { section } = req.query;

      if (!section) {
        return res.status(400).json({ error: 'Parâmetro section é obrigatório' });
      }

      // Buscar produtos da API
      let erpApiUrl: string;

      if (process.env.ERP_PRODUCTS_API_URL) {
        erpApiUrl = process.env.ERP_PRODUCTS_API_URL;
      } else {
        const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
        const port = await ConfigurationService.get('intersolid_port', null);
        const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');
        const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
        erpApiUrl = baseUrl ? `${baseUrl}${productsEndpoint}` : 'http://mock-erp-api.com';
      }

      const erpProducts = await CacheService.executeWithCache(
        'erp-products',
        async () => {
          console.log('Fetching products from ERP API:', erpApiUrl);
          const response = await axios.get(`${erpApiUrl}`);
          return response.data;
        }
      );

      // Filtrar por seção (case insensitive)
      const sectionUpper = String(section).toUpperCase();
      const filteredProducts = erpProducts.filter((product: any) =>
        product.desSecao && product.desSecao.toUpperCase().includes(sectionUpper)
      );

      // Mapear para formato esperado pelo HortFrut
      const items = filteredProducts.map((product: any) => ({
        barcode: product.ean || product.codigo,
        productName: product.descricao,
        curve: product.curva || '',
        currentCost: product.valCustoRep || 0,
        currentSalePrice: product.valvenda || product.valvendaloja || 0,
        referenceMargin: product.margemRef || 0,
        currentMargin: product.markupAtual || 0,
        section: product.desSecao || '',
        productGroup: product.desGrupo || '',
        subGroup: product.desSubGrupo || ''
      }));

      res.json({
        section: section,
        total: items.length,
        items
      });

    } catch (error) {
      console.error('Get products by section error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Buscar produtos para pesquisa de ruptura com filtros
   * GET /api/products/for-rupture?diasSemVenda=7&curvas=A,B,C&secoes=MERCEARIA,BEBIDAS&codLoja=1
   * Busca diretamente do banco Oracle
   */
  static async getProductsForRupture(req: AuthRequest, res: Response) {
    try {
      const { diasSemVenda, curvas, secoes, codLoja } = req.query;

      // Importar OracleService
      const { OracleService } = await import('../services/oracle.service');

      // Montar query Oracle
      let whereConditions: string[] = [];
      const params: any = {};

      // Filtro de loja (default = 1)
      const loja = codLoja ? parseInt(codLoja as string) : 1;
      whereConditions.push('pl.COD_LOJA = :codLoja');
      params.codLoja = loja;

      // Filtro de dias sem venda
      if (diasSemVenda) {
        const dias = parseInt(diasSemVenda as string);
        if (!isNaN(dias) && dias > 0) {
          whereConditions.push(`(pl.DTA_ULT_MOV_VENDA IS NULL OR pl.DTA_ULT_MOV_VENDA <= SYSDATE - :diasSemVenda)`);
          params.diasSemVenda = dias;
        }
      }

      // Filtro de curvas
      if (curvas && curvas !== 'TODOS') {
        const curvasArray = (curvas as string).split(',').map(c => c.trim().toUpperCase());
        whereConditions.push(`pl.DES_RANK_PRODLOJA IN (${curvasArray.map((_, i) => `:curva${i}`).join(', ')})`);
        curvasArray.forEach((curva, i) => {
          params[`curva${i}`] = curva;
        });
      }

      // Filtro de seções
      if (secoes) {
        const secoesArray = (secoes as string).split(',').map(s => s.trim().toUpperCase());
        const secaoConditions = secoesArray.map((_, i) => `UPPER(s.DES_SECAO) LIKE :secao${i}`);
        whereConditions.push(`(${secaoConditions.join(' OR ')})`);
        secoesArray.forEach((secao, i) => {
          params[`secao${i}`] = `%${secao}%`;
        });
      }

      // Filtrar apenas produtos ativos
      whereConditions.push(`NVL(pl.INATIVO, 'N') = 'N'`);
      whereConditions.push(`p.COD_PRODUTO IS NOT NULL`);

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      const sql = `
        SELECT
          p.COD_BARRA_PRINCIPAL as CODIGO_BARRAS,
          p.COD_PRODUTO as ERP_PRODUCT_ID,
          p.DES_PRODUTO as DESCRICAO,
          TRIM(pl.DES_RANK_PRODLOJA) as CURVA,
          NVL(pl.QTD_EST_ATUAL, 0) as ESTOQUE_ATUAL,
          NVL(pl.QTD_COBERTURA, 0) as COBERTURA_DIAS,
          g.DES_GRUPO as GRUPO,
          s.DES_SECAO as SECAO,
          pl.COD_FORN_ULT_COMPRA as COD_FORNECEDOR,
          f.DES_FORNECEDOR as FORNECEDOR,
          NVL(pl.VAL_MARGEM, 0) as MARGEM_LUCRO,
          1 as QTD_EMBALAGEM,
          NVL(pl.VAL_VENDA, 0) as VALOR_VENDA,
          NVL(pl.VAL_CUSTO_REP, 0) as CUSTO_COM_IMPOSTO,
          NVL(pl.VAL_VENDA_MEDIA, 0) as VENDA_MEDIA_DIA,
          CASE WHEN NVL(pl.QTD_PEDIDO_COMPRA, 0) > 0 THEN 'Sim' ELSE 'Nao' END as TEM_PEDIDO,
          pl.DTA_ULT_MOV_VENDA as DTA_ULT_VENDA,
          CASE
            WHEN pl.DTA_ULT_MOV_VENDA IS NULL THEN 9999
            ELSE TRUNC(SYSDATE - pl.DTA_ULT_MOV_VENDA)
          END as DIAS_SEM_VENDA
        FROM INTERSOLID.TAB_PRODUTO p
        INNER JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON p.COD_PRODUTO = pl.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_SECAO s ON p.COD_SECAO = s.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON pl.COD_FORN_ULT_COMPRA = f.COD_FORNECEDOR
        ${whereClause}
        ORDER BY DIAS_SEM_VENDA DESC, pl.DES_RANK_PRODLOJA ASC
      `;

      console.log('📊 Buscando produtos para ruptura do Oracle...');
      console.log('Filtros:', { diasSemVenda, curvas, secoes, codLoja: loja });

      const rows = await OracleService.query(sql, params);

      // Mapear para formato esperado
      const items = rows.map((row: any) => ({
        codigo_barras: row.CODIGO_BARRAS || String(row.ERP_PRODUCT_ID),
        erp_product_id: String(row.ERP_PRODUCT_ID),
        descricao: row.DESCRICAO || '',
        curva: row.CURVA || '',
        estoque_atual: row.ESTOQUE_ATUAL || 0,
        cobertura_dias: row.COBERTURA_DIAS || 0,
        grupo: row.GRUPO || '',
        secao: row.SECAO || '',
        fornecedor: row.FORNECEDOR || '',
        margem_lucro: row.MARGEM_LUCRO || 0,
        qtd_embalagem: 1,
        valor_venda: row.VALOR_VENDA || 0,
        custo_com_imposto: row.CUSTO_COM_IMPOSTO || 0,
        venda_media_dia: row.VENDA_MEDIA_DIA || 0,
        tem_pedido: row.TEM_PEDIDO || 'Nao',
        dias_sem_venda: row.DIAS_SEM_VENDA === 9999 ? null : row.DIAS_SEM_VENDA,
        dta_ult_venda: row.DTA_ULT_VENDA
      }));

      console.log(`✅ ${items.length} produtos encontrados`);

      res.json({
        total: items.length,
        filtros: {
          diasSemVenda: diasSemVenda || null,
          curvas: curvas || 'TODOS',
          secoes: secoes || null,
          codLoja: loja
        },
        items
      });

    } catch (error: any) {
      console.error('Get products for rupture error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Buscar produtos para auditoria de etiquetas (alteração de preço de VENDA)
   * GET /api/products/for-label-audit
   * Filtros: dataInicio, dataFim, tipoOferta (todos, com_oferta, sem_oferta), secoes
   *
   * Usa TAB_PRODUTO_HISTORICO.DTA_ULT_ALT_PRECO_VENDA para buscar alterações
   * específicas do preço de venda (não confundir com DTA_ALTERACAO_PRECO que
   * captura outras alterações também)
   */
  static async getProductsForLabelAudit(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, tipoOferta, secoes, codLoja } = req.query;

      // Validar datas
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: 'Data início e data fim são obrigatórias' });
      }

      // Loja padrão = 1
      const loja = codLoja || 1;

      // Construir WHERE dinâmico
      const whereConditions: string[] = [];
      const params: any = {
        dataInicio: dataInicio,
        dataFim: dataFim,
        codLoja: loja
      };

      // Filtro de data de alteração de preço de VENDA usando TAB_PRODUTO_HISTORICO
      // DTA_ULT_ALT_PRECO_VENDA é a coluna correta para capturar alterações de preço de venda
      whereConditions.push(`(
        h.DTA_ULT_ALT_PRECO_VENDA >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
        AND h.DTA_ULT_ALT_PRECO_VENDA < TO_DATE(:dataFim, 'YYYY-MM-DD') + 1
      )`);

      // Filtro de loja
      whereConditions.push(`h.COD_LOJA = :codLoja`);

      // Filtro de tipo de oferta
      if (tipoOferta === 'com_oferta') {
        whereConditions.push(`pl.VAL_OFERTA IS NOT NULL AND pl.VAL_OFERTA > 0 AND TRUNC(SYSDATE) <= NVL(pl.DTA_VALIDA_OFERTA, TRUNC(SYSDATE))`);
      } else if (tipoOferta === 'sem_oferta') {
        whereConditions.push(`(pl.VAL_OFERTA IS NULL OR pl.VAL_OFERTA = 0 OR TRUNC(SYSDATE) > NVL(pl.DTA_VALIDA_OFERTA, TRUNC(SYSDATE) - 1))`);
      }

      // Filtro de seções (opcional)
      if (secoes && typeof secoes === 'string') {
        const secoesArray = secoes.split(',').map(s => s.trim().toUpperCase());
        const secaoConditions = secoesArray.map((_, i) => `UPPER(s.DES_SECAO) LIKE :secao${i}`);
        whereConditions.push(`(${secaoConditions.join(' OR ')})`);
        secoesArray.forEach((secao, i) => {
          params[`secao${i}`] = `%${secao}%`;
        });
      }

      // Filtrar apenas produtos com preço válido
      whereConditions.push(`p.COD_PRODUTO IS NOT NULL`);
      whereConditions.push(`pl.VAL_VENDA IS NOT NULL`);

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Query usando TAB_PRODUTO_HISTORICO para pegar DTA_ULT_ALT_PRECO_VENDA
      // e VAL_VENDA_ANT (preço anterior) / VAL_VENDA_PDV (preço no PDV)
      const sql = `
        SELECT
          p.COD_BARRA_PRINCIPAL as CODIGO_BARRAS,
          p.COD_PRODUTO as ERP_PRODUCT_ID,
          p.DES_PRODUTO as DESCRICAO,
          s.DES_SECAO as SECAO,
          g.DES_GRUPO as GRUPO,
          NVL(pl.VAL_VENDA, 0) as VAL_VENDA,
          NVL(h.VAL_VENDA_ANT, 0) as VAL_VENDA_ANTERIOR,
          NVL(h.VAL_VENDA_PDV, 0) as VAL_VENDA_PDV,
          NVL(pl.VAL_OFERTA, 0) as VAL_OFERTA,
          pl.DTA_VALIDA_OFERTA,
          h.DTA_ULT_ALT_PRECO_VENDA as DTA_ALTERACAO,
          h.DTA_CARGA_PDV,
          NVL(pl.VAL_MARGEM, 0) as VAL_MARGEM,
          f.DES_FORNECEDOR as FORNECEDOR,
          CASE
            WHEN pl.VAL_OFERTA IS NOT NULL AND pl.VAL_OFERTA > 0
                 AND TRUNC(SYSDATE) <= NVL(pl.DTA_VALIDA_OFERTA, TRUNC(SYSDATE))
            THEN 'S'
            ELSE 'N'
          END as EM_OFERTA
        FROM INTERSOLID.TAB_PRODUTO_HISTORICO h
        JOIN INTERSOLID.TAB_PRODUTO p ON h.COD_PRODUTO = p.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON h.COD_PRODUTO = pl.COD_PRODUTO AND h.COD_LOJA = pl.COD_LOJA
        LEFT JOIN INTERSOLID.TAB_SECAO s ON p.COD_SECAO = s.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON pl.COD_FORN_ULT_COMPRA = f.COD_FORNECEDOR
        ${whereClause}
        ORDER BY s.DES_SECAO ASC NULLS LAST, p.DES_PRODUTO ASC
      `;

      console.log('📊 Buscando produtos para auditoria de etiquetas do Oracle...');
      console.log('Filtros:', { dataInicio, dataFim, tipoOferta, secoes, codLoja: loja });

      const rows = await OracleService.query(sql, params);

      // Mapear para formato esperado
      const items = rows.map((row: any) => ({
        codigo_barras: row.CODIGO_BARRAS || String(row.ERP_PRODUCT_ID),
        erp_product_id: String(row.ERP_PRODUCT_ID),
        descricao: row.DESCRICAO || '',
        secao: row.SECAO || '',
        grupo: row.GRUPO || '',
        valor_venda: row.VAL_VENDA || 0,
        valor_venda_anterior: row.VAL_VENDA_ANTERIOR || 0,
        valor_venda_pdv: row.VAL_VENDA_PDV || 0,
        valor_oferta: row.VAL_OFERTA || 0,
        em_oferta: row.EM_OFERTA === 'S',
        dta_valida_oferta: row.DTA_VALIDA_OFERTA,
        dta_alteracao: row.DTA_ALTERACAO,
        dta_carga_pdv: row.DTA_CARGA_PDV,
        margem_lucro: row.VAL_MARGEM || 0,
        fornecedor: row.FORNECEDOR || '',
        // Para auditoria de etiquetas, o valor esperado na etiqueta é o preço atual
        etiqueta: row.VAL_OFERTA > 0 && row.EM_OFERTA === 'S'
          ? `R$ ${Number(row.VAL_OFERTA).toFixed(2)}`
          : `R$ ${Number(row.VAL_VENDA).toFixed(2)}`
      }));

      console.log(`✅ ${items.length} produtos encontrados com alteração de preço de venda`);

      res.json({
        total: items.length,
        filtros: {
          dataInicio,
          dataFim,
          tipoOferta: tipoOferta || 'todos',
          secoes: secoes || null,
          codLoja: loja
        },
        items
      });

    } catch (error: any) {
      console.error('Get products for label audit error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
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

  /**
   * Buscar TODOS os produtos diretamente do Oracle
   * GET /api/products/oracle?codLoja=1
   * Usado pela tela de Prevenção Estoque e Margem
   */
  static async getProductsOracle(req: AuthRequest, res: Response) {
    try {
      const { codLoja } = req.query;
      const loja = codLoja ? parseInt(codLoja as string) : 1;

      console.log('📦 Buscando todos os produtos do Oracle para loja:', loja);

      // Query completa para buscar produtos com todas as informações necessárias
      // Colunas baseadas na query de ruptura que funciona
      const sql = `
        SELECT
          p.COD_PRODUTO as CODIGO,
          p.COD_BARRA_PRINCIPAL as EAN,
          p.DES_PRODUTO as DESCRICAO,
          p.DES_REDUZIDA as DES_REDUZIDA,
          NVL(pl.VAL_CUSTO_REP, 0) as VAL_CUSTO_REP,
          NVL(pl.VAL_VENDA, 0) as VAL_VENDA,
          NVL(pl.VAL_VENDA, 0) as VAL_VENDA_LOJA,
          0 as VAL_OFERTA,
          NVL(pl.QTD_EST_ATUAL, 0) as ESTOQUE,
          s.DES_SECAO,
          g.DES_GRUPO,
          sg.DES_SUB_GRUPO as DES_SUBGRUPO,
          f.DES_FORNECEDOR as FANTASIA_FORN,
          NVL(pl.VAL_MARGEM, 0) as MARGEM_REF,
          NVL(pl.VAL_MARGEM, 0) as VAL_MARGEM,
          NVL(pl.VAL_VENDA_MEDIA, 0) as VENDA_MEDIA,
          NVL(pl.QTD_COBERTURA, 0) as DIAS_COBERTURA,
          NVL(pl.QTD_PEDIDO_COMPRA, 0) as QTD_PEDIDO_COMPRA,
          TO_CHAR(pl.DTA_ULT_COMPRA, 'DD/MM/YYYY') as DTA_ULT_COMPRA,
          NVL(pl.QTD_ULT_COMPRA, 0) as QTD_ULT_COMPRA,
          NVL(pl.QTD_EST_MINIMO, 0) as QTD_EST_MINIMO,
          TO_CHAR(pl.DTA_ULT_MOV_VENDA, 'YYYYMMDD') as DTA_ULT_MOV_VENDA,
          NVL(TRIM(pl.DES_RANK_PRODLOJA), 'X') as CURVA,
          CASE p.TIPO_ESPECIE
            WHEN 0 THEN 'MERCADORIA'
            WHEN 2 THEN 'SERVICO'
            WHEN 3 THEN 'IMOBILIZADO'
            WHEN 4 THEN 'INSUMO'
            ELSE 'OUTROS'
          END as TIPO_ESPECIE,
          CASE p.TIPO_EVENTO
            WHEN 0 THEN 'Direta'
            WHEN 1 THEN 'Decomposição'
            WHEN 2 THEN 'Composição'
            WHEN 3 THEN 'Produção'
            ELSE 'Outros'
          END as TIPO_EVENTO,
          p.DTA_CADASTRO
        FROM INTERSOLID.TAB_PRODUTO p
        INNER JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON p.COD_PRODUTO = pl.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_SECAO s ON p.COD_SECAO = s.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sg ON p.COD_SECAO = sg.COD_SECAO AND p.COD_GRUPO = sg.COD_GRUPO AND p.COD_SUB_GRUPO = sg.COD_SUB_GRUPO
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON pl.COD_FORN_ULT_COMPRA = f.COD_FORNECEDOR
        WHERE pl.COD_LOJA = :codLoja
        AND NVL(pl.INATIVO, 'N') = 'N'
        ORDER BY p.DES_PRODUTO
      `;

      const rows = await OracleService.query(sql, { codLoja: loja });

      // Buscar produtos ativos do banco local para enriquecer
      const productRepository = AppDataSource.getRepository(Product);
      const activeProducts = await productRepository.find({
        select: ['erp_product_id', 'active', 'peso_medio_kg', 'production_days', 'foto_referencia']
      });

      const productsMap = new Map(
        activeProducts.map(p => [p.erp_product_id, {
          active: p.active,
          peso_medio_kg: p.peso_medio_kg,
          production_days: p.production_days,
          foto_referencia: p.foto_referencia
        }])
      );

      // Mapear para o formato esperado pelo frontend
      const items = rows.map((row: any) => {
        const dbProduct = productsMap.get(String(row.CODIGO));
        return {
          codigo: String(row.CODIGO),
          ean: row.EAN || '',
          descricao: row.DESCRICAO || '',
          desReduzida: row.DES_REDUZIDA || '',
          valCustoRep: parseFloat(row.VAL_CUSTO_REP) || 0,
          valvendaloja: parseFloat(row.VAL_VENDA_LOJA) || 0,
          valvenda: parseFloat(row.VAL_VENDA) || 0,
          valOferta: parseFloat(row.VAL_OFERTA) || 0,
          estoque: parseFloat(row.ESTOQUE) || 0,
          desSecao: row.DES_SECAO || '',
          desGrupo: row.DES_GRUPO || '',
          desSubGrupo: row.DES_SUBGRUPO || '',
          fantasiaForn: row.FANTASIA_FORN || '',
          margemRef: parseFloat(row.MARGEM_REF) || 0,
          vendaMedia: parseFloat(row.VENDA_MEDIA) || 0,
          diasCobertura: parseInt(row.DIAS_COBERTURA) || 0,
          dtaUltCompra: row.DTA_ULT_COMPRA || null,
          qtdUltCompra: parseFloat(row.QTD_ULT_COMPRA) || 0,
          qtdPedidoCompra: parseFloat(row.QTD_PEDIDO_COMPRA) || 0,
          estoqueMinimo: parseFloat(row.QTD_EST_MINIMO) || 0,
          dtaUltMovVenda: row.DTA_ULT_MOV_VENDA || null,
          curva: row.CURVA || '',
          tipoEspecie: row.TIPO_ESPECIE || 'MERCADORIA',
          tipoEvento: row.TIPO_EVENTO || 'DIRETA',
          dtaCadastro: row.DTA_CADASTRO || null,
          // Campos do banco local
          active: dbProduct?.active || false,
          peso_medio_kg: dbProduct?.peso_medio_kg || null,
          production_days: dbProduct?.production_days || 1,
          foto_referencia: dbProduct?.foto_referencia || null
        };
      });

      console.log(`✅ ${items.length} produtos encontrados no Oracle`);

      res.json({
        data: items,
        total: items.length
      });

    } catch (error: any) {
      console.error('Get products Oracle error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}