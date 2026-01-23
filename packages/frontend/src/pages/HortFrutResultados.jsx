import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function HortFrutResultados() {
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Novos filtros
  const [supplierFilter, setSupplierFilter] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState(''); // '' = todas, 'no_ato' = no ato, 'posterior' = posterior
  const [qualityFilter, setQualityFilter] = useState(''); // '' = todas, 'good', 'regular', 'bad'

  // Lista de fornecedores únicos
  const [suppliers, setSuppliers] = useState([]);

  // Ordenação
  const [sortColumn, setSortColumn] = useState(''); // coluna de ordenação
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' ou 'desc'

  // Modal de foto expandida
  const [expandedPhoto, setExpandedPhoto] = useState(null);

  // Colunas padrão da tabela
  const defaultColumns = [
    { id: 'productPhoto', label: 'Foto Prod.', visible: true },
    { id: 'productName', label: 'Produto', visible: true },
    { id: 'supplierName', label: 'Fornecedor', visible: true },
    { id: 'currentCost', label: 'Custo Ant.', visible: true },
    { id: 'newCost', label: 'Novo Custo', visible: true },
    { id: 'currentSalePrice', label: 'Preço Venda', visible: true },
    { id: 'suggestedPrice', label: 'Preço Sug.', visible: true },
    { id: 'referenceMargin', label: 'Marg. Ref.', visible: true },
    { id: 'currentMargin', label: 'Marg. Atual', visible: true },
    { id: 'futureMargin', label: 'Marg. Futura', visible: true },
    { id: 'grossWeight', label: 'Peso Bruto', visible: true },
    { id: 'netWeight', label: 'Peso Líq.', visible: true },
    { id: 'totalUnits', label: 'Und. Conf.', visible: true },
    { id: 'totalValue', label: 'Valor Total', visible: true },
    { id: 'boxesInvoice', label: 'Cxs Nota', visible: true },
    { id: 'boxesConference', label: 'Cxs Conf.', visible: true },
    { id: 'boxesDifference', label: 'Dif. Cxs', visible: true },
    { id: 'boxType', label: 'Caixa Usada', visible: true },
    { id: 'boxPhoto', label: 'Foto Caixa', visible: true },
    { id: 'quality', label: 'Qualidade', visible: true },
    { id: 'photo', label: 'Foto Conf.', visible: true },
    { id: 'observations', label: 'Observações', visible: true },
  ];

  // Carregar colunas do localStorage ou usar padrão
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('hortfrut_resultados_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge com colunas padrão caso tenha novas colunas
        const savedIds = parsed.map(c => c.id);
        const newCols = defaultColumns.filter(c => !savedIds.includes(c.id));
        return [...parsed, ...newCols];
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });
  const [draggedColumn, setDraggedColumn] = useState(null);

  // Salvar colunas no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem('hortfrut_resultados_columns', JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    // Definir período padrão (dia 1 do mês atual até hoje)
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1); // Dia 1 do mês atual

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);

    loadConferences();
  }, []);

  const loadConferences = async () => {
    try {
      setLoading(true);
      let url = '/hortfrut/conferences';
      const params = new URLSearchParams();

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter) params.append('status', statusFilter);

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await api.get(url);
      const data = response.data || [];

      // Buscar detalhes de cada conferência para ter os itens
      const conferencesWithItems = await Promise.all(
        data.map(async (conf) => {
          try {
            const detailResponse = await api.get(`/hortfrut/conferences/${conf.id}`);
            return detailResponse.data;
          } catch {
            return conf;
          }
        })
      );

      setConferences(conferencesWithItems);

      // Extrair fornecedores únicos dos ITENS (não das conferências)
      const allSuppliers = [];
      for (const conf of conferencesWithItems) {
        if (conf.items) {
          for (const item of conf.items) {
            // Supplier usa fantasyName (não name)
            const supplierName = item.supplier?.fantasyName || null;
            if (item.checked && supplierName) {
              allSuppliers.push(supplierName);
            }
          }
        }
      }
      const uniqueSuppliers = [...new Set(allSuppliers)].sort();
      setSuppliers(uniqueSuppliers);
    } catch (err) {
      console.error('Erro ao carregar conferências:', err);
      setError('Erro ao carregar conferências');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadConferences();
  };

  const getQualityBadge = (quality) => {
    switch (quality) {
      case 'good':
        return <span className="text-green-600">🟢 Boa</span>;
      case 'regular':
        return <span className="text-yellow-600">🟡 Regular</span>;
      case 'bad':
        return <span className="text-red-600">🔴 Ruim</span>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  // Extrair todos os itens conferidos de todas as conferências, aplicando filtros
  const getAllCheckedItems = () => {
    const allItems = [];

    for (const conf of conferences) {
      // Adicionar apenas itens conferidos (checked = true)
      if (conf.items && conf.items.length > 0) {
        for (const item of conf.items) {
          // Somente itens checked
          if (!item.checked) continue;

          // Filtro de fornecedor (do ITEM - usar fantasyName)
          const itemSupplierName = item.supplier?.fantasyName || '';
          if (supplierFilter && itemSupplierName !== supplierFilter) {
            continue;
          }

          // Filtro de nota fiscal (do ITEM: 'immediate' = no ato, 'later' = posterior)
          if (invoiceFilter === 'no_ato' && item.invoiceStatus !== 'immediate') {
            continue;
          }
          if (invoiceFilter === 'posterior' && item.invoiceStatus !== 'later') {
            continue;
          }

          // Filtro de qualidade
          if (qualityFilter && item.quality !== qualityFilter) {
            continue;
          }

          allItems.push({
            ...item,
            conferenceId: conf.id,
            conferenceDate: conf.conferenceDate,
            supplierName: itemSupplierName, // Fornecedor do item
            invoiceNumber: conf.invoiceNumber,
          });
        }
      }
    }

    return allItems;
  };

  const checkedItems = getAllCheckedItems();

  // Função para ordenar
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Funções de Drag & Drop para reordenar colunas
  const handleDragStart = (e, columnId) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) return;

    const newColumns = [...columns];
    const draggedIndex = newColumns.findIndex(c => c.id === draggedColumn);
    const targetIndex = newColumns.findIndex(c => c.id === targetColumnId);

    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setColumns(newColumns);
    setDraggedColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Função para calcular margem atual: ((preço venda - custo anterior) / preço venda) * 100
  const calcularMargemAtual = (item) => {
    if (!item.currentSalePrice || !item.currentCost) return null;
    const precoVenda = parseFloat(item.currentSalePrice);
    const custoAtual = parseFloat(item.currentCost);
    if (precoVenda <= 0) return null;
    return ((precoVenda - custoAtual) / precoVenda) * 100;
  };

  // Função para calcular margem futura: ((preço venda - novo custo) / preço venda) * 100
  const calcularMargemFutura = (item) => {
    if (!item.currentSalePrice || !item.newCost) return null;
    const precoVenda = parseFloat(item.currentSalePrice);
    const novoCusto = parseFloat(item.newCost);
    if (precoVenda <= 0) return null;
    return ((precoVenda - novoCusto) / precoVenda) * 100;
  };

  // Ordenar itens
  const sortedItems = [...checkedItems].sort((a, b) => {
    if (!sortColumn) return 0;

    let valueA, valueB;

    switch (sortColumn) {
      case 'productName':
        valueA = a.productName || '';
        valueB = b.productName || '';
        break;
      case 'supplierName':
        valueA = a.supplierName || '';
        valueB = b.supplierName || '';
        break;
      case 'currentCost':
        valueA = parseFloat(a.currentCost) || 0;
        valueB = parseFloat(b.currentCost) || 0;
        break;
      case 'newCost':
        valueA = parseFloat(a.newCost) || 0;
        valueB = parseFloat(b.newCost) || 0;
        break;
      case 'currentSalePrice':
        valueA = parseFloat(a.currentSalePrice) || 0;
        valueB = parseFloat(b.currentSalePrice) || 0;
        break;
      case 'suggestedPrice':
        valueA = parseFloat(a.suggestedPrice) || 0;
        valueB = parseFloat(b.suggestedPrice) || 0;
        break;
      case 'referenceMargin':
        valueA = parseFloat(a.referenceMargin) || 0;
        valueB = parseFloat(b.referenceMargin) || 0;
        break;
      case 'currentMargin':
        valueA = calcularMargemAtual(a) || 0;
        valueB = calcularMargemAtual(b) || 0;
        break;
      case 'futureMargin':
        valueA = calcularMargemFutura(a) || 0;
        valueB = calcularMargemFutura(b) || 0;
        break;
      case 'grossWeight':
        valueA = parseFloat(a.grossWeight) || 0;
        valueB = parseFloat(b.grossWeight) || 0;
        break;
      case 'netWeight':
        valueA = parseFloat(a.netWeight) || 0;
        valueB = parseFloat(b.netWeight) || 0;
        break;
      case 'totalUnits':
        valueA = parseFloat(a.totalUnits) || 0;
        valueB = parseFloat(b.totalUnits) || 0;
        break;
      case 'totalValue':
        // Valor total = novo custo * quantidade (peso ou unidades)
        const totalA = a.productType === 'unit' && a.totalUnits
          ? (parseFloat(a.newCost) || 0) * parseFloat(a.totalUnits)
          : (parseFloat(a.newCost) || 0) * (parseFloat(a.netWeight) || 0);
        const totalB = b.productType === 'unit' && b.totalUnits
          ? (parseFloat(b.newCost) || 0) * parseFloat(b.totalUnits)
          : (parseFloat(b.newCost) || 0) * (parseFloat(b.netWeight) || 0);
        valueA = totalA;
        valueB = totalB;
        break;
      case 'boxesInvoice':
        valueA = parseFloat(a.invoiceBoxQuantity) || 0;
        valueB = parseFloat(b.invoiceBoxQuantity) || 0;
        break;
      case 'boxesConference':
        valueA = parseFloat(a.boxQuantity) || 0;
        valueB = parseFloat(b.boxQuantity) || 0;
        break;
      case 'boxesDifference':
        valueA = (parseFloat(a.invoiceBoxQuantity) || 0) - (parseFloat(a.boxQuantity) || 0);
        valueB = (parseFloat(b.invoiceBoxQuantity) || 0) - (parseFloat(b.boxQuantity) || 0);
        break;
      case 'boxType':
        valueA = a.box?.name || '';
        valueB = b.box?.name || '';
        break;
      case 'quality':
        valueA = a.quality || '';
        valueB = b.quality || '';
        break;
      default:
        return 0;
    }

    if (typeof valueA === 'string') {
      return sortDirection === 'asc'
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }

    return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
  });

  // Função para renderizar célula baseada no tipo de coluna
  const renderCell = (item, columnId) => {
    const margemAtual = calcularMargemAtual(item);
    const margemFutura = calcularMargemFutura(item);

    switch (columnId) {
      case 'productName':
        return (
          <>
            <p className="font-medium text-gray-900">{item.productName}</p>
            <p className="text-xs text-gray-500">{item.barcode || '-'}</p>
          </>
        );
      case 'supplierName':
        return <span className="text-gray-700 text-xs">{item.supplierName || '-'}</span>;
      case 'currentCost':
        return <span className="text-gray-600">{item.currentCost ? `R$ ${parseFloat(item.currentCost).toFixed(2)}` : '-'}</span>;
      case 'newCost':
        return <span className="font-semibold text-orange-700">{item.newCost ? `R$ ${parseFloat(item.newCost).toFixed(2)}` : '-'}</span>;
      case 'currentSalePrice':
        return <span className="font-semibold text-purple-700">{item.currentSalePrice ? `R$ ${parseFloat(item.currentSalePrice).toFixed(2)}` : '-'}</span>;
      case 'suggestedPrice':
        return <span className="font-semibold text-green-700">{item.suggestedPrice ? `R$ ${parseFloat(item.suggestedPrice).toFixed(2)}` : '-'}</span>;
      case 'referenceMargin':
        return item.referenceMargin != null ? (
          <span className="font-semibold text-blue-600">{parseFloat(item.referenceMargin).toFixed(1)}%</span>
        ) : '-';
      case 'currentMargin':
        return margemAtual != null ? (
          <span className={`font-semibold ${
            margemAtual < 0 ? 'text-red-600' :
            margemAtual < 10 ? 'text-yellow-600' : 'text-green-600'
          }`}>{margemAtual.toFixed(1)}%</span>
        ) : '-';
      case 'futureMargin':
        // Comparar margem futura com margem de referência
        const margemRef = parseFloat(item.referenceMargin) || 0;
        return margemFutura != null ? (
          <span className={`font-semibold px-2 py-1 rounded ${
            margemFutura < margemRef ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
          }`}>{margemFutura.toFixed(1)}%</span>
        ) : '-';
      case 'grossWeight':
        return <span className="text-gray-700">{item.grossWeight ? `${parseFloat(item.grossWeight).toFixed(3)} kg` : '-'}</span>;
      case 'netWeight':
        return <span className="text-gray-700">{item.netWeight ? `${parseFloat(item.netWeight).toFixed(3)} kg` : '-'}</span>;
      case 'totalUnits':
        // Apenas para produtos por unidade
        if (item.productType !== 'unit') return <span className="text-gray-300">-</span>;
        return <span className="font-semibold text-purple-700">{item.totalUnits || '-'}</span>;
      case 'totalValue':
        // Valor total = novo custo * quantidade (peso ou unidades)
        const valorTotal = item.productType === 'unit' && item.totalUnits
          ? (parseFloat(item.newCost) || 0) * parseFloat(item.totalUnits)
          : (parseFloat(item.newCost) || 0) * (parseFloat(item.netWeight) || 0);
        return <span className="font-semibold text-orange-700">{valorTotal > 0 ? `R$ ${valorTotal.toFixed(2)}` : '-'}</span>;
      case 'boxesInvoice':
        return <span className="text-gray-700">{item.invoiceBoxQuantity || '-'}</span>;
      case 'boxesConference':
        return <span className="text-gray-700">{item.boxQuantity || '-'}</span>;
      case 'boxesDifference':
        const difCaixas = (parseFloat(item.invoiceBoxQuantity) || 0) - (parseFloat(item.boxQuantity) || 0);
        if (difCaixas === 0 || (!item.invoiceBoxQuantity && !item.boxQuantity)) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <span className={`font-semibold flex items-center justify-end gap-1 ${difCaixas !== 0 ? 'text-red-600' : 'text-green-600'}`}>
            {difCaixas !== 0 && <span className="text-lg">⚠️</span>}
            {difCaixas > 0 ? `+${difCaixas}` : difCaixas}
          </span>
        );
      case 'boxType':
        return <span className="text-gray-700 text-xs">{item.box?.name || '-'}</span>;
      case 'boxPhoto':
        if (!item.box?.photoUrl) return <span className="text-gray-300">-</span>;
        return (
          <img
            src={item.box.photoUrl}
            alt="Foto da caixa"
            className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 border border-gray-200 mx-auto"
            onClick={() => setExpandedPhoto({ photos: [item.box.photoUrl], name: `Caixa - ${item.box?.name || item.productName}`, currentIndex: 0 })}
          />
        );
      case 'productPhoto':
        // Foto do produto ativado (se existir)
        if (!item.productPhotoUrl) return <span className="text-gray-300">-</span>;
        return (
          <img
            src={item.productPhotoUrl}
            alt="Foto do produto"
            className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 border border-gray-200 mx-auto"
            onClick={() => setExpandedPhoto({ photos: [item.productPhotoUrl], name: item.productName, currentIndex: 0 })}
          />
        );
      case 'quality':
        return getQualityBadge(item.quality);
      case 'photo':
        if (!item.photoUrl) return <span className="text-gray-300">-</span>;
        const photos = item.photoUrl.split(',').filter(p => p.trim());
        const firstPhoto = photos[0];
        return (
          <div className="relative inline-block">
            <img
              src={firstPhoto}
              alt="Foto do produto"
              className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 border border-gray-200 mx-auto"
              onClick={() => setExpandedPhoto({ photos, name: item.productName, currentIndex: 0 })}
            />
            {photos.length > 1 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {photos.length}
              </span>
            )}
          </div>
        );
      case 'observations':
        return item.observations ? (
          <span className="line-clamp-2 text-xs text-gray-600" title={item.observations}>{item.observations}</span>
        ) : <span className="text-gray-300">-</span>;
      default:
        return '-';
    }
  };

  // Calcular totais gerais considerando os filtros (apenas itens conferidos)
  const totals = checkedItems.reduce((acc, item) => {
    // Peso total bruto (grossWeight)
    if (item.grossWeight) {
      acc.totalWeight += parseFloat(item.grossWeight);
    }

    // Peso total líquido (netWeight)
    if (item.netWeight) {
      acc.totalNetWeight += parseFloat(item.netWeight);
    }

    // Total de unidades (apenas para produtos por unidade)
    if (item.productType === 'unit' && item.totalUnits) {
      acc.totalUnits += parseFloat(item.totalUnits);
    }

    // Total da compra (custo) - considera tipo de produto
    if (item.newCost) {
      if (item.productType === 'unit' && item.totalUnits) {
        // Produto por unidade: custo unitário * quantidade
        const custoItem = parseFloat(item.newCost) * parseFloat(item.totalUnits);
        acc.totalCost += custoItem;
      } else if (item.netWeight) {
        // Produto por KG: custo por kg * peso líquido
        const custoItem = parseFloat(item.newCost) * parseFloat(item.netWeight);
        acc.totalCost += custoItem;
      }
    }

    // Vendas simuladas - considera tipo de produto
    if (item.currentSalePrice) {
      if (item.productType === 'unit' && item.totalUnits) {
        // Produto por unidade: preço unitário * quantidade
        const vendaSimulada = parseFloat(item.currentSalePrice) * parseFloat(item.totalUnits);
        acc.totalVendasSimuladas += vendaSimulada;
      } else if (item.netWeight) {
        // Produto por KG: preço por kg * peso líquido
        const vendaSimulada = parseFloat(item.currentSalePrice) * parseFloat(item.netWeight);
        acc.totalVendasSimuladas += vendaSimulada;
      }
    }

    return acc;
  }, { totalCost: 0, totalWeight: 0, totalNetWeight: 0, totalUnits: 0, totalVendasSimuladas: 0 });

  // Lucro simulado = Vendas - Custo
  const lucroSimulado = totals.totalVendasSimuladas - totals.totalCost;

  // Margem de lucro simulada = (Vendas - Custo) / Vendas * 100
  const margemLucroSimulada = totals.totalVendasSimuladas > 0
    ? (lucroSimulado / totals.totalVendasSimuladas) * 100
    : 0;

  // Função para gerar PDF
  const generatePDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Título
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Resultados HortFruti', pageWidth / 2, 15, { align: 'center' });

    // Período
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodo = `Período: ${startDate ? startDate.split('-').reverse().join('/') : '-'} a ${endDate ? endDate.split('-').reverse().join('/') : '-'}`;
    doc.text(periodo, pageWidth / 2, 22, { align: 'center' });

    // Filtros aplicados
    let filtrosTexto = [];
    if (supplierFilter) filtrosTexto.push(`Fornecedor: ${supplierFilter}`);
    if (invoiceFilter) filtrosTexto.push(`NF: ${invoiceFilter === 'no_ato' ? 'No Ato' : 'Posterior'}`);
    if (qualityFilter) filtrosTexto.push(`Qualidade: ${qualityFilter === 'good' ? 'Boa' : qualityFilter === 'regular' ? 'Regular' : 'Ruim'}`);
    if (filtrosTexto.length > 0) {
      doc.setFontSize(9);
      doc.text(`Filtros: ${filtrosTexto.join(' | ')}`, pageWidth / 2, 27, { align: 'center' });
    }

    // Resumo
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const resumoY = filtrosTexto.length > 0 ? 35 : 30;
    doc.text('Resumo:', 14, resumoY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Itens: ${checkedItems.length}`, 14, resumoY + 5);
    doc.text(`Peso Bruto: ${totals.totalWeight.toFixed(2)} kg`, 60, resumoY + 5);
    doc.text(`Peso Líq.: ${totals.totalNetWeight.toFixed(2)} kg`, 110, resumoY + 5);
    if (totals.totalUnits > 0) {
      doc.text(`Total Unid.: ${totals.totalUnits}`, 155, resumoY + 5);
    }
    doc.text(`Custo Total: R$ ${totals.totalCost.toFixed(2)}`, 195, resumoY + 5);
    doc.text(`Margem: ${margemLucroSimulada.toFixed(1)}%`, 255, resumoY + 5);

    // Tabela
    const tableData = sortedItems.map(item => {
      const margemAtualCalc = calcularMargemAtual(item);
      const margemFutura = calcularMargemFutura(item);
      const valorTotal = item.productType === 'unit' && item.totalUnits
        ? (parseFloat(item.newCost) || 0) * parseFloat(item.totalUnits)
        : (parseFloat(item.newCost) || 0) * (parseFloat(item.netWeight) || 0);
      const difCaixas = (parseFloat(item.invoiceBoxQuantity) || 0) - (parseFloat(item.boxQuantity) || 0);

      return [
        item.productName || '-',
        item.supplierName || '-',
        item.currentCost ? `R$ ${parseFloat(item.currentCost).toFixed(2)}` : '-',
        item.newCost ? `R$ ${parseFloat(item.newCost).toFixed(2)}` : '-',
        item.currentSalePrice ? `R$ ${parseFloat(item.currentSalePrice).toFixed(2)}` : '-',
        item.suggestedPrice ? `R$ ${parseFloat(item.suggestedPrice).toFixed(2)}` : '-',
        item.referenceMargin ? `${parseFloat(item.referenceMargin).toFixed(1)}%` : '-',
        margemAtualCalc !== null ? `${margemAtualCalc.toFixed(1)}%` : '-',
        margemFutura !== null ? `${margemFutura.toFixed(1)}%` : '-',
        item.grossWeight ? `${parseFloat(item.grossWeight).toFixed(2)}` : '-',
        item.netWeight ? `${parseFloat(item.netWeight).toFixed(2)}` : '-',
        item.productType === 'unit' ? (item.totalUnits || '-') : '-',
        valorTotal > 0 ? `R$ ${valorTotal.toFixed(2)}` : '-',
        difCaixas !== 0 ? difCaixas : '-',
        item.box?.name || '-',
        item.quality === 'good' ? 'Boa' : item.quality === 'regular' ? 'Regular' : item.quality === 'bad' ? 'Ruim' : '-',
      ];
    });

    autoTable(doc, {
      startY: resumoY + 12,
      head: [['Produto', 'Forn.', 'C.Ant', 'N.Custo', 'P.Venda', 'P.Sug', 'M.Ref', 'M.Atual', 'M.Fut', 'P.Bruto', 'P.Líq', 'Und', 'V.Total', 'Dif.Cx', 'Caixa', 'Qual.']],
      body: tableData,
      styles: {
        fontSize: 5.5,
        cellPadding: 1,
      },
      headStyles: {
        fillColor: [234, 88, 12], // orange-600
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 5.5,
      },
      columnStyles: {
        0: { cellWidth: 32 }, // Produto
        1: { cellWidth: 18 }, // Fornecedor
        2: { cellWidth: 14, halign: 'right' }, // C.Ant
        3: { cellWidth: 14, halign: 'right' }, // N.Custo
        4: { cellWidth: 14, halign: 'right' }, // P.Venda
        5: { cellWidth: 14, halign: 'right' }, // P.Sug
        6: { cellWidth: 12, halign: 'right' }, // M.Ref
        7: { cellWidth: 13, halign: 'right' }, // M.Atual
        8: { cellWidth: 12, halign: 'right' }, // M.Fut
        9: { cellWidth: 14, halign: 'right' }, // P.Bruto
        10: { cellWidth: 14, halign: 'right' }, // P.Líq
        11: { cellWidth: 10, halign: 'right' }, // Und
        12: { cellWidth: 16, halign: 'right' }, // V.Total
        13: { cellWidth: 12, halign: 'center' }, // Dif.Cx
        14: { cellWidth: 18 }, // Caixa
        15: { cellWidth: 12, halign: 'center' }, // Qual.
      },
      alternateRowStyles: {
        fillColor: [255, 247, 237], // orange-50
      },
      margin: { left: 14, right: 14 },
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Gerado em ${new Date().toLocaleString('pt-BR')} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Salvar
    const fileName = `resultados-hortfruti-${startDate || 'inicio'}-a-${endDate || 'fim'}.pdf`;
    doc.save(fileName);
  };

  return (
    <Layout title="Resultados HortFruti">
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">📊 Resultados HortFruti</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Acompanhe os resultados das conferências de HortFruti
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          {/* Primeira linha de filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Final:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Todos</option>
                <option value="pending">Pendente</option>
                <option value="in_progress">Em Andamento</option>
                <option value="completed">Finalizada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor:</label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Todos</option>
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Segunda linha de filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nota Fiscal:</label>
              <select
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Todas</option>
                <option value="no_ato">No Ato (Com NF)</option>
                <option value="posterior">Posterior (Sem NF)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qualidade:</label>
              <select
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Todas</option>
                <option value="good">Boa</option>
                <option value="regular">Regular</option>
                <option value="bad">Ruim</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                onClick={handleFilter}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                🔍 Filtrar
              </button>
            </div>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Total de Itens</p>
            <p className="text-2xl font-bold text-gray-800">{checkedItems.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Peso Bruto</p>
            <p className="text-2xl font-bold text-blue-600">{totals.totalWeight.toFixed(2)} kg</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Peso Líquido</p>
            <p className="text-2xl font-bold text-blue-500">{totals.totalNetWeight.toFixed(2)} kg</p>
          </div>
          {totals.totalUnits > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Total Unidades</p>
              <p className="text-2xl font-bold text-purple-600">{totals.totalUnits}</p>
            </div>
          )}
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
            <p className="text-sm text-gray-500">Custo Total</p>
            <p className="text-2xl font-bold text-orange-600">R$ {totals.totalCost.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Vendas Simuladas</p>
            <p className="text-2xl font-bold text-green-600">R$ {totals.totalVendasSimuladas.toFixed(2)}</p>
          </div>
          <div className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${margemLucroSimulada >= 20 ? 'border-green-500' : margemLucroSimulada >= 10 ? 'border-yellow-500' : 'border-red-500'}`}>
            <p className="text-sm text-gray-500">Margem Simulada</p>
            <p className={`text-2xl font-bold ${margemLucroSimulada >= 20 ? 'text-green-600' : margemLucroSimulada >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              {margemLucroSimulada.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Tabela de Itens Conferidos */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <span>📦</span> Itens Conferidos
            </h3>
            <button
              onClick={generatePDF}
              disabled={checkedItems.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              title="Exportar para PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
          </div>
          <p className="text-xs text-gray-400 px-4 py-1 bg-gray-50 border-b">
            💡 Arraste os cabeçalhos das colunas para reordená-las
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {columns.filter(c => c.visible).map((col) => (
                    <th
                      key={col.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragEnd={handleDragEnd}
                      className={`px-3 py-3 text-xs font-medium text-gray-500 uppercase cursor-grab hover:bg-gray-100 select-none transition-all ${
                        draggedColumn === col.id ? 'opacity-50 bg-blue-100' : ''
                      } ${['productName', 'supplierName', 'observations'].includes(col.id) ? 'text-left' : ['quality', 'photo', 'boxPhoto', 'productPhoto'].includes(col.id) ? 'text-center' : 'text-right'}`}
                      onClick={() => !['photo', 'observations', 'boxPhoto', 'productPhoto'].includes(col.id) && handleSort(col.id)}
                    >
                      <span className="flex items-center gap-1 justify-inherit">
                        <span className="text-gray-300 mr-1">⋮⋮</span>
                        {col.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={columns.filter(c => c.visible).length} className="px-4 py-8 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={columns.filter(c => c.visible).length} className="px-4 py-8 text-center text-gray-500">
                      Nenhum item conferido encontrado
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((item, index) => (
                    <tr key={`${item.conferenceId}-${item.id}-${index}`} className="hover:bg-gray-50">
                      {columns.filter(c => c.visible).map((col) => (
                        <td
                          key={col.id}
                          className={`px-3 py-2 ${
                            ['productName', 'supplierName', 'observations'].includes(col.id) ? 'text-left' :
                            ['quality', 'photo', 'boxPhoto', 'productPhoto'].includes(col.id) ? 'text-center' : 'text-right'
                          } ${col.id === 'observations' ? 'max-w-[150px]' : ''}`}
                        >
                          {renderCell(item, col.id)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de foto expandida com navegação */}
        {expandedPhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
            onClick={() => setExpandedPhoto(null)}
          >
            <div className="relative max-w-2xl max-h-[85vh] mx-4" onClick={(e) => e.stopPropagation()}>
              {/* Botão fechar */}
              <button
                onClick={() => setExpandedPhoto(null)}
                className="absolute -top-10 right-0 text-white hover:text-gray-300 transition z-10"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Navegação - Anterior */}
              {expandedPhoto.photos && expandedPhoto.photos.length > 1 && expandedPhoto.currentIndex > 0 && (
                <button
                  onClick={() => setExpandedPhoto({ ...expandedPhoto, currentIndex: expandedPhoto.currentIndex - 1 })}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -ml-12 text-white hover:text-gray-300 transition"
                >
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Navegação - Próximo */}
              {expandedPhoto.photos && expandedPhoto.photos.length > 1 && expandedPhoto.currentIndex < expandedPhoto.photos.length - 1 && (
                <button
                  onClick={() => setExpandedPhoto({ ...expandedPhoto, currentIndex: expandedPhoto.currentIndex + 1 })}
                  className="absolute right-0 top-1/2 -translate-y-1/2 -mr-12 text-white hover:text-gray-300 transition"
                >
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Imagem */}
              <img
                src={expandedPhoto.photos ? expandedPhoto.photos[expandedPhoto.currentIndex] : expandedPhoto.url}
                alt={expandedPhoto.name}
                className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain mx-auto"
              />

              {/* Info e contador */}
              <div className="text-center mt-3">
                <p className="text-white text-lg font-medium">{expandedPhoto.name}</p>
                {expandedPhoto.photos && expandedPhoto.photos.length > 1 && (
                  <p className="text-gray-400 text-sm mt-1">
                    Foto {expandedPhoto.currentIndex + 1} de {expandedPhoto.photos.length}
                  </p>
                )}
              </div>

              {/* Miniaturas */}
              {expandedPhoto.photos && expandedPhoto.photos.length > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                  {expandedPhoto.photos.map((photo, idx) => (
                    <img
                      key={idx}
                      src={photo}
                      alt={`Miniatura ${idx + 1}`}
                      className={`w-12 h-12 object-cover rounded cursor-pointer transition-all ${
                        idx === expandedPhoto.currentIndex
                          ? 'ring-2 ring-white opacity-100'
                          : 'opacity-50 hover:opacity-80'
                      }`}
                      onClick={() => setExpandedPhoto({ ...expandedPhoto, currentIndex: idx })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
