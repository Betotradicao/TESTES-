import { useState, useEffect } from 'react';
import api from '../../utils/api';

/**
 * Configuração completa do Agente IA do WhatsApp.
 * 5 sub-abas: Conexão, Persona, Ferramentas, Notificações, Limites.
 */

const MODELOS = [
  { id: 'gpt-4.1-mini',  nome: 'GPT-4.1 Mini',  desc: '⚡ Mais rápido e barato (recomendado)' },
  { id: 'gpt-4o-mini',   nome: 'GPT-4o Mini',   desc: 'Estável, custo baixo' },
  { id: 'gpt-4.1',       nome: 'GPT-4.1',       desc: 'Mais inteligente, médio custo' },
  { id: 'gpt-5-mini',    nome: 'GPT-5 Mini',    desc: '🧠 Raciocínio profundo (mais lento e caro)' },
];

const TONS = [
  { id: 'profissional', nome: 'Profissional e direto' },
  { id: 'descontraido', nome: 'Descontraído e próximo' },
  { id: 'formal',       nome: 'Formal e técnico' },
];

const DIAS_SEMANA = [
  { id: 'dom', label: 'Dom' },
  { id: 'seg', label: 'Seg' },
  { id: 'ter', label: 'Ter' },
  { id: 'qua', label: 'Qua' },
  { id: 'qui', label: 'Qui' },
  { id: 'sex', label: 'Sex' },
  { id: 'sab', label: 'Sáb' },
];

export default function AgenteIAConfig() {
  const [tab, setTab] = useState('conexao');
  const [config, setConfig] = useState({
    ativo: false,
    group_id: '',
    group_name: '',
    prefixo: '@radar',
    whitelist_numeros: [],
    horario_inicio: '07:00',
    horario_fim: '22:00',
    dias_semana: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
    mensagem_fora_horario: 'Bom dia! Volto às 07:00 👋',
    nome_agente: 'Radar',
    avatar_emoji: '🤖',
    persona_descricao: 'Assistente de gestão do supermercado. Responde sobre vendas, quebras, fornecedores, estoque e RH.',
    tom_comunicacao: 'profissional',
    modelo_ia: 'gpt-4.1-mini',
    max_tokens_resposta: 800,
    temperatura: 0.5,
    instrucoes_extras: '',
    tools_habilitadas: {},
    budget_mensal_brl: 50,
    alertar_em_pct: 80,
    bloquear_em_pct: 100,
    gasto_mes_atual_brl: 0,
    esconder_custo: true,
  });
  const [toolsByCategoria, setToolsByCategoria] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [testInput, setTestInput] = useState('venda hoje');
  const [testOutput, setTestOutput] = useState('');
  const [testing, setTesting] = useState(false);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);

  // Carrega config + lista de tools disponíveis
  useEffect(() => {
    (async () => {
      try {
        const [cfgRes, toolsRes] = await Promise.all([
          api.get('/whatsapp-agente/config'),
          api.get('/whatsapp-agente/tools'),
        ]);
        if (cfgRes.data && Object.keys(cfgRes.data).length) {
          setConfig(c => ({
            ...c,
            ...cfgRes.data,
            tools_habilitadas: cfgRes.data.tools_habilitadas || {},
            dias_semana: cfgRes.data.dias_semana || c.dias_semana,
            whitelist_numeros: cfgRes.data.whitelist_numeros || [],
          }));
        }
        setToolsByCategoria(toolsRes.data?.byCategoria || {});
      } catch (e) {
        console.error('Erro ao carregar agente:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  const salvar = async () => {
    setSaving(true);
    setSavedMsg('');
    try {
      await api.put('/whatsapp-agente/config', config);
      setSavedMsg('✓ Salvo!');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const testar = async () => {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestOutput('');
    try {
      const r = await api.post('/whatsapp-agente/test', { pergunta: testInput });
      setTestOutput(r.data?.resposta || '(sem resposta)');
    } catch (e) {
      setTestOutput('❌ ' + (e.response?.data?.error || e.message));
    } finally {
      setTesting(false);
    }
  };

  const carregarGrupos = async () => {
    setLoadingGroups(true);
    try {
      const r = await api.get('/whatsapp/fetch-groups');
      if (r.data?.success && Array.isArray(r.data.data)) {
        setAvailableGroups(r.data.data);
        setShowGroupsModal(true);
      } else {
        alert('❌ Nenhum grupo encontrado.');
      }
    } catch (e) {
      alert('❌ Erro ao buscar grupos: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoadingGroups(false);
    }
  };

  const selecionarGrupo = (g) => {
    setConfig(c => ({
      ...c,
      group_id: g.id,
      group_name: g.subject || 'Grupo sem nome',
    }));
    setShowGroupsModal(false);
  };

  const configurarWebhook = async () => {
    if (!confirm('Configurar webhook na Evolution apontando pra este servidor?\nIsso fará o bot receber mensagens do WhatsApp.')) return;
    try {
      const r = await api.post('/whatsapp-agente/setup-webhook', {});
      if (r.data?.success) {
        alert(`✅ Webhook configurado!\n\nURL: ${r.data.webhook_url}\nMétodo: ${r.data.method}`);
      } else if (r.data?.instances) {
        alert(`⚠️ Falhou. Instâncias disponíveis:\n${r.data.instances.join(', ')}`);
      } else {
        alert('⚠️ Resposta inesperada: ' + JSON.stringify(r.data));
      }
    } catch (e) {
      alert('❌ Erro: ' + (e.response?.data?.error || e.message)
        + (e.response?.data?.instances ? `\n\nInstâncias: ${e.response.data.instances.join(', ')}` : ''));
    }
  };

  const enviarPing = async () => {
    try {
      await api.post('/whatsapp-agente/send-ping');
      alert('✓ Ping enviado no grupo!');
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    }
  };

  if (loading) return <div className="text-gray-500">Carregando agente...</div>;

  const tabs = [
    { id: 'conexao',       label: '🔌 Conexão' },
    { id: 'persona',       label: '🎭 Persona' },
    { id: 'tools',         label: '🛠️ Ferramentas' },
    { id: 'limites',       label: '💰 Limites' },
    { id: 'teste',         label: '🧪 Testar' },
  ];

  return (
    <div className="space-y-4">
      {/* Status do agente */}
      <div className={`p-4 rounded-lg border ${config.ativo ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.avatar_emoji}</span>
            <div>
              <h3 className="font-bold text-gray-900">{config.nome_agente}</h3>
              <p className="text-xs text-gray-600">{config.ativo ? '🟢 Ativo' : '⚪ Desativado'} · Modelo: {config.modelo_ia}</p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.ativo}
              onChange={(e) => upd('ativo', e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-sm font-medium">Agente Ativo</span>
          </label>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                tab === t.id
                  ? 'border-orange-500 text-orange-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============ CONEXAO ============ */}
      {tab === 'conexao' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">ID do Grupo WhatsApp</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.group_id || ''}
                onChange={(e) => upd('group_id', e.target.value)}
                placeholder="123456789@g.us"
                className="flex-1 border rounded px-3 py-2 text-sm font-mono"
              />
              <button
                type="button"
                onClick={carregarGrupos}
                disabled={loadingGroups}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
              >
                {loadingGroups ? '🔄 Carregando...' : '📱 Carregar Grupos'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Clique em "Carregar Grupos" pra escolher visualmente, ou cole o ID manualmente.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Grupo (interno)</label>
            <input
              type="text"
              value={config.group_name || ''}
              onChange={(e) => upd('group_name', e.target.value)}
              placeholder="Time Estratégico"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Prefixo de chamada</label>
            <input
              type="text"
              value={config.prefixo}
              onChange={(e) => upd('prefixo', e.target.value)}
              placeholder="@radar"
              className="w-full border rounded px-3 py-2 text-sm font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">Ex: <code>@radar</code> ou <code>/radar</code>. Bot só responde mensagens começando com isso.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">⏰ Horário Início</label>
              <input
                type="time"
                value={config.horario_inicio}
                onChange={(e) => upd('horario_inicio', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">⏰ Horário Fim</label>
              <input
                type="time"
                value={config.horario_fim}
                onChange={(e) => upd('horario_fim', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">📅 Dias da semana</label>
            <div className="flex gap-2">
              {DIAS_SEMANA.map(d => {
                const active = (config.dias_semana || []).includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      const atual = config.dias_semana || [];
                      upd('dias_semana', active ? atual.filter(x => x !== d.id) : [...atual, d.id]);
                    }}
                    className={`px-3 py-1.5 text-xs rounded-full border transition ${
                      active ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mensagem fora do horário</label>
            <input
              type="text"
              value={config.mensagem_fora_horario}
              onChange={(e) => upd('mensagem_fora_horario', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">📞 Whitelist de números (opcional)</label>
            <textarea
              value={(config.whitelist_numeros || []).join('\n')}
              onChange={(e) => upd('whitelist_numeros', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
              rows={3}
              placeholder="5512988426869&#10;5511999999999"
              className="w-full border rounded px-3 py-2 text-sm font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">Vazio = qualquer membro do grupo pode perguntar. Preenchido = só esses números.</p>
          </div>
        </div>
      )}

      {/* ============ PERSONA ============ */}
      {tab === 'persona' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do agente</label>
              <input
                type="text"
                value={config.nome_agente}
                onChange={(e) => upd('nome_agente', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Emoji</label>
              <input
                type="text"
                value={config.avatar_emoji}
                onChange={(e) => upd('avatar_emoji', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tom</label>
              <select
                value={config.tom_comunicacao}
                onChange={(e) => upd('tom_comunicacao', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {TONS.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Persona / descrição</label>
            <textarea
              value={config.persona_descricao}
              onChange={(e) => upd('persona_descricao', e.target.value)}
              rows={4}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">Quem ele é, qual experiência, qual abordagem.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Modelo de IA</label>
              <select
                value={config.modelo_ia}
                onChange={(e) => upd('modelo_ia', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {MODELOS.map(m => <option key={m.id} value={m.id}>{m.nome} — {m.desc}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Max tokens</label>
              <input
                type="number"
                value={config.max_tokens_resposta}
                onChange={(e) => upd('max_tokens_resposta', parseInt(e.target.value) || 800)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Instruções extras (regras absolutas)</label>
            <textarea
              value={config.instrucoes_extras}
              onChange={(e) => upd('instrucoes_extras', e.target.value)}
              rows={5}
              className="w-full border rounded px-3 py-2 text-xs font-mono"
              placeholder="Ex: nunca cite valores antes das 9h. Não compartilhe custo de produto. Sempre cumprimente pelo nome."
            />
          </div>
        </div>
      )}

      {/* ============ TOOLS ============ */}
      {tab === 'tools' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Marque as ferramentas que o agente pode usar. Sem marcar = ele só conversa, não acessa dados.
          </p>
          {Object.entries(toolsByCategoria).map(([cat, tools]) => (
            <div key={cat} className="border rounded-lg p-3">
              <h4 className="font-bold text-sm text-gray-800 mb-2">{cat}</h4>
              <div className="space-y-1.5">
                {tools.map(t => (
                  <label key={t.name} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={!!config.tools_habilitadas?.[t.name]}
                      onChange={(e) => upd('tools_habilitadas', { ...config.tools_habilitadas, [t.name]: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="font-mono text-[11px] text-gray-400">{t.name}</span>
                    <span className="text-gray-700">{t.descricao}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ LIMITES ============ */}
      {tab === 'limites' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">💰 Budget mensal (R$)</label>
            <input
              type="number"
              step="0.01"
              value={config.budget_mensal_brl}
              onChange={(e) => upd('budget_mensal_brl', parseFloat(e.target.value) || 0)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">Quanto pode gastar com OpenAI por mês. 0 = sem limite.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">⚠️ Alertar em (%)</label>
              <input
                type="number"
                value={config.alertar_em_pct}
                onChange={(e) => upd('alertar_em_pct', parseInt(e.target.value) || 80)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">🛑 Bloquear em (%)</label>
              <input
                type="number"
                value={config.bloquear_em_pct}
                onChange={(e) => upd('bloquear_em_pct', parseInt(e.target.value) || 100)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            💸 <strong>Gasto este mês:</strong> R$ {Number(config.gasto_mes_atual_brl || 0).toFixed(2)}
            {config.budget_mensal_brl > 0 && (
              <span> de R$ {Number(config.budget_mensal_brl).toFixed(2)} ({((config.gasto_mes_atual_brl / config.budget_mensal_brl) * 100).toFixed(0)}%)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!config.esconder_custo}
              onChange={(e) => upd('esconder_custo', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Esconder valor de custo dos produtos nas respostas (LGPD)</span>
          </div>
        </div>
      )}

      {/* ============ TESTE ============ */}
      {tab === 'teste' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Teste o agente sem precisar mandar mensagem no WhatsApp.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && testar()}
              placeholder="venda hoje / top quedas semana / quebras hoje"
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
            <button onClick={testar} disabled={testing} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50">
              {testing ? 'Testando...' : '🧪 Testar'}
            </button>
          </div>
          {testOutput && (
            <div className="bg-gray-50 border rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">Resposta:</p>
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{testOutput}</pre>
            </div>
          )}
          <div className="border-t pt-3 space-y-2">
            <button onClick={enviarPing} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm w-full">
              📤 Enviar Ping no grupo (apresentação do agente)
            </button>
            <button onClick={configurarWebhook} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm w-full">
              🔗 Configurar Webhook na Evolution (1ª vez)
            </button>
            <p className="text-[11px] text-gray-500">
              ⚠️ Sem o webhook configurado, o bot NÃO recebe mensagens. Clique aqui após salvar.
            </p>
          </div>
        </div>
      )}

      {/* Botão Salvar (fixo no rodapé do componente) */}
      <div className="border-t pt-3 flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-bold text-sm disabled:opacity-50"
        >
          {saving ? 'Salvando...' : '💾 Salvar Configuração'}
        </button>
        {savedMsg && <span className="text-green-600 text-sm font-semibold">{savedMsg}</span>}
      </div>

      {/* Modal de seleção de grupo */}
      {showGroupsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGroupsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">📱 Escolha o grupo do WhatsApp</h3>
              <button onClick={() => setShowGroupsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto p-2">
              {availableGroups.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum grupo encontrado.</p>
              ) : (
                availableGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => selecionarGrupo(g)}
                    className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded border-b border-gray-100 transition"
                  >
                    <div className="font-semibold text-gray-800">{g.subject || '(sem nome)'}</div>
                    <div className="text-xs text-gray-400 font-mono">{g.id}</div>
                    {g.size !== undefined && <div className="text-xs text-gray-500">👥 {g.size} participantes</div>}
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t text-xs text-gray-500 text-center">
              {availableGroups.length} grupos · clique pra selecionar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
