import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLoja } from '../../contexts/LojaContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import { AlternativaIcon } from './ChecklistIcons';
import CameraCapture from './CameraCapture';
import SignaturePad from './SignaturePad';

/**
 * Fluxo:
 *   1. selecionar auditor
 *   2. escolher template disponivel
 *   3. iniciar inspecao (opc: auditado)
 *   4. responder perguntas (por secao, pergunta a pergunta)
 *   5. finalizar com observacao
 *
 * Mobile-first, identidade visual teal.
 */
export default function ChecklistAuditar() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Stage state — fluxo: template → auditor → iniciar → executar → finalizar → fim
  const [stage, setStage] = useState('template');
  const [erro, setErro] = useState('');

  // Stage: auditor
  const [auditores, setAuditores] = useState([]);
  const [auditorId, setAuditorId] = useState('');
  const [auditorSelecionado, setAuditorSelecionado] = useState(null);

  // Stage: templates
  const [templates, setTemplates] = useState([]);

  // Stage: iniciar
  const [auditados, setAuditados] = useState([]);
  const [auditadoId, setAuditadoId] = useState('');
  const [codLoja, setCodLoja] = useState('');
  const [templateSelecionado, setTemplateSelecionado] = useState(null);

  // Stage: executar
  const [inspection, setInspection] = useState(null);
  const [modelos, setModelos] = useState([]);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [respostas, setRespostas] = useState({}); // questionId -> { conforme, valor_opcao, fotos, observacao, ordemAlt }

  // Stage: finalizar
  const [observacaoGeral, setObservacaoGeral] = useState('');
  const [assinaturaAuditor, setAssinaturaAuditor] = useState(null); // dataURL
  const [finalizando, setFinalizando] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState(null);

  // Envio automatico do PDF (se template tiver grupo configurado o backend envia assincrono)
  // Aqui mantemos estado apenas para exibir aviso no stage fim.

  // Lightbox
  const [lightbox, setLightbox] = useState(null);

  // Camera capture: { questionId } ou null
  const [cameraPara, setCameraPara] = useState(null);

  // Carrega modelos e templates disponíveis (filtrados por loja)
  useEffect(() => {
    (async () => {
      try {
        const qs = lojaSelecionada != null ? `?cod_loja=${lojaSelecionada}` : '';
        const [m, t] = await Promise.all([
          api.get('/checklist/modelos'),
          api.get(`/checklist/templates${qs}`),
        ]);
        setModelos(m.data?.modelos || []);
        setTemplates((t.data?.templates || []).filter(tpl => tpl.ativo !== false));
      } catch (e) { setErro(e?.response?.data?.error || e.message); }
    })();
    // eslint-disable-next-line
  }, [lojaSelecionada]);

  // Escolher template (stage 1) → carrega auditores permitidos pra ele
  const escolherTemplate = async (t) => {
    setTemplateSelecionado(t);
    try {
      const qs = lojaSelecionada != null ? `?cod_loja=${lojaSelecionada}` : '';
      const res = await api.get(`/checklist/auditores${qs}`);
      let lista = res.data?.auditores || [];
      // Filtrar pelos grupos_acesso do template (se definido)
      const permitidos = Array.isArray(t.grupos_acesso) ? t.grupos_acesso : [];
      if (permitidos.length > 0) {
        lista = lista.filter(a => permitidos.includes(a.id));
      }
      setAuditores(lista);
      setAuditorId('');
      setAuditorSelecionado(null);
      setStage('auditor');
      setErro('');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  // Confirmar auditor (stage 2) → carrega auditados permitidos pelo template
  const confirmarAuditor = async () => {
    if (!auditorId) { setErro('Selecione um auditor'); return; }
    const aud = auditores.find(x => x.id === auditorId);
    setAuditorSelecionado(aud);
    try {
      const qs = lojaSelecionada != null ? `?cod_loja=${lojaSelecionada}` : '';
      const res = await api.get(`/checklist/auditados${qs}`);
      let lista = res.data?.auditados || [];
      const permitidos = Array.isArray(templateSelecionado?.grupos_acesso_auditados)
        ? templateSelecionado.grupos_acesso_auditados : [];
      if (permitidos.length > 0) {
        lista = lista.filter(a => permitidos.includes(a.id));
      }
      setAuditados(lista);
      setCodLoja(
        lojaSelecionada != null
          ? String(lojaSelecionada)
          : (aud?.cod_loja ? String(aud.cod_loja) : '')
      );
      setStage('iniciar');
      setErro('');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const voltarTemplate = () => {
    setStage('template');
    setAuditorId('');
    setAuditorSelecionado(null);
    setTemplateSelecionado(null);
  };

  const voltarAuditor = () => {
    setStage('auditor');
  };

  // Dado o dia de hoje, retorna true se a pergunta deve aparecer
  const perguntaAplicaHoje = (q) => {
    const agora = new Date();
    const diaSemana = agora.getDay(); // 0=Dom, 1=Seg, ..., 6=Sab
    const diaMes = agora.getDate();
    const ultimoDiaDoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const ehUltimoDia = diaMes === ultimoDiaDoMes;
    const ehPrimeiroDia = diaMes === 1;

    const ds = Array.isArray(q.dias_semana) ? q.dias_semana : [];
    const dm = Array.isArray(q.dias_mes_especificos) ? q.dias_mes_especificos : [];
    const pdm = !!q.primeiro_dia_mes;
    const udm = !!q.ultimo_dia_mes;

    // Tem regra especial de dia-do-mes?
    const temRegraMes = dm.length > 0 || pdm || udm;
    if (temRegraMes) {
      if (dm.includes(diaMes)) return true;
      if (pdm && ehPrimeiroDia) return true;
      if (udm && ehUltimoDia) return true;
      // So aplica outras regras de semana SE houver
      if (ds.length > 0) return ds.includes(diaSemana);
      return false;
    }
    // Sem regra especial → verifica dias da semana (se tiver)
    if (ds.length > 0) return ds.includes(diaSemana);
    // Sem nenhuma regra → aparece sempre
    return true;
  };

  const iniciarInspection = async () => {
    try {
      // Pega GPS (opcional, nao obrigatorio)
      let gps = { lat: null, lng: null };
      if (navigator.geolocation) {
        await new Promise(resolve => {
          navigator.geolocation.getCurrentPosition(
            pos => { gps = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(); },
            () => resolve(),
            { timeout: 3000 }
          );
        });
      }
      const res = await api.post('/checklist/inspections', {
        template_id: templateSelecionado.id,
        auditor_id: auditorId,
        auditado_id: auditadoId || null,
        cod_loja: codLoja ? parseInt(codLoja) : null,
        gps_inicio_lat: gps.lat,
        gps_inicio_lng: gps.lng,
      });
      // Carrega template full pra pegar secoes + perguntas
      const tpl = await api.get(`/checklist/templates/${templateSelecionado.id}`);
      setInspection({ ...res.data.inspection, template: tpl.data.template });
      setSectionIdx(0);
      setRespostas({});
      setStage('executar');
      setErro('');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const currentSection = useMemo(() => {
    if (!inspection?.template?.sections) return null;
    return inspection.template.sections[sectionIdx] || null;
  }, [inspection, sectionIdx]);

  const totalSecoes = inspection?.template?.sections?.length || 0;

  const perguntasRespondidas = useMemo(() => {
    if (!inspection?.template?.sections) return 0;
    let total = 0;
    for (const s of inspection.template.sections) {
      for (const q of s.questions || []) {
        if (respostas[q.id]?.ordemAlt !== undefined) total += 1;
      }
    }
    return total;
  }, [inspection, respostas]);

  const totalPerguntas = useMemo(() => {
    if (!inspection?.template?.sections) return 0;
    let total = 0;
    for (const s of inspection.template.sections) {
      total += (s.questions || []).filter(perguntaAplicaHoje).length;
    }
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspection]);

  // Contadores por tipo de resposta
  const stats = useMemo(() => {
    let conformes = 0, naoConformes = 0, na = 0, alertas = 0;
    for (const id in respostas) {
      const r = respostas[id];
      const v = r.score ?? 0;
      if (v > 0) conformes++;
      else if (v < 0) naoConformes++;
      else if (r.conforme === 'NA') na++;
      else alertas++;
    }
    const pendentes = totalPerguntas - conformes - naoConformes - na - alertas;
    return { conformes, naoConformes, na, alertas, pendentes };
  }, [respostas, totalPerguntas]);

  const responder = async (question, alternativa) => {
    const modelo = modelos.find(m => m.id === question.modelo_alternativa_id);
    const cfg = (question.alternativas_config || []).find(c => c.ordem === alternativa.ordem) || {};
    const valor = cfg.valor_override ?? alternativa.valor;
    const conforme = valor > 0 ? 'C' : valor < 0 ? 'NC' : 'NA';
    const atual = respostas[question.id] || { fotos: [] };
    // Preserva respondida_em original se alternativa nao mudou; atualiza quando muda
    const mudou = atual.ordemAlt !== alternativa.ordem;
    const respondida_em = mudou ? new Date().toISOString() : (atual.respondida_em || new Date().toISOString());
    const nova = {
      ...atual,
      ordemAlt: alternativa.ordem,
      conforme,
      valor_opcao: alternativa.label || String(alternativa.ordem),
      score: valor,
      requires_photo: !!cfg.requires_photo,
      requires_comment: !!cfg.requires_comment,
      respondida_em,
    };
    setRespostas(r => ({ ...r, [question.id]: nova }));
    try {
      await api.post(`/checklist/inspections/${inspection.id}/responses`, {
        question_id: question.id,
        conforme,
        valor_opcao: nova.valor_opcao,
        fotos: nova.fotos || [],
        observacao: nova.observacao || null,
        respondida_em,
      });
    } catch (e) {
      console.error('erro salvar resposta', e);
    }
  };

  const atualizarObservacao = (questionId, obs) => {
    setRespostas(r => ({ ...r, [questionId]: { ...(r[questionId] || {}), observacao: obs } }));
  };

  const uploadFoto = async (questionId, file) => {
    if (!file) return;
    try {
      const fd = new FormData();
      const filename = file.name || `evidencia_${Date.now()}.jpg`;
      fd.append('imagem', file, filename);
      const res = await api.post('/checklist/upload-imagem', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRespostas(r => {
        const atual = r[questionId] || { fotos: [] };
        const novaFoto = { url: res.data.url, titulo: filename, captured_at: new Date().toISOString() };
        return { ...r, [questionId]: { ...atual, fotos: [...(atual.fotos || []), novaFoto] } };
      });
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const handleCameraCapture = async (blob) => {
    const qId = cameraPara?.questionId;
    setCameraPara(null);
    if (!qId || !blob) return;
    const file = new File([blob], `evidencia_${Date.now()}.jpg`, { type: 'image/jpeg' });
    await uploadFoto(qId, file);
  };

  const removerFoto = (questionId, idx) => {
    if (!confirm('Remover esta foto de evidência?')) return;
    setRespostas(r => {
      const atual = r[questionId] || { fotos: [] };
      const novasFotos = (atual.fotos || []).filter((_, i) => i !== idx);
      return { ...r, [questionId]: { ...atual, fotos: novasFotos } };
    });
  };

  const proximaSecao = () => {
    if (sectionIdx < totalSecoes - 1) setSectionIdx(sectionIdx + 1);
    else setStage('finalizar');
  };
  const secaoAnterior = () => {
    if (sectionIdx > 0) setSectionIdx(sectionIdx - 1);
  };

  // Valida se todas as evidencias obrigatorias foram preenchidas
  const validarEvidencias = () => {
    const faltando = [];
    const sections = inspection?.template?.sections || [];
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const s = sections[sIdx];
      for (let qIdx = 0; qIdx < (s.questions || []).length; qIdx++) {
        const q = s.questions[qIdx];
        const resp = respostas[q.id];
        if (!resp || resp.ordemAlt === undefined) continue; // nao respondida, ja tem sua propria mensagem
        const faltaFoto = (resp.requires_photo || q.foto_obrigatoria) && (resp.fotos || []).length === 0;
        const faltaComentario = resp.requires_comment && !(resp.observacao || '').trim();
        if (faltaFoto || faltaComentario) {
          faltando.push({
            secao: s.nome,
            secaoIdx: sIdx,
            pergunta: q.texto,
            perguntaN: qIdx + 1,
            falta: [faltaFoto && 'foto', faltaComentario && 'comentário'].filter(Boolean).join(' e '),
          });
        }
      }
    }
    return faltando;
  };

  const finalizar = async () => {
    // Auto-preenche como "nao feito" (NC) perguntas fora do horario que nao foram respondidas
    const agoraHHMM = new Date().toTimeString().slice(0, 5);
    const sections = inspection?.template?.sections || [];
    for (const s of sections) {
      for (const q of s.questions || []) {
        const jaResp = respostas[q.id]?.ordemAlt !== undefined;
        if (jaResp) continue;
        if (q.hora_fim && agoraHHMM > q.hora_fim) {
          try {
            await api.post(`/checklist/inspections/${inspection.id}/responses`, {
              question_id: q.id,
              conforme: 'NC',
              valor_opcao: 'Nao feito (fora do horario)',
              observacao: `Auto-preenchido: fora do horario permitido (ate ${q.hora_fim})`,
              respondida_em: new Date().toISOString(),
            });
            setRespostas(r => ({ ...r, [q.id]: {
              ordemAlt: -1,
              conforme: 'NC',
              valor_opcao: 'Nao feito (fora do horario)',
              score: -1,
              respondida_em: new Date().toISOString(),
              autoPreenchida: true,
            }}));
          } catch (e) { /* ignora falhas individuais */ }
        }
      }
    }
    const faltando = validarEvidencias();
    if (faltando.length > 0) {
      const f = faltando[0];
      const msg = `Evidências obrigatórias faltando em ${faltando.length} pergunta(s).\n\nExemplo: Seção "${f.secao}" → Pergunta ${f.perguntaN}: "${f.pergunta.substring(0, 80)}${f.pergunta.length > 80 ? '…' : ''}" (${f.falta}).\n\nPreencha antes de finalizar.`;
      alert(msg);
      // Volta pra secao da primeira pendencia
      setSectionIdx(f.secaoIdx);
      setStage('executar');
      return;
    }
    if (!assinaturaAuditor) {
      alert('Assinatura do auditor é obrigatória para finalizar a auditoria.');
      return;
    }
    setFinalizando(true);
    try {
      // Upload assinatura obrigatoria pro MinIO antes de finalizar
      let assinaturaUrl = null;
      try {
        const blob = await (await fetch(assinaturaAuditor)).blob();
        const fd = new FormData();
        fd.append('imagem', blob, `assinatura_auditor_${inspection.id}.png`);
        const up = await api.post('/checklist/upload-imagem', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        assinaturaUrl = up.data?.url || null;
      } catch (upErr) {
        setFinalizando(false);
        alert('Nao foi possivel salvar a assinatura. Tente novamente.');
        return;
      }
      const res = await api.post(`/checklist/inspections/${inspection.id}/finalizar`, {
        observacao_geral: observacaoGeral,
        assinatura_auditor_url: assinaturaUrl,
      });
      setResultadoFinal(res.data.inspection);
      setStage('fim');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
    finally { setFinalizando(false); }
  };

  const resetar = () => {
    setStage('template');
    setAuditorId('');
    setAuditorSelecionado(null);
    setTemplateSelecionado(null);
    setInspection(null);
    setRespostas({});
    setSectionIdx(0);
    setObservacaoGeral('');
    setAssinaturaAuditor(null);
    setResultadoFinal(null);
    setErro('');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 min-w-0 overflow-auto overflow-x-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition"
              title="Abrir menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">✅ Auditar</h1>
              {auditorSelecionado && (
                <div className="text-xs opacity-90 mt-1 truncate">
                  Auditor: <strong>{auditorSelecionado.name}</strong>
                  {templateSelecionado && <> — Roteiro: <strong>{templateSelecionado.nome}</strong></>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 max-w-3xl mx-auto">
          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}

          {/* STAGE 1: escolher template (roteiro) */}
          {stage === 'template' && (
            <div>
              {/* Header colorido */}
              <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl p-5 mb-4 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">📋</div>
                  <div>
                    <h2 className="text-xl font-bold">Qual auditoria?</h2>
                    <p className="text-sm opacity-90">
                      {templates.length > 0
                        ? `${templates.length} roteiro(s) disponível(eis)`
                        : 'Nenhum roteiro disponível'}
                    </p>
                  </div>
                </div>
              </div>

              {templates.length === 0 ? (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-8 text-center">
                  <div className="text-5xl mb-2">🔍</div>
                  <div className="text-amber-800 font-semibold">Sem roteiros ativos</div>
                  <div className="text-sm text-amber-700 mt-1">Crie um template em Cadastros → Templates.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {templates.map((t, i) => {
                    // Paleta rotativa pros cards de template
                    const gradients = [
                      'from-sky-500 to-blue-600',
                      'from-fuchsia-500 to-pink-600',
                      'from-amber-500 to-orange-600',
                      'from-emerald-500 to-teal-600',
                      'from-violet-500 to-purple-600',
                      'from-rose-500 to-red-600',
                    ];
                    const icons = ['📝', '✨', '🎯', '🌟', '💎', '🔖'];
                    const grad = gradients[i % gradients.length];
                    const icon = icons[i % icons.length];
                    return (
                      <button key={t.id} onClick={() => escolherTemplate(t)}
                        className="text-left bg-white border-2 border-gray-100 rounded-xl overflow-hidden hover:shadow-xl hover:scale-[1.02] transition">
                        <div className={`bg-gradient-to-r ${grad} text-white px-4 py-3 flex items-center gap-3`}>
                          <span className="text-3xl">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-base truncate">{t.nome}</div>
                            <div className="text-xs opacity-90">Roteiro de auditoria</div>
                          </div>
                          <span className="text-xs bg-white/25 rounded-full px-2.5 py-1 font-bold">
                            {Number(t.minimo_esperado || 95).toFixed(0)}%
                          </span>
                        </div>
                        {t.observacao && (
                          <div className="p-3 text-xs text-gray-600 bg-gray-50">{t.observacao}</div>
                        )}
                        <div className="px-3 py-2 text-xs text-teal-600 font-semibold flex items-center justify-between">
                          <span>Toque para iniciar</span>
                          <span>→</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STAGE 2: selecionar auditor (filtrado pelo template) */}
          {stage === 'auditor' && (
            <div>
              <button onClick={voltarTemplate} className="text-sm text-teal-600 hover:text-teal-800 mb-3 flex items-center gap-1 font-medium">← Trocar roteiro</button>

              <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl p-5 mb-4 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">👤</div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold">Quem está auditando?</h2>
                    <p className="text-sm opacity-90 truncate">Roteiro: <strong>{templateSelecionado?.nome}</strong></p>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-teal-200 rounded-xl p-5 shadow-sm">
                <select value={auditorId} onChange={e => setAuditorId(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition">
                  <option value="">— Selecione um auditor —</option>
                  {auditores.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {auditores.length === 0 && (
                  <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    ⚠️ Nenhum auditor liberado pra este roteiro{lojaSelecionada != null ? ` na Loja ${lojaSelecionada}` : ''}. Ajuste em <strong>Templates → Grupos de Acesso — Auditores</strong>.
                  </div>
                )}
                <button onClick={confirmarAuditor} disabled={!auditorId}
                  className={`mt-4 w-full py-4 rounded-lg font-bold text-lg transition ${!auditorId ? 'bg-gray-200 text-gray-400' : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:shadow-lg hover:scale-[1.02]'}`}>
                  🚀 Continuar
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: iniciar (auditado + loja) */}
          {stage === 'iniciar' && (
            <div>
              <button onClick={voltarAuditor} className="text-sm text-teal-600 hover:text-teal-800 mb-3 flex items-center gap-1 font-medium">← Trocar auditor</button>

              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-5 mb-4 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">📱</div>
                  <div>
                    <h2 className="text-xl font-bold">Iniciar Auditoria</h2>
                    <p className="text-sm opacity-90">Roteiro: <strong>{templateSelecionado?.nome}</strong></p>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    👥 Auditado <span className="text-xs font-normal text-gray-400">(opcional)</span>
                  </label>
                  <select value={auditadoId} onChange={e => setAuditadoId(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition">
                    <option value="">— Nenhum —</option>
                    {auditados.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {lojaSelecionada != null && auditados.length === 0 && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      ⚠️ Nenhum auditado na Loja {lojaSelecionada}. Libere em Colaboradores (flag "Pode ser auditado").
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    🏪 Loja
                  </label>
                  {lojaSelecionada != null ? (
                    <div className="w-full border-2 border-teal-200 bg-teal-50 rounded-lg px-4 py-3 text-base font-semibold text-teal-800 flex items-center gap-2">
                      <span className="bg-teal-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">{lojaSelecionada}</span>
                      <span>Loja {lojaSelecionada}</span>
                      <span className="ml-auto text-xs font-normal text-teal-600">(selecionada no topo)</span>
                    </div>
                  ) : (
                    <div className="w-full border-2 border-amber-200 bg-amber-50 rounded-lg px-4 py-3 text-sm text-amber-800">
                      ⚠️ Nenhuma loja selecionada. Escolha uma loja específica no seletor <strong>LOJA</strong> no topo do menu lateral pra iniciar a auditoria.
                    </div>
                  )}
                </div>

                <button onClick={iniciarInspection}
                  disabled={lojaSelecionada == null}
                  className={`w-full py-4 rounded-lg font-bold text-lg transition ${lojaSelecionada == null ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:shadow-lg hover:scale-[1.02]'}`}>
                  ⚡ Começar verificação
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: executar */}
          {stage === 'executar' && currentSection && (
            <div>
              {/* Cabeçalho de Progresso — colorido, com emoji e destaque */}
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg px-5 py-4 mb-3 shadow-md">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide opacity-90 font-semibold">📂 Seção {sectionIdx + 1} de {totalSecoes}</div>
                    <div className="text-xl font-bold mt-0.5">{currentSection.nome}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold leading-none">
                      {perguntasRespondidas}<span className="text-sm opacity-80">/{totalPerguntas}</span>
                    </div>
                    <div className="text-xs opacity-90 mt-1">⚡ {totalPerguntas === 0 ? 0 : Math.round((perguntasRespondidas / totalPerguntas) * 100)}%</div>
                  </div>
                </div>
                <div className="h-3 bg-teal-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-300 to-orange-400 transition-all"
                    style={{ width: totalPerguntas === 0 ? '0%' : `${(perguntasRespondidas / totalPerguntas) * 100}%` }} />
                </div>
              </div>

              {/* Stats — cards coloridos */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{stats.conformes}</div>
                  <div className="text-xs text-emerald-700 font-semibold flex items-center justify-center gap-1">
                    😊 Conformes
                  </div>
                </div>
                <div className="bg-rose-100 border border-rose-300 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-rose-700">{stats.naoConformes}</div>
                  <div className="text-xs text-rose-700 font-semibold flex items-center justify-center gap-1">
                    🙁 Não Conformes
                  </div>
                </div>
                <div className="bg-sky-100 border border-sky-300 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-sky-700">{stats.na}</div>
                  <div className="text-xs text-sky-700 font-semibold flex items-center justify-center gap-1">
                    n/a N/A
                  </div>
                </div>
                <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-700">{stats.alertas}</div>
                  <div className="text-xs text-amber-700 font-semibold flex items-center justify-center gap-1">
                    ⚠️ Alertas
                  </div>
                </div>
                <div className="bg-slate-200 border border-slate-300 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                  <div className="text-2xl font-bold text-slate-700">{stats.pendentes}</div>
                  <div className="text-xs text-slate-700 font-semibold flex items-center justify-center gap-1">
                    ⏳ Pendentes
                  </div>
                </div>
              </div>

              {/* Perguntas da seção */}
              <div className="space-y-4">
                {(() => {
                  const perguntasVisiveis = (currentSection.questions || []).filter(perguntaAplicaHoje);
                  if (perguntasVisiveis.length === 0) {
                    return (
                      <div className="text-center text-gray-500 italic py-8">
                        {(currentSection.questions || []).length === 0
                          ? 'Sem perguntas nesta seção'
                          : 'Nenhuma pergunta desta seção se aplica ao dia de hoje'}
                      </div>
                    );
                  }
                  return null;
                })()}
                {(currentSection.questions || []).filter(perguntaAplicaHoje).map((q, qIdx) => {
                  const modelo = modelos.find(m => m.id === q.modelo_alternativa_id);
                  const resp = respostas[q.id] || {};
                  // Verifica se a pergunta está fora do horário permitido (auto "não feito")
                  const agoraHHMM = new Date().toTimeString().slice(0, 5);
                  const foraDoHorario = q.hora_fim && agoraHHMM > q.hora_fim;
                  const antesDoHorario = q.hora_inicio && agoraHHMM < q.hora_inicio;
                  const score = resp.score ?? null;
                  const respondida = resp.ordemAlt !== undefined;
                  const borderClass = !respondida ? 'border-gray-200'
                    : score > 0 ? 'border-emerald-400'
                    : score < 0 ? 'border-rose-400'
                    : resp.conforme === 'NA' ? 'border-sky-400'
                    : 'border-amber-400';
                  const headerGrad = !respondida ? 'from-slate-500 to-slate-600'
                    : score > 0 ? 'from-emerald-500 to-green-600'
                    : score < 0 ? 'from-rose-500 to-red-600'
                    : resp.conforme === 'NA' ? 'from-sky-500 to-blue-600'
                    : 'from-amber-500 to-orange-600';
                  return (
                    <div key={q.id} className={`bg-white border-2 rounded-xl overflow-hidden shadow-sm transition ${borderClass}`}>
                      {/* Header da pergunta — gradient colorido */}
                      <div className={`bg-gradient-to-r ${headerGrad} text-white px-4 py-2.5 flex items-center gap-2 flex-wrap`}>
                        <span className="bg-white/25 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">{qIdx + 1}</span>
                        <span className="text-xs uppercase font-semibold tracking-wide opacity-90">Pergunta</span>
                        {respondida && (
                          <span className="ml-auto flex items-center gap-2">
                            {resp.respondida_em && (
                              <span className="text-xs bg-white/25 rounded px-2 py-0.5 font-semibold flex items-center gap-1">
                                🕒 {new Date(resp.respondida_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            <span className="text-xs bg-white/25 rounded px-2 py-0.5 font-semibold">✓ Respondida</span>
                          </span>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="text-base font-semibold text-gray-800 mb-3">{q.texto}</div>

                        {(q.hora_inicio || q.hora_fim) && (
                          <div className={`mb-3 border rounded-lg p-2 text-xs flex items-center gap-2 ${foraDoHorario ? 'bg-red-50 border-red-300 text-red-700' : antesDoHorario ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
                            <span>⏰</span>
                            <div className="flex-1">
                              {foraDoHorario ? (
                                <span><strong>Fora do horário.</strong> Esta pergunta deveria ter sido preenchida até <strong>{q.hora_fim}</strong>. Será marcada como "não feito" automaticamente.</span>
                              ) : antesDoHorario ? (
                                <span>Pergunta disponível a partir das <strong>{q.hora_inicio}</strong>.</span>
                              ) : (
                                <span>Horário permitido: <strong>{q.hora_inicio || '--:--'}</strong> até <strong>{q.hora_fim || '--:--'}</strong></span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Imagens de referência (clicar = ampliar) */}
                        {(q.imagens_referencia || []).length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">📷 Referências</div>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {q.imagens_referencia.map((img, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setLightbox(img)}
                                  className="shrink-0 rounded-lg border-2 border-gray-200 hover:border-teal-500 overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                                  title="Clique para ampliar"
                                >
                                  <img src={img.url} alt={img.titulo || ''} className="w-20 h-20 object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Alternativas — botões grandes com borda colorida quando ativo */}
                        {modelo ? (
                          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${(foraDoHorario || antesDoHorario) ? 'opacity-50 pointer-events-none' : ''}`}>
                            {(modelo.alternativas || []).map(a => {
                              const ativo = resp.ordemAlt === a.ordem;
                              const cfg = (q.alternativas_config || []).find(c => c.ordem === a.ordem) || {};
                              const v = cfg.valor_override ?? a.valor;
                              const activeClass = !ativo ? 'border-gray-200 hover:border-teal-300 bg-white'
                                : v > 0 ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                                : v < 0 ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200'
                                : a.icone === 'na_blue' ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                                : 'border-amber-500 bg-amber-50 ring-2 ring-amber-200';
                              return (
                                <button key={a.ordem} onClick={() => responder(q, a)}
                                  disabled={foraDoHorario || antesDoHorario}
                                  className={`flex flex-col items-center gap-1.5 border-2 rounded-xl p-3 transition ${activeClass}`}>
                                  <AlternativaIcon icone={a.icone} size={44} />
                                  <span className="text-xs font-semibold text-gray-700 text-center">{a.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">⚠️ Pergunta sem modelo de alternativa configurado</div>
                        )}

                      {/* Campos obrigatórios após resposta */}
                      {resp.ordemAlt !== undefined && (
                        <div className="mt-4 space-y-3">
                          {(resp.requires_photo || q.foto_obrigatoria) && (() => {
                            const temFoto = (resp.fotos || []).length > 0;
                            return (
                              <div className={`border-2 rounded-xl p-3 ${temFoto ? 'border-emerald-300 bg-emerald-50' : 'border-sky-300 bg-sky-50'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xl">📷</span>
                                  <div className="flex-1">
                                    <div className="text-sm font-bold text-gray-800">Foto de evidência</div>
                                    <div className="text-xs text-gray-600">
                                      {temFoto ? `✅ ${resp.fotos.length} foto(s) anexada(s)` : <span className="text-red-600 font-semibold">⚠️ Obrigatória — tire uma foto pela câmera</span>}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setCameraPara({ questionId: q.id })}
                                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold cursor-pointer transition ${temFoto ? 'bg-white border-2 border-emerald-400 text-emerald-700 hover:bg-emerald-100' : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:shadow-lg'}`}
                                >
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                                  </svg>
                                  {temFoto ? 'Tirar outra foto' : 'Abrir câmera'}
                                </button>
                                {temFoto && (
                                  <div className="flex gap-2 mt-3 flex-wrap">
                                    {resp.fotos.map((f, i) => (
                                      <div key={i} className="relative flex flex-col items-center group">
                                        <button type="button" onClick={() => setLightbox(f)}
                                          className="rounded-lg overflow-hidden border-2 border-emerald-300 hover:border-emerald-500">
                                          <img src={f.url} alt="" className="w-20 h-20 object-cover" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => removerFoto(q.id, i)}
                                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-sm font-bold shadow-md hover:bg-red-600 flex items-center justify-center"
                                          title="Remover foto"
                                        >×</button>
                                        {f.captured_at && (
                                          <span className="text-[10px] text-emerald-700 font-mono mt-0.5">
                                            🕒 {new Date(f.captured_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {resp.requires_comment && (() => {
                            const temComentario = (resp.observacao || '').trim().length > 0;
                            return (
                              <div className={`border-2 rounded-xl p-3 ${temComentario ? 'border-emerald-300 bg-emerald-50' : 'border-violet-300 bg-violet-50'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xl">💬</span>
                                  <div className="flex-1">
                                    <div className="text-sm font-bold text-gray-800">Comentário de evidência</div>
                                    <div className="text-xs text-gray-600">
                                      {temComentario ? '✅ Comentário preenchido' : <span className="text-red-600 font-semibold">⚠️ Obrigatório — descreva o motivo</span>}
                                    </div>
                                  </div>
                                </div>
                                <textarea value={resp.observacao || ''} onChange={e => atualizarObservacao(q.id, e.target.value)}
                                  onBlur={() => responder(q, { ordem: resp.ordemAlt, label: resp.valor_opcao, valor: resp.score ?? 0 })}
                                  rows={2}
                                  placeholder="Ex: item estava sem preço pq o etiquetador estava na manutenção…"
                                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navegação */}
              <div className="flex gap-2 mt-5 pt-3 pb-4">
                <button onClick={secaoAnterior} disabled={sectionIdx === 0}
                  className={`flex-1 py-3 rounded font-medium ${sectionIdx === 0 ? 'bg-gray-200 text-gray-400' : 'bg-white border hover:bg-gray-50'}`}>
                  ← Anterior
                </button>
                <button onClick={proximaSecao}
                  className="flex-1 py-3 rounded font-medium bg-teal-500 text-white hover:bg-teal-600">
                  {sectionIdx === totalSecoes - 1 ? 'Finalizar →' : 'Próxima →'}
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: finalizar */}
          {stage === 'finalizar' && (() => {
            const pendencias = validarEvidencias();
            return (
            <div>
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl p-5 mb-4 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">🏁</div>
                  <div>
                    <h2 className="text-xl font-bold">Finalizar Auditoria</h2>
                    <p className="text-sm opacity-90">
                      {perguntasRespondidas} de {totalPerguntas} perguntas respondidas
                    </p>
                  </div>
                </div>
              </div>

              {pendencias.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <div className="font-bold text-red-800">Evidências obrigatórias pendentes</div>
                      <div className="text-sm text-red-700">{pendencias.length} pergunta(s) precisam de foto e/ou comentário:</div>
                    </div>
                  </div>
                  <ul className="text-xs text-red-800 space-y-1 ml-6 list-disc">
                    {pendencias.slice(0, 5).map((p, i) => (
                      <li key={i}>
                        <strong>{p.secao}</strong> → Pergunta {p.perguntaN}: <em>{p.pergunta.substring(0, 60)}{p.pergunta.length > 60 ? '…' : ''}</em> (falta {p.falta})
                      </li>
                    ))}
                    {pendencias.length > 5 && <li>… e mais {pendencias.length - 5}</li>}
                  </ul>
                </div>
              )}

              <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
                <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-2">
                  📝 Observação geral <span className="text-xs font-normal text-gray-400">(opcional)</span>
                </label>
                <textarea value={observacaoGeral} onChange={e => setObservacaoGeral(e.target.value)}
                  rows={4} placeholder="Alguma observação sobre esta auditoria?"
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm mb-5 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition" />

                <div className={`rounded-lg p-4 mb-4 border-2 ${assinaturaAuditor ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-800">Assinatura do auditor</span>
                    <span className="text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">OBRIGATÓRIA</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">Assine com o dedo na área abaixo para confirmar a auditoria.</p>
                  <SignaturePad value={assinaturaAuditor} onChange={setAssinaturaAuditor} label="Assinatura" />
                  {!assinaturaAuditor && (
                    <p className="mt-2 text-xs text-amber-700 font-medium">⚠️ Sem assinatura não é possível finalizar.</p>
                  )}
                </div>

                {/* Aviso: se o template tem grupo configurado, o envio sera automatico */}
                {templateSelecionado?.whatsapp_group_pdf_id && (
                  <div className="rounded-lg p-3 mb-4 border-2 border-emerald-200 bg-emerald-50 text-xs text-emerald-800">
                    💬 Ao finalizar, o PDF será enviado automaticamente para
                    <strong> {templateSelecionado.whatsapp_group_pdf_name || 'o grupo WhatsApp configurado'}</strong>.
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setStage('executar')}
                    className="flex-1 py-3 border-2 border-gray-200 bg-white rounded-lg font-semibold text-gray-700 hover:bg-gray-50">
                    ← Voltar
                  </button>
                  <button onClick={finalizar} disabled={finalizando || !assinaturaAuditor}
                    className={`flex-1 py-3 rounded-lg font-bold transition ${(finalizando || !assinaturaAuditor) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:shadow-lg hover:scale-[1.02]'}`}>
                    {finalizando ? 'Enviando…' : '🚀 Enviar auditoria'}
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

          {/* STAGE 6: fim */}
          {stage === 'fim' && resultadoFinal && (() => {
            const pct = Number(resultadoFinal.percentual_conformidade || 0);
            const meta = Number(templateSelecionado?.minimo_esperado || 95);
            const atingiu = pct >= meta;
            const emoji = atingiu ? '🎉' : pct >= 70 ? '👍' : pct >= 50 ? '😐' : '⚠️';
            const tituloMsg = atingiu ? 'Parabéns! Meta atingida' : pct >= 70 ? 'Quase lá!' : 'Atenção necessária';
            const headerGrad = atingiu ? 'from-emerald-500 to-green-600'
              : pct >= 70 ? 'from-teal-500 to-cyan-600'
              : pct >= 50 ? 'from-amber-500 to-orange-500'
              : 'from-rose-500 to-red-600';
            return (
              <div>
                <div className={`bg-gradient-to-r ${headerGrad} text-white rounded-xl p-6 mb-4 shadow-lg text-center`}>
                  <div className="text-6xl mb-3">{emoji}</div>
                  <h2 className="text-2xl font-bold">{tituloMsg}</h2>
                  <p className="text-sm opacity-90 mt-1">Auditoria concluída com sucesso</p>
                </div>

                <div className="bg-white border-2 border-gray-100 rounded-xl p-6 shadow-sm text-center">
                  <div className="text-xs uppercase font-bold text-gray-500 tracking-wide">Conformidade</div>
                  <div className={`text-6xl font-extrabold my-2 ${atingiu ? 'text-emerald-600' : pct >= 70 ? 'text-teal-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {pct.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">
                    Meta: <strong>{meta.toFixed(0)}%</strong> · Score: <strong>{Number(resultadoFinal.score_final || 0).toFixed(2)}</strong> / {Number(resultadoFinal.score_max || 0).toFixed(2)}
                  </div>
                  {templateSelecionado?.whatsapp_group_pdf_id && (
                    <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                      💬 PDF enviado para <strong>{templateSelecionado.whatsapp_group_pdf_name || 'o grupo configurado'}</strong> no WhatsApp.
                    </div>
                  )}
                  <div className="mt-5 flex flex-col sm:flex-row gap-2">
                    <a href={`/api/checklist/inspections/${resultadoFinal.id}/pdf?token=${encodeURIComponent(localStorage.getItem('token') || '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex-1 py-3 bg-white border-2 border-teal-500 text-teal-600 rounded-lg font-bold text-sm hover:bg-teal-50 transition text-center">
                      📄 Abrir PDF
                    </a>
                    <button onClick={resetar}
                      className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg font-bold text-sm hover:shadow-lg hover:scale-[1.02] transition">
                      🔁 Nova auditoria
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Câmera real (via getUserMedia) — sem fallback pra galeria */}
      {cameraPara && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setCameraPara(null)}
        />
      )}

      {/* Lightbox — imagem ampliada ao clicar */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4"
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
              className="absolute -top-3 -right-3 bg-white text-gray-800 rounded-full w-10 h-10 text-xl font-bold shadow-lg hover:bg-gray-100"
            >×</button>
          </div>
        </div>
      )}
    </div>
  );
}
