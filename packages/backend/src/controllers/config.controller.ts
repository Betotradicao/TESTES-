import { Request, Response } from 'express';
import { Client } from 'pg';
import { ConfigurationService } from '../services/configuration.service';

export class ConfigController {
  async testDatabaseConnection(req: Request, res: Response) {
    const { host, port, username, password, databaseName } = req.body;

    if (!host || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Host, usuário e senha são obrigatórios'
      });
    }

    const client = new Client({
      host,
      port: parseInt(port) || 5432,
      user: username,
      password,
      database: databaseName || 'postgres'
    });

    try {
      await client.connect();

      // Testa uma query simples
      const result = await client.query('SELECT version()');

      await client.end();

      return res.json({
        success: true,
        message: 'Conexão estabelecida com sucesso!',
        version: result.rows[0].version,
        connection: {
          host,
          port: parseInt(port) || 5432,
          database: databaseName || 'postgres'
        }
      });
    } catch (error: any) {
      try {
        await client.end();
      } catch (e) {
        // Ignore error closing connection
      }

      return res.status(500).json({
        success: false,
        message: `Erro ao conectar: ${error.message}`,
        error: error.code || 'UNKNOWN_ERROR'
      });
    }
  }

  async testMinioConnection(req: Request, res: Response) {
    const { endpoint, port, accessKey, secretKey, useSSL } = req.body;

    if (!endpoint || !accessKey || !secretKey) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint, Access Key e Secret Key são obrigatórios'
      });
    }

    try {
      // Importa o MinIO dinamicamente
      const Minio = require('minio');

      const minioClient = new Minio.Client({
        endPoint: endpoint,
        port: parseInt(port) || 9000,
        useSSL: useSSL || false,
        accessKey,
        secretKey
      });

      // Testa listando os buckets
      const buckets = await minioClient.listBuckets();

      return res.json({
        success: true,
        message: 'Conexão com MinIO estabelecida com sucesso!',
        buckets: buckets.map((b: any) => ({
          name: b.name,
          creationDate: b.creationDate
        })),
        connection: {
          endpoint,
          port: parseInt(port) || 9000,
          useSSL: useSSL || false
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao conectar ao MinIO: ${error.message}`,
        error: error.code || 'UNKNOWN_ERROR'
      });
    }
  }

  async testZanthusConnection(req: Request, res: Response) {
    const { apiUrl, port, apiToken, endpoint } = req.body;

    if (!apiUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL da API é obrigatória'
      });
    }

    try {
      const axios = require('axios');
      const URLSearchParams = require('url').URLSearchParams;

      // Monta a URL completa
      const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
      const fullUrl = endpoint ? `${baseUrl}${endpoint}` : `${baseUrl}/manager/restful/integracao/cadastro_sincrono.php5`;

      // Query SQL para buscar produtos
      const sqlProdutos = "SELECT * FROM TAB_PRODUTO WHERE ROWNUM <= 5";

      // Query SQL para buscar vendas (ontem, para garantir que há dados)
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      const dataOntem = ontem.toISOString().split('T')[0];

      const sqlVendas = `
        SELECT
          z.M00AC as codCaixa,
          z.M00ZA as codLoja,
          z.M43AH as codProduto,
          z.M00AF as dtaSaida,
          z.M00AD as numCupomFiscal,
          z.M43DQ as valVenda,
          z.M43AO as qtdTotalProduto,
          z.M43AP as valTotalProduto,
          p.DESCRICAO_PRODUTO as desProduto
        FROM ZAN_M43 z
        LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || z.M43AH
        WHERE TRUNC(z.M00AF) = TO_DATE('${dataOntem}','YYYY-MM-DD')
        AND ROWNUM <= 5
      `.replace(/\s+/g, ' ').trim();

      const config: any = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      // Nota: Token não é usado pois causa erro 500 na API Zanthus
      // if (apiToken) {
      //   config.headers['Authorization'] = `Bearer ${apiToken}`;
      // }

      // Requisição 1: Produtos
      const jsonDataProdutos = {
        ZMI: {
          DATABASES: {
            DATABASE: {
              "@attributes": {
                NAME: "MANAGER",
                AUTOCOMMIT_VALUE: "1000",
                AUTOCOMMIT_ENABLED: "1",
                HALTONERROR: "1"
              },
              COMMANDS: {
                SELECT: {
                  PRODUTOS: {
                    PRODUTO: {
                      SQL: sqlProdutos
                    }
                  }
                }
              }
            }
          }
        }
      };

      const formDataProdutos = new URLSearchParams();
      formDataProdutos.append('str_json', JSON.stringify(jsonDataProdutos));

      // Requisição 2: Vendas
      const jsonDataVendas = {
        ZMI: {
          DATABASES: {
            DATABASE: {
              "@attributes": {
                NAME: "MANAGER",
                AUTOCOMMIT_VALUE: "1000",
                AUTOCOMMIT_ENABLED: "1",
                HALTONERROR: "1"
              },
              COMMANDS: {
                SELECT: {
                  MERCADORIAS: {
                    MERCADORIA: {
                      SQL: sqlVendas
                    }
                  }
                }
              }
            }
          }
        }
      };

      const formDataVendas = new URLSearchParams();
      formDataVendas.append('str_json', JSON.stringify(jsonDataVendas));

      // Faz as duas requisições em paralelo
      const [responseProdutos, responseVendas] = await Promise.all([
        axios.post(fullUrl, formDataProdutos.toString(), config),
        axios.post(fullUrl, formDataVendas.toString(), config)
      ]);

      const produtosContent = responseProdutos.data?.QUERY?.CONTENT;
      const vendasContent = responseVendas.data?.QUERY?.CONTENT;

      const firstProduct = Array.isArray(produtosContent) ? produtosContent[0] : produtosContent;
      const firstSale = Array.isArray(vendasContent) ? vendasContent[0] : vendasContent;

      return res.json({
        success: true,
        message: 'Conexão OK! API Zanthus respondeu.',
        data: {
          products: {
            endpoint: fullUrl,
            sample: firstProduct,
            total: Array.isArray(produtosContent) ? produtosContent.length : 1
          },
          sales: {
            endpoint: fullUrl,
            sample: firstSale,
            total: Array.isArray(vendasContent) ? vendasContent.length : (vendasContent ? 1 : 0)
          }
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao conectar: ${error.message}`,
        data: {
          error: error.code || 'UNKNOWN_ERROR',
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data
        }
      });
    }
  }

  async testIntersolidConnection(req: Request, res: Response) {
    const { apiUrl, port, username, password, salesEndpoint, productsEndpoint } = req.body;

    if (!apiUrl || !salesEndpoint) {
      return res.status(400).json({
        success: false,
        message: 'URL da API e Endpoint de Vendas são obrigatórios'
      });
    }

    try {
      const axios = require('axios');

      // Monta a URL completa
      const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;

      // Pega a data de hoje no formato YYYYMMDD
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = String(hoje.getMonth() + 1).padStart(2, '0');
      const dia = String(hoje.getDate()).padStart(2, '0');
      const dataFormatada = `${ano}${mes}${dia}`; // formato YYYYMMDD

      // Adiciona parâmetros de data às URLs
      const salesUrl = `${baseUrl}${salesEndpoint}?dta_de=${dataFormatada}&dta_ate=${dataFormatada}`;
      const productsUrl = productsEndpoint ? `${baseUrl}${productsEndpoint}` : null;

      const config: any = {};

      // Adiciona autenticação Basic se tiver usuário e senha
      if (username && password) {
        config.auth = {
          username,
          password
        };
      }

      // Faz as requisições (vendas e produtos se disponível)
      const promises: any[] = [axios.get(salesUrl, config)];
      if (productsUrl) {
        promises.push(axios.get(productsUrl, config));
      }

      const responses = await Promise.all(promises);

      const sales = responses[0].data;
      const firstSale = Array.isArray(sales) ? sales[0] : sales;

      const result: any = {
        success: true,
        message: 'Conexão OK! API Intersolid respondeu.',
        data: {
          sales: {
            endpoint: salesUrl,
            sample: firstSale,
            total: Array.isArray(sales) ? sales.length : 1
          }
        }
      };

      // Adiciona dados de produtos se houver
      if (productsUrl && responses[1]) {
        const products = responses[1].data;
        const firstProduct = Array.isArray(products) ? products[0] : products;
        result.data.products = {
          endpoint: productsUrl,
          sample: firstProduct,
          total: Array.isArray(products) ? products.length : 1
        };
      }

      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao conectar: ${error.message}`,
        data: {
          error: error.code || 'UNKNOWN_ERROR',
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
          fullUrl: `${port ? `${apiUrl}:${port}` : apiUrl}${salesEndpoint}`
        }
      });
    }
  }

  async saveConfigurations(req: Request, res: Response) {
    try {
      const configurations = req.body;

      if (!configurations || typeof configurations !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Configurações inválidas'
        });
      }

      // Define quais campos devem ser criptografados
      const encryptedFields = [
        'zanthus_api_token',
        'intersolid_password',
        'evolution_api_token',
        'database_password',
        'minio_access_key',
        'minio_secret_key'
      ];

      const configsToSave: Record<string, { value: string; encrypted?: boolean }> = {};

      for (const [key, value] of Object.entries(configurations)) {
        if (value !== null && value !== undefined && value !== '') {
          configsToSave[key] = {
            value: String(value),
            encrypted: encryptedFields.includes(key)
          };
        }
      }

      await ConfigurationService.setMany(configsToSave);

      return res.json({
        success: true,
        message: 'Configurações salvas com sucesso!'
      });
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao salvar configurações: ${error.message}`
      });
    }
  }

  async getConfigurations(req: Request, res: Response) {
    try {
      const configs = await ConfigurationService.getAll();

      return res.json({
        success: true,
        data: configs
      });
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao buscar configurações: ${error.message}`
      });
    }
  }
}
