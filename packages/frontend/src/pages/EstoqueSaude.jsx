import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Definição das 24 colunas disponíveis
const AVAILABLE_COLUMNS = [
  { id: 'codigo', label: 'Código', visible: true },
  { id: 'descricao', label: 'Descrição', visible: true },
  { id: 'desReduzida', label: 'Desc. Reduzida', visible: false },
  { id: 'ean', label: 'EAN', visible: true },
  { id: 'valCustoRep', label: 'Custo', visible: true },
  { id: 'valvendaloja', label: 'Preço Loja', visible: false },
  { id: 'valvenda', label: 'Preço Venda', visible: true },
  { id: 'valOferta', label: 'Oferta', visible: false },
  { id: 'estoque', label: 'Estoque', visible: true },
  { id: 'desSecao', label: 'Seção', visible: true },
  { id: 'desGrupo', label: 'Grupo', visible: false },
  { id: 'desSubGrupo', label: 'Subgrupo', visible: false },
  { id: 'fantasiaForn', label: 'Fornecedor', visible: true },
  { id: 'margemRef', label: 'Margem Meta', visible: false },
  { id: 'margemCalculada', label: 'Margem %', visible: true },
  { id: 'vendaMedia', label: 'Venda Média', visible: false },
  { id: 'diasCobertura', label: 'Dias Cobertura', visible: false },
  { id: 'dtaUltCompra', label: 'Últ. Compra', visible: false },
  { id: 'qtdUltCompra', label: 'Qtd Últ. Compra', visible: false },
  { id: 'qtdPedidoCompra', label: 'Pedido Compra', visible: false },
  { id: 'estoqueMinimo', label: 'Estoque Mín', visible: false },
  { id: 'tipoEspecie', label: 'Tipo Espécie', visible: false },
  { id: 'dtaCadastro', label: 'Data Cadastro', visible: false },
  { id: 'diasSemVenda', label: 'Dias s/ Venda', visible: true },
];

export default function EstoqueSaude() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Configuração de colunas
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('estoque_columns');
    return saved ? JSON.parse(saved) : AVAILABLE_COLUMNS;
  });

  // Filtros
  const [filterTipoEspecie, setFilterTipoEspecie] = useState('MERCADORIA');
  const [filterTipoEvento, setFilterTipoEvento] = useState('DIRETA');
  const [filterSecao, setFilterSecao] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('');
  const [filterSubGrupo, setFilterSubGrupo] = useState('');
  const [activeCardFilter, setActiveCardFilter] = useState('todos');

  // Ordenação
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' ou 'desc'

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Drag and Drop para reordenar colunas
  const [draggedColumn, setDraggedColumn] = useState(null);

  // Salvar colunas no localStorage
  useEffect(() => {
    localStorage.setItem('estoque_columns', JSON.stringify(columns));
  }, [columns]);

  // Toggle visibilidade de coluna
  const toggleColumn = (columnId) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  // Funções de Drag and Drop
  const handleDragStart = (index) => {
    setDraggedColumn(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();

    if (draggedColumn === null || draggedColumn === index) return;

    const newColumns = [...columns];
    const draggedItem = newColumns[draggedColumn];

    // Remove item da posição original
    newColumns.splice(draggedColumn, 1);

    // Insere na nova posição
    newColumns.splice(index, 0, draggedItem);

    setColumns(newColumns);
    setDraggedColumn(index);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Buscar produtos
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/products');
      const allProducts = response.data.data || response.data;

      // Adicionar colunas calculadas
      const productsWithCalcs = allProducts.map(p => {
        const dataAtual = new Date();
        const dtaUltVenda = p.dtaUltMovVenda ? new Date(p.dtaUltMovVenda.slice(0, 4), p.dtaUltMovVenda.slice(4, 6) - 1, p.dtaUltMovVenda.slice(6, 8)) : null;
        const diasSemVenda = dtaUltVenda ? Math.floor((dataAtual - dtaUltVenda) / (1000 * 60 * 60 * 24)) : 999;

        // Calcular margem apenas se tiver preço de venda E custo válidos
        let margemCalculada = 0;
        if (p.valvenda > 0 && p.valCustoRep != null) {
          margemCalculada = parseFloat((((p.valvenda - p.valCustoRep) / p.valvenda) * 100).toFixed(2));
        }

        return {
          ...p,
          diasSemVenda,
          margemCalculada
        };
      });

      setProducts(productsWithCalcs);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Erro ao carregar produtos. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Função para ordenar produtos
  const handleSort = (columnId) => {
    if (sortColumn === columnId) {
      // Se já está ordenando por esta coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Se é nova coluna, ordena ascendente
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // Opções únicas para os filtros (dependentes entre si)
  const filterOptions = useMemo(() => {
    // Todas as seções disponíveis
    const secoes = [...new Set(products.map(p => p.desSecao).filter(Boolean))].sort();

    // Grupos filtrados pela seção selecionada
    let produtosFiltradosParaGrupo = products;
    if (filterSecao) {
      produtosFiltradosParaGrupo = products.filter(p => p.desSecao === filterSecao);
    }
    const grupos = [...new Set(produtosFiltradosParaGrupo.map(p => p.desGrupo).filter(Boolean))].sort();

    // Subgrupos filtrados pela seção E grupo selecionados
    let produtosFiltradosParaSubgrupo = products;
    if (filterSecao) {
      produtosFiltradosParaSubgrupo = produtosFiltradosParaSubgrupo.filter(p => p.desSecao === filterSecao);
    }
    if (filterGrupo) {
      produtosFiltradosParaSubgrupo = produtosFiltradosParaSubgrupo.filter(p => p.desGrupo === filterGrupo);
    }
    const subgrupos = [...new Set(produtosFiltradosParaSubgrupo.map(p => p.desSubGrupo).filter(Boolean))].sort();

    return { secoes, grupos, subgrupos };
  }, [products, filterSecao, filterGrupo]);

  // Produtos filtrados e ordenados
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filtro de Tipo Espécie
    if (filterTipoEspecie) {
      filtered = filtered.filter(p => p.tipoEspecie === filterTipoEspecie);
    }

    // Filtro de Tipo Evento
    if (filterTipoEvento) {
      filtered = filtered.filter(p => p.tipoEvento === filterTipoEvento);
    }

    // Filtro de Seção
    if (filterSecao) {
      filtered = filtered.filter(p => p.desSecao === filterSecao);
    }

    // Filtro de Grupo
    if (filterGrupo) {
      filtered = filtered.filter(p => p.desGrupo === filterGrupo);
    }

    // Filtro de Subgrupo
    if (filterSubGrupo) {
      filtered = filtered.filter(p => p.desSubGrupo === filterSubGrupo);
    }

    // Filtro por Card clicado
    if (activeCardFilter === 'zerado') {
      filtered = filtered.filter(p => p.estoque === 0);
    } else if (activeCardFilter === 'negativo') {
      filtered = filtered.filter(p => p.estoque < 0);
    } else if (activeCardFilter === 'sem_venda') {
      filtered = filtered.filter(p => p.diasSemVenda > 30);
    } else if (activeCardFilter === 'margem_negativa') {
      filtered = filtered.filter(p => p.margemCalculada < 0);
    } else if (activeCardFilter === 'margem_baixa') {
      filtered = filtered.filter(p => p.margemCalculada < p.margemRef && p.margemCalculada >= 0);
    } else if (activeCardFilter === 'custo_zerado') {
      filtered = filtered.filter(p => !p.valCustoRep || p.valCustoRep === 0);
    } else if (activeCardFilter === 'preco_venda_zerado') {
      filtered = filtered.filter(p => !p.valvenda || p.valvenda === 0);
    }

    // Ordenação
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        // Valores nulos/undefined vão para o final
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Comparação numérica
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // Comparação de string (case-insensitive)
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filtered;
  }, [products, filterTipoEspecie, filterTipoEvento, filterSecao, filterGrupo, filterSubGrupo, activeCardFilter, sortColumn, sortDirection]);

  // Resetar filtros dependentes quando filtro pai muda
  useEffect(() => {
    // Se mudou a seção, limpa grupo e subgrupo
    setFilterGrupo('');
    setFilterSubGrupo('');
  }, [filterSecao]);

  useEffect(() => {
    // Se mudou o grupo, limpa subgrupo
    setFilterSubGrupo('');
  }, [filterGrupo]);

  // Resetar para página 1 quando mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTipoEspecie, filterTipoEvento, filterSecao, filterGrupo, filterSubGrupo, activeCardFilter, sortColumn, sortDirection]);

  // Produtos paginados
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Total de páginas
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Cálculos dos cards
  const stats = useMemo(() => {
    const filtered = products.filter(p => {
      let match = true;
      if (filterTipoEspecie) match = match && p.tipoEspecie === filterTipoEspecie;
      if (filterTipoEvento) match = match && p.tipoEvento === filterTipoEvento;
      return match;
    });

    // Calcular valor total do estoque (estoque * custo)
    const valorTotalEstoque = filtered.reduce((total, p) => {
      const valorItem = (p.estoque || 0) * (p.valCustoRep || 0);
      return total + valorItem;
    }, 0);

    return {
      estoqueZerado: filtered.filter(p => p.estoque === 0).length,
      estoqueNegativo: filtered.filter(p => p.estoque < 0).length,
      semVenda30Dias: filtered.filter(p => p.diasSemVenda > 30).length,
      margemNegativa: filtered.filter(p => p.margemCalculada < 0).length,
      margemAbaixoMeta: filtered.filter(p => p.margemCalculada < p.margemRef && p.margemCalculada >= 0).length,
      custoZerado: filtered.filter(p => !p.valCustoRep || p.valCustoRep === 0).length,
      precoVendaZerado: filtered.filter(p => !p.valvenda || p.valvenda === 0).length,
      total: filtered.length,
      valorTotalEstoque
    };
  }, [products, filterTipoEspecie, filterTipoEvento]);

  // Renderizar valor da célula
  const renderCellValue = (product, columnId) => {
    const value = product[columnId];

    switch (columnId) {
      // Valores monetários
      case 'valCustoRep':
      case 'valvendaloja':
      case 'valvenda':
        if (value == null) return 'R$ 0,00';
        if (value === 0) return 'R$ 0,00';
        return `R$ ${value.toFixed(2).replace('.', ',')}`;

      case 'valOferta':
        if (value == null || value === 0) return '-';
        return `R$ ${value.toFixed(2).replace('.', ',')}`;

      // Estoque
      case 'estoque':
      case 'estoqueMinimo':
      case 'estoqueMaximo':
        if (value == null) return '0,00';
        return value.toFixed(2).replace('.', ',');

      // Porcentagens
      case 'margemCalculada':
        if (value == null || isNaN(value) || value === 0) return '0,0%';
        return `${value.toFixed(1).replace('.', ',')}%`;

      case 'margemRef':
        if (value == null || isNaN(value) || value === 0) return '-';
        return `${value.toFixed(0)}%`;

      // Quantidades
      case 'vendaMedia':
        if (value == null || value === 0) return '0';
        return value.toFixed(2).replace('.', ',');

      case 'qtdUltCompra':
      case 'qtdPedidoCompra':
        if (value == null) return '-';
        if (value === 0) return '0';
        return value.toString();

      case 'diasCobertura':
        if (value == null || value === 0) return '-';
        return `${value} dias`;

      // Datas
      case 'dtaUltCompra':
      case 'dtaCadastro':
        if (!value) return '-';
        return new Date(value).toLocaleDateString('pt-BR');

      // Dias sem venda
      case 'diasSemVenda':
        if (value === 999) return 'Nunca vendeu';
        if (value === 0) return 'Hoje';
        if (value === 1) return '1 dia';
        return `${value} dias`;

      // Texto padrão
      default:
        if (value == null || value === '') return '-';
        return value;
    }
  };

  // Função para exportar para PDF
  const exportToPDF = () => {
    console.log('📄 Exportando PDF - Total de produtos:', filteredProducts.length);
    console.log('Filtros ativos:', { filterSecao, filterGrupo, filterSubGrupo, activeCardFilter });

    if (filteredProducts.length === 0) {
      alert('Nenhum produto encontrado com os filtros aplicados!');
      return;
    }

    const doc = new jsPDF('landscape');

    // Garantir que autoTable está disponível
    if (typeof doc.autoTable !== 'function') {
      console.error('autoTable não está disponível no jsPDF');
      alert('Erro ao gerar PDF. Por favor, recarregue a página e tente novamente.');
      return;
    }

    // Título
    doc.setFontSize(16);
    doc.text('Relatório de Estoque e Margem', 14, 15);

    // Subtítulo com filtros aplicados
    doc.setFontSize(10);
    let subtitle = 'Filtros: ';
    const filtrosAtivos = [];
    if (filterSecao) filtrosAtivos.push(`Seção: ${filterSecao}`);
    if (filterGrupo) filtrosAtivos.push(`Grupo: ${filterGrupo}`);
    if (filterSubGrupo) filtrosAtivos.push(`Subgrupo: ${filterSubGrupo}`);
    if (activeCardFilter) {
      const filterLabels = {
        zerado: 'Estoque Zerado',
        negativo: 'Estoque Negativo',
        sem_venda: 'Sem Venda +30 dias',
        margem_negativa: 'Margem Negativa',
        margem_baixa: 'Margem Abaixo da Meta',
        custo_zerado: 'Custo Zerado',
        preco_venda_zerado: 'Preço Venda Zerado'
      };
      filtrosAtivos.push(filterLabels[activeCardFilter]);
    }
    subtitle += filtrosAtivos.length > 0 ? filtrosAtivos.join(', ') : 'Nenhum';
    doc.text(subtitle, 14, 22);

    // Preparar colunas visíveis
    const visibleCols = columns.filter(col => col.visible);
    const headers = [visibleCols.map(col => col.label)];

    // Preparar dados
    const data = filteredProducts.map(product =>
      visibleCols.map(col => {
        const value = product[col.id];

        // Formatar valores para PDF
        switch (col.id) {
          case 'valCustoRep':
          case 'valvendaloja':
          case 'valvenda':
          case 'valOferta':
            if (value == null || value === 0) return 'R$ 0,00';
            return `R$ ${value.toFixed(2).replace('.', ',')}`;

          case 'estoque':
          case 'vendaMedia':
          case 'margemRef':
          case 'margemCalculada':
            if (value == null || value === 0) return '0';
            return value.toFixed(2).replace('.', ',');

          case 'qtdUltCompra':
          case 'qtdPedidoCompra':
            if (value == null) return '-';
            if (value === 0) return '0';
            return value.toString();

          case 'diasCobertura':
            if (value == null || value === 0) return '-';
            return `${value} dias`;

          case 'dtaUltCompra':
          case 'dtaCadastro':
            if (!value) return '-';
            return new Date(value).toLocaleDateString('pt-BR');

          case 'diasSemVenda':
            if (value === 999) return 'Nunca vendeu';
            if (value === 0) return 'Hoje';
            if (value === 1) return '1 dia';
            return `${value} dias`;

          default:
            if (value == null || value === '') return '-';
            return String(value);
        }
      })
    );

    // Gerar tabela
    doc.autoTable({
      head: headers,
      body: data,
      startY: 28,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [249, 115, 22], // orange-500
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // gray-50
      },
      margin: { top: 28 }
    });

    // Adicionar rodapé com data e total de registros
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pageCount} | Total de produtos: ${filteredProducts.length} | Gerado em ${new Date().toLocaleString('pt-BR')}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    // Salvar PDF
    const filename = `estoque_saude_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  // Função para obter classe CSS da célula
  const getCellClassName = (product, columnId) => {
    const baseClass = "px-4 py-3 text-sm";

    if (columnId === 'estoque') {
      return `${baseClass} text-right font-medium ${
        product.estoque < 0 ? 'text-red-600' :
        product.estoque === 0 ? 'text-orange-600' :
        'text-gray-900'
      }`;
    }

    if (columnId === 'margemCalculada') {
      return `${baseClass} text-right font-medium ${
        product.margemCalculada < 0 ? 'text-red-600' :
        product.margemCalculada < product.margemRef ? 'text-yellow-600' :
        'text-green-600'
      }`;
    }

    if (columnId === 'diasSemVenda') {
      return `${baseClass} text-right font-medium ${
        product.diasSemVenda > 30 ? 'text-red-600' :
        product.diasSemVenda > 15 ? 'text-yellow-600' :
        'text-green-600'
      }`;
    }

    if (columnId === 'valCustoRep' || columnId === 'valvenda' || columnId === 'margemRef') {
      return `${baseClass} text-right text-gray-700`;
    }

    if (columnId === 'codigo') {
      return `${baseClass} font-medium text-gray-900`;
    }

    return `${baseClass} text-gray-700`;
  };

  const visibleColumns = columns.filter(col => col.visible);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
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
          <h1 className="text-lg font-semibold text-gray-900">📦 Prevenção Estoque</h1>
          <button
            onClick={logout}
            className="p-2 text-gray-600 hover:text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* Card com Gradiente Laranja */}
          <div className="hidden lg:block bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">📦 Prevenção de Estoque</h1>
                <p className="text-white/90">
                  Monitore a saúde do seu estoque e identifique produtos críticos
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏪 Seção
                </label>
                <select
                  value={filterSecao}
                  onChange={(e) => setFilterSecao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todas</option>
                  {filterOptions.secoes.map(secao => (
                    <option key={secao} value={secao}>{secao}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📦 Grupo
                </label>
                <select
                  value={filterGrupo}
                  onChange={(e) => setFilterGrupo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  {filterOptions.grupos.map(grupo => (
                    <option key={grupo} value={grupo}>{grupo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏷️ Subgrupo
                </label>
                <select
                  value={filterSubGrupo}
                  onChange={(e) => setFilterSubGrupo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  {filterOptions.subgrupos.map(subgrupo => (
                    <option key={subgrupo} value={subgrupo}>{subgrupo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📋 Tipo Espécie
                </label>
                <select
                  value={filterTipoEspecie}
                  onChange={(e) => setFilterTipoEspecie(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  <option value="MERCADORIA">MERCADORIA</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📄 Tipo Evento
                </label>
                <select
                  value={filterTipoEvento}
                  onChange={(e) => setFilterTipoEvento(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  <option value="DIRETA">DIRETA</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

              <div className="flex items-end">
                <button
                  onClick={fetchProducts}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? '🔄 Carregando...' : '🔄 Atualizar'}
                </button>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={exportToPDF}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2"
                  title="Exportar para PDF"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  PDF
                </button>
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                  ⚙️ Colunas ({visibleColumns.length}/{columns.length})
                </button>
              </div>
            </div>
          </div>

          {/* Cards de Resumo - Clicáveis */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card Estoque Zerado */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'zerado' ? 'todos' : 'zerado')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'zerado' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">📭</span>
                <span className="text-2xl font-bold text-red-600">{stats.estoqueZerado}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Estoque Zerado</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Estoque Negativo */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'negativo' ? 'todos' : 'negativo')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'negativo' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">⚠️</span>
                <span className="text-2xl font-bold text-red-700">{stats.estoqueNegativo}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Estoque Negativo</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Sem Venda +30 dias */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'sem_venda' ? 'todos' : 'sem_venda')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'sem_venda' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">⏸️</span>
                <span className="text-2xl font-bold text-orange-600">{stats.semVenda30Dias}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Sem Venda +30d</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Margem Negativa */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'margem_negativa' ? 'todos' : 'margem_negativa')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'margem_negativa' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">💸</span>
                <span className="text-2xl font-bold text-red-800">{stats.margemNegativa}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Margem Negativa</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Margem Abaixo Meta */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'margem_baixa' ? 'todos' : 'margem_baixa')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'margem_baixa' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">💰</span>
                <span className="text-2xl font-bold text-yellow-600">{stats.margemAbaixoMeta}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Margem Abaixo Meta</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Custo Zerado */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'custo_zerado' ? 'todos' : 'custo_zerado')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'custo_zerado' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">🏷️</span>
                <span className="text-2xl font-bold text-purple-600">{stats.custoZerado}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Custo Zerado</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Preço Venda Zerado */}
            <button
              onClick={() => setActiveCardFilter(activeCardFilter === 'preco_venda_zerado' ? 'todos' : 'preco_venda_zerado')}
              className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
                activeCardFilter === 'preco_venda_zerado' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">💵</span>
                <span className="text-2xl font-bold text-pink-600">{stats.precoVendaZerado}</span>
              </div>
              <p className="text-sm font-medium text-gray-700">Preço Venda Zerado</p>
              <p className="text-xs text-gray-500">produtos</p>
            </button>

            {/* Card Valor Total Estoque (não clicável) */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">💰</span>
                <span className="text-lg font-bold">
                  R$ {(stats.valorTotalEstoque / 1000).toFixed(0)}k
                </span>
              </div>
              <p className="text-sm font-medium">Valor Total Estoque</p>
              <p className="text-xs text-white/80">custo total</p>
            </div>
          </div>

          {/* Info do filtro ativo e contador */}
          <div className="flex items-center justify-between mb-6">
            {activeCardFilter !== 'todos' ? (
              <div className="flex-1 bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-orange-800">
                      <strong>Filtro ativo:</strong> {
                        activeCardFilter === 'zerado' ? '📭 Estoque Zerado' :
                        activeCardFilter === 'negativo' ? '⚠️ Estoque Negativo' :
                        activeCardFilter === 'sem_venda' ? '⏸️ Sem Venda +30 dias' :
                        activeCardFilter === 'margem_negativa' ? '💸 Margem Negativa' :
                        activeCardFilter === 'margem_baixa' ? '💰 Margem Abaixo da Meta' :
                        activeCardFilter === 'custo_zerado' ? '🏷️ Custo Zerado' :
                        '💵 Preço Venda Zerado'
                      }
                    </p>
                    <span className="bg-orange-200 text-orange-900 px-3 py-1 rounded-full text-xs font-bold">
                      {filteredProducts.length} produtos
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveCardFilter('todos')}
                    className="text-orange-600 hover:text-orange-800 font-medium text-sm"
                  >
                    ✕ Limpar filtro
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-blue-800 font-medium">📊 Total de produtos:</span>
                  <span className="bg-blue-200 text-blue-900 px-3 py-1 rounded-full text-sm font-bold">
                    {filteredProducts.length} produtos
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tabela de Produtos */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {visibleColumns.map(col => (
                      <th
                        key={col.id}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort(col.id)}
                      >
                        <div className="flex items-center gap-1">
                          <span>{col.label}</span>
                          {sortColumn === col.id && (
                            <span className="text-orange-500">
                              {sortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-gray-500">
                        🔄 Carregando produtos...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-red-500">
                        ❌ {error}
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-gray-500">
                        📭 Nenhum produto encontrado
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((product) => (
                      <tr key={product.codigo} className="hover:bg-gray-50">
                        {visibleColumns.map(col => (
                          <td key={col.id} className={getCellClassName(product, col.id)}>
                            {renderCellValue(product, col.id)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer da Tabela com Paginação */}
            {!loading && !error && filteredProducts.length > 0 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  Exibindo <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> de <strong>{filteredProducts.length}</strong> produtos
                </p>

                {/* Controles de Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      ⏮️ Primeira
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      ◀️ Anterior
                    </button>

                    <span className="text-sm text-gray-700 px-3">
                      Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                    </span>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Próxima ▶️
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Última ⏭️
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar de Seleção de Colunas */}
      {showColumnSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowColumnSelector(false)}>
          <div
            className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">⚙️ Configurar Colunas</h2>
                <button
                  onClick={() => setShowColumnSelector(false)}
                  className="text-white hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p className="text-sm text-white/90 mt-2">
                {visibleColumns.length} de {columns.length} colunas visíveis
              </p>
            </div>

            <div className="p-6">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  💡 <strong>Dica:</strong> Arraste as colunas para reordenar a sequência na tabela
                </p>
              </div>

              <div className="space-y-2">
                {columns.map((column, index) => (
                  <div
                    key={column.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center p-3 rounded-lg transition-all cursor-move ${
                      draggedColumn === index
                        ? 'bg-orange-100 border-2 border-orange-500 scale-105'
                        : 'bg-white hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    {/* Ícone de drag */}
                    <div className="mr-2 text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"/>
                      </svg>
                    </div>

                    <input
                      type="checkbox"
                      checked={column.visible}
                      onChange={() => toggleColumn(column.id)}
                      className="w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700 flex-1">
                      {column.label}
                    </span>

                    {/* Indicador de posição */}
                    <span className="text-xs text-gray-400 font-mono">
                      #{index + 1}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setColumns(AVAILABLE_COLUMNS);
                    setShowColumnSelector(false);
                  }}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  🔄 Restaurar Padrão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
