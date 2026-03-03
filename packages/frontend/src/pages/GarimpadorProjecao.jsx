import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const CORES_FORNECEDORES = [
  '#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1',
];

// Datas padrao: dia 1 do mes corrente e hoje
const hoje = new Date();
const primeiroDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
const hojeFmt = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

export default function GarimpadorProjecao() {
  const [termoBusca, setTermoBusca] = useState('');
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes);
  const [dataFim, setDataFim] = useState(hojeFmt);
  const [apenasMinimo, setApenasMinimo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  // Produtos encontrados no periodo
  const [produtosEncontrados, setProdutosEncontrados] = useState([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  // Filtros de Secao/Grupo/SubGrupo
  const [secoesDisponiveis, setSecoesDisponiveis] = useState([]);
  const [gruposDisponiveis, setGruposDisponiveis] = useState([]);
  const [subgruposDisponiveis, setSubgruposDisponiveis] = useState([]);
  const [filtroSecao, setFiltroSecao] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroSubgrupo, setFiltroSubgrupo] = useState('');

  const fmtBRL = (v) => Number(v || 0).toFixed(2).replace('.', ',');

  // Buscar lista de produtos encontrados no periodo
  const fetchProdutosEncontrados = useCallback(async () => {
    try {
      setLoadingProdutos(true);
      const params = {};
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const { data } = await api.get('/garimpador/analytics/ranking', { params });
      // Extrair produtos unicos de todos os fornecedores
      const ranking = data.ranking || [];
      const todosProdutos = [];
      for (const forn of ranking) {
        try {
          const { data: det } = await api.get(`/garimpador/analytics/ranking/${forn.contatoId}`);
          const itens = det.itens || [];
          for (const item of itens) {
            const nome = (item.produtoLoja || item.produtoOfertado || '').toUpperCase().trim();
            if (nome && !todosProdutos.find(p => p.nome === nome)) {
              todosProdutos.push({
                nome,
                display: item.produtoLoja || item.produtoOfertado,
                classificacao: item.classificacao,
                preco: item.precoOferta,
                fornecedor: forn.nome,
                secao: item.secao || '-',
                grupo: item.grupo || '-',
                subgrupo: item.subgrupo || '-',
              });
            }
          }
        } catch {}
      }
      // Ordenar por nome
      todosProdutos.sort((a, b) => a.nome.localeCompare(b.nome));
      setProdutosEncontrados(todosProdutos);

      // Extrair secoes/grupos/subgrupos unicos
      const secSet = new Set();
      const grpSet = new Set();
      const subSet = new Set();
      for (const p of todosProdutos) {
        if (p.secao && p.secao !== '-') secSet.add(p.secao);
        if (p.grupo && p.grupo !== '-') grpSet.add(p.grupo);
        if (p.subgrupo && p.subgrupo !== '-') subSet.add(p.subgrupo);
      }
      setSecoesDisponiveis([...secSet].sort());
      setGruposDisponiveis([...grpSet].sort());
      setSubgruposDisponiveis([...subSet].sort());
    } catch (err) {
      console.error('Erro ao buscar produtos encontrados:', err);
    } finally {
      setLoadingProdutos(false);
    }
  }, [dataInicio, dataFim]);

  // Ao carregar a pagina, buscar produtos encontrados
  useEffect(() => { fetchProdutosEncontrados(); }, []);

  // Filtrar grupos e subgrupos baseados na selecao
  const gruposFiltrados = filtroSecao
    ? gruposDisponiveis.filter(g => {
        return produtosEncontrados.some(p => p.secao === filtroSecao && p.grupo === g);
      })
    : gruposDisponiveis;

  const subgruposFiltrados = (filtroSecao || filtroGrupo)
    ? subgruposDisponiveis.filter(sg => {
        return produtosEncontrados.some(p =>
          (!filtroSecao || p.secao === filtroSecao) &&
          (!filtroGrupo || p.grupo === filtroGrupo) &&
          p.subgrupo === sg
        );
      })
    : subgruposDisponiveis;

  // Produtos filtrados
  const produtosFiltrados = produtosEncontrados.filter(p => {
    if (filtroSecao && p.secao !== filtroSecao) return false;
    if (filtroGrupo && p.grupo !== filtroGrupo) return false;
    if (filtroSubgrupo && p.subgrupo !== filtroSubgrupo) return false;
    return true;
  });

  const buscar = useCallback(async () => {
    if (!termoBusca.trim()) return;
    try {
      setLoading(true);
      const params = { termo: termoBusca.trim() };
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const { data } = await api.get('/garimpador/analytics/projecao', { params });
      setResultado(data);
    } catch (err) {
      console.error('Erro ao buscar projecao:', err);
    } finally {
      setLoading(false);
    }
  }, [termoBusca, dataInicio, dataFim]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') buscar();
  };

  const selecionarProduto = (produto) => {
    setTermoBusca(produto.display);
    setTimeout(async () => {
      try {
        setLoading(true);
        const params = { termo: produto.display };
        if (dataInicio) params.dataInicio = dataInicio;
        if (dataFim) params.dataFim = dataFim;
        const { data } = await api.get('/garimpador/analytics/projecao', { params });
        setResultado(data);
      } catch (err) {
        console.error('Erro ao buscar projecao:', err);
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  // Montar dados do grafico - eixo X = dias 1 a 31
  const montarChartData = () => {
    if (!resultado?.pontos?.length) return null;

    let pontos = [...resultado.pontos];

    if (apenasMinimo) {
      const porDia = new Map();
      for (const p of pontos) {
        const dia = p.data ? p.data.substring(0, 10) : '';
        if (!porDia.has(dia) || p.preco < porDia.get(dia).preco) {
          porDia.set(dia, p);
        }
      }
      pontos = Array.from(porDia.values());
    }

    const fornecedores = [...new Set(pontos.map(p => p.fornecedor))];
    // Labels fixos: dias 1 a 31
    const labels = Array.from({ length: 31 }, (_, i) => String(i + 1));

    const datasets = fornecedores.map((forn, idx) => {
      const pontosDoForn = pontos.filter(p => p.fornecedor === forn);
      const dataMap = new Map();
      pontosDoForn.forEach(p => {
        const d = new Date(p.data);
        const dia = String(d.getDate());
        dataMap.set(dia, p.preco);
      });

      return {
        label: forn,
        data: labels.map(l => dataMap.get(l) ?? null),
        borderColor: CORES_FORNECEDORES[idx % CORES_FORNECEDORES.length],
        backgroundColor: CORES_FORNECEDORES[idx % CORES_FORNECEDORES.length] + '20',
        tension: 0.3,
        spanGaps: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2,
      };
    });

    // Linha de referencia: Custo Loja (tracejada)
    if (resultado.custoLoja > 0) {
      datasets.push({
        label: `Custo Loja (R$ ${fmtBRL(resultado.custoLoja)})`,
        data: labels.map(() => resultado.custoLoja),
        borderColor: '#f97316',
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      });
    }

    return { labels, datasets };
  };

  const chartData = montarChartData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.parsed.y == null) return null;
            return `${ctx.dataset.label}: R$ ${fmtBRL(ctx.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Dia do Mes', font: { size: 11 } },
        ticks: { font: { size: 10 } },
      },
      y: {
        beginAtZero: false,
        ticks: {
          callback: (v) => `R$ ${fmtBRL(v)}`,
        },
      },
    },
  };

  const classifColor = (c) => {
    if (c === 'ouro') return 'bg-yellow-100 text-yellow-800';
    if (c === 'prata') return 'bg-gray-100 text-gray-700';
    if (c === 'bronze') return 'bg-orange-100 text-orange-700';
    return 'bg-red-50 text-red-600';
  };

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
          <h1 className="text-2xl font-bold">Projecao de Preco</h1>
          <p className="text-orange-100 text-sm mt-1">Historico de precos encontrados pelo Garimpador</p>
        </div>

        {/* Busca */}
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Buscar produto (ex: Arroz, Coca Cola, Cerveja Skol...)"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
            />
            <button
              onClick={buscar}
              disabled={loading || !termoBusca.trim()}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={apenasMinimo}
                onChange={(e) => setApenasMinimo(e.target.checked)}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
              <span className="text-gray-600">Apenas menor preco por dia</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">De:</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                className="border rounded px-2 py-1 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Ate:</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                className="border rounded px-2 py-1 text-sm" />
            </div>
            <button
              onClick={fetchProdutosEncontrados}
              className="text-orange-600 hover:text-orange-800 text-xs font-medium underline"
            >
              Atualizar lista
            </button>
          </div>
        </div>

        {/* Produtos encontrados no periodo */}
        {!resultado && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">
                Produtos encontrados no periodo
              </h3>
              <span className="text-sm text-gray-400">
                {loadingProdutos ? 'Carregando...' : `${produtosFiltrados.length} produto${produtosFiltrados.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {/* Filtros Secao / Grupo / SubGrupo */}
            <div className="p-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Secao</label>
                <select
                  value={filtroSecao}
                  onChange={(e) => { setFiltroSecao(e.target.value); setFiltroGrupo(''); setFiltroSubgrupo(''); }}
                  className="border rounded px-2 py-1 text-sm bg-white min-w-[160px]"
                >
                  <option value="">Todos</option>
                  {secoesDisponiveis.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Grupo</label>
                <select
                  value={filtroGrupo}
                  onChange={(e) => { setFiltroGrupo(e.target.value); setFiltroSubgrupo(''); }}
                  className="border rounded px-2 py-1 text-sm bg-white min-w-[160px]"
                >
                  <option value="">Todos</option>
                  {gruposFiltrados.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-gray-500">SubGrupo</label>
                <select
                  value={filtroSubgrupo}
                  onChange={(e) => setFiltroSubgrupo(e.target.value)}
                  className="border rounded px-2 py-1 text-sm bg-white min-w-[160px]"
                >
                  <option value="">Todos</option>
                  {subgruposFiltrados.map(sg => (
                    <option key={sg} value={sg}>{sg}</option>
                  ))}
                </select>
              </div>
              {(filtroSecao || filtroGrupo || filtroSubgrupo) && (
                <button
                  onClick={() => { setFiltroSecao(''); setFiltroGrupo(''); setFiltroSubgrupo(''); }}
                  className="text-red-500 hover:text-red-700 text-xs font-medium"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {loadingProdutos ? (
              <div className="p-6 text-center text-gray-500">Carregando produtos...</div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                Nenhum produto encontrado {filtroSecao || filtroGrupo || filtroSubgrupo ? 'com esses filtros' : 'no periodo selecionado'}
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2.5 font-semibold text-gray-600">#</th>
                      <th className="text-left p-2.5 font-semibold text-gray-600">Produto</th>
                      <th className="text-left p-2.5 font-semibold text-gray-600">Secao</th>
                      <th className="text-left p-2.5 font-semibold text-gray-600">Grupo</th>
                      <th className="text-right p-2.5 font-semibold text-gray-600">Ultimo Preco</th>
                      <th className="text-left p-2.5 font-semibold text-gray-600">Fornecedor</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600">Classif.</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600">Acao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map((p, i) => (
                      <tr key={i} className="border-b hover:bg-orange-50 cursor-pointer" onClick={() => selecionarProduto(p)}>
                        <td className="p-2.5 text-gray-400">{i + 1}</td>
                        <td className="p-2.5 font-medium text-gray-800">{p.display}</td>
                        <td className="p-2.5 text-gray-500 text-xs">{p.secao !== '-' ? p.secao : ''}</td>
                        <td className="p-2.5 text-gray-500 text-xs">{p.grupo !== '-' ? p.grupo : ''}</td>
                        <td className="p-2.5 text-right font-semibold text-orange-600">R$ {fmtBRL(p.preco)}</td>
                        <td className="p-2.5 text-gray-600">{p.fornecedor}</td>
                        <td className="p-2.5 text-center">
                          {p.classificacao && (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${classifColor(p.classificacao)}`}>
                              {p.classificacao.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <button className="text-orange-500 hover:text-orange-700 text-xs font-medium">
                            Ver Projecao
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Resultados */}
        {resultado && (
          <>
            {/* Botao voltar pra lista */}
            <button
              onClick={() => { setResultado(null); setTermoBusca(''); }}
              className="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1"
            >
              {'\u2190'} Voltar para lista de produtos
            </button>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg shadow p-3 text-center">
                <div className="text-xl font-bold text-green-600">R$ {fmtBRL(resultado.precoMinimo)}</div>
                <div className="text-xs text-gray-500">Menor Preco</div>
              </div>
              <div className="bg-white rounded-lg shadow p-3 text-center">
                <div className="text-xl font-bold text-red-500">R$ {fmtBRL(resultado.precoMaximo)}</div>
                <div className="text-xs text-gray-500">Maior Preco</div>
              </div>
              <div className="bg-white rounded-lg shadow p-3 text-center">
                <div className="text-xl font-bold text-blue-600">R$ {fmtBRL(resultado.precoMedio)}</div>
                <div className="text-xs text-gray-500">Preco Medio</div>
              </div>
              <div className="bg-white rounded-lg shadow p-3 text-center">
                <div className="text-xl font-bold text-gray-700">{resultado.totalRegistros}</div>
                <div className="text-xs text-gray-500">Registros</div>
              </div>
            </div>

            {/* Grafico */}
            {chartData && chartData.datasets.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Evolucao de Preco: "{resultado.produtoBusca}"
                </h3>
                <div style={{ height: 350 }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
            )}

            {/* Tabela */}
            {resultado.pontos?.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-3 border-b">
                  <h3 className="text-sm font-semibold text-gray-700">Detalhes ({resultado.totalRegistros} registros)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2.5">Data</th>
                        <th className="text-left p-2.5">Produto Ofertado</th>
                        <th className="text-right p-2.5">Preco</th>
                        <th className="text-left p-2.5">Fornecedor</th>
                        <th className="text-left p-2.5">Produto Loja</th>
                        <th className="text-center p-2.5">Classif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.pontos.map((p, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="p-2.5 text-gray-500">
                            {p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="p-2.5 font-medium text-blue-700">{p.produtoOfertado}</td>
                          <td className="p-2.5 text-right font-semibold">R$ {fmtBRL(p.preco)}</td>
                          <td className="p-2.5 text-gray-600">{p.fornecedor}</td>
                          <td className="p-2.5 text-green-700">{p.produtoLoja || '-'}</td>
                          <td className="p-2.5 text-center">
                            {p.classificacao && (
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${classifColor(p.classificacao)}`}>
                                {p.classificacao.toUpperCase()}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {resultado.totalRegistros === 0 && (
              <div className="text-center py-8 text-gray-400">
                Nenhum registro encontrado para "{resultado.produtoBusca}"
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
