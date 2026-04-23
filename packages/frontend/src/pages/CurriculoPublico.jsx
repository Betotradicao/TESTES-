import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

export default function CurriculoPublico() {
  const [cargos, setCargos] = useState([]);
  const [habilidades, setHabilidades] = useState([]);
  const [lojas, setLojas] = useState([]);
  // Loja escolhida pelo candidato na tela inicial (usa id da empresa)
  const [lojaEscolhidaId, setLojaEscolhidaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoInputRef = useRef(null);

  const [form, setForm] = useState({
    nome: '',
    foto_url: null,
    resumo: '',
    data_nascimento: '',
    whatsapp: '',
    email: '',
    instagram: '',
    interesse_vaga: '', // 'clt' | 'aprendiz' - obrigatorio
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    // Checkboxes (apenas pra filtro rapido no banco)
    cargos: [],
    habilidades: [],
    // Lista dinamica com detalhes completos
    experiencias_detalhadas: [],
    formacoes: [],
    cursos_adicionais: [],
    experiencia_texto: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/curriculos/publico/formulario');
        setCargos(res.data?.cargos || []);
        setHabilidades(res.data?.habilidades || []);
        const listaLojas = res.data?.lojas || [];
        setLojas(listaLojas);
        // Se so existe 1 loja, seleciona ela automaticamente
        if (listaLojas.length === 1) {
          setLojaEscolhidaId(listaLojas[0].id);
        }
      } catch (e) {
        setErro('Nao foi possivel carregar o formulario. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const buscarCep = async (cepRaw) => {
    const cep = (cepRaw || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (!data.erro) {
        setForm(f => ({
          ...f,
          rua: data.logradouro || f.rua,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }));
      }
    } catch {}
    finally { setBuscandoCep(false); }
  };

  const subirFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const r = await api.post('/curriculos/publico/upload-foto', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (r.data?.url) setForm(f => ({ ...f, foto_url: r.data.url }));
    } catch (err) {
      setErro('Erro ao enviar foto.');
    } finally {
      setUploadingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  const toggleItem = (campo, valor) => {
    setForm(f => {
      const atual = f[campo] || [];
      const nova = atual.includes(valor) ? atual.filter(x => x !== valor) : [...atual, valor];
      return { ...f, [campo]: nova };
    });
  };

  const addHabilidadeNova = () => {
    const nome = window.prompt('Qual habilidade você quer adicionar?');
    if (!nome?.trim()) return;
    const up = nome.trim().toUpperCase();
    if (habilidades.includes(up) || form.habilidades.includes(up)) return;
    setHabilidades(h => [...h, up]);
    setForm(f => ({ ...f, habilidades: [...f.habilidades, up] }));
  };

  // ===== Experiências detalhadas =====
  const addExperiencia = (funcaoInicial = '') => {
    setForm(f => ({
      ...f,
      experiencias_detalhadas: [
        ...f.experiencias_detalhadas,
        { funcao: funcaoInicial, empresa: '', empresa_instagram: '', tempo_anos: '', tempo_meses: '', descricao: '' },
      ],
    }));
  };

  const updateExperiencia = (idx, campo, valor) => {
    setForm(f => ({
      ...f,
      experiencias_detalhadas: f.experiencias_detalhadas.map((e, i) => i === idx ? { ...e, [campo]: valor } : e),
    }));
  };

  const removeExperiencia = (idx) => {
    setForm(f => ({
      ...f,
      experiencias_detalhadas: f.experiencias_detalhadas.filter((_, i) => i !== idx),
    }));
  };

  // ===== Formação acadêmica =====
  const addFormacao = () => {
    setForm(f => ({ ...f, formacoes: [...f.formacoes, { curso: '', nome_curso: '', status: 'concluido' }] }));
  };
  const updateFormacao = (idx, campo, valor) => {
    setForm(f => ({ ...f, formacoes: f.formacoes.map((x, i) => i === idx ? { ...x, [campo]: valor } : x) }));
  };
  const removeFormacao = (idx) => {
    setForm(f => ({ ...f, formacoes: f.formacoes.filter((_, i) => i !== idx) }));
  };

  // ===== Cursos complementares =====
  const addCursoAdic = () => {
    setForm(f => ({ ...f, cursos_adicionais: [...(f.cursos_adicionais || []), { nome: '', instituicao: '', tempo: '' }] }));
  };
  const updateCursoAdic = (idx, campo, valor) => {
    setForm(f => ({
      ...f,
      cursos_adicionais: (f.cursos_adicionais || []).map((x, i) => {
        if (i !== idx) return x;
        // Suporta valor antigo (string) convertendo pra objeto
        const base = typeof x === 'string' ? { nome: x, instituicao: '', tempo: '' } : x;
        return { ...base, [campo]: valor };
      }),
    }));
  };
  const removeCursoAdic = (idx) => {
    setForm(f => ({ ...f, cursos_adicionais: (f.cursos_adicionais || []).filter((_, i) => i !== idx) }));
  };

  // Quando marca/desmarca um cargo, cria/remove a experiência detalhada correspondente
  const toggleCargo = (cargo) => {
    setForm(f => {
      const jaMarcou = f.cargos.includes(cargo);
      if (jaMarcou) {
        // Remove cargo + primeira experiencia com essa função
        const novasExp = [...f.experiencias_detalhadas];
        const idx = novasExp.findIndex(e => e.funcao === cargo);
        if (idx !== -1) novasExp.splice(idx, 1);
        return { ...f, cargos: f.cargos.filter(x => x !== cargo), experiencias_detalhadas: novasExp };
      } else {
        return {
          ...f,
          cargos: [...f.cargos, cargo],
          experiencias_detalhadas: [
            ...f.experiencias_detalhadas,
            { funcao: cargo, empresa: '', empresa_instagram: '', tempo_anos: '', tempo_meses: '', descricao: '' },
          ],
        };
      }
    });
  };

  const addCargoNovo = () => {
    const nome = window.prompt('Nome da função (ex: GERENTE DE LOJA):');
    if (!nome?.trim()) return;
    const up = nome.trim().toUpperCase();
    if (cargos.includes(up)) { toggleCargo(up); return; }
    setCargos(c => [...c, up]);
    setForm(f => ({
      ...f,
      cargos: [...f.cargos, up],
      experiencias_detalhadas: [
        ...f.experiencias_detalhadas,
        { funcao: up, empresa: '', empresa_instagram: '', tempo_anos: '', tempo_meses: '', descricao: '' },
      ],
    }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) { setErro('Informe seu nome completo.'); return; }
    if (!form.interesse_vaga) { setErro('Selecione o interesse de vaga (CLT ou Aprendiz).'); window.scrollTo(0, 0); return; }
    setEnviando(true);
    try {
      const payload = {
        ...form,
        experiencias_detalhadas: form.experiencias_detalhadas.map(ex => ({
          ...ex,
          tempo_anos: ex.tempo_anos === '' ? null : Number(ex.tempo_anos),
          tempo_meses: ex.tempo_meses === '' ? null : Number(ex.tempo_meses),
        })),
        formacoes: form.formacoes.map(fm => ({
          ...fm,
          ano_conclusao: fm.ano_conclusao === '' ? null : Number(fm.ano_conclusao),
        })),
      };
      const lojaSel = lojas.find(l => l.id === lojaEscolhidaId);
      await api.post('/curriculos/publico/enviar', { ...payload, cod_loja: lojaSel?.cod_loja ?? null });
      setEnviado(true);
      window.scrollTo(0, 0);
    } catch (err) {
      setErro(err?.response?.data?.error || 'Erro ao enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-100 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-gray-700">Carregando formulário…</div>
        </div>
      </div>
    );
  }

  // Tela inicial: selecao de loja (sempre aparece, exceto se houver apenas 1 loja cadastrada)
  if (lojaEscolhidaId == null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 py-6 px-4 overflow-x-hidden">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-2xl shadow-lg p-6 mb-5">
            <div className="flex items-center gap-3">
              <div className="text-5xl">🏪</div>
              <div>
                <h1 className="text-2xl font-bold">Pra qual loja você quer se candidatar?</h1>
                <p className="text-sm opacity-90 mt-1">Escolha a loja abaixo pra começar a preencher seu currículo.</p>
              </div>
            </div>
          </div>

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">{erro}</div>}

          {lojas.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md p-10 text-center">
              <div className="text-5xl mb-3">😕</div>
              <p className="text-gray-600 font-semibold">Nenhuma loja cadastrada no momento.</p>
              <p className="text-sm text-gray-500 mt-1">Tente novamente mais tarde ou entre em contato pelo WhatsApp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lojas.map(lj => {
                const titulo = lj.apelido || (lj.is_principal ? 'MATRIZ' : (lj.cod_loja ? `LOJA ${lj.cod_loja}` : 'LOJA'));
                return (
                  <button key={lj.id} onClick={() => setLojaEscolhidaId(lj.id)}
                    className="bg-white rounded-2xl shadow-md hover:shadow-xl hover:scale-[1.02] transition border-2 border-transparent hover:border-rose-400 overflow-hidden text-left">
                    {/* Foto */}
                    <div className="h-44 bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center overflow-hidden">
                      {lj.foto_fachada_url ? (
                        <img src={lj.foto_fachada_url} alt={titulo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-7xl">🏪</div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-4">
                      <h3 className="text-xl font-extrabold text-gray-800 mb-1">{titulo}</h3>
                      {lj.nome && <p className="text-sm text-gray-600 font-semibold mb-1">{lj.nome}</p>}
                      <p className="text-xs text-gray-500">
                        📍 {[lj.bairro, lj.cidade].filter(Boolean).join(' · ') || 'Endereço não informado'}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-rose-600">
                        Candidatar-se aqui <span>→</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-teal-100 to-green-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-md">
          <div className="text-6xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-emerald-700 mb-2">Currículo enviado!</h1>
          <p className="text-sm text-gray-600">
            Recebemos seus dados. Se houver uma vaga compatível, nossa equipe de RH entrará em contato pelo WhatsApp ou e-mail.
          </p>
          <p className="text-xs text-gray-400 mt-4">Você já pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 py-6 px-4 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-2xl shadow-lg p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl">📝</div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">Cadastro de Currículo</h1>
              <p className="text-xs opacity-90 mt-0.5">Preencha como em um currículo tradicional. Quanto mais detalhes, maiores suas chances.</p>
            </div>
          </div>
          {/* Loja selecionada com opcao de trocar */}
          {(() => {
            const lj = lojas.find(l => l.id === lojaEscolhidaId);
            if (!lj) return null;
            const titulo = lj.apelido || (lj.is_principal ? 'MATRIZ' : (lj.cod_loja ? `LOJA ${lj.cod_loja}` : 'LOJA'));
            return (
              <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between gap-3 flex-wrap text-sm">
                <div className="flex items-center gap-2">
                  <span>🏪</span>
                  <span>
                    Candidatando-se na <strong>{titulo}</strong>
                    {lj.nome && <> · {lj.nome}</>}
                    {lj.bairro && <> · {lj.bairro}</>}
                  </span>
                </div>
                {lojas.length > 1 && (
                  <button type="button" onClick={() => setLojaEscolhidaId(null)}
                    className="text-xs px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full font-semibold transition">
                    Trocar loja
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">{erro}</div>}

        {/* Lista de sugestões de cursos */}
        <datalist id="cursos-sugeridos">
          <option value="Analfabeto" />
          <option value="Ensino Fundamental" />
          <option value="Ensino Médio" />
          <option value="Ensino Técnico" />
          <option value="Ensino Superior" />
          <option value="Pós-graduação" />
          <option value="Mestrado" />
          <option value="Doutorado" />
        </datalist>

        <form onSubmit={enviar} className="bg-white rounded-2xl shadow-md p-5 space-y-6">
          {/* ===== FOTO + DADOS PESSOAIS ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-3">👤 Dados pessoais</h2>
            <div className="flex flex-col md:flex-row gap-4 items-start">
              {/* Foto */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="w-32 h-32 rounded-full border-4 border-rose-200 bg-rose-50 overflow-hidden flex items-center justify-center">
                  {form.foto_url ? (
                    <img src={form.foto_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-16 h-16 text-rose-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <input ref={fotoInputRef} type="file" accept="image/*" onChange={subirFoto} className="hidden" />
                <button type="button" onClick={() => fotoInputRef.current?.click()} disabled={uploadingFoto}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold ${uploadingFoto ? 'bg-gray-300 text-gray-500' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}>
                  {uploadingFoto ? '⏳ Enviando…' : (form.foto_url ? '🔄 Trocar foto' : '📷 Adicionar foto')}
                </button>
                <span className="text-[10px] text-gray-400">(opcional)</span>
              </div>

              {/* Campos */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                <FieldReq label="Nome completo" value={form.nome} onChange={v => setForm({ ...form, nome: v })} />
                <Field label="Data de nascimento" type="date" value={form.data_nascimento} onChange={v => setForm({ ...form, data_nascimento: v })} />
                <Field label="WhatsApp" placeholder="(00) 00000-0000" value={form.whatsapp} onChange={v => setForm({ ...form, whatsapp: v })} caseSensitive />
                <Field label="E-mail" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} caseSensitive />
                <Field label="Instagram (@)" value={form.instagram} onChange={v => setForm({ ...form, instagram: v })} caseSensitive />
              </div>
            </div>
          </section>

          {/* ===== RESUMO / SOBRE ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-1">🧾 Resumo profissional</h2>
            <p className="text-xs text-gray-500 mb-2">Fale brevemente sobre você, sua experiência e o que busca.</p>
            <textarea value={form.resumo} onChange={e => setForm({ ...form, resumo: e.target.value.toUpperCase() })} rows={3}
              placeholder="EX: SOU ORGANIZADO, COM 4 ANOS DE EXPERIÊNCIA EM ATENDIMENTO E CAIXA. BUSCO UMA VAGA ONDE POSSA CRESCER NA ÁREA DE REPOSIÇÃO."
              style={{ textTransform: 'uppercase' }}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
          </section>

          {/* ===== ENDEREÇO ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-3">🏠 Endereço</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">CEP</label>
                <div className="flex gap-1">
                  <input type="text" value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })}
                    onBlur={() => buscarCep(form.cep)} placeholder="00000-000"
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
                  {buscandoCep && <span className="text-xs text-gray-500 self-center px-2">🔎</span>}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Digite e saia do campo</p>
              </div>
              <Field label="Rua" value={form.rua} onChange={v => setForm({ ...form, rua: v })} />
              <Field label="Número" value={form.numero} onChange={v => setForm({ ...form, numero: v })} />
              <Field label="Complemento" value={form.complemento} onChange={v => setForm({ ...form, complemento: v })} />
              <Field label="Bairro" value={form.bairro} onChange={v => setForm({ ...form, bairro: v })} />
              <Field label="Cidade" value={form.cidade} onChange={v => setForm({ ...form, cidade: v })} />
              <Field label="Estado (UF)" value={form.estado} onChange={v => setForm({ ...form, estado: v.toUpperCase().slice(0, 2) })} />
            </div>
          </section>

          {/* ===== INTERESSE DE VAGA (OBRIGATÓRIO) ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-1">
              🎯 Interesse de vaga <span className="text-red-500">*</span>
            </h2>
            <p className="text-xs text-gray-500 mb-2">Selecione UMA opção (obrigatório)</p>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition ${form.interesse_vaga === 'clt' ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200' : 'border-gray-200 hover:border-rose-300'}`}>
                <input type="radio" name="interesse_vaga" value="clt"
                  checked={form.interesse_vaga === 'clt'}
                  onChange={() => setForm({ ...form, interesse_vaga: 'clt' })}
                  className="w-4 h-4 accent-rose-500" required />
                <div>
                  <div className="text-sm font-bold text-gray-800">CLT</div>
                  <div className="text-[11px] text-gray-500">Contrato efetivo, carteira assinada</div>
                </div>
              </label>
              <label className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition ${form.interesse_vaga === 'aprendiz' ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200' : 'border-gray-200 hover:border-rose-300'}`}>
                <input type="radio" name="interesse_vaga" value="aprendiz"
                  checked={form.interesse_vaga === 'aprendiz'}
                  onChange={() => setForm({ ...form, interesse_vaga: 'aprendiz' })}
                  className="w-4 h-4 accent-rose-500" required />
                <div>
                  <div className="text-sm font-bold text-gray-800">APRENDIZ</div>
                  <div className="text-[11px] text-gray-500">Jovem aprendiz / primeiro emprego</div>
                </div>
              </label>
            </div>
          </section>

          {/* ===== EXPERIÊNCIAS COMO (cargos) ===== */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-gray-800">💼 Experiências como</h2>
              <button type="button" onClick={addCargoNovo}
                className="text-xs px-3 py-1 bg-rose-100 text-rose-700 rounded-full font-bold hover:bg-rose-200">
                + Outra função
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Marque os cargos em que já trabalhou. Ao marcar, abaixo abre um campo pra detalhar a experiência.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {cargos.map(c => (
                <label key={c} className={`flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer text-xs ${form.cargos.includes(c) ? 'border-rose-400 bg-rose-50' : 'border-gray-200 hover:border-rose-200'}`}>
                  <input type="checkbox" checked={form.cargos.includes(c)} onChange={() => toggleCargo(c)}
                    className="w-4 h-4 accent-rose-500" />
                  <span className="text-gray-700 font-semibold">{c}</span>
                </label>
              ))}
            </div>
          </section>

          {/* ===== DETALHES DAS EXPERIÊNCIAS ===== */}
          {form.experiencias_detalhadas.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-800 mb-2">📋 Detalhes das suas experiências</h2>
              <div className="space-y-3">
                {form.experiencias_detalhadas.map((ex, idx) => (
                  <div key={idx} className="bg-rose-50/50 border-2 border-rose-200 rounded-xl p-3 relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-rose-700 uppercase">Função {idx + 1}</span>
                      <button type="button" onClick={() => removeExperiencia(idx)}
                        className="text-xs text-red-600 hover:text-red-800 font-bold">🗑️ Remover</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Field label="Função / Cargo" value={ex.funcao} onChange={v => updateExperiencia(idx, 'funcao', v)} />
                      <Field label="Empresa" value={ex.empresa} onChange={v => updateExperiencia(idx, 'empresa', v)} />
                      <Field label="Instagram da empresa (opcional)" value={ex.empresa_instagram} onChange={v => updateExperiencia(idx, 'empresa_instagram', v)} placeholder="@empresa" caseSensitive />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Anos" type="number" value={ex.tempo_anos} onChange={v => updateExperiencia(idx, 'tempo_anos', v)} />
                        <Field label="Meses" type="number" value={ex.tempo_meses} onChange={v => updateExperiencia(idx, 'tempo_meses', v)} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">O que você fazia</label>
                        <textarea value={ex.descricao} onChange={e => updateExperiencia(idx, 'descricao', e.target.value)} rows={2}
                          placeholder="Ex: atendimento no balcão, reposição das gôndolas, fechamento de caixa…"
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => addExperiencia('')}
                className="mt-3 w-full py-2 border-2 border-dashed border-rose-300 text-rose-600 rounded-lg text-sm font-bold hover:bg-rose-50">
                + Adicionar mais uma experiência
              </button>
            </section>
          )}

          {/* ===== HABILIDADES ===== */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-gray-800">🔧 Habilidades práticas</h2>
              <button type="button" onClick={addHabilidadeNova}
                className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-bold hover:bg-indigo-200">
                + Outra habilidade
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Marque o que você sabe fazer</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {habilidades.map(h => (
                <label key={h} className={`flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer text-xs ${form.habilidades.includes(h) ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}>
                  <input type="checkbox" checked={form.habilidades.includes(h)} onChange={() => toggleItem('habilidades', h)}
                    className="w-4 h-4 accent-indigo-500" />
                  <span className="text-gray-700">{h}</span>
                </label>
              ))}
            </div>
          </section>

          {/* ===== FORMAÇÃO ACADÊMICA ===== */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-gray-800">🎓 Formação</h2>
              <button type="button" onClick={addFormacao}
                className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-bold hover:bg-amber-200">
                + Adicionar
              </button>
            </div>
            {form.formacoes.length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhuma formação adicionada. Clique no botão acima.</p>
            )}
            <div className="space-y-2">
              {form.formacoes.map((fm, idx) => {
                const nivelExigeNome = ['Ensino Técnico', 'Ensino Superior', 'Pós-graduação', 'Mestrado', 'Doutorado']
                  .includes((fm.curso || '').trim());
                return (
                  <div key={idx} className="bg-amber-50/50 border-2 border-amber-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-amber-700 uppercase">Formação {idx + 1}</span>
                      <button type="button" onClick={() => removeFormacao(idx)} className="text-xs text-red-600 hover:text-red-800 font-bold">🗑️</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Nível</label>
                        <select value={fm.curso || ''} onChange={e => updateFormacao(idx, 'curso', e.target.value)}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
                          <option value="">— selecione —</option>
                          <option value="Analfabeto">Analfabeto</option>
                          <option value="Ensino Fundamental">Ensino Fundamental</option>
                          <option value="Ensino Médio">Ensino Médio</option>
                          <option value="Ensino Técnico">Ensino Técnico</option>
                          <option value="Ensino Superior">Ensino Superior</option>
                          <option value="Pós-graduação">Pós-graduação</option>
                          <option value="Mestrado">Mestrado</option>
                          <option value="Doutorado">Doutorado</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Situação</label>
                        <select value={fm.status} onChange={e => updateFormacao(idx, 'status', e.target.value)}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
                          <option value="concluido">Concluído</option>
                          <option value="cursando">Cursando</option>
                          <option value="incompleto">Incompleto</option>
                        </select>
                      </div>
                      {nivelExigeNome && (
                        <div className="md:col-span-2">
                          <Field
                            label="Nome do curso"
                            value={fm.nome_curso}
                            onChange={v => updateFormacao(idx, 'nome_curso', v)}
                            placeholder="Ex: Administração, Técnico em Informática…"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ===== CURSOS COMPLEMENTARES ===== */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-gray-800">📖 Cursos complementares</h2>
              <button type="button" onClick={addCursoAdic}
                className="text-xs px-3 py-1 bg-sky-100 text-sky-700 rounded-full font-bold hover:bg-sky-200">
                + Adicionar curso
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Ex: NR-11 Empilhadeira, Manipulação de Alimentos, Excel, Inglês…</p>
            {(form.cursos_adicionais || []).length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhum curso adicionado.</p>
            )}
            <div className="space-y-2">
              {(form.cursos_adicionais || []).map((curso, idx) => {
                // Compat: aceita valor antigo (string)
                const c = typeof curso === 'string' ? { nome: curso, instituicao: '', tempo: '' } : curso;
                return (
                  <div key={idx} className="bg-sky-50/50 border-2 border-sky-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-sky-700 uppercase">Curso {idx + 1}</span>
                      <button type="button" onClick={() => removeCursoAdic(idx)} className="text-xs text-red-600 hover:text-red-800 font-bold">🗑️</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Nome do curso</label>
                        <input type="text" value={c.nome || ''} onChange={e => updateCursoAdic(idx, 'nome', e.target.value.toUpperCase())}
                          placeholder="Ex: NR-11 EMPILHADEIRA"
                          style={{ textTransform: 'uppercase' }}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-400" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Escola / instituição</label>
                        <input type="text" value={c.instituicao || ''} onChange={e => updateCursoAdic(idx, 'instituicao', e.target.value.toUpperCase())}
                          placeholder="Ex: SENAC"
                          style={{ textTransform: 'uppercase' }}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-400" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Tempo / carga horária</label>
                        <input type="text" value={c.tempo || ''} onChange={e => updateCursoAdic(idx, 'tempo', e.target.value.toUpperCase())}
                          placeholder="Ex: 40H, 3 MESES, 1 ANO"
                          style={{ textTransform: 'uppercase' }}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-400" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ===== CAMPO LIVRE ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-1">📝 Informações adicionais (opcional)</h2>
            <textarea value={form.experiencia_texto} onChange={e => setForm({ ...form, experiencia_texto: e.target.value })}
              rows={3} placeholder="Idiomas, disponibilidade de horário, CNH, etc…"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
          </section>

          <button type="submit" disabled={enviando}
            className={`w-full py-4 rounded-xl font-bold text-white text-base shadow-md ${enviando ? 'bg-gray-400' : 'bg-gradient-to-r from-rose-500 to-pink-600 hover:shadow-lg hover:scale-[1.01]'} transition`}>
            {enviando ? 'Enviando…' : '🚀 Enviar currículo'}
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-500 mt-4">Prevenção no Radar · Banco de Currículos</p>
      </div>
    </div>
  );
}

// Campos de texto convertem automaticamente pra MAIUSCULA (padrao do sistema).
// Use caseSensitive={true} pra email, instagram, whatsapp etc.
function Field({ label, value, onChange, type = 'text', placeholder, caseSensitive = false }) {
  const shouldUpper = !caseSensitive && (type === 'text' || type === undefined);
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">{label}</label>
      <input type={type} value={value || ''}
        onChange={e => onChange(shouldUpper ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder}
        style={shouldUpper ? { textTransform: 'uppercase' } : undefined}
        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
    </div>
  );
}
function FieldReq({ label, value, onChange, type = 'text', placeholder, caseSensitive = false }) {
  const shouldUpper = !caseSensitive && (type === 'text' || type === undefined);
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">{label} <span className="text-red-500">*</span></label>
      <input type={type} value={value || ''}
        onChange={e => onChange(shouldUpper ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder} required
        style={shouldUpper ? { textTransform: 'uppercase' } : undefined}
        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
    </div>
  );
}
