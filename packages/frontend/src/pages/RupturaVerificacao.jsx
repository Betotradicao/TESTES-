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
  // Lista de pendentes aberta pelo clique no aviso amarelo
  const [showPendentes, setShowPendentes] = useState(false);
  const [produtosSemExposicao, setProdutosSemExposicao] = useState([]);
  const [produtosSimilares, setProdutosSimilares] = useState([]);
  const [loadingSimilares, setLoadingSimilares] = useState(false);

  useEffect(() => {
    loadSurvey();
    loadEmployees();
    loadProdutosSemExposicao();
  }, [surveyId]);

  const loadProdutosSemExposicao = async () => {
    try {
      const response = await api.get('/products/sem-exposicao');
      setProdutosSemExposicao(response.data.products || []);
    } catch (err) {
      console.error('Erro ao carregar produtos sem exposicao:', err);
    }
  };

  const isProdutoSemExposicao = (codigoProduto) => {
    return produtosSemExposicao.includes(String(codigoProduto));
  };

  // Carregar produtos similares quando o item atual mudar
  const loadProdutosSimilares = async (erpProductId) => {
    if (!erpProductId) {
      setProdutosSimilares([]);
      return;
    }
    setLoadingSimilares(true);
    try {
      const response = await api.get(`/products/similares/${erpProductId}`);
      setProdutosSimilares(response.data.similares || []);
    } catch (err) {
      console.error('Erro ao carregar produtos similares:', err);
      setProdutosSimilares([]);
    } finally {
      setLoadingSimilares(false);
    }
  };

  // Carregar similares quando mudar o item atual
  useEffect(() => {
    if (items.length > 0 && items[currentIndex]) {
      const currentItem = items[currentIndex];
      loadProdutosSimilares(currentItem.erp_product_id);
    }
  }, [currentIndex, items]);

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

  const handleAddProduto = async (status) => {
    if (!verificadoPor.trim()) {
      alert('Selecione o auditor primeiro!');
      setShowNameModal(true);
      return;
    }

    // Impedir adicionar mais produtos do que o total de itens
    const currentItem = items[currentIndex];
    const jaAdicionado = produtosSelecionados.find(p => p.id === currentItem.id);

    // Se o produto já foi adicionado e não estamos atualizando, não permitir duplicação
    if (jaAdicionado && !updating) {
      console.log('⚠️ [SAVE] Produto já foi adicionado anteriormente, apenas atualizando status');
      // Apenas atualizar o status
      setProdutosSelecionados(prev =>
        prev.map(p => p.id === currentItem.id ? { ...p, status } : p)
      );

      // Salvar a atualização no banco
      try {
        setUpdating(true);
        await api.patch(`/rupture-surveys/items/${currentItem.id}/status`, {
          status: status,
          verificado_por: verificadoPor,
          observacao: '',
        });
        console.log('✅ [SAVE] Status atualizado no banco:', currentItem.id);
      } catch (error) {
        console.error('❌ [SAVE] Erro ao atualizar status:', error);
        alert('❌ Erro ao atualizar status. Tente novamente.');
      } finally {
        setUpdating(false);
      }
      return;
    }

    // Impedir cliques duplos
    if (updating) {
      console.log('⚠️ [SAVE] Já está salvando, ignorando clique duplo');
      return;
    }

    // Verificar se já atingiu o limite de produtos (NÃO PODE PASSAR DO TOTAL)
    if (!jaAdicionado && produtosSelecionados.length >= items.length) {
      alert(`⚠️ Você já verificou todos os ${items.length} produtos desta pesquisa! Não é possível adicionar mais.`);
      console.error('❌ [SAVE] Tentativa de ultrapassar o limite:', {
        selecionados: produtosSelecionados.length,
        total: items.length
      });
      return;
    }

    console.log('📝 [SAVE] Salvando item IMEDIATAMENTE:', currentItem.id, 'Status:', status);

    try {
      // ✅ SALVAR IMEDIATAMENTE NO BANCO DE DADOS
      setUpdating(true);
      await api.patch(`/rupture-surveys/items/${currentItem.id}/status`, {
        status: status,
        verificado_por: verificadoPor,
        observacao: '',
      });
      console.log('✅ [SAVE] Item salvo no banco:', currentItem.id);

      // Adiciona novo produto à lista local
      setProdutosSelecionados(prev => [...prev, {
        ...currentItem,
        status,
      }]);
      console.log('➕ [SAVE] Item adicionado à lista local');

      // Ir para próximo item
      if (currentIndex < items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (error) {
      console.error('❌ [SAVE] Erro ao salvar item:', error);
      alert('❌ Erro ao salvar item. Tente novamente.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveProduto = async (itemId) => {
    // Confirmar remoção
    const confirma = window.confirm('Deseja realmente remover este produto da lista?');
    if (!confirma) return;

    try {
      // Remover do banco de dados - voltar status para pendente
      await api.patch(`/rupture-surveys/items/${itemId}/status`, {
        status: 'pendente',
        verificado_por: '',
        observacao: '',
      });
      console.log('✅ [REMOVE] Item removido do banco:', itemId);

      // Remover da lista local
      setProdutosSelecionados(prev => prev.filter(p => p.id !== itemId));
      console.log('✅ [REMOVE] Item removido da lista local:', itemId);
    } catch (error) {
      console.error('❌ [REMOVE] Erro ao remover item:', error);
      alert('❌ Erro ao remover item. Tente novamente.');
    }
  };

  const handleChangeTipo = async (itemId, novoStatus) => {
    try {
      // Atualizar no banco de dados
      await api.patch(`/rupture-surveys/items/${itemId}/status`, {
        status: novoStatus,
        verificado_por: verificadoPor,
        observacao: '',
      });
      console.log('✅ [UPDATE] Tipo atualizado no banco:', itemId, novoStatus);

      // Atualizar na lista local
      setProdutosSelecionados(prev =>
        prev.map(p => p.id === itemId ? { ...p, status: novoStatus } : p)
      );
      console.log('✅ [UPDATE] Tipo atualizado na lista local:', itemId);
    } catch (error) {
      console.error('❌ [UPDATE] Erro ao atualizar tipo:', error);
      alert('❌ Erro ao atualizar tipo. Tente novamente.');
    }
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
    console.log('🔵 [FINALIZE] handleFinalizeSurvey chamado');
    console.log('📦 [FINALIZE] Produtos selecionados:', produtosSelecionados.length);

    // Considera o que está verificado NO BANCO também, não só o que foi marcado nesta
    // sessão — senão reabrir uma auditoria já verificada travava aqui.
    const idsSessaoAtual = new Set(produtosSelecionados.map(p => p.id));
    const totalVerificado = items.filter(
      it => it.status_verificacao !== 'pendente' || idsSessaoAtual.has(it.id)
    ).length;

    if (totalVerificado === 0) {
      alert('⚠️ Verifique pelo menos um produto antes de enviar a auditoria.');
      return;
    }

    if (finalizing) {
      console.log('⏳ [FINALIZE] Já está finalizando, ignorando clique duplo');
      return;
    }

    const confirmacao = window.confirm(
      `📊 Deseja FINALIZAR e ENVIAR esta auditoria?\n\n` +
      `${totalVerificado} de ${items.length} produtos já foram salvos.\n\n` +
      'Será gerado um PDF com o relatório completo e enviado automaticamente para o WhatsApp.\n\n' +
      'Esta ação não pode ser desfeita.'
    );

    console.log('✅ [FINALIZE] Confirmação:', confirmacao);

    if (!confirmacao) {
      console.log('❌ [FINALIZE] Usuário cancelou a confirmação');
      return;
    }

    console.log('🚀 [FINALIZE] Iniciando finalização...');
    setFinalizing(true);

    try {
      console.log('📊 [FINALIZE] Todos os itens já foram salvos em tempo real!');
      console.log('📤 [FINALIZE] Finalizando auditoria e gerando PDF...');

      // Finalizar auditoria (os itens já foram salvos em tempo real)
      const response = await api.post(`/rupture-surveys/${surveyId}/finalize`);

      console.log('📊 [FINALIZE] Resposta do servidor:', response.data);

      if (response.data.success) {
        // Limpar progresso salvo ao finalizar com sucesso
        localStorage.removeItem(`ruptura_progress_${surveyId}`);
        alert('✅ ' + response.data.message + '\n\nO relatório PDF foi enviado para o grupo do WhatsApp!');
        console.log('🎉 [FINALIZE] Auditoria finalizada com sucesso! Redirecionando...');
        navigate('/ruptura-lancador');
      } else {
        console.warn('⚠️ [FINALIZE] Finalização não foi bem sucedida:', response.data);
        alert('⚠️ ' + response.data.message);
      }
    } catch (err) {
      console.error('❌ [FINALIZE] Erro ao finalizar auditoria:', err);
      console.error('❌ [FINALIZE] Detalhes do erro:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      alert('❌ Erro ao finalizar auditoria: ' + (err.response?.data?.error || err.message));
    } finally {
      console.log('🏁 [FINALIZE] Finalizando processo...');
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
  // Mesma correção da auditoria de Etiquetas (13/08/2026): item verificado = o que JÁ VEIO
  // verificado do banco + o que foi marcado nesta sessão. Contar só a sessão travava a
  // auditoria depois de um F5 / troca de aparelho / verificação em duas etapas: o banco
  // tinha tudo verificado e a tela insistia que faltavam itens.
  const idsDaSessao = new Set(produtosSelecionados.map(p => p.id));
  const itensPendentes = items.filter(
    it => it.status_verificacao === 'pendente' && !idsDaSessao.has(it.id)
  );
  const verificados = items.length - itensPendentes.length;
  const progress = items.length > 0 ? (verificados / items.length) * 100 : 0;

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
        <div className={`rounded-lg shadow-lg p-6 mb-6 ${isProdutoSemExposicao(currentItem.erp_product_id) ? 'bg-orange-50 border-2 border-orange-400' : 'bg-white'}`}>
          {/* Badge SEM EXPOSICAO */}
          {isProdutoSemExposicao(currentItem.erp_product_id) && (
            <div className="mb-4 bg-orange-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-bold">PRODUTO SEM EXPOSICAO EM GONDOLA</span>
              <span className="text-sm">(produto interno - nao procurar na prateleira)</span>
            </div>
          )}

          <div className="mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">
              📦 {currentItem.descricao}
            </h2>

            {currentItem.codigo_barras && (
              <p className="text-sm text-gray-600">
                Codigo: {currentItem.codigo_barras}
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

          {/* Produtos Similares */}
          {produtosSimilares.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span className="font-bold text-blue-700">ITENS SIMILARES</span>
                <span className="text-sm text-blue-600">(alternativas disponiveis)</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-blue-600">
                    <th className="pb-2">Codigo</th>
                    <th className="pb-2">Descricao</th>
                    <th className="pb-2">Secao</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {produtosSimilares.map((similar) => (
                    <tr key={similar.erp_product_id} className="border-t border-blue-200">
                      <td className="py-2 font-mono">{similar.erp_product_id}</td>
                      <td className="py-2">{similar.description}</td>
                      <td className="py-2">{similar.section_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loadingSimilares && (
            <div className="mb-4 text-sm text-gray-500 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              Carregando itens similares...
            </div>
          )}

          {/* Status Buttons */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Escolha o status do produto:</p>

            <button
              onClick={() => handleAddProduto('encontrado')}
              disabled={updating || (produtosSelecionados.length >= items.length && !produtosSelecionados.find(p => p.id === currentItem.id))}
              className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✅ ENCONTRADO
            </button>

            <button
              onClick={() => handleAddProduto('nao_encontrado')}
              disabled={updating || (produtosSelecionados.length >= items.length && !produtosSelecionados.find(p => p.id === currentItem.id))}
              className="w-full py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ❌ RUPTURA (NÃO ENCONTRADO)
            </button>

            <button
              onClick={() => handleAddProduto('ruptura_estoque')}
              disabled={updating || (produtosSelecionados.length >= items.length && !produtosSelecionados.find(p => p.id === currentItem.id))}
              className="w-full py-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
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

        {/* Pendentes: clicável, abre a lista de QUAIS itens faltam.
            (Substituiu um bloco de DEBUG que expunha IDs internos em produção.) */}
        {itensPendentes.length > 0 && (
          <div className="mt-4 mb-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPendentes(v => !v)}
              className="w-full p-4 text-center hover:bg-yellow-100 transition-colors"
            >
              <p className="text-yellow-800 font-semibold">
                ⚠️ {itensPendentes.length === 1
                  ? 'Falta 1 item para verificar'
                  : `Faltam ${itensPendentes.length} itens para verificar`}
              </p>
              <p className="text-sm text-yellow-700 mt-1 underline">
                {showPendentes ? 'Ocultar lista' : '👆 Toque para ver quais são'}
              </p>
            </button>

            {showPendentes && (
              <div className="border-t-2 border-yellow-300 bg-white max-h-72 overflow-y-auto divide-y divide-gray-100">
                {itensPendentes.map((it) => {
                  const idx = items.findIndex(x => x.id === it.id);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => { setCurrentIndex(idx); setShowPendentes(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors flex items-center gap-3"
                    >
                      <span className="text-xs font-bold text-gray-400 w-10 shrink-0">#{idx + 1}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-800 truncate">{it.descricao}</span>
                        <span className="block text-xs text-gray-500">
                          {it.codigo_barras || 'sem código'}{it.secao ? ` · ${it.secao}` : ''}
                        </span>
                      </span>
                      <span className="text-orange-600 text-sm font-bold shrink-0">ir →</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Botão de Enviar Auditoria */}
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
            disabled={finalizing || verificados === 0}
            className={`w-full py-4 rounded-lg transition-all text-lg font-bold shadow-lg ${
              verificados === 0
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
              : verificados === 0
                ? `❌ Sem produtos (0/${items.length})`
                : `✅ ENVIAR AUDITORIA (${verificados}/${items.length})`
            }
          </button>
        </div>
      </div>
    </Layout>
  );
}
