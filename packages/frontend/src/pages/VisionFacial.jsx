import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { listGroups, listPersons, addPerson, deletePerson } from '../services/face-recognition.service';

export default function VisionFacial() {
  // Dados
  const [groups, setGroups] = useState([]);
  const [persons, setPersons] = useState([]);
  const [totalPersons, setTotalPersons] = useState(0);

  // UI
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  // Modal cadastro
  const [showCadastro, setShowCadastro] = useState(false);
  const [cadastroName, setCadastroName] = useState('');
  const [cadastroId, setCadastroId] = useState('');
  const [cadastroGroupId, setCadastroGroupId] = useState('');
  const [cadastroPhoto, setCadastroPhoto] = useState(null);
  const [cadastroPhotoPreview, setCadastroPhotoPreview] = useState(null);
  const [savingPerson, setSavingPerson] = useState(false);
  const fileInputRef = useRef(null);

  // Carregar grupos ao montar
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const data = await listGroups();
      setGroups(data.groups || []);
      if (data.groups?.length > 0 && !selectedGroup) {
        setSelectedGroup(data.groups[0].groupID);
        setCadastroGroupId(data.groups[0].groupID);
      }
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadPersons = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listPersons({ groupId: selectedGroup || undefined });
      setPersons(data.persons || []);
      setTotalPersons(data.total || 0);
    } catch (err) {
      setError('Erro ao carregar pessoas: ' + (err.response?.data?.details || err.message));
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  // Carregar pessoas quando muda grupo
  useEffect(() => {
    loadPersons();
  }, [selectedGroup, loadPersons]);

  // Cadastro
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCadastroPhoto(ev.target.result.split(',')[1]);
      setCadastroPhotoPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPerson = async () => {
    if (!cadastroName.trim()) return setError('Nome é obrigatório');
    if (!cadastroGroupId) return setError('Selecione um grupo');
    if (!cadastroPhoto) return setError('Selecione uma foto com rosto visível');

    setSavingPerson(true);
    setError('');
    try {
      const result = await addPerson({
        name: cadastroName.trim(),
        groupId: cadastroGroupId,
        photoBase64: cadastroPhoto,
        id: cadastroId.trim() || undefined,
      });

      if (result.success) {
        setShowCadastro(false);
        setCadastroName('');
        setCadastroId('');
        setCadastroPhoto(null);
        setCadastroPhotoPreview(null);
        loadPersons();
        loadGroups();
      } else {
        setError(result.error || 'Erro ao cadastrar');
      }
    } catch (err) {
      setError('Erro ao cadastrar: ' + (err.response?.data?.details || err.message));
    } finally {
      setSavingPerson(false);
    }
  };

  const handleDeletePerson = async (uid, name) => {
    if (!window.confirm(`Deseja remover "${name}" do reconhecimento facial?`)) return;
    try {
      await deletePerson(uid);
      loadPersons();
      loadGroups();
    } catch (err) {
      setError('Erro ao remover: ' + (err.response?.data?.details || err.message));
    }
  };

  return (
    <Layout title="Vision Facial">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-white text-lg font-semibold">Reconhecimento Facial</h2>
            <p className="text-gray-400 text-sm">Gerencie grupos e cadastros faciais do DVR</p>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        )}

        {/* Filtro por grupo + botões */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm">Grupo:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {groups.map(g => (
                <option key={g.groupID} value={g.groupID}>
                  {g.groupName} ({g.groupSize} pessoas)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => { setShowCadastro(true); setError(''); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
            </svg>
            Cadastro Facial
          </button>

          <button
            onClick={() => { loadPersons(); loadGroups(); }}
            disabled={loading}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Atualizar
          </button>
        </div>

        {/* Cards dos grupos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {groups.map(g => (
            <div
              key={g.groupID}
              onClick={() => setSelectedGroup(g.groupID)}
              className={`bg-gray-800/50 rounded-xl border p-4 cursor-pointer transition-all ${
                selectedGroup === g.groupID
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <div className="text-2xl font-bold text-white">{g.groupSize}</div>
              <div className="text-gray-400 text-sm mt-1">{g.groupName}</div>
              <div className="text-gray-600 text-xs mt-1">ID: {g.groupID}</div>
            </div>
          ))}
          {groups.length === 0 && !loadingGroups && (
            <div className="col-span-full text-gray-500 text-sm py-4">
              Nenhum grupo encontrado no DVR. Configure os grupos de reconhecimento facial no DVR.
            </div>
          )}
          {loadingGroups && (
            <div className="col-span-full text-gray-500 text-sm py-4 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Carregando grupos...
            </div>
          )}
        </div>

        {/* Tabela de pessoas */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700/50">
            <h3 className="text-white font-medium">
              Pessoas Cadastradas
              {totalPersons > 0 && <span className="text-gray-400 font-normal ml-2">({totalPersons})</span>}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-400 bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">UID</th>
                  <th className="px-4 py-3">Sexo</th>
                  <th className="px-4 py-3">Idade</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Carregando...
                    </div>
                  </td></tr>
                )}
                {!loading && persons.length === 0 && (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    Nenhuma pessoa cadastrada {selectedGroup ? 'neste grupo' : ''}
                  </td></tr>
                )}
                {!loading && persons.map((p, i) => (
                  <tr key={p.uid || i} className="border-t border-gray-700/30 hover:bg-gray-700/20">
                    <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-400">{p.id || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.uid || '-'}</td>
                    <td className="px-4 py-3 text-gray-400">{p.sex === 1 ? 'M' : p.sex === 2 ? 'F' : '-'}</td>
                    <td className="px-4 py-3 text-gray-400">{p.age || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDeletePerson(p.uid, p.name)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Remover"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL CADASTRO FACIAL */}
        {showCadastro && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-semibold">Cadastro Facial</h3>
                <button onClick={() => setShowCadastro(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Grupo */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Grupo</label>
                <select
                  value={cadastroGroupId}
                  onChange={(e) => setCadastroGroupId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                >
                  {groups.map(g => (
                    <option key={g.groupID} value={g.groupID}>{g.groupName}</option>
                  ))}
                </select>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Nome</label>
                <input
                  type="text"
                  value={cadastroName}
                  onChange={(e) => setCadastroName(e.target.value)}
                  placeholder="Nome da pessoa"
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* ID (CPF/RG) */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">ID (CPF/RG) - opcional</label>
                <input
                  type="text"
                  value={cadastroId}
                  onChange={(e) => setCadastroId(e.target.value)}
                  placeholder="Documento de identificação"
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Foto */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Foto (rosto visível)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Selecionar Foto
                  </button>
                  {cadastroPhotoPreview && (
                    <img src={cadastroPhotoPreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-gray-600" />
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCadastro(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddPerson}
                  disabled={savingPerson || !cadastroName.trim() || !cadastroPhoto}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {savingPerson && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  )}
                  Cadastrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
