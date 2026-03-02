import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

export default function GarimpadorRanking() {
  const [ranking, setRanking] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selecionado, setSelecionado] = useState(null);
  const [detalhes, setDetalhes] = useState([]);
  const [filtroClassif, setFiltroClassif] = useState('todos');
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  const fmtBRL = (v) => Number(v || 0).toFixed(2).replace('.', ',');

  const fetchRanking = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const [rankRes, resumoRes] = await Promise.all([
        api.get('/garimpador/analytics/ranking', { params }),
        api.get('/garimpador/analytics/resumo', { params }),
      ]);
      setRanking(rankRes.data.ranking || []);
      setResumo(resumoRes.data);
    } catch (err) {
      console.error('Erro ao buscar ranking:', err);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  const abrirDetalhes = async (fornecedor) => {
    setSelecionado(fornecedor);
    setFiltroClassif('todos');
    await fetchDetalhes(fornecedor.contatoId, null);
  };

  const fetchDetalhes = async (contatoId, classificacao) => {
    try {
      setLoadingDetalhes(true);
      const params = {};
      if (classificacao && classificacao !== 'todos') params.classificacao = classificacao;
      const { data } = await api.get(`/garimpador/analytics/ranking/${contatoId}`, { params });
      setDetalhes(data.itens || []);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const mudarFiltroClassif = (classif) => {
    setFiltroClassif(classif);
    if (selecionado) {
      fetchDetalhes(selecionado.contatoId, classif === 'todos' ? null : classif);
    }
  };

  const classifColor = (c) => {
    if (c === 'ouro') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (c === 'prata') return 'bg-gray-100 text-gray-700 border-gray-300';
    if (c === 'bronze') return 'bg-orange-100 text-orange-700 border-orange-300';
    return 'bg-red-50 text-red-600 border-red-200';
  };

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
          <h1 className="text-2xl font-bold">Ranking de Fornecedores</h1>
          <p className="text-orange-100 text-sm mt-1">Melhores oportunidades encontradas pelo Garimpador</p>

          {resumo && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              <div className="bg-white/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{resumo.totalOuro}</div>
                <div className="text-xs text-orange-100">Ouro</div>
              </div>
              <div className="bg-white/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{resumo.totalPrata}</div>
                <div className="text-xs text-orange-100">Prata</div>
              </div>
              <div className="bg-white/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{resumo.totalBronze}</div>
                <div className="text-xs text-orange-100">Bronze</div>
              </div>
              <div className="bg-white/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">R$ {fmtBRL(resumo.economiaTotal)}</div>
                <div className="text-xs text-orange-100">Economia Total</div>
              </div>
              <div className="bg-white/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{resumo.totalForaMix}</div>
                <div className="text-xs text-orange-100">Fora do Mix</div>
              </div>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-3">
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
          <button onClick={fetchRanking} className="bg-orange-500 text-white px-4 py-1.5 rounded text-sm hover:bg-orange-600 transition-colors">
            Atualizar
          </button>
          {resumo?.topCategorias?.length > 0 && (
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
              <span>Top categorias:</span>
              {resumo.topCategorias.slice(0, 3).map((c, i) => (
                <span key={i} className="bg-gray-100 px-2 py-0.5 rounded">{c.categoria} ({c.count})</span>
              ))}
            </div>
          )}
        </div>

        {/* Ranking Grid */}
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando ranking...</div>
        ) : ranking.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Nenhuma comparacao encontrada no periodo</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ranking.map((f, idx) => (
              <div
                key={f.contatoId}
                onClick={() => abrirDetalhes(f)}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                  selecionado?.contatoId === f.contatoId ? 'border-orange-500 ring-2 ring-orange-200' : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{idx < 3 ? MEDALS[idx] : ''}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                      <h3 className="font-semibold text-gray-800 truncate">{f.nome}</h3>
                    </div>
                    <p className="text-xs text-gray-400">{f.tipo === 'concorrente' ? 'Concorrente' : 'Fornecedor'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-800">{f.totalOfertas}</div>
                    <div className="text-[10px] text-gray-400">itens</div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <span className="text-xs px-2 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-200 font-semibold">
                    Ouro: {f.ouro}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded border bg-gray-50 text-gray-600 border-gray-200 font-semibold">
                    Prata: {f.prata}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded border bg-orange-50 text-orange-600 border-orange-200 font-semibold">
                    Bronze: {f.bronze}
                  </span>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t">
                  <span className="text-xs text-green-600 font-semibold">
                    Economia: R$ {fmtBRL(f.totalEconomia)}
                  </span>
                  {f.margemMediaMelhoria > 0 && (
                    <span className="text-xs text-blue-600">
                      Margem +{fmtBRL(f.margemMediaMelhoria)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detalhes do fornecedor selecionado */}
        {selecionado && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
              <h2 className="font-semibold text-gray-800">
                Itens de {selecionado.nome}
              </h2>
              <div className="flex gap-1 ml-auto">
                {['todos', 'ouro', 'prata', 'bronze'].map((c) => (
                  <button
                    key={c}
                    onClick={() => mudarFiltroClassif(c)}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      filtroClassif === c
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c === 'todos' ? 'Todos' : c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {loadingDetalhes ? (
              <div className="p-4 text-center text-gray-500">Carregando...</div>
            ) : detalhes.length === 0 ? (
              <div className="p-4 text-center text-gray-400">Nenhum item encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Produto Ofertado</th>
                      <th className="text-left p-2">Produto Loja</th>
                      <th className="text-right p-2">Oferta</th>
                      <th className="text-right p-2">Custo Loja</th>
                      <th className="text-right p-2">Diferenca</th>
                      <th className="text-center p-2">Curva</th>
                      <th className="text-center p-2">Classif.</th>
                      <th className="text-left p-2">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhes.map((item, i) => (
                      <tr key={i} className={`border-b hover:bg-gray-50 ${item.boaOferta ? 'bg-green-50/50' : ''}`}>
                        <td className="p-2 text-gray-400">{i + 1}</td>
                        <td className="p-2 font-medium text-blue-700 max-w-[200px] truncate">{item.produtoOfertado}</td>
                        <td className="p-2 text-green-700 max-w-[200px] truncate">{item.produtoLoja || '-'}</td>
                        <td className="p-2 text-right font-semibold">R$ {fmtBRL(item.precoOferta)}</td>
                        <td className="p-2 text-right">R$ {fmtBRL(item.precoCustoLoja)}</td>
                        <td className={`p-2 text-right font-semibold ${item.diferenca > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          R$ {fmtBRL(item.diferenca)}
                        </td>
                        <td className="p-2 text-center">{item.curva}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${classifColor(item.classificacao)}`}>
                            {item.classificacao?.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2 text-gray-500">
                          {item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
