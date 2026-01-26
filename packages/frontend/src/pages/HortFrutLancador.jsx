import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Layout from '../components/Layout';
import { api } from '../utils/api';

export default function HortFrutLancador() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [conferenceDate, setConferenceDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const [recentConferences, setRecentConferences] = useState([]);
  const [parsedItems, setParsedItems] = useState([]);

  // Estados do calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthConferences, setMonthConferences] = useState({});

  // Estados para modo Direto do Sistema
  const [importMode, setImportMode] = useState('arquivo'); // 'arquivo' ou 'direto'
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    loadRecentConferences();
    loadMonthConferences(currentMonth);
  }, []);

  // Carregar seções quando mudar para modo direto
  useEffect(() => {
    if (importMode === 'direto' && sections.length === 0) {
      loadSections();
    }
  }, [importMode]);

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

  // Carregar seções do Oracle
  const loadSections = async () => {
    setLoadingSections(true);
    try {
      const response = await api.get('/products/sections-oracle');
      // sections-oracle retorna array de {codigo, nome}
      const sectionNames = (response.data || []).map(s => s.nome);
      setSections(sectionNames);
      // Pré-selecionar seção "HORT FRUTI" exata ou que contenha "HORT"
      const hortSection = sectionNames.find(s =>
        s.toUpperCase() === 'HORT FRUTI' || s.toUpperCase().includes('HORT') || s.toUpperCase().includes('FLV')
      );
      if (hortSection) {
        setSelectedSection(hortSection);
      }
    } catch (err) {
      console.error('Erro ao carregar seções:', err);
      setError('Erro ao carregar seções do sistema');
    } finally {
      setLoadingSections(false);
    }
  };

  // Carregar produtos por seção do Oracle
  const loadProductsBySection = async () => {
    if (!selectedSection) {
      setError('Selecione uma seção');
      return;
    }

    setLoadingProducts(true);
    setError('');

    try {
      const response = await api.get(`/products/by-section-oracle?section=${encodeURIComponent(selectedSection)}`);
      const items = response.data.items || [];

      setParsedItems(items);

      if (items.length > 0) {
        setSuccess(`${items.length} produtos encontrados na seção "${selectedSection}"`);
        // Definir data como hoje
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setConferenceDate(`${year}-${month}-${day}`);
      } else {
        setError('Nenhum produto encontrado nesta seção');
      }
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setError(err.response?.data?.error || 'Erro ao carregar produtos da seção');
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadMonthConferences = async (monthDate) => {
    try {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      const response = await api.get(`/hortfrut/conferences/by-date?year=${year}&month=${month}`);

      // Re-agrupar usando a data correta de cada conferência (evita problema de timezone do backend)
      const allConferences = Object.values(response.data || {}).flat();
      const regrouped = {};

      for (const conf of allConferences) {
        // Extrair data diretamente da string (sem conversão de Date)
        const dateKey = String(conf.conferenceDate).split('T')[0];
        if (!regrouped[dateKey]) {
          regrouped[dateKey] = [];
        }
        regrouped[dateKey].push(conf);
      }

      console.log('Conferências reagrupadas:', regrouped);
      console.log('Chaves (datas):', Object.keys(regrouped));
      setMonthConferences(regrouped);
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
    const hasConferences = getDayConferences(day).length > 0;

    // Dia futuro - branco
    if (dayDate > today) {
      return 'bg-white text-gray-400';
    }

    // Dia passado com conferência - verde claro
    if (hasConferences) {
      return 'bg-green-100 text-green-800 font-semibold';
    }

    // Dia passado sem conferência - vermelho claro
    return 'bg-red-100 text-red-600';
  };

  const getDayConferences = (day) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${month}-${dayStr}`;
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

    // Ler e parsear o arquivo
    if (fileExtension === '.csv') {
      parseCSVFile(selectedFile);
    } else if (fileExtension === '.xls' || fileExtension === '.xlsx') {
      parseExcelFile(selectedFile);
    }
  };

  const parseExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('=== EXCEL DEBUG ===');

        // Encontrar a linha do cabeçalho real (procurar por "Código" ou "Descri")
        let headerLineIndex = 0;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i];
          if (row && row.length > 0) {
            const rowText = row.join(' ').toLowerCase();
            if (rowText.includes('código') || rowText.includes('codigo') || rowText.includes('descri')) {
              headerLineIndex = i;
              console.log(`Cabeçalho encontrado na linha ${i}`);
              break;
            }
          }
        }

        // Parsear cabeçalho para encontrar índices das colunas
        const headerRow = jsonData[headerLineIndex] || [];
        const headerCols = headerRow.map(col => String(col || '').trim().toLowerCase());
        console.log('Colunas do cabeçalho:', headerCols);

        // Mapear índices das colunas por nome
        const colIndex = {
          barcode: headerCols.findIndex(c => c.includes('código') || c.includes('codigo') || c.includes('barras')),
          productName: headerCols.findIndex(c => (c.includes('descri') && !c.includes('grupo') && !c.includes('seção') && !c.includes('secao') && !c.includes('subgrupo') && !c.includes('fornecedor')) || c.includes('produto')),
          curve: headerCols.findIndex(c => c === 'curva'),
          currentCost: headerCols.findIndex(c => c.includes('custo')),
          currentSalePrice: headerCols.findIndex(c => c.includes('venda') && !c.includes('média') && !c.includes('media') && !c.includes('data')),
          referenceMargin: headerCols.findIndex(c => c.includes('margem') && c.includes('ref')),
          currentMargin: headerCols.findIndex(c => c.includes('mark') || (c.includes('margem') && c.includes('prat'))),
          section: headerCols.findIndex(c => (c.includes('seção') || c.includes('secao')) && c.includes('descri')),
          productGroup: headerCols.findIndex(c => c.includes('grupo') && !c.includes('sub') && c.includes('descri')),
          subGroup: headerCols.findIndex(c => c.includes('subgrupo') || (c.includes('sub') && c.includes('grupo')))
        };

        console.log('Índices das colunas detectados:', colIndex);

        // Se não encontrou pelo nome, usar posições fixas (formato HortFrut original)
        const useFixedPositions = colIndex.productName === -1;
        if (useFixedPositions) {
          console.log('Usando posições fixas (formato HortFrut)');
          colIndex.barcode = 0;
          colIndex.productName = 1;
          colIndex.curve = 2;
          colIndex.currentCost = 3;
          colIndex.currentSalePrice = 4;
          colIndex.referenceMargin = 8;
          colIndex.currentMargin = 9;
          colIndex.section = 10;
          colIndex.productGroup = 11;
          colIndex.subGroup = 12;
        }

        // Processar dados (pular cabeçalho)
        const items = [];
        for (let i = headerLineIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 2) continue;

          // Verificar se tem dados válidos
          const productName = colIndex.productName >= 0 ? String(row[colIndex.productName] || '').trim() : '';
          if (!productName || productName.length < 2) continue;

          // Ignorar linhas que parecem cabeçalho de empresa
          if (productName.toLowerCase().includes('supermercado') ||
              productName.toLowerCase().includes('cnpj') ||
              productName.toLowerCase().includes('cep')) continue;

          items.push({
            barcode: colIndex.barcode >= 0 ? String(row[colIndex.barcode] || '').trim() : '',
            productName: productName,
            curve: colIndex.curve >= 0 ? String(row[colIndex.curve] || '').trim() : '',
            currentCost: colIndex.currentCost >= 0 ? String(row[colIndex.currentCost] || '').replace(',', '.') : '',
            currentSalePrice: colIndex.currentSalePrice >= 0 ? String(row[colIndex.currentSalePrice] || '').replace(',', '.') : '',
            referenceMargin: colIndex.referenceMargin >= 0 ? String(row[colIndex.referenceMargin] || '').replace(',', '.') : '',
            currentMargin: colIndex.currentMargin >= 0 ? String(row[colIndex.currentMargin] || '').replace(',', '.') : '',
            section: colIndex.section >= 0 ? String(row[colIndex.section] || '').trim() : '',
            productGroup: colIndex.productGroup >= 0 ? String(row[colIndex.productGroup] || '').trim() : '',
            subGroup: colIndex.subGroup >= 0 ? String(row[colIndex.subGroup] || '').trim() : ''
          });
        }

        console.log('Primeiro item parseado:', items[0]);
        console.log('Total de itens:', items.length);
        console.log('=== FIM EXCEL DEBUG ===');

        setParsedItems(items);
        if (items.length > 0) {
          setSuccess(`${items.length} produtos encontrados no arquivo Excel`);
        }
      } catch (err) {
        console.error('Erro ao parsear Excel:', err);
        setError('Erro ao ler arquivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const parseCSVFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());

        console.log('=== CSV DEBUG ===');
        console.log('Total de linhas:', lines.length);
        console.log('Primeiras 6 linhas:');
        for (let i = 0; i < Math.min(6, lines.length); i++) {
          console.log(`  Linha ${i}: "${lines[i].substring(0, 80)}..."`);
        }

        // Detectar separador - procurar linha com mais separadores (cabeçalho real)
        let separator = ';';
        let headerLineIndex = 0;
        let maxSeparators = 0;

        for (let i = 0; i < Math.min(10, lines.length); i++) {
          const semicolonCount = (lines[i].match(/;/g) || []).length;
          const commaCount = (lines[i].match(/,/g) || []).length;
          const lineMaxSep = Math.max(semicolonCount, commaCount);

          if (lineMaxSep > maxSeparators) {
            maxSeparators = lineMaxSep;
            headerLineIndex = i;
            separator = semicolonCount >= commaCount ? ';' : ',';
          }
        }

        console.log(`Cabeçalho detectado na linha ${headerLineIndex} com ${maxSeparators} separadores "${separator}"`);
        console.log(`Linha do cabeçalho: "${lines[headerLineIndex]}"`);

        // Parsear cabeçalho para encontrar índices das colunas
        const headerCols = lines[headerLineIndex].split(separator).map(col => col.trim().replace(/"/g, '').toLowerCase());
        console.log('Colunas do cabeçalho parseadas:', headerCols);

        // Normalizar texto removendo acentos para comparação
        const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        // Mapear índices das colunas por nome (com normalização de acentos)
        const colIndex = {
          barcode: headerCols.findIndex(c => {
            const cn = normalize(c);
            return cn.includes('codigo') || cn.includes('barras');
          }),
          productName: headerCols.findIndex(c => {
            const cn = normalize(c);
            return (cn.includes('descri') && cn.includes('completa')) ||
                   (cn.includes('descri') && !cn.includes('grupo') && !cn.includes('secao') && !cn.includes('subgrupo') && !cn.includes('fornecedor')) ||
                   cn.includes('produto');
          }),
          curve: headerCols.findIndex(c => normalize(c) === 'curva'),
          currentCost: headerCols.findIndex(c => normalize(c).includes('custo')),
          currentSalePrice: headerCols.findIndex(c => {
            const cn = normalize(c);
            return cn === 'venda' || (cn.includes('venda') && !cn.includes('media') && !cn.includes('data') && !cn.includes('ult'));
          }),
          referenceMargin: headerCols.findIndex(c => {
            const cn = normalize(c);
            return cn.includes('margem') && cn.includes('ref');
          }),
          currentMargin: headerCols.findIndex(c => {
            const cn = normalize(c);
            return cn.includes('mark') || (cn.includes('margem') && cn.includes('prat'));
          }),
          section: headerCols.findIndex(c => {
            const cn = normalize(c);
            return cn.includes('secao') && cn.includes('descri');
          }),
          productGroup: headerCols.findIndex(c => {
            const cn = normalize(c);
            return cn.includes('grupo') && !cn.includes('sub') && cn.includes('descri');
          }),
          subGroup: headerCols.findIndex(c => {
            const cn = normalize(c);
            return cn.includes('subgrupo') || (cn.includes('sub') && cn.includes('grupo'));
          })
        };

        console.log('Índices das colunas detectados:', colIndex);

        // Se não encontrou productName pelo nome, usar posição 1 (padrão)
        if (colIndex.productName === -1) {
          console.log('productName não encontrado, usando posição 1');
          colIndex.productName = 1;
        }
        if (colIndex.barcode === -1) {
          console.log('barcode não encontrado, usando posição 0');
          colIndex.barcode = 0;
        }
        if (colIndex.curve === -1) {
          console.log('curve não encontrado, usando posição 2');
          colIndex.curve = 2;
        }
        if (colIndex.currentCost === -1) {
          console.log('currentCost não encontrado, usando posição 3');
          colIndex.currentCost = 3;
        }
        if (colIndex.currentSalePrice === -1) {
          console.log('currentSalePrice não encontrado, usando posição 4');
          colIndex.currentSalePrice = 4;
        }

        console.log('Índices finais:', colIndex);

        // Processar dados (pular cabeçalho)
        const items = [];
        for (let i = headerLineIndex + 1; i < lines.length; i++) {
          const cols = lines[i].split(separator).map(col => col.trim().replace(/"/g, ''));

          // Debug primeira linha de dados
          if (i === headerLineIndex + 1) {
            console.log('Primeira linha de dados parseada:', cols);
            console.log(`  barcode[${colIndex.barcode}]: "${cols[colIndex.barcode]}"`);
            console.log(`  productName[${colIndex.productName}]: "${cols[colIndex.productName]}"`);
            console.log(`  curve[${colIndex.curve}]: "${cols[colIndex.curve]}"`);
            console.log(`  currentCost[${colIndex.currentCost}]: "${cols[colIndex.currentCost]}"`);
            console.log(`  currentSalePrice[${colIndex.currentSalePrice}]: "${cols[colIndex.currentSalePrice]}"`);
          }

          // Verificar se tem dados válidos
          const productName = colIndex.productName >= 0 ? cols[colIndex.productName] : '';
          if (!productName || productName.length < 2) continue;

          // Ignorar linhas que parecem cabeçalho de empresa
          const pnLower = productName.toLowerCase();
          if (pnLower.includes('supermercado') || pnLower.includes('cnpj') || pnLower.includes('cep')) continue;

          items.push({
            barcode: colIndex.barcode >= 0 ? (cols[colIndex.barcode] || '') : '',
            productName: productName,
            curve: colIndex.curve >= 0 ? (cols[colIndex.curve] || '') : '',
            currentCost: colIndex.currentCost >= 0 ? (cols[colIndex.currentCost] || '').replace(',', '.') : '',
            currentSalePrice: colIndex.currentSalePrice >= 0 ? (cols[colIndex.currentSalePrice] || '').replace(',', '.') : '',
            referenceMargin: colIndex.referenceMargin >= 0 ? (cols[colIndex.referenceMargin] || '').replace(',', '.') : '',
            currentMargin: colIndex.currentMargin >= 0 ? (cols[colIndex.currentMargin] || '').replace(',', '.') : '',
            section: colIndex.section >= 0 ? (cols[colIndex.section] || '') : '',
            productGroup: colIndex.productGroup >= 0 ? (cols[colIndex.productGroup] || '') : '',
            subGroup: colIndex.subGroup >= 0 ? (cols[colIndex.subGroup] || '') : ''
          });
        }

        console.log('Primeiro item final:', items[0]);
        console.log('Total de itens:', items.length);
        console.log('=== FIM CSV DEBUG ===');

        setParsedItems(items);
        if (items.length > 0) {
          setSuccess(`${items.length} produtos encontrados no arquivo`);
        }
      } catch (err) {
        console.error('Erro ao parsear CSV:', err);
        setError('Erro ao ler arquivo CSV');
      }
    };
    reader.readAsText(file, 'ISO-8859-1'); // Usar encoding latino para arquivos BR
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

  // Formatar data sem conversão de timezone (evita problema de -1 dia)
  const formatConferenceDate = (dateStr) => {
    if (!dateStr) return '-';
    // dateStr pode ser "2026-01-20" ou "2026-01-20T00:00:00.000Z"
    const datePart = dateStr.split('T')[0]; // Pega só a parte da data
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
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

            {/* Toggle: Arquivo ou Direto */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  setImportMode('arquivo');
                  setParsedItems([]);
                  setFile(null);
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
                  setSuccess('');
                  setError('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  importMode === 'direto'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔗 Direto do Sistema
              </button>
            </div>

            {/* Modo Arquivo */}
            {importMode === 'arquivo' && (
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
            )}

            {/* Modo Direto do Sistema */}
            {importMode === 'direto' && (
              <div className="border-2 border-dashed rounded-lg p-6 border-gray-300">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📦 Selecione a Seção:
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    disabled={loadingSections}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">
                      {loadingSections ? 'Carregando seções...' : 'Selecione uma seção'}
                    </option>
                    {sections.map((section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={loadProductsBySection}
                  disabled={loadingProducts || !selectedSection}
                  className="w-full py-3 px-6 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingProducts ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Carregando produtos...
                    </>
                  ) : (
                    <>🔍 Buscar Produtos da Seção</>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center mt-3">
                  Busca produtos diretamente do sistema ERP pela seção selecionada
                </p>
              </div>
            )}

            {file && importMode === 'arquivo' && (
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

                <div className="mb-4">
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

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setFile(null);
                      setParsedItems([]);
                      setConferenceDate('');
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

            {/* Produtos carregados do Sistema (modo direto) */}
            {importMode === 'direto' && parsedItems.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <span className="text-green-500 text-2xl mr-2">✅</span>
                    <div>
                      <p className="font-semibold text-gray-700">Seção: {selectedSection}</p>
                      <p className="text-sm text-gray-500">
                        {parsedItems.length} produtos carregados do Sistema
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

                <div className="mb-4">
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

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setParsedItems([]);
                      setConferenceDate('');
                      setSuccess('');
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
            {importMode === 'arquivo' && (
              <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-semibold text-orange-900 mb-2">ℹ️ Formato do arquivo</h3>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• A planilha deve conter as colunas: <strong>Código de Barras, Descrição, Curva, Seção, Grupo, SubGrupo, Custo Atual, Preço Venda, Margem Referência, Margem Atual</strong></li>
                  <li>• Na conferência, você informará: <strong>Novo Custo, Tipo de Caixa, Quantidade de Caixas, Peso Bruto</strong></li>
                  <li>• O sistema calculará: <strong>Peso Líquido, Preço Sugerido (baseado na margem de referência), Margem se manter preço atual</strong></li>
                </ul>
              </div>
            )}
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
                          {formatConferenceDate(conf.conferenceDate)}
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
                      {formatConferenceDate(conf.conferenceDate)}
                      {conf.supplierName && ` - ${conf.supplierName}`}
                    </h3>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(conf.status)}
                      <span className="text-sm text-gray-500">
                        {formatConferenceDate(conf.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3">
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
