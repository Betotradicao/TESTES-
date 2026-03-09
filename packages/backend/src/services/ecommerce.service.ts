import axios from 'axios';
const cheerio = require('cheerio');

/**
 * Servico para buscar produtos em e-commerces
 * Mercado Livre: scraping do site publico (API bloqueada para IPs de datacenter)
 */
export class EcommerceService {

  /**
   * Busca produtos no Mercado Livre via scraping do site publico
   */
  static async buscarMercadoLivre(query: string, limit: number = 50): Promise<any[]> {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://lista.mercadolivre.com.br/${encoded}_OrderId_PRICE_NoIndex_True`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        timeout: 20000,
        maxRedirects: 5,
      });

      const html = response.data;
      const results = this.parseMLResults(html, limit);
      return results;
    } catch (error: any) {
      console.error('[Ecommerce] Erro Mercado Livre scraping:', error.message);
      // Fallback: tentar API direta (funciona em redes nao-datacenter)
      return this.buscarMercadoLivreAPI(query, limit);
    }
  }

  /**
   * Parse dos resultados HTML do Mercado Livre
   */
  private static parseMLResults(html: string, limit: number): any[] {
    const $ = cheerio.load(html);
    const items: any[] = [];

    // Seletor principal dos cards de produto
    $('li.ui-search-layout__item').each((idx: number, el: any) => {
      if (idx >= limit) return false;

      const $el = $(el);

      // Titulo e link - extrair do HTML do item para garantir
      const itemHtml = $.html($el);
      const hrefMatch = itemHtml.match(/href="(https:\/\/www\.mercadolivre\.com\.br\/[^"]+)"/);
      const permalink = hrefMatch ? hrefMatch[1].replace(/&amp;/g, '&') : '';
      const title = $el.find('a.poly-component__title, .ui-search-item__title, .poly-component__title, h2').first().text().trim();

      // Preco
      const priceWhole = $el.find('.andes-money-amount__fraction').first().text().replace(/\./g, '').trim();
      const priceCents = $el.find('.andes-money-amount__cents').first().text().trim();
      const price = priceWhole ? parseFloat(`${priceWhole}.${priceCents || '00'}`) : 0;

      // Preco original (com desconto)
      const $origPrice = $el.find('.andes-money-amount--previous .andes-money-amount__fraction');
      const originalPrice = $origPrice.length ? parseFloat($origPrice.text().replace(/\./g, '').trim()) : null;

      // Imagem
      const $img = $el.find('img.ui-search-result-image__element, img.poly-component__picture');
      const thumbnail = $img.attr('data-src') || $img.attr('src') || null;

      // Frete gratis
      const freeShipping = $el.find('.ui-search-item__shipping, .poly-component__shipping').text().toLowerCase().includes('gr');

      // Vendedor - buscar em todos os textos do card
      const sellerEl = $el.find('.poly-component__seller, .ui-search-official-store-label, [class*="seller"]').first();
      const seller = sellerEl.text().trim() || null;

      // Vendas e avaliações - buscar no texto completo do item
      const fullText = $el.text();
      const salesMatch = fullText.match(/(\d+[\d.]*)\s*(vendido|sold)/i);
      const soldQuantity = salesMatch ? parseInt(salesMatch[1].replace(/\./g, '')) : 0;

      // Avaliações
      const ratingMatch = fullText.match(/([\d,]+)\s*\(/);
      const rating = ratingMatch ? ratingMatch[1] : null;

      // Extrair ID do ML do link (ex: /up/MLBU3771358059#)
      const cleanUrl = permalink.split('#')[0];
      const urlParts = cleanUrl.split('/');
      const mlId = urlParts.find((p: string) => /^MLB/i.test(p)) || null;

      if (title && price > 0) {
        items.push({
          id: mlId || `ml-${idx}`,
          title,
          price,
          original_price: originalPrice,
          currency: 'BRL',
          condition: null,
          permalink: permalink.split('#')[0], // limpar tracking
          thumbnail: thumbnail ? thumbnail.replace('http://', 'https://') : null,
          seller,
          seller_reputation: null,
          rating,
          sold_quantity: soldQuantity,
          available_quantity: null,
          free_shipping: freeShipping,
          shipping: null,
          location: null,
          category_id: null,
        });
      }
    });

    return items;
  }

  /**
   * Fallback: API publica do ML (funciona em redes residenciais, bloqueada em datacenters)
   */
  private static async buscarMercadoLivreAPI(query: string, limit: number = 50): Promise<any[]> {
    try {
      const url = 'https://api.mercadolibre.com/sites/MLB/search';
      const response = await axios.get(url, {
        params: { q: query, limit, sort: 'price_asc' },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        timeout: 15000,
      });

      const results = response.data?.results || [];
      return results.map((item: any) => ({
        id: item.id,
        title: item.title,
        price: item.price || 0,
        original_price: item.original_price || null,
        currency: item.currency_id || 'BRL',
        condition: item.condition === 'new' ? 'Novo' : item.condition === 'used' ? 'Usado' : item.condition,
        permalink: item.permalink,
        thumbnail: item.thumbnail ? item.thumbnail.replace('http://', 'https://') : null,
        seller: item.seller?.nickname || null,
        seller_reputation: item.seller?.seller_reputation?.level_id || null,
        sold_quantity: item.sold_quantity || 0,
        available_quantity: item.available_quantity || 0,
        free_shipping: item.shipping?.free_shipping || false,
        shipping: null,
        location: item.seller_address?.city?.name || null,
        category_id: item.category_id || null,
      }));
    } catch (error: any) {
      console.error('[Ecommerce] API ML tambem falhou:', error.message);
      return [];
    }
  }
}
