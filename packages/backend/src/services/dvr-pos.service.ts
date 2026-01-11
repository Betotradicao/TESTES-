import * as net from 'net';
import { AppDataSource } from '../config/database';
// import { Sale } from '../entities/Sale'; // TODO: Criar entidade Sale quando necessário

interface DVRConfig {
  ip: string;
  port: number;
  enabled: boolean;
}

interface SaleItem {
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export class DVRPOSService {
  private static config: DVRConfig = {
    ip: '10.6.1.123',
    port: 38800,
    enabled: true
  };

  /**
   * Formatar cupom de venda para o padrão do DVR Intelbras
   * Delimitador: | (0x7C)
   */
  private static formatSaleToDVR(sale: any): string {
    const L = '|'; // Delimitador (pipe)

    const data = new Date(sale.dataVenda || new Date());
    const dataFormatada = data.toLocaleDateString('pt-BR');
    const horaFormatada = data.toLocaleTimeString('pt-BR');

    const linhas: string[] = [];

    // Cabeçalho
    linhas.push('========================================');
    linhas.push('      SUPERMERCADO BOM PRECO           ');
    linhas.push('========================================');
    linhas.push('CNPJ: 12.345.678/0001-99');
    linhas.push('Rua das Flores, 123 - Centro');
    linhas.push('Tel: (11) 1234-5678');
    linhas.push('========================================');
    linhas.push('');
    linhas.push(`Data: ${dataFormatada}`);
    linhas.push(`Hora: ${horaFormatada}`);
    linhas.push(`Cupom: ${sale.notaFiscalNumero || sale.id}`);
    linhas.push(`Caixa: ${sale.caixa || 'PDV 01'}`);
    linhas.push(`Operador: ${sale.operador || 'SISTEMA'}`);
    linhas.push('');
    linhas.push('========================================');
    linhas.push('            PRODUTOS                    ');
    linhas.push('========================================');
    linhas.push('');

    // Produtos
    const items: SaleItem[] = sale.items || [];
    items.forEach((item, index) => {
      const num = String(index + 1).padStart(3, '0');
      const desc = item.descricao.substring(0, 40); // Max 40 chars
      const qtd = item.quantidade.toFixed(2);
      const valor = item.valorUnitario.toFixed(2);
      const total = item.valorTotal.toFixed(2);

      linhas.push(`${num} ${desc}`);
      linhas.push(`    ${qtd} x R$ ${valor}`);
      linhas.push(`                           R$ ${total}`);
      linhas.push('');
    });

    // Totalizadores
    linhas.push('========================================');
    linhas.push(`SUBTOTAL:              R$ ${(sale.valorTotal || 0).toFixed(2)}`);

    if (sale.desconto && sale.desconto > 0) {
      linhas.push(`DESCONTO:              R$ ${sale.desconto.toFixed(2)}`);
    }

    linhas.push('========================================');
    linhas.push(`TOTAL:                 R$ ${(sale.valorFinal || sale.valorTotal || 0).toFixed(2)}`);
    linhas.push('========================================');
    linhas.push('');

    // Forma de pagamento
    if (sale.formaPagamento) {
      linhas.push('FORMA DE PAGAMENTO:');
      linhas.push(`${sale.formaPagamento.toUpperCase()}       R$ ${(sale.valorFinal || 0).toFixed(2)}`);
      linhas.push('');
    }

    // Rodapé
    linhas.push('========================================');
    linhas.push('      OBRIGADO PELA PREFERENCIA!       ');
    linhas.push('========================================');
    linhas.push('');

    // Juntar com delimitador |
    return linhas.join(L) + L;
  }

  /**
   * Enviar cupom para o DVR via TCP
   */
  static async sendToDVR(cupom: string): Promise<void> {
    if (!this.config.enabled) {
      console.log('⚠️  DVR POS desabilitado');
      return;
    }

    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(5000);

      client.connect(this.config.port, this.config.ip, () => {
        console.log(`✅ Conectado ao DVR ${this.config.ip}:${this.config.port}`);

        client.write(cupom, 'utf8', (err) => {
          if (err) {
            console.error('❌ Erro ao enviar cupom:', err.message);
            reject(err);
          } else {
            console.log('✅ Cupom enviado ao DVR com sucesso!');
            client.end();
            resolve();
          }
        });
      });

      client.on('error', (err) => {
        console.error(`❌ Erro de conexão DVR: ${err.message}`);
        reject(err);
      });

      client.on('timeout', () => {
        console.error('⏱️  Timeout na conexão com DVR');
        client.destroy();
        reject(new Error('Timeout'));
      });

      client.on('close', () => {
        console.log('🔌 Conexão com DVR fechada');
      });
    });
  }

  /**
   * Processar venda e enviar para DVR
   * Chamado automaticamente quando uma venda é registrada
   * TODO: Habilitar quando entidade Sale estiver criada
   */
  static async processSale(saleId: string): Promise<void> {
    console.log(`⚠️ DVR POS Service: Função processSale ainda não implementada (entidade Sale pendente)`);
    return;
    /*
    try {
      // Buscar venda no banco
      // const saleRepository = AppDataSource.getRepository(Sale);
      const sale = await saleRepository.findOne({
        where: { id: saleId },
        relations: ['items'] // Carregar itens da venda
      });

      if (!sale) {
        throw new Error(`Venda ${saleId} não encontrada`);
      }

      console.log(`📋 Processando venda ${saleId} para envio ao DVR...`);

      // Formatar cupom
      const cupom = this.formatSaleToDVR(sale);

      // Enviar para DVR
      await this.sendToDVR(cupom);

      console.log(`✅ Venda ${saleId} exibida no DVR com sucesso!`);

    } catch (error: any) {
      console.error(`❌ Erro ao processar venda ${saleId}:`, error.message);
      // Não propagar erro para não bloquear a venda
    }
    */
  }

  /**
   * Configurar DVR
   */
  static configure(config: Partial<DVRConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('⚙️  DVR POS configurado:', this.config);
  }

  /**
   * Testar conexão com DVR
   */
  static async testConnection(): Promise<boolean> {
    try {
      const testCupom = '===== TESTE DE CONEXAO =====|Sistema Prevencao no Radar|Teste realizado com sucesso!|================================|';
      await this.sendToDVR(testCupom);
      return true;
    } catch (error) {
      return false;
    }
  }
}
