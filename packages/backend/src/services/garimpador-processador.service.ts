import { AppDataSource } from '../config/database';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';
import { ConfigurationService } from './configuration.service';
import axios from 'axios';

// Prompts default - usados se nao houver configuracao customizada
const DEFAULT_PROMPT_EXTRACAO_IMAGEM = `Voce e um extrator de dados de ofertas de supermercado. Analise a imagem e extraia TODOS os produtos e precos visiveis.

REGRAS CRITICAS DE EXTRACAO:
- SEMPRE inclua a MARCA do produto (ex: LIZA, SKOL, YPE, SADIA, COCA-COLA). Se a marca aparece no logo, embalagem ou texto do encarte, INCLUA.
- SEMPRE inclua o VOLUME ou GRAMATURA (ex: 900ML, 350ML, 500G, 1KG, 1L, 2L).
- SEMPRE inclua o tipo de EMBALAGEM se visivel (PET, LATA, LT, CX, GARRAFA, SACHE, PACK).
- SEMPRE inclua o TIPO do produto (ex: OLEO DE SOJA, CERVEJA, DETERGENTE, LEITE).
- Formato do campo "produto": MARCA + TIPO + EMBALAGEM + VOLUME (ex: "LIZA OLEO DE SOJA PET 900ML", "SKOL CERVEJA LATA 350ML", "YPE DETERGENTE LIQUIDO 500ML").
- Se a marca nao estiver visivel, descreva o produto sem marca mas mantenha tipo+volume.

IMPORTANTE sobre CONDICOES DE PRECO:
Muitos encartes tem precos diferentes por condicao de pagamento. Exemplos:
- Preco normal: 6,79
- Cliente APP: 6,49
- Cartao da loja: 6,29
- Atacado (acima de X unidades): 5,99

Quando um produto tiver MULTIPLOS precos/condicoes, use o MENOR preco como "preco" principal e liste TODAS as condicoes no campo "condicoes".

Retorne APENAS um JSON array no formato:
[{"produto": "LIZA OLEO DE SOJA PET 900ML", "preco": 5.99, "condicoes": [{"tipo": "Normal", "preco": 6.79}, {"tipo": "Cliente APP", "preco": 6.49}, {"tipo": "Cartao Loja", "preco": 5.99}]}]

Se o produto tiver apenas UM preco (sem condicoes), retorne sem o campo condicoes:
[{"produto": "SKOL CERVEJA LATA 350ML PILSEN", "preco": 2.49}]

Se nao conseguir identificar produtos/precos, retorne [].
Nao inclua explicacoes, apenas o JSON.`;

const DEFAULT_PROMPT_EXTRACAO_PDF = `Voce e um extrator de dados de ofertas de supermercado. Analise o texto abaixo (extraido de um PDF) e extraia TODOS os produtos e precos.

REGRAS CRITICAS: Para cada produto, SEMPRE inclua a MARCA, TIPO, VOLUME/GRAMATURA e EMBALAGEM quando disponiveis.
Formato: "MARCA TIPO EMBALAGEM VOLUME" (ex: "LIZA OLEO DE SOJA PET 900ML", "SKOL CERVEJA LATA 350ML").

Retorne APENAS um JSON array no formato: [{"produto": "MARCA TIPO VOLUME", "preco": 9.99}]
Se nao conseguir identificar produtos/precos, retorne [].`;

const DEFAULT_PROMPT_EXTRACAO_TEXTO = `Voce e um extrator de dados de ofertas de supermercado. Analise o texto da mensagem e extraia TODOS os produtos e precos.

Para cada produto identificado, crie uma string de resumo. Identifique informacoes comuns a varios produtos (como marca, preco, volume ou condicoes) e aplique a CADA produto.

Na string de cada produto, inclua APENAS as informacoes encontradas separando com " | ": [Nome] | [Marca] | [Tipo] | [Volume] | [Preco] | [Condicao].

Retorne APENAS um JSON array no formato: [{"produto": "MARCA TIPO VOLUME", "preco": 9.99}]
Se nao conseguir identificar produtos/precos, retorne [].`;

/**
 * Service responsavel por processar mensagens do Garimpador.
 * Extrai produtos e precos de textos, imagens, PDFs e Excel.
 */
export class GarimpadorProcessadorService {

  /**
   * Processa uma mensagem: extrai dados e salva conteudo_extraido
   */
  static async processarMensagem(mensagem: GarimpadorMensagem): Promise<string | null> {
    try {
      let extraido: string | null = null;

      switch (mensagem.tipo_midia) {
        case 'texto':
          extraido = this.processarTexto(mensagem.conteudo_original);
          break;

        case 'imagem':
          const processarImagens = await ConfigurationService.get('garimpador_processar_imagens', 'true');
          if (processarImagens === 'false') {
            console.log('[Garimpador Processador] Processamento de imagens desabilitado');
            break;
          }
          extraido = await this.processarImagem(mensagem.media_url, mensagem.conteudo_original);
          break;

        case 'documento':
          if (mensagem.media_mimetype?.includes('pdf')) {
            const processarPdf = await ConfigurationService.get('garimpador_processar_pdf', 'true');
            if (processarPdf === 'false') break;
            extraido = await this.processarPDF(mensagem.media_url);
          } else if (
            mensagem.media_mimetype?.includes('spreadsheet') ||
            mensagem.media_mimetype?.includes('excel') ||
            mensagem.media_mimetype?.includes('xlsx') ||
            mensagem.media_mimetype?.includes('xls') ||
            mensagem.conteudo_original?.match(/\.(xlsx?|csv)$/i)
          ) {
            const processarExcel = await ConfigurationService.get('garimpador_processar_excel', 'true');
            if (processarExcel === 'false') break;
            extraido = await this.processarExcel(mensagem.media_url);
          }
          break;
      }

      // Salvar resultado
      const repo = AppDataSource.getRepository(GarimpadorMensagem);
      await repo.update(mensagem.id, {
        conteudo_extraido: extraido,
        processado: true,
      });

      console.log(`[Garimpador Processador] Mensagem ${mensagem.id} processada: ${extraido ? 'dados extraidos' : 'sem dados'}`);
      return extraido;
    } catch (error: any) {
      console.error(`[Garimpador Processador] Erro ao processar mensagem ${mensagem.id}:`, error.message);
      // Marca como processado mesmo com erro para nao ficar tentando infinitamente
      const repo = AppDataSource.getRepository(GarimpadorMensagem);
      await repo.update(mensagem.id, { processado: true });
      return null;
    }
  }

  /**
   * Processa todas as mensagens nao processadas
   */
  static async processarMensagensNaoProcessadas(): Promise<{ total: number; processadas: number; comDados: number }> {
    const repo = AppDataSource.getRepository(GarimpadorMensagem);
    const mensagens = await repo.find({
      where: { processado: false },
      order: { received_at: 'ASC' },
      take: 50,
    });

    let processadas = 0;
    let comDados = 0;

    for (const msg of mensagens) {
      const resultado = await this.processarMensagem(msg);
      processadas++;
      if (resultado) comDados++;
    }

    return { total: mensagens.length, processadas, comDados };
  }

  /**
   * Extrai produtos e precos de texto usando regex
   */
  static processarTexto(texto: string | null): string | null {
    if (!texto || texto.trim().length < 3) return null;

    const linhas = texto.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    const produtos: Array<{ produto: string; preco: number; linha: string }> = [];

    for (const linha of linhas) {
      // Pattern: captura descricao do produto + valor numerico
      // Exemplos:
      //   "Cerveja Skol lt 350ml R$ 2,49"
      //   "Arroz tipo 1 5kg - 18,90"
      //   "Oleo soja liza 900ml 6.99"
      //   "COCA COLA 2L     4,99"
      //   "Leite integral 1L R$5,49"
      const match = linha.match(
        /^(.+?)\s*(?:R\$\s*|r\$\s*|-\s*)?(\d{1,6}[.,]\d{1,2})\s*$/
      );

      if (match) {
        const descProduto = match[1].replace(/[-–—:]+\s*$/, '').trim();
        const precoStr = match[2].replace(',', '.');
        const preco = parseFloat(precoStr);

        if (descProduto.length >= 3 && preco > 0 && preco < 100000) {
          produtos.push({ produto: descProduto, preco, linha });
        }
      }
    }

    if (produtos.length === 0) {
      // Tenta buscar precos espalhados no texto (ex: "cerveja skol 2,49 arroz 18,90")
      const precoPattern = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\d./]+?)\s+(?:R\$\s*)?(\d{1,6}[.,]\d{1,2})/gi;
      let m;
      while ((m = precoPattern.exec(texto)) !== null) {
        const descProduto = m[1].trim();
        const precoStr = m[2].replace(',', '.');
        const preco = parseFloat(precoStr);
        if (descProduto.length >= 3 && preco > 0 && preco < 100000) {
          produtos.push({ produto: descProduto, preco, linha: m[0] });
        }
      }
    }

    if (produtos.length === 0) return null;

    // Retornar JSON dos produtos encontrados
    return JSON.stringify(produtos.map(p => ({
      produto: p.produto,
      preco: p.preco,
    })));
  }

  /**
   * Usa GPT Vision para extrair produtos e precos de imagens (encartes, tabelas)
   */
  static async processarImagem(mediaUrl: string | null, caption: string | null): Promise<string | null> {
    if (!mediaUrl) return null;

    const apiKey = await ConfigurationService.get('openai_api_key');
    const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');

    if (!apiKey) {
      console.log('[Garimpador Processador] API key OpenAI nao configurada');
      return null;
    }

    try {
      // Ler prompt customizado ou usar default
      const promptImagem = (await ConfigurationService.get('garimpador_prompt_extracao_imagem')) || DEFAULT_PROMPT_EXTRACAO_IMAGEM;

      const messages: any[] = [
        {
          role: 'system',
          content: promptImagem
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: mediaUrl, detail: 'high' }
            },
            ...(caption ? [{ type: 'text', text: `Legenda da imagem: ${caption}` }] : [])
          ]
        }
      ];

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model || 'gpt-4o-mini',
          messages,
          temperature: 0.1,
          max_tokens: 4000,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const content = response.data.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      // Tentar extrair JSON da resposta
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return JSON.stringify(parsed);
        }
      }

      return null;
    } catch (error: any) {
      console.error('[Garimpador Processador] Erro GPT Vision:', error.message);
      if (error.response?.data) {
        console.error('[Garimpador Processador] Detalhes erro:', JSON.stringify(error.response.data));
      }
      console.error('[Garimpador Processador] Modelo usado:', model, '| URL imagem:', mediaUrl?.substring(0, 80));
      return null;
    }
  }

  /**
   * Extrai texto de PDF e busca produtos/precos
   */
  static async processarPDF(mediaUrl: string | null): Promise<string | null> {
    if (!mediaUrl) return null;

    try {
      // Baixar o PDF
      const response = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(response.data);

      // Extrair texto com pdf-parse
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      const texto = data.text;

      if (!texto || texto.trim().length < 5) return null;

      // Primeiro tenta regex
      const regexResult = this.processarTexto(texto);
      if (regexResult) return regexResult;

      // Se regex nao encontrou, tenta GPT
      const apiKey = await ConfigurationService.get('openai_api_key');
      const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');

      if (!apiKey) return null;

      // Ler prompt customizado ou usar default
      const promptPdf = (await ConfigurationService.get('garimpador_prompt_extracao_pdf')) || DEFAULT_PROMPT_EXTRACAO_PDF;

      const gptResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: promptPdf
            },
            { role: 'user', content: texto.substring(0, 10000) }
          ],
          temperature: 0.1,
          max_tokens: 4000,
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );

      const content = gptResponse.data.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return JSON.stringify(parsed);
        }
      }

      return null;
    } catch (error: any) {
      console.error('[Garimpador Processador] Erro ao processar PDF:', error.message);
      return null;
    }
  }

  /**
   * Extrai dados de planilhas Excel
   */
  static async processarExcel(mediaUrl: string | null): Promise<string | null> {
    if (!mediaUrl) return null;

    try {
      // Baixar o arquivo
      const response = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(response.data);

      // Ler com xlsx
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const produtos: Array<{ produto: string; preco: number }> = [];

      // Percorrer todas as sheets
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Detectar colunas de produto e preco
        let colProduto = -1;
        let colPreco = -1;

        // Tenta encontrar pelo header
        if (rows.length > 0) {
          const header = rows[0].map((c: any) => String(c).toLowerCase().trim());
          for (let i = 0; i < header.length; i++) {
            if (header[i].match(/produto|descri|item|mercadoria|nome/)) colProduto = i;
            if (header[i].match(/pre[cç]o|valor|custo|r\$|vl/)) colPreco = i;
          }
        }

        // Se encontrou headers, usa as colunas detectadas
        const startRow = (colProduto >= 0 || colPreco >= 0) ? 1 : 0;

        // Se nao encontrou headers, assume primeira coluna = produto, segunda ou ultima = preco
        if (colProduto < 0) colProduto = 0;
        if (colPreco < 0) {
          // Procura a primeira coluna numerica
          for (let row = startRow; row < Math.min(rows.length, startRow + 5); row++) {
            for (let col = 1; col < rows[row].length; col++) {
              const val = String(rows[row][col]).replace(',', '.');
              if (!isNaN(parseFloat(val)) && parseFloat(val) > 0) {
                colPreco = col;
                break;
              }
            }
            if (colPreco >= 0) break;
          }
          if (colPreco < 0) colPreco = 1;
        }

        // Extrair dados
        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const descProduto = String(row[colProduto] || '').trim();
          const precoRaw = String(row[colPreco] || '').replace(',', '.').replace(/[^\d.]/g, '');
          const preco = parseFloat(precoRaw);

          if (descProduto.length >= 3 && preco > 0 && preco < 100000) {
            produtos.push({ produto: descProduto, preco });
          }
        }
      }

      if (produtos.length === 0) return null;

      return JSON.stringify(produtos);
    } catch (error: any) {
      console.error('[Garimpador Processador] Erro ao processar Excel:', error.message);
      return null;
    }
  }
}
