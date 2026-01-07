import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function RupturaVerificacao() {
  const { surveyId } = useParams();
  const navigate = useNavigate();

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

  // Log para debug - monitorar mudanças no produtosSelecionados
  useEffect(() => {
    console.log('🔴 produtosSelecionados mudou:', {
      length: produtosSelecionados.length,
      produtos: produtosSelecionados,
      deveExibirBotao: produtosSelecionados.length > 0
    });
  }, [produtosSelecionados]);

  const saveProgressToLocalStorage = () => {
    try {
      const progress = {
        produtosSelecionados,
        verificadoPor,
        currentIndex,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(`ruptura_progress_${surveyId}`, JSON.stringify(progress));
      console.log('💾 Progresso salvo automaticamente:', {
        produtos: produtosSelecionados.length,
        index: currentIndex
      });
    } catch (err) {
      console.error('❌ Erro ao salvar progresso:', err);
    }
  };

  const loadProgressFromLocalStorage = () => {
    try {
      const savedProgress = localStorage.getItem(`ruptura_progress_${surveyId}`);
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
          localStorage.removeItem(`ruptura_progress_${surveyId}`);
          return;
        }

        setProdutosSelecionados(progress.produtosSelecionados || []);
        setVerificadoPor(progress.verificadoPor || '');
        setCurrentIndex(safeIndex);

        // Só esconder modal se tiver auditor salvo
        if (progress.verificadoPor) {
          setShowNameModal(false);
        }

        console.log('✅ Progresso restaurado:', {
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
      localStorage.removeItem(`ruptura_progress_${surveyId}`);
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
      if (!surveyId || isNaN(parseInt(surveyId))) {
        setError('ID de pesquisa inválido');
        setLoading(false);
        return;
      }

      const response = await api.get(`/rupture-surveys/${parseInt(surveyId)}`);
      setSurvey(response.data);

      const surveyItems = Array.isArray(response.data.items) ? response.data.items : [];
      setItems(surveyItems);

      // Encontrar primeiro item pendente
      const firstPending = surveyItems.findIndex(
        item => item.status_verificacao === 'pendente'
      );
      if (firstPending !== -1) {
        setCurrentIndex(firstPending);
      }

      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar pesquisa:', err);
      setError(err.response?.data?.error || 'Erro ao carregar pesquisa');
      setLoading(false);
    }
  };

  const handleAddProduto = (status) => {
    if (!verificadoPor.trim()) {
      alert('Selecione o auditor primeiro!');
      setShowNameModal(true);
      return;
    }

    const currentItem = items[currentIndex];

    // Verificar se o produto já foi adicionado
    const jaAdicionado = produtosSelecionados.find(p => p.id === currentItem.id);

    if (jaAdicionado) {
      // Se já foi adicionado, atualiza o tipo
      setProdutosSelecionados(prev =>
        prev.map(p => p.id === currentItem.id ? { ...p, status } : p)
      );
    } else {
      // Adiciona novo produto
      setProdutosSelecionados(prev => [...prev, {
        ...currentItem,
        status,
      }]);
    }

    // Ir para próximo item
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
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
    console.log('🔵 handleFinalizeSurvey chamado');
    console.log('📦 Produtos selecionados:', produtosSelecionados.length);

    if (produtosSelecionados.length === 0) {
      alert('⚠️ Adicione pelo menos um produto antes de enviar a auditoria.');
      return;
    }

    if (finalizing) {
      console.log('⏳ Já está finalizando, ignorando clique duplo');
      return;
    }

    const confirmacao = window.confirm(
      `📊 Deseja ENVIAR esta auditoria?\n\n` +
      `${produtosSelecionados.length} produtos serão enviados.\n\n` +
      'Será gerado um PDF com o relatório completo e enviado automaticamente para o WhatsApp.\n\n' +
      'Esta ação não pode ser desfeita.'
    );

    console.log('✅ Confirmação:', confirmacao);

    if (!confirmacao) {
      console.log('❌ Usuário cancelou a confirmação');
      return;
    }

    console.log('🚀 Iniciando finalização...');
    setFinalizing(true);

    try {
      console.log(`📝 Atualizando ${produtosSelecionados.length} itens...`);

      // Atualizar cada item com seu status
      for (const produto of produtosSelecionados) {
        console.log(`  ↳ Atualizando item ${produto.id}: ${produto.status}`);
        await api.patch(`/rupture-surveys/items/${produto.id}/status`, {
          status: produto.status,
          verificado_por: verificadoPor,
          observacao: '',
        });
      }

      console.log('✅ Todos os itens atualizados. Finalizando auditoria...');

      // Finalizar auditoria
      const response = await api.post(`/rupture-surveys/${surveyId}/finalize`);

      console.log('📊 Resposta do servidor:', response.data);

      if (response.data.success) {
        // Limpar progresso salvo ao finalizar com sucesso
        localStorage.removeItem(`ruptura_progress_${surveyId}`);
        alert('✅ ' + response.data.message + '\n\nO relatório PDF foi enviado para o grupo do WhatsApp!');
        console.log('🎉 Auditoria finalizada com sucesso! Redirecionando...');
        navigate('/ruptura-lancador');
      } else {
        console.warn('⚠️ Finalização não foi bem sucedida:', response.data);
        alert('⚠️ ' + response.data.message);
      }
    } catch (err) {
      console.error('❌ Erro ao finalizar auditoria:', err);
      console.error('❌ Detalhes do erro:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      alert('❌ Erro ao finalizar auditoria: ' + (err.response?.data?.error || err.message));
    } finally {
      console.log('🏁 Finalizando processo...');
      setFinalizing(false);
    }
  };

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

  const currentItem = items[currentIndex];
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
            onClick={() => navigate('/ruptura-lancador')}
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

          <div className="grid grid-cols-2 gap-4 mb-6">
            {currentItem.fornecedor && (
              <div>
                <p className="text-xs text-gray-500">Fornecedor</p>
                <p className="font-semibold text-gray-700">🏪 {currentItem.fornecedor}</p>
              </div>
            )}

            {currentItem.valor_venda && (
              <div>
                <p className="text-xs text-gray-500">Valor Venda</p>
                <p className="font-semibold text-gray-700">
                  💰 R$ {Number(currentItem.valor_venda).toFixed(2)}
                </p>
              </div>
            )}

            {currentItem.venda_media_dia && (
              <div>
                <p className="text-xs text-gray-500">Venda Média/Dia</p>
                <p className="font-semibold text-gray-700">
                  📊 {Number(currentItem.venda_media_dia).toFixed(2)}
                </p>
              </div>
            )}

            {currentItem.curva && (
              <div>
                <p className="text-xs text-gray-500">Curva</p>
                <p className="font-semibold text-gray-700">
                  {currentItem.curva === 'A' && '🔴 Curva A'}
                  {currentItem.curva === 'B' && '🟡 Curva B'}
                  {currentItem.curva === 'C' && '🟢 Curva C'}
                </p>
              </div>
            )}

            {currentItem.estoque_atual !== null && (
              <div>
                <p className="text-xs text-gray-500">Estoque Atual</p>
                <p className={`font-semibold ${currentItem.estoque_atual > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  📦 {currentItem.estoque_atual}
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
            <p className="text-sm font-medium text-gray-700 mb-2">Escolha o status do produto:</p>

            <button
              onClick={() => handleAddProduto('encontrado')}
              className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
            >
              ✅ ENCONTRADO
            </button>

            <button
              onClick={() => handleAddProduto('nao_encontrado')}
              className="w-full py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-lg font-semibold"
            >
              ❌ RUPTURA (NÃO ENCONTRADO)
            </button>

            <button
              onClick={() => handleAddProduto('ruptura_estoque')}
              className="w-full py-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-lg font-semibold"
            >
              📦 RUPTURA (EM ESTOQUE)
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
        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-2xl font-bold text-green-700">
              {produtosSelecionados.filter(p => p.status === 'encontrado').length}
            </p>
            <p className="text-xs text-green-600">Encontrados</p>
          </div>
          <div className="bg-red-100 p-4 rounded-lg">
            <p className="text-2xl font-bold text-red-700">
              {produtosSelecionados.filter(p => p.status === 'nao_encontrado' || p.status === 'ruptura_estoque').length}
            </p>
            <p className="text-xs text-red-600">Rupturas</p>
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
                          <option value="encontrado">✅ ENCONTRADO</option>
                          <option value="nao_encontrado">❌ NÃO ENCONTRADO</option>
                          <option value="ruptura_estoque">📦 EM ESTOQUE</option>
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

        {/* DEBUG: Status dos produtos */}
        <div className="mt-4 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-bold text-blue-900">🔍 DEBUG - Produtos Selecionados: {produtosSelecionados.length}</p>
          <p className="text-xs text-blue-700 mt-1">
            {produtosSelecionados.length > 0
              ? `IDs: ${produtosSelecionados.map(p => p.id).join(', ')}`
              : 'Nenhum produto selecionado ainda'}
          </p>
        </div>

        {/* Botão de Enviar Auditoria - SEMPRE VISÍVEL PARA DEBUG */}
        <div className="mt-6 mb-8">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔵 [CLICK] Botão ENVIAR AUDITORIA clicado');
              console.log('📦 [CLICK] Produtos:', produtosSelecionados);
              handleFinalizeSurvey();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('📱 [TOUCH] Touch no botão ENVIAR AUDITORIA');
              console.log('📦 [TOUCH] Produtos:', produtosSelecionados);
              handleFinalizeSurvey();
            }}
            disabled={finalizing || produtosSelecionados.length === 0}
            className={`w-full py-4 rounded-lg transition-all text-lg font-bold shadow-lg ${
              produtosSelecionados.length === 0
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800'
            } ${finalizing ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'rgba(0,0,0,0)',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            {finalizing
              ? '⏳ Enviando...'
              : produtosSelecionados.length === 0
                ? `❌ Sem produtos (0/${items.length})`
                : `✅ ENVIAR AUDITORIA (${produtosSelecionados.length}/${items.length})`
            }
          </button>
        </div>
      </div>
    </Layout>
  );
}
