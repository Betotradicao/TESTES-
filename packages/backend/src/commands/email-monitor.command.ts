import { AppDataSource } from '../config/database';
import { EmailMonitorService } from '../services/email-monitor.service';

export class EmailMonitorCommand {
  /**
   * Verifica novos emails de DVR e processa
   */
  static async execute(): Promise<void> {
    console.log('📧 Verificando emails de DVR...');

    try {
      // Inicializar conexão com banco se necessário
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        AppDataSource.setOptions({ logging: false }); // Desabilitar logs SQL
      }

      // Verificar novos emails
      await EmailMonitorService.checkNewEmails();

      console.log('✅ Verificação de emails concluída');

    } catch (error) {
      console.error('❌ Erro ao verificar emails:', error);
      throw error;
    } finally {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
    }
  }
}

// Executar o comando se chamado diretamente
if (require.main === module) {
  EmailMonitorCommand.execute()
    .then(() => {
      console.log('✅ Comando de email monitor concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na execução:', error);
      process.exit(1);
    });
}
