import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function EmailMonitorTab() {
  const [activeSubTab, setActiveSubTab] = useState('gmail');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [groups, setGroups] = useState([]);
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState({
    email: '',
    app_password: '',
    subject_filter: 'DVR',
    check_interval_seconds: 30,
    whatsapp_group_id: '',
    enabled: false
  });

  useEffect(() => {
    fetchConfig();
    fetchGroups();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'logs') {
      fetchLogs();
    }
  }, [activeSubTab]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/email-monitor/config');
      setConfig(response.data);
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      showMessage('error', 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      // Buscar grupos do WhatsApp via Evolution API
      const response = await api.get('/email-monitor/whatsapp-groups');
      const fetchedGroups = response.data.groups || [];
      setGroups(fetchedGroups);
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
      showMessage('error', 'Erro ao carregar grupos do WhatsApp. Verifique se a Evolution API está configurada.');
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await api.get('/email-monitor/logs?limit=50');
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      showMessage('error', 'Erro ao carregar logs');
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      await api.put('/email-monitor/config', config);

      showMessage('success', 'Configurações salvas com sucesso!');
      await fetchConfig();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showMessage('error', error.response?.data?.error || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setMessage({ type: '', text: '' });

      const response = await api.post('/email-monitor/test');

      if (response.data.success) {
        showMessage('success', response.data.message);
      } else {
        showMessage('error', response.data.error || 'Falha no teste');
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      showMessage('error', error.response?.data?.error || 'Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const handleRefreshLogs = async () => {
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      showMessage('success', 'Buscando últimos 20 emails do Gmail...');

      // Buscar e processar os últimos 20 emails do Gmail
      const response = await api.post('/email-monitor/fetch-latest', { limit: 20 });

      if (response.data.success) {
        showMessage('success', `${response.data.processed} emails processados! Atualizando logs...`);

        // Aguardar 2 segundos antes de atualizar logs
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Atualizar a lista de logs
        await fetchLogs();

        showMessage('success', 'Logs atualizados com sucesso!');
      } else {
        showMessage('error', response.data.error || 'Erro ao buscar emails');
      }
    } catch (error) {
      console.error('Erro ao atualizar logs:', error);
      showMessage('error', error.response?.data?.error || 'Erro ao atualizar logs');
    } finally {
      setLoading(false);
    }
  };

  const handleReprocessLast = async () => {
    try {
      setMessage({ type: '', text: '' });
      const response = await api.post('/email-monitor/reprocess-last');

      if (response.data.success) {
        showMessage('success', response.data.message);
      } else {
        showMessage('error', response.data.error || 'Erro ao reprocessar email');
      }

      // Recarregar logs após 3 segundos
      setTimeout(() => {
        if (activeSubTab === 'logs') {
          fetchLogs();
        }
      }, 3000);
    } catch (error) {
      console.error('Erro ao reprocessar email:', error);
      showMessage('error', error.response?.data?.error || 'Erro ao reprocessar último email');
    }
  };

  const renderMonitorDVRTab = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 mb-4">
        Configure e monitore automaticamente o bug do DVR Intelbras que corrompe a senha do email
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Monitor Automático DVR Intelbras</h3>
            <p className="text-sm text-blue-800 mb-3">
              O Monitor DVR verifica e corrige automaticamente o bug do DVR Intelbras que corrompe a senha do email.
            </p>
            <a
              href="/monitorar-email-dvr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              Abrir Tela Completa do Monitor DVR
            </a>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg shadow-sm p-6 border border-orange-200">
        <h3 className="text-lg font-bold mb-3 text-orange-900 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          Sobre o Bug do DVR
        </h3>

        <div className="space-y-3 text-sm text-gray-700">
          <p>
            <strong className="text-orange-900">Problema:</strong> O DVR Intelbras tem um bug onde, ao salvar uma senha curta (exemplo: 4 caracteres),
            ele adiciona automaticamente 16 caracteres "fantasmas" do buffer de memória, totalizando 20 caracteres.
            Isso faz com que a autenticação SMTP falhe.
          </p>

          <p><strong className="text-orange-900">Solução Automática:</strong> Este monitor verifica periodicamente se a senha está correta. Quando detecta o bug, ele automaticamente:</p>

          <ol className="list-decimal list-inside space-y-1 ml-4 text-gray-600">
            <li>Limpa a senha corrompida</li>
            <li>Aguarda 2 segundos (limpar buffer de memória)</li>
            <li>Aplica a senha correta salva no sistema</li>
            <li>Reinicia o serviço de email do DVR</li>
          </ol>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
            <p className="text-green-800 font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Com este monitor ativo, você nunca mais vai precisar corrigir manualmente a senha do email!
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSubTabButtons = () => (
    <div className="border-b border-gray-200 mb-6">
      <nav className="flex space-x-8">
        {[
          { id: 'gmail', label: 'Gmail', icon: '📧' },
          { id: 'filters', label: 'Filtros', icon: '🔍' },
          { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
          { id: 'logs', label: 'Logs', icon: '📊' },
          { id: 'monitor-dvr', label: 'Monitor DVR', icon: '🔧' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${
              activeSubTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );

  const renderGmailTab = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Gmail
        </label>
        <input
          type="email"
          value={config.email}
          onChange={(e) => setConfig({ ...config, email: e.target.value })}
          placeholder="seuemail@gmail.com"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">
          Conta Gmail que receberá os alertas do DVR
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Senha de App (App Password)
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={config.app_password}
            onChange={(e) => setConfig({ ...config, app_password: e.target.value })}
            placeholder="16 caracteres (sem espaços)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
          />
          <button
            type="button"
            onClick={() => {
              console.log('Toggle password visibility - Current:', showPassword);
              setShowPassword(!showPassword);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            )}
          </button>
        </div>
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800 font-medium mb-2">Como gerar Senha de App:</p>
          <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
            <li>Acesse <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">myaccount.google.com/apppasswords</a></li>
            <li>Digite o nome do app (ex: "Monitor DVR")</li>
            <li>Copie a senha de 16 caracteres gerada</li>
            <li>Cole aqui sem espaços</li>
          </ol>
          <p className="text-xs text-yellow-700 mt-2 font-medium">✅ Vantagem: Nunca expira!</p>
        </div>
      </div>

      {/* Indicador de Status da Configuração */}
      {config.email && config.app_password && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900">Gmail Configurado</p>
              <p className="text-xs text-blue-700 mt-1">Email: {config.email}</p>
              <p className="text-xs text-blue-700">Use o botão "Testar Conexão" para verificar se está funcionando</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleTest}
          disabled={testing || !config.email || !config.app_password}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
        >
          {testing ? 'Testando...' : '🔌 Testar Conexão'}
        </button>

        <button
          onClick={handleSave}
          disabled={saving || !config.email || !config.app_password}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );

  const renderFiltersTab = () => (
    <div className="space-y-6">
      {/* Card de Status do Monitoramento */}
      <div className={`p-4 rounded-lg border-2 ${config.enabled ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-300'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${config.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <div>
              <h4 className="font-semibold text-gray-900">
                {config.enabled ? '✅ Monitoramento ATIVO' : '⏸️ Monitoramento INATIVO'}
              </h4>
              <p className="text-xs text-gray-600 mt-1">
                {config.enabled ? 'Sistema verificando emails a cada 1 minuto' : 'Ative o monitoramento abaixo para começar'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filtro de Assunto
        </label>
        <input
          type="text"
          value={config.subject_filter}
          onChange={(e) => setConfig({ ...config, subject_filter: e.target.value })}
          placeholder="Ex: DVR, Alerta, Câmera"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">
          Apenas emails com este texto no assunto serão processados
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Intervalo de Verificação
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="10"
            max="300"
            value={config.check_interval_seconds}
            onChange={(e) => setConfig({ ...config, check_interval_seconds: parseInt(e.target.value) })}
            className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-sm text-gray-600">segundos</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          De quanto em quanto tempo verificar novos emails (padrão: 30 segundos)
        </p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Como funciona:</h4>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>O sistema verifica emails não lidos a cada {config.check_interval_seconds} segundos</li>
          <li>Procura emails com "{config.subject_filter}" no assunto</li>
          <li>Extrai o texto e imagem do PDF anexado</li>
          <li>Envia automaticamente para o grupo WhatsApp configurado</li>
          <li>Marca o email como lido para não processar novamente</li>
        </ul>
      </div>

      <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <input
          type="checkbox"
          id="enabled"
          checked={config.enabled}
          onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
        <label htmlFor="enabled" className="text-sm font-medium text-gray-900">
          Habilitar monitoramento automático
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );

  const renderWhatsAppTab = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Grupo WhatsApp de Destino
        </label>
        <select
          value={config.whatsapp_group_id}
          onChange={(e) => setConfig({ ...config, whatsapp_group_id: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Selecione um grupo</option>
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              {group.name} ({group.id})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Grupo onde serão enviados os alertas do DVR
        </p>
      </div>

      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Formato da mensagem:</h4>
        <div className="mt-2 p-3 bg-white border border-gray-300 rounded text-xs font-mono">
          🚨 Alerta DVR<br/><br/>
          [Texto do email]<br/><br/>
          [Imagem do PDF anexado]
        </div>
      </div>

      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          <strong>Nota:</strong> Certifique-se de que o grupo está configurado nas Configurações de APIs
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !config.whatsapp_group_id}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );

  const renderLogsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Histórico de Emails Processados</h3>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshLogs}
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? '🔄 Atualizando...' : '🔄 Atualizar'}
          </button>
          <button
<<<<<<< HEAD
            onClick={handleReprocessLast}
            disabled={loading}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            🔁 Reenviar Último
=======
            onClick={handleManualCheck}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            ✉️ Verificar Agora
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <p className="text-gray-500">Nenhum email processado ainda</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assunto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remetente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anexo</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(log.processed_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {log.email_subject}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.sender}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      log.status === 'success'
                        ? 'bg-green-100 text-green-800'
                        : log.status === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {log.status === 'success' ? '✅ Sucesso' : log.status === 'error' ? '❌ Erro' : '⏭️ Ignorado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.has_attachment ? '📎 Sim' : '❌ Não'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Monitor de Emails (DVR)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure o monitoramento automático de emails do DVR e envio para WhatsApp
        </p>
      </div>

      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex">
            <svg
              className={`w-5 h-5 mr-2 ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              {message.type === 'success' ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              )}
            </svg>
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {renderSubTabButtons()}

      {activeSubTab === 'gmail' && renderGmailTab()}
      {activeSubTab === 'filters' && renderFiltersTab()}
      {activeSubTab === 'whatsapp' && renderWhatsAppTab()}
      {activeSubTab === 'logs' && renderLogsTab()}
      {activeSubTab === 'monitor-dvr' && renderMonitorDVRTab()}
    </div>
  );
}
