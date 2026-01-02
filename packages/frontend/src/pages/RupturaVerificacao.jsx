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

  const handleUpdateStatus = async (status, observacao = '') => {
    if (!verificadoPor.trim()) {
      alert('Digite seu nome primeiro!');
      setShowNameModal(true);
      return;
    }

    const currentItem = items[currentIndex];
    setUpdating(true);

    try {
      await api.patch(`/rupture-surveys/items/${currentItem.id}/status`, {
        status,
        verificado_por: verificadoPor,
        observacao,
      });

      // Atualizar item localmente
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
        // Todos os itens verificados - mostrar mensagem
        alert('✅ Todos os itens foram verificados!\n\nAgora clique em "CONCLUIR AUDITORIA" no final da página para gerar o PDF e enviar para o WhatsApp.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar status');
    } finally {
      setUpdating(false);
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
    // Verificar se todos os itens foram verificados
    const pendentes = items.filter(i => i.status_verificacao === 'pendente').length;

    if (pendentes > 0) {
      alert(`⚠️ Ainda existem ${pendentes} itens pendentes. Verifique todos os itens antes de finalizar.`);
      return;
    }

    const confirmacao = window.confirm(
      '📊 Deseja FINALIZAR esta auditoria?\n\n' +
      'Será gerado um PDF com o relatório completo e enviado automaticamente para o WhatsApp.\n\n' +
      'Esta ação não pode ser desfeita.'
    );

    if (!confirmacao) {
      return;
    }

    setFinalizing(true);

    try {
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
  const progress = ((currentIndex + 1) / items.length) * 100;
  const verificados = items.filter(i => i.status_verificacao !== 'pendente').length;

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
            <p className="text-sm font-medium text-gray-700 mb-2">Status do produto na loja:</p>

            <button
              onClick={() => handleUpdateStatus('encontrado')}
              disabled={updating}
              className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-lg font-semibold"
            >
              ✅ ENCONTRADO
            </button>

            <button
              onClick={() => handleUpdateStatus('nao_encontrado')}
              disabled={updating}
              className="w-full py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-lg font-semibold"
            >
              ❌ NÃO ENCONTRADO (RUPTURA)
            </button>

            <button
              onClick={() => handleUpdateStatus('ruptura_estoque')}
              disabled={updating}
              className="w-full py-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 text-lg font-semibold"
            >
              📦 RUPTURA (EM ESTOQUE)
            </button>
          </div>

          {currentItem.status_verificacao !== 'pendente' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                ✅ Item já verificado como: <strong>{currentItem.status_verificacao}</strong>
                {currentItem.verificado_por && ` por ${currentItem.verificado_por}`}
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
              {items.filter(i => i.status_verificacao === 'encontrado').length}
            </p>
            <p className="text-xs text-green-600">Encontrados</p>
          </div>
          <div className="bg-red-100 p-4 rounded-lg">
            <p className="text-2xl font-bold text-red-700">
              {items.filter(i => i.status_verificacao === 'nao_encontrado' || i.status_verificacao === 'ruptura_estoque').length}
            </p>
            <p className="text-xs text-red-600">Rupturas</p>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-2xl font-bold text-gray-700">
              {items.filter(i => i.status_verificacao === 'pendente').length}
            </p>
            <p className="text-xs text-gray-600">Pendentes</p>
          </div>
        </div>

        {/* Botão de Finalizar Auditoria */}
        {items.filter(i => i.status_verificacao === 'pendente').length === 0 && (
          <div className="mt-6">
            <button
              onClick={handleFinalizeSurvey}
              disabled={finalizing}
              className="w-full py-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg font-bold shadow-lg"
            >
              {finalizing ? '⏳ Enviando...' : 'ENVIAR AUDITORIA'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
