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
      case 'suggestedPrice':
        valueA = parseFloat(a.suggestedPrice) || 0;
        valueB = parseFloat(b.suggestedPrice) || 0;
        break;
      case 'referenceMargin':
        valueA = parseFloat(a.referenceMargin) || 0;
        valueB = parseFloat(b.referenceMargin) || 0;
        break;
      case 'currentMargin':
        valueA = parseFloat(a.currentMargin) || 0;
        valueB = parseFloat(b.currentMargin) || 0;
        break;
      case 'futureMargin':
        valueA = calcularMargemFutura(a) || 0;
        valueB = calcularMargemFutura(b) || 0;
        break;
      case 'netWeight':
        valueA = parseFloat(a.netWeight) || 0;
        valueB = parseFloat(b.netWeight) || 0;
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

  // Ícone de ordenação
  const getSortIcon = (column) => {
    if (sortColumn !== column) return '↕️';
    return sortDirection === 'asc' ? '⬆️' : '⬇️';
  };

  // Calcular totais gerais considerando os filtros (apenas itens conferidos)
  const totals = checkedItems.reduce((acc, item) => {
    // Peso total
    acc.totalWeight += parseFloat(item.netWeight || 0);

    // Total da compra (custo)
    if (item.newCost && item.netWeight) {
      const custoItem = parseFloat(item.newCost) * parseFloat(item.netWeight);
      acc.totalCost += custoItem;
    }

    // Vendas simuladas
    if (item.currentSalePrice && item.netWeight) {
      const vendaSimulada = parseFloat(item.currentSalePrice) * parseFloat(item.netWeight);
      acc.totalVendasSimuladas += vendaSimulada;
    }

    return acc;
  }, { totalCost: 0, totalWeight: 0, totalVendasSimuladas: 0 });

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
    doc.text(`Peso Total: ${totals.totalWeight.toFixed(2)} kg`, 70, resumoY + 5);
    doc.text(`Custo Total: R$ ${totals.totalCost.toFixed(2)}`, 130, resumoY + 5);
    doc.text(`Vendas Simuladas: R$ ${totals.totalVendasSimuladas.toFixed(2)}`, 190, resumoY + 5);
    doc.text(`Margem Simulada: ${margemLucroSimulada.toFixed(1)}%`, 250, resumoY + 5);

    // Tabela
    const tableData = sortedItems.map(item => {
      const margemFutura = calcularMargemFutura(item);
      return [
        item.productName || '-',
        item.supplierName || '-',
        item.currentCost ? `R$ ${parseFloat(item.currentCost).toFixed(2)}` : '-',
        item.newCost ? `R$ ${parseFloat(item.newCost).toFixed(2)}` : '-',
        item.suggestedPrice ? `R$ ${parseFloat(item.suggestedPrice).toFixed(2)}` : '-',
        item.referenceMargin ? `${parseFloat(item.referenceMargin).toFixed(1)}%` : '-',
        item.currentMargin ? `${parseFloat(item.currentMargin).toFixed(1)}%` : '-',
        margemFutura !== null ? `${margemFutura.toFixed(1)}%` : '-',
        item.netWeight ? `${parseFloat(item.netWeight).toFixed(3)} kg` : '-',
        item.quality === 'good' ? 'Boa' : item.quality === 'regular' ? 'Regular' : item.quality === 'bad' ? 'Ruim' : '-',
        item.observations || '-'
      ];
    });

    autoTable(doc, {
      startY: resumoY + 12,
      head: [['Produto', 'Fornecedor', 'Custo Ant.', 'Novo Custo', 'Preço Sug.', 'Marg. Ref.', 'Marg. Atual', 'Marg. Futura', 'Peso Líq.', 'Qualidade', 'Obs.']],
      body: tableData,
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
      },
      headStyles: {
        fillColor: [234, 88, 12], // orange-600
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 40 }, // Produto
        1: { cellWidth: 25 }, // Fornecedor
        2: { cellWidth: 18, halign: 'right' }, // Custo Ant.
        3: { cellWidth: 18, halign: 'right' }, // Novo Custo
        4: { cellWidth: 18, halign: 'right' }, // Preço Sug.
        5: { cellWidth: 15, halign: 'right' }, // Marg. Ref.
        6: { cellWidth: 15, halign: 'right' }, // Marg. Atual
        7: { cellWidth: 18, halign: 'right' }, // Marg. Futura
        8: { cellWidth: 18, halign: 'right' }, // Peso Líq.
        9: { cellWidth: 15, halign: 'center' }, // Qualidade
        10: { cellWidth: 35 }, // Obs.
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Total de Itens</p>
            <p className="text-2xl font-bold text-gray-800">{checkedItems.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Peso Total</p>
            <p className="text-2xl font-bold text-blue-600">{totals.totalWeight.toFixed(2)} kg</p>
          </div>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('productName')}
                  >
                    Produto {getSortIcon('productName')}
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('supplierName')}
                  >
                    Fornecedor {getSortIcon('supplierName')}
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('currentCost')}
                  >
                    Custo Ant. {getSortIcon('currentCost')}
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('newCost')}
                  >
                    Novo Custo {getSortIcon('newCost')}
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('suggestedPrice')}
                  >
                    Preço Sug. {getSortIcon('suggestedPrice')}
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('referenceMargin')}
                  >
                    Marg. Ref. {getSortIcon('referenceMargin')}
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('currentMargin')}
                  >
                    Marg. Atual {getSortIcon('currentMargin')}
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('futureMargin')}
                  >
                    Marg. Futura {getSortIcon('futureMargin')}
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('netWeight')}
                  >
                    Peso Líq. {getSortIcon('netWeight')}
                  </th>
                  <th
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('quality')}
                  >
                    Qualidade {getSortIcon('quality')}
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Foto
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Observações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                      Nenhum item conferido encontrado
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((item, index) => {
                    const margemFutura = calcularMargemFutura(item);
                    return (
                      <tr key={`${item.conferenceId}-${item.id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.barcode || '-'}</p>
                        </td>
                        <td className="px-3 py-2 text-left text-gray-700 text-xs">
                          {item.supplierName || '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {item.currentCost ? `R$ ${parseFloat(item.currentCost).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-orange-700">
                          {item.newCost ? `R$ ${parseFloat(item.newCost).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">
                          {item.suggestedPrice ? `R$ ${parseFloat(item.suggestedPrice).toFixed(2)}` : '-'}
                        </td>
                        {/* Margem de Referência */}
                        <td className="px-3 py-2 text-right">
                          {item.referenceMargin !== null && item.referenceMargin !== undefined ? (
                            <span className="font-semibold text-blue-600">
                              {parseFloat(item.referenceMargin).toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        {/* Margem Atual */}
                        <td className="px-3 py-2 text-right">
                          {item.currentMargin !== null && item.currentMargin !== undefined ? (
                            <span className={`font-semibold ${
                              parseFloat(item.currentMargin) < 0 ? 'text-red-600' :
                              parseFloat(item.currentMargin) < 10 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {parseFloat(item.currentMargin).toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        {/* Margem Futura */}
                        <td className="px-3 py-2 text-right">
                          {margemFutura !== null ? (
                            <span className={`font-semibold ${
                              margemFutura < 0 ? 'text-red-600' :
                              margemFutura < 10 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {margemFutura.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {item.netWeight ? `${parseFloat(item.netWeight).toFixed(3)} kg` : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {getQualityBadge(item.quality)}
                        </td>
                        {/* Foto do produto */}
                        <td className="px-3 py-2 text-center">
                          {item.photoUrl ? (() => {
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
                          })() : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        {/* Observações */}
                        <td className="px-3 py-2 text-left text-xs text-gray-600 max-w-[150px]">
                          {item.observations ? (
                            <span className="line-clamp-2" title={item.observations}>
                              {item.observations}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
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
