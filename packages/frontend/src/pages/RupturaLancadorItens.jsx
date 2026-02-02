import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import PeculiaridadesModal from '../components/ruptura/PeculiaridadesModal';

export default function RupturaLancadorItens() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [nomePesquisa, setNomePesquisa] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const [recentSurveys, setRecentSurveys] = useState([]);

  // Estados do calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthSurveys, setMonthSurveys] = useState([]);

  // Estados para modo Direto Sistema
  const [importMode, setImportMode] = useState('arquivo'); // 'arquivo' ou 'direto'
  const [diasSemVenda, setDiasSemVenda] = useState(2);
  const [curvasSelecionadas, setCurvasSelecionadas] = useState(['A']);
  const [secoes, setSecoes] = useState([]);
  const [secoesSelecionadas, setSecoesSelecionadas] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [parsedItems, setParsedItems] = useState([]);
  const [showPeculiaridadesModal, setShowPeculiaridadesModal] = useState(false);

  // Carregar pesquisas recentes e do mês ao montar
  useEffect(() => {
    loadRecentSurveys();
    loadMonthSurveys(currentMonth);
  }, []);

  // Carregar seções quando mudar para modo direto
  useEffect(() => {
    if (importMode === 'direto' && secoes.length === 0) {
      loadSections();
    }
  }, [importMode]);

  // Carregar seções da API
  const loadSections = async () => {
    setLoadingSections(true);
    try {
      const response = await api.get('/products/sections');
      setSecoes(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar seções:', err);
      setError('Erro ao carregar seções da API');
    } finally {
      setLoadingSections(false);
    }
  };

  // Carregar produtos filtrados para ruptura
  const loadProductsForRupture = async () => {
    setLoadingProducts(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (diasSemVenda > 0) {
        params.append('diasSemVenda', diasSemVenda.toString());
      }
      if (curvasSelecionadas.length > 0 && curvasSelecionadas.length < 5) {
        params.append('curvas', curvasSelecionadas.join(','));
      }
      if (secoesSelecionadas.length > 0) {
        params.append('secoes', secoesSelecionadas.join(','));
      }

      const response = await api.get(`/products/for-rupture?${params.toString()}`);
      const items = response.data.items || [];

      setParsedItems(items);

      if (items.length > 0) {
        setSuccess(`${items.length} produtos encontrados com os filtros selecionados`);
        // Definir nome padrão da pesquisa
        const today = new Date();
        setNomePesquisa(`Pesquisa ${today.toLocaleDateString('pt-BR')} - ${items.length} itens`);
      } else {
        setError('Nenhum produto encontrado com os filtros selecionados');
      }
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setError(err.response?.data?.error || 'Erro ao carregar produtos');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Toggle curva selecionada
  const toggleCurva = (curva) => {
    setCurvasSelecionadas(prev => {
      if (prev.includes(curva)) {
        return prev.filter(c => c !== curva);
      }
      return [...prev, curva];
    });
  };

  // Toggle seção selecionada
  const toggleSecao = (secao) => {
    setSecoesSelecionadas(prev => {
      if (prev.includes(secao)) {
        return prev.filter(s => s !== secao);
      }
      return [...prev, secao];
    });
  };

  // Recarregar pesquisas quando o mês mudar
  useEffect(() => {
    loadMonthSurveys(currentMonth);
  }, [currentMonth]);

  // Recarregar dados quando a página ganhar foco (quando voltar de outra página)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Página ganhou foco, recarregando dados...');
      loadRecentSurveys();
      loadMonthSurveys(currentMonth);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentMonth]);

  const loadRecentSurveys = async () => {
    try {
      const response = await api.get('/rupture-surveys');
      console.log('🔍 DADOS RECEBIDOS DA API:', response.data);
      console.log('🔍 PRIMEIRA PESQUISA:', response.data[0]);
      setRecentSurveys(response.data.slice(0, 5)); // Só 5 mais recentes
    } catch (err) {
      console.error('Erro ao carregar pesquisas:', err);
    }
  };

  const loadMonthSurveys = async (monthDate) => {
    try {
      const response = await api.get('/rupture-surveys');
      const allSurveys = response.data;

      // Filtrar apenas auditorias do mês selecionado
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      const filtered = allSurveys.filter(survey => {
        const surveyDate = new Date(survey.data_criacao);
        return surveyDate.getFullYear() === year && surveyDate.getMonth() === month;
      });

      setMonthSurveys(filtered);
    } catch (err) {
      console.error('Erro ao carregar auditorias do mês:', err);
    }
  };

  // Funções para navegação do calendário
  const prevMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const nextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  // Verificar se dia tem auditoria
  const getDayAudits = (day) => {
    return monthSurveys.filter(survey => {
      const surveyDate = new Date(survey.data_criacao);
      return surveyDate.getDate() === day;
    });
  };

  // Obter cor do dia no calendário
  const getDayColor = (day) => {
    const today = new Date();
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const hasAudits = getDayAudits(day).length > 0;

    // Dia futuro - branco
    if (dayDate > today) {
      return 'bg-white text-gray-400';
    }

    // Dia passado com auditoria - verde claro
    if (hasAudits) {
      return 'bg-green-100 text-green-800 font-semibold';
    }

    // Dia passado sem auditoria - vermelho claro
    return 'bg-red-100 text-red-600';
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    processFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    processFile(droppedFile);
  };

  const processFile = async (selectedFile) => {
    if (!selectedFile) return;

    // Validar extensão
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      setError('Apenas arquivos CSV e Excel são permitidos');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Gerar nome padrão da pesquisa
    const today = new Date();
    const defaultName = `Pesquisa ${today.toLocaleDateString('pt-BR')}`;
    setNomePesquisa(defaultName);

    // Preview básico (ler primeiras linhas do CSV)
    if (fileExt === '.csv') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n').slice(0, 10); // Primeiras 10 linhas
        setPreview(lines);
      };
      reader.readAsText(selectedFile);
    } else {
      setPreview([`Arquivo Excel: ${selectedFile.name}`]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Selecione um arquivo primeiro');
      return;
    }

    if (!nomePesquisa.trim()) {
      setError('Digite um nome para a pesquisa');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Recriar o FormData a partir do arquivo selecionado novamente
      // para evitar ERR_UPLOAD_FILE_CHANGED
      const formData = new FormData();
      formData.append('file', file);
      formData.append('nome_pesquisa', nomePesquisa);

      const response = await api.post('/rupture-surveys/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess(`✅ ${response.data.survey.total_itens} itens importados com sucesso!`);
      setFile(null);
      setPreview(null);

      // Recarregar lista de pesquisas
      await loadRecentSurveys();

      // Após 2 segundos, perguntar se quer iniciar
      setTimeout(() => {
        const start = window.confirm('Deseja iniciar a pesquisa agora e gerar link para o celular?');
        if (start) {
          handleStartSurvey(response.data.survey.id);
        }
      }, 2000);
    } catch (err) {
      console.error('Upload error:', err);

      // Mensagens de erro mais específicas
      if (err.message && err.message.includes('ERR_UPLOAD_FILE_CHANGED')) {
        setError('⚠️ O arquivo foi modificado durante o envio. Feche o Excel e tente novamente.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('❌ Erro de conexão. Verifique sua internet.');
      } else {
        setError(err.response?.data?.error || 'Erro ao importar arquivo. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartSurvey = async (surveyId) => {
    try {
      await api.post(`/rupture-surveys/${surveyId}/start`);
      navigate(`/ruptura-verificacao/${surveyId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar pesquisa');
    }
  };

  // Criar pesquisa a partir dos itens carregados do sistema
  const handleCreateSurveyFromItems = async () => {
    if (parsedItems.length === 0) {
      setError('Carregue os produtos primeiro');
      return;
    }

    if (!nomePesquisa.trim()) {
      setError('Digite um nome para a pesquisa');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Criar pesquisa via API
      const response = await api.post('/rupture-surveys/from-items', {
        nome_pesquisa: nomePesquisa,
        items: parsedItems
      });

      setSuccess(`Pesquisa criada com ${response.data.survey.total_itens} produtos!`);

      // Recarregar listas
      await loadRecentSurveys();
      await loadMonthSurveys(currentMonth);

      // Limpar campos
      setParsedItems([]);
      setNomePesquisa('');

      // Perguntar se quer iniciar
      setTimeout(() => {
        const start = window.confirm('Deseja iniciar a pesquisa agora e gerar link para o celular?');
        if (start) {
          handleStartSurvey(response.data.survey.id);
        }
      }, 1500);

    } catch (err) {
      console.error('Erro ao criar pesquisa:', err);
      setError(err.response?.data?.error || 'Erro ao criar pesquisa');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSurvey = async (surveyId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta pesquisa? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await api.delete(`/rupture-surveys/${surveyId}`);
      await loadRecentSurveys();
      setSuccess('Pesquisa excluída com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir pesquisa');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'rascunho': return 'bg-gray-100 text-gray-800';
      case 'em_andamento': return 'bg-orange-100 text-orange-800';
      case 'concluida': return 'bg-green-100 text-green-800';
      case 'cancelada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'rascunho': return '📝 Rascunho';
      case 'em_andamento': return '🔄 INICIADO';
      case 'concluida': return '✅ Concluída';
      case 'cancelada': return '❌ Cancelada';
      default: return status;
    }
  };

  return (
    <Layout>
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">📤 Lançador de Itens</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Importe arquivos Excel/CSV para criar novas pesquisas de ruptura
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Layout: Upload + Calendário (metade do tamanho) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Upload Area - 2/3 do espaço */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Nova Pesquisa de Ruptura</h2>

            {/* Toggle: Arquivo ou Direto Sistema */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  setImportMode('arquivo');
                  setParsedItems([]);
                  setFile(null);
                  setPreview(null);
                  setSuccess('');
                  setError('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  importMode === 'arquivo'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📄 Via Arquivo
              </button>
              <button
                onClick={() => {
                  setImportMode('direto');
                  setParsedItems([]);
                  setFile(null);
                  setPreview(null);
                  setSuccess('');
                  setError('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  importMode === 'direto'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔗 Direto Sistema
              </button>
            </div>

            {/* Modo Arquivo */}
            {importMode === 'arquivo' && (
              <>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center ${
                    dragging ? 'border-orange-500 bg-orange-50' : 'border-gray-300'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="fileInput"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="fileInput"
                    className="cursor-pointer"
                  >
                    <div className="text-5xl mb-3">📁</div>
                    <p className="text-base font-semibold text-gray-700 mb-1">
                      Clique ou arraste arquivo Excel aqui
                    </p>
                    <p className="text-xs text-gray-500">
                      Formatos aceitos: .csv, .xlsx, .xls (máx. 10MB)
                    </p>
                  </label>
                </div>

                {file && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <span className="text-green-500 text-2xl mr-2">✅</span>
                        <div>
                          <p className="font-semibold text-gray-700">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setFile(null);
                          setPreview(null);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        🗑️ Remover
                      </button>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome da Pesquisa:
                      </label>
                      <input
                        type="text"
                        value={nomePesquisa}
                        onChange={(e) => setNomePesquisa(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Ex: Pesquisa 30/12/2025"
                      />
                    </div>

                    {preview && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                        <div className="bg-gray-50 p-4 rounded-lg max-h-48 overflow-auto">
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                            {preview.join('\n')}
                          </pre>
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-4">
                      <button
                        onClick={() => {
                          setFile(null);
                          setPreview(null);
                        }}
                        className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleUpload}
                        disabled={loading}
                        className="flex-1 py-3 px-6 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? '⏳ Importando...' : '📱 Importar e Criar Pesquisa'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Modo Direto Sistema */}
            {importMode === 'direto' && (
              <div className="border-2 border-dashed rounded-lg p-6 border-gray-300">
                {/* Filtro de dias sem venda */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Produtos sem venda há pelo menos:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={diasSemVenda}
                      onChange={(e) => setDiasSemVenda(parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <span className="text-gray-600">dias</span>
                  </div>
                </div>

                {/* Filtro de curvas */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Curvas ABC:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['A', 'B', 'C', 'D', 'E'].map((curva) => (
                      <button
                        key={curva}
                        onClick={() => toggleCurva(curva)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          curvasSelecionadas.includes(curva)
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Curva {curva}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurvasSelecionadas(['A', 'B', 'C', 'D', 'E'])}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        curvasSelecionadas.length === 5
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      TODAS
                    </button>

                    {/* Botao Configurar Peculiaridades */}
                    <button
                      onClick={() => setShowPeculiaridadesModal(true)}
                      className="px-4 py-2 rounded-lg font-medium transition-colors bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Configurar Peculiaridades
                    </button>
                  </div>
                </div>

                {/* Filtro de seções (opcional) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seções (opcional):
                  </label>
                  {loadingSections ? (
                    <p className="text-gray-500 text-sm">Carregando seções...</p>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {secoes.map((secao) => (
                        <button
                          key={secao}
                          onClick={() => toggleSecao(secao)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            secoesSelecionadas.includes(secao)
                              ? 'bg-orange-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {secao}
                        </button>
                      ))}
                    </div>
                  )}
                  {secoesSelecionadas.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {secoesSelecionadas.length} seção(ões) selecionada(s)
                    </p>
                  )}
                </div>

                <button
                  onClick={loadProductsForRupture}
                  disabled={loadingProducts}
                  className="w-full py-3 px-6 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingProducts ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Buscando produtos...
                    </>
                  ) : (
                    <>🔍 Buscar Produtos</>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center mt-3">
                  Busca produtos diretamente do sistema ERP com os filtros selecionados
                </p>
              </div>
            )}

            {/* Produtos carregados do sistema (modo direto) */}
            {importMode === 'direto' && parsedItems.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <span className="text-green-500 text-2xl mr-2">✅</span>
                    <div>
                      <p className="font-semibold text-gray-700">{parsedItems.length} produtos carregados</p>
                      <p className="text-sm text-gray-500">
                        Filtro: {diasSemVenda}+ dias sem venda | Curvas: {curvasSelecionadas.join(', ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setParsedItems([]);
                      setSuccess('');
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑️ Limpar
                  </button>
                </div>

                {/* Preview dos itens */}
                <div className="mb-4 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Código</th>
                        <th className="px-2 py-1 text-left">Produto</th>
                        <th className="px-2 py-1 text-left">Fornecedor</th>
                        <th className="px-2 py-1 text-left">Curva</th>
                        <th className="px-2 py-1 text-center">Últ. Venda</th>
                        <th className="px-2 py-1 text-right">Dias</th>
                        <th className="px-2 py-1 text-right">Estoque</th>
                        <th className="px-2 py-1 text-left">Seção</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedItems.slice(0, 10).map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-2 py-1">{item.codigo_barras || '-'}</td>
                          <td className="px-2 py-1 truncate max-w-[120px]">{item.descricao}</td>
                          <td className="px-2 py-1 truncate max-w-[120px]">{item.fornecedor || '-'}</td>
                          <td className="px-2 py-1">{item.curva || '-'}</td>
                          <td className="px-2 py-1 text-center">{item.dta_ult_venda ? new Date(item.dta_ult_venda).toLocaleDateString('pt-BR') : '-'}</td>
                          <td className="px-2 py-1 text-right">{item.dias_sem_venda != null ? item.dias_sem_venda : '-'}</td>
                          <td className="px-2 py-1 text-right">{item.estoque_atual || 0}</td>
                          <td className="px-2 py-1 truncate max-w-[80px]">{item.secao || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedItems.length > 10 && (
                    <p className="text-center text-gray-500 text-xs py-2">
                      ... e mais {parsedItems.length - 10} produtos
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Pesquisa:
                  </label>
                  <input
                    type="text"
                    value={nomePesquisa}
                    onChange={(e) => setNomePesquisa(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: Pesquisa 30/12/2025"
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setParsedItems([]);
                      setNomePesquisa('');
                      setSuccess('');
                    }}
                    className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateSurveyFromItems}
                    disabled={loading || parsedItems.length === 0}
                    className="flex-1 py-3 px-6 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? '⏳ Criando...' : '✅ Criar Pesquisa'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Calendário de Auditorias */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={prevMonth}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                title="Mês anterior"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>

              <h3 className="text-sm font-bold text-gray-800 capitalize">
                {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>

              <button
                onClick={nextMonth}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                title="Próximo mês"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            {/* Grade do Calendário */}
            <div className="grid grid-cols-7 gap-1 mb-3">
              {/* Cabeçalho dos dias da semana */}
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                <div key={idx} className="text-center font-semibold text-gray-500 text-xs py-0.5">
                  {day}
                </div>
              ))}

              {/* Dias do mês */}
              {(() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const days = [];

                // Espaços vazios antes do primeiro dia
                for (let i = 0; i < firstDay; i++) {
                  days.push(<div key={`empty-${i}`} className=""></div>);
                }

                // Dias do mês
                for (let day = 1; day <= daysInMonth; day++) {
                  const dayAudits = getDayAudits(day);
                  const colorClass = getDayColor(day);

                  days.push(
                    <div
                      key={day}
                      className={`aspect-square flex items-center justify-center rounded text-xs font-semibold cursor-pointer transition-all hover:shadow-md ${colorClass}`}
                      title={dayAudits.length > 0 ? `${dayAudits.length} auditoria(s)` : 'Sem auditoria'}
                    >
                      {day}
                    </div>
                  );
                }

                return days;
              })()}
            </div>

            {/* Lista de auditorias do mês */}
            <div className="pt-3 border-t border-gray-200">
              <h4 className="text-xs font-bold text-gray-700 mb-2">
                📋 Auditorias ({monthSurveys.length})
              </h4>

              {monthSurveys.length === 0 ? (
                <p className="text-gray-400 text-center py-3 text-xs">
                  Nenhuma auditoria este mês
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {monthSurveys.map((survey) => (
                    <div
                      key={survey.id}
                      className="bg-gray-50 rounded p-2 hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => {
                        if (survey.status === 'em_andamento') {
                          navigate(`/ruptura-verificacao/${survey.id}`);
                        } else if (survey.status === 'concluida') {
                          navigate(`/ruptura-resultados/${survey.id}`);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-gray-800 text-xs">
                          {new Date(survey.data_criacao).toLocaleDateString('pt-BR')}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${getStatusColor(survey.status)}`}>
                          {getStatusText(survey.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">{survey.nome_pesquisa}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Surveys */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">📋 Pesquisas Recentes</h2>

          {recentSurveys.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma pesquisa criada ainda
            </p>
          ) : (
            <div className="space-y-4">
              {recentSurveys.map((survey) => (
                <div
                  key={survey.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">
                      {survey.nome_pesquisa}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(survey.status)}`}>
                      {getStatusText(survey.status)}
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  {survey.status === 'em_andamento' && (
                    <div className="mb-3 bg-orange-50 p-3 rounded-lg border border-orange-200">
                      {console.log('🟡 RENDERIZANDO BARRA:', {
                        id: survey.id,
                        status: survey.status,
                        total: survey.total_itens,
                        verificados: survey.itens_verificados,
                        encontrados: survey.itens_encontrados,
                        nao_encontrados: survey.itens_nao_encontrados
                      })}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-orange-800">
                          📊 Progresso: {survey.itens_verificados || 0} de {survey.total_itens || 0}
                        </span>
                        <span className="text-sm font-semibold text-orange-800">
                          {survey.total_itens > 0 ? Math.round(((survey.itens_verificados || 0) / survey.total_itens) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-3 shadow-inner">
                        <div
                          className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                          style={{
                            width: `${survey.total_itens > 0 ? ((survey.itens_verificados || 0) / survey.total_itens) * 100 : 0}%`,
                            minWidth: (survey.itens_verificados || 0) > 0 ? '3%' : '0%'
                          }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                        <span>✅ {survey.itens_encontrados || 0} encontrados</span>
                        <span>❌ {survey.itens_nao_encontrados || 0} rupturas</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Total Itens</p>
                      <p className="font-semibold text-gray-700">{survey.total_itens}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Verificados</p>
                      <p className="font-semibold text-gray-700">{survey.itens_verificados}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Encontrados</p>
                      <p className="font-semibold text-green-600">{survey.itens_encontrados}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Rupturas</p>
                      <p className="font-semibold text-red-600">{survey.itens_nao_encontrados}</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {survey.status === 'rascunho' && (
                      <button
                        onClick={() => handleStartSurvey(survey.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        📱 Iniciar Pesquisa
                      </button>
                    )}
                    {survey.status === 'em_andamento' && (
                      <button
                        onClick={() => navigate(`/ruptura-verificacao/${survey.id}`)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        ▶️ Continuar Verificação
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSurvey(survey.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      title="Excluir pesquisa"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Peculiaridades */}
      {showPeculiaridadesModal && (
        <PeculiaridadesModal onClose={() => setShowPeculiaridadesModal(false)} />
      )}
    </Layout>
  );
}
