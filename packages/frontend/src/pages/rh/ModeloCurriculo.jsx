import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';

export default function ModeloCurriculo() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cargos, setCargos] = useState([]);
  const [habilidades, setHabilidades] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const flash = (t) => { setSucesso(t); setTimeout(() => setSucesso(''), 2000); };

  const linkPublico = `${window.location.origin}/curriculo`;

  const carregar = async () => {
    try {
      const [c, h] = await Promise.all([
        api.get('/curriculos/cargos'),
        api.get('/curriculos/habilidades'),
      ]);
      setCargos(c.data?.cargos || []);
      setHabilidades(h.data?.habilidades || []);
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  useEffect(() => { carregar(); }, []);

  const adicionar = async (tipo) => {
    const nome = window.prompt(tipo === 'cargo' ? 'Novo cargo (ex: REPOSITOR, BALCONISTA):' : 'Nova habilidade (ex: ATENDIMENTO AO CLIENTE):');
    if (!nome?.trim()) return;
    try {
      const url = tipo === 'cargo' ? '/curriculos/cargos' : '/curriculos/habilidades';
      await api.post(url, { nome: nome.trim() });
      await carregar();
      flash(`${tipo === 'cargo' ? 'Cargo' : 'Habilidade'} adicionado`);
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const renomear = async (tipo, item) => {
    const novo = window.prompt('Novo nome:', item.nome);
    if (!novo?.trim() || novo.trim().toUpperCase() === item.nome) return;
    try {
      const url = tipo === 'cargo' ? `/curriculos/cargos/${item.id}` : `/curriculos/habilidades/${item.id}`;
      await api.put(url, { nome: novo.trim() });
      await carregar();
      flash('Renomeado');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const toggleAtivo = async (tipo, item) => {
    try {
      const url = tipo === 'cargo' ? `/curriculos/cargos/${item.id}` : `/curriculos/habilidades/${item.id}`;
      await api.put(url, { ativo: !item.ativo });
      await carregar();
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const deletar = async (tipo, item) => {
    if (!window.confirm(`Excluir "${item.nome}"?`)) return;
    try {
      const url = tipo === 'cargo' ? `/curriculos/cargos/${item.id}` : `/curriculos/habilidades/${item.id}`;
      await api.delete(url);
      await carregar();
      flash('Removido');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const copiarLink = async () => {
    try { await navigator.clipboard.writeText(linkPublico); flash('Link copiado!'); }
    catch { setErro('Nao foi possivel copiar. Selecione o link manualmente.'); }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 min-w-0 overflow-auto overflow-x-hidden">
        <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">📝 Modelo de Currículo</h1>
              <p className="text-xs sm:text-sm opacity-90">Configure cargos, habilidades e gere o link público</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
          {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex justify-between"><span>{erro}</span><button onClick={() => setErro('')} className="font-bold">×</button></div>}
          {sucesso && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-sm">{sucesso}</div>}

          {/* Link público */}
          <div className="bg-white border-2 border-pink-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xl">🔗</span>
              <h3 className="font-bold text-gray-800">Link público do currículo</h3>
              <span className="text-[10px] bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full font-semibold uppercase">Envie no WhatsApp dos candidatos</span>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Qualquer pessoa com este link consegue preencher o formulário. O currículo cai direto no Banco de Currículos pra você avaliar.
            </p>
            <div className="flex gap-2 items-center bg-gray-50 border-2 border-gray-200 rounded-lg p-2">
              <input type="text" value={linkPublico} readOnly className="flex-1 bg-transparent text-sm font-mono text-gray-700 outline-none" />
              <button onClick={copiarLink} className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg text-sm font-bold hover:shadow-md">
                📋 Copiar
              </button>
              <a href={linkPublico} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white border-2 border-pink-300 text-pink-600 rounded-lg text-sm font-bold hover:bg-pink-50">
                👁️ Visualizar
              </a>
            </div>
          </div>

          {/* Cargos */}
          <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xl">💼</span>
              <h3 className="font-bold text-gray-800">Cargos (experiências como)</h3>
              <span className="text-xs text-gray-500 ml-1">{cargos.length} item(s)</span>
              <button onClick={() => adicionar('cargo')} className="ml-auto text-sm px-3 py-1 bg-rose-500 text-white rounded-lg font-bold hover:bg-rose-600">
                + Adicionar
              </button>
            </div>
            {cargos.length === 0 ? (
              <div className="text-sm text-gray-400 italic text-center py-4">Nenhum cargo cadastrado. Adicione o primeiro.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cargos.map(c => (
                  <div key={c.id} className={`group flex items-center gap-1 border-2 rounded-full pl-3 pr-1 py-1 ${c.ativo ? 'border-rose-300 bg-rose-50' : 'border-gray-200 bg-gray-100 opacity-60'}`}>
                    <span className="text-xs font-semibold text-gray-700">{c.nome}</span>
                    <button onClick={() => toggleAtivo('cargo', c)} className="text-[10px] text-gray-500 hover:text-gray-700 px-1" title={c.ativo ? 'Desativar' : 'Ativar'}>
                      {c.ativo ? '✓' : '○'}
                    </button>
                    <button onClick={() => renomear('cargo', c)} className="text-[10px] text-gray-500 hover:text-gray-700 px-1" title="Renomear">✏️</button>
                    <button onClick={() => deletar('cargo', c)} className="text-[10px] text-red-500 hover:text-red-700 px-1" title="Excluir">🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Habilidades */}
          <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xl">🔧</span>
              <h3 className="font-bold text-gray-800">Habilidades (experiências práticas)</h3>
              <span className="text-xs text-gray-500 ml-1">{habilidades.length} item(s)</span>
              <button onClick={() => adicionar('habilidade')} className="ml-auto text-sm px-3 py-1 bg-indigo-500 text-white rounded-lg font-bold hover:bg-indigo-600">
                + Adicionar
              </button>
            </div>
            {habilidades.length === 0 ? (
              <div className="text-sm text-gray-400 italic text-center py-4">Nenhuma habilidade cadastrada. Adicione a primeira.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {habilidades.map(h => (
                  <div key={h.id} className={`group flex items-center gap-1 border-2 rounded-full pl-3 pr-1 py-1 ${h.ativo ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-100 opacity-60'}`}>
                    <span className="text-xs font-semibold text-gray-700">{h.nome}</span>
                    <button onClick={() => toggleAtivo('habilidade', h)} className="text-[10px] text-gray-500 hover:text-gray-700 px-1" title={h.ativo ? 'Desativar' : 'Ativar'}>
                      {h.ativo ? '✓' : '○'}
                    </button>
                    <button onClick={() => renomear('habilidade', h)} className="text-[10px] text-gray-500 hover:text-gray-700 px-1" title="Renomear">✏️</button>
                    <button onClick={() => deletar('habilidade', h)} className="text-[10px] text-red-500 hover:text-red-700 px-1" title="Excluir">🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-xs text-blue-800">
            💡 <strong>Dica:</strong> quanto mais específicas forem as habilidades e cargos, mais fácil filtrar os candidatos depois.
          </div>
        </div>
      </div>
    </div>
  );
}
