import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import RadarLoading from '../components/RadarLoading';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

export default function CadastroContas() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [arvore, setArvore] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expanded, setExpanded] = useState({}); // grupoId -> bool

  // Modal de criar/editar
  const [modal, setModal] = useState(null); // { mode:'novoGrupo'|'novaConta'|'editar', tipo, parentId, id, nome, is_receita }

  // Seleção múltipla de contas (checkbox)
  const [selected, setSelected] = useState(() => new Set());
  const toggleSel = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const codLojaParam = () => (lojaSelecionada ? `?codLoja=${lojaSelecionada}` : '');
  const bodyLoja = () => (lojaSelecionada ? { cod_loja: Number(lojaSelecionada) } : {});

  const carregar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/plano-contas${codLojaParam()}`);
      const data = res.data?.data || [];
      setArvore(data);
      // Expande tudo por padrão na primeira carga
      setExpanded(prev => {
        const next = { ...prev };
        for (const g of data) if (next[g.id] === undefined) next[g.id] = true;
        return next;
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar plano de contas');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [lojaSelecionada]);

  useEffect(() => { carregar(); }, [carregar]);

  const importar = async () => {
    if (!confirm('Importar o plano de contas atual do sistema (ERP)? Isso cria os grupos e contas que ainda não existem. Pode rodar de novo sem duplicar.')) return;
    setImporting(true);
    try {
      const res = await api.post('/plano-contas/importar', bodyLoja());
      if (res.data?.success) {
        toast.success(`Importado: ${res.data.gruposCriados} grupos, ${res.data.contasCriadas} contas`);
        await carregar();
      } else {
        toast.error(res.data?.message || 'Falha ao importar');
      }
    } catch (err) {
      toast.error('Erro ao importar do sistema');
    } finally {
      setImporting(false);
    }
  };

  const salvarModal = async () => {
    const nome = (modal.nome || '').trim();
    if (!nome) return toast.error('Informe o nome');
    try {
      if (modal.mode === 'editar') {
        await api.put(`/plano-contas/${modal.id}`, { nome, is_receita: modal.is_receita });
        toast.success('Salvo!');
      } else if (modal.mode === 'novoGrupo') {
        await api.post('/plano-contas', { ...bodyLoja(), tipo: 'grupo', nome, is_receita: !!modal.is_receita });
        toast.success('Grupo criado!');
      } else if (modal.mode === 'novaConta') {
        await api.post('/plano-contas', { ...bodyLoja(), tipo: 'conta', parent_id: modal.parentId, nome });
        toast.success('Conta criada!');
      }
      setModal(null);
      await carregar(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    }
  };

  // Exclui um conjunto de ids, atualizando a lista localmente (mantém o scroll)
  const excluirIds = async (ids, confirmMsg) => {
    if (!ids.length) return;
    if (!confirm(confirmMsg)) return;
    try {
      await Promise.all(ids.map(id => api.delete(`/plano-contas/${id}`)));
      const idSet = new Set(ids);
      setArvore(prev => prev
        .filter(g => !idSet.has(g.id))
        .map(g => ({ ...g, contas: (g.contas || []).filter(c => !idSet.has(c.id)) }))
      );
      setSelected(prev => { const n = new Set(prev); ids.forEach(i => n.delete(i)); return n; });
      toast.success(ids.length > 1 ? `${ids.length} itens excluídos!` : 'Excluído!');
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  };

  const excluir = (item, isGrupo) => {
    // Conta + seleção ativa: exclui todas as selecionadas + a clicada
    if (!isGrupo && selected.size > 0) {
      const ids = Array.from(new Set([...selected, item.id]));
      return excluirIds(ids, `Excluir ${ids.length} contas selecionadas?`);
    }
    const msg = isGrupo
      ? `Excluir o grupo "${item.nome}" e TODAS as suas contas?`
      : `Excluir a conta "${item.nome}"?`;
    return excluirIds([item.id], msg);
  };

  const excluirSelecionados = () => {
    const ids = Array.from(selected);
    excluirIds(ids, `Excluir ${ids.length} conta(s) selecionada(s)?`);
  };

  const totalGrupos = arvore.length;
  const totalContas = arvore.reduce((s, g) => s + (g.contas?.length || 0), 0);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <main className="flex-1 overflow-auto">
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-wide">CADASTRO DE CONTAS</h1>
              <p className="text-orange-100 text-sm mt-0.5">Plano de contas manual para a Conciliação (modo Direto Manual)</p>
            </div>
            <button className="md:hidden p-2 rounded-lg bg-orange-700/50" onClick={() => setIsMobileMenuOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-3 md:p-6 max-w-4xl mx-auto">
          {/* Barra de ações */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={importar}
              disabled={importing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              title="Puxa o plano de contas atual do ERP"
            >
              {importing ? 'Importando...' : '⬇️ Importar Plano Atual'}
            </button>
            <button
              onClick={() => setModal({ mode: 'novoGrupo', nome: '', is_receita: false })}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 flex items-center gap-2"
            >
              ＋ Novo Grupo
            </button>
            {selected.size > 0 && (
              <button
                onClick={excluirSelecionados}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 flex items-center gap-2"
              >
                🗑️ Excluir selecionados ({selected.size})
              </button>
            )}
            <div className="ml-auto text-sm text-gray-500">
              {totalGrupos} grupos · {totalContas} contas
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><RadarLoading /></div>
          ) : arvore.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-400">
              <p className="text-lg font-medium mb-2">Nenhuma conta cadastrada ainda</p>
              <p className="text-sm">Clique em <b>Importar Plano Atual</b> para trazer o plano do sistema, ou <b>Novo Grupo</b> para começar do zero.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {arvore.map(grupo => (
                <div key={grupo.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Cabeçalho do grupo */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 ${grupo.is_receita ? 'bg-green-50' : 'bg-red-50'}`}>
                    <button onClick={() => setExpanded(e => ({ ...e, [grupo.id]: !e[grupo.id] }))} className="text-gray-500 hover:text-gray-700 w-5">
                      {expanded[grupo.id] ? '▾' : '▸'}
                    </button>
                    <span className={`font-bold text-sm ${grupo.is_receita ? 'text-green-800' : 'text-red-800'}`}>{grupo.nome}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${grupo.is_receita ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {grupo.is_receita ? 'RECEITA' : 'DESPESA'}
                    </span>
                    <span className="text-xs text-gray-400">({grupo.contas?.length || 0})</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => setModal({ mode: 'novaConta', parentId: grupo.id, nome: '' })} className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 font-semibold">＋ Conta</button>
                      <button onClick={() => setModal({ mode: 'editar', id: grupo.id, nome: grupo.nome, is_receita: grupo.is_receita, isGrupo: true })} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">✏️</button>
                      <button onClick={() => excluir(grupo, true)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">🗑️</button>
                    </div>
                  </div>
                  {/* Contas */}
                  {expanded[grupo.id] && (
                    <div className="divide-y divide-gray-100">
                      {(grupo.contas || []).length === 0 ? (
                        <div className="px-10 py-2 text-xs text-gray-400 italic">Sem contas neste grupo</div>
                      ) : grupo.contas.map(conta => (
                        <div key={conta.id} className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 ${selected.has(conta.id) ? 'bg-red-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selected.has(conta.id)}
                            onChange={() => toggleSel(conta.id)}
                            className="w-4 h-4 accent-orange-600 cursor-pointer flex-shrink-0"
                          />
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-700">{conta.nome}</span>
                          <div className="ml-auto flex items-center gap-1">
                            <button onClick={() => setModal({ mode: 'editar', id: conta.id, nome: conta.nome, is_receita: conta.is_receita })} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">✏️</button>
                            <button onClick={() => excluir(conta, false)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal criar/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-5 py-3 rounded-t-xl font-bold">
              {modal.mode === 'novoGrupo' ? 'Novo Grupo' : modal.mode === 'novaConta' ? 'Nova Conta' : 'Editar'}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome</label>
                <input
                  autoFocus
                  value={modal.nome}
                  onChange={e => setModal(m => ({ ...m, nome: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && salvarModal()}
                  placeholder={modal.mode === 'novaConta' ? 'Ex: Receita à Vista (Dinheiro)' : 'Ex: Receitas de Vendas'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              {/* Receita/Despesa só pra grupo (conta herda do grupo) */}
              {(modal.mode === 'novoGrupo' || (modal.mode === 'editar' && modal.isGrupo)) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-300 w-fit">
                    <button onClick={() => setModal(m => ({ ...m, is_receita: true }))} className={`px-4 py-1.5 text-sm font-semibold ${modal.is_receita ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}>Receita</button>
                    <button onClick={() => setModal(m => ({ ...m, is_receita: false }))} className={`px-4 py-1.5 text-sm font-semibold ${!modal.is_receita ? 'bg-red-600 text-white' : 'bg-white text-gray-600'}`}>Despesa</button>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={salvarModal} className="px-5 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
