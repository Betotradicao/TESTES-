import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { BankAccount } from '../entities/BankAccount';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as tls from 'tls';
import { execSync } from 'child_process';

const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || 'default-key-change-in-production-32bytes';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return text; // Se não conseguir decriptar, retorna o texto original (não encriptado)
  }
}

const MASKED = '********';
const SENSITIVE_FIELDS = ['client_id', 'client_secret', 'pfx_password'] as const;

function sanitizeForResponse(bank: BankAccount): any {
  const result: any = { ...bank };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field]) {
      result[field] = MASKED;
    }
  }
  return result;
}

interface AuthRequest extends Request {
  user?: any;
  file?: Express.Multer.File;
  [key: string]: any;
}

export class BankAccountsController {
  /**
   * Listar todos os bancos cadastrados (campos sensíveis mascarados)
   */
  static async getAll(req: any, res: Response) {
    try {
      const repo = AppDataSource.getRepository(BankAccount);
      const banks = await repo.find({ order: { created_at: 'ASC' } });
      res.json({ success: true, data: banks.map(sanitizeForResponse) });
    } catch (error) {
      console.error('❌ Erro ao listar bancos:', error);
      res.status(500).json({ error: 'Erro ao listar bancos cadastrados' });
    }
  }

  /**
   * Buscar um banco por ID
   */
  static async getById(req: any, res: Response) {
    try {
      const repo = AppDataSource.getRepository(BankAccount);
      const bank = await repo.findOne({ where: { id: req.params.id } });
      if (!bank) return res.status(404).json({ error: 'Banco não encontrado' });
      res.json({ success: true, data: sanitizeForResponse(bank) });
    } catch (error) {
      console.error('❌ Erro ao buscar banco:', error);
      res.status(500).json({ error: 'Erro ao buscar banco' });
    }
  }

  /**
   * Criar novo banco
   */
  static async create(req: any, res: Response) {
    try {
      const { nome, tipo_banco, cnpj, agencia, conta, client_id, client_secret, pfx_password, environment } = req.body;

      if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

      const repo = AppDataSource.getRepository(BankAccount);
      const bank = new BankAccount();
      bank.nome = nome;
      bank.tipo_banco = tipo_banco || 'santander';
      bank.cnpj = cnpj || '';
      bank.agencia = agencia || '';
      bank.conta = conta || '';
      bank.client_id = client_id ? encrypt(client_id) : '';
      bank.client_secret = client_secret ? encrypt(client_secret) : '';
      bank.pfx_password = pfx_password ? encrypt(pfx_password) : '';
      bank.environment = environment || 'production';
      bank.ativo = true;

      const saved = await repo.save(bank);
      console.log(`✅ Banco cadastrado: ${saved.nome} (${saved.id})`);
      res.json({ success: true, data: sanitizeForResponse(saved) });
    } catch (error) {
      console.error('❌ Erro ao criar banco:', error);
      res.status(500).json({ error: 'Erro ao cadastrar banco' });
    }
  }

  /**
   * Atualizar banco existente
   */
  static async update(req: any, res: Response) {
    try {
      const repo = AppDataSource.getRepository(BankAccount);
      const bank = await repo.findOne({ where: { id: req.params.id } });
      if (!bank) return res.status(404).json({ error: 'Banco não encontrado' });

      const { nome, tipo_banco, cnpj, agencia, conta, client_id, client_secret, pfx_password, environment, ativo } = req.body;

      if (nome !== undefined) bank.nome = nome;
      if (tipo_banco !== undefined) bank.tipo_banco = tipo_banco;
      if (cnpj !== undefined) bank.cnpj = cnpj;
      if (agencia !== undefined) bank.agencia = agencia;
      if (conta !== undefined) bank.conta = conta;
      if (environment !== undefined) bank.environment = environment;
      if (ativo !== undefined) bank.ativo = ativo;

      // Campos sensíveis: só atualizar se o valor NÃO for a máscara e NÃO for vazio
      if (client_id && client_id !== MASKED) {
        bank.client_id = encrypt(client_id);
      }
      if (client_secret && client_secret !== MASKED) {
        bank.client_secret = encrypt(client_secret);
      }
      if (pfx_password && pfx_password !== MASKED) {
        bank.pfx_password = encrypt(pfx_password);
      }

      const saved = await repo.save(bank);
      console.log(`✅ Banco atualizado: ${saved.nome} (${saved.id})`);
      res.json({ success: true, data: sanitizeForResponse(saved) });
    } catch (error) {
      console.error('❌ Erro ao atualizar banco:', error);
      res.status(500).json({ error: 'Erro ao atualizar banco' });
    }
  }

  /**
   * Excluir banco
   */
  static async delete(req: any, res: Response) {
    try {
      const repo = AppDataSource.getRepository(BankAccount);
      const bank = await repo.findOne({ where: { id: req.params.id } });
      if (!bank) return res.status(404).json({ error: 'Banco não encontrado' });

      // Deletar certificado se existir
      if (bank.certificate_path) {
        const certPath = path.join(process.cwd(), bank.certificate_path);
        if (fs.existsSync(certPath)) {
          fs.unlinkSync(certPath);
        }
      }

      await repo.remove(bank);
      console.log(`🗑️ Banco removido: ${bank.nome}`);
      res.json({ success: true, message: 'Banco removido com sucesso' });
    } catch (error) {
      console.error('❌ Erro ao excluir banco:', error);
      res.status(500).json({ error: 'Erro ao excluir banco' });
    }
  }

  /**
   * Upload de certificado PFX
   */
  static async uploadCertificate(req: any, res: Response) {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

      const repo = AppDataSource.getRepository(BankAccount);
      const bank = await repo.findOne({ where: { id: req.params.id } });
      if (!bank) return res.status(404).json({ error: 'Banco não encontrado' });

      // Salvar certificado
      const certsDir = path.join(process.cwd(), 'certificates');
      if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir, { recursive: true });
      }

      const fileName = `bank_${bank.id}.pfx`;
      const filePath = path.join(certsDir, fileName);

      // Deletar antigo se existir
      if (bank.certificate_path) {
        const oldPath = path.join(process.cwd(), bank.certificate_path);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Salvar arquivo original temporariamente
      fs.writeFileSync(filePath, file.buffer);

      // Salvar senha do PFX se enviada junto
      const pfxPassword = req.body?.pfx_password;
      if (pfxPassword) {
        bank.pfx_password = encrypt(pfxPassword);
      }

      // Tentar carregar o PFX - se for formato legacy, converter automaticamente
      const password = pfxPassword || (bank.pfx_password ? decrypt(bank.pfx_password) : '');
      const convertResult = BankAccountsController.ensurePfxCompatible(filePath, password);

      bank.certificate_path = `certificates/${fileName}`;
      await repo.save(bank);

      const msg = convertResult.converted
        ? 'Certificado convertido para formato moderno e salvo com sucesso'
        : 'Certificado e senha salvos com sucesso';
      console.log(`📜 Certificado salvo para banco ${bank.nome}: ${bank.certificate_path} ${convertResult.converted ? '(convertido)' : ''}`);
      res.json({ success: true, message: msg, certificate_path: bank.certificate_path });
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload de certificado:', error);
      const msg = error.message || 'Erro desconhecido';
      res.status(500).json({ error: `Erro ao enviar certificado: ${msg}` });
    }
  }

  /**
   * Testar conexão com o banco
   */
  static async testConnection(req: any, res: Response) {
    try {
      const repo = AppDataSource.getRepository(BankAccount);
      const bank = await repo.findOne({ where: { id: req.params.id } });
      if (!bank) return res.status(404).json({ error: 'Banco não encontrado' });

      if (!bank.client_id || !bank.client_secret) {
        return res.status(400).json({ error: 'Client ID e Client Secret são obrigatórios para testar' });
      }

      if (!bank.certificate_path) {
        return res.status(400).json({ error: 'Certificado PFX é obrigatório para testar' });
      }

      const certPath = path.join(process.cwd(), bank.certificate_path);
      if (!fs.existsSync(certPath)) {
        return res.status(400).json({ error: 'Certificado PFX não encontrado no servidor' });
      }

      // Tentar obter token via SantanderService
      const { SantanderService } = await import('../services/santander.service');
      const token = await SantanderService.getTokenForBank(bank.id);

      res.json({ success: true, message: 'Conexão bem sucedida! Token obtido.' });
    } catch (error: any) {
      console.error('❌ Erro ao testar conexão:', error);
      res.status(400).json({ error: `Falha na conexão: ${error.message}` });
    }
  }

  /**
   * Garante que o PFX é compatível com OpenSSL 3.x (Node.js moderno).
   * Se for formato legacy (RC2/3DES), converte automaticamente usando openssl CLI.
   */
  static ensurePfxCompatible(filePath: string, password: string): { compatible: boolean; converted: boolean } {
    // 1) Tenta carregar direto no Node.js
    try {
      const pfxBuffer = fs.readFileSync(filePath);
      tls.createSecureContext({ pfx: pfxBuffer, passphrase: password });
      return { compatible: true, converted: false };
    } catch (e: any) {
      console.log(`⚠️ PFX incompatível (${e.message}), tentando converter...`);
    }

    // 2) Converter via openssl: extract com -legacy e re-export com algoritmo moderno
    try {
      const tempPem = filePath + '.tmp.pem';
      const tempPfx = filePath + '.tmp.pfx';
      // No Windows, execSync usa cmd.exe que não entende aspas simples
      const escapedPass = password.replace(/"/g, '\\"');

      // Extrair PEM (com -legacy para aceitar formatos antigos)
      execSync(
        `openssl pkcs12 -in "${filePath}" -out "${tempPem}" -nodes -passin pass:${escapedPass} -legacy`,
        { stdio: 'pipe', timeout: 15000 }
      );

      // Re-exportar como PFX moderno
      execSync(
        `openssl pkcs12 -export -in "${tempPem}" -out "${tempPfx}" -passout pass:${escapedPass}`,
        { stdio: 'pipe', timeout: 15000 }
      );

      // Substituir original pelo convertido
      fs.copyFileSync(tempPfx, filePath);

      // Limpar temporários
      if (fs.existsSync(tempPem)) fs.unlinkSync(tempPem);
      if (fs.existsSync(tempPfx)) fs.unlinkSync(tempPfx);

      // Verificar se agora funciona
      const pfxBuffer = fs.readFileSync(filePath);
      tls.createSecureContext({ pfx: pfxBuffer, passphrase: password });

      console.log(`✅ PFX convertido para formato moderno com sucesso`);
      return { compatible: true, converted: true };
    } catch (convErr: any) {
      console.error(`❌ Falha ao converter PFX:`, convErr.message);
      throw new Error(`Certificado PFX incompatível e não foi possível converter automaticamente: ${convErr.message}`);
    }
  }

  /**
   * Decripta campos sensíveis de um BankAccount (uso interno, NÃO expor na API)
   */
  static decryptSensitiveFields(bank: BankAccount): { clientId: string; clientSecret: string; pfxPassword: string } {
    return {
      clientId: bank.client_id ? decrypt(bank.client_id) : '',
      clientSecret: bank.client_secret ? decrypt(bank.client_secret) : '',
      pfxPassword: bank.pfx_password ? decrypt(bank.pfx_password) : '',
    };
  }
}
