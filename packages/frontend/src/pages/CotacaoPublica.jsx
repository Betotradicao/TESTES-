import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import RadarLoading from '../components/RadarLoading';

// Detectar URL base da API (mesmo host, porta 3000)
function getBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    // Remove /api do final se existir, pois as rotas públicas são /api/public/cotacao
    return envUrl.replace(/\/api\/?$/, '');
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  return `http://${hostname}:3000`;
}
const BASE_URL = getBaseUrl();

const formatMoney = (val) => {
  if (!val && val !== 0) return 'R$ 0,00';
  return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export default function CotacaoPublica() {
  const { token } = useParams();
  const [cotacao, setCotacao] = useState(null);
  const [precos, setPrecos] = useState({});
  const [observacoes, setObservacoes] = useState({});
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const fetchCotacao = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/public/cotacao/${token}`);
        setCotacao(res.data);
        // Pré-preencher preços se já existirem (cotação já respondida)
        if (res.data.itens) {
          const precosIniciais = {};
          res.data.itens.forEach(item => {
            if (item.preco_fornecedor) {
              precosIniciais[item.id] = item.preco_fornecedor;
            }
          });
          setPrecos(precosIniciais);
          // Pré-preencher observações se já existirem
          const obsIniciais = {};
          res.data.itens.forEach(item => {
            if (item.observacao) {
              obsIniciais[item.id] = item.observacao;
            }
          });
          setObservacoes(obsIniciais);
        }
        if (res.data.status === 'respondida') {
          setEnviado(true);
        }
      } catch (err) {
        setErro('Cotação não encontrada ou link inválido.');
      } finally {
        setLoading(false);
      }
    };
    fetchCotacao();
  }, [token]);

  const handlePrecoChange = (itemId, valor) => {
    // Aceitar apenas números e vírgula/ponto
    const limpo = valor.replace(/[^0-9.,]/g, '').replace(',', '.');
    setPrecos(prev => ({ ...prev, [itemId]: limpo }));
  };

  const handleEnviar = async () => {
    setEnviando(true);
    try {
      const precosArray = Object.entries(precos)
        .filter(([, val]) => val !== '' && val !== undefined)
        .map(([id, preco_fornecedor]) => ({
          id,
          preco_fornecedor: parseFloat(preco_fornecedor),
          observacao: observacoes[id] || null,
        }));

      await axios.post(`${BASE_URL}/api/public/cotacao/${token}/responder`, { precos: precosArray });
      setEnviado(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao enviar cotação';
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RadarLoading message="Carregando cotação..." />
      </div>
    );
  }

  if (erro && !cotacao) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Inválido</h2>
          <p className="text-gray-600">{erro}</p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-green-700 mb-2">Cotação Enviada!</h2>
          <p className="text-gray-600 mb-4">Seus preços foram recebidos com sucesso. Obrigado!</p>
          <div className="bg-green-50 rounded-lg p-4 text-sm text-green-800">
            <p><strong>Pedido:</strong> #{cotacao.num_pedido}</p>
            <p><strong>Fornecedor:</strong> {cotacao.nome_fornecedor}</p>
          </div>
        </div>
      </div>
    );
  }

  const preenchidos = cotacao.itens.filter(item => precos[item.id] && parseFloat(precos[item.id]) > 0).length;
  const totalItens = cotacao.itens.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-5 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-lg font-bold">Cotação de Preços</h1>
          <p className="text-orange-100 text-sm mt-1">Pedido #{cotacao.num_pedido}</p>
          <p className="text-orange-100 text-sm">{cotacao.nome_fornecedor}</p>
        </div>
      </div>

      {/* Instruções */}
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Preencha o <strong>preço unitário atualizado</strong> de cada produto e clique em <strong>Enviar</strong>.
        </div>
      </div>

      {/* Tabela de itens */}
      <div className="max-w-4xl mx-auto px-4 pb-32">
        <div className="space-y-3">
          {cotacao.itens.map((item, idx) => {
            const preco = precos[item.id] || '';
            const temPreco = preco && parseFloat(preco) > 0;
            const curva = (item.curva || 'X').trim().toUpperCase();
            const curvaColors = {
              A: 'bg-green-500 text-white',
              B: 'bg-blue-500 text-white',
              C: 'bg-yellow-400 text-yellow-900',
              D: 'bg-orange-500 text-white',
              X: 'bg-gray-400 text-white',
            };
            const curvaClass = curvaColors[curva] || curvaColors['X'];
            const custoIdeal = item.custo_ideal ? parseFloat(item.custo_ideal) : null;
            const valTabela = parseFloat(item.val_tabela) || 0;
            const desconto = (custoIdeal && valTabela > custoIdeal) ? (valTabela - custoIdeal) : null;

            return (
              <div key={item.id} className={`bg-white rounded-lg shadow-sm border ${temPreco ? 'border-green-300' : 'border-gray-200'} p-3`}>
                {/* Linha 1: Número + COD + Código de Barras + CURVA grande */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 font-mono">{idx + 1}.</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">COD {item.cod_produto}</span>
                    {item.cod_barra && (
                      <span className="text-xs text-gray-400 font-mono">EAN {item.cod_barra}</span>
                    )}
                  </div>
                  <div className={`${curvaClass} text-center px-3 py-1 rounded-lg shadow-sm`}>
                    <span className="text-[10px] font-semibold block leading-tight opacity-80">CURVA</span>
                    <span className="text-xl font-black leading-tight">{curva}</span>
                  </div>
                </div>

                {/* Linha 2: Nome do produto */}
                <p className="text-sm font-semibold text-gray-900 mb-1.5">{item.des_produto}</p>

                {/* Linha 3: QTD, UN, CX, Último Custo */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                  <span>QTD: <strong className="text-gray-700">{parseFloat(item.qtd_pedido).toFixed(2)}</strong></span>
                  {item.des_unidade && <span>UN: <strong className="text-gray-700">{item.des_unidade}</strong></span>}
                  {item.qtd_embalagem > 0 && <span>CX: <strong className="text-gray-700">{item.qtd_embalagem}</strong></span>}
                  <span>Último Custo: <strong className="text-gray-700">{formatMoney(item.val_tabela)}</strong></span>
                </div>

                {/* Linha 4: CUSTO IDEAL + DESCONTO NECESSÁRIO + Input preço */}
                <div className="flex items-end justify-between gap-3">
                  <div className="flex-1 flex flex-wrap gap-2">
                    {custoIdeal && (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-2 inline-block">
                        <span className="text-[10px] text-emerald-600 block font-medium">CUSTO IDEAL</span>
                        <span className="text-xl font-black text-emerald-700">{formatMoney(custoIdeal)}</span>
                      </div>
                    )}
                    {desconto && (
                      <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2 inline-block">
                        <span className="text-[10px] text-red-500 block font-medium">DESC. NECESSÁRIO</span>
                        <span className="text-xl font-black text-red-600">- {formatMoney(desconto)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 w-36">
                    <label className="text-xs text-gray-500 block mb-1">Seu preço unitário (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={preco}
                      onChange={(e) => handlePrecoChange(item.id, e.target.value)}
                      className={`w-full px-3 py-2.5 text-right text-base font-bold border rounded-lg focus:outline-none focus:ring-2 ${temPreco ? 'border-green-400 focus:ring-green-300 bg-green-50' : 'border-gray-300 focus:ring-orange-300'}`}
                    />
                  </div>
                </div>

                {/* Feedback interativo ao preencher preço */}
                {temPreco && custoIdeal && (() => {
                  const precoNum = parseFloat(preco);
                  if (precoNum <= custoIdeal) {
                    return (
                      <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 animate-pulse">
                        🎉 Uau, você conseguiu bater o Custo Ideal! Você é o(a) cara! 👏👏
                      </div>
                    );
                  } else {
                    return (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
                        😔 Poxa, não bateu o Custo Ideal... Será que consegue chegar em <strong>{formatMoney(custoIdeal)}</strong>?
                      </div>
                    );
                  }
                })()}
                {temPreco && !custoIdeal && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">
                    ✅ Preço preenchido!
                  </div>
                )}

                {/* Campo de observação */}
                <div className="mt-2">
                  <label className="text-xs text-gray-500 block mb-1">💬 Observação (opcional)</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Consigo R$ 5,50 se aumentar a quantidade para 10 caixas. Tenho promoção para pedido acima de 50un."
                    value={observacoes[item.id] || ''}
                    onChange={(e) => setObservacoes(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none bg-gray-50 placeholder-gray-400"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer fixo com botão Enviar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
        <div className="max-w-4xl mx-auto">
          {/* Frase de progresso */}
          <div className="text-center text-sm mb-2">
            {preenchidos === 0 && (
              <span className="text-gray-500">📝 Preencha os preços para começar!</span>
            )}
            {preenchidos > 0 && preenchidos < totalItens * 0.5 && (
              <span className="text-orange-600">💪 Falta só mais um pouquinho, você consegue! Vai!</span>
            )}
            {preenchidos >= totalItens * 0.5 && preenchidos < totalItens && (
              <span className="text-blue-600">🔥 Mais da metade já! Está quase lá, continue!</span>
            )}
            {preenchidos === totalItens && (
              <span className="text-green-600">🎉 Todos preenchidos! Agora é só enviar! 🚀</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className={`font-bold ${preenchidos === totalItens ? 'text-green-600' : 'text-orange-600'}`}>{preenchidos}</span>
              <span> de {totalItens} preenchidos</span>
            </div>
            <button
              onClick={handleEnviar}
              disabled={enviando || preenchidos === 0}
              className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                preenchidos === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : enviando
                    ? 'bg-orange-400 cursor-wait'
                    : 'bg-orange-500 hover:bg-orange-600 active:scale-95'
              }`}
            >
              {enviando ? 'Enviando...' : `Enviar Cotação (${preenchidos})`}
            </button>
          </div>
        </div>
      </div>

      {/* Erro inline */}
      {erro && (
        <div className="fixed top-4 left-4 right-4 max-w-md mx-auto bg-red-100 border border-red-300 rounded-lg p-3 text-sm text-red-800 shadow-lg z-50">
          {erro}
          <button onClick={() => setErro(null)} className="ml-2 font-bold">✕</button>
        </div>
      )}
    </div>
  );
}
