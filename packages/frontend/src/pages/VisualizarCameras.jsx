import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

export default function VisualizarCameras() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(15); // Camera 15 - Balança
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dvrConfig, setDvrConfig] = useState(null);
  const videoRef = useRef(null);

  // Lista de câmeras disponíveis
  const cameras = [
    { id: 15, name: 'Câmera 15 - Balança', description: 'Visualização da balança de pesagem' },
    { id: 1, name: 'Câmera 1 - Balcão Esquerda', description: 'Balcão de carnes - Lado esquerdo' },
    { id: 2, name: 'Câmera 2 - Balcão Centro', description: 'Balcão de carnes - Centro' },
    { id: 3, name: 'Câmera 3 - Balcão Direita', description: 'Balcão de carnes - Lado direito' },
  ];

  // Buscar configurações do DVR
  useEffect(() => {
    fetchDVRConfig();
  }, []);

  const fetchDVRConfig = async () => {
    try {
      const response = await api.get('/configurations');
      const configs = response.data;

      const dvrIp = configs.find(c => c.key === 'dvr_ip')?.value;
      const dvrUsuario = configs.find(c => c.key === 'dvr_usuario')?.value;
      const dvrSenha = configs.find(c => c.key === 'dvr_senha')?.value;

      if (dvrIp) {
        setDvrConfig({ ip: dvrIp, usuario: dvrUsuario, senha: dvrSenha });
      }
    } catch (err) {
      console.error('Erro ao buscar configurações DVR:', err);
    }
  };

  // Gerar URL do stream RTSP
  const getStreamUrl = (cameraId) => {
    if (!dvrConfig) return '';

    // URL RTSP padrão Intelbras: rtsp://usuario:senha@ip:554/cam/realmonitor?channel=X&subtype=0
    const { ip, usuario, senha } = dvrConfig;
    return `rtsp://${usuario}:${senha}@${ip}:554/cam/realmonitor?channel=${cameraId}&subtype=0`;
  };

  // Converter RTSP para HTTP usando backend proxy
  const loadCamera = async (cameraId) => {
    try {
      setLoading(true);
      setError('');

      const rtspUrl = getStreamUrl(cameraId);

      // Backend vai converter RTSP para snapshot HTTP
      const response = await api.post('/dvr-monitor/camera-stream', {
        cameraId,
        rtspUrl
      });

      setStreamUrl(response.data.streamUrl);

    } catch (err) {
      console.error('Erro ao carregar câmera:', err);
      setError('Erro ao conectar com a câmera. Verifique as configurações do DVR.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCamera && dvrConfig) {
      loadCamera(selectedCamera);
    }
  }, [selectedCamera, dvrConfig]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Visualizar Câmeras</h1>
          <button onClick={logout} className="p-2 text-gray-600 hover:text-red-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        <main className="p-4 lg:p-8">
          {/* Header */}
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl lg:text-3xl font-bold">📹 Visualizar Câmeras</h1>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </div>
            </div>
            <p className="text-white/90">
              Visualize as câmeras do DVR em tempo real para configuração de posições dos produtos
            </p>
          </div>

          {/* Seletor de Câmera */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selecione a Câmera
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {cameras.map((camera) => (
                <button
                  key={camera.id}
                  onClick={() => setSelectedCamera(camera.id)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedCamera === camera.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                    <span className="font-semibold text-gray-900">{camera.name}</span>
                  </div>
                  <p className="text-sm text-gray-600">{camera.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Viewer de Vídeo */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {cameras.find(c => c.id === selectedCamera)?.name}
              </h2>
              {dvrConfig && (
                <span className="text-sm text-green-600 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  DVR Conectado ({dvrConfig.ip})
                </span>
              )}
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span className="text-red-800">{error}</span>
                </div>
              </div>
            )}

            {loading ? (
              <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <svg className="animate-spin h-12 w-12 text-orange-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-white">Conectando com a câmera...</p>
                </div>
              </div>
            ) : streamUrl ? (
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                <img
                  ref={videoRef}
                  src={streamUrl}
                  alt="Stream da câmera"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : !dvrConfig ? (
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center p-8">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">DVR não configurado</h3>
                  <p className="text-gray-600 mb-4">Configure o IP e credenciais do DVR nas Configurações</p>
                  <button
                    onClick={() => window.location.href = '/configuracoes'}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    Ir para Configurações
                  </button>
                </div>
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">Selecione uma câmera acima</p>
              </div>
            )}

            {streamUrl && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">💡 Dica</h3>
                <p className="text-sm text-blue-800">
                  Esta visualização será usada para posicionar visualmente os produtos no balcão.
                  Arraste e solte as etiquetas dos produtos sobre suas posições no balcão para configurar
                  o sistema de validação por IA.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
