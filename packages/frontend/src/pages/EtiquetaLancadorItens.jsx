import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function EtiquetaLancadorItens() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [nomeAuditoria, setNomeAuditoria] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const [recentSurveys, setRecentSurveys] = useState([]);

  // Estados do calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthSurveys, setMonthSurveys] = useState([]);

  // Carregar pesquisas recentes e do mês ao montar
  useEffect(() => {
    loadRecentSurveys();
    loadMonthSurveys(currentMonth);
  }, []);

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
      const response = await api.get('/label-audits');
      setRecentSurveys(response.data.slice(0, 5)); // Só 5 mais recentes
    } catch (err) {
      console.error('Erro ao carregar pesquisas:', err);
    }
  };

  const loadMonthSurveys = async (monthDate) => {
    try {
      const response = await api.get('/label-audits');
      const allSurveys = response.data;

      // Filtrar apenas auditorias do mês selecionado
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      const filtered = allSurveys.filter(survey => {
        const surveyDate = new Date(survey.data_referencia);
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

  // Verificar se dia tem auditoria CONCLUÍDA
  const getDayAudits = (day) => {
    return monthSurveys.filter(survey => {
      const surveyDate = new Date(survey.data_referencia);
      return surveyDate.getDate() === day && survey.status === 'concluida';
    });
  };

  // Obter cor do dia no calendário
  const getDayColor = (day) => {
    const today = new Date();
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const hasCompletedAudits = getDayAudits(day).length > 0;

    // Dia futuro - branco
    if (dayDate > today) {
      return 'bg-white text-gray-400';
    }

    // Dia passado com auditoria CONCLUÍDA - verde claro
    if (hasCompletedAudits) {
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

    // Gerar nome padrão da auditoria
    const today = new Date();
    const defaultName = `Auditoria ${today.toLocaleDateString('pt-BR')}`;
    setNomeAuditoria(defaultName);

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

    if (!nomeAuditoria.trim()) {
      setError('Digite um nome para a auditoria');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Recriar o FormData a partir do arquivo selecionado novamente
      // para evitar ERR_UPLOAD_FILE_CHANGED
      const formData = new FormData();
      formData.append('file', file);
      formData.append('titulo', nomeAuditoria);
      formData.append('data_referencia', new Date().toISOString().split('T')[0]); // YYYY-MM-DD

      const response = await api.post('/label-audits/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess(`✅ ${response.data.audit?.total_itens || 'Vários'} itens importados com sucesso!`);
      setFile(null);
      setPreview(null);

      // Recarregar lista de pesquisas
      await loadRecentSurveys();

      // Após 2 segundos, perguntar se quer visualizar
      setTimeout(() => {
        const start = window.confirm('Deseja visualizar a auditoria agora?');
        if (start) {
          navigate(`/etiquetas/verificar/${response.data.audit.id}`);
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
      await api.post(`/label-audits/${surveyId}/start`);
      navigate(`/etiquetas-verificacao/${surveyId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar pesquisa');
    }
  };

  const handleDeleteSurvey = async (surveyId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta pesquisa? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await api.delete(`/label-audits/${surveyId}`);
      await loadRecentSurveys();
      setSuccess('Auditoria excluída com sucesso!');
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
            Importe arquivos Excel/CSV para criar novas pesquisas de etiquetas
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
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
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
                  Nome da Auditoria:
                </label>
                <input
                  type="text"
                  value={nomeAuditoria}
                  onChange={(e) => setNomeAuditoria(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Auditoria 30/12/2025"
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
                  className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '⏳ Importando...' : '📱 Importar e Criar Auditoria'}
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
                          navigate(`/etiquetas-verificacao/${survey.id}`);
                        } else if (survey.status === 'concluida') {
                          navigate(`/etiquetas-resultados/${survey.id}`);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-gray-800 text-xs">
                          {new Date(survey.data_referencia).toLocaleDateString('pt-BR')}
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
          <h2 className="text-xl font-bold mb-4 text-gray-800">📋 Auditorias Recentes</h2>

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
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          Progresso: {survey.itens_verificados} de {survey.total_itens}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {survey.total_itens > 0 ? Math.round((survey.itens_verificados / survey.total_itens) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${survey.total_itens > 0 ? (survey.itens_verificados / survey.total_itens) * 100 : 0}%` }}
                        ></div>
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
                      <p className="text-xs text-gray-500">Etiquetas</p>
                      <p className="font-semibold text-red-600">{survey.itens_nao_encontrados}</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {survey.status === 'rascunho' && (
                      <button
                        onClick={() => handleStartSurvey(survey.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        📱 Iniciar Auditoria
                      </button>
                    )}
                    {survey.status === 'em_andamento' && (
                      <button
                        onClick={() => {
                          console.log('🔵 Botão Continuar Verificação clicado (onClick)');
                          navigate(`/etiquetas-verificacao/${survey.id}`);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          console.log('📱 Touch event no botão Continuar Verificação');
                          navigate(`/etiquetas-verificacao/${survey.id}`);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 active:bg-green-800 text-sm relative z-10"
                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
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
    </Layout>
  );
}
