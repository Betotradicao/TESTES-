import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

// Pilares da Rota do Crescimento
const PILARES = [
  { id: 'vendas', nome: 'Vendas', emoji: '📊', cor: 'from-blue-500 to-blue-600', corBg: 'bg-blue-50', corTexto: 'text-blue-700', corBorda: 'border-blue-200', prompt: 'Analise as vendas do mês atual. Identifique os 5 produtos que mais venderam e os 5 que mais caíram. Dê 5 ações específicas com nomes de produtos para aumentar o faturamento.' },
  { id: 'margem', nome: 'Margem', emoji: '💰', cor: 'from-green-500 to-green-600', corBg: 'bg-green-50', corTexto: 'text-green-700', corBorda: 'border-green-200', prompt: 'Analise as margens por setor do mês atual. Identifique os produtos com margem abaixo do benchmark e sugira preços específicos para subir. Liste os 5 produtos para subir preço e 5 para colocar em oferta (alta margem + baixo giro).' },
  { id: 'perdas', nome: 'Perdas', emoji: '📉', cor: 'from-red-500 to-red-600', corBg: 'bg-red-50', corTexto: 'text-red-700', corBorda: 'border-red-200', prompt: 'Analise as perdas e quebras do mês atual. Liste os TOP 10 produtos com mais perda por nome e valor. Identifique os motivos mais frequentes e sugira 5 ações específicas para reduzir perdas.' },
  { id: 'ruptura', nome: 'Ruptura', emoji: '🔴', cor: 'from-orange-500 to-orange-600', corBg: 'bg-orange-50', corTexto: 'text-orange-700', corBorda: 'border-orange-200', prompt: 'Analise a ruptura de estoque atual. Liste todos os produtos em falta, seus fornecedores e status de pedido. Dê 5 ações urgentes para resolver a ruptura.' },
  { id: 'descontos', nome: 'Descontos', emoji: '🏷️', cor: 'from-purple-500 to-purple-600', corBg: 'bg-purple-50', corTexto: 'text-purple-700', corBorda: 'border-purple-200', prompt: 'Analise os descontos aplicados no PDV este mês. Identifique quais operadores deram mais desconto, quais setores têm mais desconto manual e se há problemas de precificação. Sugira 5 ações específicas.' },
  { id: 'cancelamentos', nome: 'Cancelamentos', emoji: '❌', cor: 'from-pink-500 to-pink-600', corBg: 'bg-pink-50', corTexto: 'text-pink-700', corBorda: 'border-pink-200', prompt: 'Analise os cancelamentos e estornos do mês atual. Identifique os operadores com mais cancelamentos (compare com a média). Liste os TOP 10 com valores e sugira ações por nome de operador.' },
  { id: 'devolucoes', nome: 'Devoluções', emoji: '🔄', cor: 'from-amber-500 to-amber-600', corBg: 'bg-amber-50', corTexto: 'text-amber-700', corBorda: 'border-amber-200', prompt: 'Analise as trocas e devoluções do mês. Quais produtos tiveram mais devolução? Quais fornecedores com mais troca? Sugira 5 ações específicas para reduzir devoluções.' },
  { id: 'compra-venda', nome: 'Compra x Venda', emoji: '🛒', cor: 'from-teal-500 to-teal-600', corBg: 'bg-teal-50', corTexto: 'text-teal-700', corBorda: 'border-teal-200', prompt: 'Analise o comparativo compra vs venda por setor. Identifique setores comprando acima da venda (excesso de estoque) e setores comprando abaixo (risco de ruptura). Sugira 5 ações com números.' },
  { id: 'financeiro', nome: 'Financeiro', emoji: '🏦', cor: 'from-indigo-500 to-indigo-600', corBg: 'bg-indigo-50', corTexto: 'text-indigo-700', corBorda: 'border-indigo-200', prompt: 'Faça uma análise financeira geral: faturamento, margem bruta, ticket médio, total de cupons. Compare com mês anterior e identifique tendências. Dê 5 recomendações específicas para melhorar o resultado financeiro.' },
  { id: 'prazo', nome: 'Prazo', emoji: '⏰', cor: 'from-cyan-500 to-cyan-600', corBg: 'bg-cyan-50', corTexto: 'text-cyan-700', corBorda: 'border-cyan-200', prompt: 'Analise os prazos de pagamento dos fornecedores vs giro de estoque. Identifique fornecedores com prazo curto e estoque alto. Sugira renegociações específicas por fornecedor.' }
];

// Formatar markdown simples
const formatMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/^### (.*$)/gm, '<h4 class="font-bold text-sm mt-3 mb-1">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 class="font-bold text-base mt-4 mb-2">$1</h3>')
    .replace(/^# (.*$)/gm, '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- /gm, '• ')
    .replace(/\n/g, '<br/>');
};

export default function RotaCrescimento() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pilarSelecionado, setPilarSelecionado] = useState(null);
  const [insights, setInsights] = useState({}); // { pilarId: { loading, content, conversationId, timestamp } }
  const [metaLucro, setMetaLucro] = useState(() => {
    const saved = localStorage.getItem('rota_meta_lucro');
    return saved ? parseFloat(saved) : 0;
  });
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaTemp, setMetaTemp] = useState('');
  const [desafiosAceitos, setDesafiosAceitos] = useState(() => {
    const saved = localStorage.getItem('rota_desafios_aceitos');
    return saved ? JSON.parse(saved) : [];
  });
  const [gerandoTodos, setGerandoTodos] = useState(false);
  const contentRef = useRef(null);

  // Salvar meta no localStorage
  useEffect(() => {
    localStorage.setItem('rota_meta_lucro', metaLucro.toString());
  }, [metaLucro]);

  // Salvar desafios aceitos
  useEffect(() => {
    localStorage.setItem('rota_desafios_aceitos', JSON.stringify(desafiosAceitos));
  }, [desafiosAceitos]);

  // Gerar insights para um pilar via AI
  const gerarInsights = async (pilar) => {
    setInsights(prev => ({
      ...prev,
      [pilar.id]: { loading: true, content: null, timestamp: null }
    }));

    try {
      const response = await api.post('/api/ai-consultant/chat', {
        message: pilar.prompt,
        conversationId: insights[pilar.id]?.conversationId || null
      });

      setInsights(prev => ({
        ...prev,
        [pilar.id]: {
          loading: false,
          content: response.data.reply,
          conversationId: response.data.conversationId,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      setInsights(prev => ({
        ...prev,
        [pilar.id]: {
          loading: false,
          content: 'Erro ao gerar insights. Verifique se a API Key da OpenAI está configurada em Configurações > IA.',
          timestamp: null
        }
      }));
    }
  };

  // Gerar insights para todos os pilares
  const gerarTodosInsights = async () => {
    setGerandoTodos(true);
    for (const pilar of PILARES) {
      if (!insights[pilar.id]?.content || insights[pilar.id]?.loading) {
        await gerarInsights(pilar);
      }
    }
    setGerandoTodos(false);
  };

  // Aceitar desafio
  const aceitarDesafio = (pilarId, desafioTexto) => {
    const novoDesafio = {
      id: Date.now(),
      pilarId,
      texto: desafioTexto,
      dataAceite: new Date().toISOString(),
      status: 'ativo', // ativo, concluido, falhou
      resultado: null
    };
    setDesafiosAceitos(prev => [...prev, novoDesafio]);
  };

  // Concluir desafio
  const concluirDesafio = (desafioId, resultado) => {
    setDesafiosAceitos(prev => prev.map(d =>
      d.id === desafioId ? { ...d, status: resultado ? 'concluido' : 'falhou', resultado } : d
    ));
  };

  // Remover desafio
  const removerDesafio = (desafioId) => {
    setDesafiosAceitos(prev => prev.filter(d => d.id !== desafioId));
  };

  const salvarMeta = () => {
    const valor = parseFloat(metaTemp.replace(',', '.'));
    if (!isNaN(valor) && valor > 0) {
      setMetaLucro(valor);
    }
    setEditandoMeta(false);
  };

  const pilaresComInsight = PILARES.filter(p => insights[p.id]?.content).length;
  const desafiosAtivos = desafiosAceitos.filter(d => d.status === 'ativo').length;
  const desafiosConcluidos = desafiosAceitos.filter(d => d.status === 'concluido').length;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Rota do Crescimento</h1>
          <div className="w-10" />
        </div>

        <main className="p-4 lg:p-6" ref={contentRef}>
          {/* Header da Rota */}
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl">🚀</span>
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Rota do Crescimento</h1>
                    <p className="text-sm text-gray-500">Desafios diarios com IA para acelerar seus resultados</p>
                  </div>
                </div>
              </div>

              {/* Meta de Lucro */}
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🎯</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Meta de Lucro Mensal</p>
                    {editandoMeta ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">R$</span>
                        <input
                          type="text"
                          value={metaTemp}
                          onChange={(e) => setMetaTemp(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && salvarMeta()}
                          className="w-32 border border-gray-300 rounded px-2 py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="100.000"
                          autoFocus
                        />
                        <button onClick={salvarMeta} className="text-green-600 hover:text-green-800">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setMetaTemp(metaLucro > 0 ? metaLucro.toLocaleString('pt-BR') : ''); setEditandoMeta(true); }}
                        className="text-lg font-bold text-green-700 hover:text-green-900 transition-colors"
                      >
                        {metaLucro > 0 ? `R$ ${metaLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Definir meta...'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Painel de Status */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📡</span>
                <span className="text-xs font-medium text-gray-500">Pilares Analisados</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{pilaresComInsight}<span className="text-sm font-normal text-gray-400">/{PILARES.length}</span></p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(pilaresComInsight / PILARES.length) * 100}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">⚡</span>
                <span className="text-xs font-medium text-gray-500">Desafios Ativos</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{desafiosAtivos}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🏆</span>
                <span className="text-xs font-medium text-gray-500">Desafios Concluidos</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{desafiosConcluidos}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔥</span>
                <span className="text-xs font-medium text-gray-500">Score Total</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{desafiosConcluidos * 100}<span className="text-sm font-normal text-gray-400"> pts</span></p>
            </div>
          </div>

          {/* Botao Gerar Todos */}
          <div className="flex justify-center mb-6">
            <button
              onClick={gerarTodosInsights}
              disabled={gerandoTodos}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
            >
              {gerandoTodos ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Gerando insights com IA...
                </>
              ) : (
                <>
                  <span className="text-xl">🤖</span>
                  Gerar Insights IA para Todos os Pilares
                </>
              )}
            </button>
          </div>

          {/* Grid dos Pilares */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {PILARES.map((pilar) => {
              const insight = insights[pilar.id];
              const temInsight = insight?.content && !insight?.loading;
              const carregando = insight?.loading;

              return (
                <button
                  key={pilar.id}
                  onClick={() => {
                    setPilarSelecionado(pilar.id === pilarSelecionado ? null : pilar.id);
                    if (!temInsight && !carregando) {
                      gerarInsights(pilar);
                    }
                  }}
                  className={`relative rounded-xl border-2 p-4 transition-all hover:shadow-lg hover:scale-105 ${
                    pilarSelecionado === pilar.id
                      ? `${pilar.corBorda} ${pilar.corBg} shadow-lg scale-105`
                      : temInsight
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-orange-300'
                  }`}
                >
                  {/* Indicador de status */}
                  {temInsight && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                  )}
                  {carregando && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center shadow">
                      <svg className="animate-spin w-3 h-3 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    </div>
                  )}

                  <div className="text-3xl mb-2">{pilar.emoji}</div>
                  <p className={`text-sm font-semibold ${pilarSelecionado === pilar.id ? pilar.corTexto : 'text-gray-700'}`}>
                    {pilar.nome}
                  </p>
                  {temInsight && (
                    <p className="text-xs text-green-600 mt-1">Analisado</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Painel do Pilar Selecionado */}
          {pilarSelecionado && (
            <div className="mb-6 bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden animate-in">
              {(() => {
                const pilar = PILARES.find(p => p.id === pilarSelecionado);
                const insight = insights[pilarSelecionado];
                if (!pilar) return null;

                return (
                  <>
                    {/* Header do Pilar */}
                    <div className={`bg-gradient-to-r ${pilar.cor} text-white px-6 py-4 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{pilar.emoji}</span>
                        <div>
                          <h2 className="text-xl font-bold">{pilar.nome}</h2>
                          <p className="text-sm opacity-80">Insights e desafios da IA</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => gerarInsights(pilar)}
                          disabled={insight?.loading}
                          className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {insight?.loading ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                          )}
                          {insight?.loading ? 'Analisando...' : 'Atualizar'}
                        </button>
                        <button
                          onClick={() => setPilarSelecionado(null)}
                          className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Conteudo */}
                    <div className="p-6">
                      {insight?.loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                            <span className="text-3xl">🤖</span>
                          </div>
                          <p className="text-gray-600 font-medium">A IA esta analisando seus dados...</p>
                          <p className="text-gray-400 text-sm mt-1">Buscando dados do Oracle, calculando indicadores...</p>
                          <div className="mt-4 flex gap-1">
                            <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      ) : insight?.content ? (
                        <div>
                          <div
                            dangerouslySetInnerHTML={{ __html: formatMarkdown(insight.content) }}
                            className="text-sm text-gray-700 leading-relaxed [&>br]:mb-1 [&>h2]:text-gray-900 [&>h3]:text-gray-900 [&>h4]:text-gray-900 [&>strong]:text-gray-900"
                          />

                          {/* Timestamp */}
                          {insight.timestamp && (
                            <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
                              Gerado em {new Date(insight.timestamp).toLocaleString('pt-BR')}
                            </p>
                          )}

                          {/* Botao Aceitar Desafio */}
                          <div className="mt-6 pt-4 border-t border-gray-100">
                            <button
                              onClick={() => aceitarDesafio(pilarSelecionado, `Desafio ${pilar.nome}: Implementar as recomendações da IA geradas em ${new Date().toLocaleDateString('pt-BR')}`)}
                              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow hover:shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                            >
                              <span className="text-lg">⚡</span>
                              Aceitar como Desafio
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <span className="text-4xl block mb-3">{pilar.emoji}</span>
                          <p className="text-gray-500">Clique em "Atualizar" para gerar insights com IA</p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Desafios Aceitos */}
          {desafiosAceitos.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-gray-800 to-gray-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎮</span>
                  <div>
                    <h2 className="text-lg font-bold">Meus Desafios</h2>
                    <p className="text-sm text-gray-300">{desafiosAtivos} ativos, {desafiosConcluidos} concluidos</p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {desafiosAceitos.sort((a, b) => {
                  // Ativos primeiro, depois por data
                  if (a.status === 'ativo' && b.status !== 'ativo') return -1;
                  if (a.status !== 'ativo' && b.status === 'ativo') return 1;
                  return b.id - a.id;
                }).map((desafio) => {
                  const pilar = PILARES.find(p => p.id === desafio.pilarId);
                  return (
                    <div key={desafio.id} className="px-6 py-4 flex items-center gap-4">
                      <span className="text-2xl">{pilar?.emoji || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{desafio.texto}</p>
                        <p className="text-xs text-gray-500">
                          Aceito em {new Date(desafio.dataAceite).toLocaleDateString('pt-BR')}
                          {desafio.status === 'concluido' && ' — Concluido ✅'}
                          {desafio.status === 'falhou' && ' — Nao atingido ❌'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {desafio.status === 'ativo' && (
                          <>
                            <button
                              onClick={() => concluirDesafio(desafio.id, true)}
                              className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-200 transition-colors"
                              title="Marcar como concluido"
                            >
                              ✅ Concluido
                            </button>
                            <button
                              onClick={() => concluirDesafio(desafio.id, false)}
                              className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors"
                              title="Nao atingiu"
                            >
                              ❌ Falhou
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => removerDesafio(desafio.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remover desafio"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .animate-in {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
