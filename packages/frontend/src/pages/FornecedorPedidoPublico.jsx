import { useState, useEffect } from 'react';
import api from '../utils/api';

/**
 * Pagina publica (sem login) onde o fornecedor digita CNPJ ou codigo
 * e ve produtos pra sugerir pedido. Otimizada pra celular.
 *
 * URL: /fornecedor-pedido
 */
export default function FornecedorPedidoPublico() {
  // Steps: 1=identificacao, 2=produtos, 3=confirmacao, 4=enviado
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Step 1
  const [identificador, setIdentificador] = useState('');
  const [codLoja, setCodLoja] = useState('');
  const [lojas, setLojas] = useState([]); // [{ codLoja, nome }]
  const [fornecedor, setFornecedor] = useState(null); // { codigo, cnpj, fantasia, razaoSocial }

  // Carrega lojas ao montar
  useEffect(() => {
    api.get('/fornecedor-pedido/publico/lojas')
      .then(r => {
        const lojasList = r.data?.lojas || [];
        setLojas(lojasList);
        if (lojasList.length > 0) setCodLoja(String(lojasList[0].codLoja));
      })
      .catch(() => setLojas([{ codLoja: 1, nome: 'Loja 1' }])); // fallback
  }, []);

  // Step 2
  const [produtos, setProdutos] = useState([]); // [{ codigo, ean, descricao, ... , qtdEstoqueInformada, qtdSugerida }]
  const [filtro, setFiltro] = useState('');

  // Step 3 / submit
  const [observacoes, setObservacoes] = useState('');

  // Step 4
  const [pedidoIdEnviado, setPedidoIdEnviado] = useState(null);

  // ---------- Helpers ----------
  const formatarCnpj = (v) => {
    const d = (v || '').replace(/\D/g, '').slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  // ---------- Acoes ----------
  const buscarFornecedor = async () => {
    setErro('');
    if (!identificador.trim()) { setErro('Digite seu codigo ou CNPJ'); return; }
    setLoading(true);
    try {
      const r = await api.get('/fornecedor-pedido/publico/buscar', {
        params: { identificador: identificador.trim(), codLoja }
      });
      if (!r.data?.fornecedor) throw new Error('Fornecedor nao encontrado');
      setFornecedor(r.data.fornecedor);
      // Ja carrega produtos no mesmo passo
      const prods = await api.get('/fornecedor-pedido/publico/produtos', {
        params: { codFornecedor: r.data.fornecedor.codigo, codLoja }
      });
      const lista = (prods.data?.produtos || []).map(p => ({
        ...p,
        qtdEstoqueInformada: '',
        qtdSugerida: ''
      }));
      setProdutos(lista);
      setStep(2);
    } catch (e) {
      setErro(e?.response?.data?.error || e?.message || 'Erro ao buscar fornecedor');
    } finally {
      setLoading(false);
    }
  };

  const atualizarItem = (codigo, campo, valor) => {
    setProdutos(prev => prev.map(p =>
      p.codigo === codigo ? { ...p, [campo]: valor } : p
    ));
  };

  const itensComQuantidade = produtos.filter(p => Number(p.qtdSugerida) > 0);

  const enviar = async () => {
    setErro('');
    if (itensComQuantidade.length === 0) {
      setErro('Informe quantidade sugerida em pelo menos 1 produto');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post('/fornecedor-pedido/publico/enviar', {
        codFornecedor: fornecedor.codigo,
        nomeFornecedor: fornecedor.fantasia || fornecedor.razaoSocial,
        cnpjFornecedor: fornecedor.cnpj,
        codLoja: Number(codLoja),
        itens: itensComQuantidade.map(p => ({
          ean: p.ean, codigo: p.codigo, descricao: p.descricao,
          dtaUltCompra: p.dtaUltCompra, estoqueAtual: p.estoqueAtual,
          estoqueTroca: p.estoqueTroca, cobertura: p.cobertura, curva: p.curva,
          qtdEstoqueInformada: p.qtdEstoqueInformada ? Number(p.qtdEstoqueInformada) : null,
          qtdSugerida: Number(p.qtdSugerida)
        })),
        observacoes: observacoes || null
      });
      setPedidoIdEnviado(r.data?.pedidoId);
      setStep(4);
    } catch (e) {
      setErro(e?.response?.data?.error || e?.message || 'Erro ao enviar pedido');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Filtragem ----------
  const produtosFiltrados = filtro.trim()
    ? produtos.filter(p => {
        const q = filtro.trim().toLowerCase();
        return (p.descricao || '').toLowerCase().includes(q)
            || (p.ean || '').toLowerCase().includes(q)
            || (p.codigo || '').toLowerCase().includes(q);
      })
    : produtos;

  // ===================================================================
  // STEP 1 — Identificacao
  // ===================================================================
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-start justify-center p-4 pt-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">📦</div>
            <h1 className="text-2xl font-bold text-gray-800">Pedido Sugerido</h1>
            <p className="text-sm text-gray-600 mt-1">Para fornecedores parceiros</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Codigo ou CNPJ</label>
              <input
                type="text"
                inputMode="text"
                value={identificador}
                onChange={(e) => {
                  const v = e.target.value;
                  // se parecer cnpj (>=11 digitos), formata
                  const apenasNum = v.replace(/\D/g, '');
                  if (apenasNum.length > 7) setIdentificador(formatarCnpj(v));
                  else setIdentificador(v);
                }}
                placeholder="Ex: 29 ou 12.345.678/0001-90"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">Digite o codigo numerico do ERP ou seu CNPJ completo</p>
            </div>

            {lojas.length > 1 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Loja</label>
                <select
                  value={codLoja}
                  onChange={(e) => setCodLoja(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-orange-500"
                >
                  {lojas.map(l => (
                    <option key={l.codLoja} value={l.codLoja}>{l.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {erro && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {erro}
              </div>
            )}

            <button
              onClick={buscarFornecedor}
              disabled={loading || !identificador.trim()}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Buscando...' : 'Buscar Meus Produtos'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================================
  // STEP 2 — Lista de produtos
  // ===================================================================
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        {/* Header fixo */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 sticky top-0 z-10 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-lg leading-tight">{fornecedor?.fantasia || fornecedor?.razaoSocial}</h1>
              <p className="text-xs text-white/80">Cod: {fornecedor?.codigo} • Loja {codLoja} • {produtos.length} produtos</p>
            </div>
            <button onClick={() => setStep(1)} className="text-xs bg-white/20 px-3 py-1.5 rounded-full">Trocar</button>
          </div>
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="🔍 Filtrar por descricao, EAN ou codigo..."
            className="w-full mt-3 px-3 py-2 rounded-lg text-gray-800 text-sm"
          />
        </div>

        {/* Cards de produtos */}
        <div className="p-3 space-y-3">
          {produtosFiltrados.length === 0 && (
            <div className="text-center text-gray-500 py-8 text-sm">
              {produtos.length === 0
                ? 'Nenhum produto encontrado para este fornecedor nesta loja.'
                : 'Nenhum produto com esse filtro.'}
            </div>
          )}

          {produtosFiltrados.map((p) => {
            const corCurva = {
              A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-yellow-500',
              D: 'bg-orange-500', E: 'bg-red-500', X: 'bg-gray-400'
            }[p.curva] || 'bg-gray-400';
            return (
              <div key={p.codigo} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                {/* Cabecalho */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-gray-800 leading-tight">{p.descricao}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">EAN: {p.ean || '—'}</p>
                  </div>
                  <span className={`${corCurva} text-white text-xs font-bold px-2 py-1 rounded-full ml-2`}>
                    {p.curva}
                  </span>
                </div>

                {/* Infos em grid */}
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mb-2">
                  <div>📅 Ult. compra: <strong>{p.dtaUltCompra || '—'}</strong></div>
                  <div>📊 Cobertura: <strong>{p.cobertura} dias</strong></div>
                  <div>📦 Estoque: <strong>{p.estoqueAtual}</strong></div>
                  <div>↩️ Troca: <strong>{p.estoqueTroca || 0}</strong></div>
                </div>

                {/* Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Estoque (seu)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={p.qtdEstoqueInformada}
                      onChange={(e) => atualizarItem(p.codigo, 'qtdEstoqueInformada', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-orange-600 mb-0.5">Sugerir ✏️</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={p.qtdSugerida}
                      onChange={(e) => atualizarItem(p.codigo, 'qtdSugerida', e.target.value)}
                      placeholder="0"
                      className={`w-full px-2 py-2 border-2 rounded-lg text-sm font-bold ${
                        Number(p.qtdSugerida) > 0
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200'
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer fixo */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-3 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-700">
              <strong>{itensComQuantidade.length}</strong> produto(s) com sugestao
            </span>
          </div>
          <button
            onClick={() => setStep(3)}
            disabled={itensComQuantidade.length === 0}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-50"
          >
            Revisar e Enviar →
          </button>
        </div>
      </div>
    );
  }

  // ===================================================================
  // STEP 3 — Confirmacao
  // ===================================================================
  if (step === 3) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-32">
        <div className="max-w-md mx-auto">
          <button onClick={() => setStep(2)} className="text-sm text-orange-600 font-semibold mb-3">← Voltar</button>

          <div className="bg-white rounded-2xl shadow-md p-4 mb-4">
            <h2 className="font-bold text-lg text-gray-800 mb-1">Resumo do Pedido</h2>
            <p className="text-sm text-gray-600">{fornecedor?.fantasia} (Cod: {fornecedor?.codigo})</p>
            <p className="text-sm text-gray-600">Loja {codLoja} • {itensComQuantidade.length} produtos</p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4 mb-4 space-y-3">
            {itensComQuantidade.map(p => (
              <div key={p.codigo} className="flex justify-between items-start border-b border-gray-100 pb-2 last:border-0">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.descricao}</p>
                  <p className="text-xs text-gray-500">EAN: {p.ean || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-orange-600">{p.qtdSugerida}</p>
                  {p.qtdEstoqueInformada && (
                    <p className="text-[10px] text-gray-500">est: {p.qtdEstoqueInformada}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4 mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Observacoes (opcional)</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Ex: prazo de entrega, condicoes..."
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm"
            />
          </div>

          {erro && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
              {erro}
            </div>
          )}

          <button
            onClick={enviar}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl shadow-md disabled:opacity-50"
          >
            {loading ? 'Enviando...' : '✓ Confirmar e Enviar Pedido'}
          </button>
        </div>
      </div>
    );
  }

  // ===================================================================
  // STEP 4 — Sucesso
  // ===================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 text-center">
        <div className="text-6xl mb-3">✅</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Pedido Enviado!</h1>
        <p className="text-sm text-gray-600 mb-4">
          Seu pedido sugerido foi recebido com sucesso.
          <br/>O supermercado vai avaliar e entrar em contato.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <p className="text-gray-600">Numero do pedido</p>
          <p className="text-2xl font-bold text-green-600">#{pedidoIdEnviado}</p>
        </div>
        <button
          onClick={() => {
            setStep(1);
            setIdentificador('');
            setFornecedor(null);
            setProdutos([]);
            setObservacoes('');
            setPedidoIdEnviado(null);
            setErro('');
          }}
          className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl"
        >
          Enviar Outro Pedido
        </button>
      </div>
    </div>
  );
}
