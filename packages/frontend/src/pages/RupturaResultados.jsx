import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function RupturaResultados() {
  const { surveyId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ordenacao, setOrdenacao] = useState({ campo: 'criticidade', direcao: 'desc' });

  useEffect(() => {
    loadResults();
  }, [surveyId]);

  const loadResults = async () => {
    try {
      const response = await api.get(`/rupture-surveys/${surveyId}`);
      setData(response.data);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar resultados');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-xl text-gray-600">Carregando resultados...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-xl text-gray-600">{error || 'Resultados não encontrados'}</p>
            <button
              onClick={() => navigate('/ruptura-lancador')}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Voltar
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const stats = data.estatisticas || {};
  const itensRuptura = (data.items || []).filter(i =>
    i.status_verificacao === 'nao_encontrado' || i.status_verificacao === 'ruptura_estoque'
  );

  // Função para alternar ordenação
  const toggleOrdenacao = (campo) => {
    setOrdenacao(prev => {
      if (prev.campo === campo) {
        return { campo, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' };
      } else {
        return { campo, direcao: campo === 'criticidade' ? 'desc' : 'asc' };
      }
    });
  };

  // Ordenar itens
  const itensOrdenados = [...itensRuptura].sort((a, b) => {
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
    } else if (ordenacao.campo === 'curva') {
      valorA = a.curva || 'Z';
      valorB = b.curva || 'Z';
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

  const fornecedoresRanking = stats.fornecedores_ranking || [];

  // Função para gerar PDF
  const gerarPDF = () => {
    const doc = new jsPDF();

    // Título
    doc.setFontSize(18);
    doc.text('Relatório de Rupturas', 14, 22);

    // Informações gerais
    doc.setFontSize(11);
    doc.text(`Pesquisa: ${data.nome_pesquisa}`, 14, 32);
    doc.text(`Data: ${new Date(data.data_criacao).toLocaleDateString('pt-BR')}`, 14, 38);

    // Estatísticas
    doc.setFontSize(14);
    doc.text('Estatísticas', 14, 50);
    doc.setFontSize(10);
    doc.text(`Total de Itens: ${data.total_itens}`, 14, 58);
    doc.text(`Encontrados: ${data.itens_encontrados}`, 14, 64);
    doc.text(`Rupturas: ${data.itens_nao_encontrados}`, 14, 70);
    doc.text(`Taxa de Ruptura: ${stats.taxa_ruptura_percentual?.toFixed(1)}%`, 14, 76);
    doc.text(`Perda Estimada/Dia: R$ ${Number(stats.perda_venda_periodo || 0).toFixed(2)}`, 14, 82);

    // Tabela de produtos com ruptura
    doc.setFontSize(14);
    doc.text('Produtos com Ruptura', 14, 95);

    const tableData = itensOrdenados.map((item, idx) => {
      const perdaDia = (item.venda_media_dia || 0) * (item.valor_venda || 0);
      return [
        idx + 1,
        item.descricao || '',
        item.fornecedor || 'Sem fornecedor',
        item.secao || '',
        item.curva || '-',
        Number(item.estoque || 0).toFixed(0),
        `R$ ${Number(item.valor_venda || 0).toFixed(2)}`,
        `${Number(item.margem_lucro || 0).toFixed(0)}%`,
        `R$ ${Number(perdaDia).toFixed(2)}`
      ];
    });

    doc.autoTable({
      startY: 100,
      head: [['#', 'Produto', 'Fornecedor', 'Seção', 'Curva', 'Estoque', 'V.Média/Dia', 'Margem %', 'Perda/Dia']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 50 },
        2: { cellWidth: 40 },
        3: { cellWidth: 25 },
        4: { cellWidth: 15 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 },
        8: { cellWidth: 25 }
      }
    });

    // Salvar PDF
    doc.save(`ruptura-${data.nome_pesquisa.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/ruptura-lancador')}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📈 Avaliação de Resultados
          </h1>
          <p className="text-lg text-gray-600">{data.nome_pesquisa}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-4xl font-bold text-gray-800">{data.total_itens}</div>
            <div className="text-sm text-gray-600 mt-1">Itens Total</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-4xl font-bold text-green-600">{data.itens_encontrados}</div>
            <div className="text-sm text-gray-600 mt-1">Encontrados</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-4xl font-bold text-red-600">{data.itens_nao_encontrados}</div>
            <div className="text-sm text-gray-600 mt-1">Rupturas</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-4xl font-bold text-blue-600">
              {stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Taxa Ruptura</div>
          </div>
        </div>

        {/* Financial Impact Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg shadow p-6 text-center">
            <div className="text-2xl font-bold text-red-700">
              R$ {Number(stats.perda_venda_dia || 0).toFixed(2)}
            </div>
            <div className="text-xs text-red-600 mt-1">Perda Venda/Dia</div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg shadow p-6 text-center">
            <div className="text-2xl font-bold text-orange-700">
              R$ {Number(stats.perda_lucro_dia || 0).toFixed(2)}
            </div>
            <div className="text-xs text-orange-600 mt-1">Perda Lucro/Dia</div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg shadow p-6 text-center">
            <div className="text-2xl font-bold text-purple-700">
              R$ {Number(stats.perda_venda_semanal || 0).toFixed(2)}
            </div>
            <div className="text-xs text-purple-600 mt-1">Perda Venda/Semana</div>
          </div>

          <div className="bg-pink-50 border border-pink-200 rounded-lg shadow p-6 text-center">
            <div className="text-2xl font-bold text-pink-700">
              R$ {Number(stats.perda_lucro_semanal || 0).toFixed(2)}
            </div>
            <div className="text-xs text-pink-600 mt-1">Perda Lucro/Semana</div>
          </div>
        </div>

        {/* Critical Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Produtos com Ruptura */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                📦 Produtos com Ruptura ({itensRuptura.length})
              </h2>

              {itensRuptura.length > 0 && (
                <select
                  value={ordenacao.campo}
                  onChange={(e) => toggleOrdenacao(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-3 py-1"
                >
                  <option value="criticidade">Ordenar por: Criticidade</option>
                  <option value="produto">Ordenar por: Produto (A-Z)</option>
                  <option value="fornecedor">Ordenar por: Fornecedor (A-Z)</option>
                  <option value="curva">Ordenar por: Curva ABC</option>
                  <option value="perda">Ordenar por: Perda/Dia</option>
                </select>
              )}
            </div>

            {itensRuptura.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                🎉 Nenhuma ruptura encontrada!
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {itensOrdenados.slice(0, 10).map((item, idx) => {
                  const perdaDia = (item.venda_media_dia || 0) * (item.valor_venda || 0);
                  return (
                    <div key={item.id} className="border border-gray-200 rounded p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className="text-lg font-semibold text-gray-800 mr-2">
                              {idx + 1}.
                            </span>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">
                                {item.descricao}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.fornecedor || 'Sem fornecedor'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div>
                              <span className="text-gray-500">V.Média:</span>
                              <span className="font-semibold ml-1">
                                {Number(item.venda_media_dia || 0).toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Preço:</span>
                              <span className="font-semibold ml-1">
                                R$ {Number(item.valor_venda || 0).toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Curva:</span>
                              <span className={`font-semibold ml-1 ${
                                item.curva === 'A' ? 'text-red-600' :
                                item.curva === 'B' ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                {item.curva || '-'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right ml-4">
                          <p className="text-sm font-bold text-red-600">
                            R$ {Number(perdaDia).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">Perda/dia</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fornecedores com mais Rupturas */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              🏪 Fornecedores com Mais Rupturas
            </h2>

            {fornecedoresRanking.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Nenhuma ruptura por fornecedor
              </p>
            ) : (
              <div className="space-y-4">
                {fornecedoresRanking.slice(0, 10).map((forn, idx) => {
                  const maxRupturas = Math.max(...fornecedoresRanking.map(f => f.rupturas));
                  const percentage = (forn.rupturas / maxRupturas) * 100;

                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm truncate">
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
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {stats.progresso_percentual ? Number(stats.progresso_percentual).toFixed(0) : '0'}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Progresso</div>
            <div className="text-xs text-gray-500">
              {data.itens_verificados} de {data.total_itens} verificados
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-red-600">
              {stats.itens_curva_a_ruptura || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Rupturas Curva A</div>
            <div className="text-xs text-gray-500">Produtos críticos</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {fornecedoresRanking.length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Fornecedores Impactados</div>
            <div className="text-xs text-gray-500">Com pelo menos 1 ruptura</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Ações</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                // TODO: Implementar exportação Excel
                alert('Exportação para Excel será implementada em breve');
              }}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📥 Exportar Excel
            </button>

            <button
              onClick={gerarPDF}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              📄 Gerar PDF
            </button>

            <button
              onClick={() => {
                if (data.status === 'em_andamento') {
                  navigate(`/ruptura-verificacao/${surveyId}`);
                } else {
                  navigate('/ruptura-lancador');
                }
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {data.status === 'em_andamento' ? '▶️ Continuar Verificação' : '🏠 Nova Pesquisa'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
