import axios from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { SantanderService } from './santander.service';

interface WorkspaceCache {
  workspaceId: string;
  expiresAt: number;
}

export class DDAService {
  private static workspaceCaches: Map<string, WorkspaceCache> = new Map();

  /**
   * Cria httpsAgent com mTLS a partir do certificado do banco
   */
  private static createHttpsAgent(certPath: string, pfxPassword: string): https.Agent {
    const fullPath = path.join(process.cwd(), certPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Certificado PFX não encontrado: ${fullPath}`);
    }
    let pfxBuffer = fs.readFileSync(fullPath);

    try {
      const tls = require('tls');
      tls.createSecureContext({ pfx: pfxBuffer, passphrase: pfxPassword });
    } catch (e: any) {
      console.log(`⚠️ PFX legacy detectado (${e.message}), convertendo...`);
      try {
        const { execSync } = require('child_process');
        const tempPem = fullPath + '.tmp.pem';
        const tempPfx = fullPath + '.tmp.pfx';
        const escapedPass = pfxPassword.replace(/"/g, '\\"');
        execSync(`openssl pkcs12 -in "${fullPath}" -out "${tempPem}" -nodes -passin pass:${escapedPass} -legacy`, { stdio: 'pipe', timeout: 15000 });
        execSync(`openssl pkcs12 -export -in "${tempPem}" -out "${tempPfx}" -passout pass:${escapedPass}`, { stdio: 'pipe', timeout: 15000 });
        const { copyFileSync, unlinkSync, existsSync } = require('fs');
        copyFileSync(tempPfx, fullPath);
        if (existsSync(tempPem)) unlinkSync(tempPem);
        if (existsSync(tempPfx)) unlinkSync(tempPfx);
        pfxBuffer = fs.readFileSync(fullPath);
        console.log(`✅ PFX convertido para formato moderno`);
      } catch (convErr: any) {
        throw new Error(`PFX incompatível e conversão falhou: ${convErr.message}`);
      }
    }

    return new https.Agent({ pfx: pfxBuffer, passphrase: pfxPassword, rejectUnauthorized: true });
  }

  /**
   * Busca ou cria workspace para o banco
   * O workspace é necessário para acessar DDA
   */
  static async getOrCreateWorkspace(bankId: string): Promise<string> {
    // Check cache (1 hora)
    const cached = this.workspaceCaches.get(bankId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.workspaceId;
    }

    // Check banco no DB (coluna workspace_id)
    const { AppDataSource } = await import('../config/database');
    const { BankAccount } = await import('../entities/BankAccount');
    const repo = AppDataSource.getRepository(BankAccount);
    const bank = await repo.findOne({ where: { id: bankId } });

    if (!bank) throw new Error(`Banco ${bankId} não encontrado`);

    // Se já tem workspace salvo, validar se ainda existe
    if ((bank as any).workspace_id) {
      try {
        const config = await SantanderService.getConfigByBankId(bankId);
        const token = await SantanderService.getTokenForBank(bankId);
        const baseUrl = config.environment === 'sandbox'
          ? 'https://trust-sandbox.api.santander.com.br'
          : 'https://trust-open.api.santander.com.br';
        const agent = this.createHttpsAgent(config.certificatePath!, config.pfxPassword);

        const response = await axios.get(
          `${baseUrl}/management_payments_partners/v1/workspaces/${(bank as any).workspace_id}`,
          {
            httpsAgent: agent,
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Application-Key': config.clientId,
              'Accept': 'application/json'
            }
          }
        );

        if (response.status === 200) {
          this.workspaceCaches.set(bankId, { workspaceId: (bank as any).workspace_id, expiresAt: Date.now() + 3600000 });
          return (bank as any).workspace_id;
        }
      } catch (e: any) {
        console.log(`[DDA] Workspace salvo inválido para ${bank.nome}, buscando...`);
      }
    }

    // Buscar workspaces existentes
    const config = await SantanderService.getConfigByBankId(bankId);
    const token = await SantanderService.getTokenForBank(bankId);
    const baseUrl = config.environment === 'sandbox'
      ? 'https://trust-sandbox.api.santander.com.br'
      : 'https://trust-open.api.santander.com.br';
    const agent = this.createHttpsAgent(config.certificatePath!, config.pfxPassword);

    try {
      const listResponse = await axios.get(
        `${baseUrl}/management_payments_partners/v1/workspaces`,
        {
          httpsAgent: agent,
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Application-Key': config.clientId,
            'Accept': 'application/json'
          }
        }
      );

      const workspaces = listResponse.data?.content || [];
      // Buscar workspace ativo do tipo PAYMENTS com DDA habilitado
      const existing = workspaces.find((ws: any) =>
        ws.status === 'ACTIVE' && ws.type === 'PAYMENTS' && ws.bankSlipAvailableActive === true
      );

      if (existing) {
        console.log(`[DDA] Workspace existente encontrado: ${existing.id} (${bank.nome})`);
        await repo.update(bankId, { workspace_id: existing.id } as any);
        this.workspaceCaches.set(bankId, { workspaceId: existing.id, expiresAt: Date.now() + 3600000 });
        return existing.id;
      }
    } catch (e: any) {
      console.log(`[DDA] Erro ao listar workspaces: ${e.message}`);
    }

    // Criar workspace novo
    console.log(`[DDA] Criando workspace para ${bank.nome}...`);
    const wsBody = {
      type: 'PAYMENTS',
      description: (bank.nome || 'Radar').substring(0, 30),
      mainDebitAccount: {
        branch: (bank.agencia || '').replace(/^0+/, '') || '1',
        number: (bank.conta || '').replace(/^0+/, '')
      },
      pixPaymentsActive: false,
      barCodePaymentsActive: false,
      bankSlipPaymentsActive: true,
      bankSlipAvailableActive: true,
      taxesByFieldPaymentsActive: false,
      vehicleTaxesPaymentsActive: false
    };

    const createResponse = await axios.post(
      `${baseUrl}/management_payments_partners/v1/workspaces`,
      wsBody,
      {
        httpsAgent: agent,
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Application-Key': config.clientId,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    const workspaceId = createResponse.data.id;
    console.log(`[DDA] Workspace criado: ${workspaceId} (${bank.nome})`);

    // Salvar no banco
    await repo.update(bankId, { workspace_id: workspaceId } as any);
    this.workspaceCaches.set(bankId, { workspaceId, expiresAt: Date.now() + 3600000 });
    return workspaceId;
  }

  /**
   * Busca boletos DDA (available_bank_slips)
   */
  static async getBoletos(
    bankId: string,
    initialDueDate?: string,
    finalDueDate?: string,
    titleSituation: string = 'ALL'
  ): Promise<any> {
    const workspaceId = await this.getOrCreateWorkspace(bankId);
    const config = await SantanderService.getConfigByBankId(bankId);
    const token = await SantanderService.getTokenForBank(bankId);
    const baseUrl = config.environment === 'sandbox'
      ? 'https://trust-sandbox.api.santander.com.br'
      : 'https://trust-open.api.santander.com.br';
    const agent = this.createHttpsAgent(config.certificatePath!, config.pfxPassword);

    const allBoletos: any[] = [];
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const params: any = {
        _PageNumber: pageNumber,
        titleSituation: titleSituation
      };
      if (initialDueDate) params.initialDueDate = initialDueDate;
      if (finalDueDate) params.finalDueDate = finalDueDate;

      try {
        const response = await axios.get(
          `${baseUrl}/management_payments_partners/v1/workspaces/${workspaceId}/available_bank_slips`,
          {
            httpsAgent: agent,
            params,
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Application-Key': config.clientId,
              'Accept': 'application/json'
            }
          }
        );

        const content = response.data?._content || [];
        allBoletos.push(...content);

        const pageable = response.data?._pageable || {};
        const pageElements = pageable._pageElements || 0;
        const totalElements = pageable._totalElements || 0;

        console.log(`[DDA] Página ${pageNumber}: ${pageElements} boletos (total: ${totalElements})`);

        // Se pegou menos que o máximo, não tem mais páginas
        if (pageElements < 200 || allBoletos.length >= totalElements) {
          hasMore = false;
        } else {
          pageNumber++;
        }
      } catch (error: any) {
        // 404 = "Boletos não encontrados" - retornar lista vazia
        if (error.response?.status === 404) {
          console.log(`[DDA] Nenhum boleto encontrado para ${config.branchCode}/${config.accountNumber}`);
          hasMore = false;
        } else {
          throw error;
        }
      }
    }

    return {
      boletos: allBoletos,
      total: allBoletos.length,
      workspaceId
    };
  }

  /**
   * Verifica status do workspace de um banco
   */
  static async getWorkspaceStatus(bankId: string): Promise<any> {
    try {
      const workspaceId = await this.getOrCreateWorkspace(bankId);
      return { hasWorkspace: true, workspaceId };
    } catch (error: any) {
      return { hasWorkspace: false, error: error.message };
    }
  }

  static clearCache(): void {
    this.workspaceCaches.clear();
  }
}
