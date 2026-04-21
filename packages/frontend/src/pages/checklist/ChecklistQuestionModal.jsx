import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { AlternativaIcon } from './ChecklistIcons';

const MAX_IMAGENS_REFERENCIA = 20;

export default function ChecklistQuestionModal({ sectionId, question, modelos, setores, onClose, onSaved }) {
  const [abaAtiva, setAbaAtiva] = useState('dados'); // dados | imagens
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { url, titulo }
  const [form, setForm] = useState({
    texto: '',
    tipo: 'conforme',
    criticidade: 'media',
    peso: 1,
    foto_obrigatoria: false,
    modelo_alternativa_id: modelos[0]?.id || null,
    alternativas_config: [],
    imagens_referencia: [],
    setor_id: null,
    hora_inicio: '',
    hora_fim: '',
    dias_semana: [],
    dias_mes_especificos: [],
    primeiro_dia_mes: false,
    ultimo_dia_mes: false,
  });
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  // Grupos WhatsApp disponiveis (para alternativas com generates_alert)
  const [whatsappGroups, setWhatsappGroups] = useState(() => {
    try {
      const cached = sessionStorage.getItem('wa_groups_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState('');

  const carregarGruposWA = async (forceRefresh = false) => {
    if (!forceRefresh && whatsappGroups.length > 0) return;
    setLoadingGroups(true);
    setGroupsError('');
    try {
      const res = await api.get('/whatsapp/fetch-groups');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setWhatsappGroups(res.data.data);
        try { sessionStorage.setItem('wa_groups_cache', JSON.stringify(res.data.data)); } catch {}
      } else {
        setGroupsError(res.data?.error || 'Nao foi possivel carregar os grupos.');
      }
    } catch (e) {
      setGroupsError(e?.response?.data?.error || e.message || 'Erro ao carregar grupos');
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    // Carrega grupos ao abrir o modal, nao-bloqueante.
    carregarGruposWA(false);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (question) {
      setForm({
        texto: question.texto || '',
        tipo: question.tipo || 'conforme',
        criticidade: question.criticidade || 'media',
        peso: Number(question.peso) || 1,
        foto_obrigatoria: !!question.foto_obrigatoria,
        modelo_alternativa_id: question.modelo_alternativa_id || modelos[0]?.id || null,
        alternativas_config: Array.isArray(question.alternativas_config) ? question.alternativas_config : [],
        imagens_referencia: Array.isArray(question.imagens_referencia) ? question.imagens_referencia : [],
        setor_id: question.setor_id || null,
        hora_inicio: question.hora_inicio || '',
        hora_fim: question.hora_fim || '',
        dias_semana: Array.isArray(question.dias_semana) ? question.dias_semana : [],
        dias_mes_especificos: Array.isArray(question.dias_mes_especificos) ? question.dias_mes_especificos : [],
        primeiro_dia_mes: !!question.primeiro_dia_mes,
        ultimo_dia_mes: !!question.ultimo_dia_mes,
      });
    } else if (modelos[0] && !form.modelo_alternativa_id) {
      setForm(f => ({ ...f, modelo_alternativa_id: modelos[0].id }));
    }
    // eslint-disable-next-line
  }, [question, modelos]);

  const modeloAtual = modelos.find(m => m.id === form.modelo_alternativa_id);

  // Garante que alternativas_config tenha uma entrada pra cada alternativa do modelo.
  // Usa setForm funcional pra evitar closure stale do form.alternativas_config.
  useEffect(() => {
    if (!modeloAtual) return;
    setForm(f => {
      const cfgAtual = f.alternativas_config || [];
      const novoCfg = (modeloAtual.alternativas || []).map(alt => {
        const existing = cfgAtual.find(c => c.ordem === alt.ordem);
        return existing || {
          ordem: alt.ordem,
          generates_alert: false,
          requires_photo: false,
          requires_comment: false,
          mostrar_relatorio: true,
          valor_override: null,
          com_lista: false,
          whatsapp_group_id: null,
          whatsapp_group_name: null,
        };
      });
      if (JSON.stringify(novoCfg) === JSON.stringify(cfgAtual)) return f;
      return { ...f, alternativas_config: novoCfg };
    });
    // eslint-disable-next-line
  }, [form.modelo_alternativa_id, modelos]);

  const updateAltConfig = (ordem, campo, valor) => {
    setForm(f => ({
      ...f,
      alternativas_config: f.alternativas_config.map(c =>
        c.ordem === ordem ? { ...c, [campo]: valor } : c
      ),
    }));
  };

  const handleFilePick = () => {
    if (form.imagens_referencia.length >= MAX_IMAGENS_REFERENCIA) {
      setErro(`Máximo de ${MAX_IMAGENS_REFERENCIA} imagens por pergunta atingido.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const espacoLivre = MAX_IMAGENS_REFERENCIA - form.imagens_referencia.length;
    const selecionadas = files.slice(0, espacoLivre);
    if (files.length > espacoLivre) {
      setErro(`Apenas ${espacoLivre} imagem(ns) adicionada(s). Limite de ${MAX_IMAGENS_REFERENCIA}.`);
    }
    setUploading(true);
    try {
      const novas = [];
      for (const file of selecionadas) {
        const fd = new FormData();
        fd.append('imagem', file);
        const res = await api.post('/checklist/upload-imagem', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.url) {
          novas.push({ url: res.data.url, titulo: res.data.titulo || file.name });
        }
      }
      setForm(f => ({ ...f, imagens_referencia: [...f.imagens_referencia, ...novas] }));
      setErro('');
    } catch (err) {
      setErro(err?.response?.data?.error || err.message || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removerImagem = (idx) => {
    setForm(f => ({ ...f, imagens_referencia: f.imagens_referencia.filter((_, i) => i !== idx) }));
  };

  const salvar = async () => {
    if (!form.texto.trim()) { setErro('Texto da pergunta obrigatório'); return; }

    // Valida: toda alternativa de alerta (flag marcada OU icone warning_yellow) precisa ter grupo WhatsApp
    const alternativasList = modeloAtual?.alternativas || [];
    const alertsSemGrupo = (form.alternativas_config || []).filter(c => {
      const alt = alternativasList.find(a => a.ordem === c.ordem);
      const ehAlerta = c.generates_alert || alt?.icone === 'warning_yellow';
      return ehAlerta && !c.whatsapp_group_id;
    });
    if (alertsSemGrupo.length > 0) {
      const ordens = alertsSemGrupo.map(c => c.ordem).join(', ');
      setErro(`Alternativa(s) de alerta (ordem ${ordens}) precisam de um Grupo WhatsApp selecionado.`);
      return;
    }

    setSaving(true);
    try {
      if (question) {
        await api.put(`/checklist/questions/${question.id}`, form);
      } else {
        await api.post(`/checklist/sections/${sectionId}/questions`, form);
      }
      onSaved();
    } catch (e) {
      setErro(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-100 border-b px-5 py-3 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">{question ? 'Editar Pergunta' : 'Nova Pergunta'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl">×</button>
        </div>

        {/* Abas */}
        <div className="flex border-b">
          <button onClick={() => setAbaAtiva('dados')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${abaAtiva === 'dados' ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50' : 'text-gray-600 hover:bg-gray-50'}`}>
            💬 DADOS DA PERGUNTA
          </button>
          <button onClick={() => setAbaAtiva('imagens')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${abaAtiva === 'imagens' ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50' : 'text-gray-600 hover:bg-gray-50'}`}>
            🖼 IMAGENS REFERÊNCIA ({form.imagens_referencia.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {erro && <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}

          {abaAtiva === 'dados' && (
            <>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Pergunta <span className="text-gray-400">(padronizado em maiúsculas)</span></label>
                <textarea value={form.texto} onChange={e => setForm({ ...form, texto: (e.target.value || '').toUpperCase() })}
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="EX: VERIFICAR SE AS CÂMERAS FORAM LIGADAS CORRETAMENTE PELA MANHÃ" />
              </div>

              {/* Horário permitido para preenchimento */}
              <div className="mb-4 border-2 border-amber-200 bg-amber-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⏰</span>
                  <div className="text-sm font-bold text-amber-900">Horário Permitido para Preenchimento da Pergunta</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-amber-800">De</span>
                  <input type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })}
                    className="border-2 border-amber-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-500" />
                  <span className="text-xs text-amber-800">até</span>
                  <input type="time" value={form.hora_fim} onChange={e => setForm({ ...form, hora_fim: e.target.value })}
                    className="border-2 border-amber-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-500" />
                  <button type="button" onClick={() => setForm({ ...form, hora_inicio: '', hora_fim: '' })}
                    className="text-xs text-amber-700 hover:text-amber-900 underline ml-2">limpar</button>
                </div>
                <div className="text-[11px] text-amber-800 mt-2 italic">
                  💡 Após o horário final, a pergunta é preenchida automaticamente como <strong>não feito</strong>. Deixe em branco pra permitir a qualquer hora.
                </div>
              </div>

              {/* Agendamento — Dias da Semana */}
              <div className="mb-4 border-2 border-sky-200 bg-sky-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📅</span>
                  <div className="text-sm font-bold text-sky-900">Dias da Semana</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { n: 1, l: 'Seg' }, { n: 2, l: 'Ter' }, { n: 3, l: 'Qua' },
                    { n: 4, l: 'Qui' }, { n: 5, l: 'Sex' }, { n: 6, l: 'Sáb' }, { n: 0, l: 'Dom' },
                  ].map(d => {
                    const ativo = form.dias_semana.includes(d.n);
                    return (
                      <label key={d.n}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 cursor-pointer text-sm font-medium transition ${ativo ? 'bg-sky-500 text-white border-sky-600' : 'bg-white text-gray-700 border-gray-200 hover:border-sky-400'}`}>
                        <input type="checkbox" checked={ativo} className="hidden"
                          onChange={() => setForm(f => ({
                            ...f,
                            dias_semana: ativo ? f.dias_semana.filter(x => x !== d.n) : [...f.dias_semana, d.n],
                          }))}
                        />
                        {d.l}
                      </label>
                    );
                  })}
                </div>
                <div className="text-[11px] text-sky-800 mt-2 italic">
                  💡 Deixe vazio pra aparecer todos os dias. Selecionados = pergunta só aparece nesses dias.
                </div>
              </div>

              {/* Regras Especiais — Dias do Mês */}
              <div className="mb-4 border-2 border-violet-200 bg-violet-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📆</span>
                  <div className="text-sm font-bold text-violet-900">Regras Especiais — Dias do Mês</div>
                </div>

                <div className="mb-2">
                  <label className="block text-xs font-medium text-violet-800 mb-1">Dias específicos do mês (ex: 5, 10, 20)</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {form.dias_mes_especificos.map((d, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-violet-500 text-white rounded px-2 py-1 text-xs font-semibold">
                        Dia {d}
                        <button type="button" onClick={() => setForm(f => ({ ...f, dias_mes_especificos: f.dias_mes_especificos.filter((_, idx) => idx !== i) }))}
                          className="hover:text-violet-200">×</button>
                      </span>
                    ))}
                    <input type="number" min="1" max="31" placeholder="Dia (1-31)"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const v = parseInt(e.target.value);
                          if (v >= 1 && v <= 31 && !form.dias_mes_especificos.includes(v)) {
                            setForm(f => ({ ...f, dias_mes_especificos: [...f.dias_mes_especificos, v].sort((a, b) => a - b) }));
                            e.target.value = '';
                          }
                        }
                      }}
                      className="border border-violet-300 rounded px-2 py-1 text-sm w-24 focus:outline-none focus:border-violet-500" />
                    <span className="text-[11px] text-violet-700">Enter pra adicionar</span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={form.primeiro_dia_mes}
                    onChange={e => setForm({ ...form, primeiro_dia_mes: e.target.checked })}
                    className="w-4 h-4 accent-violet-500" />
                  <span className="text-sm text-violet-900"><strong>Primeiro dia do mês</strong></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input type="checkbox" checked={form.ultimo_dia_mes}
                    onChange={e => setForm({ ...form, ultimo_dia_mes: e.target.checked })}
                    className="w-4 h-4 accent-violet-500" />
                  <span className="text-sm text-violet-900"><strong>Último dia do mês</strong></span>
                </label>

                <div className="text-[11px] text-violet-800 mt-2 italic">
                  💡 Se qualquer regra especial (dia específico / primeiro / último) estiver marcada, a pergunta só aparece nesses dias — mesmo se fora dos "dias da semana" acima.
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">Modelo de Alternativas</label>
                <select value={form.modelo_alternativa_id || ''}
                  onChange={e => setForm({ ...form, modelo_alternativa_id: parseInt(e.target.value) || null, tipo: 'multipla' })}
                  className="w-full md:w-96 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">— Selecione um modelo —</option>
                  {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  Gerencie modelos em <strong>Cadastros → Modelos de Alternativas</strong>.
                </div>
              </div>

              {/* Tabela de alternativas do modelo */}
              {modeloAtual ? (
                <div className="border rounded overflow-hidden">
                  <div className="grid grid-cols-[100px_1fr_90px_56px_56px_56px] text-xs uppercase bg-gray-100 text-gray-600 border-b">
                    <div className="px-3 py-3 text-left font-semibold">Alternativa</div>
                    <div className="px-3 py-3 text-left font-semibold">Label</div>
                    <div className="px-3 py-3 text-left font-semibold">Peso/Valor</div>
                    <div className="px-2 py-2 flex items-center justify-center" title="Gera alerta / email">
                      <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="px-2 py-2 flex items-center justify-center" title="Foto obrigatória">
                      <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center">
                        <svg className="w-5 h-5 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="px-2 py-2 flex items-center justify-center" title="Comentário obrigatório">
                      <div className="w-8 h-8 rounded-full bg-violet-100 border border-violet-300 flex items-center justify-center">
                        <svg className="w-5 h-5 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {(modeloAtual.alternativas || []).map((a) => {
                    const cfg = (form.alternativas_config || []).find(c => c.ordem === a.ordem) || {};
                    const valorAtual = cfg.valor_override ?? a.valor;
                    return (
                      <div key={a.ordem}>
                        <div className="grid grid-cols-[100px_1fr_90px_56px_56px_56px] items-center border-b">
                          <div className="px-3 py-2">
                            <AlternativaIcon icone={a.icone} size={34} />
                          </div>
                          <div className="px-3 py-2 text-sm text-gray-700 font-medium">{a.label}</div>
                          <div className="px-3 py-1.5">
                            <input type="number" step="0.1" value={valorAtual ?? ''}
                              onChange={e => updateAltConfig(a.ordem, 'valor_override', e.target.value === '' ? null : parseFloat(e.target.value))}
                              className="w-20 border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                              placeholder={String(a.valor)} />
                          </div>
                          <div className="px-2 py-2 flex items-center justify-center">
                            <input type="checkbox" checked={!!cfg.generates_alert}
                              onChange={e => updateAltConfig(a.ordem, 'generates_alert', e.target.checked)}
                              className="w-5 h-5 text-amber-500 rounded accent-amber-500" />
                          </div>
                          <div className="px-2 py-2 flex items-center justify-center">
                            <input type="checkbox" checked={!!cfg.requires_photo}
                              onChange={e => updateAltConfig(a.ordem, 'requires_photo', e.target.checked)}
                              className="w-5 h-5 text-sky-500 rounded accent-sky-500" />
                          </div>
                          <div className="px-2 py-2 flex items-center justify-center">
                            <input type="checkbox" checked={!!cfg.requires_comment}
                              onChange={e => updateAltConfig(a.ordem, 'requires_comment', e.target.checked)}
                              className="w-5 h-5 text-violet-500 rounded accent-violet-500" />
                          </div>
                        </div>
                        <div className="px-3 py-1.5 bg-gray-50 border-b flex gap-4">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input type="checkbox" checked={cfg.mostrar_relatorio !== false}
                              onChange={e => updateAltConfig(a.ordem, 'mostrar_relatorio', e.target.checked)}
                              className="w-3 h-3 text-teal-500" />
                            Mostrar no relatório
                          </label>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input type="checkbox" checked={!!cfg.com_lista}
                              onChange={e => updateAltConfig(a.ordem, 'com_lista', e.target.checked)}
                              className="w-3 h-3 text-teal-500" />
                            Com lista
                          </label>
                        </div>

                        {/* Grupo WhatsApp (aparece pra alternativa de alerta: flag marcada OU icone warning_yellow) */}
                        {(cfg.generates_alert || a.icone === 'warning_yellow') && (
                          <div className="px-3 py-2.5 bg-amber-50 border-b border-amber-200">
                            <div className="mb-2 text-[11px] text-amber-800 bg-amber-100 border border-amber-200 rounded px-2 py-1">
                              🔒 <strong>Regra fixa:</strong> o auditor será obrigado a descrever o que aconteceu ao escolher esta alternativa.
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-amber-600">📣</span>
                              <span className="text-xs font-semibold text-amber-800">
                                Grupo WhatsApp para este alerta <span className="text-red-600">*</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => carregarGruposWA(true)}
                                disabled={loadingGroups}
                                title="Atualizar lista de grupos"
                                className="ml-auto text-[11px] text-amber-700 hover:text-amber-900 font-medium disabled:opacity-50"
                              >
                                {loadingGroups ? 'Carregando…' : '🔄 Atualizar'}
                              </button>
                            </div>
                            <select
                              value={cfg.whatsapp_group_id || ''}
                              onChange={e => {
                                const groupId = e.target.value || null;
                                const group = whatsappGroups.find(g => g.id === groupId);
                                setForm(f => ({
                                  ...f,
                                  alternativas_config: f.alternativas_config.map(c =>
                                    c.ordem === a.ordem
                                      ? { ...c, whatsapp_group_id: groupId, whatsapp_group_name: group?.subject || null }
                                      : c
                                  ),
                                }));
                              }}
                              className="w-full border border-amber-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                              <option value="">— selecione o grupo —</option>
                              {whatsappGroups.map(g => (
                                <option key={g.id} value={g.id}>
                                  {g.subject || 'Sem nome'}{g.size ? ` (${g.size})` : ''}
                                </option>
                              ))}
                            </select>
                            {groupsError && (
                              <div className="mt-1 text-[11px] text-red-600">{groupsError}</div>
                            )}
                            {!loadingGroups && whatsappGroups.length === 0 && !groupsError && (
                              <div className="mt-1 text-[11px] text-amber-700 italic">
                                Nenhum grupo carregado. Clique em "Atualizar" para buscar da Evolution API.
                              </div>
                            )}
                            <p className="mt-1 text-[11px] text-amber-700">
                              Esta resposta dispara uma mensagem para o grupo escolhido com a pergunta, descrição e evidências.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                  Selecione um modelo de alternativas acima. Se não houver nenhum, crie em <strong>Cadastros → Modelos de Alternativas</strong>.
                </div>
              )}

              <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                💡 <strong>Dica:</strong> alternativas com <strong>valor em branco</strong> não impactam a nota final (ex: "Não se aplica").
              </div>
            </>
          )}

          {abaAtiva === 'imagens' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                multiple
                onChange={handleUpload}
                className="hidden"
              />
              <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-gray-600">Fotos que o auditor verá durante a aplicação (ex: padrão correto).</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>{form.imagens_referencia.length}/{MAX_IMAGENS_REFERENCIA}</strong> — formatos: jpg, png, webp, gif (até 10MB)
                  </p>
                </div>
                <button
                  onClick={handleFilePick}
                  disabled={uploading || form.imagens_referencia.length >= MAX_IMAGENS_REFERENCIA}
                  className={`text-sm px-3 py-1.5 rounded font-medium ${uploading || form.imagens_referencia.length >= MAX_IMAGENS_REFERENCIA
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-500 text-white hover:bg-teal-600'}`}
                >
                  {uploading ? 'Enviando…' : '+ Adicionar imagens'}
                </button>
              </div>
              {form.imagens_referencia.length === 0 ? (
                <div className="text-sm text-gray-400 italic py-10 text-center border-2 border-dashed rounded">
                  Nenhuma imagem de referência
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {form.imagens_referencia.map((img, i) => (
                    <div key={i} className="relative group">
                      <button
                        type="button"
                        onClick={() => setLightbox(img)}
                        className="block w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-teal-500 transition shadow-sm"
                        title={img.titulo || ''}
                      >
                        <img src={img.url} alt={img.titulo || ''} className="w-full h-full object-cover" />
                      </button>
                      <button
                        onClick={() => removerImagem(i)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                        title="Remover"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t px-5 py-3 bg-gray-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancelar</button>
          <button onClick={salvar} disabled={saving} className={`px-4 py-2 text-sm rounded font-medium ${saving ? 'bg-gray-300 text-gray-500' : 'bg-teal-500 text-white hover:bg-teal-600'}`}>
            {saving ? 'Salvando…' : (question ? 'Salvar alterações' : 'Criar pergunta')}
          </button>
        </div>
      </div>

      {/* Lightbox — imagem ampliada ao clicar */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-[60] p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.titulo || ''} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            {lightbox.titulo && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-sm p-3 rounded-b-lg">
                {lightbox.titulo}
              </div>
            )}
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-800 rounded-full w-9 h-9 text-lg font-bold shadow-lg hover:bg-gray-100"
            >×</button>
          </div>
        </div>
      )}
    </div>
  );
}
