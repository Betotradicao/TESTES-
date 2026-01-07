import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function WhatsAppGroupsTab() {
  const [activeSubTab, setActiveSubTab] = useState('ruptura');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [isFetchingGroups, setIsFetchingGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [showGroupsModal, setShowGroupsModal] = useState(false);

  const [groupConfigs, setGroupConfigs] = useState({
    ruptura: {
      groupId: '',
      groupName: '',
    },
    etiquetas: {
      groupId: '',
      groupName: '',
    },
    bipagens: {
      groupId: '',
      groupName: '',
    }
  });

  const subTabs = [
    { id: 'ruptura', label: '📦 Prevenção Ruptura', icon: '📦' },
    { id: 'etiquetas', label: '🏷️ Prevenção Etiquetas', icon: '🏷️' },
    { id: 'bipagens', label: '🔔 Prevenção Bipagens', icon: '🔔' }
  ];

  // Mensagens de exemplo para cada tipo
  const messageExamples = {
    ruptura: `📊 *RELATÓRIO DE AUDITORIA DE RUPTURAS*

📋 Auditoria: Pesquisa 07/01/2026
📅 Data: 07/01/2026, 21:26:32

📦 Total de Rupturas: 20
🔴 Não Encontrado: 11
🟠 Em Estoque: 9

💰 Perda de Venda: R$ 2123.92
📉 Perda de Lucro: R$ 685.25

📄 Confira o relatório detalhado em PDF anexo.`,

    etiquetas: `🏷️ *RELATÓRIO DE AUDITORIA DE ETIQUETAS*

📋 Auditoria: Auditoria #13
📅 Data: 07/01/2026, 21:26:32

📦 Total de Itens: 150
✅ Preço Correto: 137
❌ Preço Divergente: 13

📄 Confira o relatório detalhado em PDF anexo.`,

    bipagens: `🔔 *RELATÓRIO DE BIPAGENS PENDENTES*

📅 Período: 06/01/2026 até 07/01/2026
⏰ Total de Bipagens: 45

🟢 Respondidas: 32
🔴 Pendentes: 13

📄 Confira os detalhes em PDF anexo.`
  };

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/config/configurations');

      if (response.data.success && response.data.data) {
        const configs = response.data.data;

        setGroupConfigs({
          ruptura: {
            groupId: configs.whatsapp_group_ruptura || configs.evolution_whatsapp_group_id || '',
            groupName: configs.whatsapp_group_ruptura_name || 'Grupo Padrão',
          },
          etiquetas: {
            groupId: configs.whatsapp_group_etiquetas || configs.evolution_whatsapp_group_id || '',
            groupName: configs.whatsapp_group_etiquetas_name || 'Grupo Padrão',
          },
          bipagens: {
            groupId: configs.whatsapp_group_bipagens || configs.evolution_whatsapp_group_id || '',
            groupName: configs.whatsapp_group_bipagens_name || 'Grupo Padrão',
          }
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const currentConfig = groupConfigs[activeSubTab];

      const configKey = `whatsapp_group_${activeSubTab}`;
      const configNameKey = `whatsapp_group_${activeSubTab}_name`;

      await api.post('/config/configurations', {
        [configKey]: currentConfig.groupId,
        [configNameKey]: currentConfig.groupName,
      });

      alert('✅ Configuração salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      alert('❌ Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      setTestResult('');

      const currentConfig = groupConfigs[activeSubTab];

      if (!currentConfig.groupId.trim()) {
        setTestResult('❌ Por favor, preencha o ID do grupo antes de testar.');
        return;
      }

      const testMessage = `🧪 *MENSAGEM DE TESTE*\n\n` +
                         `📱 Tipo: ${activeSubTab.toUpperCase()}\n` +
                         `⏰ Data/Hora: ${new Date().toLocaleString('pt-BR')}\n\n` +
                         `✅ Este é um teste de envio para o grupo configurado.\n\n` +
                         `Se você recebeu esta mensagem, a configuração está funcionando corretamente!`;

      const response = await api.post('/whatsapp/test-group', {
        groupId: currentConfig.groupId,
        message: testMessage
      });

      if (response.data.success) {
        setTestResult('✅ Mensagem de teste enviada com sucesso! Verifique o grupo do WhatsApp.');
      } else {
        setTestResult('❌ Erro ao enviar mensagem de teste: ' + (response.data.message || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao testar envio:', error);
      setTestResult('❌ Erro ao enviar mensagem de teste: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsTesting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setGroupConfigs(prev => ({
      ...prev,
      [activeSubTab]: {
        ...prev[activeSubTab],
        [field]: value
      }
    }));
  };

  const handleFetchGroups = async () => {
    try {
      setIsFetchingGroups(true);
      const response = await api.get('/whatsapp/fetch-groups');

      if (response.data.success && response.data.data) {
        setAvailableGroups(response.data.data);
        setShowGroupsModal(true);
      } else {
        alert('❌ Nenhum grupo encontrado ou erro ao buscar grupos.');
      }
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
      alert('❌ Erro ao buscar grupos do WhatsApp: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsFetchingGroups(false);
    }
  };

  const handleSelectGroup = (group) => {
    handleInputChange('groupId', group.id);
    handleInputChange('groupName', group.subject || 'Grupo sem nome');
    setShowGroupsModal(false);
  };

  const currentConfig = groupConfigs[activeSubTab];
  const currentMessage = messageExamples[activeSubTab];

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          <span className="ml-3 text-gray-600">Carregando configurações...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Sub-tabs Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                setTestResult('');
              }}
              className={`px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors ${
                activeSubTab === tab.id
                  ? 'border-b-2 border-orange-600 text-orange-600'
                  : 'text-gray-600 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuração do Grupo */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {subTabs.find(t => t.id === activeSubTab)?.icon} Configuração do Grupo
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID do Grupo WhatsApp
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentConfig.groupId}
                    onChange={(e) => handleInputChange('groupId', e.target.value)}
                    placeholder="120363422563235781@g.us"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleFetchGroups}
                    disabled={isFetchingGroups}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors whitespace-nowrap"
                  >
                    {isFetchingGroups ? '🔄 Carregando...' : '📱 Carregar Grupos'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Formato: 1234567890@g.us (obtenha via API do WhatsApp ou clique em "Carregar Grupos")
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Grupo (Opcional)
                </label>
                <input
                  type="text"
                  value={currentConfig.groupName}
                  onChange={(e) => handleInputChange('groupName', e.target.value)}
                  placeholder="Ex: Prevenção - Rupturas"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Apenas para identificação interna
                </p>
              </div>

              {/* Botões de Ação */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !currentConfig.groupId.trim()}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isSaving ? '💾 Salvando...' : '💾 Salvar Configuração'}
                </button>

                <button
                  onClick={handleTest}
                  disabled={isTesting || !currentConfig.groupId.trim()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isTesting ? '🧪 Testando...' : '🧪 Testar Envio'}
                </button>
              </div>

              {/* Resultado do Teste */}
              {testResult && (
                <div className={`p-4 rounded-lg ${
                  testResult.startsWith('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`text-sm ${
                    testResult.startsWith('✅') ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Preview da Mensagem */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📱 Preview da Mensagem
            </h3>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
                <pre className="text-sm font-mono whitespace-pre-wrap text-gray-800">
                  {currentMessage}
                </pre>
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>ℹ️ Informação:</strong> Esta é a mensagem que será enviada automaticamente
                  quando uma auditoria de {activeSubTab} for finalizada.
                  O PDF do relatório será anexado junto com esta mensagem.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Importante:</h4>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li>O grupo do WhatsApp deve existir e o bot deve ser membro do grupo</li>
            <li>Use o botão "Testar Envio" para verificar se a configuração está correta</li>
            <li>Você pode configurar grupos diferentes para cada tipo de relatório</li>
            <li>As mensagens são enviadas automaticamente ao finalizar auditorias</li>
          </ul>
        </div>
      </div>

      {/* Modal de Seleção de Grupos */}
      {showGroupsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="bg-orange-600 text-white p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">📱 Selecione um Grupo do WhatsApp</h3>
              <button
                onClick={() => setShowGroupsModal(false)}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Lista de Grupos */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {availableGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Nenhum grupo encontrado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableGroups.map((group, index) => (
                    <button
                      key={group.id || index}
                      onClick={() => handleSelectGroup(group)}
                      className="w-full p-4 border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-500 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {group.subject || 'Grupo sem nome'}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1 font-mono">
                            {group.id}
                          </p>
                          {group.size && (
                            <p className="text-xs text-gray-500 mt-1">
                              👥 {group.size} participantes
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          <span className="text-orange-600">→</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowGroupsModal(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
