import { AppDataSource } from '../config/database';
import { Bip } from '../entities/Bip';
import axios from 'axios';

export class CheckLastBipCommand {
  /**
   * Verifica a última bipagem e envia alerta se necessário
   * Funciona apenas entre 7h30 e 21h30 (horário de São Paulo)
   */
  static async execute(): Promise<void> {
    console.log('🔍 Verificando última bipagem...');

    // Verificar horário de São Paulo
    const agora = new Date();
    const horaSaoPaulo = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hora = horaSaoPaulo.getHours();
    const minutos = horaSaoPaulo.getMinutes();
    const horaAtual = hora + (minutos / 60); // Hora decimal (ex: 7.5 = 7h30)

    // Verificar se está dentro do horário permitido (7h30 às 21h30)
    const horaInicio = 7.5;  // 7h30
    const horaFim = 21.5;     // 21h30

    if (horaAtual < horaInicio || horaAtual > horaFim) {
      console.log(`⏰ Fora do horário de monitoramento (${hora}:${minutos.toString().padStart(2, '0')} São Paulo)`);
      console.log(`📋 Monitoramento ativo apenas das 07:30 às 21:30 (São Paulo)`);
      return;
    }

    console.log(`⏰ Horário atual: ${hora}:${minutos.toString().padStart(2, '0')} (São Paulo)`);

    try {
      // Inicializar conexão com banco se necessário
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        AppDataSource.setOptions({ logging: false }); // Desabilitar logs SQL
      }

      // Buscar a última bipagem por event_date usando query raw para evitar problemas de timezone
      const result = await AppDataSource.query(`
        SELECT *
        FROM bips
        ORDER BY event_date DESC
        LIMIT 1
      `);

      const lastBip = result[0];

      if (!lastBip) {
        console.log('⚠️  Nenhuma bipagem encontrada no sistema');
        await this.sendAlert('Nenhuma bipagem encontrada no sistema.');
        return;
      }

      // Usar o cálculo direto do banco que é mais confiável
      const lastBipDate = new Date(lastBip.event_date);
      const now = new Date();

      // Calcular: lastBipDate + 60 minutos
      const lastBipPlusOneHour = new Date(lastBipDate.getTime() + (60 * 60 * 1000));

      // Calcular: now - 3 horas
      const nowMinusThreeHours = new Date(now.getTime() - (3 * 60 * 60 * 1000));

      console.log(`📅 Última bipagem: ${lastBipDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      console.log(`🕐 Horário atual: ${now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      console.log(`📊 Última bipagem + 1h: ${lastBipPlusOneHour.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      console.log(`🕐 Agora - 3h: ${nowMinusThreeHours.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

      // Se lastBipDate + 60min > now - 3h, não fazer nada
      // Senão, notificar
      if (lastBipPlusOneHour > nowMinusThreeHours) {
        console.log('✅ Sistema funcionando normalmente. Última bipagem dentro do período aceitável.');
      } else {
        console.log('🚨 ALERTA: Mais de 1 hora sem novas bipagens!');
        await this.sendAlert();
        console.log('✅ Alerta enviado com sucesso');
      }

    } catch (error) {
      console.error('❌ Erro ao verificar última bipagem:', error);
      throw error;
    } finally {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
    }
  }

  /**
   * Envia alerta via WhatsApp
   */
  private static async sendAlert(customMessage?: string): Promise<void> {
    const message = customMessage || `🚨 Atenção

Já faz mais de 1 hora que não recebemos novas bipagens no sistema.

Isso pode estar acontecendo por alguns motivos comuns:

📡 Falta de conexão com a internet
💻 Computador desligado
🔧 Serviço de envio de bipagens pode estar offline

👉 Recomendamos verificar esses pontos para garantir que o envio volte ao normal.`;

    try {
      const evolutionApiUrl = process.env.EVOLUTION_API_URL;
      const evolutionApiToken = process.env.EVOLUTION_API_TOKEN;
      const evolutionInstance = process.env.EVOLUTION_INSTANCE;
      const whatsappGroupId = process.env.PREVENCAO_WHATSAPP_GROUP_ID;

      if (!evolutionApiUrl || !evolutionApiToken || !evolutionInstance || !whatsappGroupId) {
        console.error('❌ Configurações da Evolution API não encontradas');
        return;
      }

      const url = `${evolutionApiUrl}/message/sendText/${evolutionInstance}`;

      const payload = {
        number: whatsappGroupId,
        text: message,
        delay: 1000
      };

      await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiToken
        }
      });

      console.log('📱 Alerta enviado para o WhatsApp');
    } catch (error) {
      console.error('❌ Erro ao enviar alerta WhatsApp:', error);
      // Não lançar erro para não interromper o fluxo principal
    }
  }
}

// Executar o comando se chamado diretamente
if (require.main === module) {
  CheckLastBipCommand.execute()
    .then(() => {
      console.log('✅ Verificação concluída');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na execução:', error);
      process.exit(1);
    });
}