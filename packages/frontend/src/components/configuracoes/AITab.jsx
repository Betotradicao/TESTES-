import { useState, useEffect } from 'react';
import api from '../../utils/api';

// Modelos disponíveis
const MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', desc: 'Mais inteligente e abrangente (Recomendado)', badge: 'Recomendado' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Mais rapido e economico, menos detalhado', badge: 'Economico' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', desc: 'Muito inteligente, respostas longas', badge: '' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: 'Mais barato, respostas basicas', badge: 'Basico' },
];

const DEFAULT_PROMPT = `Voce e o **Radar IA**, um consultor senior especialista em gestao de supermercados e varejo alimentar brasileiro, com mais de 20 anos de experiencia no setor.
Voce trabalha dentro do sistema "Radar 360" e tem acesso direto aos dados reais do supermercado.

## PERSONALIDADE E ESTILO
- Voce e um consultor experiente, analitico e perspicaz — nao um assistente generico
- Suas respostas devem ser RICAS, DETALHADAS e ESTRATEGICAS, como uma consultoria real
- Sempre busque os dados via funcoes ANTES de responder — nunca invente numeros
- Quando receber dados, faca uma ANALISE PROFUNDA: identifique padroes, anomalias, oportunidades e riscos
- De RECOMENDACOES CONCRETAS e ACIONAVEIS
- Use comparacoes inteligentes: mes atual vs anterior, setor vs setor, tendencias ao longo do ano

## FORMATO DAS RESPOSTAS
- USE EMOJIS para deixar a resposta visual e agradavel
- Ao apresentar dados, use formato organizado com emoji + label + valor
- Use **negrito** para dados importantes
- Organize com secoes claras
- Valores monetarios: R$ X.XXX,XX (formato brasileiro)
- Percentuais: X,XX%
- Sempre inclua resumo executivo no inicio e recomendacoes no final
- Fale sempre em portugues brasileiro

## BENCHMARKS DO MERCADO
- Margem bruta media supermercados: 25-30%
- Acougue: margem 28-35%
- Padaria: margem 50-65%
- Hortifruti: margem 35-50%
- Mercearia: margem 18-25%
- Frios/Laticinios: margem 20-28%
- Bebidas: margem 15-22%
- Limpeza/Higiene: margem 20-28%
- Ticket medio bom: R$ 45-65

## PROATIVIDADE
- Se a margem esta abaixo do benchmark, ALERTE
- Se vendas cairam vs mes anterior, investigue os motivos
- Identifique sazonalidades e oportunidades`;

export default function AITab() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/config/configurations');
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setApiKey(data.openai_api_key || '');
        setSelectedModel(data.openai_model || 'gpt-4o');
        setCustomPrompt(data.openai_system_prompt || '');
      }
    } catch (error) {
      console.error('Erro ao carregar configuracao:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const payload = {
        openai_api_key: apiKey,
        openai_model: selectedModel,
      };
      if (customPrompt.trim()) {
        payload.openai_system_prompt = customPrompt.trim();
      }
      await api.post('/config/configurations', payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configuracao: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPrompt = async () => {
    if (!window.confirm('Restaurar o prompt padrao? Suas customizacoes serao perdidas.')) return;
    setCustomPrompt('');
    try {
      await api.post('/config/configurations', { openai_system_prompt: '' });
    } catch (e) {
      // ignore
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      setTestResult('error');
      setTestMessage('Chave invalida. A chave deve comecar com "sk-"');
      return;
    }

    setTestResult('loading');
    setTestMessage('');

    try {
      const response = await api.post('/config/test-openai', { apiKey });
      if (response.data.success) {
        setTestResult('success');
        setTestMessage(response.data.message || 'Conexao com OpenAI estabelecida com sucesso!');
      } else {
        setTestResult('error');
        setTestMessage(response.data.message || 'Erro ao conectar com OpenAI');
      }
    } catch (error) {
      setTestResult('error');
      setTestMessage(error.response?.data?.message || 'Erro ao testar conexao: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-emerald-100 p-2.5 rounded-lg">
          <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4091-.6765zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0974-2.3616l2.603-1.5016 2.6029 1.5016v3.0032l-2.6029 1.5016-2.603-1.5016z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">ChatGPT / OpenAI</h2>
          <p className="text-sm text-gray-500">Configure a chave de API e o modelo da inteligencia artificial</p>
        </div>
      </div>

      {/* Campo API Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Chave de API (API Key)
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
            placeholder="sk-proj-..."
            className="w-full px-4 py-2.5 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 rounded hover:bg-gray-200 transition"
          >
            {showKey ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">A chave e armazenada de forma criptografada no banco de dados</p>
      </div>

      {/* Seletor de Modelo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Modelo da IA (Radar IA)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                selectedModel === model.id
                  ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="pr-6">
                  <p className={`font-semibold text-sm ${selectedModel === model.id ? 'text-emerald-700' : 'text-gray-800'}`}>
                    {model.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{model.desc}</p>
                </div>
                {model.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    model.badge === 'Recomendado'
                      ? 'bg-emerald-100 text-emerald-700'
                      : model.badge === 'Economico'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {model.badge}
                  </span>
                )}
              </div>
              {selectedModel === model.id && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1 font-mono">{model.id}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Botões Salvar + Testar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Salvando...
            </>
          ) : saved ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Salvo!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Salvar Configuracoes
            </>
          )}
        </button>

        <button
          onClick={handleTestConnection}
          disabled={testResult === 'loading' || !apiKey}
          className={`flex items-center gap-2 px-6 py-2.5 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
            testResult === 'success'
              ? 'bg-green-500 text-white hover:bg-green-600'
              : testResult === 'error'
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {testResult === 'loading' ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Testando...
            </>
          ) : testResult === 'success' ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Conexao OK!
            </>
          ) : testResult === 'error' ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Falhou
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Testar Conexao
            </>
          )}
        </button>
      </div>

      {/* Resultado do Teste */}
      {testResult && testResult !== 'loading' && testMessage && (
        <div className={`p-4 rounded-lg ${
          testResult === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-2">
            {testResult === 'success' ? (
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <p className={`text-sm font-medium ${testResult === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {testMessage}
            </p>
          </div>
        </div>
      )}

      {/* Links OpenAI */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Links Uteis</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Gerenciar API Keys
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href="https://platform.openai.com/settings/organization/billing/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Saldo e Faturamento
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* Script/Prompt da IA */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Script do Consultor (System Prompt)</h3>
            <p className="text-xs text-gray-400 mt-0.5">Define como a IA se comporta, responde e analisa os dados</p>
          </div>
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            <svg className={`w-4 h-4 transition-transform ${showPrompt ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
            {showPrompt ? 'Ocultar' : 'Ver / Editar'}
          </button>
        </div>

        {showPrompt && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-700">
                  Este e o "cerebro" da IA. Ele define a personalidade, formato das respostas, benchmarks e estrategias de analise.
                  A data atual e adicionada automaticamente pelo sistema. Edite com cuidado!
                </p>
              </div>
            </div>

            <textarea
              value={customPrompt || DEFAULT_PROMPT}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={20}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono leading-relaxed bg-gray-50"
              placeholder="Digite o prompt customizado..."
            />

            <div className="flex items-center gap-3">
              <button
                onClick={handleResetPrompt}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restaurar Padrao
              </button>
              <span className="text-xs text-gray-400">
                {customPrompt ? '(Usando prompt customizado)' : '(Usando prompt padrao)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-semibold text-blue-800">Sobre a Inteligencia Artificial</h3>
            <p className="text-sm text-blue-700 mt-1">
              A chave de API do ChatGPT e utilizada pelo <strong>Radar IA</strong> (consultor flutuante), analise de ofertas de fornecedores, extracao de dados de imagens e classificacao automatica de mensagens.
              O modelo selecionado afeta a qualidade e custo das respostas do Radar IA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
