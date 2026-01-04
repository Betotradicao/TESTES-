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
<<<<<<< HEAD
=======
  const [finalizing, setFinalizing] = useState(false);
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad

  useEffect(() => {
    loadSurvey();
    loadEmployees();
  }, [surveyId]);

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

<<<<<<< HEAD
  const handleUpdateStatus = async (status, observacao = '') => {
    if (!verificadoPor.trim()) {
      alert('Digite seu nome primeiro!');
=======
  const handleAddProduto = (status) => {
    if (!verificadoPor.trim()) {
      alert('Selecione o auditor primeiro!');
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
      setShowNameModal(true);
      return;
    }

    const currentItem = items[currentIndex];

<<<<<<< HEAD
    // Atualizar item localmente (não envia para API ainda)
    const updatedItems = [...items];
    updatedItems[currentIndex] = {
      ...currentItem,
      status_verificacao: status,
      data_verificacao: new Date(),
      verificado_por: verificadoPor,
      observacao_item: observacao,
    };
    setItems(updatedItems);

    // Ir para próximo item pendente
    const nextPending = updatedItems.findIndex(
      (item, idx) => idx > currentIndex && item.status_verificacao === 'pendente'
    );

    if (nextPending !== -1) {
      setCurrentIndex(nextPending);
    } else {
      // Ir para o primeiro item se não houver mais pendentes
      setCurrentIndex(0);
    }
  };

  // Nova função para alterar status de um item da lista
  const handleChangeStatusFromList = (itemId, newStatus) => {
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status_verificacao: newStatus,
          data_verificacao: new Date(),
          verificado_por: verificadoPor,
        };
      }
      return item;
    });
    setItems(updatedItems);
  };

  // Nova função para concluir a auditoria
  const handleConcluirAuditoria = async () => {
    if (!verificadoPor.trim()) {
      alert('Digite seu nome primeiro!');
      setShowNameModal(true);
      return;
    }

    // Verificar se todos os itens foram auditados
    const pendentes = items.filter(i => i.status_verificacao === 'pendente');
    if (pendentes.length > 0) {
      alert(`Ainda há ${pendentes.length} item(ns) pendente(s) de verificação!`);
      return;
    }

    setUpdating(true);

    try {
      // Enviar todos os itens para a API
      for (const item of items) {
        await api.patch(`/rupture-surveys/items/${item.id}/status`, {
          status: item.status_verificacao,
          verificado_por: item.verificado_por || verificadoPor,
          observacao: item.observacao_item || '',
        });
      }

      // Finalizar auditoria - Gera PDF e envia para WhatsApp
      console.log('🎯 Finalizando auditoria ID:', surveyId);
      const response = await api.post(`/rupture-surveys/${surveyId}/finalizar`);
      console.log('✅ Resposta da finalização:', response.data);

      if (response.data.whatsappEnviado) {
        alert('✅ Auditoria concluída com sucesso! O relatório em PDF foi enviado para o grupo do WhatsApp.');
      } else {
        alert('✅ Auditoria concluída com sucesso! PDF gerado, mas não foi enviado para WhatsApp (grupo não configurado).');
      }

      navigate('/ruptura-lancador');
    } catch (err) {
      console.error('❌ Erro completo:', err);
      console.error('❌ Erro response:', err.response);
      console.error('❌ Erro message:', err.message);
      const errorMsg = err.response?.data?.error || err.message || 'Erro desconhecido';
      setError(errorMsg);
      alert('❌ Erro ao concluir auditoria: ' + errorMsg);
    } finally {
      setUpdating(false);
    }
=======
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
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
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

<<<<<<< HEAD
=======
  const handleFinalizeSurvey = async () => {
    if (produtosSelecionados.length === 0) {
      alert('⚠️ Adicione pelo menos um produto antes de enviar a auditoria.');
      return;
    }

    const confirmacao = window.confirm(
      `📊 Deseja ENVIAR esta auditoria?\n\n` +
      `${produtosSelecionados.length} produtos serão enviados.\n\n` +
      'Será gerado um PDF com o relatório completo e enviado automaticamente para o WhatsApp.\n\n' +
      'Esta ação não pode ser desfeita.'
    );

    if (!confirmacao) {
      return;
    }

    setFinalizing(true);

    try {
      // Atualizar cada item com seu status
      for (const produto of produtosSelecionados) {
        await api.patch(`/rupture-surveys/items/${produto.id}/status`, {
          status: produto.status,
          verificado_por: verificadoPor,
          observacao: '',
        });
      }

      // Finalizar auditoria
      const response = await api.post(`/rupture-surveys/${surveyId}/finalize`);

      if (response.data.success) {
        alert('✅ ' + response.data.message + '\n\nO relatório PDF foi enviado para o grupo do WhatsApp!');
        navigate('/ruptura-lancador');
      } else {
        alert('⚠️ ' + response.data.message);
      }
    } catch (err) {
      console.error('Erro ao finalizar auditoria:', err);
      alert('❌ Erro ao finalizar auditoria: ' + (err.response?.data?.error || err.message));
    } finally {
      setFinalizing(false);
    }
  };

>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
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
<<<<<<< HEAD
  const progress = ((currentIndex + 1) / items.length) * 100;
  const verificados = items.filter(i => i.status_verificacao !== 'pendente').length;
=======
  const progress = (produtosSelecionados.length / items.length) * 100;
  const verificados = produtosSelecionados.length;
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad

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

            {currentItem.grupo && (
              <div>
                <p className="text-xs text-gray-500">Grupo</p>
                <p className="font-semibold text-gray-700">{currentItem.grupo}</p>
              </div>
            )}
          </div>

          {/* Status Buttons */}
          <div className="space-y-3">
<<<<<<< HEAD
            <p className="text-sm font-medium text-gray-700 mb-2">Status do produto na loja:</p>

            <button
              onClick={() => handleUpdateStatus('encontrado')}
              disabled={updating}
              className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-lg font-semibold"
=======
            <p className="text-sm font-medium text-gray-700 mb-2">Escolha o status do produto:</p>

            <button
              onClick={() => handleAddProduto('encontrado')}
              className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
            >
              ✅ ENCONTRADO
            </button>

            <button
<<<<<<< HEAD
              onClick={() => handleUpdateStatus('nao_encontrado')}
              disabled={updating}
              className="w-full py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-lg font-semibold"
=======
              onClick={() => handleAddProduto('nao_encontrado')}
              className="w-full py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-lg font-semibold"
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
            >
              ❌ RUPTURA (NÃO ENCONTRADO)
            </button>

            <button
<<<<<<< HEAD
              onClick={() => handleUpdateStatus('ruptura_estoque')}
              disabled={updating}
              className="w-full py-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 text-lg font-semibold"
=======
              onClick={() => handleAddProduto('ruptura_estoque')}
              className="w-full py-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-lg font-semibold"
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
            >
              📦 RUPTURA (EM ESTOQUE)
            </button>
          </div>

<<<<<<< HEAD
          {currentItem.status_verificacao !== 'pendente' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                ✅ Item já verificado como: <strong>{currentItem.status_verificacao}</strong>
                {currentItem.verificado_por && ` por ${currentItem.verificado_por}`}
=======
          {produtosSelecionados.find(p => p.id === currentItem.id) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                ✅ Produto adicionado à lista como: <strong>
                  {produtosSelecionados.find(p => p.id === currentItem.id).status}
                </strong>
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
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
<<<<<<< HEAD
              {items.filter(i => i.status_verificacao === 'encontrado').length}
=======
              {produtosSelecionados.filter(p => p.status === 'encontrado').length}
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
            </p>
            <p className="text-xs text-green-600">Encontrados</p>
          </div>
          <div className="bg-red-100 p-4 rounded-lg">
            <p className="text-2xl font-bold text-red-700">
<<<<<<< HEAD
              {items.filter(i => i.status_verificacao === 'nao_encontrado' || i.status_verificacao === 'ruptura_estoque').length}
=======
              {produtosSelecionados.filter(p => p.status === 'nao_encontrado' || p.status === 'ruptura_estoque').length}
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
            </p>
            <p className="text-xs text-red-600">Rupturas</p>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-2xl font-bold text-gray-700">
<<<<<<< HEAD
              {items.filter(i => i.status_verificacao === 'pendente').length}
=======
              {items.length - produtosSelecionados.length}
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
            </p>
            <p className="text-xs text-gray-600">Pendentes</p>
          </div>
        </div>

<<<<<<< HEAD
        {/* Lista de Produtos Auditados */}
        {items.filter(i => i.status_verificacao !== 'pendente').length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              📋 Produtos Auditados ({items.filter(i => i.status_verificacao !== 'pendente').length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-orange-600 text-white">
                    <th className="px-4 py-3 text-left text-sm font-semibold rounded-tl-lg">PRODUTO</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold rounded-tr-lg">AUDITORIA</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter(i => i.status_verificacao !== 'pendente')
                    .map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`border-b border-gray-200 hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {item.descricao}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={item.status_verificacao}
                            onChange={(e) => handleChangeStatusFromList(item.id, e.target.value)}
                            className={`w-full px-3 py-2 rounded border text-sm font-semibold ${
                              item.status_verificacao === 'encontrado'
                                ? 'bg-green-100 border-green-300 text-green-800'
                                : item.status_verificacao === 'nao_encontrado'
                                ? 'bg-red-100 border-red-300 text-red-800'
                                : 'bg-yellow-100 border-yellow-300 text-yellow-800'
                            }`}
                          >
                            <option value="encontrado">✅ Encontrado</option>
                            <option value="nao_encontrado">❌ Não Encontrado</option>
                            <option value="ruptura_estoque">📦 Ruptura (Em Estoque)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Botão Concluir - Só aparece quando todos os itens foram auditados */}
            {items.filter(i => i.status_verificacao === 'pendente').length === 0 && (
              <div className="mt-6">
                <button
                  onClick={handleConcluirAuditoria}
                  disabled={updating}
                  className="w-full py-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 text-lg font-bold shadow-lg"
                >
                  {updating ? '⏳ Enviando...' : '✅ CONCLUIR AUDITORIA'}
                </button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Ao clicar em "Concluir", todos os produtos serão enviados com os status da lista acima.
                </p>
              </div>
            )}
=======
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

        {/* Botão de Enviar Auditoria */}
        {produtosSelecionados.length > 0 && (
          <div className="mt-6">
            <button
              onClick={handleFinalizeSurvey}
              disabled={finalizing}
              className="w-full py-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg font-bold shadow-lg"
            >
              {finalizing ? '⏳ Enviando...' : 'ENVIAR AUDITORIA'}
            </button>
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
          </div>
        )}
      </div>
    </Layout>
  );
}
