import { useState, useEffect } from 'react';
import {
  listDvrDevices,
  createDvrDevice,
  updateDvrDevice,
  deleteDvrDevice,
  testDvrDevice
} from '../../services/dvr-devices.service';
import { fetchAllCompanies } from '../../services/companies.service';
import DvrDeviceFormModal from './DvrDeviceFormModal';

// Helper de feedback simples (projeto nao tem lib de toast)
const toast = {
  success: (m) => alert('✅ ' + m),
  error: (m) => alert('❌ ' + m)
};

export default function DvrDevicesAccordion() {
  const [devices, setDevices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [devs, comps] = await Promise.all([
        listDvrDevices(),
        fetchAllCompanies().catch(() => [])
      ]);
      setDevices(devs);
      setCompanies(Array.isArray(comps) ? comps : (comps?.data || []));
    } catch (e) {
      toast.error('Erro ao carregar DVRs: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const lojaNome = (codLoja) => {
    const c = companies.find(cc => cc.codLoja === codLoja || cc.cod_loja === codLoja);
    return c ? (c.apelido || c.nomeFantasia || c.nome_fantasia || `Loja ${codLoja}`) : `Loja ${codLoja}`;
  };

  const handleNew = () => {
    setEditingDevice(null);
    setModalOpen(true);
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setModalOpen(true);
  };

  const handleSave = async (data) => {
    try {
      if (editingDevice) {
        await updateDvrDevice(editingDevice.id, data);
        toast.success('DVR atualizado');
      } else {
        await createDvrDevice(data);
        toast.success('DVR criado');
      }
      setModalOpen(false);
      setEditingDevice(null);
      await loadAll();
    } catch (e) {
      toast.error('Erro ao salvar: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleDelete = async (device) => {
    if (!confirm(`Remover DVR "${device.name}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await deleteDvrDevice(device.id);
      toast.success('DVR removido');
      await loadAll();
    } catch (e) {
      toast.error('Erro ao remover: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleTest = async (device) => {
    setTestingId(device.id);
    try {
      const r = await testDvrDevice(device.id);
      if (r.success) toast.success(r.message);
      else toast.error(r.message);
    } catch (e) {
      toast.error('Erro no teste: ' + (e.response?.data?.error || e.message));
    } finally {
      setTestingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Carregando DVRs...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="text-xl">📺</span>
              DVRs Configurados
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie multiplos DVRs por loja. Clique pra expandir e editar.
            </p>
          </div>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm font-medium flex items-center gap-2"
          >
            <span>+</span> Adicionar DVR
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>Nenhum DVR cadastrado ainda.</p>
            <p className="text-sm mt-1">Clique em "+ Adicionar DVR" pra come&ccedil;ar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map(device => {
              const isOpen = expandedId === device.id;
              return (
                <div key={device.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : device.id)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-4 h-4 text-gray-500 transform transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="text-left">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {device.name}
                          {device.is_default && (
                            <span className="px-2 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded-full">Principal</span>
                          )}
                          {device.status !== 'active' && (
                            <span className="px-2 py-0.5 text-[10px] bg-gray-200 text-gray-600 rounded-full">{device.status}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {lojaNome(device.codigo_loja)} &middot; {device.ip}:{device.porta_http} HTTP / {device.porta_rtsp} RTSP
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleTest(device)}
                        disabled={testingId === device.id}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                      >
                        {testingId === device.id ? 'Testando...' : 'Testar'}
                      </button>
                      <button
                        onClick={() => handleEdit(device)}
                        className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(device)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Excluir
                      </button>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 bg-white border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-gray-500">Loja</div>
                          <div className="font-medium">{lojaNome(device.codigo_loja)} (cod {device.codigo_loja})</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">IP</div>
                          <div className="font-mono text-xs">{device.ip}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Usu&aacute;rio</div>
                          <div className="font-mono text-xs">{device.usuario}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Porta HTTP</div>
                          <div>{device.porta_http}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Porta RTSP</div>
                          <div>{device.porta_rtsp}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Codec</div>
                          <div>{device.codec_mode}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Canais</div>
                          <div>{(device.canais || []).length}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Antecedencia (s)</div>
                          <div>{device.antecedencia_segundos}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Depois (s)</div>
                          <div>{device.tempo_depois_segundos}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <DvrDeviceFormModal
          device={editingDevice}
          companies={companies}
          onClose={() => { setModalOpen(false); setEditingDevice(null); }}
          onSave={handleSave}
        />
      )}
    </>
  );
}
