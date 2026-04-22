import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLoja } from '../../contexts/LojaContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';

export default function ChecklistArvoreConhecimento() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [setores, setSetores] = useState([]);
  const [setorId, setSetorId] = useState('');

  const [abas, setAbas] = useState([]);
  const [abaAtivaId, setAbaAtivaId] = useState(null);

  const [notas, setNotas] = useState([]);
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [notaEditar, setNotaEditar] = useState(null); // nota sendo criada/editada no modal

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const flash = (txt) => { setSucesso(txt); setTimeout(() => setSucesso(''), 2500); };

  useEffect(() => {
    (async () => {
      try {
        const qs = lojaSelecionada != null ? `?cod_loja=${lojaSelecionada}` : '';
        const r = await api.get(`/checklist/setores${qs}`);
        setSetores(r.data?.setores || []);
      } catch (e) { setErro(e?.response?.data?.error || e.message); }
    })();
  }, [lojaSelecionada]);

  // Ao trocar setor, carrega abas
  useEffect(() => {
    if (!setorId) { setAbas([]); setAbaAtivaId(null); return; }
    (async () => {
      try {
        const r = await api.get(`/arvore-conhecimento/abas?setor_id=${setorId}`);
        const lista = r.data?.abas || [];
        setAbas(lista);
        setAbaAtivaId(lista[0]?.id || null);
      } catch (e) { setErro(e?.response?.data?.error || e.message); }
    })();
  }, [setorId]);

  // Ao trocar aba, carrega notas
  useEffect(() => {
    if (!abaAtivaId) { setNotas([]); return; }
    carregarNotas(abaAtivaId);
  }, [abaAtivaId]);

  const carregarNotas = async (abaId) => {
    setLoadingNotas(true);
    try {
      const r = await api.get(`/arvore-conhecimento/notas?aba_id=${abaId}`);
      setNotas(r.data?.notas || []);
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
    finally { setLoadingNotas(false); }
  };

  const criarAba = async () => {
    const nome = window.prompt('Nome da nova aba (ex: SISTEMA, PLANILHA DE PONTO, BANCO DE HORAS):');
    if (!nome?.trim()) return;
    try {
      const r = await api.post('/arvore-conhecimento/abas', {
        setor_id: parseInt(setorId), nome: nome.trim().toUpperCase(), cod_loja: lojaSelecionada ?? null,
      });
      const nova = r.data?.aba;
      setAbas(a => [...a, nova]);
      setAbaAtivaId(nova.id);
      flash('Aba criada');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const renomearAba = async (aba) => {
    const novo = window.prompt('Novo nome:', aba.nome);
    if (!novo?.trim() || novo.trim() === aba.nome) return;
    try {
      await api.put(`/arvore-conhecimento/abas/${aba.id}`, { nome: novo.trim().toUpperCase() });
      setAbas(a => a.map(x => x.id === aba.id ? { ...x, nome: novo.trim().toUpperCase() } : x));
      flash('Aba renomeada');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const deletarAba = async (aba) => {
    if (!window.confirm(`Excluir a aba "${aba.nome}" e TODAS as notas dentro dela?`)) return;
    try {
      await api.delete(`/arvore-conhecimento/abas/${aba.id}`);
      const resto = abas.filter(x => x.id !== aba.id);
      setAbas(resto);
      if (abaAtivaId === aba.id) setAbaAtivaId(resto[0]?.id || null);
      flash('Aba excluída');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const abrirNovaNota = () => {
    if (!abaAtivaId) return;
    setNotaEditar({ aba_id: abaAtivaId, titulo: '', conteudo: '', anexos: [] });
  };

  const editarNota = (nota) => setNotaEditar({ ...nota });

  const deletarNota = async (nota) => {
    if (!window.confirm(`Excluir a nota "${nota.titulo}"?`)) return;
    try {
      await api.delete(`/arvore-conhecimento/notas/${nota.id}`);
      setNotas(ns => ns.filter(n => n.id !== nota.id));
      flash('Nota excluída');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 min-w-0 overflow-auto overflow-x-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">🌳 Árvore do Conhecimento</h1>
              <p className="text-xs sm:text-sm opacity-90">Mapeamento de procedimentos por setor com evidências</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex justify-between items-center"><span>{erro}</span><button onClick={() => setErro('')} className="text-red-600 hover:text-red-800 font-bold">×</button></div>}
          {sucesso && <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-sm">{sucesso}</div>}

          {/* Filtro de Setor */}
          <div className="bg-white border-2 border-gray-100 rounded-xl p-4 shadow-sm mb-4">
            <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">🗂️ Selecione o Setor</label>
            <select value={setorId} onChange={e => setSetorId(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500">
              <option value="">— escolha um setor —</option>
              {setores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {setores.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Nenhum setor cadastrado. Vá em <strong>Configurações → Setores</strong> primeiro.
              </p>
            )}
          </div>

          {/* Abas do setor selecionado */}
          {setorId && (
            <div className="bg-white border-2 border-gray-100 rounded-xl shadow-sm mb-4">
              <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 p-2">
                {abas.map(a => (
                  <div key={a.id} className={`group flex items-center rounded-lg overflow-hidden ${abaAtivaId === a.id ? 'bg-teal-500' : 'bg-gray-100'}`}>
                    <button onClick={() => setAbaAtivaId(a.id)}
                      className={`px-3 py-2 text-xs font-semibold ${abaAtivaId === a.id ? 'text-white' : 'text-gray-700 hover:text-gray-900'}`}>
                      {a.nome}
                    </button>
                    {abaAtivaId === a.id && (
                      <div className="flex border-l border-white/30">
                        <button onClick={() => renomearAba(a)} className="px-1.5 text-white/80 hover:text-white text-xs" title="Renomear">✏️</button>
                        <button onClick={() => deletarAba(a)} className="px-1.5 text-white/80 hover:text-white text-xs" title="Excluir">🗑️</button>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={criarAba}
                  className="shrink-0 px-3 py-2 text-xs font-bold text-teal-600 border-2 border-dashed border-teal-300 rounded-lg hover:bg-teal-50">
                  + Nova aba
                </button>
              </div>

              {/* Conteúdo da aba */}
              <div className="p-4">
                {!abaAtivaId ? (
                  <div className="text-sm text-gray-400 italic text-center py-8">
                    Crie uma aba pra começar (ex: "SISTEMA", "PLANILHA DE PONTO", "BANCO DE HORAS")
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-sm text-gray-600">
                        {loadingNotas ? 'Carregando…' : `${notas.length} nota(s)`}
                      </div>
                      <button onClick={abrirNovaNota}
                        className="text-sm px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg font-bold hover:shadow-lg transition">
                        + Nova nota
                      </button>
                    </div>

                    {notas.length === 0 && !loadingNotas ? (
                      <div className="text-sm text-gray-400 italic text-center py-10 border-2 border-dashed rounded-lg">
                        Nenhuma nota nesta aba ainda. Clique em "+ Nova nota" pra começar.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {notas.map(n => (
                          <NotaCard key={n.id} nota={n} onEditar={editarNota} onDeletar={deletarNota} onAbrirLightbox={setLightbox} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!setorId && (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
              <div className="text-5xl mb-2">🌳</div>
              <div className="text-gray-600 font-semibold">Selecione um setor acima pra começar.</div>
              <div className="text-xs text-gray-400 mt-1">Cada setor tem suas próprias abas e notas de procedimentos.</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de edição da nota */}
      {notaEditar && (
        <NotaModal
          nota={notaEditar}
          onFechar={() => setNotaEditar(null)}
          onSalva={async () => {
            await carregarNotas(abaAtivaId);
            setNotaEditar(null);
            flash('Nota salva');
          }}
          onErro={(e) => setErro(e)}
        />
      )}

      {/* Lightbox de imagem */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

// -------- Componente: Card de Nota --------
function NotaCard({ nota, onEditar, onDeletar, onAbrirLightbox }) {
  const anexos = Array.isArray(nota.anexos) ? nota.anexos : [];
  const imagens = anexos.filter(a => a.tipo === 'imagem');
  const outros = anexos.filter(a => a.tipo !== 'imagem');

  return (
    <div className="bg-white border-2 border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-bold text-gray-800 flex-1">📝 {nota.titulo}</h4>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEditar(nota)} className="text-xs text-teal-600 hover:text-teal-800" title="Editar">✏️</button>
          <button onClick={() => onDeletar(nota)} className="text-xs text-red-500 hover:text-red-700" title="Excluir">🗑️</button>
        </div>
      </div>
      {nota.conteudo && (
        <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-6 mb-2">{nota.conteudo}</p>
      )}
      {imagens.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {imagens.slice(0, 4).map((a) => (
            <button key={a.id} type="button" onClick={() => onAbrirLightbox(a.url)}
              className="w-16 h-16 rounded border hover:border-teal-400 overflow-hidden">
              <img src={a.url} alt={a.nome_original || ''} className="w-full h-full object-cover" />
            </button>
          ))}
          {imagens.length > 4 && (
            <div className="w-16 h-16 rounded border bg-gray-50 flex items-center justify-center text-xs font-semibold text-gray-500">
              +{imagens.length - 4}
            </div>
          )}
        </div>
      )}
      {outros.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {outros.map(a => (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] px-2 py-1 rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200 transition">
              {a.tipo === 'pdf' ? '📕' : a.tipo === 'video' ? '🎥' : a.tipo === 'youtube' ? '▶️' : a.tipo === 'link' ? '🔗' : '📎'} {a.nome_original || a.url.substring(0, 25)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// -------- Componente: Modal de edição de Nota --------
function NotaModal({ nota, onFechar, onSalva, onErro }) {
  const [titulo, setTitulo] = useState(nota.titulo || '');
  const [conteudo, setConteudo] = useState(nota.conteudo || '');
  const [anexos, setAnexos] = useState(Array.isArray(nota.anexos) ? nota.anexos : []);
  const [salvando, setSalvando] = useState(false);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const fileInputRef = useRef(null);

  const ehNova = !nota.id;

  const salvar = async () => {
    if (!titulo.trim()) { onErro('Título obrigatório'); return; }
    setSalvando(true);
    try {
      let notaId = nota.id;
      if (ehNova) {
        const r = await api.post('/arvore-conhecimento/notas', {
          aba_id: nota.aba_id, titulo, conteudo,
        });
        notaId = r.data?.nota?.id;
      } else {
        await api.put(`/arvore-conhecimento/notas/${nota.id}`, { titulo, conteudo });
      }
      onSalva(notaId);
    } catch (e) { onErro(e?.response?.data?.error || e.message); }
    finally { setSalvando(false); }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Precisa que a nota exista antes de subir anexo
    if (!nota.id) {
      onErro('Salve o título da nota antes de adicionar anexos.');
      return;
    }
    setUploadingAnexo(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('arquivo', file);
        fd.append('nota_id', String(nota.id));
        const r = await api.post('/arvore-conhecimento/anexos/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (r.data?.anexo) setAnexos(a => [...a, r.data.anexo]);
      }
    } catch (err) {
      onErro(err?.response?.data?.error || err.message);
    } finally {
      setUploadingAnexo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const adicionarLink = async () => {
    const url = window.prompt('URL (YouTube, Drive, site, etc):');
    if (!url?.trim()) return;
    if (!nota.id) { onErro('Salve o título da nota antes de adicionar anexos.'); return; }
    const nome = window.prompt('Nome/descrição (opcional):', '') || null;
    try {
      const r = await api.post('/arvore-conhecimento/anexos/link', {
        nota_id: nota.id, url: url.trim(), nome_original: nome,
      });
      if (r.data?.anexo) setAnexos(a => [...a, r.data.anexo]);
    } catch (err) { onErro(err?.response?.data?.error || err.message); }
  };

  const removerAnexo = async (anexoId) => {
    if (!window.confirm('Remover este anexo?')) return;
    try {
      await api.delete(`/arvore-conhecimento/anexos/${anexoId}`);
      setAnexos(a => a.filter(x => x.id !== anexoId));
    } catch (err) { onErro(err?.response?.data?.error || err.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white p-4 flex items-center justify-between">
          <h3 className="font-bold">📝 {ehNova ? 'Nova nota' : 'Editar nota'}</h3>
          <button onClick={onFechar} className="text-white/80 hover:text-white text-xl">×</button>
        </div>

        <div className="p-4 overflow-auto space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Como abrir caixa no sistema"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Conteúdo / descrição</label>
            <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} rows={6}
              placeholder="Passo a passo, dicas, alertas…"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
          </div>

          {/* Anexos */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase text-gray-500">Anexos ({anexos.length})</label>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAnexo || ehNova}
                  className={`text-xs px-3 py-1 rounded font-bold ${ehNova ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-teal-500 text-white hover:bg-teal-600'}`}
                  title={ehNova ? 'Salve o título primeiro' : ''}>
                  {uploadingAnexo ? '…' : '📎 Arquivo'}
                </button>
                <button type="button" onClick={adicionarLink} disabled={ehNova}
                  className={`text-xs px-3 py-1 rounded font-bold ${ehNova ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}
                  title={ehNova ? 'Salve o título primeiro' : ''}>
                  🔗 Link / YouTube
                </button>
              </div>
            </div>
            {ehNova && (
              <p className="text-[11px] text-gray-500 italic mb-2">
                Salve o título primeiro pra habilitar os anexos.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {anexos.map(a => (
                <div key={a.id} className="relative">
                  {a.tipo === 'imagem' ? (
                    <img src={a.url} alt="" className="w-20 h-20 rounded border object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded border bg-slate-50 flex flex-col items-center justify-center p-1 text-center">
                      <div className="text-2xl">{a.tipo === 'pdf' ? '📕' : a.tipo === 'video' ? '🎥' : a.tipo === 'youtube' ? '▶️' : a.tipo === 'link' ? '🔗' : '📎'}</div>
                      <div className="text-[9px] text-gray-600 truncate w-full">{a.nome_original || a.tipo}</div>
                    </div>
                  )}
                  <button type="button" onClick={() => removerAnexo(a.id)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs font-bold shadow">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t bg-gray-50 flex justify-end gap-2">
          <button onClick={onFechar} className="text-sm px-4 py-2 border-2 border-gray-200 rounded-lg font-semibold hover:bg-gray-100">
            Fechar
          </button>
          <button onClick={salvar} disabled={salvando}
            className={`text-sm px-4 py-2 rounded-lg font-bold text-white ${salvando ? 'bg-gray-400' : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:shadow-lg'}`}>
            {salvando ? 'Salvando…' : (ehNova ? 'Criar nota' : 'Salvar alterações')}
          </button>
        </div>
      </div>
    </div>
  );
}
