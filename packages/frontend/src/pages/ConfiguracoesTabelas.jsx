import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Tipos de banco de dados suportados
const DATABASE_TYPES = [
  { id: 'oracle', name: 'Oracle', icon: '🔶', color: 'bg-red-500' },
  { id: 'sqlserver', name: 'SQL Server', icon: '🔷', color: 'bg-blue-500' },
  { id: 'mysql', name: 'MySQL', icon: '🐬', color: 'bg-cyan-500' },
  { id: 'postgresql', name: 'PostgreSQL', icon: '🐘', color: 'bg-indigo-500' },
];

// ====================================================================================
// CATÁLOGO DE TABELAS - Definição de todas as tabelas e seus campos
// ====================================================================================
const TABLE_CATALOG = {
  TAB_PRODUTO: {
    name: 'Produtos',
    description: 'Tabela principal de produtos',
    fields: [
      { id: 'codigo_produto', name: 'Código do Produto', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_PRODUTO' },
      { id: 'descricao', name: 'Descrição', defaultTable: 'TAB_PRODUTO', defaultColumn: 'DES_PRODUTO' },
      { id: 'descricao_reduzida', name: 'Descrição Reduzida', defaultTable: 'TAB_PRODUTO', defaultColumn: 'DES_REDUZIDA' },
      { id: 'codigo_barras', name: 'Código de Barras', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_BARRA_PRINCIPAL' },
      { id: 'pesavel', name: 'É Pesável', defaultTable: 'TAB_PRODUTO', defaultColumn: 'FLG_ENVIA_BALANCA' },
      { id: 'embalagem', name: 'Embalagem', defaultTable: 'TAB_PRODUTO', defaultColumn: 'DES_EMBALAGEM' },
      { id: 'qtd_embalagem_venda', name: 'Qtd Emb. Venda', defaultTable: 'TAB_PRODUTO', defaultColumn: 'QTD_EMBALAGEM_VENDA' },
      { id: 'qtd_embalagem_compra', name: 'Qtd Emb. Compra', defaultTable: 'TAB_PRODUTO', defaultColumn: 'QTD_EMBALAGEM_COMPRA' },
      { id: 'tipo_especie', name: 'Tipo Espécie', defaultTable: 'TAB_PRODUTO', defaultColumn: 'TIPO_ESPECIE' },
      { id: 'tipo_evento', name: 'Tipo Evento', defaultTable: 'TAB_PRODUTO', defaultColumn: 'TIPO_EVENTO' },
      { id: 'data_cadastro', name: 'Data Cadastro', defaultTable: 'TAB_PRODUTO', defaultColumn: 'DTA_CADASTRO' },
      { id: 'codigo_secao', name: 'Código Seção', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_SECAO' },
      { id: 'descricao_secao', name: 'Descrição Seção', defaultTable: 'TAB_SECAO', defaultColumn: 'DES_SECAO' },
      { id: 'codigo_grupo', name: 'Código Grupo', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_GRUPO' },
      { id: 'descricao_grupo', name: 'Descrição Grupo', defaultTable: 'TAB_GRUPO', defaultColumn: 'DES_GRUPO' },
      { id: 'codigo_subgrupo', name: 'Código Subgrupo', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_SUB_GRUPO' },
      { id: 'descricao_subgrupo', name: 'Descrição Subgrupo', defaultTable: 'TAB_SUBGRUPO', defaultColumn: 'DES_SUB_GRUPO' },
      { id: 'codigo_fornecedor', name: 'Código Fornecedor', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_FORNECEDOR' },
      { id: 'codigo_info_nutricional', name: 'Cód Info Nutricional', defaultTable: 'TAB_PRODUTO', defaultColumn: 'COD_INFO_NUTRICIONAL' },
    ]
  },
  TAB_PRODUTO_LOJA: {
    name: 'Produto por Loja',
    description: 'Preços e estoque por loja',
    fields: [
      { id: 'preco_venda', name: 'Preço de Venda', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_VENDA' },
      { id: 'preco_oferta', name: 'Preço de Oferta', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_OFERTA' },
      { id: 'preco_custo', name: 'Custo de Reposição', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_CUSTO_REP' },
      { id: 'estoque_atual', name: 'Estoque Atual', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'QTD_EST_ATUAL' },
      { id: 'margem', name: 'Margem', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_MARGEM' },
      { id: 'margem_fixa', name: 'Margem Fixa', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_MARGEM_FIXA' },
      { id: 'venda_media', name: 'Venda Média', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'VAL_VENDA_MEDIA' },
      { id: 'cobertura', name: 'Cobertura', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'QTD_COBERTURA' },
      { id: 'pedido_compra', name: 'Pedido Compra', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'QTD_PEDIDO_COMPRA' },
      { id: 'data_ultima_compra', name: 'Última Compra', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'DTA_ULT_COMPRA' },
      { id: 'qtd_ultima_compra', name: 'Qtd Última Compra', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'QTD_ULT_COMPRA' },
      { id: 'estoque_minimo', name: 'Estoque Mínimo', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'QTD_EST_MINIMO' },
      { id: 'data_ultima_venda', name: 'Última Venda', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'DTA_ULT_MOV_VENDA' },
      { id: 'cod_forn_ult_compra', name: 'Fornecedor Últ. Compra', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'COD_FORN_ULT_COMPRA' },
      { id: 'curva', name: 'Curva ABC', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'DES_RANK_PRODLOJA' },
      { id: 'fora_linha', name: 'Fora de Linha', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'FORA_LINHA' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'COD_LOJA' },
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'COD_PRODUTO' },
      { id: 'inativo', name: 'Inativo', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'INATIVO' },
      { id: 'codigo_info_receita', name: 'Cód Info Receita', defaultTable: 'TAB_PRODUTO_LOJA', defaultColumn: 'COD_INFO_RECEITA' },
    ]
  },
  TAB_PRODUTO_PDV: {
    name: 'Vendas PDV',
    description: 'Cupons e itens vendidos',
    fields: [
      { id: 'numero_cupom', name: 'Número do Cupom', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'NUM_CUPOM_FISCAL' },
      { id: 'data_venda', name: 'Data da Venda', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'DTA_SAIDA' },
      { id: 'valor_total', name: 'Valor Total', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'VAL_TOTAL_PRODUTO' },
      { id: 'codigo_operador', name: 'Código Operador', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'COD_VENDEDOR' },
      { id: 'numero_pdv', name: 'Número PDV', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'NUM_PDV' },
      { id: 'cupom_cancelado', name: 'Cupom Cancelado', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'FLG_CUPOM_CANCELADO' },
      { id: 'valor_desconto', name: 'Valor Desconto', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'VAL_DESCONTO' },
      { id: 'quantidade', name: 'Quantidade', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'QTD_TOTAL_PRODUTO' },
      { id: 'des_hora', name: 'Hora', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'DES_HORA' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'COD_LOJA' },
      { id: 'sequencia_item', name: 'Sequência do Item', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'NUM_SEQ_ITEM' },
      { id: 'codigo_produto', name: 'Código Produto (FK)', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'COD_PRODUTO' },
      { id: 'valor_custo_reposicao', name: 'Valor Custo Reposição', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'VAL_CUSTO_REP' },
      { id: 'hora_venda', name: 'Hora da Venda', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'TIM_HORA' },
      { id: 'flag_oferta', name: 'Flag Oferta', defaultTable: 'TAB_PRODUTO_PDV', defaultColumn: 'FLG_OFERTA' },
    ]
  },
  TAB_OPERADORES: {
    name: 'Operadores',
    description: 'Operadores de caixa',
    fields: [
      { id: 'codigo_operador', name: 'Código Operador', defaultTable: 'TAB_OPERADORES', defaultColumn: 'COD_OPERADOR' },
      { id: 'nome_operador', name: 'Nome Operador', defaultTable: 'TAB_OPERADORES', defaultColumn: 'DES_OPERADOR' },
    ]
  },
  TAB_AJUSTE_ESTOQUE: {
    name: 'Ajustes de Estoque',
    description: 'Ajustes e movimentações de estoque',
    fields: [
      { id: 'codigo_ajuste_estoque', name: 'Código Ajuste', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'COD_AJUSTE_ESTOQUE' },
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'COD_PRODUTO' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'COD_LOJA' },
      { id: 'tipo_ajuste', name: 'Tipo Ajuste', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'COD_AJUSTE' },
      { id: 'quantidade', name: 'Quantidade', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'QTD_AJUSTE' },
      { id: 'data_ajuste', name: 'Data Ajuste', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'DTA_AJUSTE' },
      { id: 'usuario', name: 'Usuário', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'USUARIO' },
      { id: 'motivo', name: 'Motivo', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'MOTIVO' },
      { id: 'flag_cancelado', name: 'Flag Cancelado', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'FLG_CANCELADO' },
      { id: 'valor_venda', name: 'Valor Venda', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'VAL_VENDA' },
      { id: 'codigo_fornecedor', name: 'Código Fornecedor', defaultTable: 'TAB_AJUSTE_ESTOQUE', defaultColumn: 'COD_FORNECEDOR' },
    ]
  },
  TAB_TIPO_AJUSTE: {
    name: 'Tipos de Ajuste',
    description: 'Tipos/motivos de ajuste de estoque',
    fields: [
      { id: 'codigo_ajuste', name: 'Código Ajuste', defaultTable: 'TAB_TIPO_AJUSTE', defaultColumn: 'COD_AJUSTE' },
      { id: 'descricao_ajuste', name: 'Descrição Ajuste', defaultTable: 'TAB_TIPO_AJUSTE', defaultColumn: 'DES_AJUSTE' },
    ]
  },
  TAB_AJUSTE_ITENS: {
    name: 'Itens de Ajuste (Produção)',
    description: 'Itens detalhados dos ajustes de produção',
    fields: [
      { id: 'codigo_ajuste_pai', name: 'Código Ajuste Pai', defaultTable: 'TAB_AJUSTE_HIST_EST_ITENS', defaultColumn: 'COD_CHAVE_AJUSTE_PAI' },
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_AJUSTE_HIST_EST_ITENS', defaultColumn: 'COD_PRODUTO' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_AJUSTE_HIST_EST_ITENS', defaultColumn: 'COD_LOJA' },
      { id: 'quantidade', name: 'Quantidade', defaultTable: 'TAB_AJUSTE_HIST_EST_ITENS', defaultColumn: 'QTD_AJUSTE' },
      { id: 'valor_venda', name: 'Valor Venda', defaultTable: 'TAB_AJUSTE_HIST_EST_ITENS', defaultColumn: 'VAL_VENDA' },
      { id: 'valor_custo', name: 'Valor Custo', defaultTable: 'TAB_AJUSTE_HIST_EST_ITENS', defaultColumn: 'VAL_CUSTO_REP' },
    ]
  },
  TAB_FORNECEDOR: {
    name: 'Fornecedores',
    description: 'Cadastro de fornecedores',
    fields: [
      { id: 'codigo_fornecedor', name: 'Código Fornecedor', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'COD_FORNECEDOR' },
      { id: 'razao_social', name: 'Razão Social', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'DES_FORNECEDOR' },
      { id: 'nome_fantasia', name: 'Nome Fantasia', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'DES_FANTASIA' },
      { id: 'cnpj', name: 'CNPJ', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'NUM_CGC' },
      { id: 'telefone', name: 'Telefone', defaultTable: 'TAB_FORNECEDOR', defaultColumn: 'NUM_FONE' },
    ]
  },
  TAB_NOTA_FISCAL: {
    name: 'Notas Fiscais',
    description: 'NFs de entrada',
    fields: [
      { id: 'numero_nf', name: 'Número NF', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'NUM_NF_FORN' },
      { id: 'serie', name: 'Série', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'NUM_SERIE_NF' },
      { id: 'data_entrada', name: 'Data Entrada', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'DTA_ENTRADA' },
      { id: 'codigo_fornecedor', name: 'Código Fornecedor', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'COD_FORNECEDOR' },
      { id: 'valor_total', name: 'Valor Total', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'VAL_TOTAL_NF' },
      { id: 'chave_acesso', name: 'Chave de Acesso', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'NUM_CHAVE_ACESSO' },
      { id: 'flag_cancelado', name: 'Flag Cancelado', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'FLG_CANCELADO' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_FORNECEDOR_NOTA', defaultColumn: 'COD_LOJA' },
    ]
  },
  TAB_PEDIDO: {
    name: 'Pedidos',
    description: 'Pedidos de compra',
    fields: [
      { id: 'numero_pedido', name: 'Número Pedido', defaultTable: 'TAB_PEDIDO', defaultColumn: 'NUM_PEDIDO' },
      { id: 'codigo_fornecedor', name: 'Código Fornecedor', defaultTable: 'TAB_PEDIDO', defaultColumn: 'COD_PARCEIRO' },
      { id: 'data_emissao', name: 'Data Emissão', defaultTable: 'TAB_PEDIDO', defaultColumn: 'DTA_EMISSAO' },
      { id: 'data_entrega', name: 'Data Entrega', defaultTable: 'TAB_PEDIDO', defaultColumn: 'DTA_ENTREGA' },
      { id: 'tipo_recebimento', name: 'Tipo Recebimento', defaultTable: 'TAB_PEDIDO', defaultColumn: 'TIPO_RECEBIMENTO' },
      { id: 'tipo_parceiro', name: 'Tipo Parceiro', defaultTable: 'TAB_PEDIDO', defaultColumn: 'TIPO_PARCEIRO' },
      { id: 'valor_pedido', name: 'Valor Pedido', defaultTable: 'TAB_PEDIDO', defaultColumn: 'VAL_PEDIDO' },
      { id: 'tipo_finalizado', name: 'Tipo Pedido Finalizado', defaultTable: 'TAB_PEDIDO', defaultColumn: 'TIPO_PED_FINALIZADO' },
      { id: 'flag_cancelado', name: 'Flag Cancelado', defaultTable: 'TAB_PEDIDO', defaultColumn: 'FLG_CANCELADO' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_PEDIDO', defaultColumn: 'COD_LOJA' },
      { id: 'data_cancelamento', name: 'Data Cancelamento', defaultTable: 'TAB_PEDIDO', defaultColumn: 'DTA_PEDIDO_CANCELADO' },
      { id: 'descricao_cancelamento', name: 'Descrição Cancelamento', defaultTable: 'TAB_PEDIDO', defaultColumn: 'DES_CANCELAMENTO' },
      { id: 'usuario', name: 'Usuário', defaultTable: 'TAB_PEDIDO', defaultColumn: 'USUARIO' },
    ]
  },
  TAB_PEDIDO_PRODUTO: {
    name: 'Itens do Pedido',
    description: 'Produtos de cada pedido de compra',
    fields: [
      { id: 'numero_pedido', name: 'Número Pedido', defaultTable: 'TAB_PEDIDO_PRODUTO', defaultColumn: 'NUM_PEDIDO' },
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_PEDIDO_PRODUTO', defaultColumn: 'COD_PRODUTO' },
      { id: 'quantidade_pedida', name: 'Qtd Pedida', defaultTable: 'TAB_PEDIDO_PRODUTO', defaultColumn: 'QTD_PEDIDO' },
      { id: 'quantidade_recebida', name: 'Qtd Recebida', defaultTable: 'TAB_PEDIDO_PRODUTO', defaultColumn: 'QTD_RECEBIDA' },
      { id: 'quantidade_embalagem', name: 'Qtd Embalagem', defaultTable: 'TAB_PEDIDO_PRODUTO', defaultColumn: 'QTD_EMBALAGEM' },
      { id: 'valor_tabela', name: 'Valor Tabela', defaultTable: 'TAB_PEDIDO_PRODUTO', defaultColumn: 'VAL_TABELA' },
    ]
  },
  TAB_NF: {
    name: 'Notas Fiscais Entrada',
    description: 'NFs de entrada de mercadoria',
    fields: [
      { id: 'numero_nf', name: 'Número NF', defaultTable: 'TAB_NF', defaultColumn: 'NUM_NF' },
      { id: 'serie_nf', name: 'Série NF', defaultTable: 'TAB_NF', defaultColumn: 'NUM_SERIE_NF' },
      { id: 'data_entrada', name: 'Data Entrada', defaultTable: 'TAB_NF', defaultColumn: 'DTA_ENTRADA' },
      { id: 'codigo_parceiro', name: 'Código Parceiro', defaultTable: 'TAB_NF', defaultColumn: 'COD_PARCEIRO' },
      { id: 'tipo_operacao', name: 'Tipo Operação', defaultTable: 'TAB_NF', defaultColumn: 'TIPO_OPERACAO' },
    ]
  },
  TAB_NF_ITEM: {
    name: 'Itens da NF',
    description: 'Produtos de cada nota fiscal de entrada',
    fields: [
      { id: 'numero_nf', name: 'Número NF', defaultTable: 'TAB_NF_ITEM', defaultColumn: 'NUM_NF' },
      { id: 'serie_nf', name: 'Série NF', defaultTable: 'TAB_NF_ITEM', defaultColumn: 'NUM_SERIE_NF' },
      { id: 'codigo_parceiro', name: 'Código Parceiro', defaultTable: 'TAB_NF_ITEM', defaultColumn: 'COD_PARCEIRO' },
      { id: 'codigo_item', name: 'Código Item', defaultTable: 'TAB_NF_ITEM', defaultColumn: 'COD_ITEM' },
      { id: 'quantidade_entrada', name: 'Qtd Entrada', defaultTable: 'TAB_NF_ITEM', defaultColumn: 'QTD_ENTRADA' },
      { id: 'valor_custo', name: 'Valor Custo', defaultTable: 'TAB_NF_ITEM', defaultColumn: 'VAL_CUSTO_SCRED' },
      { id: 'valor_total', name: 'Valor Total', defaultTable: 'TAB_NF_ITEM', defaultColumn: 'VAL_TOTAL' },
    ]
  },
  // NOTA: TAB_RUPTURA, TAB_QUEBRA, TAB_ETIQUETA são tabelas INTERNAS (PostgreSQL)
  // Não precisam de mapeamento do ERP - são gerenciadas pelo sistema
  // NOTA: TAB_PRODUCAO e TAB_HORTFRUTI - podem existir no ERP ou ser internas
  // Por enquanto removidas até confirmar estrutura correta
  TAB_SECAO: {
    name: 'Seções',
    description: 'Seções de produtos',
    fields: [
      { id: 'codigo_secao', name: 'Código Seção', defaultTable: 'TAB_SECAO', defaultColumn: 'COD_SECAO' },
      { id: 'descricao_secao', name: 'Descrição Seção', defaultTable: 'TAB_SECAO', defaultColumn: 'DES_SECAO' },
      { id: 'meta', name: 'Meta de Venda', defaultTable: 'TAB_SECAO', defaultColumn: 'VAL_META' },
    ]
  },
  TAB_GRUPO: {
    name: 'Grupos',
    description: 'Grupos de produtos',
    fields: [
      { id: 'codigo_grupo', name: 'Código Grupo', defaultTable: 'TAB_GRUPO', defaultColumn: 'COD_GRUPO' },
      { id: 'descricao_grupo', name: 'Descrição Grupo', defaultTable: 'TAB_GRUPO', defaultColumn: 'DES_GRUPO' },
      { id: 'codigo_secao', name: 'Código Seção', defaultTable: 'TAB_GRUPO', defaultColumn: 'COD_SECAO' },
      { id: 'flag_inativo', name: 'Flag Inativo', defaultTable: 'TAB_GRUPO', defaultColumn: 'FLG_INATIVO' },
    ]
  },
  TAB_SUBGRUPO: {
    name: 'Subgrupos',
    description: 'Subgrupos de produtos',
    fields: [
      { id: 'codigo_subgrupo', name: 'Código Subgrupo', defaultTable: 'TAB_SUBGRUPO', defaultColumn: 'COD_SUB_GRUPO' },
      { id: 'descricao_subgrupo', name: 'Descrição Subgrupo', defaultTable: 'TAB_SUBGRUPO', defaultColumn: 'DES_SUB_GRUPO' },
      { id: 'codigo_grupo', name: 'Código Grupo', defaultTable: 'TAB_SUBGRUPO', defaultColumn: 'COD_GRUPO' },
      { id: 'codigo_secao', name: 'Código Seção', defaultTable: 'TAB_SUBGRUPO', defaultColumn: 'COD_SECAO' },
      { id: 'flag_inativo', name: 'Flag Inativo', defaultTable: 'TAB_SUBGRUPO', defaultColumn: 'FLG_INATIVO' },
    ]
  },
  TAB_COMPRADOR: {
    name: 'Compradores',
    description: 'Compradores da empresa',
    fields: [
      { id: 'codigo_comprador', name: 'Código Comprador', defaultTable: 'TAB_COMPRADOR', defaultColumn: 'COD_COMPRADOR' },
      { id: 'descricao_comprador', name: 'Nome Comprador', defaultTable: 'TAB_COMPRADOR', defaultColumn: 'DES_COMPRADOR' },
    ]
  },
  TAB_LOJA: {
    name: 'Lojas',
    description: 'Lojas da empresa',
    fields: [
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_LOJA', defaultColumn: 'COD_LOJA' },
      { id: 'descricao_loja', name: 'Nome Loja', defaultTable: 'TAB_LOJA', defaultColumn: 'DES_LOJA' },
      { id: 'flag_desativada', name: 'Flag Desativada', defaultTable: 'TAB_LOJA', defaultColumn: 'FLG_DESATIVADA' },
    ]
  },
  TAB_TESOURARIA_HISTORICO: {
    name: 'Tesouraria',
    description: 'Histórico de movimentações de tesouraria',
    fields: [
      { id: 'data_movimento', name: 'Data Movimento', defaultTable: 'TAB_TESOURARIA_HISTORICO', defaultColumn: 'DTA_MOVIMENTO' },
      { id: 'val_sobra', name: 'Valor Sobra', defaultTable: 'TAB_TESOURARIA_HISTORICO', defaultColumn: 'VAL_SOBRA' },
      { id: 'val_quebra', name: 'Valor Quebra', defaultTable: 'TAB_TESOURARIA_HISTORICO', defaultColumn: 'VAL_QUEBRA' },
      { id: 'num_registro', name: 'Número Registro', defaultTable: 'TAB_TESOURARIA_HISTORICO', defaultColumn: 'NUM_REGISTRO' },
      { id: 'codigo_operador', name: 'Código Operador', defaultTable: 'TAB_TESOURARIA_HISTORICO', defaultColumn: 'COD_OPERADOR' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_TESOURARIA_HISTORICO', defaultColumn: 'COD_LOJA' },
      { id: 'numero_pdv', name: 'Número PDV', defaultTable: 'TAB_TESOURARIA_HISTORICO', defaultColumn: 'NUM_PDV' },
      { id: 'num_turno', name: 'Número Turno', defaultTable: 'TAB_TESOURARIA_HISTORICO', defaultColumn: 'NUM_TURNO' },
      { id: 'valor_total', name: 'Valor Total', defaultTable: 'TAB_TESOURARIA_HISTORICO', defaultColumn: 'VAL_TOTAL' },
    ]
  },
  TAB_PRODUTO_PDV_ESTORNO: {
    name: 'Estornos PDV',
    description: 'Estornos de itens vendidos',
    fields: [
      { id: 'numero_cupom', name: 'Nº Cupom Fiscal', defaultTable: 'TAB_PRODUTO_PDV_ESTORNO', defaultColumn: 'NUM_CUPOM_FISCAL' },
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_PRODUTO_PDV_ESTORNO', defaultColumn: 'COD_PRODUTO' },
      { id: 'valor_total', name: 'Valor Total', defaultTable: 'TAB_PRODUTO_PDV_ESTORNO', defaultColumn: 'VAL_TOTAL_PRODUTO' },
      { id: 'quantidade', name: 'Quantidade', defaultTable: 'TAB_PRODUTO_PDV_ESTORNO', defaultColumn: 'QTD_TOTAL_PRODUTO' },
    ]
  },
  TAB_INFO_NUTRICIONAL: {
    name: 'Info Nutricional',
    description: 'Informações nutricionais dos produtos',
    fields: [
      { id: 'codigo_nutricional', name: 'Código Nutricional', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'COD_INFO_NUTRICIONAL' },
      { id: 'descricao_nutricional', name: 'Descrição', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'DES_INFO_NUTRICIONAL' },
      { id: 'porcao', name: 'Porção', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'PORCAO' },
      { id: 'unidade_porcao', name: 'Unidade Porção', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'UNIDADE_PORCAO' },
      { id: 'valor_calorico', name: 'Valor Calórico', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'VALOR_CALORICO' },
      { id: 'carboidrato', name: 'Carboidrato', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'CARBOIDRATO' },
      { id: 'proteina', name: 'Proteína', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'PROTEINA' },
      { id: 'gordura_total', name: 'Gordura Total', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'GORDURA_TOTAL' },
      { id: 'gordura_saturada', name: 'Gordura Saturada', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'GORDURA_SATURADA' },
      { id: 'gordura_trans', name: 'Gordura Trans', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'GORDURA_TRANS' },
      { id: 'colesterol', name: 'Colesterol', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'COLESTEROL' },
      { id: 'fibra_alimentar', name: 'Fibra Alimentar', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'FIBRA_ALIMENTAR' },
      { id: 'calcio', name: 'Cálcio', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'CALCIO' },
      { id: 'ferro', name: 'Ferro', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'FERRO' },
      { id: 'sodio', name: 'Sódio', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'SODIO' },
      { id: 'data_cadastro', name: 'Data Cadastro', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'DTA_CADASTRO' },
      { id: 'data_alteracao', name: 'Data Alteração', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'DTA_ALTERACAO' },
      { id: 'usuario', name: 'Usuário', defaultTable: 'TAB_INFO_NUTRICIONAL', defaultColumn: 'USUARIO' },
    ]
  },
  TAB_INFO_RECEITA: {
    name: 'Receitas',
    description: 'Receitas de produção',
    fields: [
      { id: 'codigo_receita', name: 'Código Receita', defaultTable: 'TAB_INFO_RECEITA', defaultColumn: 'COD_INFO_RECEITA' },
      { id: 'descricao_receita', name: 'Descrição Receita', defaultTable: 'TAB_INFO_RECEITA', defaultColumn: 'DES_INFO_RECEITA' },
      { id: 'detalhamento', name: 'Detalhamento', defaultTable: 'TAB_INFO_RECEITA', defaultColumn: 'DETALHAMENTO' },
      { id: 'data_cadastro', name: 'Data Cadastro', defaultTable: 'TAB_INFO_RECEITA', defaultColumn: 'DTA_CADASTRO' },
      { id: 'data_alteracao', name: 'Data Alteração', defaultTable: 'TAB_INFO_RECEITA', defaultColumn: 'DTA_ALTERACAO' },
      { id: 'usuario', name: 'Usuário', defaultTable: 'TAB_INFO_RECEITA', defaultColumn: 'USUARIO' },
    ]
  },
  TAB_PRODUTO_DECOMPOSICAO: {
    name: 'Decomposição de Produto',
    description: 'Composição/decomposição de produtos (boi casado, kits)',
    fields: [
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_PRODUTO_DECOMPOSICAO', defaultColumn: 'COD_PRODUTO' },
      { id: 'codigo_produto_decom', name: 'Código Produto Decomp.', defaultTable: 'TAB_PRODUTO_DECOMPOSICAO', defaultColumn: 'COD_PRODUTO_DECOM' },
      { id: 'quantidade_decomp', name: 'Quantidade Decomp.', defaultTable: 'TAB_PRODUTO_DECOMPOSICAO', defaultColumn: 'QTD_DECOMP' },
    ]
  },
  TAB_PRODUTO_HISTORICO: {
    name: 'Histórico de Produto',
    description: 'Histórico de preços e custos do produto',
    fields: [
      { id: 'codigo_produto', name: 'Código Produto', defaultTable: 'TAB_PRODUTO_HISTORICO', defaultColumn: 'COD_PRODUTO' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_PRODUTO_HISTORICO', defaultColumn: 'COD_LOJA' },
    ]
  },
  TAB_CUPOM_FINALIZADORA: {
    name: 'Finalizadoras de Cupom',
    description: 'Formas de pagamento dos cupons',
    fields: [
      { id: 'codigo_operador', name: 'Código Operador', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'COD_OPERADOR' },
      { id: 'numero_cupom', name: 'Número do Cupom', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'NUM_CUPOM_FISCAL' },
      { id: 'data_venda', name: 'Data da Venda', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'DTA_VENDA' },
      { id: 'valor_liquido', name: 'Valor Líquido', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'VAL_LIQUIDO' },
      { id: 'codigo_finalizadora', name: 'Código Finalizadora', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'COD_FINALIZADORA' },
      { id: 'codigo_tipo', name: 'Código Tipo', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'COD_TIPO' },
      { id: 'numero_pdv', name: 'Número PDV', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'NUM_PDV' },
      { id: 'codigo_loja', name: 'Código Loja', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'COD_LOJA' },
      { id: 'num_turno', name: 'Número Turno', defaultTable: 'TAB_CUPOM_FINALIZADORA', defaultColumn: 'NUM_TURNO' },
    ]
  },
};

// ====================================================================================
// MÓDULOS DE NEGÓCIO - Estrutura hierárquica
// ====================================================================================
const BUSINESS_MODULES = [
  {
    id: 'prevencao',
    name: 'Prevenção no Radar',
    icon: '🛡️',
    color: 'from-orange-500 to-red-500',
    submodules: [
      { id: 'bipagens', name: 'Prevenção de Bipagens', icon: '📡', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_PRODUTO_PDV', 'TAB_OPERADORES', 'TAB_CUPOM_FINALIZADORA'] },
      { id: 'pdv', name: 'Prevenção PDV', icon: '💳', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_PDV', 'TAB_OPERADORES', 'TAB_CUPOM_FINALIZADORA', 'TAB_TESOURARIA_HISTORICO', 'TAB_PRODUTO_PDV_ESTORNO'] },
      { id: 'facial', name: 'Prevenção Facial', icon: '👤', tables: ['TAB_OPERADORES'] },
      { id: 'rupturas', name: 'Prevenção Rupturas', icon: '🔍', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_SECAO', 'TAB_GRUPO', 'TAB_SUBGRUPO', 'TAB_FORNECEDOR', 'TAB_PEDIDO', 'TAB_PEDIDO_PRODUTO', 'TAB_NF', 'TAB_NF_ITEM'] },
      { id: 'etiquetas', name: 'Prevenção Etiquetas', icon: '🏷️', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_SECAO'] },
      { id: 'quebras', name: 'Prevenção Quebras', icon: '💔', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_AJUSTE_ESTOQUE', 'TAB_AJUSTE_ITENS', 'TAB_TIPO_AJUSTE', 'TAB_SECAO', 'TAB_FORNECEDOR'] },
      { id: 'producao', name: 'Produção', icon: '🏭', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_DECOMPOSICAO', 'TAB_INFO_NUTRICIONAL', 'TAB_INFO_RECEITA', 'TAB_AJUSTE_ESTOQUE', 'TAB_AJUSTE_ITENS', 'TAB_SECAO', 'TAB_GRUPO', 'TAB_SUBGRUPO'] },
      { id: 'hortfruti', name: 'Hort Fruti', icon: '🥬', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA'] },
    ]
  },
  {
    id: 'gestao',
    name: 'Gestão no Radar',
    icon: '📊',
    color: 'from-blue-500 to-indigo-600',
    submodules: [
      { id: 'gestao_inteligente', name: 'Gestão Inteligente', icon: '🧠', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_PRODUTO_PDV', 'TAB_PRODUTO_HISTORICO', 'TAB_CUPOM_FINALIZADORA', 'TAB_NOTA_FISCAL'] },
      { id: 'estoque_margem', name: 'Estoque e Margem', icon: '📦', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_AJUSTE_ESTOQUE', 'TAB_AJUSTE_ITENS', 'TAB_SECAO', 'TAB_GRUPO', 'TAB_SUBGRUPO'] },
      { id: 'compra_venda', name: 'Compra e Venda', icon: '🛒', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_PRODUTO_PDV', 'TAB_PRODUTO_DECOMPOSICAO', 'TAB_FORNECEDOR', 'TAB_NOTA_FISCAL', 'TAB_SECAO', 'TAB_GRUPO', 'TAB_SUBGRUPO', 'TAB_COMPRADOR', 'TAB_LOJA', 'TAB_NF', 'TAB_NF_ITEM'] },
      { id: 'pedidos', name: 'Pedidos', icon: '📋', tables: ['TAB_PRODUTO', 'TAB_FORNECEDOR', 'TAB_PEDIDO', 'TAB_PEDIDO_PRODUTO', 'TAB_NOTA_FISCAL', 'TAB_COMPRADOR'] },
      { id: 'ruptura_industria', name: 'Ruptura Indústria', icon: '🏭', tables: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_FORNECEDOR', 'TAB_PEDIDO', 'TAB_PEDIDO_PRODUTO', 'TAB_NF', 'TAB_NF_ITEM'] },
    ]
  }
];

// Gerar lista de todos os submódulos para tracking
const getAllSubmodules = () => {
  const subs = {};
  BUSINESS_MODULES.forEach(mod => {
    mod.submodules.forEach(sub => {
      subs[`${mod.id}.${sub.id}`] = false;
    });
  });
  return subs;
};

export default function ConfiguracoesTabelas() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('mapeamento');

  // Estado para Conexões
  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // Estado para navegação hierárquica
  const [selectedMainModule, setSelectedMainModule] = useState('prevencao');
  const [selectedSubmodule, setSelectedSubmodule] = useState('bipagens');
  const [selectedConnection, setSelectedConnection] = useState(null);

  // Gerar mapeamentos iniciais com valores Intersolid
  const getInitialMappings = () => {
    const mappings = {};
    Object.entries(TABLE_CATALOG).forEach(([tableId, tableInfo]) => {
      mappings[tableId] = {
        nome_real: tableInfo.fields[0]?.defaultTable || tableId,
        colunas: {},
        tabelas_campo: {}
      };
      tableInfo.fields.forEach(field => {
        mappings[tableId].colunas[field.id] = field.defaultColumn;
        mappings[tableId].tabelas_campo[field.id] = field.defaultTable;
      });
    });
    return mappings;
  };

  // Estado para mapeamentos (por tabela) - JÁ PRÉ-PREENCHIDO COM INTERSOLID
  const [tableMappings, setTableMappings] = useState(getInitialMappings);
  const [testResults, setTestResults] = useState({});
  const [testingMapping, setTestingMapping] = useState(null);
  const [testingAll, setTestingAll] = useState(false);
  const [autoTestPending, setAutoTestPending] = useState(false);

  // Estado para rastrear submódulos salvos
  const [savedSubmodules, setSavedSubmodules] = useState(getAllSubmodules());

  // Verificar se todos os submódulos foram salvos
  const allSubmodulesSaved = Object.values(savedSubmodules).every(saved => saved);

  // Estado para ERP Templates
  const [erpTemplates, setErpTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [applyingTemplate, setApplyingTemplate] = useState(null); // Template sendo aplicado (para travar tipo de banco)
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Verificar se é Master
  useEffect(() => {
    if (!user?.isMaster) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Carregar conexões e templates ao iniciar
  useEffect(() => {
    loadConnections();
    loadErpTemplates();
  }, []);

  // Auto-teste após aplicar template (executar testes quando autoTestPending for true)
  useEffect(() => {
    if (autoTestPending && selectedConnection && activeTab === 'mapeamento') {
      setAutoTestPending(false);
      // Executar teste de todos os mapeamentos do submódulo atual
      setTimeout(() => {
        const testAllBtn = document.querySelector('[data-testid="test-all-btn"]');
        if (testAllBtn) {
          testAllBtn.click();
        }
      }, 300);
    }
  }, [autoTestPending, selectedConnection, activeTab]);

  // Carregar status dos túneis e defaults quando abre a aba tunnel
  useEffect(() => {
    if (activeTab === 'tunnel') {
      loadTunnelStatus();
      loadTunnelDefaults();
    }
  }, [activeTab]);

  // Função para carregar templates de ERP
  const loadErpTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await api.get('/erp-templates');
      setErpTemplates(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar templates ERP:', error);
      setErpTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadConnections = async () => {
    try {
      setLoadingConnections(true);
      const response = await api.get('/database-connections');
      const mapped = (response.data || []).map(conn => ({
        ...conn,
        active: conn.status === 'active',
        readOnly: true,
        database: conn.service || conn.database,
        lastTest: conn.last_test_at,
        testSuccess: conn.status === 'active'
      }));
      setConnections(mapped);

      // Auto-selecionar conexão se ainda não tem nenhuma selecionada
      if (!selectedConnection && mapped.length > 0) {
        const defaultConn = mapped.find(c => c.is_default) || mapped[0];
        handleConnectionChange(String(defaultConn.id));
      }
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      setConnections([]);
    } finally {
      setLoadingConnections(false);
    }
  };

  // Função para upload de logo do template ERP
  const handleUploadLogo = async (templateId, file) => {
    try {
      // Converter para base64 para salvar no banco
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;
        try {
          await api.put(`/erp-templates/${templateId}`, { logo_url: base64 });
          // Atualizar lista de templates
          setErpTemplates(prev => prev.map(t =>
            t.id === templateId ? { ...t, logo_url: base64 } : t
          ));
        } catch (err) {
          console.error('Erro ao salvar logo:', err);
          alert('Erro ao salvar a logo do ERP');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
    }
  };

  // Função para mudar conexão selecionada e carregar mapeamentos
  const handleConnectionChange = async (connectionId) => {
    setSelectedConnection(connectionId || null);
    setTestResults({});

    if (!connectionId) {
      // Manter valores Intersolid pré-preenchidos
      setTableMappings(getInitialMappings());
      setSavedSubmodules(getAllSubmodules());
      return;
    }

    // Buscar mapeamentos salvos da conexão
    try {
      const response = await api.get(`/database-connections/${connectionId}/mappings`);
      if (response.data?.mappings?.tabelas && Object.keys(response.data.mappings.tabelas).length > 0) {
        // Mesclar com valores Intersolid (para campos não salvos)
        const savedMappings = response.data.mappings.tabelas;
        const initialMappings = getInitialMappings();

        // Mesclar: valores salvos têm prioridade, mas campos vazios usam Intersolid
        const mergedMappings = {};
        Object.entries(initialMappings).forEach(([tableId, initialTable]) => {
          const savedTable = savedMappings[tableId] || {};
          mergedMappings[tableId] = {
            nome_real: savedTable.nome_real || initialTable.nome_real,
            colunas: { ...initialTable.colunas, ...(savedTable.colunas || {}) },
            tabelas_campo: { ...initialTable.tabelas_campo, ...(savedTable.tabelas_campo || {}) }
          };
        });

        setTableMappings(mergedMappings);

        // Marcar submódulos como salvos somente se TODAS as colunas estão preenchidas
        const newSaved = { ...getAllSubmodules() };
        BUSINESS_MODULES.forEach(mod => {
          mod.submodules.forEach(sub => {
            let allFilled = true;
            for (const tableId of sub.tables) {
              const tableConfig = TABLE_CATALOG[tableId];
              if (!tableConfig) continue;
              const tblMapping = mergedMappings[tableId] || savedMappings[tableId];
              if (!tblMapping?.nome_real) { allFilled = false; break; }
              for (const field of tableConfig.fields) {
                if (!tblMapping?.colunas?.[field.id] || String(tblMapping.colunas[field.id]).trim() === '') {
                  allFilled = false;
                  break;
                }
              }
              if (!allFilled) break;
            }
            newSaved[`${mod.id}.${sub.id}`] = allFilled;
          });
        });
        setSavedSubmodules(newSaved);
      } else {
        // Sem mapeamentos salvos - manter valores Intersolid
        setTableMappings(getInitialMappings());
        setSavedSubmodules(getAllSubmodules());
      }
    } catch (error) {
      console.error('Erro ao carregar mapeamentos:', error);
      // Em caso de erro, manter valores Intersolid
      setTableMappings(getInitialMappings());
      setSavedSubmodules(getAllSubmodules());
    }
  };

  // Atualizar valor de uma coluna
  const handleUpdateColumn = (tableId, fieldId, value) => {
    setTableMappings(prev => ({
      ...prev,
      [tableId]: {
        ...prev[tableId],
        colunas: {
          ...(prev[tableId]?.colunas || {}),
          [fieldId]: value
        }
      }
    }));
    // Marcar submódulo como não salvo
    const subKey = `${selectedMainModule}.${selectedSubmodule}`;
    setSavedSubmodules(prev => ({ ...prev, [subKey]: false }));
  };

  // Atualizar tabela de um campo específico
  const handleUpdateFieldTable = (tableId, fieldId, value) => {
    setTableMappings(prev => ({
      ...prev,
      [tableId]: {
        ...prev[tableId],
        tabelas_campo: {
          ...(prev[tableId]?.tabelas_campo || {}),
          [fieldId]: value
        },
        nome_real: prev[tableId]?.nome_real || value
      }
    }));
    // Marcar submódulo como não salvo
    const subKey = `${selectedMainModule}.${selectedSubmodule}`;
    setSavedSubmodules(prev => ({ ...prev, [subKey]: false }));
  };

  // Testar um mapeamento específico
  const handleTestMapping = async (tableId, fieldId) => {
    const mapping = tableMappings[tableId];
    const tableName = mapping?.tabelas_campo?.[fieldId] || mapping?.nome_real || tableId;
    const columnName = mapping?.colunas?.[fieldId];

    if (!tableName || !columnName) {
      alert('Preencha a tabela e a coluna antes de testar');
      return;
    }

    const testKey = `${tableId}_${fieldId}`;
    setTestingMapping(testKey);
    setTestResults(prev => ({
      ...prev,
      [testKey]: { loading: true }
    }));

    try {
      const response = await api.post('/database-connections/test-mapping', {
        connectionId: selectedConnection,
        tableName,
        columnName
      });

      setTestResults(prev => ({
        ...prev,
        [testKey]: {
          loading: false,
          success: response.data.success,
          sample: response.data.sample,
          message: response.data.message,
          count: response.data.count
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testKey]: {
          loading: false,
          success: false,
          message: error.response?.data?.message || 'Erro ao testar'
        }
      }));
    } finally {
      setTestingMapping(null);
    }
  };

  // Testar TODOS os mapeamentos do submódulo atual
  const handleTestAllMappings = async () => {
    if (!selectedConnection) return;

    const mainModule = BUSINESS_MODULES.find(m => m.id === selectedMainModule);
    const submodule = mainModule?.submodules.find(s => s.id === selectedSubmodule);
    if (!submodule) return;

    setTestingAll(true);

    // Para cada tabela do submódulo
    for (const tableId of submodule.tables) {
      const tableInfo = TABLE_CATALOG[tableId];
      if (!tableInfo) continue;

      // Para cada campo da tabela
      for (const field of tableInfo.fields) {
        const mapping = tableMappings[tableId];
        const tableName = mapping?.tabelas_campo?.[field.id] || mapping?.nome_real || tableId;
        const columnName = mapping?.colunas?.[field.id];

        const testKey = `${tableId}_${field.id}`;

        if (!tableName || !columnName) {
          setTestResults(prev => ({
            ...prev,
            [testKey]: {
              loading: false,
              success: false,
              message: 'Tabela/coluna não preenchida'
            }
          }));
          continue;
        }

        setTestResults(prev => ({
          ...prev,
          [testKey]: { loading: true }
        }));

        try {
          const response = await api.post('/database-connections/test-mapping', {
            connectionId: selectedConnection,
            tableName,
            columnName
          });

          setTestResults(prev => ({
            ...prev,
            [testKey]: {
              loading: false,
              success: response.data.success,
              sample: response.data.sample,
              message: response.data.message,
              count: response.data.count
            }
          }));
        } catch (error) {
          setTestResults(prev => ({
            ...prev,
            [testKey]: {
              loading: false,
              success: false,
              message: error.response?.data?.message || 'Erro ao testar'
            }
          }));
        }

        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    setTestingAll(false);
  };

  // Salvar mapeamentos do submódulo atual
  const [savingMappings, setSavingMappings] = useState(false);
  const handleSaveSubmoduleMappings = async () => {
    if (!selectedConnection) {
      alert('Selecione uma conexão primeiro!');
      return;
    }

    const mainModule = BUSINESS_MODULES.find(m => m.id === selectedMainModule);
    const submodule = mainModule?.submodules.find(s => s.id === selectedSubmodule);
    if (!submodule) return;

    setSavingMappings(true);
    try {
      // Salvar cada tabela do submódulo
      for (const tableId of submodule.tables) {
        const mapping = tableMappings[tableId];
        if (!mapping) continue;

        await api.post('/database-connections/save-table-mapping', {
          connectionId: selectedConnection,
          tableId,
          realTableName: mapping.nome_real || tableId,
          columns: mapping.colunas || {},
          tabelas_campo: mapping.tabelas_campo || {}
        });
      }

      // Verificar se todas as colunas estão preenchidas
      const subKey = `${selectedMainModule}.${selectedSubmodule}`;
      let allColumnsFilled = true;
      for (const tableId of submodule.tables) {
        const tableConfig = TABLE_CATALOG[tableId];
        if (!tableConfig) continue;
        const mapping = tableMappings[tableId];
        for (const field of tableConfig.fields) {
          if (!mapping?.colunas?.[field.id] || String(mapping.colunas[field.id]).trim() === '') {
            allColumnsFilled = false;
            break;
          }
        }
        if (!allColumnsFilled) break;
      }

      setSavedSubmodules(prev => ({ ...prev, [subKey]: allColumnsFilled }));

      if (allColumnsFilled) {
        alert(`✅ Mapeamentos de "${submodule.name}" salvos com sucesso!`);
      } else {
        alert(`⚠️ Mapeamentos salvos, mas há colunas em branco! O submódulo ficará como PENDENTE até todas serem preenchidas.`);
      }
    } catch (error) {
      console.error('Erro ao salvar mapeamentos:', error);
      alert('❌ Erro ao salvar mapeamentos: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingMappings(false);
    }
  };

  // Salvar template ERP (cria novo ou atualiza existente com mesmo nome)
  const handleSaveErpTemplate = async (templateName) => {
    try {
      const selectedConn = connections.find(c => c.id == selectedConnection);
      const mappingsData = { version: 2, tabelas: tableMappings };

      // Verificar se já existe um template com esse nome
      const existing = erpTemplates.find(t => t.name === templateName);

      let response;
      if (existing) {
        // Atualizar template existente
        response = await api.put(`/erp-templates/${existing.id}`, {
          mappings: mappingsData,
          database_type: selectedConn?.type || 'oracle',
        });
      } else {
        // Criar novo template
        response = await api.post('/erp-templates', {
          name: templateName,
          description: `Template para ERP ${templateName}`,
          database_type: selectedConn?.type || 'oracle',
          mappings: mappingsData
        });
      }

      if (response.data.success) {
        alert(existing ? 'Template ERP atualizado com sucesso!' : 'Template ERP salvo com sucesso!');
        loadErpTemplates();
        setShowSaveTemplateModal(false);
      } else {
        alert('Erro ao salvar template: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao salvar template ERP:', error);
      alert('Erro ao salvar template: ' + (error.response?.data?.error || error.message));
    }
  };

  // Excluir template ERP
  const handleDeleteErpTemplate = async (template) => {
    if (!confirm(`Tem certeza que deseja excluir o template "${template.name}"?`)) return;
    try {
      await api.delete(`/erp-templates/${template.id}`);
      loadErpTemplates();
    } catch (error) {
      console.error('Erro ao excluir template ERP:', error);
      alert('Erro ao excluir template: ' + (error.response?.data?.error || error.message));
    }
  };

  // Handlers de conexão
  const handleTestConnection = async (connection) => {
    setTestingConnection(connection.id);
    setTestResult(null);

    try {
      const response = await api.post(`/database-connections/${connection.id}/test`);
      setTestResult({
        success: true,
        message: 'Conexão bem sucedida!',
        details: response.data
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'Falha na conexão',
        details: error.response?.data
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const handleSaveConnection = async (connectionData, testPassed = false) => {
    try {
      const payload = {
        name: connectionData.name,
        type: connectionData.type,
        host: connectionData.host,
        host_vps: connectionData.host_vps || 'host.docker.internal',
        port: connectionData.port,
        service: connectionData.service || connectionData.database,
        database: connectionData.database,
        schema: connectionData.schema,
        username: connectionData.username,
        password: connectionData.password,
        is_default: false,
        status: testPassed ? 'active' : 'inactive'
      };

      if (!payload.password && editingConnection) {
        delete payload.password;
      }

      let savedConnectionId = null;
      const wasFromTemplate = !!applyingTemplate;

      if (editingConnection) {
        await api.put(`/database-connections/${editingConnection.id}`, payload);
        savedConnectionId = editingConnection.id;
      } else {
        const response = await api.post('/database-connections', payload);
        savedConnectionId = response.data?.id;
      }

      await loadConnections();
      setShowConnectionModal(false);
      setEditingConnection(null);
      setApplyingTemplate(null);

      // Se veio de um template e o teste de conexão passou, ir para Mapeamento e testar automaticamente
      if (wasFromTemplate && testPassed && savedConnectionId) {
        setSelectedConnection(savedConnectionId);
        setActiveTab('mapeamento');
        // Aguardar um pouco para o estado atualizar e depois executar os testes
        setTimeout(() => {
          // Trigger auto-test (será executado pelo useEffect abaixo)
          setAutoTestPending(true);
        }, 500);
      }
    } catch (error) {
      console.error('Erro ao salvar conexão:', error);
      alert('Erro ao salvar conexão: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteConnection = async (connectionId) => {
    if (!confirm('Tem certeza que deseja excluir esta conexão?')) return;

    try {
      await api.delete(`/database-connections/${connectionId}`);
      loadConnections();
    } catch (error) {
      console.error('Erro ao excluir conexão:', error);
      alert('Erro ao excluir conexão');
    }
  };

  // Estado para Instalador de Túnel
  const [tunnelConfig, setTunnelConfig] = useState({
    clientName: '',
    vpsIp: '',
    tunnels: [
      { name: '', localIp: '', localPort: '', remotePort: '' },
    ]
  });
  const [generatingScripts, setGeneratingScripts] = useState(false);
  const [generatedScripts, setGeneratedScripts] = useState(null);
  const [tunnelTestResult, setTunnelTestResult] = useState(null); // { status: 'online'|'partial'|'offline', results: [] }
  const [testingTunnel, setTestingTunnel] = useState(false);
  const [installedTunnels, setInstalledTunnels] = useState(null); // { tunnels: [], hasTunnels: bool }
  const [loadingTunnelStatus, setLoadingTunnelStatus] = useState(false);

  // Carregar status dos túneis instalados ao abrir a aba
  const loadTunnelStatus = async () => {
    setLoadingTunnelStatus(true);
    try {
      const response = await api.get('/tunnel-installer/status');
      if (response.data?.success) {
        setInstalledTunnels(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar status dos túneis:', error);
    } finally {
      setLoadingTunnelStatus(false);
    }
  };

  // Carregar defaults (portas de túnel e IP da VPS) para pré-preencher
  const loadTunnelDefaults = async () => {
    try {
      const response = await api.get('/tunnel-installer/defaults');
      if (response.data?.success) {
        const { vpsIp, tunnelPorts } = response.data.defaults;
        setTunnelConfig(prev => {
          // Só preencher se estiver vazio (não sobrescrever dados do usuário)
          const newConfig = { ...prev };
          if (!prev.vpsIp && vpsIp) {
            newConfig.vpsIp = vpsIp;
          }
          // Pré-preencher túnel Oracle se o primeiro túnel estiver vazio
          if (prev.tunnels.length === 1 && !prev.tunnels[0].name && tunnelPorts.oracle) {
            newConfig.tunnels = [
              { name: 'ORACLE', localIp: '', localPort: '1521', remotePort: tunnelPorts.oracle }
            ];
          }
          return newConfig;
        });
      }
    } catch (error) {
      console.error('Erro ao carregar defaults do túnel:', error);
    }
  };

  // Função para testar conexão dos túneis
  const handleTestTunnel = async () => {
    const activeTunnels = tunnelConfig.tunnels.filter(t => t.remotePort);
    if (activeTunnels.length === 0) {
      alert('Configure pelo menos um túnel com porta remota para testar');
      return;
    }

    setTestingTunnel(true);
    setTunnelTestResult(null);
    try {
      const response = await api.post('/tunnel-installer/test', { tunnels: activeTunnels });
      setTunnelTestResult(response.data);
    } catch (error) {
      console.error('Erro ao testar túneis:', error);
      setTunnelTestResult({ status: 'offline', results: [{ name: 'Erro', status: 'offline', message: 'Falha na comunicação com o backend' }] });
    } finally {
      setTestingTunnel(false);
    }
  };

  // Função para desinstalar túnel do cliente
  const [uninstalling, setUninstalling] = useState(false);
  const handleUninstallTunnel = async (clientNameOverride) => {
    const name = clientNameOverride || tunnelConfig.clientName;
    if (!name) {
      alert('Digite o nome do cliente para gerar o desinstalador');
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir o túnel do cliente "${name}"?\n\nIsso vai:\n- Remover a chave SSH do servidor\n- Baixar um BAT que remove o túnel da máquina do cliente`)) {
      return;
    }

    setUninstalling(true);
    try {
      const response = await api.post('/tunnel-installer/uninstall', {
        clientName: name
      }, { responseType: 'blob' });

      // Download do BAT de desinstalação
      const blob = new Blob([response.data], { type: 'application/x-bat' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uninstall-tunnel-${name.toLowerCase().replace(/\s+/g, '-')}.bat`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      alert('Chave SSH removida do servidor!\n\nExecute o BAT baixado na máquina do cliente para completar a desinstalação.');
      setTunnelTestResult(null);
      setGeneratedScripts(null);
      loadTunnelStatus();
    } catch (error) {
      console.error('Erro ao desinstalar túnel:', error);
      alert('Erro ao desinstalar túnel: ' + (error.response?.data?.error || error.message));
    } finally {
      setUninstalling(false);
    }
  };

  // Função para gerar scripts de túnel
  const handleGenerateTunnelScripts = async () => {
    // Validar campos obrigatórios
    if (!tunnelConfig.clientName) {
      alert('Digite o nome do cliente');
      return;
    }
    if (!tunnelConfig.vpsIp) {
      alert('Digite o IP da VPS');
      return;
    }

    // Filtrar túneis que têm IP local preenchido
    const activeTunnels = tunnelConfig.tunnels.filter(t => t.localIp.trim());
    if (activeTunnels.length === 0) {
      alert('Configure pelo menos um túnel com IP local');
      return;
    }

    setGeneratingScripts(true);
    try {
      const response = await api.post('/tunnel-installer/generate', {
        clientName: tunnelConfig.clientName,
        vpsIp: tunnelConfig.vpsIp,
        tunnels: activeTunnels
      });

      if (response.data.success) {
        setGeneratedScripts(response.data);
        loadTunnelStatus();
      } else {
        alert('Erro ao gerar scripts: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao gerar scripts:', error);
      alert('Erro ao gerar scripts: ' + (error.response?.data?.error || error.message));
    } finally {
      setGeneratingScripts(false);
    }
  };

  // Função para download de script
  const handleDownloadScript = async (type, filename) => {
    try {
      // Para o script de descoberta, não exigir túneis com IP preenchido
      const isDiscover = type === 'discover';
      const activeTunnels = isDiscover ? [] : tunnelConfig.tunnels.filter(t => t.localIp.trim());

      if (!isDiscover && activeTunnels.length === 0) {
        alert('Configure pelo menos um túnel com IP local antes de baixar');
        return;
      }

      const response = await api.post(`/tunnel-installer/download/${type}`, {
        clientName: tunnelConfig.clientName || 'Cliente',
        vpsIp: tunnelConfig.vpsIp,
        tunnels: activeTunnels
      }, { responseType: 'blob' });

      // Criar link de download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar script:', error);
      alert('Erro ao baixar script');
    }
  };

  // Atualizar túnel
  const handleUpdateTunnel = (index, field, value) => {
    setTunnelConfig(prev => ({
      ...prev,
      tunnels: prev.tunnels.map((t, i) => i === index ? { ...t, [field]: value } : t)
    }));
    setGeneratedScripts(null); // Limpar scripts gerados ao alterar config
  };

  // Adicionar túnel
  const handleAddTunnel = () => {
    setTunnelConfig(prev => ({
      ...prev,
      tunnels: [...prev.tunnels, { name: '', localIp: '', localPort: '', remotePort: '' }]
    }));
  };

  // Remover túnel
  const handleRemoveTunnel = (index) => {
    if (tunnelConfig.tunnels.length <= 1) {
      alert('Deve haver pelo menos um túnel');
      return;
    }
    setTunnelConfig(prev => ({
      ...prev,
      tunnels: prev.tunnels.filter((_, i) => i !== index)
    }));
  };

  // Render da aba Instalador de Túnel
  const renderTunnelTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Instalador de Túnel SSH</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure conexão segura entre a rede local do cliente e a VPS
          </p>
        </div>
      </div>

      {/* Aviso de Segurança */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">🔐</div>
          <div>
            <h3 className="font-bold text-green-800 text-lg mb-2">Conexão 100% Segura</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>✅ <strong>Conexão SAINTE</strong> - Nenhuma porta aberta no firewall do cliente</li>
              <li>✅ <strong>Acesso LIMITADO</strong> - VPS só acessa IPs/portas específicas configuradas</li>
              <li>✅ <strong>Sem Shell Remoto</strong> - Impossível executar comandos no Windows do cliente</li>
              <li>✅ <strong>Autenticação por Chave SSH</strong> - Sem senha, impossível brute force</li>
              <li>✅ <strong>Reconexão Automática</strong> - Serviço monitora e reconecta se cair</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Túneis Instalados - Status */}
      {loadingTunnelStatus && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-gray-500 text-sm">Carregando status dos túneis...</p>
        </div>
      )}

      {installedTunnels?.hasTunnels && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
            <span>📡</span> Túneis Instalados
          </h3>
          <div className="space-y-3">
            {installedTunnels.tunnels.map((tunnel, idx) => (
              <div key={idx} className={`flex items-center justify-between p-4 rounded-lg border ${
                tunnel.status === 'online' ? 'bg-green-50 border-green-300' :
                tunnel.status === 'partial' ? 'bg-yellow-50 border-yellow-300' :
                'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                    tunnel.status === 'online' ? 'bg-green-500 animate-pulse' :
                    tunnel.status === 'partial' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-bold text-gray-900 text-base">
                      {tunnel.clientName}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {tunnel.ports.map((p, pi) => (
                        <span key={pi} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          p.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {p.active ? '🟢' : '🔴'} Porta {p.port}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                    tunnel.status === 'online' ? 'bg-green-200 text-green-800' :
                    tunnel.status === 'partial' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                    {tunnel.status === 'online' ? 'ONLINE' :
                     tunnel.status === 'partial' ? 'PARCIAL' :
                     'OFFLINE'}
                  </div>
                  <button
                    onClick={() => handleUninstallTunnel(tunnel.clientName)}
                    disabled={uninstalling}
                    className="text-sm px-3 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-medium"
                    title="Excluir este túnel"
                  >
                    {uninstalling ? '...' : '🗑️ Excluir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={loadTunnelStatus}
            disabled={loadingTunnelStatus}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {loadingTunnelStatus ? 'Atualizando...' : '🔄 Atualizar Status'}
          </button>
        </div>
      )}

      {installedTunnels && !installedTunnels.hasTunnels && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800 font-medium">
            Nenhum túnel instalado ainda. Configure abaixo e gere o instalador para o cliente.
          </p>
        </div>
      )}

      {/* Configuração */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
          <span>⚙️</span> Configuração do Túnel
        </h3>

        {/* Dados do Cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Cliente *</label>
            <input
              type="text"
              value={tunnelConfig.clientName}
              onChange={(e) => {
                setTunnelConfig(prev => ({ ...prev, clientName: e.target.value }));
                setGeneratedScripts(null);
              }}
              placeholder="Ex: Tradicao, Piratininga..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">IP da VPS *</label>
            <input
              type="text"
              value={tunnelConfig.vpsIp}
              onChange={(e) => {
                setTunnelConfig(prev => ({ ...prev, vpsIp: e.target.value }));
                setGeneratedScripts(null);
              }}
              placeholder="46.202.150.64"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Túneis */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">Túneis a Configurar</label>
            <button
              onClick={handleAddTunnel}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              + Adicionar Túnel
            </button>
          </div>

          {/* Cabeçalho das colunas */}
          <div className="flex items-center gap-3 px-4 pb-2">
            <div className="flex-1 grid grid-cols-4 gap-3">
              <span className="text-xs font-medium text-gray-500">Serviço</span>
              <span className="text-xs font-medium text-gray-500">IP na Rede do Cliente</span>
              <span className="text-xs font-medium text-gray-500">Porta Local</span>
              <span className="text-xs font-medium text-gray-500">Porta na VPS</span>
            </div>
            <div className="w-10"></div>
          </div>

          <div className="space-y-3">
            {tunnelConfig.tunnels.map((tunnel, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={tunnel.name}
                    onChange={(e) => handleUpdateTunnel(index, 'name', e.target.value)}
                    placeholder="Nome (ex: Oracle)"
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={tunnel.localIp}
                      onChange={(e) => handleUpdateTunnel(index, 'localIp', e.target.value)}
                      placeholder="IP do serviço"
                      className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => handleUpdateTunnel(index, 'localIp', 'localhost')}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors whitespace-nowrap"
                      title="Usar localhost (serviço na mesma máquina)"
                    >
                      local
                    </button>
                  </div>
                  <input
                    type="text"
                    value={tunnel.localPort}
                    onChange={(e) => handleUpdateTunnel(index, 'localPort', e.target.value)}
                    placeholder="Ex: 1521"
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    value={tunnel.remotePort}
                    onChange={(e) => handleUpdateTunnel(index, 'remotePort', e.target.value)}
                    placeholder="Ex: 1521"
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <button
                  onClick={() => handleRemoveTunnel(index)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remover"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Dica:</strong> Se o serviço roda na mesma máquina onde o túnel será instalado, use "localhost" no IP Local.
              Se está em outra máquina da rede, peça o IP ao TI do cliente.
            </p>
          </div>
        </div>

        {/* Botão Gerar */}
        <button
          onClick={handleGenerateTunnelScripts}
          disabled={generatingScripts}
          className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium transition-colors"
        >
          {generatingScripts ? '⏳ Gerando Scripts...' : '🔧 Gerar Scripts de Instalação'}
        </button>
      </div>

      {/* Scripts Gerados */}
      {generatedScripts && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
            <span>📥</span> Downloads
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Windows - BAT */}
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🪟</span>
                <div>
                  <h4 className="font-bold text-gray-900">Instalador Windows</h4>
                  <p className="text-xs text-gray-500">Arquivo único - instala tudo automaticamente</p>
                </div>
              </div>
              <button
                onClick={() => handleDownloadScript('bat', `install-tunnel-${tunnelConfig.clientName.toLowerCase()}.bat`)}
                className="w-full py-2 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 transition-colors text-sm"
              >
                📥 Baixar install-tunnel.bat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Testar Conexão */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
          <span>🔌</span> Testar Conexão do Túnel
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Após o cliente executar o instalador, clique abaixo para verificar se o túnel está ativo.
          O sistema tenta conectar nas portas configuradas para verificar se estão acessíveis.
        </p>
        <button
          onClick={handleTestTunnel}
          disabled={testingTunnel}
          className={`w-full py-3 rounded-lg font-bold text-white transition-colors text-sm ${
            testingTunnel ? 'bg-gray-400 cursor-not-allowed' :
            tunnelTestResult?.status === 'online' ? 'bg-green-500 hover:bg-green-600' :
            tunnelTestResult?.status === 'partial' ? 'bg-yellow-500 hover:bg-yellow-600' :
            tunnelTestResult?.status === 'offline' ? 'bg-red-500 hover:bg-red-600' :
            'bg-indigo-500 hover:bg-indigo-600'
          }`}
        >
          {testingTunnel ? '⏳ Testando conexão...' :
           tunnelTestResult?.status === 'online' ? '✅ TÚNEL ATIVO - Clique para testar novamente' :
           tunnelTestResult?.status === 'partial' ? '⚠️ PARCIALMENTE ATIVO - Clique para testar novamente' :
           tunnelTestResult?.status === 'offline' ? '❌ TÚNEL OFFLINE - Clique para testar novamente' :
           '🔍 Testar Conexão do Túnel'}
        </button>

        {tunnelTestResult && (
          <div className="mt-4 space-y-2">
            {tunnelTestResult.results?.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${
                r.status === 'online' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <span className="text-2xl">{r.status === 'online' ? '🟢' : '🔴'}</span>
                <div>
                  <p className={`font-bold text-sm ${r.status === 'online' ? 'text-green-800' : 'text-red-800'}`}>
                    {r.name} (porta {r.port})
                  </p>
                  <p className={`text-xs ${r.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                    {r.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-800 text-lg mb-4 flex items-center gap-2">
          <span>📋</span> Instruções de Instalação
        </h3>
        <ol className="text-sm text-blue-700 space-y-3">
          <li className="flex gap-2">
            <span className="font-bold">1.</span>
            <span><strong>Preencher dados:</strong> Informe o nome do cliente, os IPs e portas dos bancos de dados (peça ao TI do cliente)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold">2.</span>
            <span>Clique em <strong>"Gerar Scripts de Instalação"</strong> e depois <strong>"Baixar install-tunnel.bat"</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold">3.</span>
            <span>Envie o arquivo para o TI do cliente executar <strong>como Administrador</strong> numa máquina Windows da rede</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-green-700">4.</span>
            <span><strong className="text-green-700">Testar:</strong> Após execução, use o botão <strong>"Testar Conexão do Túnel"</strong> acima para verificar se ficou verde</span>
          </li>
        </ol>
      </div>
    </div>
  );

  // Gerar PDF do mapeamento
  const gerarPdfMapeamento = (modo) => {
    const doc = new jsPDF('landscape');
    const mainModule = BUSINESS_MODULES.find(m => m.id === selectedMainModule);
    const connName = connections.find(c => c.id == selectedConnection)?.name || 'Sem conexão';
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    let submodulesParaExportar = [];

    if (modo === 'current') {
      const sub = mainModule?.submodules.find(s => s.id === selectedSubmodule);
      if (sub) submodulesParaExportar = [{ module: mainModule, submodule: sub }];
    } else {
      BUSINESS_MODULES.forEach(mod => {
        mod.submodules.forEach(sub => {
          submodulesParaExportar.push({ module: mod, submodule: sub });
        });
      });
    }

    if (submodulesParaExportar.length === 0) return;

    let isFirstPage = true;

    submodulesParaExportar.forEach(({ module, submodule }) => {
      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      // Header do módulo
      doc.setFontSize(16);
      doc.setTextColor(234, 88, 12); // orange
      doc.text(`${module.name} - ${submodule.name}`, 14, 18);

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Conexão: ${connName}  |  Data: ${dataAtual}`, 14, 25);

      let startY = 32;

      submodule.tables.forEach(tableId => {
        const tableInfo = TABLE_CATALOG[tableId];
        if (!tableInfo) return;

        const mapping = tableMappings[tableId];

        // Nome da tabela
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        doc.text(`${tableInfo.name} (${tableInfo.description})`, 14, startY);
        startY += 3;

        const tableData = tableInfo.fields.map(field => {
          const tabela = mapping?.tabelas_campo?.[field.id] || field.defaultTable;
          const coluna = mapping?.colunas?.[field.id] || field.defaultColumn;
          const testKey = `${tableId}_${field.id}`;
          const result = testResults[testKey];
          let status = '—';
          if (result?.success) {
            status = `OK (${result.count} reg.)`;
          } else if (result?.success === false) {
            status = `Erro`;
          }
          return [field.name, tabela, coluna, status];
        });

        const tableResult = autoTable(doc, {
          startY: startY,
          head: [['Campo', 'Tabela', 'Coluna', 'Status']],
          body: tableData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [234, 88, 12], textColor: 255 },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 60 },
            2: { cellWidth: 70 },
            3: { cellWidth: 40 },
          },
          margin: { left: 14 },
          didDrawPage: () => {
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text('Prevenção no Radar - Mapeamento de Tabelas', 14, doc.internal.pageSize.height - 8);
            doc.text(`Página ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 8);
          }
        });

        startY = (doc.lastAutoTable?.finalY || tableResult?.finalY || startY) + 10;

        // Se vai estourar a página, cria nova
        if (startY > doc.internal.pageSize.height - 40) {
          doc.addPage();
          startY = 20;
        }
      });
    });

    const nomeArquivo = modo === 'current'
      ? `mapeamento-${selectedSubmodule}-${dataAtual.replace(/\//g, '-')}.pdf`
      : `mapeamento-completo-${dataAtual.replace(/\//g, '-')}.pdf`;

    doc.save(nomeArquivo);
    setShowPdfModal(false);
  };

  // Render da aba Mapeamento (HIERÁRQUICO)
  const renderMappingTab = () => {
    const mainModule = BUSINESS_MODULES.find(m => m.id === selectedMainModule);
    const submodule = mainModule?.submodules.find(s => s.id === selectedSubmodule);
    const subKey = `${selectedMainModule}.${selectedSubmodule}`;
    const isSubmoduleSaved = savedSubmodules[subKey];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Mapeamento de Tabelas</h2>
            <p className="text-sm text-gray-500 mt-1">
              Conecte os campos do sistema às colunas do seu banco de dados
            </p>
          </div>
          <button
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Gerar PDF
          </button>
        </div>

        {/* Seletor de Módulo Principal */}
        <div className="flex flex-wrap gap-3">
          {BUSINESS_MODULES.map(module => {
            const savedCount = module.submodules.filter(s => savedSubmodules[`${module.id}.${s.id}`]).length;
            const totalCount = module.submodules.length;
            const allSaved = savedCount === totalCount;

            return (
              <button
                key={module.id}
                onClick={() => {
                  setSelectedMainModule(module.id);
                  setSelectedSubmodule(module.submodules[0].id);
                }}
                className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 transition-all relative ${
                  selectedMainModule === module.id
                    ? 'border-orange-500 bg-gradient-to-br ' + module.color + ' text-white shadow-lg'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-3xl">{module.icon}</span>
                <div className="text-left">
                  <div className="font-bold">{module.name}</div>
                  <div className={`text-xs ${selectedMainModule === module.id ? 'text-white/80' : 'text-gray-500'}`}>
                    {savedCount}/{totalCount} submódulos
                  </div>
                </div>
                {/* Badge de status */}
                <span className={`absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${
                  allSaved ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {allSaved ? '✓' : savedCount}
                </span>
              </button>
            );
          })}

          {/* Botão Salvar Padrão ERP */}
          <button
            onClick={() => {
              if (!allSubmodulesSaved) {
                const pendingCount = Object.values(savedSubmodules).filter(s => !s).length;
                alert(`⚠️ Salve todos os submódulos primeiro!\n\nFaltam ${pendingCount} submódulo(s).`);
                return;
              }
              setShowSaveTemplateModal(true);
            }}
            disabled={!allSubmodulesSaved}
            className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 transition-all ${
              allSubmodulesSaved
                ? 'border-purple-500 bg-purple-50 text-purple-700 hover:bg-purple-100'
                : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span className="text-3xl">{allSubmodulesSaved ? '💾' : '🔒'}</span>
            <div className="text-left">
              <div className="font-bold">Salvar Padrão ERP</div>
              <div className="text-xs opacity-75">
                {allSubmodulesSaved ? 'Criar template' : `${Object.values(savedSubmodules).filter(s => !s).length} pendente(s)`}
              </div>
            </div>
          </button>
        </div>

        {/* Seletor de Submódulo */}
        <div className="flex flex-wrap gap-2">
          {mainModule?.submodules.map(sub => {
            const subSaved = savedSubmodules[`${selectedMainModule}.${sub.id}`];
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubmodule(sub.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all relative ${
                  selectedSubmodule === sub.id
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <span>{sub.icon}</span>
                <span className="font-medium">{sub.name}</span>
                <span className={`w-5 h-5 flex items-center justify-center text-xs rounded-full ${
                  subSaved ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {subSaved ? '✓' : '!'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Área de Mapeamento */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header do Submódulo */}
          <div className={`bg-gradient-to-r ${mainModule?.color || 'from-orange-500 to-red-500'} p-6 text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{submodule?.icon}</span>
                <div>
                  <h3 className="text-xl font-bold">{submodule?.name}</h3>
                  <p className="text-white/80">
                    Tabelas: {submodule?.tables.map(t => TABLE_CATALOG[t]?.name || t).join(', ')}
                  </p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg font-bold ${
                isSubmoduleSaved ? 'bg-green-500' : 'bg-white/20'
              }`}>
                {isSubmoduleSaved ? '✓ SALVO' : '⚠ PENDENTE'}
              </div>
            </div>
          </div>

          {/* Seletor de Conexão */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conexão de Banco de Dados:
            </label>
            <select
              value={selectedConnection || ''}
              onChange={(e) => handleConnectionChange(e.target.value)}
              className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Selecione uma conexão...</option>
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>
                  {DATABASE_TYPES.find(t => t.id === conn.type)?.icon} {conn.name} ({conn.host})
                </option>
              ))}
            </select>
          </div>

          {/* Tabela de Mapeamento */}
          {selectedConnection ? (
            <div className="p-6">
              {/* Botão Testar Todos */}
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex-1 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>💡 Dica:</strong> Preencha a Tabela e Coluna de cada campo. Use "Testar Todos" para validar.
                  </p>
                </div>
                <button
                  data-testid="test-all-btn"
                  onClick={handleTestAllMappings}
                  disabled={testingAll}
                  className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                >
                  {testingAll ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Testando...
                    </>
                  ) : (
                    <>🚀 Testar Todos</>
                  )}
                </button>
              </div>

              {/* Renderizar cada tabela do submódulo */}
              {submodule?.tables.map(tableId => {
                const tableInfo = TABLE_CATALOG[tableId];
                if (!tableInfo) return null;

                return (
                  <div key={tableId} className="mb-8">
                    <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      {tableInfo.name}
                      <span className="text-sm font-normal text-gray-500">({tableInfo.description})</span>
                    </h4>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 text-sm" style={{width: '180px'}}>Campo</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 text-sm" style={{width: '200px'}}>Tabela</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 text-sm" style={{width: '200px'}}>Coluna</th>
                            <th className="text-center py-2 px-2 font-semibold text-gray-700 text-sm" style={{width: '50px'}}></th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 text-sm">Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableInfo.fields.map(field => {
                            const testKey = `${tableId}_${field.id}`;
                            const result = testResults[testKey];
                            const mapping = tableMappings[tableId];

                            return (
                              <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-2 px-3">
                                  <div className="font-medium text-gray-900 text-sm">{field.name}</div>
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    placeholder={field.defaultTable}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    value={mapping?.tabelas_campo?.[field.id] || ''}
                                    onChange={(e) => handleUpdateFieldTable(tableId, field.id, e.target.value)}
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    placeholder={field.defaultColumn}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    value={mapping?.colunas?.[field.id] || ''}
                                    onChange={(e) => handleUpdateColumn(tableId, field.id, e.target.value)}
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    onClick={() => handleTestMapping(tableId, field.id)}
                                    disabled={testingMapping === testKey || testingAll}
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {testingMapping === testKey ? (
                                      <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
                                    ) : (
                                      '🔍'
                                    )}
                                  </button>
                                </td>
                                <td className="py-2 px-3">
                                  {result?.loading ? (
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                      <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                      <span>Testando...</span>
                                    </div>
                                  ) : result?.success ? (
                                    <div className="text-green-600 text-sm">
                                      ✅ {result.count?.toLocaleString()} reg. | Ex: {result.sample}
                                    </div>
                                  ) : result?.message ? (
                                    <div className="text-red-600 text-sm">
                                      ❌ {result.message}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic text-sm">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Botão Salvar */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold ${
                  isSubmoduleSaved
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                }`}>
                  {isSubmoduleSaved ? (
                    <>✅ {submodule?.name} - SALVO</>
                  ) : (
                    <>⚠️ {submodule?.name} - PENDENTE</>
                  )}
                </div>

                <button
                  onClick={handleSaveSubmoduleMappings}
                  disabled={savingMappings}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {savingMappings ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      💾 Salvar {submodule?.name}
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👆</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecione uma conexão</h3>
              <p className="text-gray-500">
                Escolha uma conexão de banco de dados acima para configurar o mapeamento.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render da aba Conexões
  const renderConnectionsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Conexões de Banco de Dados</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure as conexões com os bancos de dados externos
          </p>
        </div>
        <button
          onClick={() => {
            setEditingConnection(null);
            setShowConnectionModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
          </svg>
          Nova Conexão
        </button>
      </div>

      {loadingConnections ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-2">Carregando conexões...</p>
        </div>
      ) : connections.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">🔌</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma conexão configurada</h3>
          <p className="text-gray-500 mb-6">
            Configure a primeira conexão com seu banco de dados para começar.
          </p>
          <button
            onClick={() => setShowConnectionModal(true)}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Configurar Primeira Conexão
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map(conn => {
            const dbType = DATABASE_TYPES.find(t => t.id === conn.type);
            return (
              <div key={conn.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all">
                {/* Cabeçalho: Logo + Nome + Badge */}
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-16 h-16 ${dbType?.color || 'bg-gray-500'} rounded-xl flex items-center justify-center text-white text-3xl flex-shrink-0`}>
                    {dbType?.icon || '🗄️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 truncate text-lg">{conn.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{dbType?.name || conn.type}</p>
                  </div>
                  {conn.active ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex-shrink-0">Ativo</span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full flex-shrink-0">Inativo</span>
                  )}
                </div>

                {/* Detalhes da conexão */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Host:</span>
                    <span className="font-mono text-gray-800">{conn.host}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Porta:</span>
                    <span className="font-mono text-gray-800">{conn.port}</span>
                  </div>
                  {(conn.service || conn.database) && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{conn.service ? 'Service:' : 'Database:'}</span>
                      <span className="font-mono text-gray-800">{conn.service || conn.database}</span>
                    </div>
                  )}
                  {conn.schema && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Schema:</span>
                      <span className="font-mono text-gray-800">{conn.schema}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Usuário:</span>
                    <span className="font-mono text-gray-800">{conn.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Senha:</span>
                    <span className="font-mono text-gray-800">{conn.password || '••••••••'}</span>
                  </div>
                </div>

                {/* Botões de ação */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(conn)}
                    disabled={testingConnection === conn.id}
                    className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 text-sm"
                    title="Testar conexão"
                  >
                    {testingConnection === conn.id ? (
                      <span className="flex items-center justify-center gap-1">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        Testando...
                      </span>
                    ) : (
                      '🔌 Testar'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingConnection(conn);
                      setShowConnectionModal(true);
                    }}
                    className="flex-1 py-2 bg-orange-50 text-orange-600 rounded-lg font-medium hover:bg-orange-100 transition-colors text-sm"
                    title="Editar"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleDeleteConnection(conn.id)}
                    className="py-2 px-3 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors text-sm"
                    title="Excluir"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Render da aba ERP Templates
  const renderErpTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Templates de ERP</h2>
          <p className="text-sm text-gray-500 mt-1">
            Templates pré-configurados para agilizar a configuração
          </p>
        </div>
      </div>

      {loadingTemplates ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-2">Carregando templates...</p>
        </div>
      ) : erpTemplates.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">🏢</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum template de ERP configurado</h3>
          <p className="text-gray-500 mb-6">
            Configure os mapeamentos na aba "Mapeamento" e salve como template.
          </p>
          <button
            onClick={() => setActiveTab('mapeamento')}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Ir para Mapeamento
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {erpTemplates.map(template => {
            const dbType = DATABASE_TYPES.find(t => t.id === template.database_type);
            return (
              <div key={template.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all">
                <div className="flex items-center gap-4 mb-4">
                  {/* Área para Logo do ERP - Clicável para upload */}
                  <label className={`w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer transition-all group relative ${template.logo_url ? 'bg-white' : 'bg-gray-100 border-2 border-dashed border-gray-300 hover:bg-gray-200 hover:border-orange-400'}`}>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadLogo(template.id, file);
                      }}
                    />
                    {template.logo_url ? (
                      <>
                        <img src={template.logo_url} alt={template.name} className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-white text-xs">Trocar</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-2xl">📷</span>
                        <span className="text-[10px] text-gray-400">Adicionar</span>
                      </div>
                    )}
                  </label>
                  {/* Nome e descrição */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate text-lg">{template.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{template.description || 'Template de mapeamento'}</p>
                  </div>
                  {/* Ícone do tipo de banco (Oracle, etc) */}
                  <div className={`w-10 h-10 ${dbType?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0`}>
                    {dbType?.icon || '🗄️'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 py-2.5 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition-colors"
                    onClick={() => {
                      setApplyingTemplate(template);
                      if (template.mappings?.tabelas) {
                        setTableMappings(template.mappings.tabelas);
                      }
                      setActiveTab('conexoes');
                      setEditingConnection(null);
                      setShowConnectionModal(true);
                    }}
                  >
                    Usar este Template
                  </button>
                  <button
                    className="px-3 py-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    title="Excluir template"
                    onClick={() => handleDeleteErpTemplate(template)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Modal de Conexão (simplificado)
  const ConnectionModal = () => {
    // Tipo de banco travado quando vem de template
    const lockedDbType = applyingTemplate?.database_type || null;

    const [formData, setFormData] = useState(() => {
      if (editingConnection) {
        return {
          name: editingConnection.name || '',
          type: editingConnection.type || 'oracle',
          host: editingConnection.host || '',
          host_vps: editingConnection.host_vps || 'host.docker.internal',
          port: editingConnection.port?.toString() || '1521',
          service: editingConnection.service || '',
          database: editingConnection.database || editingConnection.service || '',
          schema: editingConnection.schema || '',
          username: editingConnection.username || '',
          password: editingConnection.password || '',
          active: editingConnection.active !== false
        };
      }
      // Se tem template sendo aplicado, usa o tipo dele
      const dbType = applyingTemplate?.database_type || 'oracle';
      return {
        name: applyingTemplate ? `${applyingTemplate.name}` : '',
        type: dbType,
        host: '',
        host_vps: 'host.docker.internal',
        port: '',
        service: '',
        database: '',
        schema: '',
        username: '',
        password: '',
        active: true
      };
    });
    const [showPassword, setShowPassword] = useState(true);
    const [testingModal, setTestingModal] = useState(false);
    const [modalTestResult, setModalTestResult] = useState(null);
    const [savingModal, setSavingModal] = useState(false);

    const handleTestFormConnection = async () => {
      setTestingModal(true);
      setModalTestResult(null);

      try {
        const response = await api.post('/database-connections/test-new', {
          type: formData.type,
          host: formData.host,
          host_vps: formData.host_vps,
          port: formData.port,
          service: formData.service || formData.database,
          database: formData.database,
          username: formData.username,
          password: formData.password,
          schema: formData.schema
        });

        setModalTestResult({
          success: response.data.success,
          message: response.data.message
        });
      } catch (error) {
        setModalTestResult({
          success: false,
          message: error.response?.data?.message || 'Falha ao testar conexão'
        });
      } finally {
        setTestingModal(false);
      }
    };

    const handleChange = (field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {editingConnection ? 'Editar Conexão' : 'Nova Conexão'}
              </h3>
              <button
                onClick={() => { setShowConnectionModal(false); setApplyingTemplate(null); }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Conexão *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ex: Oracle Intersolid"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Banco *
                {lockedDbType && <span className="text-orange-500 text-xs ml-2">(definido pelo template)</span>}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {DATABASE_TYPES.map(db => {
                  const isLocked = lockedDbType && db.id !== lockedDbType;
                  const isSelected = formData.type === db.id;
                  return (
                    <button
                      key={db.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && handleChange('type', db.id)}
                      className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all relative ${
                        isSelected ? 'border-orange-500 bg-orange-50' :
                        isLocked ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {isLocked && (
                        <span className="absolute top-1 right-1 text-gray-400 text-xs">🔒</span>
                      )}
                      <span className="text-2xl mb-1">{db.icon}</span>
                      <span className="text-xs font-medium">{db.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hosts - Local e Nuvem */}
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <span>🌐</span> Configuração de Rede
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Host Local *
                    <span className="text-xs text-gray-500 ml-1">(rede interna)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => handleChange('host', e.target.value)}
                    placeholder="10.6.1.100"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Host Nuvem (VPS) *
                    <span className="text-xs text-gray-500 ml-1">(Docker gateway)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.host_vps}
                    onChange={(e) => handleChange('host_vps', e.target.value)}
                    placeholder="host.docker.internal"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                O sistema usa o Host Local em desenvolvimento e o Host Nuvem quando rodando na VPS via Docker.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Porta *</label>
                <input
                  type="text"
                  value={formData.port}
                  onChange={(e) => handleChange('port', e.target.value)}
                  placeholder="1521"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.type === 'oracle' ? 'SID/Service' : 'Database'} *
                </label>
                <input
                  type="text"
                  value={formData.type === 'oracle' ? formData.service : formData.database}
                  onChange={(e) => handleChange(formData.type === 'oracle' ? 'service' : 'database', e.target.value)}
                  placeholder={formData.type === 'oracle' ? 'orcl' : 'nome_banco'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              {formData.type === 'oracle' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Schema</label>
                  <input
                    type="text"
                    value={formData.schema}
                    onChange={(e) => handleChange('schema', e.target.value)}
                    placeholder="INTERSOLID"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Usuário *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  placeholder="usuario"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Senha *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>

            {modalTestResult && (
              <div className={`p-4 rounded-lg ${modalTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm font-medium ${modalTestResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {modalTestResult.success ? '✅' : '❌'} {modalTestResult.message}
                </p>
              </div>
            )}
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => { setShowConnectionModal(false); setApplyingTemplate(null); }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestFormConnection}
                disabled={testingModal || !formData.host || !formData.port || !formData.username || !formData.password}
                className="px-6 py-2 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
              >
                {testingModal ? '⏳ Testando...' : '🔌 Testar'}
              </button>
              <button
                onClick={async () => {
                  if (savingModal) return;
                  setSavingModal(true);
                  try {
                    await handleSaveConnection(formData, modalTestResult?.success);
                  } finally {
                    setSavingModal(false);
                  }
                }}
                disabled={savingModal}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {savingModal ? '⏳ Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Configurações de Tabelas</h1>
          <div className="w-10"></div>
        </div>

        <main className="p-4 lg:p-8">
          {/* Header Principal */}
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg p-8 mb-8 text-white">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold">Configurações de Tabelas</h1>
                <p className="text-orange-100 mt-1">
                  Configure conexões e mapeie as tabelas do seu ERP
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('tunnel')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === 'tunnel'
                  ? 'text-orange-600 border-orange-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              🔐 Instalador de Túnel
            </button>
            <button
              onClick={() => setActiveTab('erp')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === 'erp'
                  ? 'text-orange-600 border-orange-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              🏢 ERP Cliente
            </button>
            <button
              onClick={() => setActiveTab('conexoes')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === 'conexoes'
                  ? 'text-orange-600 border-orange-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              🔌 Conexões
            </button>
            <button
              onClick={() => setActiveTab('mapeamento')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === 'mapeamento'
                  ? 'text-orange-600 border-orange-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              📋 Mapeamento
            </button>
          </div>

          {/* Conteúdo das Tabs */}
          {activeTab === 'tunnel' && renderTunnelTab()}
          {activeTab === 'erp' && renderErpTab()}
          {activeTab === 'conexoes' && renderConnectionsTab()}
          {activeTab === 'mapeamento' && renderMappingTab()}
        </main>
      </div>

      {/* Modal de Conexão */}
      {showConnectionModal && <ConnectionModal />}

      {/* Modal de Salvar Template ERP */}
      {showSaveTemplateModal && (
        <SaveTemplateModal
          onClose={() => setShowSaveTemplateModal(false)}
          onSave={handleSaveErpTemplate}
        />
      )}

      {/* Modal de PDF */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <h3 className="text-xl font-bold">Gerar PDF</h3>
                    <p className="text-red-200 text-sm">Exportar mapeamento de tabelas</p>
                  </div>
                </div>
                <button onClick={() => setShowPdfModal(false)} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600 mb-4">O que deseja exportar?</p>

              <button
                onClick={() => gerarPdfMapeamento('current')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
              >
                <span className="text-3xl">{BUSINESS_MODULES.find(m => m.id === selectedMainModule)?.submodules.find(s => s.id === selectedSubmodule)?.icon || '📄'}</span>
                <div>
                  <div className="font-bold text-gray-900">Somente aba selecionada</div>
                  <div className="text-sm text-gray-500">
                    {BUSINESS_MODULES.find(m => m.id === selectedMainModule)?.submodules.find(s => s.id === selectedSubmodule)?.name || 'Aba atual'}
                  </div>
                </div>
              </button>

              <button
                onClick={() => gerarPdfMapeamento('all')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
              >
                <span className="text-3xl">📚</span>
                <div>
                  <div className="font-bold text-gray-900">Todos os módulos</div>
                  <div className="text-sm text-gray-500">
                    {BUSINESS_MODULES.reduce((acc, m) => acc + m.submodules.length, 0)} submódulos (Prevenção + Gestão)
                  </div>
                </div>
              </button>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowPdfModal(false)}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente Modal para Salvar Template ERP
function SaveTemplateModal({ onClose, onSave }) {
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('Digite o nome do ERP');
      return;
    }
    setSaving(true);
    try {
      await onSave(templateName.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏢</span>
              <div>
                <h3 className="text-xl font-bold">Salvar Padrão ERP</h3>
                <p className="text-purple-200 text-sm">Salve este mapeamento como template</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
          </div>
        </div>

        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome do ERP *</label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Ex: Intersolid, Zanthus, SAP..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
            autoFocus
          />
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !templateName.trim()}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            {saving ? '⏳ Salvando...' : 'Salvar Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
