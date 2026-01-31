import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function EtiquetaResultadosAuditorias() {
  const navigate = useNavigate();

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState('todos');
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('todos');
  const [auditorSelecionado, setAuditorSelecionado] = useState('todos');

  // Filtros da tabela de produtos
  const [filtroTipoEtiqueta, setFiltroTipoEtiqueta] = useState('todos'); // 'todos', 'preco_divergente', 'preco_divergente'
  const [filtroFornecedorTabela, setFiltroFornecedorTabela] = useState('todos');
  const [filtroSetorTabela, setFiltroSetorTabela] = useState('todos');

  // Dados
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [auditores, setAuditores] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secoesMap, setSecoesMap] = useState({}); // Mapeamento código -> nome da seção

  useEffect(() => {
    loadFilterOptions();
    loadSecoesOracle();

    // Definir período padrão: dia 1 do mês atual até hoje
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(primeiroDiaMes.toISOString().split('T')[0]);
  }, []);

  // Carregar seções do Oracle para mapeamento código -> nome
  const loadSecoesOracle = async () => {
    try {
      const response = await api.get('/products/sections-oracle');
      const map = {};
      response.data.forEach(sec => {
        map[sec.codigo] = sec.nome;
        map[String(sec.codigo)] = sec.nome;
      });
      setSecoesMap(map);
    } catch (err) {
      console.error('Erro ao carregar seções Oracle:', err);
    }
  };

  // Função para formatar seção (código + nome ou só nome)
  const formatSecao = (secao) => {
    if (!secao) return 'Sem seção';
    // Se for um número, busca o nome no mapeamento
    if (!isNaN(secao) && secoesMap[secao]) {
      return `${secao} - ${secoesMap[secao]}`;
    }
    // Se já for o nome completo ou não encontrar mapeamento
    return secao;
  };

  const loadFilterOptions = async () => {
    try {
      // Buscar produtos únicos
      const produtosRes = await api.get('/label-audits/filters/produtos');
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);

      // Buscar fornecedores únicos
      const fornecedoresRes = await api.get('/label-audits/filters/fornecedores');
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

      const response = await api.get(`/label-audits/agregado?${params}`);
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
  const todosItensEtiqueta = resultados?.itens_ruptura || [];
  const fornecedoresRanking = resultados?.fornecedores_ranking || [];
  const secoesRanking = resultados?.secoes_ranking || [];
  const valoresSecoesRanking = resultados?.valores_secoes_ranking || [];
  const divergentesPorDia = resultados?.divergentes_por_dia || [];

  // Aplicar filtros na tabela de produtos
  let itensEtiqueta = todosItensEtiqueta;

  // Filtro por tipo de ruptura
  if (filtroTipoEtiqueta === 'preco_divergente') {
    itensEtiqueta = itensEtiqueta.filter(item => item.ocorrencias_nao_encontrado > 0);
  } else if (filtroTipoEtiqueta === 'preco_divergente') {
    itensEtiqueta = itensEtiqueta.filter(item => item.ocorrencias_em_estoque > 0);
  }

  // Filtro por fornecedor (clicado no card)
  if (filtroFornecedorTabela !== 'todos') {
    itensEtiqueta = itensEtiqueta.filter(item => item.fornecedor === filtroFornecedorTabela);
  }

  // Filtro por setor (clicado no card)
  if (filtroSetorTabela !== 'todos') {
    itensEtiqueta = itensEtiqueta.filter(item => item.secao === filtroSetorTabela);
  }

  // Contar itens por tipo para os botões
  const countTodos = todosItensEtiqueta.length;
  const countNaoCorreto = todosItensEtiqueta.filter(item => item.ocorrencias_nao_encontrado > 0).length;
  const countEmEstoque = todosItensEtiqueta.filter(item => item.ocorrencias_em_estoque > 0).length;

  // Função para gerar PDF
  const gerarPDF = () => {
    const doc = new jsPDF('landscape'); // Paisagem para caber todas as colunas

    // Título
    doc.setFontSize(16);
    doc.text('Relatório de Etiquetas - Resultados Agregados', 14, 15);

    // Período
    doc.setFontSize(10);
    doc.text(`Período: ${dataInicio} até ${dataFim}`, 14, 22);

    // Estatísticas
    doc.setFontSize(12);
    doc.text('Resumo:', 14, 30);
    doc.setFontSize(9);
    doc.text(`Total de Etiquetas: ${stats.total_rupturas || 0}`, 14, 36);
    doc.text(`Não Correto: ${stats.rupturas_nao_encontrado || 0}`, 14, 41);
    doc.text(`Em Estoque: ${stats.rupturas_em_estoque || 0}`, 14, 46);
    doc.text(`Taxa de Etiqueta: ${stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%`, 14, 51);

    // Tabela de produtos
    const tableData = itensEtiqueta.map((item, idx) => [
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-gray-800">{stats.total_itens_verificados || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Itens Verificados</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-green-600">{stats.total_encontrados || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Corretos</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-red-600">{stats.total_rupturas || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Etiquetas Desconformes</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%
                </div>
                <div className="text-sm text-gray-600 mt-1">Taxa Etiqueta Desconformes</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-yellow-600">
                  R$ {Number(stats.valor_total_divergentes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-gray-600 mt-1">Valor Total Desconformes</div>
              </div>
            </div>

            {/* 3 Cards lado a lado: Setores, Dias da Semana, Valores por Setor */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

              {/* Card 1: Setores */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  🏬 Setores
                </h2>

                {secoesRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum produto sem etiqueta
                  </p>
                ) : (
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {secoesRanking.slice(0, 10).map((sec, idx) => {
                      const maxEtiquetas = Math.max(...secoesRanking.map(s => s.rupturas));
                      const percentage = (sec.rupturas / maxEtiquetas) * 100;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setFiltroSetorTabela(sec.secao);
                            setFiltroTipoEtiqueta('todos');
                            setFiltroFornecedorTabela('todos');
                          }}
                          className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm truncate" title={formatSecao(sec.secao)}>
                                {formatSecao(sec.secao)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {sec.rupturas} {sec.rupturas === 1 ? 'Produto' : 'Produtos'}
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

              {/* Card 2: Gráfico de Barras - Dias da Semana */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  📅 Divergências por Dia
                </h2>

                {divergentesPorDia.length === 0 || divergentesPorDia.every(d => d.quantidade === 0) ? (
                  <p className="text-gray-500 text-center py-8">
                    Sem dados de dias da semana
                  </p>
                ) : (
                  <div className="flex items-end justify-between h-64 px-2">
                    {divergentesPorDia.map((dia, idx) => {
                      const maxQtd = Math.max(...divergentesPorDia.map(d => d.quantidade));
                      const heightPercent = maxQtd > 0 ? (dia.quantidade / maxQtd) * 100 : 0;

                      return (
                        <div key={idx} className="flex flex-col items-center flex-1 mx-1">
                          <span className="text-xs font-bold text-gray-700 mb-1">
                            {dia.quantidade}
                          </span>
                          <div
                            className="w-full bg-blue-500 rounded-t-lg transition-all hover:bg-blue-600"
                            style={{ height: `${Math.max(heightPercent, 5)}%`, minHeight: '8px' }}
                          />
                          <span className="text-xs text-gray-600 mt-2 font-medium">
                            {dia.dia}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Card 3: Valores por Setor */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  💰 Valores por Setor
                </h2>

                {valoresSecoesRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum valor registrado
                  </p>
                ) : (
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {valoresSecoesRanking.slice(0, 10).map((sec, idx) => {
                      const maxValor = Math.max(...valoresSecoesRanking.map(s => s.valor));
                      const percentage = maxValor > 0 ? (sec.valor / maxValor) * 100 : 0;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setFiltroSetorTabela(sec.secao);
                            setFiltroTipoEtiqueta('todos');
                            setFiltroFornecedorTabela('todos');
                          }}
                          className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm truncate" title={formatSecao(sec.secao)}>
                                {formatSecao(sec.secao)}
                              </p>
                              <p className="text-xs text-green-600 font-bold">
                                R$ {Number(sec.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all"
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

            {/* Tabela de Produtos (embaixo dos cards) */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  📦 Produtos Sem Etiqueta ({itensEtiqueta.length})
                </h2>
                {itensEtiqueta.length > 0 && (
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

              {/* Filtros de Tipo de Etiqueta */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => {
                    setFiltroTipoEtiqueta('todos');
                    setFiltroFornecedorTabela('todos');
                    setFiltroSetorTabela('todos');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filtroTipoEtiqueta === 'todos' && filtroFornecedorTabela === 'todos' && filtroSetorTabela === 'todos'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Todos ({countTodos})
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

              {itensEtiqueta.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  🎉 Nenhuma ruptura encontrada no período!
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código de Barras</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seção</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor Venda</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margem %</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ocorrências</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {itensEtiqueta.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-600">{idx + 1}</td>
                          <td className="px-3 py-2 text-gray-600">{item.codigo_barras || '-'}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800 max-w-xs truncate" title={item.descricao}>
                              {item.descricao}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={formatSecao(item.secao)}>
                            {formatSecao(item.secao)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            R$ {Number(item.valor_venda || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {item.margem_lucro || '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                              {item.ocorrencias}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
