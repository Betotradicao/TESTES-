import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import { AlternativaIcon, ICON_KEYS } from './ChecklistIcons';

const ICONE_LABELS = {
  smile_green: 'Positivo',
  frown_red: 'Negativo',
  na_blue: 'N/A',
  warning_yellow: 'Alerta',
};

export default function ChecklistModelos() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ nome: '', tipo: 'icones', alternativas: [] });

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await api.get('/checklist/modelos');
      setModelos(res.data?.modelos || []);
    } catch (e) {
      setErro(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const abrirNovo = () => {
    setEditing(null);
    setFormData({
      nome: '',
      tipo: 'icones',
      alternativas: [
        { ordem: 1, icone: 'smile_green', label: 'Conforme', valor: 1 },
        { ordem: 2, icone: 'frown_red', label: 'Nao conforme', valor: -1 },
        { ordem: 3, icone: 'na_blue', label: 'N/A', valor: 0 },
        { ordem: 4, icone: 'warning_yellow', label: 'Alerta', valor: 0 },
      ],
    });
    setShowForm(true);
  };

  const abrirEdicao = (m) => {
    setEditing(m);
    setFormData({ nome: m.nome, tipo: m.tipo, alternativas: m.alternativas || [] });
    setShowForm(true);
  };

  const addAlternativa = () => {
    setFormData(fd => ({
      ...fd,
      alternativas: [...fd.alternativas, { ordem: fd.alternativas.length + 1, icone: 'smile_green', label: '', valor: 0 }],
    }));
  };

  const updateAlternativa = (idx, campo, valor) => {
    setFormData(fd => ({
      ...fd,
      alternativas: fd.alternativas.map((a, i) => i === idx ? { ...a, [campo]: valor } : a),
    }));
  };

  const removerAlternativa = (idx) => {
    setFormData(fd => ({
      ...fd,
      alternativas: fd.alternativas.filter((_, i) => i !== idx).map((a, i) => ({ ...a, ordem: i + 1 })),
    }));
  };

  const salvar = async () => {
    if (!formData.nome.trim()) { setErro('Nome obrigatório'); return; }
    if (formData.alternativas.length === 0) { setErro('Adicione pelo menos uma alternativa'); return; }
    try {
      if (editing) {
        await api.put(`/checklist/modelos/${editing.id}`, formData);
      } else {
        await api.post('/checklist/modelos', formData);
      }
      await carregar();
      setShowForm(false);
      setErro('');
    } catch (e) {
      setErro(e?.response?.data?.error || e.message);
    }
  };

  const deletar = async (id) => {
    if (!confirm('Inativar modelo?')) return;
    try {
      await api.delete(`/checklist/modelos/${id}`);
      await carregar();
    } catch (e) {
      setErro(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-auto">
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-5">
          <h1 className="text-2xl font-bold">✅ Check List no Radar — Modelos de Alternativas</h1>
          <p className="text-sm opacity-90">Conjuntos reutilizáveis de respostas (ícones, valores) usados nas perguntas</p>
        </div>

        <div className="p-6">
          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}

          {!showForm && (
            <>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-700">{modelos.length} modelos</h2>
                <button onClick={abrirNovo} className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 font-medium">
                  + Novo Modelo
                </button>
              </div>

              {loading ? (
                <div className="text-gray-500 py-10 text-center">Carregando…</div>
              ) : modelos.length === 0 ? (
                <div className="text-gray-500 py-10 text-center italic">Nenhum modelo cadastrado</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modelos.map(m => (
                    <div key={m.id} className="bg-white border rounded-lg p-4 hover:shadow-md">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-800">{m.nome}</h3>
                          <p className="text-xs text-gray-500">{(m.alternativas || []).length} alternativa(s)</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => abrirEdicao(m)} className="text-xs px-3 py-1 bg-teal-50 text-teal-700 rounded hover:bg-teal-100">Editar</button>
                          <button onClick={() => deletar(m.id)} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">🗑</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {(m.alternativas || []).map(a => (
                          <div key={a.ordem} className="flex items-center gap-2 bg-gray-50 border rounded px-2 py-1">
                            <AlternativaIcon icone={a.icone} size={24} />
                            <span className="text-xs text-gray-700">{a.label || '(sem label)'}</span>
                            <span className="text-xs text-gray-500 font-mono">{a.valor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {showForm && (
            <div className="bg-white rounded-lg border p-5 max-w-4xl">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h2 className="text-xl font-semibold text-gray-800">
                  {editing ? `Editar: ${editing.nome}` : 'Novo Modelo'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-500 hover:text-gray-700">← Voltar</button>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Modelo</label>
                <input type="text" value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Ícones Padrão"
                  className="w-full max-w-md border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>

              <div className="mb-2 flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">Alternativas</label>
                <button onClick={addAlternativa} className="text-sm px-3 py-1 bg-teal-50 text-teal-700 rounded hover:bg-teal-100">+ Adicionar</button>
              </div>

              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left w-36">Ícone</th>
                      <th className="px-3 py-2 text-left">Label</th>
                      <th className="px-3 py-2 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.alternativas.map((a, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <AlternativaIcon icone={a.icone} size={30} />
                            <select value={a.icone} onChange={e => updateAlternativa(idx, 'icone', e.target.value)}
                              className="text-xs border rounded px-1 py-1">
                              {ICON_KEYS.map(k => (
                                <option key={k} value={k}>{ICONE_LABELS[k] || k}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={a.label || ''} onChange={e => updateAlternativa(idx, 'label', e.target.value)}
                            placeholder="Ex: Conforme"
                            className="w-full border rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removerAlternativa(idx)} className="text-red-500 hover:text-red-700">🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                💡 O <strong>peso/valor</strong> de cada alternativa é definido por pergunta, em <strong>Templates → Editar → Pergunta</strong>.
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Cancelar</button>
                <button onClick={salvar} className="px-4 py-2 text-sm bg-teal-500 text-white rounded hover:bg-teal-600 font-medium">
                  {editing ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
