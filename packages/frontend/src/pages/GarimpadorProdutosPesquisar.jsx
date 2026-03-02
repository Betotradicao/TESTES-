import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';

export default function GarimpadorProdutosPesquisar() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Filtros
  const [secoes, setSecoes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [subgrupos, setSubgrupos] = useState([]);
  const [codSecao, setCodSecao] = useState('');
  const [codGrupo, setCodGrupo] = useState('');
  const [codSubGrupo, setCodSubGrupo] = useState('');
  const [tipoEspecie, setTipoEspecie] = useState('');
  const [tipoEvento, setTipoEvento] = useState('');
  const [busca, setBusca] = useState('');

  // Excluidos (set de codProduto strings)
  const [excluidos, setExcluidos] = useState(new Set());
  const [excluidosSalvos, setExcluidosSalvos] = useState(new Set());

  // Sort
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const fmtBRL = (v) => Number(v || 0).toFixed(2).replace('.', ',');

  // Carregar exclusoes salvas do backend
  useEffect(() => {
    api.get('/garimpador/produtos-excluidos').then(({ data }) => {
      const set = new Set((data.excluidos || []).map(String));
      setExcluidos(set);
      setExcluidosSalvos(new Set(set));
    }).catch(() => {});
  }, []);

  // Carregar secoes
  useEffect(() => {
    api.get('/compra-venda/secoes').then(({ data }) => {
      setSecoes(data || []);
    }).catch(() => {});
  }, []);

  // Carregar grupos ao trocar secao
  useEffect(() => {
    if (!codSecao) { setGrupos([]); setCodGrupo(''); setSubgrupos([]); setCodSubGrupo(''); return; }
    api.get(`/compra-venda/grupos?codSecao=${codSecao}`).then(({ data }) => {
      setGrupos(data || []);
    }).catch(() => {});
    setCodGrupo('');
    setSubgrupos([]);
    setCodSubGrupo('');
  }, [codSecao]);

  // Carregar subgrupos ao trocar grupo
  useEffect(() => {
    if (!codSecao || !codGrupo) { setSubgrupos([]); setCodSubGrupo(''); return; }
    api.get(`/compra-venda/subgrupos?codSecao=${codSecao}&codGrupo=${codGrupo}`).then(({ data }) => {
      setSubgrupos(data || []);
    }).catch(() => {});
    setCodSubGrupo('');
  }, [codSecao, codGrupo]);

  // Buscar produtos
  const fetchProdutos = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (codSecao) params.codSecao = codSecao;
      if (codGrupo) params.codGrupo = codGrupo;
      if (codSubGrupo) params.codSubGrupo = codSubGrupo;
      if (tipoEspecie !== '') params.tipoEspecie = tipoEspecie;
      if (tipoEvento !== '') params.tipoEvento = tipoEvento;
      const { data } = await api.get('/garimpador/produtos-pesquisar', { params });
      setProdutos(data.produtos || []);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
    } finally {
      setLoading(false);
    }
  }, [codSecao, codGrupo, codSubGrupo, tipoEspecie, tipoEvento]);

  // Salvar exclusoes no backend
  const salvarExcluidos = async () => {
    try {
      setSalvando(true);
      await api.post('/garimpador/produtos-excluidos', {
        excluidos: Array.from(excluidos),
      });
      setExcluidosSalvos(new Set(excluidos));
    } catch (err) {
      console.error('Erro ao salvar excluidos:', err);
    } finally {
      setSalvando(false);
    }
  };

  // Filtro local por busca
  const produtosFiltrados = busca.trim()
    ? produtos.filter(p =>
        p.descricao.toUpperCase().includes(busca.toUpperCase()) ||
        p.fornecedor.toUpperCase().includes(busca.toUpperCase()) ||
        String(p.codProduto).includes(busca) ||
        (p.codBarras || '').includes(busca)
      )
    : produtos;

  // Ordenacao
  const produtosOrdenados = [...produtosFiltrados];
  if (sortCol) {
    produtosOrdenados.sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (typeof va === 'string') {
        va = va.toUpperCase();
        vb = (vb || '').toUpperCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (colId) => {
    if (sortCol === colId) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  // Toggle exclusao
  const toggleExcluido = (codProduto) => {
    const cod = String(codProduto);
    setExcluidos(prev => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod);
      else next.add(cod);
      return next;
    });
  };

  const toggleTodos = () => {
    const allCods = produtosOrdenados.map(p => String(p.codProduto));
    const todosExcluidos = allCods.every(c => excluidos.has(c));

    setExcluidos(prev => {
      const next = new Set(prev);
      if (todosExcluidos) {
        allCods.forEach(c => next.delete(c));
      } else {
        allCods.forEach(c => next.add(c));
      }
      return next;
    });
  };

  const allExcluded = produtosOrdenados.length > 0 && produtosOrdenados.every(p => excluidos.has(String(p.codProduto)));

  // Contar excluidos que estao na lista atual
  const excluidosNaLista = produtosOrdenados.filter(p => excluidos.has(String(p.codProduto))).length;

  // Verificar se houve mudancas
  const temMudancas = (() => {
    if (excluidos.size !== excluidosSalvos.size) return true;
    for (const item of excluidos) {
      if (!excluidosSalvos.has(item)) return true;
    }
    return false;
  })();

  // Sort indicator
  const SortIcon = ({ colId }) => {
    if (sortCol !== colId) return <span className="text-gray-300 ml-1">{'\u2195'}</span>;
    return <span className="text-orange-500 ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  const COLUNAS = [
    { id: 'codProduto', label: 'Codigo', align: 'left' },
    { id: 'descricao', label: 'Descricao', align: 'left' },
    { id: 'custo', label: 'Custo', align: 'right', type: 'money' },
    { id: 'venda', label: 'Venda', align: 'right', type: 'money' },
    { id: 'estoque', label: 'Estoque', align: 'right', type: 'number' },
    { id: 'curva', label: 'Curva', align: 'center' },
    { id: 'margem', label: 'Margem', align: 'right', type: 'percent' },
    { id: 'secao', label: 'Secao', align: 'left' },
    { id: 'grupo', label: 'Grupo', align: 'left' },
    { id: 'fornecedor', label: 'Fornecedor', align: 'left' },
  ];

  const renderCell = (p, col) => {
    const val = p[col.id];
    switch (col.type) {
      case 'money':
        return <span className="font-medium">R$ {fmtBRL(val)}</span>;
      case 'percent':
        return <span className="font-medium">{fmtBRL(val)}%</span>;
      case 'number':
        return <span>{Number(val || 0).toLocaleString('pt-BR')}</span>;
      default:
        return <span>{val || '-'}</span>;
    }
  };

  const curvaColor = (c) => {
    if (c === 'A') return 'bg-green-100 text-green-700';
    if (c === 'B') return 'bg-yellow-100 text-yellow-700';
    if (c === 'C') return 'bg-orange-100 text-orange-700';
    if (c === 'D') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Produtos a Eliminar</h1>
              <p className="text-orange-100 text-sm mt-1">Marque os produtos que deseja eliminar dos matches do Garimpador - a IA não usará esses produtos para cruzamentos</p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/20 rounded-lg p-3 text-center min-w-[80px]">
                <div className="text-2xl font-bold">{produtos.length}</div>
                <div className="text-xs text-orange-100">Produtos</div>
              </div>
              <div className="bg-white/20 rounded-lg p-3 text-center min-w-[80px]">
                <div className="text-2xl font-bold">{excluidos.size}</div>
                <div className="text-xs text-orange-100">Excluidos</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card de excluidos + botao salvar */}
        {excluidos.size > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{'\u{1F6AB}'}</span>
              <div>
                <span className="font-semibold text-red-700 text-lg">{excluidos.size}</span>
                <span className="text-red-600 ml-2">produto{excluidos.size !== 1 ? 's' : ''} excluido{excluidos.size !== 1 ? 's' : ''} dos cruzamentos</span>
                {temMudancas && (
                  <span className="text-orange-600 ml-2 text-sm font-medium">(mudancas nao salvas)</span>
                )}
              </div>
            </div>
            <button
              onClick={salvarExcluidos}
              disabled={salvando || !temMudancas}
              className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors ${
                temMudancas
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {salvando ? 'Salvando...' : 'Salvar Excluidos'}
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Secao */}
            <div className="flex flex-col min-w-[160px]">
              <label className="text-xs text-gray-500 mb-0.5 font-semibold">Secao</label>
              <select value={codSecao} onChange={(e) => setCodSecao(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none">
                <option value="">Todas</option>
                {secoes.map(s => (
                  <option key={s.COD_SECAO || s.cod_secao} value={s.COD_SECAO || s.cod_secao}>
                    {s.DES_SECAO || s.des_secao || s.COD_SECAO || s.cod_secao}
                  </option>
                ))}
              </select>
            </div>

            {/* Grupo */}
            <div className="flex flex-col min-w-[160px]">
              <label className="text-xs text-gray-500 mb-0.5 font-semibold">Grupo</label>
              <select value={codGrupo} onChange={(e) => setCodGrupo(e.target.value)}
                disabled={!codSecao}
                className="border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none disabled:opacity-50">
                <option value="">Todos</option>
                {grupos.map(g => (
                  <option key={g.COD_GRUPO || g.cod_grupo} value={g.COD_GRUPO || g.cod_grupo}>
                    {g.DES_GRUPO || g.des_grupo || g.COD_GRUPO || g.cod_grupo}
                  </option>
                ))}
              </select>
            </div>

            {/* SubGrupo */}
            <div className="flex flex-col min-w-[160px]">
              <label className="text-xs text-gray-500 mb-0.5 font-semibold">SubGrupo</label>
              <select value={codSubGrupo} onChange={(e) => setCodSubGrupo(e.target.value)}
                disabled={!codGrupo}
                className="border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none disabled:opacity-50">
                <option value="">Todos</option>
                {subgrupos.map(sg => (
                  <option key={sg.COD_SUB_GRUPO || sg.cod_sub_grupo} value={sg.COD_SUB_GRUPO || sg.cod_sub_grupo}>
                    {sg.DES_SUB_GRUPO || sg.des_sub_grupo || sg.COD_SUB_GRUPO || sg.cod_sub_grupo}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo Especie */}
            <div className="flex flex-col min-w-[140px]">
              <label className="text-xs text-gray-500 mb-0.5 font-semibold">Tipo Especie</label>
              <select value={tipoEspecie} onChange={(e) => setTipoEspecie(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none">
                <option value="">Todos</option>
                <option value="0">MERCADORIA</option>
                <option value="2">SERVICO</option>
                <option value="3">IMOBILIZADO</option>
                <option value="4">INSUMO</option>
              </select>
            </div>

            {/* Tipo Evento */}
            <div className="flex flex-col min-w-[140px]">
              <label className="text-xs text-gray-500 mb-0.5 font-semibold">Tipo Evento</label>
              <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none">
                <option value="">Todos</option>
                <option value="0">DIRETA</option>
                <option value="1">COMPOSICAO</option>
                <option value="2">DECOMPOSICAO</option>
                <option value="3">PRODUCAO</option>
              </select>
            </div>

            {/* Botao Pesquisar */}
            <button onClick={fetchProdutos}
              className="bg-orange-500 text-white px-5 py-1.5 rounded text-sm font-semibold hover:bg-orange-600 transition-colors h-[34px]">
              Pesquisar
            </button>
          </div>

          {/* Busca local */}
          <input
            type="text"
            placeholder="Filtrar por descricao, fornecedor, codigo ou cod. barras..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando...</div>
        ) : produtos.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            Selecione os filtros e clique em "Pesquisar" para listar os produtos
          </div>
        ) : produtosOrdenados.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            Nenhum produto encontrado para "{busca}"
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {produtosOrdenados.length} produto{produtosOrdenados.length !== 1 ? 's' : ''}
                {excluidosNaLista > 0 && (
                  <span className="text-red-600 ml-2">({excluidosNaLista} excluido{excluidosNaLista !== 1 ? 's' : ''} nesta lista)</span>
                )}
              </h3>
              <div className="text-xs text-gray-400">
                Clique nos cabecalhos para ordenar | Marque para eliminar dos matches
              </div>
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {/* Checkbox excluir todos */}
                    <th className="p-2.5 font-semibold text-gray-600 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allExcluded}
                        onChange={toggleTodos}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-red-500 focus:ring-red-400 cursor-pointer"
                      />
                    </th>
                    <th className="text-left p-2.5 font-semibold text-gray-600 w-8">#</th>
                    {COLUNAS.map((col) => (
                      <th
                        key={col.id}
                        onClick={() => handleSort(col.id)}
                        className={`p-2.5 font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        <span className="inline-flex items-center gap-0.5">
                          {col.label}
                          <SortIcon colId={col.id} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {produtosOrdenados.map((p, i) => {
                    const isExcluded = excluidos.has(String(p.codProduto));
                    return (
                      <tr key={p.codProduto}
                        className={`border-b hover:bg-gray-50 ${isExcluded ? 'bg-red-50' : ''}`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={() => toggleExcluido(p.codProduto)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-red-500 focus:ring-red-400 cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5 text-gray-400">{i + 1}</td>
                        {COLUNAS.map((col) => (
                          <td key={col.id} className={`p-2.5 whitespace-nowrap ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          } ${isExcluded ? 'opacity-50' : ''}`}>
                            {col.id === 'curva' ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${curvaColor(p.curva)}`}>
                                {p.curva || '-'}
                              </span>
                            ) : col.id === 'descricao' ? (
                              <span className="font-medium text-gray-800">{p.descricao}</span>
                            ) : renderCell(p, col)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
