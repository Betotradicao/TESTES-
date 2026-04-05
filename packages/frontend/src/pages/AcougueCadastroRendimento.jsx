import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const emptyItem = () => ({ nome_corte: '', codigo_produto: '', percentual: '', preco_venda: '', vende: true });

export default function AcougueCadastroRendimento() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [itens, setItens] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/acougue/templates');
      setTemplates(res.data);
    } catch (err) {
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setNome('');
    setDescricao('');
    setItens([emptyItem()]);
    setShowModal(true);
  };

  const openEdit = async (id) => {
    try {
      const res = await api.get(`/acougue/templates/${id}`);
      const t = res.data;
      setEditingId(t.id);
      setNome(t.nome);
      setDescricao(t.descricao || '');
      setItens(
        t.itens.map((i) => ({
          nome_corte: i.nome_corte,
          codigo_produto: i.codigo_produto || '',
          percentual: parseFloat(i.percentual),
          preco_venda: i.preco_venda ? parseFloat(i.preco_venda) : '',
          vende: i.vende,
        }))
      );
      setShowModal(true);
    } catch (err) {
      toast.error('Erro ao carregar template');
    }
  };

  const addItem = () => setItens([...itens, emptyItem()]);

  const removeItem = (idx) => {
    if (itens.length <= 1) return;
    setItens(itens.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    const updated = [...itens];
    updated[idx] = { ...updated[idx], [field]: value };
    setItens(updated);
  };

  const totalPct = itens.reduce((sum, i) => sum + (parseFloat(i.percentual) || 0), 0);

  const handleSave = async () => {
    if (!nome.trim()) return toast.error('Informe o nome do template');
    if (itens.length === 0) return toast.error('Adicione pelo menos um corte');
    if (itens.some((i) => !i.nome_corte.trim())) return toast.error('Todos os cortes devem ter nome');
    if (itens.some((i) => !i.percentual || parseFloat(i.percentual) <= 0)) return toast.error('Todos os cortes devem ter percentual > 0');
    if (Math.abs(totalPct - 100) > 0.5) return toast.error(`Percentuais somam ${totalPct.toFixed(2)}%. Devem somar 100%.`);

    setSaving(true);
    try {
      const body = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        itens: itens.map((i) => ({
          nome_corte: i.nome_corte.trim(),
          codigo_produto: i.codigo_produto?.trim() || null,
          percentual: parseFloat(i.percentual),
          preco_venda: i.preco_venda ? parseFloat(i.preco_venda) : null,
          vende: i.vende,
        })),
      };
      if (editingId) {
        await api.put(`/acougue/templates/${editingId}`, body);
        toast.success('Template atualizado!');
      } else {
        await api.post('/acougue/templates', body);
        toast.success('Template criado!');
      }
      setShowModal(false);
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nome) => {
    if (!window.confirm(`Remover template "${nome}"?`)) return;
    try {
      await api.delete(`/acougue/templates/${id}`);
      toast.success('Template removido');
      fetchTemplates();
    } catch (err) {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="lg:hidden text-white mr-2" onClick={() => setIsMobileMenuOpen(true)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <span className="text-3xl">🥩</span>
              <div>
                <h1 className="text-2xl font-bold text-white">Cadastro de Rendimento - Acougue</h1>
                <p className="text-orange-100 text-sm">Gerencie templates de desmembramento de carcacas</p>
              </div>
            </div>
            <button onClick={openNew} className="bg-white text-orange-600 font-semibold px-4 py-2 rounded-lg hover:bg-orange-50 transition">
              + Novo Template
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-20"><RadarLoading size="lg" message="Carregando templates..." /></div>
          ) : templates.length === 0 ? (
            <div className="text-center text-gray-400 py-20">
              <p className="text-xl mb-2">Nenhum template cadastrado</p>
              <p className="text-sm">Clique em "+ Novo Template" para comecar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <div key={t.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-orange-500 transition cursor-pointer" onClick={() => openEdit(t.id)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">{t.nome}</h3>
                      {t.descricao && <p className="text-gray-400 text-sm mt-1">{t.descricao}</p>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.nome); }}
                      className="text-gray-500 hover:text-red-400 transition p-1"
                      title="Remover"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  <div className="flex gap-4 mt-4 text-sm">
                    <div className="bg-gray-700 rounded-lg px-3 py-2 text-center flex-1">
                      <p className="text-gray-400">Cortes</p>
                      <p className="text-white font-bold text-lg">{t.total_cortes}</p>
                    </div>
                    <div className="bg-gray-700 rounded-lg px-3 py-2 text-center flex-1">
                      <p className="text-gray-400">Total %</p>
                      <p className={`font-bold text-lg ${Math.abs(parseFloat(t.total_percentual || 0) - 100) < 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(t.total_percentual || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-auto">
            <div className="bg-gray-800 rounded-xl w-full max-w-4xl my-8 border border-gray-700 shadow-2xl">
              {/* Modal header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">{editingId ? 'Editar Template' : 'Novo Template'}</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-auto">
                {/* Nome e descricao */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Nome do Template *</label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: BOI CASADA"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Descricao (opcional)</label>
                    <input
                      type="text"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descricao do template"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Tabela de cortes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400 font-semibold">Cortes do Template</label>
                    <button onClick={addItem} className="text-orange-400 hover:text-orange-300 text-sm font-semibold">+ Adicionar Corte</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-600 text-gray-200">
                          <th className="px-3 py-2 text-left rounded-tl-lg">Nome do Corte *</th>
                          <th className="px-3 py-2 text-left">Cod. Produto</th>
                          <th className="px-3 py-2 text-center">% Rendimento *</th>
                          <th className="px-3 py-2 text-center">Preco Venda R$/KG</th>
                          <th className="px-3 py-2 text-center">Vende?</th>
                          <th className="px-3 py-2 text-center rounded-tr-lg">Acao</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-700">
                            <td className="px-2 py-1">
                              <input
                                type="text"
                                value={item.nome_corte}
                                onChange={(e) => updateItem(idx, 'nome_corte', e.target.value)}
                                placeholder="Ex: PICANHA"
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:border-orange-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="text"
                                value={item.codigo_produto}
                                onChange={(e) => updateItem(idx, 'codigo_produto', e.target.value)}
                                placeholder="Opcional"
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:border-orange-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.percentual}
                                onChange={(e) => updateItem(idx, 'percentual', e.target.value)}
                                placeholder="0.00"
                                className="w-24 mx-auto block bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm text-center focus:border-orange-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.preco_venda}
                                onChange={(e) => updateItem(idx, 'preco_venda', e.target.value)}
                                placeholder="0.00"
                                className="w-28 mx-auto block bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm text-center focus:border-orange-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                checked={item.vende}
                                onChange={(e) => updateItem(idx, 'vende', e.target.checked)}
                                className="w-4 h-4 rounded accent-orange-500"
                              />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <button
                                onClick={() => removeItem(idx)}
                                disabled={itens.length <= 1}
                                className="text-gray-500 hover:text-red-400 disabled:opacity-30 transition"
                                title="Remover corte"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals bar */}
                  <div className={`flex items-center justify-between mt-3 px-4 py-2 rounded-lg ${Math.abs(totalPct - 100) < 0.5 ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                    <span className="text-sm font-semibold">Total Percentual:</span>
                    <span className={`text-lg font-bold ${Math.abs(totalPct - 100) < 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                      {totalPct.toFixed(2)}%
                    </span>
                  </div>
                  {Math.abs(totalPct - 100) >= 0.5 && (
                    <p className="text-red-400 text-xs mt-1">Os percentuais devem somar 100%. Diferenca: {(totalPct - 100).toFixed(2)}%</p>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-500 disabled:opacity-50 transition"
                >
                  {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
