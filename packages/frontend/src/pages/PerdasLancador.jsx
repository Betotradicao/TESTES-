import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import { useLoja } from '../contexts/LojaContext';

export default function PerdasLancador() {
  const navigate = useNavigate();
  const { lojaSelecionada } = useLoja();
  const [file, setFile] = useState(null);
  const [nomeLote, setNomeLote] = useState('');
  const [dataInicio, setDataInicio] = useState(''); // Data inicial do período
  const [dataFim, setDataFim] = useState(''); // Data final do período
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const [recentLotes, setRecentLotes] = useState([]);

  // Estados do calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthLotes, setMonthLotes] = useState([]);

  // Carregar lotes recentes e do mês ao montar e quando a loja mudar
  useEffect(() => {
    loadRecentLotes();
    loadMonthLotes(currentMonth);
  }, [lojaSelecionada]);

  // Recarregar lotes quando o mês mudar
  useEffect(() => {
    loadMonthLotes(currentMonth);
  }, [currentMonth, lojaSelecionada]);

  const loadRecentLotes = async () => {
    try {
      const params = lojaSelecionada ? { codLoja: lojaSelecionada } : {};
      const response = await api.get('/losses', { params });
      setRecentLotes(response.data.slice(0, 5)); // Só 5 mais recentes
    } catch (err) {
      console.error('Erro ao carregar lotes:', err);
    }
  };

  const loadMonthLotes = async (monthDate) => {
    try {
      const params = lojaSelecionada ? { codLoja: lojaSelecionada } : {};
      const response = await api.get('/losses', { params });
      const allLotes = response.data;

      // Filtrar apenas lotes do mês selecionado
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      const filtered = allLotes.filter(lote => {
        const loteDate = new Date(lote.dataImportacao);
        return loteDate.getFullYear() === year && loteDate.getMonth() === month;
      });

      setMonthLotes(filtered);
    } catch (err) {
      console.error('Erro ao carregar lotes do mês:', err);
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

  // Verificar se dia está dentro do período de algum lote
  const isDayInLotePeriodo = (day) => {
    // Criar data do dia às 12:00 para evitar problemas de timezone
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12, 0, 0);

    return monthLotes.some(lote => {
      // Se tem campos de período, usar eles
      if (lote.dataInicioPeriodo && lote.dataFimPeriodo) {
        // Extrair apenas a parte da data (YYYY-MM-DD) caso venha com timestamp
        const dataInicioStr = String(lote.dataInicioPeriodo).split('T')[0];
        const dataFimStr = String(lote.dataFimPeriodo).split('T')[0];

        // Criar datas às 12:00 para evitar problema de timezone UTC
        const dataInicio = new Date(dataInicioStr + 'T12:00:00');
        const dataFim = new Date(dataFimStr + 'T12:00:00');

        // Comparar apenas as datas (ano, mês, dia)
        const dayOnly = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
        const inicioOnly = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());
        const fimOnly = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate());

        return dayOnly >= inicioOnly && dayOnly <= fimOnly;
      }

      // Fallback para compatibilidade: usar apenas dataImportacao
      const dataImportacaoStr = String(lote.dataImportacao).split('T')[0];
      const loteDate = new Date(dataImportacaoStr + 'T12:00:00');
      return loteDate.getDate() === day &&
             loteDate.getMonth() === dayDate.getMonth() &&
             loteDate.getFullYear() === dayDate.getFullYear();
    });
  };

  // Verificar se dia tem lotes (para exibir na lista)
  const getDayLotes = (day) => {
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12, 0, 0);

    return monthLotes.filter(lote => {
      if (lote.dataInicioPeriodo && lote.dataFimPeriodo) {
        // Extrair apenas a parte da data (YYYY-MM-DD) caso venha com timestamp
        const dataInicioStr = String(lote.dataInicioPeriodo).split('T')[0];
        const dataFimStr = String(lote.dataFimPeriodo).split('T')[0];

        const dataInicio = new Date(dataInicioStr + 'T12:00:00');
        const dataFim = new Date(dataFimStr + 'T12:00:00');

        const dayOnly = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
        const inicioOnly = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());
        const fimOnly = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate());

        return dayOnly >= inicioOnly && dayOnly <= fimOnly;
      }

      const dataImportacaoStr = String(lote.dataImportacao).split('T')[0];
      const loteDate = new Date(dataImportacaoStr + 'T12:00:00');
      return loteDate.getDate() === day;
    });
  };

  // Obter cor do dia no calendário
  const getDayColor = (day) => {
    const today = new Date();
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const hasLotes = isDayInLotePeriodo(day);

    // Dia futuro - branco
    if (dayDate > today) {
      return 'bg-white text-gray-400';
    }

    // Dia passado com lotes - verde claro
    if (hasLotes) {
      return 'bg-green-100 text-green-800 font-semibold';
    }

    // Dia passado sem lotes - vermelho claro
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

  const processFile = (selectedFile) => {
    if (!selectedFile) return;

    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(selectedFile.type) && !allowedExtensions.includes(fileExtension)) {
      setError('Apenas arquivos CSV ou Excel (.csv, .xls, .xlsx) são permitidos');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Tamanho máximo: 10MB');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Gerar nome do lote automaticamente com data e hora
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, 'h');
    setNomeLote(`Perdas ${dateStr} ${timeStr}`);

    // Definir período como hoje (formato YYYY-MM-DD)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    setDataInicio(todayStr);
    setDataFim(todayStr);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Selecione um arquivo primeiro');
      return;
    }

    if (!nomeLote.trim()) {
      setError('Digite um nome para o lote');
      return;
    }

    if (!dataInicio || !dataFim) {
      setError('Selecione o período (data inicial e final)');
      return;
    }

    if (new Date(dataInicio) > new Date(dataFim)) {
      setError('Data inicial não pode ser maior que data final');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('nomeLote', nomeLote.trim());
      formData.append('dataInicio', dataInicio);
      formData.append('dataFim', dataFim);
      if (lojaSelecionada) {
        formData.append('codLoja', lojaSelecionada);
      }

      const response = await api.post('/losses/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess(`✅ Arquivo importado com sucesso! ${response.data.total} registros (${response.data.perdas} perdas, ${response.data.entradas} entradas)`);

      // Recarregar lista de lotes ANTES de limpar os campos
      await loadRecentLotes();
      await loadMonthLotes(currentMonth);

      setFile(null);
      setNomeLote('');
      setDataInicio('');
      setDataFim('');

      // Redirecionar para resultados após 3 segundos (tempo para ver o calendário atualizado)
      setTimeout(() => {
        navigate('/perdas-resultados');
      }, 3000);

    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      setError(err.response?.data?.error || 'Erro ao fazer upload do arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLote = async (nomeLote) => {
    if (!window.confirm('Tem certeza que deseja excluir este lote? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await api.delete(`/losses/${encodeURIComponent(nomeLote)}`);
      await loadRecentLotes();
      await loadMonthLotes(currentMonth);
      setSuccess('Lote excluído com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir lote');
    }
  };

  return (
    <Layout title="Lançador de Perdas">
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">📊 Lançador de Perdas</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Importe planilhas de perdas (quebras) da sua loja para análise
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
                  Clique ou arraste arquivo Excel/CSV aqui
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
                      setNomeLote('');
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑️ Remover
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Lote:
                  </label>
                  <input
                    type="text"
                    value={nomeLote}
                    onChange={(e) => setNomeLote(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Perdas 30/12/2025"
                  />
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📅 Data Inicial:
                    </label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📅 Data Final:
                    </label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-4 -mt-2">
                  Este período será usado para marcar os dias no calendário (ex: 15/12 a 31/12)
                </p>

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setFile(null);
                      setNomeLote('');
                      setDataInicio('');
                      setDataFim('');
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
                    {loading ? '⏳ Importando...' : '📱 Importar Perdas'}
                  </button>
                </div>
              </div>
            )}

            {/* Informações sobre o formato */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Formato do arquivo</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• A planilha deve conter as colunas: <strong>Código de Barras, Descrição Reduzida, Quantidade Ajuste, Custo Reposição, Descrição Ajuste Completa, Seção</strong></li>
                <li>• As primeiras linhas com cabeçalho da loja serão ignoradas automaticamente</li>
                <li>• A seção é identificada por número (1=Açougue, 2=Padaria, 3=Bebidas, etc.)</li>
                <li>• Valores negativos em "Quantidade Ajuste" representam perdas</li>
                <li>• Valores positivos representam entradas por ajuste</li>
              </ul>
            </div>
          </div>

          {/* Calendário de Lotes - 1/3 do espaço (metade do tamanho) */}
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
                  const dayLotes = getDayLotes(day);
                  const colorClass = getDayColor(day);

                  days.push(
                    <div
                      key={day}
                      className={`aspect-square flex items-center justify-center rounded text-xs font-semibold cursor-pointer transition-all hover:shadow-md ${colorClass}`}
                      title={dayLotes.length > 0 ? `${dayLotes.length} lote(s)` : 'Sem lotes'}
                    >
                      {day}
                    </div>
                  );
                }

                return days;
              })()}
            </div>

            {/* Lista de lotes do mês */}
            <div className="pt-3 border-t border-gray-200">
              <h4 className="text-xs font-bold text-gray-700 mb-2">
                📋 Lotes ({monthLotes.length})
              </h4>

              {monthLotes.length === 0 ? (
                <p className="text-gray-400 text-center py-3 text-xs">
                  Nenhum lote este mês
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {monthLotes.map((lote) => (
                    <div
                      key={lote.nomeLote}
                      className="bg-gray-50 rounded p-2 hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => navigate('/perdas-resultados')}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-gray-800 text-xs">
                          {new Date(lote.dataImportacao).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">{lote.nomeLote}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lotes Recentes */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">📋 Lotes Recentes</h2>

          {recentLotes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhum lote criado ainda
            </p>
          ) : (
            <div className="space-y-4">
              {recentLotes.map((lote) => (
                <div
                  key={lote.nomeLote}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">
                      {lote.nomeLote}
                    </h3>
                    <span className="text-sm text-gray-500">
                      {new Date(lote.dataImportacao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Total Itens</p>
                      <p className="font-semibold text-gray-700">{lote.totalRegistros || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Perdas</p>
                      <p className="font-semibold text-red-600">{lote.totalPerdas || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Entradas</p>
                      <p className="font-semibold text-green-600">{lote.totalEntradas || 0}</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigate('/perdas-resultados')}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      📊 Ver Resultados
                    </button>
                    <button
                      onClick={() => handleDeleteLote(lote.nomeLote)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      title="Excluir lote"
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
