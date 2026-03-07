import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import {
  listGroups, listPersons, addPerson, deletePerson,
  searchDetections, getPersonPhotoUrl
} from '../services/face-recognition.service';
import api from '../utils/api';

export default function VisionFacial() {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');

  // Detections
  const [detections, setDetections] = useState([]);
  const [loadingDetections, setLoadingDetections] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterGroup, setFilterGroup] = useState('');
  const [filterName, setFilterName] = useState('');
  const [detectionChannel, setDetectionChannel] = useState('');
  const [detectionMax, setDetectionMax] = useState(100);

  // Group detail modal
  const [detailGroup, setDetailGroup] = useState(null);
  const [persons, setPersons] = useState([]);
  const [totalPersons, setTotalPersons] = useState(0);
  const [loadingPersons, setLoadingPersons] = useState(false);

  // Cadastro modal
  const [showCadastro, setShowCadastro] = useState(false);
  const [cadastroName, setCadastroName] = useState('');
  const [cadastroId, setCadastroId] = useState('');
  const [cadastroGroupId, setCadastroGroupId] = useState('');
  const [cadastroSex, setCadastroSex] = useState(0);
  const [cadastroAge, setCadastroAge] = useState('');
  const [cadastroPhoto, setCadastroPhoto] = useState(null);
  const [cadastroPhotoPreview, setCadastroPhotoPreview] = useState(null);
  const [savingPerson, setSavingPerson] = useState(false);
  const fileInputRef = useRef(null);

  // Zoom modal
  const [zoomDetection, setZoomDetection] = useState(null);

  // Save to group
  const [savingToGroup, setSavingToGroup] = useState(null);
  const [groupMenuIdx, setGroupMenuIdx] = useState(null);

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    try {
      const data = await listGroups();
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
    }
  };

  const loadDetections = async () => {
    setLoadingDetections(true);
    setError('');
    try {
      const start = `${startDate} 00:00:00`;
      const end = `${endDate} 23:59:59`;
      const data = await searchDetections({
        start, end,
        channel: detectionChannel || undefined,
        max: detectionMax,
      });
      setDetections(data.detections || []);
    } catch (err) {
      setError('Erro ao buscar deteccoes: ' + (err.response?.data?.details || err.message));
    } finally {
      setLoadingDetections(false);
    }
  };

  // Auto-load on mount with a small delay to ensure token is available
  useEffect(() => {
    const timer = setTimeout(() => loadDetections(), 500);
    return () => clearTimeout(timer);
  }, []);

  const loadPersons = useCallback(async (groupId) => {
    setLoadingPersons(true);
    setError('');
    try {
      const data = await listPersons({ groupId, begin: 0, count: 50 });
      setPersons(data.persons || []);
      setTotalPersons(data.total || 0);
    } catch (err) {
      setError('Erro ao carregar pessoas: ' + (err.response?.data?.details || err.message));
    } finally {
      setLoadingPersons(false);
    }
  }, []);

  const openGroupDetail = (group) => {
    setDetailGroup(group);
    setPersons([]);
    setTotalPersons(0);
    loadPersons(group.groupID);
  };

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
    if (!cadastroName.trim()) return setError('Nome e obrigatorio');
    if (!cadastroGroupId) return setError('Selecione um grupo');
    if (!cadastroPhoto) return setError('Selecione uma foto');

    setSavingPerson(true);
    setError('');
    try {
      const result = await addPerson({
        name: cadastroName.trim(),
        groupId: cadastroGroupId,
        photoBase64: cadastroPhoto,
        id: cadastroId.trim() || undefined,
        sex: cadastroSex,
        age: cadastroAge ? parseInt(cadastroAge) : undefined,
      });
      if (result.success) {
        setShowCadastro(false);
        setCadastroName(''); setCadastroId(''); setCadastroPhoto(null);
        setCadastroPhotoPreview(null); setCadastroSex(0); setCadastroAge('');
        loadGroups();
        if (detailGroup) loadPersons(detailGroup.groupID);
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
    if (!window.confirm(`Remover "${name}"?`)) return;
    try {
      await deletePerson(uid);
      loadGroups();
      if (detailGroup) loadPersons(detailGroup.groupID);
    } catch (err) {
      setError('Erro: ' + (err.response?.data?.details || err.message));
    }
  };

  const handleSaveToGroup = async (detection, groupId) => {
    setSavingToGroup(detection);
    setGroupMenuIdx(null);
    try {
      const name = window.prompt('Nome da pessoa:', '');
      if (!name) { setSavingToGroup(null); return; }

      const result = await addPerson({
        name: name.trim(),
        groupId,
        photoBase64: null,
        snapshotChannel: detection.channel + 1,
        sex: detection.sexCode || 0,
        age: detection.age || 0,
      });

      if (result.success) {
        setError('');
        loadGroups();
        alert(`"${name}" salvo no grupo com sucesso!`);
      } else {
        setError(result.error || 'Erro ao salvar');
      }
    } catch (err) {
      setError('Erro ao salvar no grupo: ' + (err.response?.data?.details || err.message));
    } finally {
      setSavingToGroup(null);
    }
  };

  const openCadastro = (groupId) => {
    setCadastroGroupId(groupId || (groups[0]?.groupID || ''));
    setShowCadastro(true);
    setError('');
  };

  const getGroupStats = (g) => {
    const states = g.featureState || [];
    return {
      processado: states.filter(s => s === 2).length,
      naoProcessado: states.filter(s => s === 0).length,
      erro: states.filter(s => s === 1).length,
    };
  };

  // URL da imagem real da deteccao facial do DVR
  const getDetectionImageUrl = (detection) => {
    if (!detection.filePath) return null;
    const token = localStorage.getItem('token');
    // Usar /api/ prefix para funcionar com o proxy do Vite dev server
    return `/api/face-recognition/detection-image?token=${token}&path=${encodeURIComponent(detection.filePath)}`;
  };

  return (
    <Layout title="Reconhecimento Facial">
      <div className="space-y-0">
        {/* HEADER LARANJA */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <h1 className="text-white text-xl font-bold">Reconhecimento Facial</h1>
                <p className="text-orange-100 text-sm">Galeria de reconhecimentos faciais capturados pelo DVR</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openCadastro()}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
              </svg>
              Cadastrar
            </button>
            <svg className="w-10 h-10 text-white/50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        </div>

        {/* TOTAL COUNTER */}
        <div className="bg-gradient-to-r from-orange-700 to-orange-600 px-6 py-4">
          <div className="text-orange-200 text-xs uppercase tracking-wider">Total de Reconhecimentos</div>
          <div className="text-white text-3xl font-bold">{detections.length}</div>
        </div>

        <div className="p-6 space-y-5">
          {/* FILTROS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-gray-800 font-bold text-base mb-4">Filtros</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">Data inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">Data final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">Banco de Imagens</label>
                <input
                  type="text"
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  placeholder="Ex: FURTANTES"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Ex: Joao Silva"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            <button
              onClick={loadDetections}
              disabled={loadingDetections}
              className="mt-4 w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingDetections ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : null}
              Aplicar Filtros
            </button>
          </div>

          {/* ERROR */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )}

          {/* GALERIA DE RECONHECIMENTOS */}
          <div>
            <h3 className="text-gray-800 font-bold text-base mb-4">Galeria de Reconhecimentos</h3>

            {loadingDetections && (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <svg className="animate-spin h-8 w-8 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <span className="text-lg">Buscando reconhecimentos faciais no DVR...</span>
              </div>
            )}

            {!loadingDetections && detections.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-lg">Nenhum reconhecimento facial encontrado</p>
                <p className="text-sm mt-1 text-gray-400">Ajuste os filtros e clique em Aplicar</p>
              </div>
            )}

            {!loadingDetections && detections.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {detections.map((d, i) => (
                  <DetectionCard
                    key={i}
                    detection={d}
                    index={i}
                    groups={groups}
                    groupMenuIdx={groupMenuIdx}
                    setGroupMenuIdx={setGroupMenuIdx}
                    savingToGroup={savingToGroup}
                    onSaveToGroup={handleSaveToGroup}
                    onZoom={() => setZoomDetection(d)}
                    getImageUrl={getDetectionImageUrl}
                  />
                ))}
              </div>
            )}
          </div>

          {/* GRUPOS CADASTRADOS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-orange-600 to-orange-500 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">Grupos de Reconhecimento Facial</h3>
              <button
                onClick={() => openCadastro()}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                + Cadastrar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-500 bg-gray-50 text-xs uppercase border-b">
                  <tr>
                    <th className="px-4 py-3 w-12">No.</th>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-center">Processado</th>
                    <th className="px-4 py-3 text-center">Nao Proc.</th>
                    <th className="px-4 py-3 text-center">Erro</th>
                    <th className="px-4 py-3 text-center">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 && (
                    <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-400">Nenhum grupo no DVR</td></tr>
                  )}
                  {groups.map((g, i) => {
                    const stats = getGroupStats(g);
                    return (
                      <tr key={g.groupID} className="border-b border-gray-100 hover:bg-orange-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{g.groupName}</td>
                        <td className="px-4 py-3 text-center text-gray-800 font-semibold">{g.groupSize}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{stats.processado}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-medium">{stats.naoProcessado}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">{stats.erro}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openGroupDetail(g)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MODAL ZOOM DETECCAO */}
        {zoomDetection && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setZoomDetection(null)}>
            <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-3 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Deteccao Facial - {zoomDetection.startTime}</h3>
                <button onClick={() => setZoomDetection(null)} className="text-white/80 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
                  <img
                    src={getDetectionImageUrl(zoomDetection)}
                    alt="Face detection"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-gray-500 text-xs">Canal</div>
                    <div className="text-gray-800 font-medium">#{zoomDetection.channel}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-gray-500 text-xs">Sexo</div>
                    <div className="text-gray-800 font-medium">{zoomDetection.sex}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-gray-500 text-xs">Idade</div>
                    <div className="text-gray-800 font-medium">{zoomDetection.age || '-'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-gray-500 text-xs">Emocao</div>
                    <div className="text-gray-800 font-medium">{zoomDetection.emotion}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-gray-500 text-xs">Oculos</div>
                    <div className="text-gray-800 font-medium">{zoomDetection.glasses}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-gray-500 text-xs">Mascara</div>
                    <div className="text-gray-800 font-medium">{zoomDetection.mask}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DETALHES DO GRUPO */}
        {detailGroup && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
            <div className="bg-white rounded-xl w-full max-w-5xl shadow-2xl">
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-t-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-white text-lg font-bold">{detailGroup.groupName}</h3>
                  <p className="text-orange-100 text-xs">{totalPersons} pessoa(s) - ID: {detailGroup.groupID}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openCadastro(detailGroup.groupID)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                    + Adicionar
                  </button>
                  <button onClick={() => loadPersons(detailGroup.groupID)} disabled={loadingPersons} className="bg-white/20 hover:bg-white/30 text-white px-2 py-1.5 rounded-lg disabled:opacity-50">
                    <svg className={`w-4 h-4 ${loadingPersons ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                  </button>
                  <button onClick={() => { setDetailGroup(null); setError(''); }} className="text-white/80 hover:text-white ml-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
              {error && (
                <div className="mx-5 mt-3 bg-red-50 border border-red-200 rounded-lg p-2 text-red-600 text-xs">
                  {error}
                </div>
              )}
              <div className="p-5">
                {loadingPersons && (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Carregando...
                  </div>
                )}
                {!loadingPersons && persons.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <p>Nenhuma pessoa neste grupo</p>
                    <button onClick={() => openCadastro(detailGroup.groupID)} className="mt-2 text-orange-500 hover:text-orange-600 text-sm underline">
                      Cadastrar primeira pessoa
                    </button>
                  </div>
                )}
                {!loadingPersons && persons.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {persons.map((p, i) => (
                      <PersonCard key={p.uid || i} person={p} onDelete={handleDeletePerson} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL CADASTRO */}
        {showCadastro && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-t-xl px-5 py-3 flex items-center justify-between">
                <h3 className="text-white font-semibold">Cadastro Facial</h3>
                <button onClick={() => setShowCadastro(false)} className="text-white/80 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-red-600 text-xs">{error}</div>}
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-1">Grupo</label>
                  <select value={cadastroGroupId} onChange={(e) => setCadastroGroupId(e.target.value)} className="w-full border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-sm">
                    {groups.map(g => <option key={g.groupID} value={g.groupID}>{g.groupName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-1">Nome</label>
                  <input type="text" value={cadastroName} onChange={(e) => setCadastroName(e.target.value)} placeholder="Nome" className="w-full border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-1">Genero</label>
                    <select value={cadastroSex} onChange={(e) => setCadastroSex(parseInt(e.target.value))} className="w-full border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-sm">
                      <option value={0}>-</option>
                      <option value={1}>Masculino</option>
                      <option value={2}>Feminino</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-1">Idade</label>
                    <input type="number" value={cadastroAge} onChange={(e) => setCadastroAge(e.target.value)} placeholder="-" className="w-full border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-1">ID (opcional)</label>
                  <input type="text" value={cadastroId} onChange={(e) => setCadastroId(e.target.value)} placeholder="CPF/RG" className="w-full border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-1">Foto</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                  <div className="flex items-center gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm border border-gray-300">Selecionar</button>
                    {cadastroPhotoPreview && <img src={cadastroPhotoPreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-gray-300" />}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowCadastro(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm">Cancelar</button>
                  <button onClick={handleAddPerson} disabled={savingPerson || !cadastroName.trim() || !cadastroPhoto} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                    {savingPerson && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                    Cadastrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// Card de deteccao facial - imagem em quadradinho
function DetectionCard({ detection: d, index, groups, groupMenuIdx, setGroupMenuIdx, savingToGroup, onSaveToGroup, onZoom, getImageUrl }) {
  const [imgError, setImgError] = useState(false);
  const isSaving = savingToGroup === d;
  const showMenu = groupMenuIdx === index;
  const imgUrl = getImageUrl(d);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-orange-300 transition-all relative group">
      {/* Imagem */}
      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden cursor-pointer" onClick={onZoom}>
        {imgUrl && !imgError ? (
          <img
            src={imgUrl}
            alt={`Deteccao ${index + 1}`}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
        )}

        {/* Zoom overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
          </svg>
        </div>

        {/* Botao salvar no grupo - bolinha vermelha */}
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => { e.stopPropagation(); setGroupMenuIdx(showMenu ? null : index); }}
            disabled={isSaving}
            className="bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full shadow-lg transition-colors disabled:opacity-50 flex items-center justify-center"
            title="Salvar no grupo"
          >
            {isSaving ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
              </svg>
            )}
          </button>

          {/* Dropdown de grupos */}
          {showMenu && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[160px] z-10 overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase border-b border-gray-100 font-medium">Salvar no grupo</div>
              {groups.map(g => (
                <button
                  key={g.groupID}
                  onClick={(e) => { e.stopPropagation(); onSaveToGroup(d, g.groupID); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                >
                  {g.groupName}
                </button>
              ))}
              {groups.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">Nenhum grupo</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info da deteccao */}
      <div className="p-2.5">
        <div className="text-gray-500 text-xs font-medium">#{d.channel}</div>
        <div className="text-orange-600 text-sm font-semibold">{d.startTime?.split(' ')[1] || ''}</div>
        <div className="flex items-center gap-1 flex-wrap mt-1">
          {d.sex !== 'Desconhecido' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${d.sexCode === 1 ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
              {d.sex}
            </span>
          )}
          {d.age > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{d.age}a</span>
          )}
          {d.emotion !== 'Desconhecido' && d.emotionCode > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">{d.emotion}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Card de pessoa cadastrada
function PersonCard({ person, onDelete }) {
  const [imgError, setImgError] = useState(false);
  const photoUrl = getPersonPhotoUrl(person.photoUrl);
  const sexLabel = person.sex === 1 ? 'Masculino' : person.sex === 2 ? 'Feminino' : '-';

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-orange-300 transition-all group">
      <div className="aspect-square bg-gray-100 flex items-center justify-center relative overflow-hidden">
        {photoUrl && !imgError ? (
          <img src={photoUrl} alt={person.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="flex flex-col items-center text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <span className="text-xs mt-1">Sem foto</span>
          </div>
        )}
        <button
          onClick={() => onDelete(person.uid, person.name)}
          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          title="Remover"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
      <div className="p-2.5">
        <div className="text-gray-800 text-sm font-medium truncate">{person.name}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
          <span>{sexLabel}</span>
          {person.age > 0 && <><span>|</span><span>{person.age}a</span></>}
        </div>
      </div>
    </div>
  );
}
