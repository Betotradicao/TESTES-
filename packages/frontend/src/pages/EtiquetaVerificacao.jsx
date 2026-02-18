import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function EtiquetaVerificacao() {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const [componentError, setComponentError] = useState(null);

  // Adicionar handler de erro global
  useEffect(() => {
    const handleError = (event) => {
      console.error('🚨 ERRO GLOBAL CAPTURADO:', event.error);
      console.error('Stack:', event.error?.stack);

      // Capturar erro do pinComponent especificamente e ignorar
      if (event.error?.message?.includes('pinComponent') ||
          event.error?.message?.includes('PIN Company') ||
          event.error?.message?.includes('Invalid data') ||
          event.error?.message?.includes('Empty token')) {
        console.warn('⚠️ Erro externo detectado (pinComponent), ignorando...');
        event.preventDefault();
        return false;
      }

      // Para outros erros, capturar e prevenir propagação
      event.preventDefault();
      setComponentError(event.error);
      return false;
    };

    const handleUnhandledRejection = (event) => {
      console.error('🚨 PROMISE REJECTION:', event.reason);
      event.preventDefault();
    };

    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const [survey, setSurvey] = useState(null);
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [verificadoPor, setVerificadoPor] = useState('');
  const [showNameModal, setShowNameModal] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [finalizing, setFinalizing] = useState(false);
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);

  useEffect(() => {
    loadSurvey();
    loadEmployees();
  }, [surveyId]);

  // Carregar progresso somente APÓS items serem carregados
  useEffect(() => {
    if (items.length > 0 && !loading) {
      loadProgressFromLocalStorage();
    }
  }, [items, loading]);

  // Salvar progresso automaticamente quando houver mudanças
  useEffect(() => {
    if (produtosSelecionados.length > 0 && verificadoPor) {
      saveProgressToLocalStorage();
    }
  }, [produtosSelecionados, verificadoPor, currentIndex]);

  const saveProgressToLocalStorage = () => {
    try {
      const progress = {
        produtosSelecionados,
        verificadoPor,
        currentIndex,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(`etiqueta_progress_${surveyId}`, JSON.stringify(progress));
      console.log('💾 Progresso de etiquetas salvo automaticamente:', {
        produtos: produtosSelecionados.length,
        index: currentIndex
      });
    } catch (err) {
      console.error('❌ Erro ao salvar progresso:', err);
    }
  };

  const loadProgressFromLocalStorage = () => {
    try {
      const savedProgress = localStorage.getItem(`etiqueta_progress_${surveyId}`);
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);

        // Se não houver items carregados ainda, não restaurar
        if (items.length === 0) {
          console.warn('⚠️ Items ainda não carregados, aguardando...');
          return;
        }

        // Validar currentIndex antes de restaurar
        const validIndex = Math.min(progress.currentIndex || 0, items.length - 1);
        const safeIndex = Math.max(0, validIndex); // Garantir que não seja negativo

        // Se o progresso salvo não tem produtos e o index é inválido, limpar
        if ((!progress.produtosSelecionados || progress.produtosSelecionados.length === 0) &&
            (progress.currentIndex >= items.length || progress.currentIndex < 0)) {
          console.warn('⚠️ Progresso inválido detectado, limpando...');
          localStorage.removeItem(`etiqueta_progress_${surveyId}`);
          return;
        }

        setProdutosSelecionados(progress.produtosSelecionados || []);
        setVerificadoPor(progress.verificadoPor || '');
        setCurrentIndex(safeIndex);

        // Só esconder modal se tiver auditor salvo
        if (progress.verificadoPor) {
          setShowNameModal(false);
        }

        console.log('✅ Progresso de etiquetas restaurado:', {
          produtos: progress.produtosSelecionados?.length || 0,
          auditor: progress.verificadoPor,
          indexSalvo: progress.currentIndex,
          indexRestaurado: safeIndex,
          totalItems: items.length,
          salvoEm: progress.savedAt
        });
      }
    } catch (err) {
      console.error('❌ Erro ao carregar progresso:', err);
      // Se houver erro, limpar o localStorage corrompido
      localStorage.removeItem(`etiqueta_progress_${surveyId}`);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await api.get('/employees?active=true&limit=100');
      // O endpoint retorna { data: [...], total, page, limit }
      const employeeList = Array.isArray(response.data?.data) ? response.data.data : [];
      setEmployees(employeeList);
    } catch (err) {
      console.error('Erro ao carregar colaboradores:', err);
      setEmployees([]);
    }
  };

  const loadSurvey = async () => {
    try {
      console.log('🔵 Carregando auditoria:', surveyId);

      if (!surveyId || isNaN(parseInt(surveyId))) {
        console.error('❌ ID de pesquisa inválido:', surveyId);
        setError('ID de pesquisa inválido');
        setLoading(false);
        return;
      }

      const response = await api.get(`/label-audits/${parseInt(surveyId)}`);
      console.log('✅ Auditoria carregada:', response.data);

      setSurvey(response.data);

      const surveyItems = Array.isArray(response.data.items) ? response.data.items : [];
      console.log('📦 Total de items:', surveyItems.length);

      setItems(surveyItems);

      // Encontrar primeiro item pendente
      const firstPending = surveyItems.findIndex(
        item => item.status_verificacao === 'pendente'
      );
      console.log('🔍 Primeiro item pendente:', firstPending);

      if (firstPending !== -1) {
        setCurrentIndex(firstPending);
      } else if (surveyItems.length > 0) {
        // Se não houver pendentes, começar do primeiro
        setCurrentIndex(0);
        console.log('ℹ️ Nenhum item pendente, iniciando do primeiro');
      }

      setLoading(false);
      console.log('✅ Loading concluído');
    } catch (err) {
      console.error('❌ Erro ao carregar pesquisa:', err);
      setError(err.response?.data?.error || 'Erro ao carregar pesquisa');
      setLoading(false);
    }
  };

  const handleAddProduto = async (status) => {
    if (!verificadoPor.trim()) {
      alert('Selecione o auditor primeiro!');
      setShowNameModal(true);
      return;
    }

    const currentItem = items[currentIndex];
    console.log('📝 [ETIQUETAS-SAVE] Salvando item IMEDIATAMENTE:', currentItem.id, 'Status:', status);

    try {
      // ✅ SALVAR IMEDIATAMENTE NO BANCO DE DADOS
      setUpdating(true);
      await api.put(`/label-audits/items/${currentItem.id}/verify`, {
        status_verificacao: status,
        verificado_por: verificadoPor,
        observacao: '',
      });
      console.log('✅ [ETIQUETAS-SAVE] Item salvo no banco:', currentItem.id);

      // Verificar se o produto já foi adicionado à lista local
      const jaAdicionado = produtosSelecionados.find(p => p.id === currentItem.id);

      if (jaAdicionado) {
        // Se já foi adicionado, atualiza o tipo
        setProdutosSelecionados(prev =>
          prev.map(p => p.id === currentItem.id ? { ...p, status } : p)
        );
        console.log('🔄 [ETIQUETAS-SAVE] Item atualizado na lista local');
      } else {
        // Adiciona novo produto à lista local
        setProdutosSelecionados(prev => [...prev, {
          ...currentItem,
          status,
        }]);
        console.log('➕ [ETIQUETAS-SAVE] Item adicionado à lista local');
      }

      // Ir para próximo item
      if (currentIndex < items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (error) {
      console.error('❌ [ETIQUETAS-SAVE] Erro ao salvar item:', error);
      alert('❌ Erro ao salvar item. Tente novamente.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveProduto = (itemId) => {
    setProdutosSelecionados(prev => prev.filter(p => p.id !== itemId));
  };

  const handleChangeTipo = (itemId, novoStatus) => {
    setProdutosSelecionados(prev =>
      prev.map(p => p.id === itemId ? { ...p, status: novoStatus } : p)
    );
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleFinalizeSurvey = async () => {
    console.log('🔵 [ETIQUETAS-FINALIZE] handleFinalizeSurvey chamado');
    console.log('📦 [ETIQUETAS-FINALIZE] Produtos selecionados:', produtosSelecionados.length);

    if (produtosSelecionados.length === 0) {
      alert('⚠️ Adicione pelo menos um produto antes de enviar a auditoria.');
      return;
    }

    if (finalizing) {
      console.log('⏳ [ETIQUETAS-FINALIZE] Já está finalizando, ignorando clique duplo');
      return;
    }

    const confirmacao = window.confirm(
      `📊 Deseja FINALIZAR e ENVIAR esta auditoria?\n\n` +
      `${produtosSelecionados.length} produtos já foram salvos.\n\n` +
      'Será gerado um PDF com o relatório completo e enviado automaticamente para o WhatsApp.\n\n' +
      'Esta ação não pode ser desfeita.'
    );

    console.log('✅ [ETIQUETAS-FINALIZE] Confirmação:', confirmacao);

    if (!confirmacao) {
      console.log('❌ [ETIQUETAS-FINALIZE] Usuário cancelou a confirmação');
      return;
    }

    console.log('🚀 [ETIQUETAS-FINALIZE] Iniciando finalização...');
    setFinalizing(true);

    try {
      console.log('📊 [ETIQUETAS-FINALIZE] Todos os itens já foram salvos em tempo real!');
      console.log('📤 [ETIQUETAS-FINALIZE] Finalizando auditoria e gerando PDF...');

      // Enviar relatório via WhatsApp (os itens já foram salvos em tempo real)
      const response = await api.post(`/label-audits/${surveyId}/send-report`);

      console.log('📊 [ETIQUETAS-FINALIZE] Resposta do servidor:', response.data);

      if (response.data.success) {
        // Limpar progresso salvo ao finalizar com sucesso
        localStorage.removeItem(`etiqueta_progress_${surveyId}`);
        alert('✅ ' + response.data.message + '\n\nO relatório PDF foi enviado para o grupo do WhatsApp!');
        console.log('🎉 [ETIQUETAS-FINALIZE] Auditoria finalizada com sucesso! Redirecionando...');
        navigate('/etiquetas/lancar');
      } else {
        console.warn('⚠️ [ETIQUETAS-FINALIZE] Finalização não foi bem sucedida:', response.data);
        alert('⚠️ ' + response.data.message);
      }
    } catch (err) {
      console.error('❌ [ETIQUETAS-FINALIZE] Erro ao finalizar auditoria:', err);
      console.error('❌ [ETIQUETAS-FINALIZE] Detalhes do erro:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      alert('❌ Erro ao finalizar auditoria: ' + (err.response?.data?.error || err.message));
    } finally {
      console.log('🏁 [ETIQUETAS-FINALIZE] Finalizando processo...');
      setFinalizing(false);
    }
  };

  // Mostrar erro crítico do componente
  if (componentError) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-lg">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-xl text-gray-800 font-bold mb-2">Erro ao carregar página</p>
            <p className="text-sm text-gray-600 mb-4">{componentError.message}</p>
            <button
              onClick={() => {
                setComponentError(null);
                navigate('/etiquetas/lancar');
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Voltar para Listagem
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-xl text-gray-600">Carregando pesquisa...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !survey || items.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-xl text-gray-600">{error || 'Pesquisa não encontrada'}</p>
            <button
              onClick={() => navigate('/etiquetas/lancar')}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Voltar
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  console.log('🔍 Estado atual:', {
    loading,
    error,
    itemsLength: items.length,
    currentIndex,
    surveyId,
    hasSurvey: !!survey
  });

  const currentItem = items[currentIndex];
  console.log('📦 Current item:', currentItem);

  // Se não houver item atual (verificação concluída ou índice inválido), redirecionar
  if (!currentItem) {
    console.warn('⚠️ Nenhum item atual encontrado');
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-xl text-gray-600 mb-2">Verificação concluída ou não há itens pendentes</p>
            <p className="text-sm text-gray-500 mb-4">
              Todos os itens foram verificados ou a auditoria foi finalizada
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/etiquetas/lancar')}
                className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                ← Voltar
              </button>
              <button
                onClick={() => navigate(`/etiquetas-resultados/${surveyId}`)}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Ver Resultados →
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }
  const progress = (produtosSelecionados.length / items.length) * 100;
  const verificados = produtosSelecionados.length;

  return (
    <Layout>
      {/* Modal para pedir nome */}
      {showNameModal && !verificadoPor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Selecione o Auditor</h2>
            <p className="text-gray-600 mb-4">
              Para iniciar a verificação, selecione quem está auditando os itens.
            </p>
            <select
              value={verificadoPor}
              onChange={(e) => setVerificadoPor(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              autoFocus
            >
              <option value="">Selecione um colaborador...</option>
              {Array.isArray(employees) && employees.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (verificadoPor.trim()) {
                  setShowNameModal(false);
                } else {
                  alert('Selecione um auditor para continuar');
                }
              }}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Começar Verificação
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/etiquetas/lancar')}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Voltar
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            {survey.nome_pesquisa}
          </h1>
          <p className="text-sm text-gray-600">
            Verificando por: <strong>{verificadoPor}</strong>
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>⚡ Progresso: {verificados}/{items.length} ({progress.toFixed(0)}%)</span>
            <span>Item {currentIndex + 1} de {items.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Product Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">
              📦 {currentItem.descricao}
            </h2>

            {currentItem.codigo_barras && (
              <p className="text-sm text-gray-600">
                Código: {currentItem.codigo_barras}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {currentItem.secao && (
              <div>
                <p className="text-xs text-gray-500">Seção</p>
                <p className="font-semibold text-blue-700 text-lg">📂 Seção {currentItem.secao}</p>
              </div>
            )}

            {currentItem.margem_pratica && (
              <div>
                <p className="text-xs text-gray-500">Margem</p>
                <p className="font-semibold text-green-700">📈 {currentItem.margem_pratica}</p>
              </div>
            )}

            {currentItem.valor_venda && (
              <div>
                <p className="text-xs text-gray-500">Valor Venda</p>
                <p className="font-semibold text-gray-900 text-2xl">
                  💰 R$ {Number(currentItem.valor_venda).toFixed(2).replace('.', ',')}
                </p>
              </div>
            )}

            {currentItem.valor_oferta && Number(currentItem.valor_oferta) > 0 && (
              <div className="col-span-2 bg-gradient-to-r from-orange-100 to-yellow-100 p-4 rounded-lg border-2 border-orange-400 animate-pulse">
                <p className="text-sm font-bold text-orange-800 mb-1">🔥 PRODUTO EM OFERTA!</p>
                <p className="text-3xl font-black text-orange-600">
                  R$ {Number(currentItem.valor_oferta).toFixed(2).replace('.', ',')}
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  ⚠️ CONFERIR ETIQUETA COM ESTE PREÇO!
                </p>
              </div>
            )}

            {currentItem.secao && (
              <div>
                <p className="text-xs text-gray-500">Seção</p>
                <p className="font-semibold text-gray-700">📂 {currentItem.secao}</p>
              </div>
            )}

            {currentItem.grupo && (
              <div>
                <p className="text-xs text-gray-500">Grupo</p>
                <p className="font-semibold text-gray-700">{currentItem.grupo}</p>
              </div>
            )}
          </div>

          {/* Status Buttons */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-2">🏷️ A etiqueta na gôndola está correta?</p>

            <button
              onClick={() => handleAddProduto('preco_correto')}
              className="w-full py-5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xl font-bold shadow-lg"
            >
              ✅ PREÇO CORRETO
            </button>

            <button
              onClick={() => handleAddProduto('preco_divergente')}
              className="w-full py-5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xl font-bold shadow-lg"
            >
              ❌ PREÇO DIVERGENTE
            </button>
          </div>

          {produtosSelecionados.find(p => p.id === currentItem.id) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                ✅ Produto adicionado à lista como: <strong>
                  {produtosSelecionados.find(p => p.id === currentItem.id).status}
                </strong>
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex space-x-4">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ⬅️ Anterior
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === items.length - 1}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Próximo ➡️
          </button>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-2xl font-bold text-green-700">
              {produtosSelecionados.filter(p => p.status === 'preco_correto').length}
            </p>
            <p className="text-xs text-green-600">Encontrados</p>
          </div>
          <div className="bg-red-100 p-4 rounded-lg">
            <p className="text-2xl font-bold text-red-700">
              {produtosSelecionados.filter(p => p.status === 'preco_divergente' || p.status === 'preco_divergente').length}
            </p>
            <p className="text-xs text-red-600">Etiquetas</p>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-2xl font-bold text-gray-700">
              {items.length - produtosSelecionados.length}
            </p>
            <p className="text-xs text-gray-600">Pendentes</p>
          </div>
        </div>

        {/* Tabela de Produtos Selecionados */}
        {produtosSelecionados.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              📋 Produtos Adicionados ({produtosSelecionados.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">PRODUTO</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">TIPO</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {produtosSelecionados.map((produto) => (
                    <tr key={produto.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{produto.descricao}</p>
                        {produto.codigo_barras && (
                          <p className="text-xs text-gray-500">Cód: {produto.codigo_barras}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={produto.status}
                          onChange={(e) => handleChangeTipo(produto.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="preco_correto">✅ PREÇO CORRETO</option>
                          <option value="preco_divergente">❌ PREÇO DIVERGENTE</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleRemoveProduto(produto.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs font-medium"
                        >
                          🗑️ Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Botão de Enviar Auditoria - só aparece quando TODOS os itens foram verificados */}
        {produtosSelecionados.length === items.length && produtosSelecionados.length > 0 && (
          <div className="mt-6">
            <button
              onClick={handleFinalizeSurvey}
              disabled={finalizing}
              className="w-full py-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg font-bold shadow-lg"
            >
              {finalizing ? '⏳ Enviando...' : '📤 ENVIAR AUDITORIA'}
            </button>
          </div>
        )}

        {/* Mensagem quando ainda há itens pendentes */}
        {produtosSelecionados.length > 0 && produtosSelecionados.length < items.length && (
          <div className="mt-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 text-center">
            <p className="text-yellow-800 font-semibold">
              ⚠️ Faltam {items.length - produtosSelecionados.length} itens para verificar
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              O botão de enviar aparecerá quando todos os itens forem verificados
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
