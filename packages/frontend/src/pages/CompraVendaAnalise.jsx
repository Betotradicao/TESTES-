import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import DetalheEmprestimoPopover from '../components/compra-venda/DetalheEmprestimoPopover';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Configuração inicial das colunas
const INITIAL_COLUMNS = [
  { id: 'LOJA', header: 'Loja', align: 'left' },
  { id: 'VENDA_PCT', header: '% Setor', align: 'right' },
  { id: 'SECAO', header: 'Seção', align: 'left', smallFont: true },
  { id: 'COMPRAS', header: 'Compras', align: 'right' },
  { id: 'MARK_DOWN_PCT', header: 'Mark Down (%)', align: 'right' },
  { id: 'MG_LUCRO_PCT', header: 'Mg Lucro (%)', align: 'right' },
  { id: 'QTD_COMPRA', header: 'Qtde Compra', align: 'right' },
  { id: 'QTD_VENDA', header: 'Qtde Venda', align: 'right' },
  { id: 'COMPRA_PCT', header: 'Compra (%)', align: 'right' },
  { id: 'CUSTO_VENDA', header: 'Custo Venda', align: 'right' },
  { id: 'VENDAS', header: 'Vendas', align: 'right' },
  { id: 'META_PCT', header: 'Meta (%)', align: 'right' },
  { id: 'PCT', header: 'Atingido (%)', align: 'right' },
  { id: 'DIFERENCA_PCT', header: 'Dif. (%)', align: 'right' },
  { id: 'DIFERENCA_RS', header: 'Diferença (R$)', align: 'right' },
  { id: 'EMPRESTEI', header: 'Emprestei (R$)', align: 'right', highlight: true },
  { id: 'EMPRESTADO', header: 'Emprestado (R$)', align: 'right', highlight: true },
  { id: 'COMPRA_FINAL', header: 'Compra Final (R$)', align: 'right', highlightGreen: true },
  { id: 'ESTOQUE_ATUAL', header: 'Estoque Atual', align: 'right' },
  { id: 'DIAS_COBERTURA', header: 'Dias Cobertura', align: 'right' },
];

export default function CompraVendaAnalise() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totais, setTotais] = useState(null);

  // Estado para ordem das colunas (drag and drop)
  const [columns, setColumns] = useState(() => {
    // Carregar ordem salva do localStorage
    const savedOrder = localStorage.getItem('compra_venda_columns_order');
    if (savedOrder) {
      try {
        const savedIds = JSON.parse(savedOrder);
        // Reordenar INITIAL_COLUMNS baseado na ordem salva
        const reordered = savedIds
          .map(id => INITIAL_COLUMNS.find(col => col.id === id))
          .filter(Boolean);
        // Adicionar colunas novas que não existiam na ordem salva
        const newColumns = INITIAL_COLUMNS.filter(col => !savedIds.includes(col.id));
        return [...reordered, ...newColumns];
      } catch (e) {
        return INITIAL_COLUMNS;
      }
    }
    return INITIAL_COLUMNS;
  });
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Estado para drill-down (cascata)
  const [expandedSecoes, setExpandedSecoes] = useState({});     // { codSecao: true/false }
  const [expandedGrupos, setExpandedGrupos] = useState({});     // { "codSecao-codGrupo": true/false }
  const [expandedSubGrupos, setExpandedSubGrupos] = useState({}); // { "codSecao-codGrupo-codSubGrupo": true/false }

  // Dados de drill-down carregados
  const [gruposData, setGruposData] = useState({});     // { codSecao: [grupos] }
  const [subgruposData, setSubgruposData] = useState({}); // { "codSecao-codGrupo": [subgrupos] }
  const [itensData, setItensData] = useState({});       // { "codSecao-codGrupo-codSubGrupo": [itens] }
  const [loadingDrillDown, setLoadingDrillDown] = useState({});

  // Filtros - Dados dos dropdowns
  const [secoes, setSecoes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [subgrupos, setSubgrupos] = useState([]);
  const [compradores, setCompradores] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [oracleStatus, setOracleStatus] = useState({ connected: false, message: '' });

  // Filtros - Valores selecionados
  const [filters, setFilters] = useState({
    dataInicio: formatDateForInput(getFirstDayOfMonth()),
    dataFim: formatDateForInput(new Date()),
    codSecao: '',
    codGrupo: '',
    codSubGrupo: '',
    codComprador: '',
    codLoja: '',
    // Tipo Venda
    tipoPdv: true,
    tipoNfCliente: true,
    tipoVendaBalcao: true,
    tipoNfTransferencia: true,
    // Tipo Nota Fiscal
    tipoCompras: true,
    tipoOutras: false,
    tipoBonificacao: false,
    // Produtos Bonificados (filtra por CFOP das compras no período)
    produtosBonificados: 'sem',
    // Detalhamento
    detalhamentoAnalitico: false,
    // Decomposição
    decomposicao: 'filhos',
    // Tipos de Empréstimo (quando "Filhos" selecionado)
    tipoEmprestimoProducao: true,
    tipoEmprestimoAssociacao: true,
    tipoEmprestimoDecomposicao: true,
    // Agrupamento
    agrupamento: 'secao',
    // Exibir
    exibirCn: false,
    exibirTransf: false,
  });

  // Funções auxiliares de data
  function getFirstDayOfMonth() {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function formatDateForInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateForApi(dateStr) {
    // Converte de YYYY-MM-DD para DD/MM/YYYY
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  // Carregar dados dos filtros
  useEffect(() => {
    loadFilterData();
  }, []);

  // Carregar grupos quando seção mudar
  useEffect(() => {
    if (filters.codSecao) {
      loadGrupos(filters.codSecao);
    } else {
      setGrupos([]);
      setFilters(prev => ({ ...prev, codGrupo: '', codSubGrupo: '' }));
    }
  }, [filters.codSecao]);

  // Carregar subgrupos quando grupo mudar
  useEffect(() => {
    if (filters.codGrupo) {
      loadSubgrupos(filters.codGrupo, filters.codSecao);
    } else {
      setSubgrupos([]);
      setFilters(prev => ({ ...prev, codSubGrupo: '' }));
    }
  }, [filters.codGrupo]);

  const loadFilterData = async () => {
    setLoadingFilters(true);
    try {
      // Primeiro testa a conexão Oracle
      const testRes = await api.get('/compra-venda/test-connection').catch(() => ({ data: { success: false, message: 'Falha ao conectar' } }));

      if (testRes.data?.success) {
        setOracleStatus({ connected: true, message: 'Conectado ao Oracle' });

        const [secoesRes, compradoresRes, lojasRes] = await Promise.all([
          api.get('/compra-venda/secoes'),
          api.get('/compra-venda/compradores').catch(() => ({ data: [] })),
          api.get('/compra-venda/lojas').catch(() => ({ data: [] }))
        ]);

        console.log('Seções carregadas:', secoesRes.data);
        console.log('Compradores carregados:', compradoresRes.data);
        console.log('Lojas carregadas:', lojasRes.data);

        setSecoes(secoesRes.data || []);
        setCompradores(compradoresRes.data || []);
        setLojas(lojasRes.data || []);

        if (secoesRes.data?.length > 0) {
          toast.success(`${secoesRes.data.length} seções carregadas do Oracle`);
        }
      } else {
        setOracleStatus({ connected: false, message: testRes.data?.message || 'Sem conexão com Oracle' });
        toast.error('Sem conexão com banco Oracle. Verifique se o backend tem acesso à rede 10.6.1.100');
      }
    } catch (error) {
      console.error('Erro ao carregar filtros:', error);
      setOracleStatus({ connected: false, message: 'Erro ao conectar' });
      toast.error('Erro ao carregar dados dos filtros. Verifique o console.');
    } finally {
      setLoadingFilters(false);
    }
  };

  const loadGrupos = async (codSecao) => {
    try {
      const response = await api.get(`/compra-venda/grupos?codSecao=${codSecao}`);
      setGrupos(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    }
  };

  const loadSubgrupos = async (codGrupo, codSecao) => {
    try {
      let url = `/compra-venda/subgrupos?codGrupo=${codGrupo}`;
      if (codSecao) {
        url += `&codSecao=${codSecao}`;
      }
      console.log('📦 loadSubgrupos - URL:', url, '- codGrupo:', codGrupo, '- codSecao:', codSecao);
      const response = await api.get(url);
      console.log('📦 loadSubgrupos - Retornou', response.data?.length, 'subgrupos');
      setSubgrupos(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar subgrupos:', error);
    }
  };

  const handleSearch = async () => {
    if (!filters.dataInicio || !filters.dataFim) {
      toast.error('Informe as datas de início e fim');
      return;
    }

    setLoading(true);
    // Limpar drill-down ao fazer nova pesquisa
    setExpandedSecoes({});
    setExpandedGrupos({});
    setExpandedSubGrupos({});
    setGruposData({});
    setSubgruposData({});
    setItensData({});

    try {
      const params = new URLSearchParams({
        dataInicio: formatDateForApi(filters.dataInicio),
        dataFim: formatDateForApi(filters.dataFim),
      });

      if (filters.codSecao) params.append('codSecao', filters.codSecao);
      if (filters.codGrupo) params.append('codGrupo', filters.codGrupo);
      if (filters.codSubGrupo) params.append('codSubGrupo', filters.codSubGrupo);
      if (filters.codComprador) params.append('codComprador', filters.codComprador);
      if (filters.codLoja) params.append('codLoja', filters.codLoja);

      // Filtros de Tipo Nota Fiscal (CFOP)
      params.append('tipoCompras', String(filters.tipoCompras));
      params.append('tipoOutras', String(filters.tipoOutras));
      params.append('tipoBonificacao', String(filters.tipoBonificacao));

      // Filtro de Decomposição (pai/filhos)
      params.append('decomposicao', filters.decomposicao);

      // Tipos de Empréstimo (só quando "filhos" selecionado)
      if (filters.decomposicao === 'filhos') {
        params.append('tipoEmprestimoProducao', String(filters.tipoEmprestimoProducao));
        params.append('tipoEmprestimoAssociacao', String(filters.tipoEmprestimoAssociacao));
        params.append('tipoEmprestimoDecomposicao', String(filters.tipoEmprestimoDecomposicao));
      }

      const response = await api.get(`/compra-venda/dados?${params.toString()}`);

      if (response.data.success) {
        setData(response.data.data || []);

        // Calcular totais
        const totalData = response.data.data || [];
        const totaisSoma = totalData.reduce((acc, row) => ({
          QTD_COMPRA: acc.QTD_COMPRA + (row.QTD_COMPRA || 0),
          QTD_VENDA: acc.QTD_VENDA + (row.QTD_VENDA || 0),
          COMPRAS: acc.COMPRAS + (row.COMPRAS || 0),
          CUSTO_VENDA: acc.CUSTO_VENDA + (row.CUSTO_VENDA || 0),
          VENDAS: acc.VENDAS + (row.VENDAS || 0),
          DIFERENCA_RS: acc.DIFERENCA_RS + (row.DIFERENCA_RS || 0),
          TOTAL_IMPOSTO: acc.TOTAL_IMPOSTO + (row.TOTAL_IMPOSTO || 0),
          TOTAL_IMPOSTO_CREDITO: acc.TOTAL_IMPOSTO_CREDITO + (row.TOTAL_IMPOSTO_CREDITO || 0),
          EMPRESTEI: acc.EMPRESTEI + (row.EMPRESTEI || 0),
          EMPRESTADO: acc.EMPRESTADO + (row.EMPRESTADO || 0),
          COMPRA_FINAL: acc.COMPRA_FINAL + (row.COMPRA_FINAL || 0)
        }), {
          QTD_COMPRA: 0,
          QTD_VENDA: 0,
          COMPRAS: 0,
          CUSTO_VENDA: 0,
          VENDAS: 0,
          DIFERENCA_RS: 0,
          TOTAL_IMPOSTO: 0,
          TOTAL_IMPOSTO_CREDITO: 0,
          EMPRESTEI: 0,
          EMPRESTADO: 0,
          COMPRA_FINAL: 0
        });

        // Calcular margens totais
        const vendaLiquida = totaisSoma.VENDAS - totaisSoma.TOTAL_IMPOSTO;
        const lucroLiquido = totaisSoma.VENDAS - totaisSoma.CUSTO_VENDA - totaisSoma.TOTAL_IMPOSTO + totaisSoma.TOTAL_IMPOSTO_CREDITO;

        // MG_LUCRO_PCT = Lucro / Vendas * 100
        const mgLucroTotal = totaisSoma.VENDAS > 0 ? (lucroLiquido / totaisSoma.VENDAS) * 100 : 0;

        // MG_LIQUIDA_PCT = Lucro / (Vendas - Imposto) * 100
        const mgLiquidaTotal = vendaLiquida > 0 ? (lucroLiquido / vendaLiquida) * 100 : 0;

        setTotais({
          ...totaisSoma,
          MG_LUCRO_PCT: Math.round(mgLucroTotal * 100) / 100,
          MG_LIQUIDA_PCT: Math.round(mgLiquidaTotal * 100) / 100
        });

        toast.success(`${response.data.count} registros encontrados`);
      } else {
        toast.error(response.data.message || 'Erro ao buscar dados');
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao conectar com o banco Oracle');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFilters({
      dataInicio: formatDateForInput(getFirstDayOfMonth()),
      dataFim: formatDateForInput(new Date()),
      codSecao: '',
      codGrupo: '',
      codSubGrupo: '',
      codComprador: '',
      codLoja: '',
      tipoPdv: true,
      tipoNfCliente: true,
      tipoVendaBalcao: true,
      tipoNfTransferencia: true,
      tipoCompras: true,
      tipoOutras: false,
      tipoBonificacao: false,
      produtosBonificados: 'sem',
      detalhamentoAnalitico: false,
      decomposicao: 'filhos',
      tipoEmprestimoProducao: true,
      tipoEmprestimoAssociacao: true,
      tipoEmprestimoDecomposicao: true,
      agrupamento: 'secao',
      exibirCn: false,
      exibirTransf: false,
    });
    setData([]);
    setTotais(null);
    // Limpar drill-down
    setExpandedSecoes({});
    setExpandedGrupos({});
    setExpandedSubGrupos({});
    setGruposData({});
    setSubgruposData({});
    setItensData({});
  };

  // Função para exportar PDF
  const handleExportPDF = () => {
    if (data.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }

    const doc = new jsPDF('landscape', 'mm', 'a4');

    // Título
    doc.setFontSize(16);
    doc.text('Relatório Compra x Venda', 14, 15);

    // Subtítulo com período
    doc.setFontSize(10);
    doc.text(`Período: ${filters.dataInicio} a ${filters.dataFim}`, 14, 22);

    // Preparar dados da tabela
    const tableColumns = columns
      .filter(col => !['EMPRESTEI', 'EMPRESTADO'].includes(col.id))
      .map(col => col.header);

    const tableData = data.map(row =>
      columns
        .filter(col => !['EMPRESTEI', 'EMPRESTADO'].includes(col.id))
        .map(col => {
          const value = row[col.id];
          if (col.id.includes('PCT') || col.id === 'MARK_DOWN_PCT' || col.id === 'MG_LUCRO_PCT') {
            return value != null ? `${Number(value).toFixed(2)}%` : '-';
          }
          if (['COMPRAS', 'CUSTO_VENDA', 'VENDAS', 'DIFERENCA_RS', 'COMPRA_FINAL'].includes(col.id)) {
            return value != null ? `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
          }
          if (['QTD_COMPRA', 'QTD_VENDA', 'ESTOQUE_ATUAL'].includes(col.id)) {
            return value != null ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
          }
          if (col.id === 'DIAS_COBERTURA') {
            return value != null ? String(value) : '-';
          }
          return value != null ? String(value) : '-';
        })
    );

    // Adicionar linha de totais
    if (totais) {
      const totaisRow = columns
        .filter(col => !['EMPRESTEI', 'EMPRESTADO'].includes(col.id))
        .map(col => {
          if (col.id === 'SECAO') return 'TOTAIS';
          if (col.id === 'LOJA') return '-';
          if (col.id === 'VENDA_PCT') return '100%';
          if (col.id === 'COMPRA_PCT') return '100%';

          // Calcular valores específicos
          if (col.id === 'MARK_DOWN_PCT') {
            const v = totais.VENDAS > 0 ? ((totais.VENDAS - totais.CUSTO_VENDA) / totais.VENDAS) * 100 : 0;
            return `${v.toFixed(2)}%`;
          }
          if (col.id === 'MG_LUCRO_PCT') {
            return `${(totais.MG_LUCRO_PCT || 0).toFixed(2)}%`;
          }
          if (col.id === 'META_PCT') {
            const v = totais.VENDAS > 0 ? (totais.CUSTO_VENDA / totais.VENDAS) * 100 : 0;
            return `${v.toFixed(2)}%`;
          }
          if (col.id === 'PCT') {
            const v = totais.VENDAS > 0 ? (totais.COMPRA_FINAL / totais.VENDAS) * 100 : 0;
            return `${v.toFixed(2)}%`;
          }
          if (col.id === 'DIFERENCA_PCT') {
            const meta = totais.VENDAS > 0 ? (totais.CUSTO_VENDA / totais.VENDAS) * 100 : 0;
            const pct = totais.VENDAS > 0 ? (totais.COMPRA_FINAL / totais.VENDAS) * 100 : 0;
            return `${(meta - pct).toFixed(2)}%`;
          }

          const value = totais[col.id];
          if (['COMPRAS', 'CUSTO_VENDA', 'VENDAS', 'DIFERENCA_RS', 'COMPRA_FINAL'].includes(col.id)) {
            return value != null ? `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
          }
          if (['QTD_COMPRA', 'QTD_VENDA'].includes(col.id)) {
            return value != null ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
          }
          // Estoque e Dias Cobertura não fazem sentido no total
          if (['ESTOQUE_ATUAL', 'DIAS_COBERTURA'].includes(col.id)) {
            return '-';
          }
          return value != null ? String(value) : '-';
        });
      tableData.push(totaisRow);
    }

    // Encontrar índice da coluna Diferença (R$)
    const colunasVisiveis = columns.filter(col => !['EMPRESTEI', 'EMPRESTADO'].includes(col.id));
    const indexDiferenca = colunasVisiveis.findIndex(col => col.id === 'DIFERENCA_RS');

    // Gerar tabela - ajustado para caber em uma página
    autoTable(doc, {
      head: [tableColumns],
      body: tableData,
      startY: 25,
      margin: { left: 5, right: 5, top: 5, bottom: 5 },
      styles: { fontSize: 7, cellPadding: 1.3 },
      headStyles: { fillColor: [234, 88, 12], textColor: 255, fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      footStyles: { fillColor: [254, 215, 170], fontStyle: 'bold' },
      didParseCell: function(data) {
        // Colorir coluna Diferença (R$)
        if (data.section === 'body' && data.column.index === indexDiferenca) {
          const cellText = data.cell.text[0] || '';
          // Verificar se é negativo (contém '-' após 'R$')
          if (cellText.includes('-')) {
            data.cell.styles.textColor = [220, 38, 38]; // Vermelho
          } else if (cellText.includes('R$') && !cellText.includes('-')) {
            data.cell.styles.textColor = [22, 163, 74]; // Verde
          }
        }
      },
    });

    // Salvar
    const fileName = `compra_venda_${filters.dataInicio.replace(/\//g, '-')}_${filters.dataFim.replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
    toast.success('PDF exportado com sucesso!');
  };

  // ========== FUNÇÕES DE DRILL-DOWN ==========

  // Construir query params para drill-down
  const buildDrillDownParams = () => {
    const params = new URLSearchParams();
    params.append('dataInicio', formatDateForApi(filters.dataInicio));
    params.append('dataFim', formatDateForApi(filters.dataFim));
    if (filters.codLoja) params.append('codLoja', String(filters.codLoja));
    // Converter boolean para string "true"/"false" explicitamente
    params.append('tipoCompras', String(filters.tipoCompras));
    params.append('tipoOutras', String(filters.tipoOutras));
    params.append('tipoBonificacao', String(filters.tipoBonificacao));
    params.append('produtosBonificados', filters.produtosBonificados);
    // Parâmetro de decomposição para cálculo de empréstimos
    params.append('decomposicao', filters.decomposicao);
    // Tipos de Empréstimo (só quando "filhos" selecionado)
    if (filters.decomposicao === 'filhos') {
      params.append('tipoEmprestimoProducao', String(filters.tipoEmprestimoProducao));
      params.append('tipoEmprestimoAssociacao', String(filters.tipoEmprestimoAssociacao));
      params.append('tipoEmprestimoDecomposicao', String(filters.tipoEmprestimoDecomposicao));
    }
    return params;
  };

  // Toggle expansão de Seção -> mostra Grupos
  const toggleSecao = async (codSecao) => {
    // Garantir que codSecao é string para usar como chave
    const secaoKey = String(codSecao);
    const isExpanded = expandedSecoes[secaoKey];

    if (isExpanded) {
      // Colapsar
      setExpandedSecoes(prev => ({ ...prev, [secaoKey]: false }));
    } else {
      // Expandir - carregar grupos se ainda não carregados
      if (!gruposData[secaoKey]) {
        setLoadingDrillDown(prev => ({ ...prev, [`secao-${secaoKey}`]: true }));
        try {
          const params = buildDrillDownParams();
          params.append('codSecao', secaoKey);
          console.log('📊 Buscando grupos da seção:', secaoKey, 'params:', params.toString());
          const response = await api.get(`/compra-venda/drill-down/grupos?${params.toString()}`);
          console.log('📊 Resposta grupos:', response.data);
          if (response.data.success) {
            setGruposData(prev => ({ ...prev, [secaoKey]: response.data.data }));
          }
        } catch (error) {
          console.error('Erro ao carregar grupos:', error);
          toast.error('Erro ao carregar grupos');
        } finally {
          setLoadingDrillDown(prev => ({ ...prev, [`secao-${secaoKey}`]: false }));
        }
      }
      setExpandedSecoes(prev => ({ ...prev, [secaoKey]: true }));
    }
  };

  // Toggle expansão de Grupo -> mostra SubGrupos
  const toggleGrupo = async (codSecao, codGrupo) => {
    // Garantir que os códigos são strings
    const secaoKey = String(codSecao);
    const grupoKey = String(codGrupo);
    const key = `${secaoKey}-${grupoKey}`;
    const isExpanded = expandedGrupos[key];

    if (isExpanded) {
      setExpandedGrupos(prev => ({ ...prev, [key]: false }));
    } else {
      if (!subgruposData[key]) {
        setLoadingDrillDown(prev => ({ ...prev, [`grupo-${key}`]: true }));
        try {
          const params = buildDrillDownParams();
          params.append('codSecao', secaoKey);
          params.append('codGrupo', grupoKey);
          console.log('📊 Buscando subgrupos do grupo:', grupoKey, 'seção:', secaoKey);
          const response = await api.get(`/compra-venda/drill-down/subgrupos?${params.toString()}`);
          console.log('📊 Resposta subgrupos:', response.data);
          if (response.data.success) {
            setSubgruposData(prev => ({ ...prev, [key]: response.data.data }));
          }
        } catch (error) {
          console.error('Erro ao carregar subgrupos:', error);
          toast.error('Erro ao carregar subgrupos');
        } finally {
          setLoadingDrillDown(prev => ({ ...prev, [`grupo-${key}`]: false }));
        }
      }
      setExpandedGrupos(prev => ({ ...prev, [key]: true }));
    }
  };

  // Toggle expansão de SubGrupo -> mostra Itens
  const toggleSubGrupo = async (codSecao, codGrupo, codSubGrupo) => {
    // Garantir que os códigos são strings
    const secaoKey = String(codSecao);
    const grupoKey = String(codGrupo);
    const subgrupoKey = String(codSubGrupo);
    const key = `${secaoKey}-${grupoKey}-${subgrupoKey}`;
    const isExpanded = expandedSubGrupos[key];

    if (isExpanded) {
      setExpandedSubGrupos(prev => ({ ...prev, [key]: false }));
    } else {
      if (!itensData[key]) {
        setLoadingDrillDown(prev => ({ ...prev, [`subgrupo-${key}`]: true }));
        try {
          const params = buildDrillDownParams();
          params.append('codSecao', secaoKey);
          params.append('codGrupo', grupoKey);
          params.append('codSubGrupo', subgrupoKey);
          console.log('📊 Buscando itens do subgrupo:', subgrupoKey, 'grupo:', grupoKey, 'seção:', secaoKey);
          const response = await api.get(`/compra-venda/drill-down/itens?${params.toString()}`);
          console.log('📊 Resposta itens:', response.data);
          if (response.data.success) {
            setItensData(prev => ({ ...prev, [key]: response.data.data }));
          }
        } catch (error) {
          console.error('Erro ao carregar itens:', error);
          toast.error('Erro ao carregar itens');
        } finally {
          setLoadingDrillDown(prev => ({ ...prev, [`subgrupo-${key}`]: false }));
        }
      }
      setExpandedSubGrupos(prev => ({ ...prev, [key]: true }));
    }
  };

  // ========== FIM FUNÇÕES DE DRILL-DOWN ==========

  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined) return '-';
    return Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    return `${formatNumber(value, 2)}%`;
  };

  // Funções de Drag and Drop para colunas
  const handleDragStart = (e, columnId) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    if (draggedColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) return;

    const newColumns = [...columns];
    const draggedIndex = newColumns.findIndex(col => col.id === draggedColumn);
    const targetIndex = newColumns.findIndex(col => col.id === targetColumnId);

    // Remove a coluna arrastada e insere na nova posição
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setColumns(newColumns);
    setDraggedColumn(null);
    setDragOverColumn(null);

    // Salvar ordem no localStorage
    const columnIds = newColumns.map(col => col.id);
    localStorage.setItem('compra_venda_columns_order', JSON.stringify(columnIds));
  };

  // Prepara filtros para o popover de detalhamento
  const getPopoverFilters = () => ({
    dataInicio: formatDateForApi(filters.dataInicio),
    dataFim: formatDateForApi(filters.dataFim),
    codLoja: filters.codLoja || null,
    tipoNotaFiscal: {
      compras: filters.tipoCompras,
      outras: filters.tipoOutras,
      bonificacao: filters.tipoBonificacao
    }
  });

  // Função para renderizar valor da célula baseado no ID da coluna
  // context: { nivel: 'secao'|'grupo'|'subgrupo'|'item', codSecao, codGrupo, codSubGrupo, codProduto }
  const renderCellValue = (row, columnId, isTotal = false, context = null) => {
    if (isTotal && columnId === 'LOJA') return '-';
    if (isTotal && columnId === 'VENDA_PCT') return '100%';
    if (isTotal && columnId === 'SECAO') return 'TOTAIS';
    if (isTotal && columnId === 'COMPRA_PCT') return '100%';

    switch (columnId) {
      case 'LOJA':
        return row.LOJA || 1;
      case 'VENDA_PCT':
        return formatPercent(isTotal ? 100 : row.VENDA_PCT);
      case 'SECAO':
        return row.SECAO;
      case 'COMPRAS':
        return formatCurrency(isTotal ? totais?.COMPRAS : row.COMPRAS);
      case 'MARK_DOWN_PCT':
        if (isTotal && totais) {
          return formatPercent(totais.VENDAS > 0 ? ((totais.VENDAS - totais.CUSTO_VENDA) / totais.VENDAS) * 100 : 0);
        }
        return formatPercent(row.MARK_DOWN_PCT);
      case 'MG_LUCRO_PCT':
        // Margem Lucro = Lucro Líquido / Vendas * 100
        if (isTotal && totais) {
          return formatPercent(totais.MG_LUCRO_PCT);
        }
        return formatPercent(row.MG_LUCRO_PCT);
      case 'QTD_COMPRA':
        return formatNumber(isTotal ? totais?.QTD_COMPRA : row.QTD_COMPRA, 2);
      case 'QTD_VENDA':
        return formatNumber(isTotal ? totais?.QTD_VENDA : row.QTD_VENDA, 1);
      case 'COMPRA_PCT':
        return formatPercent(isTotal ? 100 : row.COMPRA_PCT);
      case 'CUSTO_VENDA':
        return formatCurrency(isTotal ? totais?.CUSTO_VENDA : row.CUSTO_VENDA);
      case 'VENDAS':
        return formatCurrency(isTotal ? totais?.VENDAS : row.VENDAS);
      case 'META_PCT':
        if (isTotal && totais) {
          return formatPercent(totais.VENDAS > 0 ? (totais.CUSTO_VENDA / totais.VENDAS) * 100 : 0);
        }
        return formatPercent(row.META_PCT);
      case 'PCT':
        if (isTotal && totais) {
          // PCT usa COMPRA_FINAL (ajustado com empréstimos), não COMPRAS
          return formatPercent(totais.VENDAS > 0 ? (totais.COMPRA_FINAL / totais.VENDAS) * 100 : 0);
        }
        return formatPercent(row.PCT);
      case 'DIFERENCA_PCT':
        if (isTotal && totais) {
          // Diferença = Meta% - PCT% = (CUSTO_VENDA/VENDAS - COMPRA_FINAL/VENDAS) * 100
          return formatPercent(totais.VENDAS > 0 ? ((totais.CUSTO_VENDA / totais.VENDAS) - (totais.COMPRA_FINAL / totais.VENDAS)) * 100 : 0);
        }
        return formatPercent(row.DIFERENCA_PCT);
      case 'DIFERENCA_RS':
        return formatCurrency(isTotal ? totais?.DIFERENCA_RS : row.DIFERENCA_RS);
      case 'EMPRESTEI': {
        const valor = isTotal ? totais?.EMPRESTEI : row.EMPRESTEI;
        const valorFormatado = formatCurrency(valor);
        // Se tem contexto e valor > 0 e decomposicao = filhos, mostra popover
        if (context && valor > 0 && filters.decomposicao === 'filhos') {
          return (
            <DetalheEmprestimoPopover
              tipo="emprestei"
              nivel={context.nivel}
              codSecao={context.codSecao}
              codGrupo={context.codGrupo}
              codSubGrupo={context.codSubGrupo}
              codProduto={context.codProduto}
              filters={getPopoverFilters()}
              valor={valor}
            >
              <span>{valorFormatado}</span>
            </DetalheEmprestimoPopover>
          );
        }
        return valorFormatado;
      }
      case 'EMPRESTADO': {
        const valor = isTotal ? totais?.EMPRESTADO : row.EMPRESTADO;
        const valorFormatado = formatCurrency(valor);
        // Se tem contexto e valor > 0 e decomposicao = filhos, mostra popover
        if (context && valor > 0 && filters.decomposicao === 'filhos') {
          return (
            <DetalheEmprestimoPopover
              tipo="emprestado"
              nivel={context.nivel}
              codSecao={context.codSecao}
              codGrupo={context.codGrupo}
              codSubGrupo={context.codSubGrupo}
              codProduto={context.codProduto}
              filters={getPopoverFilters()}
              valor={valor}
            >
              <span>{valorFormatado}</span>
            </DetalheEmprestimoPopover>
          );
        }
        return valorFormatado;
      }
      case 'COMPRA_FINAL':
        return formatCurrency(isTotal ? totais?.COMPRA_FINAL : row.COMPRA_FINAL);
      case 'ESTOQUE_ATUAL':
        // Estoque só faz sentido no nível de item (produto individual)
        if (context?.nivel !== 'item') return '-';
        return formatNumber(row.ESTOQUE_ATUAL, 2);
      case 'DIAS_COBERTURA':
        // Dias de cobertura só faz sentido no nível de item (produto individual)
        if (context?.nivel !== 'item') return '-';
        return row.DIAS_COBERTURA != null ? row.DIAS_COBERTURA : '-';
      default:
        return '-';
    }
  };

  // Função para obter classe de cor condicional
  const getCellColorClass = (row, columnId, isTotal = false) => {
    if (columnId === 'DIFERENCA_PCT') {
      const value = isTotal
        ? (totais?.VENDAS > 0 ? ((totais.CUSTO_VENDA / totais.VENDAS) - (totais.COMPRAS / totais.VENDAS)) * 100 : 0)
        : row.DIFERENCA_PCT;
      return value >= 0 ? 'text-green-600' : 'text-red-600';
    }
    if (columnId === 'DIFERENCA_RS') {
      const value = isTotal ? totais?.DIFERENCA_RS : row.DIFERENCA_RS;
      return value >= 0 ? 'text-green-600' : 'text-red-600';
    }
    return 'text-gray-900';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Compra x Venda</h1>
          <div className="w-10" />
        </div>

        {/* Header Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
          <div className="px-4 md:px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">📊 Compras x Vendas por Classificação Mercadológica</h1>
                <p className="text-white/90">Análise comparativa de compras e vendas por seção</p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${oracleStatus.connected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  <div className={`w-2 h-2 rounded-full ${oracleStatus.connected ? 'bg-white animate-pulse' : 'bg-white'}`}></div>
                  <span className="text-sm font-medium">
                    {loadingFilters ? 'Conectando...' : oracleStatus.connected ? 'Oracle' : 'Desconectado'}
                  </span>
                  {!loadingFilters && !oracleStatus.connected && (
                    <button
                      onClick={loadFilterData}
                      className="ml-2 text-xs underline hover:no-underline"
                    >
                      Reconectar
                    </button>
                  )}
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 hidden lg:block">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 md:p-6">

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            {/* Linha 1: Dropdowns principais */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loja</label>
                <select
                  value={filters.codLoja}
                  onChange={(e) => setFilters({ ...filters, codLoja: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={loadingFilters}
                >
                  <option value="">{loadingFilters ? 'Carregando...' : 'Todas'}</option>
                  {lojas.map((l) => (
                    <option key={l.COD_LOJA} value={l.COD_LOJA}>{l.DES_LOJA}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seção</label>
                <select
                  value={filters.codSecao}
                  onChange={(e) => setFilters({ ...filters, codSecao: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={loadingFilters}
                >
                  <option value="">{loadingFilters ? 'Carregando...' : 'Todos'}</option>
                  {secoes.map((s) => (
                    <option key={s.COD_SECAO} value={s.COD_SECAO}>{s.DES_SECAO}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                <select
                  value={filters.codGrupo}
                  onChange={(e) => setFilters({ ...filters, codGrupo: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={!filters.codSecao}
                >
                  <option value="">Todos</option>
                  {grupos.map((g) => (
                    <option key={g.COD_GRUPO} value={g.COD_GRUPO}>{g.DES_GRUPO}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SubGrupo</label>
                <select
                  value={filters.codSubGrupo}
                  onChange={(e) => setFilters({ ...filters, codSubGrupo: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={!filters.codGrupo}
                >
                  <option value="">Todos</option>
                  {subgrupos.map((sg) => (
                    <option key={sg.COD_SUB_GRUPO} value={sg.COD_SUB_GRUPO}>{sg.DES_SUB_GRUPO}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comprador</label>
                <select
                  value={filters.codComprador}
                  onChange={(e) => setFilters({ ...filters, codComprador: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={loadingFilters}
                >
                  <option value="">{loadingFilters ? 'Carregando...' : 'Todos'}</option>
                  {compradores.map((c) => (
                    <option key={c.COD_COMPRADOR} value={c.COD_COMPRADOR}>{c.DES_COMPRADOR}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 2: Datas e checkboxes */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                <input
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.exibirCn}
                    onChange={(e) => setFilters({ ...filters, exibirCn: e.target.checked })}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  C.N.?
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.exibirTransf}
                    onChange={(e) => setFilters({ ...filters, exibirTransf: e.target.checked })}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  Exibir Transf.?
                </label>
              </div>
            </div>

            {/* Linha 3: Tipo Venda, Tipo NF, Prod. Bonificados, Decomposição + Cards de Margem */}
            <div className="grid grid-cols-1 md:grid-cols-8 gap-1 mb-4">
              {/* Filtro Tipo Venda - Compacto */}
              <div className="border border-gray-200 rounded-md p-2">
                <span className="block text-xs font-medium text-gray-700 mb-1">Tipo Venda</span>
                <div className="space-y-0.5">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={filters.tipoPdv}
                      onChange={(e) => setFilters({ ...filters, tipoPdv: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    PDV
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={filters.tipoNfCliente}
                      onChange={(e) => setFilters({ ...filters, tipoNfCliente: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    N.F. Cliente
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={filters.tipoVendaBalcao}
                      onChange={(e) => setFilters({ ...filters, tipoVendaBalcao: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    Venda Balcao
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={filters.tipoNfTransferencia}
                      onChange={(e) => setFilters({ ...filters, tipoNfTransferencia: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    N.F. Transf.
                  </label>
                </div>
              </div>

              {/* Filtro Tipo NF - Compacto */}
              <div className="border border-gray-200 rounded-md p-2">
                <span className="block text-xs font-medium text-gray-700 mb-1">Tipo Nota Fiscal</span>
                <div className="space-y-0.5">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={filters.tipoCompras}
                      onChange={(e) => setFilters({ ...filters, tipoCompras: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    Compras
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={filters.tipoOutras}
                      onChange={(e) => setFilters({ ...filters, tipoOutras: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    Outras
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={filters.tipoBonificacao}
                      onChange={(e) => setFilters({ ...filters, tipoBonificacao: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    Bonificacao
                  </label>
                </div>
              </div>

              {/* Filtro Produtos Bonificados - Compacto */}
              {/* Controla automaticamente o checkbox de Bonificação no Tipo Nota Fiscal */}
              <div className="border border-gray-200 rounded-md p-2">
                <span className="block text-xs font-medium text-gray-700 mb-1">Prod. Bonific.</span>
                <div className="space-y-0.5">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="produtosBonificados"
                      value="com"
                      checked={filters.produtosBonificados === 'com'}
                      onChange={(e) => setFilters({ ...filters, produtosBonificados: e.target.value, tipoCompras: true, tipoBonificacao: true })}
                      className="border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    Com
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="produtosBonificados"
                      value="sem"
                      checked={filters.produtosBonificados === 'sem'}
                      onChange={(e) => setFilters({ ...filters, produtosBonificados: e.target.value, tipoCompras: true, tipoBonificacao: false })}
                      className="border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    Sem
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="produtosBonificados"
                      value="somente"
                      checked={filters.produtosBonificados === 'somente'}
                      onChange={(e) => setFilters({ ...filters, produtosBonificados: e.target.value, tipoCompras: false, tipoBonificacao: true })}
                      className="border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    Somente
                  </label>
                </div>
              </div>

              {/* Filtro Decomposicao - Compacto */}
              <div className="border border-gray-200 rounded-md p-2">
                <span className="block text-xs font-medium text-gray-700 mb-1">Decomposicao</span>
                <div className="space-y-0.5">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="decomposicao"
                      value="pai"
                      checked={filters.decomposicao === 'pai'}
                      onChange={(e) => setFilters({ ...filters, decomposicao: e.target.value })}
                      className="border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    Pai
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="decomposicao"
                      value="filhos"
                      checked={filters.decomposicao === 'filhos'}
                      onChange={(e) => setFilters({ ...filters, decomposicao: e.target.value })}
                      className="border-gray-300 text-orange-600 focus:ring-orange-500 w-3 h-3"
                    />
                    Filhos
                  </label>
                </div>
                {filters.decomposicao === 'filhos' && (
                  <div className="mt-1 pt-1 border-t border-gray-200">
                    <span className="block text-[10px] font-medium text-gray-600 mb-0.5">Emprestimo:</span>
                    <div className="space-y-0.5">
                      <label className="flex items-center gap-1 text-[10px]">
                        <input
                          type="checkbox"
                          checked={filters.tipoEmprestimoProducao}
                          onChange={(e) => setFilters({ ...filters, tipoEmprestimoProducao: e.target.checked })}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-2.5 h-2.5"
                        />
                        Producao
                      </label>
                      <label className="flex items-center gap-1 text-[10px]">
                        <input
                          type="checkbox"
                          checked={filters.tipoEmprestimoAssociacao}
                          onChange={(e) => setFilters({ ...filters, tipoEmprestimoAssociacao: e.target.checked })}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-2.5 h-2.5"
                        />
                        Assoc.
                      </label>
                      <label className="flex items-center gap-1 text-[10px]">
                        <input
                          type="checkbox"
                          checked={filters.tipoEmprestimoDecomposicao}
                          onChange={(e) => setFilters({ ...filters, tipoEmprestimoDecomposicao: e.target.checked })}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-2.5 h-2.5"
                        />
                        Decomp.
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 1: Mark Down Atual */}
              <div className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50">
                <div className="text-center">
                  <span className="block text-xs font-bold text-blue-800 uppercase">Mark Down</span>
                  <span className="block text-xs font-medium text-blue-700">Atual</span>
                  {totais ? (
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-blue-600">
                        {(totais.VENDAS > 0 ? ((totais.VENDAS - totais.CUSTO_VENDA) / totais.VENDAS) * 100 : 0).toFixed(2)}%
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-gray-400">--%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Excesso de Compras ou Perdas */}
              <div className="border-2 border-purple-300 rounded-lg p-3 bg-purple-50">
                <div className="text-center">
                  <span className="block text-xs font-bold text-purple-800 uppercase">Excesso de Compras</span>
                  <span className="block text-xs font-medium text-purple-700">ou Perdas</span>
                  {totais ? (
                    <>
                      <div className="mt-1">
                        <span className={`text-2xl font-bold ${totais.VENDAS > 0 && ((totais.CUSTO_VENDA / totais.VENDAS) - (totais.COMPRA_FINAL / totais.VENDAS)) * 100 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(totais.VENDAS > 0 ? ((totais.CUSTO_VENDA / totais.VENDAS) - (totais.COMPRA_FINAL / totais.VENDAS)) * 100 : 0).toFixed(2)}%
                        </span>
                      </div>
                      <div className={`text-xl font-bold mt-0.5 ${(totais.DIFERENCA_RS || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        R$ {(totais.DIFERENCA_RS || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-gray-400">--%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Margem Compra e Venda */}
              <div className="border-2 border-orange-300 rounded-lg p-3 bg-orange-50">
                <div className="text-center">
                  <span className="block text-xs font-bold text-orange-800 uppercase">Margem</span>
                  <span className="block text-xs font-medium text-orange-700">Compra e Venda</span>
                  {totais ? (
                    <>
                      <div className="mt-2">
                        <span className="text-3xl font-bold text-orange-600">
                          {(() => {
                            // Mark Down = (Vendas - Custo) / Vendas
                            const markDown = totais.VENDAS > 0 ? ((totais.VENDAS - totais.CUSTO_VENDA) / totais.VENDAS) * 100 : 0;
                            // Dif = Meta - PCT = (Custo/Vendas) - (Compra Final/Vendas)
                            const dif = totais.VENDAS > 0 ? ((totais.CUSTO_VENDA / totais.VENDAS) - (totais.COMPRA_FINAL / totais.VENDAS)) * 100 : 0;
                            // Margem = Mark Down + Dif (Dif já é negativo quando PCT > Meta)
                            return (markDown + dif).toFixed(2);
                          })()}%
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        Mark Down - Atingido
                      </div>
                    </>
                  ) : (
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-gray-400">--%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Margem Limpo de Impostos */}
              <div className="border-2 border-green-300 rounded-lg p-3 bg-green-50">
                <div className="text-center">
                  <span className="block text-xs font-bold text-green-800 uppercase">Margem Compra e Venda</span>
                  <span className="block text-xs font-medium text-green-700">Limpo de Impostos</span>
                  {totais ? (
                    <>
                      <div className="mt-2">
                        <span className="text-3xl font-bold text-green-600">
                          {(() => {
                            // Mg Lucro total
                            const mgLucro = totais.MG_LUCRO_PCT || 0;
                            // Dif = Meta - PCT = (Custo/Vendas) - (Compra Final/Vendas)
                            const dif = totais.VENDAS > 0 ? ((totais.CUSTO_VENDA / totais.VENDAS) - (totais.COMPRA_FINAL / totais.VENDAS)) * 100 : 0;
                            // Margem Limpo = Mg Lucro + Dif (quando Dif é negativo, subtrai)
                            return (mgLucro + dif).toFixed(2);
                          })()}%
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        Mg Lucro + Dif
                      </div>
                    </>
                  ) : (
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-gray-400">--%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Linha 4: Botões */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Buscando...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Pesquisar
                    </>
                  )}
                </button>

                <button
                  onClick={handleClear}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Limpar
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={data.length === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Resultados */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-orange-100">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, col.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.id)}
                        className={`px-3 py-3 text-xs font-medium text-orange-800 uppercase tracking-wider cursor-move select-none transition-all whitespace-nowrap
                          ${col.align === 'right' ? 'text-right' : 'text-left'}
                          ${dragOverColumn === col.id ? 'bg-orange-200 border-l-2 border-orange-500' : ''}
                          ${draggedColumn === col.id ? 'opacity-50' : ''}
                          ${col.highlight ? 'bg-orange-200 font-bold' : ''}
                          ${col.highlightGreen ? 'bg-green-200 font-bold' : ''}
                          hover:bg-orange-200
                        `}
                        style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                        title="Arraste para reordenar"
                      >
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                          </svg>
                          <span>{col.header}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                        {loading ? 'Carregando...' : 'Nenhum dado encontrado. Clique em Pesquisar para buscar os dados.'}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {data
                        .slice()
                        .sort((a, b) => (a.SECAO || '').localeCompare(b.SECAO || ''))
                        .map((secaoRow) => {
                          // Garantir consistência: usar String() para chaves
                          const codSecao = secaoRow.COD_SECAO;
                          const secaoKey = String(codSecao);
                          const isSecaoExpanded = expandedSecoes[secaoKey];
                          const isLoadingGrupos = loadingDrillDown[`secao-${secaoKey}`];

                          return (
                            <React.Fragment key={`secao-${codSecao}`}>
                              {/* LINHA DA SEÇÃO */}
                              <tr className="hover:bg-gray-50 bg-orange-50/30">
                                {columns.map((col) => (
                                  <td
                                    key={col.id}
                                    className={`px-3 py-2 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${getCellColorClass(secaoRow, col.id)} ${col.highlight ? 'bg-orange-100' : ''} ${col.highlightGreen ? 'bg-green-100' : ''}`}
                                  >
                                    {col.id === 'SECAO' ? (
                                      <button
                                        onClick={() => toggleSecao(codSecao)}
                                        className="flex items-center gap-1 font-semibold text-gray-900 hover:text-orange-600 transition-colors whitespace-nowrap text-xs"
                                      >
                                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold transition-colors ${isSecaoExpanded ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-orange-200'}`}>
                                          {isLoadingGrupos ? (
                                            <svg className="animate-spin h-2 w-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                          ) : isSecaoExpanded ? '−' : '+'}
                                        </span>
                                        {secaoRow.SECAO}
                                      </button>
                                    ) : renderCellValue(secaoRow, col.id, false, { nivel: 'secao', codSecao })}
                                  </td>
                                ))}
                              </tr>

                              {/* LINHAS DOS GRUPOS (quando seção expandida) */}
                              {isSecaoExpanded && gruposData[secaoKey]?.map((grupoRow) => {
                                const codGrupo = grupoRow.COD_GRUPO;
                                const grupoKey = `${secaoKey}-${String(codGrupo)}`;
                                const isGrupoExpanded = expandedGrupos[grupoKey];
                                const isLoadingSubGrupos = loadingDrillDown[`grupo-${grupoKey}`];

                                return (
                                  <React.Fragment key={`grupo-${grupoKey}`}>
                                    {/* LINHA DO GRUPO */}
                                    <tr className="hover:bg-blue-50/50 bg-blue-50/20">
                                      {columns.map((col) => (
                                        <td
                                          key={col.id}
                                          className={`px-3 py-2 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${getCellColorClass(grupoRow, col.id)} ${col.highlight ? 'bg-orange-100' : ''} ${col.highlightGreen ? 'bg-green-100' : ''}`}
                                        >
                                          {col.id === 'SECAO' ? (
                                            <button
                                              onClick={() => toggleGrupo(codSecao, codGrupo)}
                                              className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors pl-6"
                                            >
                                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold transition-colors ${isGrupoExpanded ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-blue-200'}`}>
                                                {isLoadingSubGrupos ? (
                                                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                                ) : isGrupoExpanded ? '−' : '+'}
                                              </span>
                                              {grupoRow.GRUPO}
                                            </button>
                                          ) : col.id === 'LOJA' ? (grupoRow.LOJA || '-') : renderCellValue(grupoRow, col.id, false, { nivel: 'grupo', codSecao, codGrupo })}
                                        </td>
                                      ))}
                                    </tr>

                                    {/* LINHAS DOS SUBGRUPOS (quando grupo expandido) */}
                                    {isGrupoExpanded && subgruposData[grupoKey]?.map((subgrupoRow) => {
                                      const codSubGrupo = subgrupoRow.COD_SUB_GRUPO;
                                      const subgrupoKeyFull = `${secaoKey}-${String(codGrupo)}-${String(codSubGrupo)}`;
                                      const isSubGrupoExpanded = expandedSubGrupos[subgrupoKeyFull];
                                      const isLoadingItens = loadingDrillDown[`subgrupo-${subgrupoKeyFull}`];

                                      return (
                                        <React.Fragment key={`subgrupo-${subgrupoKeyFull}`}>
                                          {/* LINHA DO SUBGRUPO */}
                                          <tr className="hover:bg-yellow-100 bg-yellow-50">
                                            {columns.map((col) => (
                                              <td
                                                key={col.id}
                                                className={`px-3 py-2 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${getCellColorClass(subgrupoRow, col.id)} ${col.highlight ? 'bg-orange-100' : ''} ${col.highlightGreen ? 'bg-green-100' : ''}`}
                                              >
                                                {col.id === 'SECAO' ? (
                                                  <button
                                                    onClick={() => toggleSubGrupo(codSecao, codGrupo, codSubGrupo)}
                                                    className="flex items-center gap-2 text-gray-700 hover:text-amber-600 transition-colors pl-12"
                                                  >
                                                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold transition-colors ${isSubGrupoExpanded ? 'bg-amber-500 text-white' : 'bg-amber-200 text-amber-700 hover:bg-amber-300'}`}>
                                                      {isLoadingItens ? (
                                                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                                      ) : isSubGrupoExpanded ? '−' : '+'}
                                                    </span>
                                                    {subgrupoRow.SUBGRUPO}
                                                  </button>
                                                ) : col.id === 'LOJA' ? (subgrupoRow.LOJA || '-') : renderCellValue(subgrupoRow, col.id, false, { nivel: 'subgrupo', codSecao, codGrupo, codSubGrupo })}
                                              </td>
                                            ))}
                                          </tr>

                                          {/* LINHAS DOS ITENS/PRODUTOS (quando subgrupo expandido) */}
                                          {isSubGrupoExpanded && itensData[subgrupoKeyFull]?.map((itemRow, itemIdx) => (
                                            <tr key={`item-${subgrupoKeyFull}-${itemIdx}`} className="hover:bg-purple-50/50 bg-purple-50/10">
                                              {columns.map((col) => (
                                                <td
                                                  key={col.id}
                                                  className={`px-3 py-2 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${getCellColorClass(itemRow, col.id)} ${col.highlight ? 'bg-orange-100' : ''} ${col.highlightGreen ? 'bg-green-100' : ''}`}
                                                >
                                                  {col.id === 'SECAO' ? (
                                                    <span className="text-gray-500 pl-20 flex items-center gap-2">
                                                      <span className="w-2 h-2 rounded-full bg-purple-300"></span>
                                                      {itemRow.PRODUTO}
                                                    </span>
                                                  ) : col.id === 'LOJA' ? (itemRow.LOJA || '-') : renderCellValue(itemRow, col.id, false, { nivel: 'item', codSecao, codGrupo, codSubGrupo, codProduto: itemRow.COD_PRODUTO })}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </React.Fragment>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      {/* Linha de Totais */}
                      {totais && (
                        <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                          {columns.map((col) => (
                            <td
                              key={col.id}
                              className={`px-3 py-2 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${getCellColorClass({}, col.id, true)} ${col.highlight ? 'bg-orange-200' : ''} ${col.highlightGreen ? 'bg-green-200' : ''}`}
                            >
                              {renderCellValue({}, col.id, true)}
                            </td>
                          ))}
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé com informações */}
            {data.length > 0 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
                {data.length} registros encontrados | Fonte: Oracle Intersolid (somente leitura)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
