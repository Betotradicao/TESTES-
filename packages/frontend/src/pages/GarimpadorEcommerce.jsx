import { useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const fmtBRL = (v) => v != null ? `R$ ${Number(v).toFixed(2).replace('.', ',')}` : '-';

export default function GarimpadorEcommerce() {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState('price');
  const [sortDir, setSortDir] = useState('asc');
  const [fonte, setFonte] = useState('mercadolivre');

  const pesquisar = useCallback(async () => {
    if (!busca.trim()) {
      toast.error('Digite um produto para pesquisar');
      return;
    }
    try {
      setLoading(true);
      setResultados([]);
      const { data } = await api.get('/ecommerce/buscar', {
        params: { q: busca.trim(), fonte },
        timeout: 30000,
      });
      setResultados(data.resultados || []);
      if ((data.resultados || []).length === 0) {
        toast('Nenhum resultado encontrado', { icon: '\uD83D\uDD0D' });
      }
    } catch (err) {
      console.error('Erro ao buscar:', err);
      toast.error('Erro ao buscar produtos');
    } finally {
      setLoading(false);
    }
  }, [busca, fonte]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') pesquisar();
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedResults = [...resultados].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="text-gray-300 ml-1">&#x25B2;</span>;
    return <span className="text-orange-600 ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

  const fontes = [
    { id: 'mercadolivre', label: 'Mercado Livre', cor: 'bg-yellow-400 text-yellow-900' },
  ];

  return (
    <Layout>
      <div className="p-2 sm:p-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-4 mb-3 text-white">
          <h1 className="text-lg font-bold">Garimpador E-commerce</h1>
          <p className="text-orange-100 text-xs">Busque precos em e-commerces e compare com seus fornecedores</p>
        </div>

        {/* Barra de busca */}
        <div className="bg-white rounded-xl shadow p-3 mb-3">
          <div className="flex gap-2 items-center">
            {/* Fonte */}
            <div className="flex gap-1">
              {fontes.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFonte(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    fonte === f.id ? f.cor + ' ring-2 ring-offset-1 ring-orange-500' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex-1">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite o produto... ex: oleo de soja 900ml"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              />
            </div>

            {/* Botao buscar */}
            <button
              onClick={pesquisar}
              disabled={loading}
              className="px-5 py-1.5 bg-orange-500 text-white rounded-lg font-bold text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Buscando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  Buscar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        {resultados.length > 0 && (
          <div className="flex gap-2 mb-3">
            <div className="bg-white rounded-lg shadow px-3 py-1.5 flex items-center gap-2">
              <span className="text-orange-600 font-bold text-sm">{resultados.length}</span>
              <span className="text-gray-500 text-xs">resultados</span>
            </div>
            <div className="bg-white rounded-lg shadow px-3 py-1.5 flex items-center gap-2">
              <span className="text-green-600 font-bold text-sm">
                {fmtBRL(Math.min(...resultados.filter(r => r.price > 0).map(r => r.price)))}
              </span>
              <span className="text-gray-500 text-xs">menor</span>
            </div>
            <div className="bg-white rounded-lg shadow px-3 py-1.5 flex items-center gap-2">
              <span className="text-red-500 font-bold text-sm">
                {fmtBRL(Math.max(...resultados.filter(r => r.price > 0).map(r => r.price)))}
              </span>
              <span className="text-gray-500 text-xs">maior</span>
            </div>
          </div>
        )}

        {/* Tabela de resultados */}
        {resultados.length > 0 && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-orange-50 text-orange-800 text-[11px]">
                    <th className="px-2 py-1.5 text-left w-6">#</th>
                    <th className="px-2 py-1.5 text-left w-12">Foto</th>
                    <th className="px-2 py-1.5 text-left cursor-pointer hover:bg-orange-100" onClick={() => handleSort('title')}>
                      Produto <SortIcon col="title" />
                    </th>
                    <th className="px-2 py-1.5 text-right cursor-pointer hover:bg-orange-100 w-24" onClick={() => handleSort('price')}>
                      Preco <SortIcon col="price" />
                    </th>
                    <th className="px-2 py-1.5 text-center w-16">Frete</th>
                    <th className="px-2 py-1.5 text-left cursor-pointer hover:bg-orange-100 w-32" onClick={() => handleSort('seller')}>
                      Vendedor <SortIcon col="seller" />
                    </th>
                    <th className="px-2 py-1.5 text-center w-14">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((item, idx) => (
                    <tr key={item.id || idx} className={`border-t border-gray-100 hover:bg-orange-50/30 ${idx === 0 ? 'bg-green-50' : ''}`}>
                      <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                      <td className="px-2 py-1">
                        {item.thumbnail && (
                          <img src={item.thumbnail} alt="" className="w-8 h-8 object-contain rounded" />
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <span className="text-gray-800 leading-tight line-clamp-2">{item.title}</span>
                        {item.original_price && item.original_price > item.price && (
                          <span className="ml-1 text-[10px] text-red-400 line-through">{fmtBRL(item.original_price)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right font-bold text-gray-800">{fmtBRL(item.price)}</td>
                      <td className="px-2 py-1 text-center">
                        {item.free_shipping ? (
                          <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-bold">GRATIS</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-gray-600 truncate max-w-[120px]">{item.seller || '-'}</td>
                      <td className="px-2 py-1 text-center">
                        {item.permalink ? (
                          <a
                            href={item.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] hover:bg-orange-200 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                            Ver
                          </a>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && resultados.length === 0 && (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-orange-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <p className="text-gray-400 text-lg">Digite um produto e clique em Buscar</p>
            <p className="text-gray-300 text-sm mt-1">Ex: arroz 5kg, oleo de soja 900ml, acucar cristal</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
