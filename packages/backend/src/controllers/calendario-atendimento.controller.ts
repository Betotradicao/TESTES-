/**
 * Calendário de Atendimento Controller
 * Endpoints para gestão de atendimento de fornecedores
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CalendarioAtendimentoService } from '../services/calendario-atendimento.service';

export class CalendarioAtendimentoController {

  /**
   * GET /api/calendario-atendimento/fornecedores
   * Lista fornecedores com dados cadastrais completos
   */
  static async listarFornecedores(req: AuthRequest, res: Response) {
    try {
      const { busca, classificacao, codLoja, pagina, limite, statusNF } = req.query;

      const classificacoes = classificacao
        ? String(classificacao).split(',').map(Number).filter(n => !isNaN(n))
        : undefined;

      const resultado = await CalendarioAtendimentoService.listarFornecedores({
        busca: busca as string,
        classificacoes,
        codLoja: codLoja ? parseInt(codLoja as string) : undefined,
        pagina: pagina ? parseInt(pagina as string) : 1,
        limite: limite ? parseInt(limite as string) : 50,
        statusNF: (statusNF as string) || 'todos'
      });

      res.json(resultado);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao listar fornecedores:', error.message);
      res.status(500).json({ error: 'Erro ao listar fornecedores' });
    }
  }

  /**
   * GET /api/calendario-atendimento/visao-mensal
   * Visão mensal de entregas agrupadas por dia
   */
  static async visaoMensal(req: AuthRequest, res: Response) {
    try {
      const { ano, mes, codLoja } = req.query;

      if (!ano || !mes) {
        return res.status(400).json({ error: 'Ano e mês são obrigatórios' });
      }

      const resultado = await CalendarioAtendimentoService.visaoMensal(
        parseInt(ano as string),
        parseInt(mes as string),
        codLoja ? parseInt(codLoja as string) : undefined
      );

      res.json(resultado);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro na visão mensal:', error.message);
      res.status(500).json({ error: 'Erro ao buscar visão mensal' });
    }
  }

  /**
   * GET /api/calendario-atendimento/atendimento-diario
   * Detalhamento de atendimento de um dia específico
   */
  static async atendimentoDiario(req: AuthRequest, res: Response) {
    try {
      const { data, codLoja } = req.query;

      if (!data) {
        return res.status(400).json({ error: 'Data é obrigatória (formato YYYY-MM-DD)' });
      }

      const resultado = await CalendarioAtendimentoService.atendimentoDiario(
        data as string,
        codLoja ? parseInt(codLoja as string) : undefined
      );

      res.json(resultado);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro no atendimento diário:', error.message);
      res.status(500).json({ error: 'Erro ao buscar atendimento diário' });
    }
  }

  /**
   * GET /api/calendario-atendimento/classificacoes
   * Lista classificações de fornecedores (para filtro)
   */
  static async listarClassificacoes(req: AuthRequest, res: Response) {
    try {
      const classificacoes = await CalendarioAtendimentoService.listarClassificacoes();
      res.json(classificacoes);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao listar classificações:', error.message);
      res.status(500).json({ error: 'Erro ao listar classificações' });
    }
  }

  /**
   * GET /api/calendario-atendimento/agendamentos
   * Retorna todos os agendamentos de fornecedores (PostgreSQL)
   */
  static async getAgendamentos(req: AuthRequest, res: Response) {
    try {
      const agendamentos = await CalendarioAtendimentoService.getAgendamentos();
      res.json(agendamentos);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao buscar agendamentos:', error.message);
      res.status(500).json({ error: 'Erro ao buscar agendamentos' });
    }
  }

  /**
   * PUT /api/calendario-atendimento/agendamentos/:codFornecedor
   * Cria ou atualiza agendamento de um fornecedor
   */
  static async upsertAgendamento(req: AuthRequest, res: Response) {
    try {
      const codFornecedor = parseInt(req.params.codFornecedor);
      if (isNaN(codFornecedor)) {
        return res.status(400).json({ error: 'Código do fornecedor inválido' });
      }

      const resultado = await CalendarioAtendimentoService.upsertAgendamento(codFornecedor, req.body);
      res.json(resultado);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao salvar agendamento:', error.message);
      res.status(500).json({ error: 'Erro ao salvar agendamento' });
    }
  }

  /**
   * GET /api/calendario-atendimento/pedidos-dia
   * Pedidos emitidos em um dia específico
   */
  static async pedidosDoDia(req: AuthRequest, res: Response) {
    try {
      const { data, codLoja } = req.query;

      if (!data) {
        return res.status(400).json({ error: 'Data é obrigatória (formato YYYY-MM-DD)' });
      }

      const resultado = await CalendarioAtendimentoService.pedidosDoDia(
        data as string,
        codLoja ? parseInt(codLoja as string) : undefined
      );

      res.json(resultado);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao buscar pedidos do dia:', error.message);
      res.status(500).json({ error: 'Erro ao buscar pedidos do dia' });
    }
  }

  /**
   * GET /api/calendario-atendimento/opcoes-dropdown
   * Retorna opções de dropdown para comprador e tipo_atendimento
   */
  static async getOpcoesDropdown(req: AuthRequest, res: Response) {
    try {
      const opcoes = await CalendarioAtendimentoService.getOpcoesDropdown();
      res.json(opcoes);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao buscar opções:', error.message);
      res.status(500).json({ error: 'Erro ao buscar opções de dropdown' });
    }
  }

  /**
   * POST /api/calendario-atendimento/opcoes-dropdown
   * Adiciona uma opção de dropdown
   */
  static async addOpcaoDropdown(req: AuthRequest, res: Response) {
    try {
      const { tipo, valor } = req.body;
      if (!tipo || !valor) {
        return res.status(400).json({ error: 'Tipo e valor são obrigatórios' });
      }
      if (!['comprador', 'tipo_atendimento'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo inválido' });
      }
      const opcao = await CalendarioAtendimentoService.addOpcaoDropdown(tipo, valor);
      res.json(opcao);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao adicionar opção:', error.message);
      res.status(500).json({ error: 'Erro ao adicionar opção' });
    }
  }

  /**
   * DELETE /api/calendario-atendimento/opcoes-dropdown/:id
   * Remove uma opção de dropdown
   */
  static async removeOpcaoDropdown(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
      }
      await CalendarioAtendimentoService.removeOpcaoDropdown(id);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao remover opção:', error.message);
      res.status(500).json({ error: 'Erro ao remover opção' });
    }
  }

  /**
   * GET /api/calendario-atendimento/fornecedores-nomes
   * Mapa leve COD_FORNECEDOR → DES_FANTASIA
   */
  static async listarFornecedoresNomes(req: AuthRequest, res: Response) {
    try {
      const nomes = await CalendarioAtendimentoService.listarFornecedoresNomes();
      res.json(nomes);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao listar nomes:', error.message);
      res.status(500).json({ error: 'Erro ao listar nomes de fornecedores' });
    }
  }

  /**
   * GET /api/calendario-atendimento/fornecedores-detalhes
   * Mapa COD_FORNECEDOR → detalhes (contato, celular, email, prazo pgto, etc.)
   */
  static async listarFornecedoresDetalhes(req: AuthRequest, res: Response) {
    try {
      const detalhes = await CalendarioAtendimentoService.listarFornecedoresDetalhes();
      res.json(detalhes);
    } catch (error: any) {
      console.error('❌ [Calendário] Erro ao listar detalhes:', error.message);
      res.status(500).json({ error: 'Erro ao listar detalhes de fornecedores' });
    }
  }
}
