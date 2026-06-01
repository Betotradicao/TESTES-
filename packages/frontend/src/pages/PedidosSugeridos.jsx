import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';

/**
 * Backoffice — lista pedidos sugeridos enviados por fornecedores
 * via link publico. Em Gestao de Compras > Pedidos Sugeridos.
 */
export default function PedidosSugeridos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [pedidoAberto, setPedidoAberto] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const r = await api.get('/fornecedor-pedido', {
        params: filtroStatus === 'todos' ? {} : { status: filtroStatus }
      });
      setPedidos(r.data?.pedidos || []);
    } catch (e) {
      setErro(e?.response?.data?.error || e?.message || 'Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [filtroStatus]);

  const atualizarStatus = async (id, novoStatus) => {
    try {
      await api.put(`/fornecedor-pedido/${id}/status`, { status: novoStatus });
      setPedidoAberto(null);
      carregar();
    } catch (e) {
      alert('Erro ao atualizar status: ' + (e?.response?.data?.error || e?.message));
    }
  };

  const formatarData = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  };

  const statusBadge = (s) => {
    const cor = {
      pendente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      aprovado: 'bg-green-100 text-green-800 border-green-300',
      rejeitado: 'bg-red-100 text-red-800 border-red-300'
    }[s] || 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-1 rounded-full text-xs font-bold border ${cor}`}>{s.toUpperCase()}</span>;
  };

  return (
    <Layout>
      <div className="p-4">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-5 mb-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">📦 Pedidos Sugeridos</h1>
              <p className="text-white/90 text-sm mt-1">Pedidos enviados por fornecedores via link publico</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{pedidos.length}</div>
              <div className="text-xs text-white/80">pedidos</div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4 flex gap-2 flex-wrap">
          {['pendente', 'aprovado', 'rejeitado', 'todos'].map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                filtroStatus === s
                  ? 'bg-orange-500 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={carregar}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600"
          >
            🔄 Atualizar
          </button>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {erro}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="text-center text-gray-500 py-8">Carregando...</div>
        ) : pedidos.length === 0 ? (
          <div className="text-center text-gray-500 py-12 bg-white rounded-lg border border-gray-200">
            <div className="text-5xl mb-2">📭</div>
            <p className="text-sm">Nenhum pedido encontrado nesse filtro.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pedidos.map(p => (
              <div
                key={p.id}
                onClick={() => setPedidoAberto(p)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md cursor-pointer transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-800">#{p.id}</span>
                      {statusBadge(p.status)}
                    </div>
                    <h3 className="font-semibold text-gray-900">{p.nome_fornecedor || 'Sem nome'}</h3>
                    <p className="text-xs text-gray-500">
                      Cod: {p.cod_fornecedor} {p.cnpj_fornecedor && `• CNPJ: ${p.cnpj_fornecedor}`} • Loja {p.cod_loja || '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-600">{p.itens?.length || 0}</p>
                    <p className="text-xs text-gray-500">itens</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 flex items-center justify-between">
                  <span>📅 {formatarData(p.enviado_em)}</span>
                  {p.observacoes && <span className="italic">💬 com obs</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Detalhe */}
        {pedidoAberto && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPedidoAberto(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Pedido #{pedidoAberto.id}</h2>
                    <p className="text-sm text-gray-600 mt-1">{pedidoAberto.nome_fornecedor}</p>
                    <p className="text-xs text-gray-500">
                      Cod: {pedidoAberto.cod_fornecedor} • {pedidoAberto.cnpj_fornecedor || 'sem CNPJ'} • Loja {pedidoAberto.cod_loja}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Enviado em {formatarData(pedidoAberto.enviado_em)}</p>
                    {pedidoAberto.ip_origem && <p className="text-[10px] text-gray-400">IP: {pedidoAberto.ip_origem}</p>}
                  </div>
                  <button onClick={() => setPedidoAberto(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                </div>
                <div className="mt-3">{statusBadge(pedidoAberto.status)}</div>
              </div>

              <div className="p-5">
                {pedidoAberto.observacoes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-xs font-bold text-yellow-800 mb-1">💬 OBSERVACOES DO FORNECEDOR</p>
                    <p className="text-sm text-yellow-900 whitespace-pre-wrap">{pedidoAberto.observacoes}</p>
                  </div>
                )}

                <h3 className="font-bold text-gray-700 mb-2">{pedidoAberto.itens?.length || 0} itens</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(pedidoAberto.itens || []).map((it, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{it.descricao}</p>
                          <p className="text-xs text-gray-500">EAN: {it.ean || '—'} • Cod: {it.codigo || '—'} • Curva: {it.curva || '—'}</p>
                        </div>
                        <div className="text-right ml-3">
                          <p className="text-xl font-bold text-orange-600">{it.qtdSugerida}</p>
                          {it.qtdEstoqueInformada != null && (
                            <p className="text-[10px] text-gray-500">est: {it.qtdEstoqueInformada}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] text-gray-600 border-t border-gray-200 pt-2">
                        <span>📅 {it.dtaUltCompra || '—'}</span>
                        <span>📦 Est: {it.estoqueAtual ?? '—'}</span>
                        <span>📊 Cob: {it.cobertura ?? '—'}d</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Acoes */}
              {pedidoAberto.status === 'pendente' && (
                <div className="p-5 border-t border-gray-200 sticky bottom-0 bg-white flex gap-2">
                  <button
                    onClick={() => atualizarStatus(pedidoAberto.id, 'rejeitado')}
                    className="flex-1 bg-red-100 text-red-700 font-bold py-3 rounded-lg hover:bg-red-200"
                  >
                    ✗ Rejeitar
                  </button>
                  <button
                    onClick={() => atualizarStatus(pedidoAberto.id, 'aprovado')}
                    className="flex-1 bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600"
                  >
                    ✓ Aprovar
                  </button>
                </div>
              )}
              {pedidoAberto.status !== 'pendente' && (
                <div className="p-4 border-t border-gray-200 sticky bottom-0 bg-gray-50 text-center text-xs text-gray-600">
                  Atualizado em {formatarData(pedidoAberto.atualizado_em)} por {pedidoAberto.atualizado_por || '—'}
                  <button
                    onClick={() => atualizarStatus(pedidoAberto.id, 'pendente')}
                    className="block mx-auto mt-2 text-xs text-blue-600 underline"
                  >
                    Reverter pra pendente
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
