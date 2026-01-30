import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';

// Definição das colunas padrão da tabela de ruptura
const RUPTURA_COLUMNS_DEFAULT = [
  { id: 'carrinho', label: '🛒', align: 'center', sortable: false },
  { id: 'descricao', label: 'Produto', align: 'left', sortable: true },
  { id: 'fornecedor', label: 'Fornecedor', align: 'left', sortable: true },
  { id: 'secao', label: 'Seção', align: 'left', sortable: true },
  { id: 'curva', label: 'Curva', align: 'center', sortable: true },
  { id: 'estoque_atual', label: 'Estoque', align: 'right', sortable: true },
  { id: 'venda_media_dia', label: 'V.Média/Dia', align: 'right', sortable: true },
  { id: 'valor_venda', label: 'Valor Venda', align: 'right', sortable: true },
  { id: 'margem_lucro', label: 'Margem %', align: 'right', sortable: true },
  { id: 'tem_pedido', label: 'Pedido', align: 'center', sortable: true },
  { id: 'status_pedido', label: 'Status Ped.', align: 'center', sortable: true },
  { id: 'data_entrega', label: 'Dt. Entrega', align: 'center', sortable: true },
  { id: 'dias_atraso', label: 'Atraso', align: 'center', sortable: true },
  { id: 'ocorrencias', label: 'Ocorrências', align: 'center', sortable: true },
  { id: 'perda_total', label: 'Perda Total', align: 'right', sortable: true },
  { id: 'historico', label: 'Hist.', align: 'center', sortable: false },
];

// Definição das colunas do carrinho/pedido
const CARRINHO_COLUMNS_DEFAULT = [
  { id: 'codigo_barras', label: 'Cód. Barras', align: 'left' },
  { id: 'descricao', label: 'Descrição', align: 'left' },
  { id: 'curva', label: 'Curva', align: 'center' },
  { id: 'venda_media_dia', label: 'V.Média/Dia', align: 'right', bg: 'bg-purple-100' },
  { id: 'tem_pedido', label: 'Pedido', align: 'center' },
  { id: 'status_pedido', label: 'Status Ped.', align: 'center', bg: 'bg-indigo-100' },
  { id: 'data_entrega', label: 'Dt. Entrega', align: 'center', bg: 'bg-teal-100' },
  { id: 'dias_atraso', label: 'Atraso', align: 'center', bg: 'bg-red-100' },
  { id: 'fornecedor', label: 'Fornecedor', align: 'left' },
  { id: 'qtdEmbalagem', label: 'Embalag.', align: 'center', bg: 'bg-cyan-200' },
  { id: 'qtdPedido', label: 'Qtde Ped.', align: 'center', bg: 'bg-green-200', editable: true },
  { id: 'qtdTotal', label: 'Qtde Total', align: 'center', bg: 'bg-yellow-200', calculated: true },
  { id: 'ultimoCusto', label: 'Últ. Custo', align: 'right', bg: 'bg-gray-200' },
  { id: 'novoCusto', label: 'Novo Custo', align: 'center', bg: 'bg-blue-200', editable: true },
  { id: 'valorTotal', label: 'Total R$', align: 'right', bg: 'bg-orange-200', calculated: true },
  { id: 'remover', label: '', align: 'center', fixed: true },
];

export default function RupturaResultadosAuditorias() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Verificar se usuário pode excluir (admin ou master)
  const canDelete = user?.role === 'admin' || user?.isMaster;

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState('todos');
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('todos');
  const [auditorSelecionado, setAuditorSelecionado] = useState('todos');

  // Filtros da tabela de produtos - carrega do localStorage se existir
  const [filtroTipoRuptura, setFiltroTipoRuptura] = useState(() => {
    return localStorage.getItem('ruptura_filtro_tipo') || 'todos';
  }); // 'todos', 'nao_encontrado', 'ruptura_estoque'
  const [filtroFornecedorTabela, setFiltroFornecedorTabela] = useState(() => {
    return localStorage.getItem('ruptura_filtro_fornecedor') || 'todos';
  });
  const [filtroSetorTabela, setFiltroSetorTabela] = useState(() => {
    return localStorage.getItem('ruptura_filtro_setor') || 'todos';
  });

  // Salvar filtros no localStorage quando mudarem
  useEffect(() => {
    localStorage.setItem('ruptura_filtro_tipo', filtroTipoRuptura);
    localStorage.setItem('ruptura_filtro_fornecedor', filtroFornecedorTabela);
    localStorage.setItem('ruptura_filtro_setor', filtroSetorTabela);
  }, [filtroTipoRuptura, filtroFornecedorTabela, filtroSetorTabela]);

  // Estado de ordenação - carrega do localStorage se existir
  const [sortColumn, setSortColumn] = useState(() => {
    const saved = localStorage.getItem('ruptura_sort_column');
    return saved || null;
  });
  const [sortDirection, setSortDirection] = useState(() => {
    const saved = localStorage.getItem('ruptura_sort_direction');
    return saved || 'asc';
  }); // 'asc' ou 'desc'

  // Salvar ordenação no localStorage quando mudar
  useEffect(() => {
    if (sortColumn) {
      localStorage.setItem('ruptura_sort_column', sortColumn);
      localStorage.setItem('ruptura_sort_direction', sortDirection);
    } else {
      localStorage.removeItem('ruptura_sort_column');
      localStorage.removeItem('ruptura_sort_direction');
    }
  }, [sortColumn, sortDirection]);

  // Dados
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [auditores, setAuditores] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingProduct, setDeletingProduct] = useState(null); // código do produto sendo excluído

  // Estados para o modal de histórico de compras
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [productsWithHistory, setProductsWithHistory] = useState(new Set()); // Produtos COM histórico (azul)

  // Estado para linhas expandidas (mostrar datas das ocorrências)
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Estado para seleção de ano na evolução mensal
  const [anoEvolucao, setAnoEvolucao] = useState(new Date().getFullYear());
  const [evolucaoMensal, setEvolucaoMensal] = useState([]);
  const [loadingEvolucao, setLoadingEvolucao] = useState(false);

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('ruptura_items_per_page');
    return saved ? parseInt(saved) : 50;
  });

  // Salvar preferência de itens por página
  useEffect(() => {
    localStorage.setItem('ruptura_items_per_page', itemsPerPage.toString());
  }, [itemsPerPage]);

  // Resetar página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroTipoRuptura, filtroFornecedorTabela, filtroSetorTabela, resultados]);

  // Buscar evolução mensal quando o ano muda
  useEffect(() => {
    const fetchEvolucaoMensal = async () => {
      try {
        setLoadingEvolucao(true);
        const response = await api.get(`/rupture-surveys/evolucao-mensal?ano=${anoEvolucao}`);
        setEvolucaoMensal(response.data);
      } catch (err) {
        console.error('Erro ao buscar evolução mensal:', err);
        setEvolucaoMensal([]);
      } finally {
        setLoadingEvolucao(false);
      }
    };
    fetchEvolucaoMensal();
  }, [anoEvolucao]);

  // Estados para carrinho e pedidos (estilo prevenção margem)
  const [carrinho, setCarrinho] = useState([]); // Produtos selecionados para pedido
  const [pedidosSalvos, setPedidosSalvos] = useState(() => {
    const saved = localStorage.getItem('ruptura_pedidos_salvos');
    return saved ? JSON.parse(saved) : [];
  });
  const [abaAtiva, setAbaAtiva] = useState('produtos'); // 'produtos' | 'pedido' | 'pedidos_realizados'
  const [pedidosExpandidos, setPedidosExpandidos] = useState(new Set()); // IDs dos pedidos expandidos
  const [mesSelecionado, setMesSelecionado] = useState(null); // Mês selecionado no gráfico de evolução

  // Toggle expandir pedido realizado
  const togglePedidoExpandido = (pedidoId) => {
    setPedidosExpandidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pedidoId)) {
        newSet.delete(pedidoId);
      } else {
        newSet.add(pedidoId);
      }
      return newSet;
    });
  };

  // Estado para ordem das colunas do carrinho (persistido no localStorage)
  const [carrinhoColumns, setCarrinhoColumns] = useState(() => {
    const saved = localStorage.getItem('ruptura_carrinho_columns_order');
    if (saved) {
      try {
        const savedOrder = JSON.parse(saved);
        const reordered = savedOrder.map(id => CARRINHO_COLUMNS_DEFAULT.find(c => c.id === id)).filter(Boolean);
        const newColumns = CARRINHO_COLUMNS_DEFAULT.filter(col => !savedOrder.includes(col.id));
        return [...reordered, ...newColumns];
      } catch (e) {}
    }
    return CARRINHO_COLUMNS_DEFAULT;
  });

  // Drag and drop para colunas do carrinho
  const [draggedCarrinhoCol, setDraggedCarrinhoCol] = useState(null);
  const [dragOverCarrinhoCol, setDragOverCarrinhoCol] = useState(null);

  const handleCarrinhoColDragStart = (e, columnId) => {
    setDraggedCarrinhoCol(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
    e.target.style.opacity = '0.5';
  };

  const handleCarrinhoColDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedCarrinhoCol(null);
    setDragOverCarrinhoCol(null);
  };

  const handleCarrinhoColDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedCarrinhoCol === columnId) return;
    setDragOverCarrinhoCol(columnId);
  };

  const handleCarrinhoColDrop = (e, targetColumnId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCarrinhoCol || draggedCarrinhoCol === targetColumnId) return;

    const newColumns = [...carrinhoColumns];
    const draggedIndex = newColumns.findIndex(c => c.id === draggedCarrinhoCol);
    const targetIndex = newColumns.findIndex(c => c.id === targetColumnId);

    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setCarrinhoColumns(newColumns);
    setDraggedCarrinhoCol(null);
    setDragOverCarrinhoCol(null);
  };

  // Persistir ordem das colunas do carrinho
  useEffect(() => {
    const columnIds = carrinhoColumns.map(col => col.id);
    localStorage.setItem('ruptura_carrinho_columns_order', JSON.stringify(columnIds));
  }, [carrinhoColumns]);

  // Persistir pedidos salvos no localStorage
  useEffect(() => {
    localStorage.setItem('ruptura_pedidos_salvos', JSON.stringify(pedidosSalvos));
  }, [pedidosSalvos]);

  // Funções do carrinho
  const adicionarAoCarrinho = (item) => {
    if (!carrinho.find(c => c.descricao === item.descricao)) {
      const ultimoCusto = Number(item.custo_reposicao || item.valor_venda || 0);
      setCarrinho(prev => [...prev, {
        ...item,
        qtdPedido: 1,
        qtdEmbalagem: item.qtd_embalagem || 1,
        ultimoCusto: ultimoCusto,
        novoCusto: ultimoCusto, // Inicia com o último custo
        status_pedido: item.status_pedido || (item.tem_pedido === 'Sim' ? 'Pendente' : null),
        data_entrega: item.data_entrega || null
      }]);
    }
  };

  const removerDoCarrinho = (descricao) => {
    setCarrinho(prev => prev.filter(c => c.descricao !== descricao));
  };

  const atualizarQtdPedido = (descricao, qtd) => {
    setCarrinho(prev => prev.map(c =>
      c.descricao === descricao ? { ...c, qtdPedido: Math.max(0, parseInt(qtd) || 0) } : c
    ));
  };

  const atualizarNovoCusto = (descricao, custo) => {
    setCarrinho(prev => prev.map(c =>
      c.descricao === descricao ? { ...c, novoCusto: parseFloat(custo) || 0 } : c
    ));
  };

  const limparCarrinho = () => {
    setCarrinho([]);
  };

  const isNoCarrinho = (descricao) => {
    return carrinho.some(c => c.descricao === descricao);
  };

  // Função para renderizar valor da célula do carrinho
  const renderCarrinhoCellValue = (item, columnId) => {
    const qtdTotal = (item.qtdEmbalagem || 1) * item.qtdPedido;
    const valorTotal = qtdTotal * (item.novoCusto || 0);

    switch (columnId) {
      case 'codigo_barras':
        return <span className="text-gray-600 font-mono text-xs">{item.codigo_barras || item.codigo || '-'}</span>;
      case 'descricao':
        return <span className="text-gray-800 font-medium text-xs max-w-[200px] truncate block" title={item.descricao}>{item.descricao}</span>;
      case 'curva':
        return (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
            item.curva === 'A' ? 'bg-red-100 text-red-700' :
            item.curva === 'B' ? 'bg-yellow-100 text-yellow-700' :
            item.curva === 'C' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {item.curva || '-'}
          </span>
        );
      case 'venda_media_dia':
        return <span className="text-purple-700 font-medium">{Number(item.venda_media_dia || 0).toFixed(2)}</span>;
      case 'tem_pedido':
        return (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
            item.tem_pedido === 'Sim' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {item.tem_pedido === 'Sim' ? 'Sim' : 'Não'}
          </span>
        );
      case 'status_pedido':
        return (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
            item.status_pedido === 'Pendente' ? 'bg-amber-100 text-amber-700' :
            item.status_pedido === 'Parcial' ? 'bg-blue-100 text-blue-700' :
            item.status_pedido === 'Completo' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {item.status_pedido || '-'}
          </span>
        );
      case 'data_entrega':
        return (
          <span className="text-teal-700 font-medium text-xs">
            {item.data_entrega || '-'}
          </span>
        );
      case 'dias_atraso':
        return item.dias_atraso ? (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
            {item.dias_atraso}d
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'fornecedor':
        return <span className="text-gray-600 text-xs max-w-[120px] truncate block" title={item.fornecedor}>{item.fornecedor || '-'}</span>;
      case 'qtdEmbalagem':
        return <span className="font-bold text-cyan-700">{item.qtdEmbalagem || 1}</span>;
      case 'qtdPedido':
        return (
          <input
            type="number"
            min="0"
            value={item.qtdPedido}
            onChange={(e) => atualizarQtdPedido(item.descricao, e.target.value)}
            className="w-14 px-1 py-1 text-center border border-green-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 font-bold text-green-700"
          />
        );
      case 'qtdTotal':
        return <span className="font-bold text-yellow-700">{qtdTotal}</span>;
      case 'ultimoCusto':
        return <span className="text-gray-600">R$ {Number(item.ultimoCusto || 0).toFixed(2)}</span>;
      case 'novoCusto':
        return (
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.novoCusto || ''}
            onChange={(e) => atualizarNovoCusto(item.descricao, e.target.value)}
            className="w-20 px-1 py-1 text-center border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-blue-700"
            placeholder="0.00"
          />
        );
      case 'valorTotal':
        return <span className="font-bold text-orange-700">R$ {valorTotal.toFixed(2)}</span>;
      case 'remover':
        return (
          <button
            onClick={() => removerDoCarrinho(item.descricao)}
            className="p-1 bg-red-100 text-red-600 hover:bg-red-200 rounded transition-colors"
            title="Remover do pedido"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        );
      default:
        return item[columnId] || '-';
    }
  };

  // Salvar pedido
  const salvarPedido = () => {
    if (carrinho.length === 0) {
      alert('Adicione produtos ao carrinho antes de salvar!');
      return;
    }

    const valorTotal = carrinho.reduce((sum, item) => {
      const qtdTotal = (item.qtdEmbalagem || 1) * item.qtdPedido;
      return sum + (qtdTotal * (item.novoCusto || 0));
    }, 0);

    const qtdTotalUnidades = carrinho.reduce((sum, item) => {
      return sum + ((item.qtdEmbalagem || 1) * item.qtdPedido);
    }, 0);

    const novoPedido = {
      id: Date.now(),
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      fornecedor: carrinho[0]?.fornecedor || 'Diversos',
      qtdProdutos: carrinho.length,
      qtdPedido: carrinho.reduce((sum, item) => sum + item.qtdPedido, 0),
      qtdTotalUnidades,
      valorTotal,
      itens: [...carrinho]
    };

    setPedidosSalvos(prev => [novoPedido, ...prev]);

    // Perguntar se quer gerar PDF
    if (window.confirm('Pedido salvo com sucesso! Deseja gerar o PDF do pedido?')) {
      gerarPDFPedido(novoPedido);
    }

    setCarrinho([]);
    setAbaAtiva('pedidos_realizados');
  };

  // Gerar PDF do pedido
  const gerarPDFPedido = (pedido) => {
    const doc = new jsPDF('landscape');

    // Título
    doc.setFontSize(18);
    doc.text('Pedido de Compra - Ruptura', 14, 15);

    // Info do pedido
    doc.setFontSize(10);
    doc.text(`Data: ${pedido.data} ${pedido.hora}`, 14, 25);
    doc.text(`Fornecedor Principal: ${pedido.fornecedor}`, 14, 31);
    doc.text(`Total de Produtos: ${pedido.qtdProdutos}`, 14, 37);
    doc.text(`Qtd Pedido: ${pedido.qtdPedido || pedido.qtdTotal || 0}`, 80, 37);
    doc.text(`Qtd Total Unidades: ${pedido.qtdTotalUnidades || 0}`, 140, 37);
    doc.text(`Valor Total: R$ ${Number(pedido.valorTotal).toFixed(2)}`, 220, 37);

    // Tabela de itens - com coluna Curva
    const tableData = pedido.itens.map((item, idx) => {
      const qtdTotal = (item.qtdEmbalagem || 1) * item.qtdPedido;
      const valorTotal = qtdTotal * (item.novoCusto || 0);
      return [
        idx + 1,
        item.codigo || '-',
        (item.descricao || '').substring(0, 35),
        item.curva || '-',
        item.fornecedor || '-',
        item.qtdEmbalagem || 1,
        item.qtdPedido,
        qtdTotal,
        `R$ ${Number(item.ultimoCusto || 0).toFixed(2)}`,
        `R$ ${Number(item.novoCusto || 0).toFixed(2)}`,
        `R$ ${valorTotal.toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['#', 'Código', 'Produto', 'Curva', 'Fornecedor', 'Embal.', 'Qtd Ped.', 'Qtd Total', 'Últ. Custo', 'Novo Custo', 'Total R$']],
      body: tableData,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [255, 85, 0], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 20 },
        2: { cellWidth: 55 },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 38 },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 14, halign: 'center' },
        7: { cellWidth: 16, halign: 'center', fillColor: [255, 218, 185], fontStyle: 'bold' }, // Salmão claro - Qtd Total
        8: { cellWidth: 20, halign: 'right' },
        9: { cellWidth: 20, halign: 'right' },
        10: { cellWidth: 22, halign: 'right' }
      },
      margin: { top: 10 },
    });

    // Rodapé com totais
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');

    const totalQtdPedido = pedido.itens.reduce((sum, item) => sum + item.qtdPedido, 0);
    const totalQtdUnidades = pedido.itens.reduce((sum, item) => sum + ((item.qtdEmbalagem || 1) * item.qtdPedido), 0);

    doc.text(`Qtd Pedido: ${totalQtdPedido}  |  Qtd Total Unidades: ${totalQtdUnidades}  |  VALOR TOTAL: R$ ${Number(pedido.valorTotal).toFixed(2)}`, 14, finalY);

    doc.save(`pedido-ruptura-${pedido.id}.pdf`);
  };

  // Excluir pedido salvo
  const excluirPedido = (pedidoId) => {
    if (window.confirm('Tem certeza que deseja excluir este pedido?')) {
      setPedidosSalvos(prev => prev.filter(p => p.id !== pedidoId));
    }
  };

  // Toggle expandir linha
  const toggleExpandRow = (descricao) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(descricao)) {
        newSet.delete(descricao);
      } else {
        newSet.add(descricao);
      }
      return newSet;
    });
  };

  // Estado para ordem das colunas (persistido no localStorage)
  // RESET: Limpa o localStorage para garantir que a coluna dias_atraso apareça
  const [rupturaColumns, setRupturaColumns] = useState(() => {
    // Força reset da ordem das colunas para incluir dias_atraso
    localStorage.removeItem('ruptura_columns_order');
    return RUPTURA_COLUMNS_DEFAULT;
  });

  // Persistir ordem das colunas
  useEffect(() => {
    const columnIds = rupturaColumns.map(col => col.id);
    localStorage.setItem('ruptura_columns_order', JSON.stringify(columnIds));
  }, [rupturaColumns]);

  // Drag and drop para colunas
  const [draggedCol, setDraggedCol] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleColumnDragStart = (e, columnId) => {
    setIsDragging(true);
    setDraggedCol(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId); // Necessário para Firefox
    e.target.style.opacity = '0.5';
  };

  const handleColumnDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedCol(null);
    setDragOverCol(null);
    // Delay para evitar que o click seja disparado após o drag
    setTimeout(() => setIsDragging(false), 100);
  };

  const handleColumnDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedCol === columnId) return;
    setDragOverCol(columnId);
  };

  const handleColumnDrop = (e, targetColumnId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCol || draggedCol === targetColumnId) return;

    const newColumns = [...rupturaColumns];
    const draggedIndex = newColumns.findIndex(c => c.id === draggedCol);
    const targetIndex = newColumns.findIndex(c => c.id === targetColumnId);

    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setRupturaColumns(newColumns);
    setDraggedCol(null);
    setDragOverCol(null);
  };

  // Função para buscar histórico de compras
  const fetchPurchaseHistory = async (product) => {
    setHistoryProduct(product);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      // Usar código se disponível, senão usar descrição codificada para busca
      const codigo = product.codigo || 'buscar';
      const descricaoParam = encodeURIComponent(product.descricao || '');
      const response = await api.get(`/products/${codigo}/purchase-history?limit=10&descricao=${descricaoParam}`);
      const historico = response.data.historico || [];
      setHistoryData(historico);

      // Se encontrou histórico, marcar o produto como tendo histórico (botão azul)
      if (historico.length > 0) {
        setProductsWithHistory(prev => new Set([...prev, product.descricao]));
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      setHistoryData([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Função para renderizar valor da célula baseado na coluna
  const renderCellValue = (item, columnId) => {
    switch (columnId) {
      case 'carrinho':
        const noCarrinho = isNoCarrinho(item.descricao);
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (noCarrinho) {
                removerDoCarrinho(item.descricao);
              } else {
                adicionarAoCarrinho(item);
              }
            }}
            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
              noCarrinho
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
            }`}
            title={noCarrinho ? 'Remover do carrinho' : 'Adicionar ao carrinho'}
          >
            {noCarrinho && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
              </svg>
            )}
          </button>
        );
      case 'descricao':
        return (
          <div className="flex items-center gap-1">
            {item.ocorrencias > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpandRow(item.descricao); }}
                className="w-5 h-5 flex items-center justify-center text-blue-600 hover:bg-blue-100 rounded transition-colors font-bold"
              >
                {expandedRows.has(item.descricao) ? '−' : '+'}
              </button>
            )}
            <p className="font-medium text-gray-800 max-w-xs truncate" title={item.descricao}>
              {item.descricao}
            </p>
          </div>
        );
      case 'fornecedor':
        return <span className="text-gray-600 max-w-xs truncate block" title={item.fornecedor}>{item.fornecedor}</span>;
      case 'secao':
        return <span className="text-gray-600 max-w-xs truncate block" title={item.secao}>{item.secao}</span>;
      case 'curva':
        return (
          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
            item.curva === 'A' ? 'bg-red-100 text-red-700' :
            item.curva === 'B' ? 'bg-yellow-100 text-yellow-700' :
            item.curva === 'C' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {item.curva}
          </span>
        );
      case 'estoque_atual':
        return (
          <span className={item.estoque_atual > 0 ? 'text-green-600' : 'text-red-600'}>
            {Number(item.estoque_atual || 0).toFixed(0)}
          </span>
        );
      case 'venda_media_dia':
        return <span className="text-gray-700">{Number(item.venda_media_dia || 0).toFixed(2)}</span>;
      case 'valor_venda':
        return <span className="text-gray-700">R$ {Number(item.valor_venda || 0).toFixed(2)}</span>;
      case 'margem_lucro':
        return <span className="text-gray-700">{Number(item.margem_lucro || 0).toFixed(1)}%</span>;
      case 'tem_pedido':
        return (
          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
            item.tem_pedido === 'Sim' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {item.tem_pedido === 'Sim' ? 'Sim' : 'Não'}
          </span>
        );
      case 'status_pedido':
        return (
          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
            item.status_pedido === 'Pendente' ? 'bg-amber-100 text-amber-700' :
            item.status_pedido === 'Parcial' ? 'bg-blue-100 text-blue-700' :
            item.status_pedido === 'Completo' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {item.status_pedido || '-'}
          </span>
        );
      case 'data_entrega':
        return (
          <span className={`text-xs font-medium ${item.data_entrega ? 'text-teal-700' : 'text-gray-400'}`}>
            {item.data_entrega || '-'}
          </span>
        );
      case 'dias_atraso':
        return item.dias_atraso ? (
          <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700">
            {item.dias_atraso}d
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'ocorrencias':
        return (
          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
            item.ocorrencias > 1 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {item.ocorrencias}
          </span>
        );
      case 'perda_total':
        return <span className="font-bold text-red-600">R$ {Number(item.perda_total || 0).toFixed(2)}</span>;
      case 'historico':
        // Botão cinza por padrão, azul se já verificou e tem histórico
        const hasHistory = productsWithHistory.has(item.descricao);
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchPurchaseHistory({ codigo: item.codigo || item.codigo_barras, descricao: item.descricao });
            }}
            className={`p-1.5 rounded transition-colors ${
              hasHistory
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
            title={hasHistory ? 'Ver histórico de compras' : 'Verificar histórico'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </button>
        );
      default:
        return item[columnId] || '-';
    }
  };

  useEffect(() => {
    loadFilterOptions();

    // Definir período padrão: dia 1 do mês atual até hoje
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(primeiroDiaMes.toISOString().split('T')[0]);
  }, []);

  const loadFilterOptions = async () => {
    try {
      // Buscar produtos únicos
      const produtosRes = await api.get('/rupture-surveys/filters/produtos');
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);

      // Buscar fornecedores únicos
      const fornecedoresRes = await api.get('/rupture-surveys/filters/fornecedores');
      setFornecedores(Array.isArray(fornecedoresRes.data) ? fornecedoresRes.data : []);

      // Buscar auditores (employees) - endpoint retorna { data: [...], total, page, limit }
      const auditoresRes = await api.get('/employees?active=true&limit=100');
      const auditorList = Array.isArray(auditoresRes.data?.data) ? auditoresRes.data.data : [];
      setAuditores(auditorList);
    } catch (err) {
      console.error('Erro ao carregar filtros:', err);
      setProdutos([]);
      setFornecedores([]);
      setAuditores([]);
    }
  };

  const handleFiltrar = async () => {
    if (!dataInicio || !dataFim) {
      setError('Selecione o período (data início e fim)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        data_inicio: dataInicio,
        data_fim: dataFim,
        produto: produtoSelecionado,
        fornecedor: fornecedorSelecionado,
        auditor: auditorSelecionado,
      });

      const response = await api.get(`/rupture-surveys/agregado?${params}`);
      setResultados(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar resultados');
    } finally {
      setLoading(false);
    }
  };

  // Executar filtro automaticamente quando período for definido
  useEffect(() => {
    if (dataInicio && dataFim) {
      handleFiltrar();
    }
  }, [dataInicio, dataFim]);

  const stats = resultados?.estatisticas || {};
  const todosItensRuptura = resultados?.itens_ruptura || [];
  const fornecedoresRanking = resultados?.fornecedores_ranking || [];
  const secoesRanking = resultados?.secoes_ranking || [];

  // Aplicar filtros na tabela de produtos
  let itensRuptura = todosItensRuptura;

  // Filtro por tipo de ruptura
  if (filtroTipoRuptura === 'nao_encontrado') {
    itensRuptura = itensRuptura.filter(item => item.ocorrencias_nao_encontrado > 0);
  } else if (filtroTipoRuptura === 'ruptura_estoque') {
    itensRuptura = itensRuptura.filter(item => item.ocorrencias_em_estoque > 0);
  }

  // Filtro por fornecedor (clicado no card)
  if (filtroFornecedorTabela !== 'todos') {
    itensRuptura = itensRuptura.filter(item => item.fornecedor === filtroFornecedorTabela);
  }

  // Filtro por setor (clicado no card)
  if (filtroSetorTabela !== 'todos') {
    itensRuptura = itensRuptura.filter(item => item.secao === filtroSetorTabela);
  }

  // Função para ordenar (só se não estiver arrastando)
  const handleSort = (column) => {
    // Não ordenar se estiver no meio de um drag
    if (isDragging) return;

    if (sortColumn === column) {
      // Se já está ordenando por essa coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nova coluna, começa com ascendente
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Função para excluir ruptura por descrição do produto
  const handleDeleteRuptura = async (descricaoProduto, descricaoExibicao) => {
    if (!canDelete) {
      alert('Você não tem permissão para excluir rupturas.');
      return;
    }

    const confirmMessage = `Tem certeza que deseja excluir todas as rupturas do produto:\n\n"${descricaoExibicao}"\n\nNo período de ${dataInicio} a ${dataFim}?\n\nEsta ação não pode ser desfeita.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingProduct(descricaoProduto);
    try {
      // Usar encodeURIComponent para codificar a descrição na URL
      const response = await api.delete(`/rupture-surveys/by-product/${encodeURIComponent(descricaoProduto)}?data_inicio=${dataInicio}&data_fim=${dataFim}`);

      if (response.data.success) {
        alert(`${response.data.deletedCount} registro(s) excluído(s) com sucesso!`);
        // Recarregar dados para atualizar totais
        handleFiltrar();
      }
    } catch (err) {
      console.error('Erro ao excluir ruptura:', err);
      alert(err.response?.data?.error || 'Erro ao excluir ruptura');
    } finally {
      setDeletingProduct(null);
    }
  };


  // Aplicar ordenação
  if (sortColumn) {
    itensRuptura = [...itensRuptura].sort((a, b) => {
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];

      // Tratamento especial para valores numéricos
      if (['estoque_atual', 'venda_media_dia', 'valor_venda', 'margem_lucro', 'ocorrencias', 'perda_total'].includes(sortColumn)) {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else {
        // Para strings, converter para minúsculas para comparação
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Contar itens por tipo para os botões
  const countTodos = todosItensRuptura.length;
  const countNaoEncontrado = todosItensRuptura.filter(item => item.ocorrencias_nao_encontrado > 0).length;
  const countEmEstoque = todosItensRuptura.filter(item => item.ocorrencias_em_estoque > 0).length;

  // Paginação
  const totalItems = itensRuptura.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = itensRuptura.slice(startIndex, endIndex);

  // Funções de navegação de páginas
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPrevPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  // Calcular estatísticas baseadas nos itens filtrados
  const filteredStats = {
    total_rupturas: itensRuptura.length,
    perda_venda_periodo: itensRuptura.reduce((sum, item) => sum + Number(item.perda_total || 0), 0),
    perda_lucro_periodo: itensRuptura.reduce((sum, item) => {
      const perdaVenda = Number(item.perda_total || 0);
      const margem = Number(item.margem_lucro || 0) / 100;
      return sum + (perdaVenda * margem);
    }, 0),
  };

  // Verificar se há filtro ativo
  const hasActiveFilter = filtroTipoRuptura !== 'todos' || filtroFornecedorTabela !== 'todos' || filtroSetorTabela !== 'todos';

  // Função para gerar PDF
  const gerarPDF = () => {
    const doc = new jsPDF('landscape'); // Paisagem para caber todas as colunas

    // Título
    doc.setFontSize(16);
    doc.text('Relatório de Rupturas - Resultados Agregados', 14, 15);

    // Período
    doc.setFontSize(10);
    doc.text(`Período: ${dataInicio} até ${dataFim}`, 14, 22);

    // Estatísticas
    doc.setFontSize(12);
    doc.text('Resumo:', 14, 30);
    doc.setFontSize(9);
    doc.text(`Total de Rupturas: ${stats.total_rupturas || 0}`, 14, 36);
    doc.text(`Não Encontrado: ${stats.rupturas_nao_encontrado || 0}`, 14, 41);
    doc.text(`Em Estoque: ${stats.rupturas_em_estoque || 0}`, 14, 46);
    doc.text(`Taxa de Ruptura: ${stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%`, 14, 51);

    // Tabela de produtos
    const tableData = itensRuptura.map((item, idx) => [
      idx + 1,
      item.descricao || '',
      item.fornecedor || 'Sem fornecedor',
      item.secao || 'Sem seção',
      item.curva || '-',
      Number(item.estoque_atual || 0).toFixed(0),
      Number(item.venda_media_dia || 0).toFixed(2),
      `R$ ${Number(item.valor_venda || 0).toFixed(2)}`,
      `${Number(item.margem_lucro || 0).toFixed(1)}%`,
      item.tem_pedido || '-',
      item.ocorrencias || 0,
      `R$ ${Number(item.perda_total || 0).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 56,
      head: [['#', 'Produto', 'Fornecedor', 'Seção', 'Curva', 'Estoque', 'V.Média/Dia', 'Valor Venda', 'Margem %', 'Pedido', 'Ocorrências', 'Perda Total']],
      body: tableData,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [255, 85, 0], textColor: 255 },
      margin: { top: 10 },
    });

    // Salvar PDF
    const nomeArquivo = `rupturas-agregado-${dataInicio}-${dataFim}.pdf`;
    doc.save(nomeArquivo);
  };

  return (
    <Layout>
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">📊 Resultados das Auditorias</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Análise agregada de múltiplas pesquisas de ruptura com filtros avançados
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">🔍 Filtros</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Data Início */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Data Fim */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Produto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Produto
              </label>
              <input
                type="text"
                value={produtoSelecionado === 'todos' ? '' : produtoSelecionado}
                onChange={(e) => setProdutoSelecionado(e.target.value || 'todos')}
                placeholder="Digite o nome do produto ou deixe vazio para todos"
                list="produtos-list"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="produtos-list">
                {Array.isArray(produtos) && produtos.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            {/* Fornecedor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fornecedor
              </label>
              <select
                value={fornecedorSelecionado}
                onChange={(e) => setFornecedorSelecionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                {Array.isArray(fornecedores) && fornecedores.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Auditor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auditor
              </label>
              <select
                value={auditorSelecionado}
                onChange={(e) => setAuditorSelecionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                {Array.isArray(auditores) && auditores.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleFiltrar}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '⏳ Carregando...' : '🔍 Aplicar Filtros'}
            </button>
            <button
              onClick={() => {
                setProdutoSelecionado('todos');
                setFornecedorSelecionado('todos');
                setAuditorSelecionado('todos');
              }}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              🔄 Limpar Filtros
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Resultados */}
        {resultados && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-gray-800">{stats.total_itens_verificados || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Itens Verificados</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-green-600">{stats.total_encontrados || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Encontrados</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-red-600">{stats.total_rupturas || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Rupturas Total</div>
                {(stats.rupturas_nao_encontrado > 0 || stats.rupturas_em_estoque > 0) && (
                  <div className="text-xs text-gray-500 mt-2">
                    {stats.rupturas_nao_encontrado > 0 && <div>{stats.rupturas_nao_encontrado} Não Encontrado</div>}
                    {stats.rupturas_em_estoque > 0 && <div>{stats.rupturas_em_estoque} Em Estoque</div>}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%
                </div>
                <div className="text-sm text-gray-600 mt-1">Taxa Ruptura</div>
              </div>
            </div>

            {/* Financial Impact - Baseado no Período ou Filtro */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-red-700">
                  R$ {Number(hasActiveFilter ? filteredStats.perda_venda_periodo : stats.perda_venda_periodo || 0).toFixed(2)}
                </div>
                <div className="text-sm text-red-600 mt-1">
                  Perda Venda {hasActiveFilter ? '(Filtrado)' : 'no Período'}
                </div>
                {hasActiveFilter && (
                  <div className="text-xs text-gray-500 mt-1">
                    Total: R$ {Number(stats.perda_venda_periodo || 0).toFixed(2)}
                  </div>
                )}
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-orange-700">
                  R$ {Number(hasActiveFilter ? filteredStats.perda_lucro_periodo : stats.perda_lucro_periodo || 0).toFixed(2)}
                </div>
                <div className="text-sm text-orange-600 mt-1">
                  Perda Lucro {hasActiveFilter ? '(Filtrado)' : 'no Período'}
                </div>
                {hasActiveFilter && (
                  <div className="text-xs text-gray-500 mt-1">
                    Total: R$ {Number(stats.perda_lucro_periodo || 0).toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Fornecedores, Setores e Evolução Mensal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

              {/* Fornecedores com mais Rupturas */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  🏪 Fornecedores
                </h2>

                {fornecedoresRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma ruptura
                  </p>
                ) : (
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {fornecedoresRanking.slice(0, 15).map((forn, idx) => {
                      const maxPerda = Math.max(...fornecedoresRanking.map(f => f.perda_total));
                      const percentage = maxPerda > 0 ? (forn.perda_total / maxPerda) * 100 : 0;
                      const isSelected = filtroFornecedorTabela === forn.fornecedor;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (isSelected) {
                              // Se já está selecionado, remove o filtro
                              setFiltroFornecedorTabela('todos');
                            } else {
                              // Seleciona o fornecedor
                              setFiltroFornecedorTabela(forn.fornecedor);
                              setFiltroTipoRuptura('todos');
                              setFiltroSetorTabela('todos');
                            }
                          }}
                          className={`cursor-pointer p-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-purple-100 border-2 border-purple-500'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm truncate" title={forn.fornecedor}>
                                {forn.fornecedor}
                              </p>
                              <p className="text-xs text-gray-500">
                                {forn.rupturas} {forn.rupturas === 1 ? 'ruptura' : 'rupturas'}
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-bold text-red-600">
                                R$ {Number(forn.perda_total || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Setores (Seções) com mais Rupturas */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  🏬 Setores
                </h2>

                {secoesRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma ruptura
                  </p>
                ) : (
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {secoesRanking.slice(0, 15).map((sec, idx) => {
                      const maxPerda = Math.max(...secoesRanking.map(s => s.perda_total));
                      const percentage = maxPerda > 0 ? (sec.perda_total / maxPerda) * 100 : 0;
                      const isSelected = filtroSetorTabela === sec.secao;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (isSelected) {
                              // Se já está selecionado, remove o filtro
                              setFiltroSetorTabela('todos');
                            } else {
                              // Seleciona o setor
                              setFiltroSetorTabela(sec.secao);
                              setFiltroTipoRuptura('todos');
                              setFiltroFornecedorTabela('todos');
                            }
                          }}
                          className={`cursor-pointer p-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-orange-100 border-2 border-orange-500'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm truncate" title={sec.secao}>
                                {sec.secao}
                              </p>
                              <p className="text-xs text-gray-500">
                                {sec.rupturas} {sec.rupturas === 1 ? 'ruptura' : 'rupturas'}
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-bold text-red-600">
                                R$ {Number(sec.perda_total || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Evolução Mensal - Barras Verticais */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-800">
                    📈 Evolução {anoEvolucao}
                  </h2>
                  <select
                    value={anoEvolucao}
                    onChange={(e) => setAnoEvolucao(parseInt(e.target.value))}
                    className="px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {[2024, 2025, 2026, 2027].map(ano => (
                      <option key={ano} value={ano}>{ano}</option>
                    ))}
                  </select>
                </div>

                {/* Gráfico de barras verticais - Dados REAIS do banco */}
                {loadingEvolucao ? (
                  <div className="flex items-center justify-center h-48 bg-gray-50 rounded">
                    <span className="text-gray-500">Carregando...</span>
                  </div>
                ) : (() => {
                  const meses = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
                  const mesAtual = new Date().getMonth();
                  const anoAtual = new Date().getFullYear();

                  // Usar dados reais do backend
                  const dadosMensais = meses.map((mes, idx) => {
                    const dadoMes = evolucaoMensal.find(e => e.mes === idx + 1) || {};
                    const temDados = dadoMes.totalVerificados > 0;

                    return {
                      mes,
                      mesFull: dadoMes.mesNome || mes,
                      perdaVenda: dadoMes.perdaVenda || 0,
                      perdaLucro: dadoMes.perdaLucro || 0,
                      taxaRuptura: dadoMes.taxaRuptura || 0,
                      totalRupturas: dadoMes.totalRupturas || 0,
                      totalVerificados: dadoMes.totalVerificados || 0,
                      temDados,
                      isAtual: anoEvolucao === anoAtual && idx === mesAtual
                    };
                  });

                  const maxPerdaVenda = Math.max(...dadosMensais.map(d => d.perdaVenda || 0), 1);
                  const maxRuptura = Math.max(...dadosMensais.map(d => d.taxaRuptura || 0), 40);

                  return (
                    <div className="flex items-end justify-around h-48 border-b border-gray-200 bg-gray-50 rounded-t px-2 py-1">
                      {dadosMensais.map((dado, idx) => (
                        <div
                          key={idx}
                          className={`flex flex-col items-center group cursor-pointer ${mesSelecionado === idx ? 'scale-110' : ''}`}
                          onClick={() => setMesSelecionado(mesSelecionado === idx ? null : idx)}
                        >
                          <div className="flex items-end gap-0.5 h-44 justify-center">
                            {dado.temDados ? (
                              <>
                                <div className="w-4 bg-green-500 rounded-t hover:bg-green-600 transition-all shadow" style={{ height: `${Math.max(12, (dado.perdaVenda / maxPerdaVenda) * 100)}%` }} />
                                <div className={`w-4 rounded-t transition-all shadow ${dado.taxaRuptura > 30 ? 'bg-red-500' : dado.taxaRuptura > 20 ? 'bg-orange-500' : 'bg-yellow-500'}`} style={{ height: `${Math.max(12, (dado.taxaRuptura / maxRuptura) * 100)}%` }} />
                                <div className="w-4 bg-blue-500 rounded-t hover:bg-blue-600 transition-all shadow" style={{ height: `${Math.max(12, (dado.perdaLucro / maxPerdaVenda) * 100)}%` }} />
                              </>
                            ) : (
                              <div className="w-12 h-2 bg-gray-300 rounded" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Meses embaixo - clicáveis */}
                <div className="flex justify-between px-0.5 mt-1">
                  {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((mes, idx) => (
                    <span
                      key={idx}
                      className={`flex-1 text-center text-xs cursor-pointer transition-all ${
                        mesSelecionado === idx ? 'text-orange-600 font-bold scale-110' :
                        new Date().getMonth() === idx && anoEvolucao === new Date().getFullYear() ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'
                      }`}
                      onClick={() => setMesSelecionado(mesSelecionado === idx ? null : idx)}
                    >
                      {mes}
                    </span>
                  ))}
                </div>

                {/* Detalhes do mês selecionado */}
                {mesSelecionado !== null && evolucaoMensal[mesSelecionado] && (
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-orange-700 text-sm">
                        📅 {evolucaoMensal[mesSelecionado].mesNome} {anoEvolucao}
                      </h4>
                      <button onClick={() => setMesSelecionado(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                    {evolucaoMensal[mesSelecionado].totalVerificados > 0 ? (
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-green-100 rounded p-2">
                          <div className="text-lg font-bold text-green-700">R$ {evolucaoMensal[mesSelecionado].perdaVenda.toFixed(2)}</div>
                          <div className="text-xs text-green-600">Perda Venda</div>
                        </div>
                        <div className="bg-red-100 rounded p-2">
                          <div className="text-lg font-bold text-red-700">{evolucaoMensal[mesSelecionado].taxaRuptura.toFixed(1)}%</div>
                          <div className="text-xs text-red-600">Taxa Ruptura ({evolucaoMensal[mesSelecionado].totalRupturas}/{evolucaoMensal[mesSelecionado].totalVerificados})</div>
                        </div>
                        <div className="bg-blue-100 rounded p-2">
                          <div className="text-lg font-bold text-blue-700">R$ {evolucaoMensal[mesSelecionado].perdaLucro.toFixed(2)}</div>
                          <div className="text-xs text-blue-600">Perda Lucro</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-2">Sem dados para este mês</div>
                    )}
                  </div>
                )}

                {/* Legenda */}
                <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded"></div>
                    <span className="text-gray-600">Perda Venda</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-orange-400 rounded"></div>
                    <span className="text-gray-600">Ruptura</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded"></div>
                    <span className="text-gray-600">Perda Lucro</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Abas estilo Prevenção Margem */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setAbaAtiva('produtos')}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-colors border-2 ${
                    abaAtiva === 'produtos'
                      ? 'bg-white border-gray-300 text-gray-800 shadow-sm'
                      : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📦 PRODUTOS
                </button>
                <button
                  onClick={() => setAbaAtiva('pedido')}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    abaAtiva === 'pedido'
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  }`}
                >
                  🛒 PEDIDO
                  {carrinho.length > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      abaAtiva === 'pedido' ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
                    }`}>
                      {carrinho.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setAbaAtiva('pedidos_realizados')}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    abaAtiva === 'pedidos_realizados'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  📋 PEDIDOS REALIZADOS
                  {pedidosSalvos.length > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      abaAtiva === 'pedidos_realizados' ? 'bg-white text-green-600' : 'bg-green-500 text-white'
                    }`}>
                      {pedidosSalvos.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Conteúdo da Aba PEDIDO */}
            {abaAtiva === 'pedido' && (
              <div className="mb-6">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Barra laranja estilo prevenção margem */}
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex items-center justify-between">
                    <div className="text-white">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        📋 Novo Pedido
                      </h3>
                      <p className="text-sm text-orange-100">
                        {carrinho.length} produto(s) selecionado(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={limparCarrinho}
                        disabled={carrinho.length === 0}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        Limpar Seleção
                      </button>
                      <button
                        onClick={salvarPedido}
                        disabled={carrinho.length === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        Salvar Pedido
                      </button>
                      <button
                        onClick={() => {
                          if (carrinho.length > 0) {
                            const qtdPedido = carrinho.reduce((sum, item) => sum + item.qtdPedido, 0);
                            const qtdTotalUnidades = carrinho.reduce((sum, item) => sum + ((item.qtdEmbalagem || 1) * item.qtdPedido), 0);
                            const valorTotal = carrinho.reduce((sum, item) => {
                              const qtdTotal = (item.qtdEmbalagem || 1) * item.qtdPedido;
                              return sum + (qtdTotal * (item.novoCusto || 0));
                            }, 0);
                            gerarPDFPedido({
                              id: 'preview',
                              data: new Date().toLocaleDateString('pt-BR'),
                              hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                              fornecedor: carrinho[0]?.fornecedor || 'Diversos',
                              qtdProdutos: carrinho.length,
                              qtdPedido,
                              qtdTotalUnidades,
                              valorTotal,
                              itens: carrinho
                            });
                          }
                        }}
                        disabled={carrinho.length === 0}
                        className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Tabela de itens do carrinho */}
                  {carrinho.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="text-6xl mb-4">🛒</div>
                      <p className="text-xl text-gray-600 mb-2">Carrinho vazio</p>
                      <p className="text-gray-500">Selecione produtos na aba PRODUTOS para adicionar ao pedido</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <p className="text-xs text-gray-500 px-4 py-1 bg-gray-50">💡 Arraste os cabeçalhos das colunas para reordenar</p>
                      <table className="min-w-full text-sm">
                        <thead className="bg-cyan-100 border-b-2 border-cyan-300">
                          <tr>
                            {carrinhoColumns.map((col) => (
                              <th
                                key={col.id}
                                draggable={!col.fixed}
                                onDragStart={(e) => !col.fixed && handleCarrinhoColDragStart(e, col.id)}
                                onDragEnd={handleCarrinhoColDragEnd}
                                onDragOver={(e) => !col.fixed && handleCarrinhoColDragOver(e, col.id)}
                                onDrop={(e) => !col.fixed && handleCarrinhoColDrop(e, col.id)}
                                className={`px-2 py-2 text-${col.align} text-xs font-bold text-gray-700 select-none transition-all ${
                                  col.bg || ''
                                } ${!col.fixed ? 'cursor-grab hover:bg-cyan-200' : ''} ${
                                  draggedCarrinhoCol === col.id ? 'opacity-50 bg-blue-200' : ''
                                } ${dragOverCarrinhoCol === col.id ? 'bg-blue-100 border-l-2 border-blue-500' : ''}`}
                                title={!col.fixed ? 'Arraste para reordenar' : ''}
                              >
                                <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                  {!col.fixed && <span className="text-gray-400 text-[10px]">⋮⋮</span>}
                                  {col.label}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {carrinho.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              {carrinhoColumns.map((col) => {
                                const bgClass = col.id === 'qtdEmbalagem' ? 'bg-cyan-50' :
                                               col.id === 'qtdPedido' ? 'bg-green-50' :
                                               col.id === 'qtdTotal' ? 'bg-yellow-50' :
                                               col.id === 'ultimoCusto' ? 'bg-gray-50' :
                                               col.id === 'novoCusto' ? 'bg-blue-50' :
                                               col.id === 'valorTotal' ? 'bg-orange-50' :
                                               col.id === 'venda_media_dia' ? 'bg-purple-50' : '';
                                return (
                                  <td key={col.id} className={`px-2 py-2 text-${col.align} ${bgClass}`}>
                                    {renderCarrinhoCellValue(item, col.id)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-orange-100 border-t-2 border-orange-400">
                          <tr>
                            {carrinhoColumns.map((col, idx) => {
                              // Encontrar índice das colunas especiais para mostrar totais
                              const qtdPedidoIdx = carrinhoColumns.findIndex(c => c.id === 'qtdPedido');
                              const qtdTotalIdx = carrinhoColumns.findIndex(c => c.id === 'qtdTotal');
                              const valorTotalIdx = carrinhoColumns.findIndex(c => c.id === 'valorTotal');

                              if (col.id === 'qtdPedido') {
                                return (
                                  <td key={col.id} className="px-2 py-3 text-center font-bold text-green-700 bg-green-100">
                                    {carrinho.reduce((sum, item) => sum + item.qtdPedido, 0)}
                                  </td>
                                );
                              } else if (col.id === 'qtdTotal') {
                                return (
                                  <td key={col.id} className="px-2 py-3 text-center font-bold text-yellow-700 bg-yellow-100">
                                    {carrinho.reduce((sum, item) => sum + ((item.qtdEmbalagem || 1) * item.qtdPedido), 0)}
                                  </td>
                                );
                              } else if (col.id === 'valorTotal') {
                                return (
                                  <td key={col.id} className="px-2 py-3 text-right font-bold text-orange-700 bg-orange-200 text-base">
                                    R$ {carrinho.reduce((sum, item) => {
                                      const qtdTotal = (item.qtdEmbalagem || 1) * item.qtdPedido;
                                      return sum + (qtdTotal * (item.novoCusto || 0));
                                    }, 0).toFixed(2)}
                                  </td>
                                );
                              } else if (idx === 0) {
                                // Primeira coluna mostra TOTAIS
                                return (
                                  <td key={col.id} className="px-2 py-3 text-right font-bold text-gray-700" colSpan={1}>
                                    TOTAIS:
                                  </td>
                                );
                              } else {
                                return <td key={col.id} className="px-2 py-3"></td>;
                              }
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conteúdo da Aba PEDIDOS REALIZADOS */}
            {abaAtiva === 'pedidos_realizados' && (
              <div className="mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Pedidos Realizados</h2>

                  {pedidosSalvos.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📋</div>
                      <p className="text-xl text-gray-600 mb-2">Nenhum pedido salvo</p>
                      <p className="text-gray-500">Os pedidos salvos aparecerão aqui</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-green-100 border-b-2 border-green-300">
                          <tr>
                            <th className="px-2 py-3 text-center text-xs font-bold text-gray-700 w-8"></th>
                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">ID</th>
                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">Data/Hora</th>
                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">Fornecedor</th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 bg-blue-100">Produtos</th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 bg-green-200">Qtd Ped.</th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 bg-yellow-200">Qtd Total</th>
                            <th className="px-3 py-3 text-right text-xs font-bold text-gray-700 bg-orange-200">Valor Total</th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-gray-700">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {pedidosSalvos.map((pedido, idx) => {
                            const isExpanded = pedidosExpandidos.has(pedido.id);
                            return (
                              <Fragment key={pedido.id}>
                                <tr className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isExpanded ? 'bg-orange-50' : ''} cursor-pointer hover:bg-gray-100`} onClick={() => togglePedidoExpandido(pedido.id)}>
                                  <td className="px-2 py-3 text-center">
                                    <button
                                      className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${isExpanded ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                                    >
                                      {isExpanded ? '−' : '+'}
                                    </button>
                                  </td>
                                  <td className="px-3 py-3 text-gray-600 font-mono text-xs">#{pedido.id}</td>
                                  <td className="px-3 py-3 text-gray-800">{pedido.data} {pedido.hora}</td>
                                  <td className="px-3 py-3 text-gray-600 max-w-[150px] truncate" title={pedido.fornecedor}>{pedido.fornecedor}</td>
                                  <td className="px-3 py-3 text-center bg-blue-50">
                                    <span className="font-bold text-blue-700">
                                      {pedido.qtdProdutos}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center bg-green-50">
                                    <span className="font-bold text-green-700">
                                      {pedido.qtdPedido || pedido.qtdTotal || 0}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center bg-yellow-50">
                                    <span className="font-bold text-yellow-700">
                                      {pedido.qtdTotalUnidades || pedido.itens?.reduce((sum, item) => sum + ((item.qtdEmbalagem || 1) * item.qtdPedido), 0) || 0}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-right bg-orange-50 font-bold text-orange-700">
                                    R$ {Number(pedido.valorTotal).toFixed(2)}
                                  </td>
                                  <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => gerarPDFPedido(pedido)}
                                        className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded transition-colors"
                                        title="Gerar PDF"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => excluirPedido(pedido.id)}
                                        className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                                        title="Excluir pedido"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {/* Linha expandida com itens do pedido */}
                                {isExpanded && (
                                  <tr className="bg-orange-50">
                                    <td colSpan="9" className="px-4 py-3">
                                      <div className="bg-white rounded-lg shadow-inner p-3 border border-orange-200">
                                        <h4 className="font-bold text-gray-700 mb-2 text-sm">📦 Itens do Pedido ({pedido.itens?.length || 0})</h4>
                                        <table className="min-w-full text-xs">
                                          <thead className="bg-gray-100">
                                            <tr>
                                              <th className="px-2 py-1.5 text-left font-semibold">#</th>
                                              <th className="px-2 py-1.5 text-left font-semibold">Código</th>
                                              <th className="px-2 py-1.5 text-left font-semibold">Produto</th>
                                              <th className="px-2 py-1.5 text-center font-semibold">Curva</th>
                                              <th className="px-2 py-1.5 text-left font-semibold">Fornecedor</th>
                                              <th className="px-2 py-1.5 text-center font-semibold">Embal.</th>
                                              <th className="px-2 py-1.5 text-center font-semibold">Qtd Ped.</th>
                                              <th className="px-2 py-1.5 text-center font-semibold">Qtd Total</th>
                                              <th className="px-2 py-1.5 text-right font-semibold">Últ. Custo</th>
                                              <th className="px-2 py-1.5 text-right font-semibold">Novo Custo</th>
                                              <th className="px-2 py-1.5 text-right font-semibold">Total R$</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {pedido.itens?.map((item, itemIdx) => {
                                              const qtdTotal = (item.qtdEmbalagem || 1) * item.qtdPedido;
                                              const valorTotal = qtdTotal * (item.novoCusto || 0);
                                              return (
                                                <tr key={itemIdx} className={itemIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                  <td className="px-2 py-1.5">{itemIdx + 1}</td>
                                                  <td className="px-2 py-1.5 font-mono">{item.codigo || '-'}</td>
                                                  <td className="px-2 py-1.5 max-w-[200px] truncate" title={item.descricao}>{item.descricao}</td>
                                                  <td className="px-2 py-1.5 text-center">
                                                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                                                      item.curva === 'A' ? 'bg-red-100 text-red-700' :
                                                      item.curva === 'B' ? 'bg-yellow-100 text-yellow-700' :
                                                      item.curva === 'C' ? 'bg-green-100 text-green-700' : 'bg-gray-100'
                                                    }`}>{item.curva || '-'}</span>
                                                  </td>
                                                  <td className="px-2 py-1.5 max-w-[120px] truncate" title={item.fornecedor}>{item.fornecedor || '-'}</td>
                                                  <td className="px-2 py-1.5 text-center">{item.qtdEmbalagem || 1}</td>
                                                  <td className="px-2 py-1.5 text-center font-bold text-green-700">{item.qtdPedido}</td>
                                                  <td className="px-2 py-1.5 text-center font-bold text-yellow-700">{qtdTotal}</td>
                                                  <td className="px-2 py-1.5 text-right">R$ {Number(item.ultimoCusto || 0).toFixed(2)}</td>
                                                  <td className="px-2 py-1.5 text-right font-bold text-blue-700">R$ {Number(item.novoCusto || 0).toFixed(2)}</td>
                                                  <td className="px-2 py-1.5 text-right font-bold text-orange-700">R$ {valorTotal.toFixed(2)}</td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Produtos com Ruptura - Largura Total (só mostra na aba produtos) */}
            {abaAtiva === 'produtos' && (
            <div className="mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    📦 Produtos com Ruptura ({itensRuptura.length})
                  </h2>
                  {itensRuptura.length > 0 && (
                    <button
                      onClick={gerarPDF}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      Gerar PDF
                    </button>
                  )}
                </div>

                {/* Filtros de Tipo de Ruptura */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => {
                      setFiltroTipoRuptura('todos');
                      setFiltroFornecedorTabela('todos');
                      setFiltroSetorTabela('todos');
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filtroTipoRuptura === 'todos' && filtroFornecedorTabela === 'todos' && filtroSetorTabela === 'todos'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Todos ({countTodos})
                  </button>
                  <button
                    onClick={() => {
                      setFiltroTipoRuptura('nao_encontrado');
                      setFiltroFornecedorTabela('todos');
                      setFiltroSetorTabela('todos');
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filtroTipoRuptura === 'nao_encontrado'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Não Encontrado ({countNaoEncontrado})
                  </button>
                  <button
                    onClick={() => {
                      setFiltroTipoRuptura('ruptura_estoque');
                      setFiltroFornecedorTabela('todos');
                      setFiltroSetorTabela('todos');
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filtroTipoRuptura === 'ruptura_estoque'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Em Estoque ({countEmEstoque})
                  </button>

                  {/* Indicador de filtro ativo por fornecedor ou setor */}
                  {filtroFornecedorTabela !== 'todos' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-800 rounded-lg">
                      <span className="font-medium">Fornecedor: {filtroFornecedorTabela}</span>
                      <button
                        onClick={() => setFiltroFornecedorTabela('todos')}
                        className="ml-2 text-purple-600 hover:text-purple-900"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {filtroSetorTabela !== 'todos' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg">
                      <span className="font-medium">Setor: {filtroSetorTabela}</span>
                      <button
                        onClick={() => setFiltroSetorTabela('todos')}
                        className="ml-2 text-orange-600 hover:text-orange-900"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {itensRuptura.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    🎉 Nenhuma ruptura encontrada no período!
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-orange-100 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                          {rupturaColumns.map((col) => (
                            <th
                              key={col.id}
                              draggable="true"
                              onDragStart={(e) => handleColumnDragStart(e, col.id)}
                              onDragEnd={handleColumnDragEnd}
                              onDragOver={(e) => handleColumnDragOver(e, col.id)}
                              onDrop={(e) => handleColumnDrop(e, col.id)}
                              className={`px-3 py-2 text-${col.align} text-xs font-medium text-gray-500 uppercase select-none transition-all ${
                                col.sortable ? 'hover:bg-orange-200 cursor-pointer' : ''
                              } ${draggedCol === col.id ? 'opacity-50 bg-blue-200' : ''} ${dragOverCol === col.id ? 'bg-blue-100 border-l-2 border-blue-500' : ''}`}
                              onClick={() => col.sortable && handleSort(col.id)}
                              title={col.sortable ? "Arraste para reordenar | Clique para ordenar" : "Arraste para reordenar"}
                            >
                              <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                <span className="text-gray-400 cursor-grab text-[10px]">⋮⋮</span>
                                {col.label}
                                {sortColumn === col.id && (
                                  <span className="text-blue-600">
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                          {canDelete && (
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                              Excluir
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paginatedItems.map((item, idx) => (
                          <Fragment key={idx}>
                            <tr className={`hover:bg-gray-50 ${item.ocorrencias > 1 ? 'cursor-pointer' : ''}`}>
                              <td className="px-3 py-2 text-gray-600">{startIndex + idx + 1}</td>
                              {rupturaColumns.map((col) => (
                                <td key={col.id} className={`px-3 py-2 text-${col.align}`}>
                                  {renderCellValue(item, col.id)}
                                </td>
                              ))}
                              {/* Coluna de excluir */}
                              {canDelete && (
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => handleDeleteRuptura(item.descricao, item.descricao)}
                                    disabled={deletingProduct === item.descricao}
                                    className={`p-1.5 rounded transition-colors ${
                                      deletingProduct === item.descricao
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700'
                                    }`}
                                    title="Excluir ruptura"
                                  >
                                    {deletingProduct === item.descricao ? (
                                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                      </svg>
                                    )}
                                  </button>
                                </td>
                              )}
                            </tr>
                            {/* Linha de expansão para mostrar datas das ocorrências */}
                            {expandedRows.has(item.descricao) && item.datas_ocorrencias && item.datas_ocorrencias.length > 0 && (
                              <tr className="bg-blue-50">
                                <td colSpan={rupturaColumns.length + 2} className="px-6 py-3">
                                  <div className="text-sm">
                                    <p className="font-semibold text-gray-700 mb-2">Datas das Ocorrências ({item.datas_ocorrencias.length}):</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {item.datas_ocorrencias.map((oc, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-white p-2 rounded border">
                                          <span className="font-medium text-gray-800">{oc.data}</span>
                                          <span className={`text-xs px-2 py-0.5 rounded ${
                                            oc.status === 'Não Encontrado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                          }`}>
                                            {oc.status}
                                          </span>
                                          {oc.verificado_por && oc.verificado_por !== 'N/A' && (
                                            <span className="text-xs text-gray-500">por {oc.verificado_por}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>

                    {/* Controles de Paginação */}
                    {totalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t">
                        {/* Info e seletor de itens por página */}
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">
                            Mostrando {startIndex + 1} a {Math.min(endIndex, totalItems)} de {totalItems} produtos
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Itens por página:</label>
                            <select
                              value={itemsPerPage}
                              onChange={(e) => {
                                setItemsPerPage(parseInt(e.target.value));
                                setCurrentPage(1);
                              }}
                              className="px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                            >
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                              <option value={200}>200</option>
                              <option value={500}>500</option>
                              <option value={totalItems}>Todos ({totalItems})</option>
                            </select>
                          </div>
                        </div>

                        {/* Botões de navegação */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={goToFirstPage}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded border bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            title="Primeira página"
                          >
                            ⟪
                          </button>
                          <button
                            onClick={goToPrevPage}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded border bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            title="Página anterior"
                          >
                            ←
                          </button>

                          {/* Números das páginas */}
                          <div className="flex items-center gap-1">
                            {(() => {
                              const pages = [];
                              const maxVisible = 5;
                              let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                              let end = Math.min(totalPages, start + maxVisible - 1);
                              if (end - start < maxVisible - 1) {
                                start = Math.max(1, end - maxVisible + 1);
                              }

                              if (start > 1) {
                                pages.push(
                                  <button key={1} onClick={() => goToPage(1)} className="px-3 py-1 rounded border bg-white hover:bg-gray-100 text-sm">1</button>
                                );
                                if (start > 2) {
                                  pages.push(<span key="dots1" className="px-1 text-gray-400">...</span>);
                                }
                              }

                              for (let i = start; i <= end; i++) {
                                pages.push(
                                  <button
                                    key={i}
                                    onClick={() => goToPage(i)}
                                    className={`px-3 py-1 rounded border text-sm ${
                                      currentPage === i
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white hover:bg-gray-100'
                                    }`}
                                  >
                                    {i}
                                  </button>
                                );
                              }

                              if (end < totalPages) {
                                if (end < totalPages - 1) {
                                  pages.push(<span key="dots2" className="px-1 text-gray-400">...</span>);
                                }
                                pages.push(
                                  <button key={totalPages} onClick={() => goToPage(totalPages)} className="px-3 py-1 rounded border bg-white hover:bg-gray-100 text-sm">{totalPages}</button>
                                );
                              }

                              return pages;
                            })()}
                          </div>

                          <button
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded border bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            title="Próxima página"
                          >
                            →
                          </button>
                          <button
                            onClick={goToLastPage}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded border bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            title="Última página"
                          >
                            ⟫
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}

          </>
        )}

        {!resultados && !loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-xl text-gray-600">
              Selecione um período e clique em "Aplicar Filtros" para ver os resultados
            </p>
          </div>
        )}
      </div>

      {/* Modal de Histórico de Compras */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between bg-blue-50">
              <h3 className="text-lg font-bold text-gray-800">
                Histórico de Compras
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="p-4">
              {historyProduct && (
                <p className="text-sm text-gray-600 mb-4">
                  Produto: <strong>{historyProduct.descricao}</strong>
                </p>
              )}
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : historyData.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhum histórico de compras encontrado para este produto.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[50vh]">
                  {/* Calcular menor custo para destacar */}
                  {(() => {
                    const custos = historyData.map(item => Number(item.custoReposicao || 0)).filter(c => c > 0);
                    const menorCusto = custos.length > 0 ? Math.min(...custos) : 0;
                    return (
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Dias</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Custo Rep.</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">NF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {historyData.map((item, idx) => {
                            const custo = Number(item.custoReposicao || 0);
                            const isMenor = custo > 0 && custo === menorCusto;
                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-600">{item.data}</td>
                                <td className="px-3 py-2 text-center text-gray-500">
                                  {item.diasDesdeCompra || 0}
                                </td>
                                <td className="px-3 py-2 text-gray-800 max-w-xs truncate" title={item.fornecedor}>
                                  {item.fornecedor || 'N/A'}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-700">
                                  {Number(item.quantidade || 0).toFixed(0)}
                                </td>
                                <td className={`px-3 py-2 text-right font-medium ${isMenor ? 'text-green-600' : 'text-red-600'}`}>
                                  R$ {custo.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-gray-800">
                                  R$ {Number(item.valorTotal || 0).toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-center text-gray-600">
                                  {item.numeroNF || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
