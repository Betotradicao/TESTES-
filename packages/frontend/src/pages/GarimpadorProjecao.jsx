import { useState, useCallback } from 'react';
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

export default function GarimpadorProjecao() {
  const [termoBusca, setTermoBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [apenasMinimo, setApenasMinimo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  const fmtBRL = (v) => Number(v || 0).toFixed(2).replace('.', ',');

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

  // Montar dados do grafico
  const montarChartData = () => {
    if (!resultado?.pontos?.length) return null;

    let pontos = [...resultado.pontos];

    // Se "apenas minimo por dia", filtra
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

    // Agrupar por fornecedor
    const fornecedores = [...new Set(pontos.map(p => p.fornecedor))];
    const labels = [...new Set(pontos.map(p => {
      const d = new Date(p.data);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }))];

    const datasets = fornecedores.map((forn, idx) => {
      const pontosDoForn = pontos.filter(p => p.fornecedor === forn);
      const dataMap = new Map(pontosDoForn.map(p => {
        const d = new Date(p.data);
        return [d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), p.preco];
      }));

      return {
        label: forn,
        data: labels.map(l => dataMap.get(l) ?? null),
        borderColor: CORES_FORNECEDORES[idx % CORES_FORNECEDORES.length],
        backgroundColor: CORES_FORNECEDORES[idx % CORES_FORNECEDORES.length] + '20',
        tension: 0.3,
        spanGaps: true,
        pointRadius: 5,
        pointHoverRadius: 7,
      };
    });

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
            const val = ctx.parsed.y;
            return `${ctx.dataset.label}: R$ ${fmtBRL(val)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: (v) => `R$ ${fmtBRL(v)}`,
        },
      },
    },
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
          </div>
        </div>

        {/* Resultados */}
        {resultado && (
          <>
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
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Data</th>
                        <th className="text-left p-2">Produto Ofertado</th>
                        <th className="text-right p-2">Preco</th>
                        <th className="text-left p-2">Fornecedor</th>
                        <th className="text-left p-2">Produto Loja</th>
                        <th className="text-center p-2">Classif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.pontos.map((p, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-gray-500">
                            {p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="p-2 font-medium text-blue-700">{p.produtoOfertado}</td>
                          <td className="p-2 text-right font-semibold">R$ {fmtBRL(p.preco)}</td>
                          <td className="p-2 text-gray-600">{p.fornecedor}</td>
                          <td className="p-2 text-green-700">{p.produtoLoja || '-'}</td>
                          <td className="p-2 text-center">
                            {p.classificacao && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                p.classificacao === 'ouro' ? 'bg-yellow-100 text-yellow-800' :
                                p.classificacao === 'prata' ? 'bg-gray-100 text-gray-700' :
                                p.classificacao === 'bronze' ? 'bg-orange-100 text-orange-700' :
                                'bg-red-50 text-red-600'
                              }`}>
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

        {!resultado && !loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">{'\u{1F4C8}'}</div>
            <p>Busque um produto para ver a projecao de preco</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
