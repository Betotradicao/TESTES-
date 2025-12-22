import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

// Função para obter a URL base do backend (mesma lógica do api.js)
function getBackendBaseUrl() {
  const hostname = window.location.hostname;

  // Se tiver variável de ambiente configurada, usar ela
  if (window.ENV?.VITE_API_URL || import.meta.env.VITE_API_URL) {
    const apiUrl = window.ENV?.VITE_API_URL || import.meta.env.VITE_API_URL;
    return apiUrl.replace('/api', ''); // Remove /api para ter só a URL base
  }

  // Se acessando pelo ngrok
  if (hostname.includes('.ngrok')) {
    return 'http://10.6.1.171:3001';
  }

  // Se acessando pelo domínio Cloudflare
  if (hostname.includes('prevencaonoradar.com.br')) {
    return 'https://api.prevencaonoradar.com.br';
  }

  // Se acessando por IP
  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  if (isIP || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) {
    return `http://${hostname}:3001`;
  }

  // Padrão: localhost
  return 'http://localhost:3001';
}

export default function ReconhecimentoFacial() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [imageViewerModal, setImageViewerModal] = useState({
    isOpen: false,
    log: null
  });
  const [imageZoom, setImageZoom] = useState(100);
  const [deletingImageId, setDeletingImageId] = useState(null);

  // Filtros - padrão: Dia 1 do mês corrente até hoje
  const getFirstDayOfMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState({
    date_from: getFirstDayOfMonth(),
    date_to: getTodayDate(),
    banco_imagens: '',
    nome: ''
  });

  // Buscar logs de reconhecimento facial
  const fetchLogs = async () => {
    try {
      setLoading(true);

      const params = {
        limit: 100
      };

      const response = await api.get('/email-monitor/logs', { params });

      console.log('📊 Reconhecimento Facial - Resposta da API:', response.data);

      let facialLogs = response.data.logs || [];

      // Filtrar apenas os que tem anexo (sucesso)
      facialLogs = facialLogs.filter(log => log.has_attachment && log.status === 'success');

      // Filtrar por data
      if (filters.date_from) {
        facialLogs = facialLogs.filter(log => {
          const logDate = new Date(log.processed_at).toISOString().split('T')[0];
          return logDate >= filters.date_from;
        });
      }

      if (filters.date_to) {
        facialLogs = facialLogs.filter(log => {
          const logDate = new Date(log.processed_at).toISOString().split('T')[0];
          return logDate <= filters.date_to;
        });
      }

      // Filtrar por banco de imagens (no email body)
      if (filters.banco_imagens) {
        facialLogs = facialLogs.filter(log => {
          return log.email_body?.toLowerCase().includes(filters.banco_imagens.toLowerCase());
        });
      }

      // Filtrar por nome (no email body)
      if (filters.nome) {
        facialLogs = facialLogs.filter(log => {
          return log.email_body?.toLowerCase().includes(filters.nome.toLowerCase());
        });
      }

      console.log('📊 Reconhecimento Facial - Logs filtrados:', facialLogs.length);

      setLogs(facialLogs);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      if (error.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    fetchLogs();
  }, []);

  // Aplicar filtros
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const applyFilters = () => {
    fetchLogs();
  };

  // Funções para modal de visualização de imagem
  const openImageViewer = (log) => {
    if (!log) {
      console.error('❌ Log inválido:', log);
      return;
    }

    setImageViewerModal({
      isOpen: true,
      log: log
    });
  };

  const closeImageViewer = () => {
    setImageViewerModal({
      isOpen: false,
      log: null
    });
    setImageZoom(100); // Reset zoom
  };

  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev + 25, 200)); // Max 200%
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev - 25, 50)); // Min 50%
  };

  const handleZoomReset = () => {
    setImageZoom(100);
  };

  // Função para deletar imagem
  const handleDeleteImage = async (logId, imagePath, event) => {
    event.stopPropagation(); // Evita abrir o modal ao clicar no botão deletar

    if (!confirm('Tem certeza que deseja excluir esta imagem?')) {
      return;
    }

    try {
      setDeletingImageId(logId);
      await api.delete(`/email-monitor/logs/${logId}`);

      // Atualizar lista removendo o item deletado
      setLogs(prevLogs => prevLogs.filter(log => log.id !== logId));

      // Fechar modal se estava aberto
      if (imageViewerModal.log?.id === logId) {
        closeImageViewer();
      }
    } catch (error) {
      console.error('Erro ao deletar imagem:', error);
      alert('Erro ao deletar imagem: ' + (error.response?.data?.error || 'Erro desconhecido'));
    } finally {
      setDeletingImageId(null);
    }
  };

  // Extrair informações do email body
  const extractEmailInfo = (emailBody) => {
    const info = {
      bancoImagens: '',
      nome: '',
      similaridade: '',
      idade: '',
      genero: '',
      horario: ''
    };

    if (!emailBody) return info;

    // Banco de imagens
    const bancoMatch = emailBody.match(/Banco de imagens:\s*(.+)/i);
    if (bancoMatch) info.bancoImagens = bancoMatch[1].trim();

    // Nome (procurar a última ocorrência de "Nome:" que não seja "FACIAL" ou "Reconhecimento Facial")
    const nomeMatches = [...emailBody.matchAll(/Nome:\s*(.+)/gi)];
    if (nomeMatches.length > 0) {
      // Pegar a última ocorrência que não seja FACIAL ou Reconhecimento Facial
      for (let i = nomeMatches.length - 1; i >= 0; i--) {
        const nome = nomeMatches[i][1].trim();
        if (!nome.includes('FACIAL') && !nome.includes('Reconhecimento Facial')) {
          info.nome = nome;
          break;
        }
      }
    }

    // Similaridade
    const similaridadeMatch = emailBody.match(/Similaridade:\s*(.+)/i);
    if (similaridadeMatch) info.similaridade = similaridadeMatch[1].trim();

    // Idade
    const idadeMatch = emailBody.match(/Idade:\s*(.+)/i);
    if (idadeMatch) info.idade = idadeMatch[1].trim();

    // Gênero
    const generoMatch = emailBody.match(/G[eê]nero:\s*(.+)/i);
    if (generoMatch) info.genero = generoMatch[1].trim();

    // Horário
    const horarioMatch = emailBody.match(/Hor[aá]rio do inicio do alarme\(D\/M\/A H:M:S\):\s*(.+)/i);
    if (horarioMatch) info.horario = horarioMatch[1].trim();

    return info;
  };

  // Totais
  const totalReconhecimentos = logs.length;

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      <Sidebar
        user={user}
        currentPage="reconhecimento-facial"
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile menu button */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Reconhecimento Facial</h1>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <main className="p-4 lg:p-8 overflow-y-auto">
          {/* Cabeçalho */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🎯 Reconhecimento Facial</h1>
            <p className="text-gray-600">
              Galeria de reconhecimentos faciais capturados pelo DVR
            </p>
          </div>

          {/* Card de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium mb-1">Total de Reconhecimentos</p>
                  <p className="text-4xl font-bold">{totalReconhecimentos}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Data Inicial */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => handleFilterChange({ ...filters, date_from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Data Final */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data final
                </label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => handleFilterChange({ ...filters, date_to: e.target.value })}
                  min={filters.date_from}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Banco de Imagens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Banco de Imagens
                </label>
                <input
                  type="text"
                  placeholder="Ex: FURTANTES"
                  value={filters.banco_imagens}
                  onChange={(e) => handleFilterChange({ ...filters, banco_imagens: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  value={filters.nome}
                  onChange={(e) => handleFilterChange({ ...filters, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Botão Aplicar (ocupa toda a largura em uma nova linha) */}
              <div className="md:col-span-4">
                <button
                  onClick={applyFilters}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:ring-4 focus:ring-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Carregando...' : 'Aplicar Filtros'}
                </button>
              </div>
            </div>
          </div>

          {/* Grid de Imagens - Álbum de Figurinhas */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Galeria de Reconhecimentos</h2>

            {loading ? (
              <div className="text-center py-12">
                <svg className="animate-spin h-10 w-10 text-orange-500 mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-gray-600">Carregando reconhecimentos...</p>
              </div>
            ) : totalReconhecimentos === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Nenhum reconhecimento encontrado para os filtros selecionados</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {logs.map((log) => {
                  const info = extractEmailInfo(log.email_body);

                  return (
                    <div
                      key={log.id}
                      onClick={() => openImageViewer(log)}
                      className="bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-orange-400 transition-all cursor-pointer overflow-hidden group relative"
                    >
                      {/* Botão Deletar - Canto Superior Direito */}
                      <button
                        onClick={(e) => handleDeleteImage(log.id, log.image_path, e)}
                        disabled={deletingImageId === log.id}
                        className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Excluir imagem"
                      >
                        {deletingImageId === log.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>

                      {/* Imagem */}
                      <div className="aspect-square bg-gray-200 relative overflow-hidden">
                        {log.image_path ? (
                          <img
                            src={`${getBackendBaseUrl()}/uploads/dvr_images/${log.image_path}`}
                            alt={info.nome || 'Reconhecimento facial'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500">
                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}

                        {/* Overlay com ícone de zoom */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                          <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                      </div>

                      {/* Informações */}
                      <div className="p-3">
                        <p className="font-semibold text-sm text-gray-900 truncate" title={info.nome}>
                          {info.nome || 'Nome não identificado'}
                        </p>
                        <p className="text-xs text-gray-600 truncate" title={info.bancoImagens}>
                          {info.bancoImagens || 'Banco não identificado'}
                        </p>
                        {info.similaridade && (
                          <p className="text-xs text-orange-600 font-medium mt-1">
                            {info.similaridade}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(log.processed_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal de Visualização de Imagem com Zoom */}
      {imageViewerModal.isOpen && imageViewerModal.log && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center"
          style={{ zIndex: 9999 }}
          onClick={closeImageViewer}
        >
          <div
            className="w-full h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com controles de zoom */}
            <div className="px-6 py-3 bg-gray-900 bg-opacity-90 flex items-center justify-between text-white">
              <div>
                <h3 className="text-lg font-semibold">Reconhecimento Facial</h3>
                <p className="text-sm text-gray-300">
                  {extractEmailInfo(imageViewerModal.log.email_body).nome || 'Nome não identificado'}
                </p>
              </div>

              {/* Controles de Zoom */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                  <button
                    onClick={handleZoomOut}
                    disabled={imageZoom <= 50}
                    className="text-white hover:text-orange-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Diminuir zoom"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  </button>

                  <button
                    onClick={handleZoomReset}
                    className="text-white hover:text-orange-400 transition-colors text-sm font-mono px-2"
                    title="Resetar zoom (100%)"
                  >
                    {imageZoom}%
                  </button>

                  <button
                    onClick={handleZoomIn}
                    disabled={imageZoom >= 200}
                    className="text-white hover:text-orange-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Aumentar zoom"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={closeImageViewer}
                  className="text-white hover:text-gray-300 transition-colors p-2"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Imagem com zoom ajustável */}
            <div className="flex-1 bg-black flex items-center justify-center p-4 overflow-auto">
              {imageViewerModal.log.image_path ? (
                <img
                  src={`${getBackendBaseUrl()}/uploads/dvr_images/${imageViewerModal.log.image_path}`}
                  alt="Reconhecimento facial"
                  className="object-contain transition-all duration-200"
                  style={{
                    width: `${imageZoom}%`,
                    height: 'auto',
                    maxHeight: `calc((100vh - 140px) * ${imageZoom / 100})`
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xl">
                  Imagem não disponível
                </div>
              )}
            </div>

            {/* Footer com informações detalhadas */}
            <div className="px-6 py-4 bg-gray-900 bg-opacity-90 text-white">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Banco de Imagens</p>
                  <p className="font-medium">{extractEmailInfo(imageViewerModal.log.email_body).bancoImagens || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Similaridade</p>
                  <p className="font-medium">{extractEmailInfo(imageViewerModal.log.email_body).similaridade || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Idade</p>
                  <p className="font-medium">{extractEmailInfo(imageViewerModal.log.email_body).idade || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Gênero</p>
                  <p className="font-medium">{extractEmailInfo(imageViewerModal.log.email_body).genero || '-'}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={closeImageViewer}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
