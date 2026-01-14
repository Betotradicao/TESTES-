import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../utils/api';

export default function HortFrutLancador() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [conferenceDate, setConferenceDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const [recentConferences, setRecentConferences] = useState([]);
  const [parsedItems, setParsedItems] = useState([]);

  // Estados do calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthConferences, setMonthConferences] = useState({});

  useEffect(() => {
    loadRecentConferences();
    loadMonthConferences(currentMonth);
  }, []);

  useEffect(() => {
    loadMonthConferences(currentMonth);
  }, [currentMonth]);

  const loadRecentConferences = async () => {
    try {
      const response = await api.get('/hortfrut/conferences');
      setRecentConferences(response.data.slice(0, 5));
    } catch (err) {
      console.error('Erro ao carregar conferências:', err);
    }
  };

  const loadMonthConferences = async (monthDate) => {
    try {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      const response = await api.get(`/hortfrut/conferences/by-date?year=${year}&month=${month}`);
      setMonthConferences(response.data || {});
    } catch (err) {
      console.error('Erro ao carregar conferências do mês:', err);
    }
  };

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

  const getDayColor = (day) => {
    const today = new Date();
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateKey = dayDate.toISOString().split('T')[0];
    const hasConferences = monthConferences[dateKey] && monthConferences[dateKey].length > 0;

    if (dayDate > today) {
      return 'bg-white text-gray-400';
    }

    if (hasConferences) {
      return 'bg-green-100 text-green-800 font-semibold';
    }

    return 'bg-gray-50 text-gray-600';
  };

  const getDayConferences = (day) => {
    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateKey = dayDate.toISOString().split('T')[0];
    return monthConferences[dateKey] || [];
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

    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      setError('Apenas arquivos CSV ou Excel (.csv, .xls, .xlsx) são permitidos');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Tamanho máximo: 10MB');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Definir data como hoje
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setConferenceDate(`${year}-${month}-${day}`);

    // Ler e parsear o arquivo CSV
    if (fileExtension === '.csv') {
      parseCSVFile(selectedFile);
    }
  };

  const parseCSVFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());

        // Detectar separador (vírgula ou ponto-e-vírgula)
        const firstLine = lines[0];
        const separator = firstLine.includes(';') ? ';' : ',';

        // Pular cabeçalho
        const items = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(separator).map(col => col.trim().replace(/"/g, ''));

          // Esperado: Código, Descrição, Curva, Seção, Grupo, SubGrupo, Custo Atual, Preço Venda, Margem Ref, Margem Atual
          if (cols.length >= 2 && cols[1]) {
            items.push({
              barcode: cols[0] || '',
              productName: cols[1] || '',
              curve: cols[2] || '',
              section: cols[3] || '',
              productGroup: cols[4] || '',
              subGroup: cols[5] || '',
              currentCost: cols[6] || '',
              currentSalePrice: cols[7] || '',
              referenceMargin: cols[8] || '',
              currentMargin: cols[9] || ''
            });
          }
        }

        setParsedItems(items);
        if (items.length > 0) {
          setSuccess(`${items.length} produtos encontrados no arquivo`);
        }
      } catch (err) {
        console.error('Erro ao parsear CSV:', err);
        setError('Erro ao ler arquivo CSV');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleCreateConference = async () => {
    if (!conferenceDate) {
      setError('Selecione a data da conferência');
      return;
    }

    if (parsedItems.length === 0) {
      setError('Importe um arquivo com produtos primeiro');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Criar conferência
      const confResponse = await api.post('/hortfrut/conferences', {
        conferenceDate,
        supplierName: supplierName.trim() || null,
        invoiceNumber: invoiceNumber.trim() || null,
        observations: observations.trim() || null
      });

      const conferenceId = confResponse.data.id;

      // 2. Importar itens
      await api.post(`/hortfrut/conferences/${conferenceId}/items`, {
        items: parsedItems
      });

      setSuccess(`Conferência criada com ${parsedItems.length} produtos!`);

      // Recarregar listas
      await loadRecentConferences();
      await loadMonthConferences(currentMonth);

      // Limpar campos
      setFile(null);
      setParsedItems([]);
      setConferenceDate('');
      setSupplierName('');
      setInvoiceNumber('');
      setObservations('');

      // Redirecionar para conferência
      setTimeout(() => {
        navigate(`/hortfrut-conferencia/${conferenceId}`);
      }, 1500);

    } catch (err) {
      console.error('Erro ao criar conferência:', err);
      setError(err.response?.data?.error || 'Erro ao criar conferência');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConference = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta conferência?')) {
      return;
    }

    try {
      await api.delete(`/hortfrut/conferences/${id}`);
      await loadRecentConferences();
      await loadMonthConferences(currentMonth);
      setSuccess('Conferência excluída com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir conferência');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Pendente</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Em Andamento</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Finalizada</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{status}</span>;
    }
  };

  return (
    <Layout title="Lançador HortFruti">
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">🥬 Lançador HortFruti</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Confira mercadorias HortFruti na chegada, registre pesos e calcule preços
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

        {/* Layout: Upload + Calendário */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Upload Area - 2/3 do espaço */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Nova Conferência</h2>

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
              <label htmlFor="fileInput" className="cursor-pointer">
                <div className="text-5xl mb-3">📋</div>
                <p className="text-base font-semibold text-gray-700 mb-1">
                  Clique ou arraste planilha de produtos HortFruti
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
                        {(file.size / 1024).toFixed(2)} KB - {parsedItems.length} produtos
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setParsedItems([]);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑️ Remover
                  </button>
                </div>

                {/* Preview dos itens */}
                {parsedItems.length > 0 && (
                  <div className="mb-4 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">Código</th>
                          <th className="px-2 py-1 text-left">Produto</th>
                          <th className="px-2 py-1 text-left">Curva</th>
                          <th className="px-2 py-1 text-right">Custo</th>
                          <th className="px-2 py-1 text-right">Preço</th>
                          <th className="px-2 py-1 text-right">Margem Ref</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedItems.slice(0, 10).map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-2 py-1">{item.barcode}</td>
                            <td className="px-2 py-1 truncate max-w-[150px]">{item.productName}</td>
                            <td className="px-2 py-1">{item.curve}</td>
                            <td className="px-2 py-1 text-right">{item.currentCost ? `R$ ${parseFloat(item.currentCost).toFixed(2)}` : '-'}</td>
                            <td className="px-2 py-1 text-right">{item.currentSalePrice ? `R$ ${parseFloat(item.currentSalePrice).toFixed(2)}` : '-'}</td>
                            <td className="px-2 py-1 text-right">{item.referenceMargin ? `${item.referenceMargin}%` : '-'}</td>
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
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📅 Data da Conferência: *
                    </label>
                    <input
                      type="date"
                      value={conferenceDate}
                      onChange={(e) => setConferenceDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🚚 Fornecedor:
                    </label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Nome do fornecedor (opcional)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📄 Nota Fiscal:
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Número da NF (opcional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📝 Observações:
                    </label>
                    <input
                      type="text"
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Observações (opcional)"
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setFile(null);
                      setParsedItems([]);
                      setConferenceDate('');
                      setSupplierName('');
                      setInvoiceNumber('');
                      setObservations('');
                    }}
                    className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateConference}
                    disabled={loading || parsedItems.length === 0}
                    className="flex-1 py-3 px-6 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? '⏳ Criando...' : '✅ Iniciar Conferência'}
                  </button>
                </div>
              </div>
            )}

            {/* Informações sobre o formato */}
            <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="font-semibold text-orange-900 mb-2">ℹ️ Formato do arquivo</h3>
              <ul className="text-sm text-orange-800 space-y-1">
                <li>• A planilha deve conter as colunas: <strong>Código de Barras, Descrição, Curva, Seção, Grupo, SubGrupo, Custo Atual, Preço Venda, Margem Referência, Margem Atual</strong></li>
                <li>• Na conferência, você informará: <strong>Novo Custo, Tipo de Caixa, Quantidade de Caixas, Peso Bruto</strong></li>
                <li>• O sistema calculará: <strong>Peso Líquido, Preço Sugerido (baseado na margem de referência), Margem se manter preço atual</strong></li>
              </ul>
            </div>
          </div>

          {/* Calendário - 1/3 do espaço */}
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
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                <div key={idx} className="text-center font-semibold text-gray-500 text-xs py-0.5">
                  {day}
                </div>
              ))}

              {(() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const days = [];

                for (let i = 0; i < firstDay; i++) {
                  days.push(<div key={`empty-${i}`} className=""></div>);
                }

                for (let day = 1; day <= daysInMonth; day++) {
                  const dayConfs = getDayConferences(day);
                  const colorClass = getDayColor(day);

                  days.push(
                    <div
                      key={day}
                      className={`aspect-square flex items-center justify-center rounded text-xs font-semibold cursor-pointer transition-all hover:shadow-md ${colorClass}`}
                      title={dayConfs.length > 0 ? `${dayConfs.length} conferência(s)` : 'Sem conferências'}
                    >
                      {day}
                    </div>
                  );
                }

                return days;
              })()}
            </div>

            {/* Lista de conferências do mês */}
            <div className="pt-3 border-t border-gray-200">
              <h4 className="text-xs font-bold text-gray-700 mb-2">
                📋 Conferências ({Object.values(monthConferences).flat().length})
              </h4>

              {Object.values(monthConferences).flat().length === 0 ? (
                <p className="text-gray-400 text-center py-3 text-xs">
                  Nenhuma conferência este mês
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {Object.values(monthConferences).flat().map((conf) => (
                    <div
                      key={conf.id}
                      className="bg-gray-50 rounded p-2 hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => navigate(`/hortfrut-conferencia/${conf.id}`)}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-gray-800 text-xs">
                          {new Date(conf.conferenceDate).toLocaleDateString('pt-BR')}
                        </span>
                        {getStatusBadge(conf.status)}
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {conf.supplierName || 'Sem fornecedor'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conferências Recentes */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">📋 Conferências Recentes</h2>

          {recentConferences.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma conferência criada ainda
            </p>
          ) : (
            <div className="space-y-4">
              {recentConferences.map((conf) => (
                <div
                  key={conf.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">
                      {new Date(conf.conferenceDate).toLocaleDateString('pt-BR')}
                      {conf.supplierName && ` - ${conf.supplierName}`}
                    </h3>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(conf.status)}
                      <span className="text-sm text-gray-500">
                        {new Date(conf.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Nota Fiscal</p>
                      <p className="font-semibold text-gray-700">{conf.invoiceNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Peso Esperado</p>
                      <p className="font-semibold text-gray-700">
                        {conf.totalExpectedWeight ? `${parseFloat(conf.totalExpectedWeight).toFixed(2)} kg` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Peso Real</p>
                      <p className="font-semibold text-gray-700">
                        {conf.totalActualWeight ? `${parseFloat(conf.totalActualWeight).toFixed(2)} kg` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Custo Total</p>
                      <p className="font-semibold text-gray-700">
                        {conf.totalCost ? `R$ ${parseFloat(conf.totalCost).toFixed(2)}` : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigate(`/hortfrut-conferencia/${conf.id}`)}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                    >
                      {conf.status === 'completed' ? '📊 Ver Detalhes' : '✏️ Continuar'}
                    </button>
                    <button
                      onClick={() => handleDeleteConference(conf.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      title="Excluir conferência"
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
