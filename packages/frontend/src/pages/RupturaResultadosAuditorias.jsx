import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';

export default function RupturaResultadosAuditorias() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Verificar se usuário pode excluir (admin ou master)
  const canDelete = user?.role === 'admin' || user?.isMaster;

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState('todos');
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('todos');
  const [auditorSelecionado, setAuditorSelecionado] = useState('todos');

  // Filtros da tabela de produtos
  const [filtroTipoRuptura, setFiltroTipoRuptura] = useState('todos'); // 'todos', 'nao_encontrado', 'ruptura_estoque'
  const [filtroFornecedorTabela, setFiltroFornecedorTabela] = useState('todos');
  const [filtroSetorTabela, setFiltroSetorTabela] = useState('todos');

  // Estado de ordenação
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' ou 'desc'

  // Dados
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [auditores, setAuditores] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingProduct, setDeletingProduct] = useState(null); // código do produto sendo excluído

  useEffect(() => {
    loadFilterOptions();

    // Definir período padrão: dia 1 do mês atual até hoje
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(primeiroDiaMes.toISOString().split('T')[0]);
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

  // Função para ordenar
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Se já está ordenando por essa coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nova coluna, começa com ascendente
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Função para excluir ruptura por descrição do produto
  const handleDeleteRuptura = async (descricaoProduto, descricaoExibicao) => {
    if (!canDelete) {
      alert('Você não tem permissão para excluir rupturas.');
      return;
    }

    const confirmMessage = `Tem certeza que deseja excluir todas as rupturas do produto:\n\n"${descricaoExibicao}"\n\nNo período de ${dataInicio} a ${dataFim}?\n\nEsta ação não pode ser desfeita.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingProduct(descricaoProduto);
    try {
      // Usar encodeURIComponent para codificar a descrição na URL
      const response = await api.delete(`/rupture-surveys/by-product/${encodeURIComponent(descricaoProduto)}?data_inicio=${dataInicio}&data_fim=${dataFim}`);

      if (response.data.success) {
        alert(`${response.data.deletedCount} registro(s) excluído(s) com sucesso!`);
        // Recarregar dados para atualizar totais
        handleFiltrar();
      }
    } catch (err) {
      console.error('Erro ao excluir ruptura:', err);
      alert(err.response?.data?.error || 'Erro ao excluir ruptura');
    } finally {
      setDeletingProduct(null);
    }
  };


  // Aplicar ordenação
  if (sortColumn) {
    itensRuptura = [...itensRuptura].sort((a, b) => {
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];

      // Tratamento especial para valores numéricos
      if (['estoque_atual', 'venda_media_dia', 'valor_venda', 'margem_lucro', 'ocorrencias', 'perda_total'].includes(sortColumn)) {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else {
        // Para strings, converter para minúsculas para comparação
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                <div className="text-sm text-gray-600 mt-1">Rupturas Total</div>
                {(stats.rupturas_nao_encontrado > 0 || stats.rupturas_em_estoque > 0) && (
                  <div className="text-xs text-gray-500 mt-2">
                    {stats.rupturas_nao_encontrado > 0 && <div>{stats.rupturas_nao_encontrado} Não Encontrado</div>}
                    {stats.rupturas_em_estoque > 0 && <div>{stats.rupturas_em_estoque} Em Estoque</div>}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%
                </div>
                <div className="text-sm text-gray-600 mt-1">Taxa Ruptura</div>
              </div>
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
                    </button>
                  )}
                </div>

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
                          <th
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('descricao')}
                          >
                            <div className="flex items-center gap-1">
                              Produto
                              {sortColumn === 'descricao' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('fornecedor')}
                          >
                            <div className="flex items-center gap-1">
                              Fornecedor
                              {sortColumn === 'fornecedor' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('secao')}
                          >
                            <div className="flex items-center gap-1">
                              Seção
                              {sortColumn === 'secao' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('curva')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              Curva
                              {sortColumn === 'curva' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('estoque_atual')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Estoque
                              {sortColumn === 'estoque_atual' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('venda_media_dia')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              V.Média/Dia
                              {sortColumn === 'venda_media_dia' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('valor_venda')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Valor Venda
                              {sortColumn === 'valor_venda' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('margem_lucro')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Margem %
                              {sortColumn === 'margem_lucro' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('tem_pedido')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              Pedido
                              {sortColumn === 'tem_pedido' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('ocorrencias')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              Ocorrências
                              {sortColumn === 'ocorrencias' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('perda_total')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Perda Total
                              {sortColumn === 'perda_total' && (
                                <span className="text-blue-600">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          {canDelete && (
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                              Ação
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {itensRuptura.map((item, idx) => (
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
                            {canDelete && (
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => handleDeleteRuptura(item.descricao, item.descricao)}
                                  disabled={deletingProduct === item.descricao}
                                  className={`p-1.5 rounded transition-colors ${
                                    deletingProduct === item.descricao
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : 'bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700'
                                  }`}
                                  title="Excluir ruptura"
                                >
                                  {deletingProduct === item.descricao ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                  )}
                                </button>
                              </td>
                            )}
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

                      return (
                        <div
                          key={idx}
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
                              className="bg-red-500 h-2 rounded-full transition-all"
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

                      return (
                        <div
                          key={idx}
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
                              className="bg-orange-500 h-2 rounded-full transition-all"
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
