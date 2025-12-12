import { useState, useEffect } from 'react';
import { fetchEmployees } from '../../services/employees.service';

const MOTIVOS_CANCELAMENTO = [
  { value: 'devolucao_mercadoria', label: '↩️ Cancelamento de Bipagem', icon: '↩️' },
  { value: 'produto_abandonado', label: '📦 Produto Abandonado', icon: '📦' },
  { value: 'falta_cancelamento', label: '❌ Falta de Cancelamento', icon: '❌' },
  { value: 'erro_operador', label: '👤 Erro do Operador(a)', icon: '👤', requiresEmployee: true },
  { value: 'erro_balconista', label: '🛒 Erro do Balconista', icon: '🛒', requiresEmployee: true },
  { value: 'furto', label: '🚨 Furto', icon: '🚨' }
];

export default function MotivoCancelamentoModal({ isOpen, onClose, onConfirm, loading }) {
  const [motivoSelecionado, setMotivoSelecionado] = useState('');
  const [employeeResponsavel, setEmployeeResponsavel] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Carregar funcionários quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      loadEmployees();
    }
  }, [isOpen]);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await fetchEmployees(1, 100, true);

      console.log('Dados recebidos do fetchEmployees:', response);

      // Backend returns { data: [...], pagination: {...} }
      const employeesList = response?.data || [];

      console.log('Lista de funcionários:', employeesList);

      if (!Array.isArray(employeesList)) {
        console.error('Employees data is not an array:', employeesList);
        setEmployees([]);
        return;
      }

      setEmployees(employeesList);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
      alert('⚠️ Erro ao carregar lista de funcionários. Verifique o console para mais detalhes.');
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const motivoRequiresFuncionario = () => {
    const motivoObj = MOTIVOS_CANCELAMENTO.find(m => m.value === motivoSelecionado);
    return motivoObj?.requiresEmployee || false;
  };

  const handleConfirm = () => {
    if (!motivoSelecionado) {
      alert('⚠️ Por favor, selecione um motivo de cancelamento');
      return;
    }

    if (motivoRequiresFuncionario() && !employeeResponsavel) {
      alert('⚠️ Por favor, selecione o funcionário responsável');
      return;
    }

    onConfirm(motivoSelecionado, employeeResponsavel || null);
  };

  const handleClose = () => {
    setMotivoSelecionado('');
    setEmployeeResponsavel('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-xl font-semibold text-gray-900">
            📋 Motivo do Cancelamento
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Selecione o motivo para cancelar esta bipagem
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="space-y-2">
            {MOTIVOS_CANCELAMENTO.map((motivo) => (
              <button
                key={motivo.value}
                onClick={() => {
                  setMotivoSelecionado(motivo.value);
                  // Limpar seleção de funcionário se não for necessário
                  if (!motivo.requiresEmployee) {
                    setEmployeeResponsavel('');
                  }
                }}
                disabled={loading}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  motivoSelecionado === motivo.value
                    ? 'border-orange-500 bg-orange-50 shadow-md'
                    : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{motivo.icon}</span>
                  <span className="font-medium text-gray-900">{motivo.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Seleção de Funcionário Responsável */}
          {motivoRequiresFuncionario() && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                👤 Funcionário Responsável *
              </label>

              {loadingEmployees ? (
                <div className="text-center py-4 text-gray-500">
                  Carregando funcionários...
                </div>
              ) : (
                <select
                  value={employeeResponsavel}
                  onChange={(e) => setEmployeeResponsavel(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Selecione o funcionário...</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              )}

              <p className="text-xs text-gray-500 mt-2">
                ⚠️ Obrigatório informar quem cometeu o erro
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ❌ Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !motivoSelecionado}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processando...</span>
              </>
            ) : (
              <span>✅ Confirmar Cancelamento</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
