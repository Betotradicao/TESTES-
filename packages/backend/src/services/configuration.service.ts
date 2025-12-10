import { AppDataSource } from '../config/database';
import { Configuration } from '../entities/Configuration';
import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || 'default-key-change-in-production-32bytes';
const ALGORITHM = 'aes-256-cbc';

export class ConfigurationService {
  private static configRepository = AppDataSource.getRepository(Configuration);

  /**
   * Criptografa um valor sensível
   */
  private static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Descriptografa um valor sensível
   */
  private static decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Salva ou atualiza uma configuração
   */
  static async set(key: string, value: string, encrypted: boolean = false): Promise<Configuration> {
    const valueToStore = encrypted ? this.encrypt(value) : value;

    let config = await this.configRepository.findOne({ where: { key } });

    if (config) {
      config.value = valueToStore;
      config.encrypted = encrypted;
    } else {
      config = this.configRepository.create({
        key,
        value: valueToStore,
        encrypted
      });
    }

    return await this.configRepository.save(config);
  }

  /**
   * Busca uma configuração
   */
  static async get(key: string, defaultValue: string | null = null): Promise<string | null> {
    const config = await this.configRepository.findOne({ where: { key } });

    if (!config || config.value === null) {
      return defaultValue;
    }

    return config.encrypted ? this.decrypt(config.value) : config.value;
  }

  /**
   * Busca todas as configurações
   */
  static async getAll(): Promise<Record<string, any>> {
    const configs = await this.configRepository.find();
    const result: Record<string, any> = {};

    for (const config of configs) {
      if (config.value !== null) {
        result[config.key] = config.encrypted ? this.decrypt(config.value) : config.value;
      }
    }

    return result;
  }

  /**
   * Salva múltiplas configurações de uma vez
   */
  static async setMany(configs: Record<string, { value: string; encrypted?: boolean }>): Promise<void> {
    for (const [key, data] of Object.entries(configs)) {
      await this.set(key, data.value, data.encrypted || false);
    }
  }

  /**
   * Deleta uma configuração
   */
  static async delete(key: string): Promise<boolean> {
    const result = await this.configRepository.delete({ key });
    return (result.affected || 0) > 0;
  }

  /**
   * Verifica se uma configuração existe
   */
  static async has(key: string): Promise<boolean> {
    const count = await this.configRepository.count({ where: { key } });
    return count > 0;
  }
}
