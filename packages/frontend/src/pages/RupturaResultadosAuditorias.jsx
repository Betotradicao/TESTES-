import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function RupturaResultadosAuditorias() {
  const navigate = useNavigate();

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState('todos');
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('todos');
  const [auditorSelecionado, setAuditorSelecionado] = useState('todos');

<<<<<<< HEAD
=======
  // Filtros da tabela de produtos
  const [filtroTipoRuptura, setFiltroTipoRuptura] = useState('todos'); // 'todos', 'nao_encontrado', 'ruptura_estoque'
  const [filtroFornecedorTabela, setFiltroFornecedorTabela] = useState('todos');
  const [filtroSetorTabela, setFiltroSetorTabela] = useState('todos');

>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
  // Dados
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [auditores, setAuditores] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

<<<<<<< HEAD
  // Ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: 'criticidade', direcao: 'desc' });

  // Filtros adicionais interativos
  const [filtroFornecedorAtivo, setFiltroFornecedorAtivo] = useState(null);
  const [filtroSetorAtivo, setFiltroSetorAtivo] = useState(null);
  const [tipoRupturaFiltro, setTipoRupturaFiltro] = useState('todos'); // 'todos', 'nao-encontrado', 'em-estoque'

=======
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
  useEffect(() => {
    loadFilterOptions();

    // Definir período padrão: últimos 30 dias
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);

    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(trintaDiasAtras.toISOString().split('T')[0]);
  }, []);

  const loadFilterOptions = async () => {
    try {
      // Buscar produtos únicos
      const produtosRes = await api.get('/rupture-surveys/filters/produtos');
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);

      // Buscar fornecedores únicos
      const fornecedoresRes = await api.get('/rupture-surveys/filters/fornecedores');
      setFornecedores(Array.isArray(fornecedoresRes.data) ? fornecedoresRes.data : []);

      // Buscar auditores (employees) - endpoint retorna { data: [...], total, page, limit }
      const auditoresRes = await api.get('/employees?active=true&limit=100');
      const auditorList = Array.isArray(auditoresRes.data?.data) ? auditoresRes.data.data : [];
      setAuditores(auditorList);
    } catch (err) {
      console.error('Erro ao carregar filtros:', err);
      setProdutos([]);
      setFornecedores([]);
      setAuditores([]);
    }
  };

  const handleFiltrar = async () => {
    if (!dataInicio || !dataFim) {
      setError('Selecione o período (data início e fim)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        data_inicio: dataInicio,
        data_fim: dataFim,
        produto: produtoSelecionado,
        fornecedor: fornecedorSelecionado,
        auditor: auditorSelecionado,
      });

      const response = await api.get(`/rupture-surveys/agregado?${params}`);
      setResultados(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar resultados');
    } finally {
      setLoading(false);
    }
  };

  // Executar filtro automaticamente quando período for definido
  useEffect(() => {
    if (dataInicio && dataFim) {
      handleFiltrar();
    }
  }, [dataInicio, dataFim]);

<<<<<<< HEAD
  const toggleOrdenacao = (campo) => {
    setOrdenacao(prev => {
      if (prev.campo === campo) {
        return { campo, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' };
      } else {
        return { campo, direcao: campo === 'criticidade' ? 'desc' : 'asc' };
      }
    });
  };

  const stats = resultados?.estatisticas || {};
  const itensRuptura = resultados?.itens_ruptura || [];
  const fornecedoresRanking = resultados?.fornecedores_ranking || [];
  const secoesRanking = resultados?.secoes_ranking || [];

  // Debug: Verificar dados
  console.log('🔍 DEBUG - Total itens ruptura:', itensRuptura.length);
  console.log('🔍 DEBUG - TODOS os itens:', itensRuptura.map(i => ({
    produto: i.descricao,
    fornecedor: i.fornecedor,
    setor: i.secao,
    estoque: i.estoque_atual,
    estoqueType: typeof i.estoque_atual
  })));
  console.log('🔍 DEBUG - Filtros ativos:', {
    fornecedor: filtroFornecedorAtivo,
    setor: filtroSetorAtivo,
    tipoRuptura: tipoRupturaFiltro
  });

  // Aplicar filtros interativos (fornecedor, setor, tipo de ruptura)
  const itensFiltrados = itensRuptura.filter(item => {
    // Filtro por fornecedor clicado
    if (filtroFornecedorAtivo && item.fornecedor !== filtroFornecedorAtivo) {
      return false;
    }

    // Filtro por setor clicado
    if (filtroSetorAtivo && item.secao !== filtroSetorAtivo) {
      return false;
    }

    // Filtro por tipo de ruptura
    if (tipoRupturaFiltro === 'nao-encontrado' && item.status_verificacao !== 'nao_encontrado') {
      return false;
    }
    if (tipoRupturaFiltro === 'em-estoque' && item.status_verificacao !== 'ruptura_estoque') {
      return false;
    }

    return true;
  });

  console.log('🔍 DEBUG - Itens após filtro:', itensFiltrados.length);

  // Ordenar itens filtrados
  const itensOrdenados = [...itensFiltrados].sort((a, b) => {
    let valorA, valorB;

    if (ordenacao.campo === 'criticidade') {
      valorA = (a.venda_media_dia || 0) * (a.valor_venda || 0) * (a.margem_lucro || 0);
      valorB = (b.venda_media_dia || 0) * (b.valor_venda || 0) * (b.margem_lucro || 0);
    } else if (ordenacao.campo === 'produto') {
      valorA = (a.descricao || '').toLowerCase();
      valorB = (b.descricao || '').toLowerCase();
    } else if (ordenacao.campo === 'fornecedor') {
      valorA = (a.fornecedor || '').toLowerCase();
      valorB = (b.fornecedor || '').toLowerCase();
    } else if (ordenacao.campo === 'secao') {
      valorA = (a.secao || '').toLowerCase();
      valorB = (b.secao || '').toLowerCase();
    } else if (ordenacao.campo === 'curva') {
      valorA = a.curva || 'Z';
      valorB = b.curva || 'Z';
    } else if (ordenacao.campo === 'estoque') {
      valorA = a.estoque_atual || 0;
      valorB = b.estoque_atual || 0;
    } else if (ordenacao.campo === 'venda_media') {
      valorA = a.venda_media_dia || 0;
      valorB = b.venda_media_dia || 0;
    } else if (ordenacao.campo === 'valor_venda') {
      valorA = a.valor_venda || 0;
      valorB = b.valor_venda || 0;
    } else if (ordenacao.campo === 'margem') {
      valorA = a.margem_lucro || 0;
      valorB = b.margem_lucro || 0;
    } else if (ordenacao.campo === 'pedido') {
      valorA = a.tem_pedido || '';
      valorB = b.tem_pedido || '';
    } else if (ordenacao.campo === 'ocorrencias') {
      valorA = a.ocorrencias || 0;
      valorB = b.ocorrencias || 0;
    } else if (ordenacao.campo === 'perda') {
      valorA = (a.venda_media_dia || 0) * (a.valor_venda || 0);
      valorB = (b.venda_media_dia || 0) * (b.valor_venda || 0);
    }

    if (ordenacao.direcao === 'asc') {
      return valorA > valorB ? 1 : valorA < valorB ? -1 : 0;
    } else {
      return valorA < valorB ? 1 : valorA > valorB ? -1 : 0;
    }
  });

  // Calcular estatísticas de rupturas por tipo
  const calcularEstatisticasRupturas = () => {
    const rupturasNaoEncontrado = itensRuptura.filter(item => item.status_verificacao === 'nao_encontrado').length;
    const rupturasEmEstoque = itensRuptura.filter(item => item.status_verificacao === 'ruptura_estoque').length;

    console.log('🔍 DEBUG - Estatísticas:', {
      total: itensRuptura.length,
      naoEncontrado: rupturasNaoEncontrado,
      emEstoque: rupturasEmEstoque,
      primeiros3Items: itensRuptura.slice(0, 3).map(i => ({
        produto: i.descricao,
        status: i.status_verificacao,
        estoque: i.estoque_atual
      }))
    });

    return { rupturasNaoEncontrado, rupturasEmEstoque };
  };

  const { rupturasNaoEncontrado, rupturasEmEstoque } = calcularEstatisticasRupturas();

  const gerarPDF = () => {
    const doc = new jsPDF();

    // Título
    doc.setFontSize(18);
    doc.text('Relatório Consolidado de Rupturas', 14, 22);

    // Período
    doc.setFontSize(11);
    doc.text(`Período: ${new Date(dataInicio).toLocaleDateString('pt-BR')} até ${new Date(dataFim).toLocaleDateString('pt-BR')}`, 14, 32);

    // Estatísticas
    doc.setFontSize(14);
    doc.text('Estatísticas', 14, 44);
    doc.setFontSize(10);
    doc.text(`Total de Itens Verificados: ${stats.total_itens_verificados || 0}`, 14, 52);
    doc.text(`Encontrados: ${stats.total_encontrados || 0}`, 14, 58);
    doc.text(`Rupturas: ${stats.total_rupturas || 0}`, 14, 64);
    doc.text(`Taxa de Ruptura: ${stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%`, 14, 70);
    doc.text(`Perda Venda no Período: R$ ${Number(stats.perda_venda_periodo || 0).toFixed(2)}`, 14, 76);
    doc.text(`Perda Lucro no Período: R$ ${Number(stats.perda_lucro_periodo || 0).toFixed(2)}`, 14, 82);

    // Tabela de produtos
    const tableData = itensOrdenados.map((item, idx) => {
      const perdaDia = (item.venda_media_dia || 0) * (item.valor_venda || 0);
      return [
        idx + 1,
        item.descricao || '',
        item.fornecedor || 'Sem fornecedor',
        item.secao || '',
        item.curva || '-',
        Number(item.estoque_atual || 0).toFixed(0),
        `R$ ${Number(item.valor_venda || 0).toFixed(2)}`,
        `${Number(item.margem_lucro || 0).toFixed(0)}%`,
        item.ocorrencias || 1,
        `R$ ${Number(item.perda_total || 0).toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: 94,
      head: [['#', 'Produto', 'Fornecedor', 'Seção', 'Curva', 'Estoque', 'V.Venda', 'Margem %', 'Ocorrências', 'Perda Total']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] }
    });

    const periodo = `${dataInicio.replace(/-/g, '')}_${dataFim.replace(/-/g, '')}`;
    doc.save(`ruptura-consolidado-${periodo}.pdf`);
=======
  const stats = resultados?.estatisticas || {};
  const todosItensRuptura = resultados?.itens_ruptura || [];
  const fornecedoresRanking = resultados?.fornecedores_ranking || [];
  const secoesRanking = resultados?.secoes_ranking || [];

  // Aplicar filtros na tabela de produtos
  let itensRuptura = todosItensRuptura;

  // Filtro por tipo de ruptura
  if (filtroTipoRuptura === 'nao_encontrado') {
    itensRuptura = itensRuptura.filter(item => item.ocorrencias_nao_encontrado > 0);
  } else if (filtroTipoRuptura === 'ruptura_estoque') {
    itensRuptura = itensRuptura.filter(item => item.ocorrencias_em_estoque > 0);
  }

  // Filtro por fornecedor (clicado no card)
  if (filtroFornecedorTabela !== 'todos') {
    itensRuptura = itensRuptura.filter(item => item.fornecedor === filtroFornecedorTabela);
  }

  // Filtro por setor (clicado no card)
  if (filtroSetorTabela !== 'todos') {
    itensRuptura = itensRuptura.filter(item => item.secao === filtroSetorTabela);
  }

  // Contar itens por tipo para os botões
  const countTodos = todosItensRuptura.length;
  const countNaoEncontrado = todosItensRuptura.filter(item => item.ocorrencias_nao_encontrado > 0).length;
  const countEmEstoque = todosItensRuptura.filter(item => item.ocorrencias_em_estoque > 0).length;

  // Função para gerar PDF
  const gerarPDF = () => {
    const doc = new jsPDF('landscape'); // Paisagem para caber todas as colunas

    // Título
    doc.setFontSize(16);
    doc.text('Relatório de Rupturas - Resultados Agregados', 14, 15);

    // Período
    doc.setFontSize(10);
    doc.text(`Período: ${dataInicio} até ${dataFim}`, 14, 22);

    // Estatísticas
    doc.setFontSize(12);
    doc.text('Resumo:', 14, 30);
    doc.setFontSize(9);
    doc.text(`Total de Rupturas: ${stats.total_rupturas || 0}`, 14, 36);
    doc.text(`Não Encontrado: ${stats.rupturas_nao_encontrado || 0}`, 14, 41);
    doc.text(`Em Estoque: ${stats.rupturas_em_estoque || 0}`, 14, 46);
    doc.text(`Taxa de Ruptura: ${stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%`, 14, 51);

    // Tabela de produtos
    const tableData = itensRuptura.map((item, idx) => [
      idx + 1,
      item.descricao || '',
      item.fornecedor || 'Sem fornecedor',
      item.secao || 'Sem seção',
      item.curva || '-',
      Number(item.estoque_atual || 0).toFixed(0),
      Number(item.venda_media_dia || 0).toFixed(2),
      `R$ ${Number(item.valor_venda || 0).toFixed(2)}`,
      `${Number(item.margem_lucro || 0).toFixed(1)}%`,
      item.tem_pedido || '-',
      item.ocorrencias || 0,
      `R$ ${Number(item.perda_total || 0).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 56,
      head: [['#', 'Produto', 'Fornecedor', 'Seção', 'Curva', 'Estoque', 'V.Média/Dia', 'Valor Venda', 'Margem %', 'Pedido', 'Ocorrências', 'Perda Total']],
      body: tableData,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [255, 85, 0], textColor: 255 },
      margin: { top: 10 },
    });

    // Salvar PDF
    const nomeArquivo = `rupturas-agregado-${dataInicio}-${dataFim}.pdf`;
    doc.save(nomeArquivo);
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
  };

  return (
    <Layout>
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">📊 Resultados das Auditorias</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Análise agregada de múltiplas pesquisas de ruptura com filtros avançados
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">🔍 Filtros</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Data Início */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Data Fim */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Produto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Produto
              </label>
              <input
                type="text"
                value={produtoSelecionado === 'todos' ? '' : produtoSelecionado}
                onChange={(e) => setProdutoSelecionado(e.target.value || 'todos')}
                placeholder="Digite o nome do produto ou deixe vazio para todos"
                list="produtos-list"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="produtos-list">
                {Array.isArray(produtos) && produtos.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            {/* Fornecedor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fornecedor
              </label>
              <select
                value={fornecedorSelecionado}
                onChange={(e) => setFornecedorSelecionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                {Array.isArray(fornecedores) && fornecedores.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Auditor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auditor
              </label>
              <select
                value={auditorSelecionado}
                onChange={(e) => setAuditorSelecionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                {Array.isArray(auditores) && auditores.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleFiltrar}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '⏳ Carregando...' : '🔍 Aplicar Filtros'}
            </button>
            <button
              onClick={() => {
                setProdutoSelecionado('todos');
                setFornecedorSelecionado('todos');
                setAuditorSelecionado('todos');
              }}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              🔄 Limpar Filtros
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Resultados */}
        {resultados && (
          <>
            {/* KPI Cards */}
<<<<<<< HEAD
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
=======
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-gray-800">{stats.total_itens_verificados || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Itens Verificados</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-green-600">{stats.total_encontrados || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Encontrados</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-red-600">{stats.total_rupturas || 0}</div>
<<<<<<< HEAD
                <div className="text-sm text-gray-600 mt-1">Total de Rupturas</div>
                <div className="mt-2 text-xs text-gray-500">
                  <div><span className="text-red-600">●</span> Ruptura (Não Encontrado): {rupturasNaoEncontrado}</div>
                  <div><span className="text-orange-600">●</span> Ruptura (Em Estoque): {rupturasEmEstoque}</div>
                </div>
=======
                <div className="text-sm text-gray-600 mt-1">Rupturas Total</div>
                {(stats.rupturas_nao_encontrado > 0 || stats.rupturas_em_estoque > 0) && (
                  <div className="text-xs text-gray-500 mt-2">
                    {stats.rupturas_nao_encontrado > 0 && <div>{stats.rupturas_nao_encontrado} Não Encontrado</div>}
                    {stats.rupturas_em_estoque > 0 && <div>{stats.rupturas_em_estoque} Em Estoque</div>}
                  </div>
                )}
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%
                </div>
                <div className="text-sm text-gray-600 mt-1">Taxa Ruptura</div>
              </div>
<<<<<<< HEAD

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-purple-600">{fornecedoresRanking.length}</div>
                <div className="text-sm text-gray-600 mt-1">Fornecedores c/ Rupturas</div>
              </div>
=======
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
            </div>

            {/* Financial Impact - Baseado no Período */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-red-700">
                  R$ {Number(stats.perda_venda_periodo || 0).toFixed(2)}
                </div>
                <div className="text-sm text-red-600 mt-1">Perda Venda no Período</div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-orange-700">
                  R$ {Number(stats.perda_lucro_periodo || 0).toFixed(2)}
                </div>
                <div className="text-sm text-orange-600 mt-1">Perda Lucro no Período</div>
              </div>
            </div>

            {/* Produtos com Ruptura - Largura Total */}
            <div className="mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
<<<<<<< HEAD
                    📦 Produtos com Ruptura ({itensFiltrados.length} de {itensRuptura.length})
                  </h2>

                  {itensRuptura.length > 0 && (
                    <button
                      onClick={gerarPDF}
                      className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                    >
                      📄 PDF
=======
                    📦 Produtos com Ruptura ({itensRuptura.length})
                  </h2>
                  {itensRuptura.length > 0 && (
                    <button
                      onClick={gerarPDF}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      Gerar PDF
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
                    </button>
                  )}
                </div>

<<<<<<< HEAD
                {/* Filtros Interativos */}
                <div className="mb-4 space-y-3">
                  {/* Filtro por Tipo de Ruptura */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">Tipo de Ruptura:</span>
                    <button
                      onClick={() => setTipoRupturaFiltro('todos')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        tipoRupturaFiltro === 'todos'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Todos ({itensRuptura.length})
                    </button>
                    <button
                      onClick={() => setTipoRupturaFiltro('nao-encontrado')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        tipoRupturaFiltro === 'nao-encontrado'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <span className="text-red-600">●</span> Ruptura (Não Encontrado) ({rupturasNaoEncontrado})
                    </button>
                    <button
                      onClick={() => setTipoRupturaFiltro('em-estoque')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        tipoRupturaFiltro === 'em-estoque'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <span className="text-orange-600">●</span> Ruptura (Em Estoque) ({rupturasEmEstoque})
                    </button>
                  </div>

                  {/* Filtros Ativos */}
                  {(filtroFornecedorAtivo || filtroSetorAtivo) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-700">Filtros ativos:</span>
                      {filtroFornecedorAtivo && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                          Fornecedor: {filtroFornecedorAtivo}
                          <button
                            onClick={() => setFiltroFornecedorAtivo(null)}
                            className="ml-1 text-purple-900 hover:text-purple-950 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      )}
                      {filtroSetorAtivo && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded text-sm">
                          Setor: {filtroSetorAtivo}
                          <button
                            onClick={() => setFiltroSetorAtivo(null)}
                            className="ml-1 text-green-900 hover:text-green-950 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setFiltroFornecedorAtivo(null);
                          setFiltroSetorAtivo(null);
                        }}
                        className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                      >
                        Limpar todos
=======
                {/* Filtros de Tipo de Ruptura */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => {
                      setFiltroTipoRuptura('todos');
                      setFiltroFornecedorTabela('todos');
                      setFiltroSetorTabela('todos');
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filtroTipoRuptura === 'todos' && filtroFornecedorTabela === 'todos' && filtroSetorTabela === 'todos'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Todos ({countTodos})
                  </button>
                  <button
                    onClick={() => {
                      setFiltroTipoRuptura('nao_encontrado');
                      setFiltroFornecedorTabela('todos');
                      setFiltroSetorTabela('todos');
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filtroTipoRuptura === 'nao_encontrado'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Não Encontrado ({countNaoEncontrado})
                  </button>
                  <button
                    onClick={() => {
                      setFiltroTipoRuptura('ruptura_estoque');
                      setFiltroFornecedorTabela('todos');
                      setFiltroSetorTabela('todos');
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filtroTipoRuptura === 'ruptura_estoque'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Em Estoque ({countEmEstoque})
                  </button>

                  {/* Indicador de filtro ativo por fornecedor ou setor */}
                  {filtroFornecedorTabela !== 'todos' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-800 rounded-lg">
                      <span className="font-medium">Fornecedor: {filtroFornecedorTabela}</span>
                      <button
                        onClick={() => setFiltroFornecedorTabela('todos')}
                        className="ml-2 text-purple-600 hover:text-purple-900"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {filtroSetorTabela !== 'todos' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg">
                      <span className="font-medium">Setor: {filtroSetorTabela}</span>
                      <button
                        onClick={() => setFiltroSetorTabela('todos')}
                        className="ml-2 text-orange-600 hover:text-orange-900"
                      >
                        ✕
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
                      </button>
                    </div>
                  )}
                </div>

                {itensRuptura.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    🎉 Nenhuma ruptura encontrada no período!
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
<<<<<<< HEAD
                          <th
                            onClick={() => toggleOrdenacao('produto')}
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Produto {ordenacao.campo === 'produto' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('fornecedor')}
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Fornecedor {ordenacao.campo === 'fornecedor' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('secao')}
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Seção {ordenacao.campo === 'secao' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('curva')}
                            className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Curva {ordenacao.campo === 'curva' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('estoque')}
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Estoque {ordenacao.campo === 'estoque' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('venda_media')}
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            V.Média/Dia {ordenacao.campo === 'venda_media' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('valor_venda')}
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Valor Venda {ordenacao.campo === 'valor_venda' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('margem')}
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Margem % {ordenacao.campo === 'margem' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('pedido')}
                            className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Pedido {ordenacao.campo === 'pedido' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('ocorrencias')}
                            className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Ocorrências {ordenacao.campo === 'ocorrencias' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => toggleOrdenacao('perda')}
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          >
                            Perda Total {ordenacao.campo === 'perda' && (ordenacao.direcao === 'asc' ? '↑' : '↓')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {itensOrdenados.map((item, idx) => (
=======
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seção</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Curva</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Estoque</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">V.Média/Dia</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor Venda</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margem %</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pedido</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ocorrências</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Perda Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {itensRuptura.map((item, idx) => (
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800 max-w-xs truncate" title={item.descricao}>
                                {item.descricao}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={item.fornecedor}>
                              {item.fornecedor}
                            </td>
                            <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={item.secao}>
                              {item.secao}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                item.curva === 'A' ? 'bg-red-100 text-red-700' :
                                item.curva === 'B' ? 'bg-yellow-100 text-yellow-700' :
                                item.curva === 'C' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {item.curva}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={item.estoque_atual > 0 ? 'text-green-600' : 'text-red-600'}>
                                {Number(item.estoque_atual || 0).toFixed(0)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {Number(item.venda_media_dia || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              R$ {Number(item.valor_venda || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {Number(item.margem_lucro || 0).toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                item.tem_pedido === 'Sim' ? 'bg-green-100 text-green-700' :
                                item.tem_pedido === 'Não' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {item.tem_pedido || '-'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                                {item.ocorrencias}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="font-bold text-red-600">
                                R$ {Number(item.perda_total || 0).toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Fornecedores e Setores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

              {/* Fornecedores com mais Rupturas */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  🏪 Fornecedores
                </h2>

                {fornecedoresRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma ruptura
                  </p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {fornecedoresRanking.slice(0, 15).map((forn, idx) => {
                      const maxRupturas = Math.max(...fornecedoresRanking.map(f => f.rupturas));
                      const percentage = (forn.rupturas / maxRupturas) * 100;
<<<<<<< HEAD
                      const isAtivo = filtroFornecedorAtivo === forn.fornecedor;
=======
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad

                      return (
                        <div
                          key={idx}
<<<<<<< HEAD
                          onClick={() => setFiltroFornecedorAtivo(isAtivo ? null : forn.fornecedor)}
                          className={`cursor-pointer transition-all rounded-lg p-2 ${
                            isAtivo ? 'bg-purple-50 border-2 border-purple-500' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className={`font-semibold text-sm truncate ${isAtivo ? 'text-purple-700' : 'text-gray-800'}`} title={forn.fornecedor}>
=======
                          onClick={() => {
                            setFiltroFornecedorTabela(forn.fornecedor);
                            setFiltroTipoRuptura('todos');
                            setFiltroSetorTabela('todos');
                          }}
                          className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm truncate" title={forn.fornecedor}>
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
                                {forn.fornecedor}
                              </p>
                              <p className="text-xs text-gray-500">
                                {forn.rupturas} {forn.rupturas === 1 ? 'ruptura' : 'rupturas'}
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-bold text-red-600">
                                R$ {Number(forn.perda_total || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
<<<<<<< HEAD
                              className={`h-2 rounded-full transition-all ${isAtivo ? 'bg-purple-500' : 'bg-red-500'}`}
=======
                              className="bg-red-500 h-2 rounded-full transition-all"
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Setores (Seções) com mais Rupturas */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  🏬 Setores
                </h2>

                {secoesRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma ruptura
                  </p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {secoesRanking.slice(0, 15).map((sec, idx) => {
                      const maxRupturas = Math.max(...secoesRanking.map(s => s.rupturas));
                      const percentage = (sec.rupturas / maxRupturas) * 100;
<<<<<<< HEAD
                      const isAtivo = filtroSetorAtivo === sec.secao;
=======
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad

                      return (
                        <div
                          key={idx}
<<<<<<< HEAD
                          onClick={() => setFiltroSetorAtivo(isAtivo ? null : sec.secao)}
                          className={`cursor-pointer transition-all rounded-lg p-2 ${
                            isAtivo ? 'bg-green-50 border-2 border-green-500' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className={`font-semibold text-sm truncate ${isAtivo ? 'text-green-700' : 'text-gray-800'}`} title={sec.secao}>
=======
                          onClick={() => {
                            setFiltroSetorTabela(sec.secao);
                            setFiltroTipoRuptura('todos');
                            setFiltroFornecedorTabela('todos');
                          }}
                          className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm truncate" title={sec.secao}>
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
                                {sec.secao}
                              </p>
                              <p className="text-xs text-gray-500">
                                {sec.rupturas} {sec.rupturas === 1 ? 'ruptura' : 'rupturas'}
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-bold text-red-600">
                                R$ {Number(sec.perda_total || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
<<<<<<< HEAD
                              className={`h-2 rounded-full transition-all ${isAtivo ? 'bg-green-500' : 'bg-orange-500'}`}
=======
                              className="bg-orange-500 h-2 rounded-full transition-all"
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {!resultados && !loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-xl text-gray-600">
              Selecione um período e clique em "Aplicar Filtros" para ver os resultados
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
