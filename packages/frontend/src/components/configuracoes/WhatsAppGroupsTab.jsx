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
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [sendNowResult, setSendNowResult] = useState('');

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
      scheduleTime: '08:00'
    },
    quebras: {
      groupId: '',
      groupName: '',
      scheduleTime: '07:00'
    },
    producao: {
      groupId: '',
      groupName: '',
    },
    abastecimento: {
      groupId: '',
      groupName: '',
      scheduleTime: '08:00'
    },
    cortes: {
      groupId: '',
      groupName: '',
      scheduleTime: '07:30'
    },
    atrasos: {
      groupId: '',
      groupName: '',
      scheduleTime: '07:30'
    },
    facial: {
      groupId: '',
      groupName: '',
    },
    prazoFornecedores: {
      groupId: '',
      groupName: '',
      scheduleTime: '08:00'
    }
  });

  const subTabs = [
    { id: 'ruptura', label: '📦 Prevenção Ruptura', icon: '📦' },
    { id: 'etiquetas', label: '🏷️ Prevenção Etiquetas', icon: '🏷️' },
    { id: 'bipagens', label: '🔔 Prevenção Bipagens', icon: '🔔' },
    { id: 'quebras', label: '📊 Prevenção Quebras', icon: '📊' },
    { id: 'abastecimento', label: '📦 Prioridade Abastecimento', icon: '📦' },
    { id: 'cortes', label: '✂️ Prevenção Pedidos', icon: '✂️' },
    { id: 'atrasos', label: '⏰ Pedidos em Atraso', icon: '⏰' },
    { id: 'producao', label: '🥖 Prevenção Produção', icon: '🥖' },
    { id: 'facial', label: '👤 Prevenção Facial', icon: '👤' },
    { id: 'prazoFornecedores', label: '📋 Prazo Fornecedores', icon: '📋' }
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

📄 Confira os detalhes em PDF anexo.`,

    quebras: `📊 *RELATÓRIO DE AJUSTE DE ESTOQUE*

📋 Lote: Lançamento 07/01/2026
📅 Data: 07/01/2026, 21:26:32

📦 Total de Itens: 250
🔴 Saídas: 180 itens (R$ 3.450,00)
🟢 Entradas: 70 itens (R$ 890,00)

*📉 SAÍDAS POR MOTIVO:*
• Perda Padaria: R$ 1.500,00
• Perda Mercearia: R$ 850,00
• Perda Perecíveis: R$ 600,00
• Quebra Transporte: R$ 500,00

*📈 ENTRADAS POR MOTIVO:*
• Devolução Cliente: R$ 450,00
• Ajuste Inventário: R$ 300,00
• Erro Lançamento: R$ 140,00

📄 Confira o relatório detalhado em PDF anexo.`,

    abastecimento: `📦 *PRIORIDADE REPOSIÇÃO - ABASTECIMENTO*

📅 Data NF: 19/02/2026
⏰ Enviado: 20/02/2026, 08:00:00

📦 Total de Itens: 83
🔴 P1 - Curva A: 56 itens
🟠 P2 - Ruptura: 0 itens
🟡 P3 - Pré-Ruptura: 5 itens
⚪ P4 - Demais: 22 itens

📄 Confira o relatório detalhado em PDF anexo.`,

    cortes: `✂️ *RELATÓRIO DE CORTES DE PEDIDOS*

📅 Data Cancelamento: 19/02/2026
⏰ Enviado: 20/02/2026, 07:30:00

🏭 Fornecedores: 8
📦 Itens Cortados: 45
💰 Valor Total: R$ 12.350,00

📄 Confira o relatório detalhado em PDF anexo.`,

    atrasos: `⏰ *RELATÓRIO DE PEDIDOS EM ATRASO*

📅 Data: 20/02/2026
⏰ Enviado: 20/02/2026, 07:30:00

🏭 Fornecedores: 5
📋 Pedidos: 7
📦 Itens Pendentes: 32
💰 Valor Total: R$ 8.450,00

📄 Confira o relatório detalhado em PDF anexo.`,

    producao: `🥖 *RELATÓRIO DE PRODUÇÃO - PADARIA*

📋 Auditoria: 09/01/2026
📅 Data: 09/01/2026, 08:30:00

📦 Total de Produtos: 99
🟢 Com Sugestão: 24 itens
⚪ Sem Necessidade: 75 itens

*📊 PRINCIPAIS SUGESTÕES:*
• PDR BOLO CHOCOLATE KG: 3.767 kg (38 unidades)
• PDR BOLO CENOURA KG: 2.824 kg (28 unidades)
• PDR BOLO BANANA KG: 1.086 kg (11 unidades)
• PDR BOLO PISCINA CHOCOLATE KG: 1.234 kg (12 unidades)

💡 *Sugestões calculadas com base em:*
• Venda média dos últimos 30 dias
• Dias de produção configurados
• Estoque atual informado

📄 Confira o relatório detalhado em PDF anexo.`,

    facial: `🚨 *ALERTA DVR*

📷 Detecção de movimento identificada
📅 Data: 28/01/2026, 14:30:00

Alerta recebido do sistema DVR.
Imagem anexada para verificação.`,

    prazoFornecedores: `📋 *PRAZO FORNECEDORES - FORA DO COMBINADO*

📅 Data: 26/02/2026
⏰ Enviado: 27/02/2026, 08:00:00

⚠️ Fornecedores Fora: 15
📄 Notas Fora do Combinado: 23
💰 Valor Total: R$ 125.430,00

📄 Confira o relatório detalhado em PDF anexo.`
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

        // Função auxiliar para determinar groupId e groupName
        // Se o nome for "Nenhum (Desabilitado)", o ID deve ser vazio também
        const getGroupConfig = (idKey, nameKey) => {
          const name = configs[nameKey] || '';
          const isDisabled = name === 'Nenhum (Desabilitado)';
          return {
            groupId: isDisabled ? '' : (configs[idKey] || ''),
            groupName: name || (configs[idKey] ? 'Grupo Configurado' : '')
          };
        };

        setGroupConfigs({
          ruptura: getGroupConfig('whatsapp_group_ruptura', 'whatsapp_group_ruptura_name'),
          etiquetas: getGroupConfig('whatsapp_group_etiquetas', 'whatsapp_group_etiquetas_name'),
          bipagens: {
            ...getGroupConfig('whatsapp_group_bipagens', 'whatsapp_group_bipagens_name'),
            scheduleTime: configs.whatsapp_bips_schedule_time || '08:00'
          },
          quebras: {
            ...getGroupConfig('whatsapp_group_quebras', 'whatsapp_group_quebras_name'),
            scheduleTime: configs.whatsapp_losses_schedule_time || '07:00'
          },
          abastecimento: {
            ...getGroupConfig('whatsapp_group_abastecimento', 'whatsapp_group_abastecimento_name'),
            scheduleTime: configs.whatsapp_abastecimento_schedule_time || '08:00'
          },
          cortes: {
            ...getGroupConfig('whatsapp_group_cortes', 'whatsapp_group_cortes_name'),
            scheduleTime: configs.whatsapp_cortes_schedule_time || '07:30'
          },
          atrasos: {
            ...getGroupConfig('whatsapp_group_atrasos', 'whatsapp_group_atrasos_name'),
            scheduleTime: configs.whatsapp_atrasos_schedule_time || '07:30'
          },
          producao: getGroupConfig('whatsapp_group_producao', 'whatsapp_group_producao_name'),
          facial: getGroupConfig('email_monitor_whatsapp_group', 'email_monitor_whatsapp_group_name'),
          prazoFornecedores: {
            ...getGroupConfig('whatsapp_group_prazo_fornecedores', 'whatsapp_group_prazo_fornecedores_name'),
            scheduleTime: configs.whatsapp_prazo_fornecedores_schedule_time || '08:00'
          },
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

      // Se o nome é "Nenhum (Desabilitado)", garantir que o ID seja vazio
      const groupIdToSave = currentConfig.groupName === 'Nenhum (Desabilitado)' ? '' : currentConfig.groupId;

      let configData = {};

      // Facial usa chaves especiais (email_monitor_whatsapp_group)
      if (activeSubTab === 'facial') {
        configData = {
          email_monitor_whatsapp_group: groupIdToSave,
          email_monitor_whatsapp_group_name: currentConfig.groupName,
        };
      } else if (activeSubTab === 'prazoFornecedores') {
        configData = {
          whatsapp_group_prazo_fornecedores: groupIdToSave,
          whatsapp_group_prazo_fornecedores_name: currentConfig.groupName,
        };
      } else {
        const configKey = `whatsapp_group_${activeSubTab}`;
        const configNameKey = `whatsapp_group_${activeSubTab}_name`;

        configData = {
          [configKey]: groupIdToSave,
          [configNameKey]: currentConfig.groupName,
        };
      }

      // Se for bipagens, salvar também o horário
      if (activeSubTab === 'bipagens' && currentConfig.scheduleTime) {
        configData.whatsapp_bips_schedule_time = currentConfig.scheduleTime;
      }

      // Se for quebras, salvar também o horário
      if (activeSubTab === 'quebras' && currentConfig.scheduleTime) {
        configData.whatsapp_losses_schedule_time = currentConfig.scheduleTime;
      }

      // Se for abastecimento, salvar também o horário
      if (activeSubTab === 'abastecimento' && currentConfig.scheduleTime) {
        configData.whatsapp_abastecimento_schedule_time = currentConfig.scheduleTime;
      }

      // Se for cortes, salvar também o horário
      if (activeSubTab === 'cortes' && currentConfig.scheduleTime) {
        configData.whatsapp_cortes_schedule_time = currentConfig.scheduleTime;
      }

      // Se for atrasos, salvar também o horário
      if (activeSubTab === 'atrasos' && currentConfig.scheduleTime) {
        configData.whatsapp_atrasos_schedule_time = currentConfig.scheduleTime;
      }

      // Se for prazo fornecedores, salvar também o horário
      if (activeSubTab === 'prazoFornecedores' && currentConfig.scheduleTime) {
        configData.whatsapp_prazo_fornecedores_schedule_time = currentConfig.scheduleTime;
      }

      await api.post('/config/configurations', configData);

      alert('✅ Configuração salva com sucesso!');

      // Recarregar configurações após salvar para confirmar persistência
      await loadConfigurations();
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
    setGroupConfigs(prev => {
      const updatedConfig = {
        ...prev[activeSubTab],
        [field]: value
      };

      // Se estiver mudando o groupName para "Nenhum (Desabilitado)", limpar o groupId também
      if (field === 'groupName' && value === 'Nenhum (Desabilitado)') {
        updatedConfig.groupId = '';
      }

      return {
        ...prev,
        [activeSubTab]: updatedConfig
      };
    });
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

  const handleSelectNone = () => {
    handleInputChange('groupId', '');
    handleInputChange('groupName', 'Nenhum (Desabilitado)');
    setShowGroupsModal(false);
  };

  const handleSendBipsNow = async () => {
    try {
      setIsSendingNow(true);
      setSendNowResult('');

      const response = await api.post('/whatsapp/send-bips-now');

      if (response.data.success) {
        if (response.data.count === 0) {
          setSendNowResult(`ℹ️ ${response.data.message}`);
        } else {
          setSendNowResult(`✅ ${response.data.message}`);
        }
      } else {
        setSendNowResult('❌ Erro ao enviar: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao enviar bipagens:', error);
      setSendNowResult('❌ Erro ao enviar: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSendingNow(false);
    }
  };

  const handleSendLossesNow = async () => {
    try {
      setIsSendingNow(true);
      setSendNowResult('');

      const response = await api.post('/whatsapp/send-losses-now');

      if (response.data.success) {
        if (response.data.count === 0) {
          setSendNowResult(`ℹ️ ${response.data.message}`);
        } else {
          setSendNowResult(`✅ ${response.data.message}`);
        }
      } else {
        setSendNowResult('❌ Erro ao enviar: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao enviar quebras:', error);
      setSendNowResult('❌ Erro ao enviar: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSendingNow(false);
    }
  };

  const handleSendAbastecimentoNow = async () => {
    try {
      setIsSendingNow(true);
      setSendNowResult('');

      const response = await api.post('/whatsapp/send-abastecimento-now');

      if (response.data.success) {
        if (response.data.count === 0) {
          setSendNowResult(`ℹ️ ${response.data.message}`);
        } else {
          setSendNowResult(`✅ ${response.data.message}`);
        }
      } else {
        setSendNowResult('❌ Erro ao enviar: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao enviar abastecimento:', error);
      setSendNowResult('❌ Erro ao enviar: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSendingNow(false);
    }
  };

  const handleSendCortesNow = async () => {
    try {
      setIsSendingNow(true);
      setSendNowResult('');

      const response = await api.post('/whatsapp/send-cortes-now');

      if (response.data.success) {
        if (response.data.count === 0) {
          setSendNowResult(`ℹ️ ${response.data.message}`);
        } else {
          setSendNowResult(`✅ ${response.data.message}`);
        }
      } else {
        setSendNowResult('❌ Erro ao enviar: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao enviar cortes:', error);
      setSendNowResult('❌ Erro ao enviar: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSendingNow(false);
    }
  };

  const handleSendAtrasosNow = async () => {
    try {
      setIsSendingNow(true);
      setSendNowResult('');

      const response = await api.post('/whatsapp/send-atrasos-now');

      if (response.data.success) {
        if (response.data.count === 0) {
          setSendNowResult(`ℹ️ ${response.data.message}`);
        } else {
          setSendNowResult(`✅ ${response.data.message}`);
        }
      } else {
        setSendNowResult('❌ Erro ao enviar: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao enviar atrasos:', error);
      setSendNowResult('❌ Erro ao enviar: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSendingNow(false);
    }
  };

  const handleSendPrazoFornecedoresNow = async () => {
    try {
      setIsSendingNow(true);
      setSendNowResult('');

      const response = await api.post('/whatsapp/send-prazo-fornecedores-now');

      if (response.data.success) {
        if (response.data.count === 0) {
          setSendNowResult(`ℹ️ ${response.data.message}`);
        } else {
          setSendNowResult(`✅ ${response.data.message}`);
        }
      } else {
        setSendNowResult('❌ Erro ao enviar: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao enviar prazo fornecedores:', error);
      setSendNowResult('❌ Erro ao enviar: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSendingNow(false);
    }
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
                    placeholder={currentConfig.groupName === 'Nenhum (Desabilitado)' ? 'Nenhum grupo selecionado' : '120363422563235781@g.us'}
                    className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      !currentConfig.groupId ? 'border-gray-300 bg-gray-50' : 'border-gray-300'
                    }`}
                    disabled={currentConfig.groupName === 'Nenhum (Desabilitado)'}
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

              {/* Campo de Horário - Para Bipagens e Quebras */}
              {(activeSubTab === 'bipagens' || activeSubTab === 'quebras' || activeSubTab === 'abastecimento' || activeSubTab === 'cortes' || activeSubTab === 'atrasos' || activeSubTab === 'prazoFornecedores') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ⏰ Horário de Envio Automático
                  </label>
                  <input
                    type="time"
                    value={currentConfig.scheduleTime || '08:00'}
                    onChange={(e) => handleInputChange('scheduleTime', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    📅 {activeSubTab === 'bipagens'
                      ? 'PDF de bipagens pendentes do dia anterior será enviado automaticamente todos os dias neste horário'
                      : activeSubTab === 'abastecimento'
                      ? 'PDF de prioridade de reposição do dia anterior será enviado automaticamente todos os dias neste horário'
                      : activeSubTab === 'cortes'
                      ? 'PDF de cortes de pedidos do dia anterior será enviado automaticamente todos os dias neste horário'
                      : activeSubTab === 'atrasos'
                      ? 'PDF de pedidos em atraso será enviado automaticamente todos os dias neste horário'
                      : activeSubTab === 'prazoFornecedores'
                      ? 'PDF de fornecedores fora do combinado do dia anterior será enviado automaticamente todos os dias neste horário'
                      : 'PDF de quebras/ajustes do dia anterior será enviado automaticamente todos os dias neste horário'}
                  </p>
                </div>
              )}

              {/* Status do Grupo */}
              {!currentConfig.groupId && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Envio desabilitado:</strong> Nenhum grupo selecionado. Os relatórios de {activeSubTab} não serão enviados automaticamente.
                  </p>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
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

                {activeSubTab === 'bipagens' && (
                  <button
                    onClick={handleSendBipsNow}
                    disabled={isSendingNow || !currentConfig.groupId.trim()}
                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isSendingNow ? '📤 Enviando...' : '📤 Enviar Agora'}
                  </button>
                )}

                {activeSubTab === 'quebras' && (
                  <button
                    onClick={handleSendLossesNow}
                    disabled={isSendingNow || !currentConfig.groupId.trim()}
                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isSendingNow ? '📤 Enviando...' : '📤 Enviar Agora'}
                  </button>
                )}

                {activeSubTab === 'abastecimento' && (
                  <button
                    onClick={handleSendAbastecimentoNow}
                    disabled={isSendingNow || !currentConfig.groupId.trim()}
                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isSendingNow ? '📤 Enviando...' : '📤 Enviar Agora'}
                  </button>
                )}

                {activeSubTab === 'cortes' && (
                  <button
                    onClick={handleSendCortesNow}
                    disabled={isSendingNow || !currentConfig.groupId.trim()}
                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isSendingNow ? '📤 Enviando...' : '📤 Enviar Agora'}
                  </button>
                )}

                {activeSubTab === 'atrasos' && (
                  <button
                    onClick={handleSendAtrasosNow}
                    disabled={isSendingNow || !currentConfig.groupId.trim()}
                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isSendingNow ? '📤 Enviando...' : '📤 Enviar Agora'}
                  </button>
                )}

                {activeSubTab === 'prazoFornecedores' && (
                  <button
                    onClick={handleSendPrazoFornecedoresNow}
                    disabled={isSendingNow || !currentConfig.groupId.trim()}
                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {isSendingNow ? '📤 Enviando...' : '📤 Enviar Agora'}
                  </button>
                )}
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

              {/* Resultado do Envio Manual (Bipagens e Quebras) */}
              {sendNowResult && (activeSubTab === 'bipagens' || activeSubTab === 'quebras' || activeSubTab === 'abastecimento' || activeSubTab === 'cortes' || activeSubTab === 'atrasos' || activeSubTab === 'prazoFornecedores') && (
                <div className={`p-4 rounded-lg ${
                  sendNowResult.startsWith('✅') ? 'bg-green-50 border border-green-200' :
                  sendNowResult.startsWith('ℹ️') ? 'bg-blue-50 border border-blue-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <p className={`text-sm ${
                    sendNowResult.startsWith('✅') ? 'text-green-800' :
                    sendNowResult.startsWith('ℹ️') ? 'text-blue-800' :
                    'text-red-800'
                  }`}>
                    {sendNowResult}
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
                  {activeSubTab === 'bipagens'
                    ? ' todos os dias no horário configurado com as bipagens pendentes do dia anterior.'
                    : activeSubTab === 'quebras'
                    ? ' todos os dias no horário configurado com as quebras/ajustes do dia anterior.'
                    : activeSubTab === 'abastecimento'
                    ? ' todos os dias no horário configurado com a prioridade de reposição (NFs do dia anterior).'
                    : activeSubTab === 'cortes'
                    ? ' todos os dias no horário configurado com os cortes de pedidos do dia anterior.'
                    : activeSubTab === 'atrasos'
                    ? ' todos os dias no horário configurado com os pedidos em atraso.'
                    : activeSubTab === 'prazoFornecedores'
                    ? ' todos os dias no horário configurado com os fornecedores fora do combinado do dia anterior.'
                    : activeSubTab === 'facial'
                    ? ' quando o sistema de DVR detectar movimento ou alerta.'
                    : ` quando uma auditoria de ${activeSubTab} for finalizada.`}
                  {activeSubTab !== 'facial' && ' O PDF do relatório será anexado junto com esta mensagem.'}
                  {activeSubTab === 'facial' && ' A imagem do alerta será anexada.'}
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
            <li><strong>Para desabilitar o envio:</strong> Clique em "Carregar Grupos" e selecione "Nenhum Grupo"</li>
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
              {/* Opção Nenhum Grupo */}
              <div className="mb-4">
                <button
                  onClick={handleSelectNone}
                  className="w-full p-4 border-2 border-dashed border-red-300 rounded-lg hover:bg-red-50 hover:border-red-500 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-red-500 text-xl">🚫</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-red-700">Nenhum Grupo (Desabilitar Envio)</h4>
                      <p className="text-sm text-red-600">Selecione para não enviar mensagens automaticamente</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-2">
                <p className="text-sm text-gray-500 mb-2">Grupos disponíveis:</p>
              </div>

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
