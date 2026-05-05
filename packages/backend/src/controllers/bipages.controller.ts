import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Bip } from '../entities/Bip';
import { WebhookLog, WebhookLogStatus, WebhookLogReason } from '../entities/WebhookLog';
import { EanFormatterService } from '../services/ean-formatter.service';
import { BipCancellationService } from '../services/bip-cancellation.service';
import { BipWebhookService } from '../services/bip-webhook.service';
import { EquipmentsService } from '../services/equipments.service';
import { EmployeesService } from '../services/employees.service';
import { EquipmentSessionsService } from '../services/equipment-sessions.service';
import { WebhookPayload } from '../types/webhook.types';

// Helper para salvar logs de webhook
async function saveWebhookLog(data: Partial<WebhookLog>): Promise<void> {
  try {
    const logRepository = AppDataSource.getRepository(WebhookLog);
    const log = logRepository.create(data);
    await logRepository.save(log);
  } catch (error) {
    console.error('Erro ao salvar log de webhook:', error);
  }
}

export class BipagesController {
  /**
   * Recebe webhook de bipagem em tempo real
   * Replica toda a lógica do fluxo N8N
   */
  static async receiveWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('🚀 Recebendo webhook de bipagem...');
      console.log('📦 Payload:', JSON.stringify(req.body, null, 2));

      const payload: WebhookPayload = req.body;

      // FASE 0: Rejeitar silenciosamente input de teclado (sem dígitos = não é barcode)
      const rawDigits = String(payload.raw || '').replace(/\D+/g, '');
      if (rawDigits.length === 0) {
        console.log(`⌨️ Input ignorado (sem dígitos, provável teclado): "${String(payload.raw || '').substring(0, 30)}"`);
        res.status(200).json({ success: false, error: 'IGNORED_KEYBOARD_INPUT' });
        return;
      }

      // FASE 0.5: Detectar código de colaborador (3122) ANTES de formatar EAN
      const rawCode = rawDigits;
      if (rawCode.startsWith('3122')) {
        console.log('\n=== FASE 0.5: CÓDIGO DE COLABORADOR DETECTADO ===');
        console.log(`🔐 Código de colaborador: ${rawCode}`);

        // Buscar colaborador pelo barcode
        const employee = await EmployeesService.findByBarcode(rawCode);

        if (!employee) {
          console.log(`❌ Colaborador não encontrado: ${rawCode}`);
          await saveWebhookLog({
            status: WebhookLogStatus.REJECTED,
            reason: WebhookLogReason.EMPLOYEE_NOT_FOUND,
            raw_payload: JSON.stringify(payload),
            ean: rawCode,
            scanner_id: payload.scanner_id,
            machine_id: payload.machine_id,
            error_message: 'Colaborador não encontrado'
          });
          res.status(200).json({
            success: false,
            error: 'Colaborador não encontrado',
            barcode: rawCode
          });
          return;
        }

        console.log(`✅ Colaborador encontrado: ${employee.name} (ID: ${employee.id})`);

        // Verificar se há equipamento associado
        if (!payload.scanner_id || !payload.machine_id) {
          console.log(`⚠️ Login de colaborador sem informação de equipamento`);
          await saveWebhookLog({
            status: WebhookLogStatus.REJECTED,
            reason: WebhookLogReason.EQUIPMENT_DISABLED,
            raw_payload: JSON.stringify(payload),
            ean: rawCode,
            employee_name: employee.name,
            error_message: 'Equipamento não identificado'
          });
          res.status(200).json({
            success: false,
            error: 'Equipamento não identificado',
            employee: {
              id: employee.id,
              name: employee.name
            }
          });
          return;
        }

        // Buscar/registrar equipamento
        const equipment = await EquipmentsService.findOrCreateByScannerId(
          payload.scanner_id,
          payload.machine_id,
          payload.device_path
        );

        console.log(`📍 Equipamento: ${equipment.id}`);

        // Verificar se equipamento está ativo
        if (!equipment.active) {
          console.log(`🚫 Equipamento desabilitado: ${payload.scanner_id}`);
          await saveWebhookLog({
            status: WebhookLogStatus.REJECTED,
            reason: WebhookLogReason.EQUIPMENT_DISABLED,
            raw_payload: JSON.stringify(payload),
            ean: rawCode,
            scanner_id: payload.scanner_id,
            machine_id: payload.machine_id,
            equipment_id: equipment.id,
            employee_name: employee.name,
            error_message: 'Equipamento desabilitado'
          });
          res.status(200).json({
            success: false,
            error: 'Equipamento desabilitado',
            scanner_id: payload.scanner_id,
            equipment_id: equipment.id
          });
          return;
        }

        // Fazer login do colaborador no equipamento
        const session = await EquipmentSessionsService.loginEmployee(equipment.id, employee.id);
        console.log(`🎉 Colaborador ${employee.name} logado no equipamento ${equipment.id}`);

        // Log de sucesso do login
        await saveWebhookLog({
          status: WebhookLogStatus.OK,
          reason: WebhookLogReason.EMPLOYEE_LOGIN,
          raw_payload: JSON.stringify(payload),
          ean: rawCode,
          scanner_id: payload.scanner_id,
          machine_id: payload.machine_id,
          equipment_id: equipment.id,
          employee_name: employee.name
        });

        // Retornar sucesso SEM criar bipagem
        res.status(200).json({
          success: true,
          message: 'Colaborador logado com sucesso',
          employee_login: true,
          employee: {
            id: employee.id,
            name: employee.name,
            username: employee.username,
            barcode: employee.barcode
          },
          equipment: {
            id: equipment.id,
            scanner_machine_id: equipment.scanner_machine_id,
            machine_id: equipment.machine_id
          },
          session: {
            id: session.id,
            logged_in_at: session.logged_in_at
          }
        });
        return;
      }

      // FASE 0.5: Buscar equipamento pra saber eanDigits
      let eanDigits = 5;
      if (payload.scanner_id && payload.machine_id) {
        try {
          const eq = await EquipmentsService.findOrCreateByScannerId(payload.scanner_id, payload.machine_id, payload.device_path);
          eanDigits = eq.ean_digits || 5;
        } catch {}
      }

      // FASE 1: Formatação e validação do EAN (para produtos, não colaboradores)
      console.log('\n=== FASE 1: FORMATANDO EAN ===');
      const formatResult = EanFormatterService.formatEan(payload, eanDigits);

      if (!formatResult.parse_ok) {
        console.log(`❌ EAN inválido: ${formatResult.erro}`);
        await saveWebhookLog({
          status: WebhookLogStatus.REJECTED,
          reason: WebhookLogReason.EAN_INVALID,
          raw_payload: JSON.stringify(payload),
          ean: formatResult.ean,
          scanner_id: payload.scanner_id,
          machine_id: payload.machine_id,
          error_message: formatResult.erro || 'EAN inválido'
        });
        res.status(200).json({
          success: false,
          error: formatResult.erro,
          ean: formatResult.ean
        });
        return;
      }

      console.log(`✅ EAN formatado: ${formatResult.ean} (${formatResult.esquema})`);

      // FASE 2: Verificação de cancelamento
      console.log('\n=== FASE 2: VERIFICANDO CANCELAMENTO ===');
      const cancellationResult = await BipCancellationService.checkCancellation(formatResult.ean!);

      if (cancellationResult.cancel) {
        console.log(`🚫 Bipagem cancelada por limite excedido: ${formatResult.ean}`);
        await saveWebhookLog({
          status: WebhookLogStatus.REJECTED,
          reason: WebhookLogReason.CANCELLATION_LIMIT,
          raw_payload: JSON.stringify(payload),
          ean: formatResult.ean,
          plu: formatResult.produto_id,
          scanner_id: payload.scanner_id,
          machine_id: payload.machine_id,
          error_message: 'Limite de bipagens excedido'
        });
        res.status(200).json({
          success: true,
          message: 'Bipagem cancelada por limite excedido',
          cancelled: true,
          ean: formatResult.ean
        });
        return;
      }

      // FASE 3.5: Registrar/buscar equipamento e verificar se está ativo (ANTES de buscar produto)
      let equipmentId: number | null = null;
      let equipmentCodLoja: number | null = null;
      if (payload.scanner_id && payload.machine_id) {
        console.log('\n=== FASE 3.5: REGISTRANDO EQUIPAMENTO ===');
        const equipment = await EquipmentsService.findOrCreateByScannerId(
          payload.scanner_id,
          payload.machine_id,
          payload.device_path
        );
        equipmentId = equipment.id;
        equipmentCodLoja = equipment.cod_loja;
        console.log(`✅ Equipamento registrado: ID ${equipmentId}, Loja: ${equipmentCodLoja || 'Todas'}`);

        // Verificar se equipamento está ativo
        if (!equipment.active) {
          console.log(`🚫 Equipamento desabilitado: ${payload.scanner_id}`);
          await saveWebhookLog({
            status: WebhookLogStatus.REJECTED,
            reason: WebhookLogReason.EQUIPMENT_DISABLED,
            raw_payload: JSON.stringify(payload),
            ean: formatResult.ean,
            plu: formatResult.produto_id,
            scanner_id: payload.scanner_id,
            machine_id: payload.machine_id,
            equipment_id: equipment.id,
            cod_loja: equipmentCodLoja || undefined,
            error_message: 'Equipamento desabilitado'
          });
          res.status(200).json({
            success: false,
            cancelled: true,
            message: 'Equipamento desabilitado',
            scanner_id: payload.scanner_id,
            equipment_id: equipment.id
          });
          return;
        }
      }

      // FASE 3: Busca do produto no ERP (usando cod_loja do equipamento)
      console.log('\n=== FASE 3: BUSCANDO PRODUTO NO ERP ===');
      const erpProduct = await BipWebhookService.getProductFromERP(formatResult.produto_id!, equipmentCodLoja);

      if (!erpProduct) {
        console.log(`⚠️ Produto não encontrado no ERP: PLU ${formatResult.produto_id} — salvando bipagem mesmo assim`);
        // Salvar bipagem mesmo sem produto (ERP offline ou produto não cadastrado)
        const bipRepo = AppDataSource.getRepository(Bip);
        const bipSemProduto = bipRepo.create({
          ean: formatResult.ean,
          event_date: new Date(payload.event_date || Date.now()),
          bip_price_cents: formatResult.sell_price ? Math.round(parseFloat(formatResult.sell_price) * 100) : 0,
          product_id: formatResult.produto_id || '',
          product_description: `[NÃO ENCONTRADO] PLU ${formatResult.produto_id}`,
          product_full_price_cents_kg: 0,
          product_discount_price_cents_kg: 0,
          bip_weight: formatResult.peso ? parseFloat(formatResult.peso) : 0,
          status: 'pending' as any,
          equipment_id: equipmentId || undefined,
          employee_id: equipmentId ? (await EquipmentSessionsService.getActiveSession(equipmentId))?.employee_id : undefined,
          cod_loja: equipmentCodLoja || undefined
        });
        const savedBip = await bipRepo.save(bipSemProduto);
        console.log(`✅ Bipagem salva SEM produto: ID ${savedBip.id}`);
        await saveWebhookLog({
          status: WebhookLogStatus.OK,
          reason: 'product_not_found_saved' as any,
          raw_payload: JSON.stringify(payload),
          ean: formatResult.ean,
          plu: formatResult.produto_id,
          scanner_id: payload.scanner_id,
          machine_id: payload.machine_id,
          equipment_id: equipmentId || undefined,
          cod_loja: equipmentCodLoja || undefined,
          bip_id: savedBip.id,
          error_message: `Produto PLU ${formatResult.produto_id} não encontrado no Oracle — bipagem salva`
        });
        res.status(200).json({ success: true, bipId: savedBip.id, warning: 'Produto não encontrado no ERP' });
        return;
      }

      // FASE 4: Processamento e salvamento da bipagem
      console.log('\n=== FASE 4: PROCESSANDO E SALVANDO BIPAGEM ===');
      const bipData = BipWebhookService.processBipData(
        formatResult,
        erpProduct,
        payload.event_date,
        equipmentId,
        equipmentCodLoja
      );

      // Buscar colaborador logado no equipamento (se existir)
      let loggedEmployeeId: string | undefined;
      if (equipmentId) {
        const activeSession = await EquipmentSessionsService.getActiveSession(equipmentId);
        if (activeSession) {
          loggedEmployeeId = activeSession.employee_id;
          console.log(`👤 Colaborador logado no equipamento: ${activeSession.employee.name} (ID: ${loggedEmployeeId})`);
        } else {
          console.log('⚠️ Nenhum colaborador logado neste equipamento');
        }
      }

      const savedBip = await BipWebhookService.saveBipagem(bipData, loggedEmployeeId);

      console.log(`🎉 Bipagem processada com sucesso: ID ${savedBip.id}`);

      // Log de sucesso
      await saveWebhookLog({
        status: WebhookLogStatus.OK,
        reason: WebhookLogReason.SUCCESS,
        raw_payload: JSON.stringify(payload),
        ean: formatResult.ean,
        plu: formatResult.produto_id,
        product_description: erpProduct.descricao,
        scanner_id: payload.scanner_id,
        machine_id: payload.machine_id,
        equipment_id: equipmentId || undefined,
        cod_loja: equipmentCodLoja || undefined,
        bip_id: savedBip.id
      });

      // Resposta de sucesso
      res.status(200).json({
        success: true,
        message: 'Bipagem processada com sucesso',
        bip: {
          id: savedBip.id,
          ean: savedBip.ean,
          product_id: savedBip.product_id,
          product_description: savedBip.product_description,
          bip_price_cents: savedBip.bip_price_cents,
          bip_weight: savedBip.bip_weight,
          event_date: savedBip.event_date,
          status: savedBip.status
        }
      });

    } catch (error) {
      console.error('❌ Erro no processamento da bipagem:', error);

      // Log de erro
      await saveWebhookLog({
        status: WebhookLogStatus.ERROR,
        reason: WebhookLogReason.INTERNAL_ERROR,
        raw_payload: JSON.stringify(req.body),
        scanner_id: req.body?.scanner_id,
        machine_id: req.body?.machine_id,
        error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      });

      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  /**
   * Simula uma venda para conciliar com uma bipagem
   * Útil para testes do simulador
   */
  static async simulateSale(req: Request, res: Response): Promise<void> {
    try {
      console.log('🛒 Simulando venda para conciliação...');
      console.log('📦 Payload:', JSON.stringify(req.body, null, 2));

      const { bip_id, cupom_fiscal } = req.body;

      if (!bip_id) {
        res.status(400).json({
          success: false,
          error: 'Campo bip_id é obrigatório'
        });
        return;
      }

      const bipRepository = AppDataSource.getRepository(Bip);

      // Buscar a bipagem
      const bip = await bipRepository.findOne({
        where: { id: bip_id },
        relations: ['equipment', 'employee']
      });

      if (!bip) {
        console.log(`❌ Bipagem ${bip_id} não encontrada`);
        res.status(404).json({
          success: false,
          error: 'Bipagem não encontrada'
        });
        return;
      }

      if (bip.status === 'verified') {
        console.log(`⚠️  Bipagem ${bip_id} já está verificada`);
        res.status(400).json({
          success: false,
          error: 'Bipagem já está verificada',
          bip: {
            id: bip.id,
            status: bip.status,
            tax_cupon: bip.tax_cupon
          }
        });
        return;
      }

      if (bip.status === 'cancelled') {
        console.log(`⚠️  Bipagem ${bip_id} está cancelada`);
        res.status(400).json({
          success: false,
          error: 'Não é possível verificar uma bipagem cancelada. Reative-a primeiro.',
          bip: {
            id: bip.id,
            status: bip.status
          }
        });
        return;
      }

      // Verificar a bipagem (simula que a venda passou no PDV)
      const cupomFiscal = cupom_fiscal || `SIM${Date.now().toString().slice(-6)}`;

      await bipRepository.update(bip.id, {
        status: 'verified' as any,
        tax_cupon: cupomFiscal
      });

      console.log(`✅ Bipagem ${bip.id} verificada com cupom ${cupomFiscal}`);

      // Buscar bipagem atualizada
      const updatedBip = await bipRepository.findOne({
        where: { id: bip_id },
        relations: ['equipment', 'employee']
      });

      res.status(200).json({
        success: true,
        message: 'Venda simulada com sucesso! Bipagem verificada.',
        bip: {
          id: updatedBip!.id,
          ean: updatedBip!.ean,
          product_id: updatedBip!.product_id,
          product_description: updatedBip!.product_description,
          bip_price_cents: updatedBip!.bip_price_cents,
          bip_weight: updatedBip!.bip_weight,
          status: updatedBip!.status,
          tax_cupon: updatedBip!.tax_cupon,
          event_date: updatedBip!.event_date
        }
      });

    } catch (error) {
      console.error('❌ Erro ao simular venda:', error);

      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  /**
   * Re-identifica bipagens marcadas como "[NÃO ENCONTRADO]" tentando buscar o
   * produto novamente no Oracle. Útil quando o ERP estava offline na hora da
   * bipagem e voltou agora — atualiza os registros antigos com o nome real
   * do produto e os preços corretos.
   *
   * Aceita query params opcionais:
   *   - days (default 30): quantos dias para trás procurar
   *   - cod_loja: filtrar por loja específica
   */
  static async reidentificarProdutos(req: Request, res: Response): Promise<void> {
    try {
      const days = Math.max(1, Math.min(365, parseInt(String(req.query.days || '30'), 10) || 30));
      const codLoja = req.query.cod_loja ? parseInt(String(req.query.cod_loja), 10) : null;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const bipRepo = AppDataSource.getRepository(Bip);
      const qb = bipRepo.createQueryBuilder('b')
        .where('b.product_description LIKE :pat', { pat: '[NÃO ENCONTRADO]%' })
        .andWhere('b.event_date >= :cutoff', { cutoff });
      if (codLoja !== null && !isNaN(codLoja)) {
        qb.andWhere('b.cod_loja = :loja', { loja: codLoja });
      }
      const bipsNaoEncontradas = await qb.getMany();

      if (bipsNaoEncontradas.length === 0) {
        res.json({ success: true, total: 0, atualizadas: 0, ainda_nao_encontradas: 0, message: 'Nenhuma bipagem pendente de re-identificacao' });
        return;
      }

      // Cache: PLU+codLoja → produto (evita N consultas pra mesmo produto)
      const cache = new Map<string, any>();
      let atualizadas = 0;
      let aindaNaoEncontradas = 0;
      const errosPLU: string[] = [];

      for (const bip of bipsNaoEncontradas) {
        if (!bip.product_id) { aindaNaoEncontradas++; continue; }
        const lojaUsada = bip.cod_loja || 1;
        const cacheKey = `${bip.product_id}:${lojaUsada}`;

        let erpProduct: any;
        if (cache.has(cacheKey)) {
          erpProduct = cache.get(cacheKey);
        } else {
          erpProduct = await BipWebhookService.getProductFromERP(bip.product_id, lojaUsada);
          cache.set(cacheKey, erpProduct);
        }

        if (!erpProduct) {
          aindaNaoEncontradas++;
          if (errosPLU.length < 20) errosPLU.push(bip.product_id);
          continue;
        }

        // Atualiza descricao + precos (valvenda/valoferta podem vir como string ou number do ERP)
        const valvendaNum = parseFloat(String(erpProduct.valvenda || 0)) || 0;
        const valofertaNum = erpProduct.valoferta != null ? parseFloat(String(erpProduct.valoferta)) : 0;
        const valvendaCents = Math.round(valvendaNum * 100);
        const valofertaCents = Math.round(valofertaNum * 100);
        bip.product_description = erpProduct.descricao;
        bip.product_full_price_cents_kg = valvendaCents;
        bip.product_discount_price_cents_kg = valofertaCents || valvendaCents;
        await bipRepo.save(bip);
        atualizadas++;
      }

      console.log(`✅ Re-identificacao concluida: ${atualizadas} atualizadas / ${aindaNaoEncontradas} ainda nao encontradas (de ${bipsNaoEncontradas.length} total)`);

      res.json({
        success: true,
        total: bipsNaoEncontradas.length,
        atualizadas,
        ainda_nao_encontradas: aindaNaoEncontradas,
        plus_que_falharam: errosPLU.slice(0, 20),
        days_searched: days,
      });
    } catch (error) {
      console.error('❌ Erro ao re-identificar produtos:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao re-identificar produtos',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
}