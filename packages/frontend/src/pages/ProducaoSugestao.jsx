import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function ProducaoSugestao() {
  const navigate = useNavigate();

  // Estados principais
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSecao, setSelectedSecao] = useState('PADARIA');
  const [selectedTipo, setSelectedTipo] = useState('PRODUCAO');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, checked

  // Estados do modal
  const [editingItem, setEditingItem] = useState(null);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingAudit, setSavingAudit] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  // Estado do formulário do item
  const [itemForm, setItemForm] = useState({
    quantity_units: '',
    production_days: '1'
  });

  // Data fixada no dia atual
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  console.log('📅 Data de hoje (todayStr):', todayStr);

  // Estado da auditoria do dia
  const [todayAudit, setTodayAudit] = useState(null);
  const [auditItems, setAuditItems] = useState({}); // { product_code: { quantity_units, production_days, checked } }

  // Estado de ordenação
  const [sortConfig, setSortConfig] = useState({ key: 'descricao', direction: 'asc' });

  // Estado para ordem das colunas (drag-and-drop)
  const [columnOrder, setColumnOrder] = useState([
    { key: 'foto', label: 'Foto', sortable: false, align: 'center' },
    { key: 'codigo', label: 'Código', sortable: true, align: 'left' },
    { key: 'descricao', label: 'Produto', sortable: true, align: 'left' },
    { key: 'dtaUltMovVenda', label: 'Última Venda', sortable: true, align: 'center' },
    { key: 'diasSemVenda', label: 'Dias Sem Venda', sortable: true, align: 'center' },
    { key: 'peso_medio_kg', label: 'Peso Médio', sortable: true, align: 'right' },
    { key: 'vendaMedia', label: 'Venda Média (kg)', sortable: true, align: 'right' },
    { key: 'vendaMediaUnd', label: 'Venda Média (und)', sortable: true, align: 'right' },
    { key: 'custo', label: 'Custo', sortable: true, align: 'right' },
    { key: 'precoVenda', label: 'Preço Venda', sortable: true, align: 'right' },
    { key: 'margemRef', label: 'Margem Referência', sortable: true, align: 'right' },
    { key: 'margemReal', label: 'Margem Real', sortable: true, align: 'right' },
    { key: 'curva', label: 'Curva', sortable: true, align: 'center' },
    { key: 'acoes', label: 'Ações', sortable: false, align: 'center' },
  ]);
  const [draggedColumn, setDraggedColumn] = useState(null);

  // Carregar dados ao iniciar
  useEffect(() => {
    setError('');
    setSuccess('');
    loadSections();
    loadTodayAudit();
  }, []);

  // Carregar seções do ERP (todas, não apenas ativos)
  const loadSections = async () => {
    try {
      const response = await api.get('/production/erp-sections');
      setSections(response.data);
      // Se PADARIA existe nas seções, manter; caso contrário, selecionar a primeira
      if (response.data.length > 0 && !response.data.includes('PADARIA')) {
        setSelectedSecao(response.data[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar seções:', err);
    }
  };

  // Carregar produtos quando mudar seção ou tipo
  const loadProductsBySection = async (secao, tipo) => {
    try {
      setLoading(true);
      const response = await api.get(`/production/erp-products-by-section?section=${encodeURIComponent(secao)}`);
      const allProds = response.data;
      setAllProducts(allProds);
      // Filtrar por tipo de evento
      const filtered = allProds.filter(p => p.tipoEvento === tipo);
      setProducts(filtered);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      const errorMessage = err.response?.status === 500
        ? 'Servidor ERP indisponível. Aguarde alguns minutos e tente novamente.'
        : 'Erro ao carregar produtos: ' + (err.response?.data?.error || err.message);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Carregar produtos quando mudar seção ou tipo
  useEffect(() => {
    if (selectedSecao) {
      loadProductsBySection(selectedSecao, selectedTipo);
    }
  }, [selectedSecao, selectedTipo]);

  const loadTodayAudit = async () => {
    try {
      const response = await api.get('/production/audits');
      const allAudits = response.data;

      // Usar a mesma data que usamos para salvar (todayStr)
      const currentDateStr = todayStr;
      console.log('🔍 Buscando auditoria para data:', currentDateStr);
      console.log('🔍 Total de auditorias:', allAudits.length);

      const audit = allAudits.find(a => {
        // Pegar apenas a parte da data (YYYY-MM-DD) sem timezone
        const auditDateStr = String(a.audit_date).split('T')[0];
        console.log('🔍 Comparando:', auditDateStr, 'com', currentDateStr);
        return auditDateStr === currentDateStr;
      });

      console.log('🔍 Auditoria encontrada:', audit ? `ID ${audit.id} com ${audit.items?.length} itens` : 'Nenhuma');

      if (audit) {
        setTodayAudit(audit);
        // Carregar itens já conferidos com todos os dados salvos
        const items = {};
        audit.items.forEach(item => {
          items[item.product_code] = {
            quantity_units: item.quantity_units,
            production_days: item.production_days,
            unit_weight_kg: item.unit_weight_kg,
            avg_sales_kg: item.avg_sales_kg,
            suggested_production_kg: item.suggested_production_kg,
            suggested_production_units: item.suggested_production_units,
            last_sale_date: item.last_sale_date,
            days_without_sale: item.days_without_sale,
            checked: true
          };
        });
        setAuditItems(items);
        console.log('✅ Carregados', Object.keys(items).length, 'itens já conferidos');
      }
    } catch (err) {
      console.error('Erro ao carregar auditoria do dia:', err);
    }
  };

  // Limpar cache e recarregar produtos
  const handleClearCache = async () => {
    if (clearingCache) return;

    setClearingCache(true);
    try {
      await api.post('/production/clear-cache');
      setSuccess('Cache limpo! Recarregando produtos...');
      setTimeout(() => setSuccess(''), 2000);
      // Recarregar produtos
      await loadProductsBySection(selectedSecao, selectedTipo);
    } catch (err) {
      console.error('Erro ao limpar cache:', err);
      setError('Erro ao limpar cache');
      setTimeout(() => setError(''), 3000);
    } finally {
      setClearingCache(false);
    }
  };

  // Abrir modal para editar item
  const handleEditItem = (product) => {
    setEditingItem(product);
    const existingData = auditItems[product.codigo];
    setItemForm({
      quantity_units: existingData?.quantity_units?.toString() || '',
      production_days: existingData?.production_days?.toString() || product.production_days?.toString() || '1'
    });
  };

  // Calcular sugestão para o item atual
  const calculateSuggestion = () => {
    if (!editingItem) return { sugestaoKg: 0, sugestaoUnidades: 0 };

    const estoqueUnidades = parseInt(itemForm.quantity_units) || 0;
    const diasProducao = parseInt(itemForm.production_days) || 1;
    const pesoMedio = editingItem.peso_medio_kg || 0;
    const estoqueKg = estoqueUnidades * pesoMedio;
    const vendaMediaKg = editingItem.vendaMedia || 0;
    const necessidadeKg = vendaMediaKg * diasProducao;
    const sugestaoKg = Math.max(0, necessidadeKg - estoqueKg);
    const sugestaoUnidades = pesoMedio > 0 ? Math.ceil(sugestaoKg / pesoMedio) : 0;

    return { sugestaoKg, sugestaoUnidades, estoqueKg, necessidadeKg };
  };

  // Salvar item individual
  const handleSaveItem = async () => {
    if (!editingItem) return;

    setSaving(true);
    setError('');

    try {
      const { sugestaoKg, sugestaoUnidades } = calculateSuggestion();

      const itemData = {
        product_code: editingItem.codigo,
        product_name: editingItem.descricao,
        quantity_units: parseInt(itemForm.quantity_units) || 0,
        production_days: parseInt(itemForm.production_days) || 1,
        unit_weight_kg: editingItem.peso_medio_kg || 0,
        avg_sales_kg: editingItem.vendaMedia || 0,
        avg_sales_units: editingItem.vendaMediaUnd || 0,
        suggested_production_kg: sugestaoKg,
        suggested_production_units: sugestaoUnidades,
        last_sale_date: editingItem.dtaUltMovVenda || null,
        days_without_sale: calcularDiasSemVenda(editingItem.dtaUltMovVenda),
        curva: editingItem.curva || null
      };

      // Salvar no backend (criar ou atualizar auditoria)
      const response = await api.post('/production/audits/save-item', {
        audit_date: todayStr,
        item: itemData
      });

      // Atualizar estado local
      setAuditItems(prev => ({
        ...prev,
        [editingItem.codigo]: {
          quantity_units: itemData.quantity_units,
          production_days: itemData.production_days,
          checked: true
        }
      }));

      if (response.data.audit) {
        setTodayAudit(response.data.audit);
      }

      setSuccess('Item salvo com sucesso!');
      setTimeout(() => setSuccess(''), 2000);

      // Fechar modal
      setEditingItem(null);
      setShowEmptyModal(false);
      setItemForm({ quantity_units: '', production_days: '1' });
    } catch (err) {
      console.error('Erro ao salvar item:', err);
      setError(err.response?.data?.error || 'Erro ao salvar item');
    } finally {
      setSaving(false);
    }
  };

  // Salvar e ir para próximo
  const handleSaveAndNext = async () => {
    if (!editingItem) return;

    setSaving(true);
    setError('');

    try {
      const { sugestaoKg, sugestaoUnidades } = calculateSuggestion();

      const itemData = {
        product_code: editingItem.codigo,
        product_name: editingItem.descricao,
        quantity_units: parseInt(itemForm.quantity_units) || 0,
        production_days: parseInt(itemForm.production_days) || 1,
        unit_weight_kg: editingItem.peso_medio_kg || 0,
        avg_sales_kg: editingItem.vendaMedia || 0,
        avg_sales_units: editingItem.vendaMediaUnd || 0,
        suggested_production_kg: sugestaoKg,
        suggested_production_units: sugestaoUnidades,
        last_sale_date: editingItem.dtaUltMovVenda || null,
        days_without_sale: calcularDiasSemVenda(editingItem.dtaUltMovVenda),
        curva: editingItem.curva || null
      };

      const response = await api.post('/production/audits/save-item', {
        audit_date: todayStr,
        item: itemData
      });

      // Atualizar estado local
      setAuditItems(prev => ({
        ...prev,
        [editingItem.codigo]: {
          quantity_units: itemData.quantity_units,
          production_days: itemData.production_days,
          checked: true
        }
      }));

      if (response.data.audit) {
        setTodayAudit(response.data.audit);
      }

      // Encontrar próximo item pendente
      const pendingProducts = filteredProducts.filter(p => !auditItems[p.codigo]?.checked && p.codigo !== editingItem.codigo);

      if (pendingProducts.length > 0) {
        const nextProduct = pendingProducts[0];
        setEditingItem(nextProduct);
        const existingData = auditItems[nextProduct.codigo];
        setItemForm({
          quantity_units: existingData?.quantity_units?.toString() || '',
          production_days: existingData?.production_days?.toString() || nextProduct.production_days?.toString() || '1'
        });
      } else {
        setEditingItem(null);
        setShowEmptyModal(false);
        setSuccess('Todos os itens foram conferidos!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Erro ao salvar item:', err);
      setError(err.response?.data?.error || 'Erro ao salvar item');
    } finally {
      setSaving(false);
    }
  };

  // Desmarcar item (remover da auditoria)
  const handleUncheckItem = async (product) => {
    if (!todayAudit) return;

    try {
      await api.delete(`/production/audits/${todayAudit.id}/items/${product.codigo}`);

      // Atualizar auditItems
      setAuditItems(prev => {
        const newItems = { ...prev };
        delete newItems[product.codigo];
        return newItems;
      });

      // Atualizar todayAudit removendo o item
      setTodayAudit(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.filter(item => item.product_code !== product.codigo)
        };
      });

      setSuccess('Item removido da auditoria');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Erro ao remover item:', err);
      setError('Erro ao remover item');
    }
  };

  // Salvar e finalizar auditoria
  const handleSendWhatsApp = async () => {
    if (!todayAudit) {
      setError('Nenhuma auditoria para salvar');
      return;
    }

    setSavingAudit(true);
    setError('');

    try {
      // 1. Finalizar a auditoria (mudar status para completed)
      await api.put(`/production/audits/${todayAudit.id}/complete`);

      // 2. Enviar para WhatsApp
      await api.post(`/production/audits/${todayAudit.id}/send-whatsapp`);

      setSuccess('Auditoria finalizada e enviada para WhatsApp com sucesso!');
      // Voltar para a tela do calendário após 1.5 segundos
      setTimeout(() => {
        navigate('/producao-lancador');
      }, 1500);
    } catch (err) {
      console.error('Erro ao salvar auditoria:', err);
      setError('Erro ao salvar auditoria');
    } finally {
      setSavingAudit(false);
    }
  };

  // Função para alternar ordenação
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Função para calcular dias sem venda (formato YYYYMMDD)
  const calcularDiasSemVenda = (dtaUltMovVenda) => {
    if (!dtaUltMovVenda) return null;
    // Formato: YYYYMMDD (ex: "20250118")
    const ano = parseInt(dtaUltMovVenda.slice(0, 4));
    const mes = parseInt(dtaUltMovVenda.slice(4, 6)) - 1; // Mês é 0-indexed
    const dia = parseInt(dtaUltMovVenda.slice(6, 8));
    const dataUltVenda = new Date(ano, mes, dia);
    const hoje = new Date();
    const diffTime = hoje.getTime() - dataUltVenda.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Função para formatar data (formato YYYYMMDD para DD/MM/YYYY)
  const formatarData = (data) => {
    if (!data) return '-';
    // Formato: YYYYMMDD (ex: "20250118")
    const ano = data.slice(0, 4);
    const mes = data.slice(4, 6);
    const dia = data.slice(6, 8);
    return `${dia}/${mes}/${ano}`;
  };

  // Função para obter valor de ordenação
  const getSortValue = (product, key) => {
    switch (key) {
      case 'codigo':
        return product.codigo || '';
      case 'descricao':
        return product.descricao || '';
      case 'dtaUltMovVenda':
        return product.dtaUltMovVenda || '';
      case 'diasSemVenda':
        return calcularDiasSemVenda(product.dtaUltMovVenda) ?? 9999;
      case 'peso_medio_kg':
        return product.peso_medio_kg || 0;
      case 'vendaMedia':
        return product.vendaMedia || 0;
      case 'vendaMediaUnd':
        return product.vendaMediaUnd || 0;
      case 'custo':
        return product.custo || 0;
      case 'precoVenda':
        return product.precoVenda || 0;
      case 'margemRef':
        return product.margemRef || 0;
      case 'margemReal':
        return product.margemReal || 0;
      case 'curva':
        return product.curva || 'Z';
      default:
        return '';
    }
  };

  // Handlers de drag-and-drop para colunas
  const handleDragStart = (e, index) => {
    setDraggedColumn(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedColumn(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedColumn === null || draggedColumn === dropIndex) return;

    const newOrder = [...columnOrder];
    const draggedItem = newOrder[draggedColumn];
    newOrder.splice(draggedColumn, 1);
    newOrder.splice(dropIndex, 0, draggedItem);
    setColumnOrder(newOrder);
    setDraggedColumn(null);
  };

  // Função para obter classe CSS da célula (cores de fundo)
  const getCellClass = (product, columnKey) => {
    switch (columnKey) {
      case 'diasSemVenda':
        const dias = calcularDiasSemVenda(product.dtaUltMovVenda);
        if (dias === null) return 'text-gray-400';
        if (dias <= 1) return 'text-green-600 bg-green-50 font-semibold';
        if (dias <= 3) return 'text-yellow-600 bg-yellow-50 font-semibold';
        return 'text-red-600 bg-red-50 font-semibold';
      case 'margemReal':
        if (product.margemReal && product.margemRef) {
          return product.margemReal >= product.margemRef
            ? 'text-green-600 bg-green-50 font-semibold'
            : 'text-red-600 bg-red-50 font-semibold';
        }
        return 'text-gray-700';
      case 'curva':
        if (product.curva === 'A') return 'text-green-600 bg-green-50 font-bold';
        if (product.curva === 'B') return 'text-blue-600 bg-blue-50 font-bold';
        if (product.curva === 'C') return 'text-yellow-600 bg-yellow-50 font-bold';
        return 'text-gray-400';
      default:
        return '';
    }
  };

  // Função para renderizar o valor de uma célula
  const renderCellValue = (product, columnKey) => {
    switch (columnKey) {
      case 'foto':
        return product.foto_referencia ? (
          <img
            src={product.foto_referencia}
            alt={product.descricao}
            className="w-10 h-10 object-cover rounded-lg border border-gray-200 mx-auto"
          />
        ) : (
          <div className="w-10 h-10 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case 'codigo':
        return product.codigo;
      case 'descricao':
        return <span className="font-medium text-gray-900">{product.descricao}</span>;
      case 'dtaUltMovVenda':
        return formatarData(product.dtaUltMovVenda);
      case 'diasSemVenda':
        return calcularDiasSemVenda(product.dtaUltMovVenda) ?? '-';
      case 'peso_medio_kg':
        return product.peso_medio_kg ? `${product.peso_medio_kg.toFixed(3)} kg` : '-';
      case 'vendaMedia':
        return product.vendaMedia ? `${product.vendaMedia.toFixed(3)} kg/dia` : '-';
      case 'vendaMediaUnd':
        return product.vendaMediaUnd ? `${product.vendaMediaUnd.toFixed(1)} und/dia` : '-';
      case 'custo':
        return product.custo ? `R$ ${product.custo.toFixed(2)}` : '-';
      case 'precoVenda':
        return product.precoVenda ? `R$ ${product.precoVenda.toFixed(2)}` : '-';
      case 'margemRef':
        return product.margemRef ? `${product.margemRef.toFixed(1)}%` : '-';
      case 'margemReal':
        return product.margemReal ? `${product.margemReal.toFixed(1)}%` : '-';
      case 'curva':
        return product.curva || '-';
      case 'acoes':
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleEditItem(product); }}
            className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
          >
            Conferir
          </button>
        );
      default:
        return '-';
    }
  };

  // Filtrar produtos
  const filteredProducts = products
    .filter(product => {
      // Filtro por status
      if (filter === 'pending' && auditItems[product.codigo]?.checked) return false;
      if (filter === 'checked' && !auditItems[product.codigo]?.checked) return false;

      // Filtro por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          product.descricao?.toLowerCase().includes(term) ||
          product.codigo?.toLowerCase().includes(term)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      // Ordenação para strings
      if (typeof aValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      // Ordenação para números
      const comparison = aValue - bValue;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

  // Estatísticas - usar dados do banco quando disponível
  const checkedCount = todayAudit?.items?.length || Object.values(auditItems).filter(item => item.checked).length;
  const stats = {
    total: products.length,
    checked: checkedCount,
    pending: products.filter(p => !auditItems[p.codigo]?.checked).length
  };

  const { sugestaoKg, sugestaoUnidades, estoqueKg, necessidadeKg } = calculateSuggestion();

  // Componente de header clicável para ordenação
  const SortableHeader = ({ sortKey, children, align = 'left' }) => (
    <th
      onClick={() => handleSort(sortKey)}
      className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors select-none ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {children}
        {sortConfig.key === sortKey && (
          <span className="text-orange-600">
            {sortConfig.direction === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <Layout>
      <div className="p-4 lg:p-8">
        {/* Header com Gradiente */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                🥖 Auditoria de Produção - {todayStr.split('-').reverse().join('/')}
              </h1>
              <p className="text-white/90">
                Registre o estoque e receba sugestões de produção
              </p>
            </div>
            <div className="flex gap-4 mt-4 lg:mt-0 items-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold">{stats.checked}/{stats.total}</p>
                <p className="text-xs">Conferidos</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs">Pendentes</p>
              </div>
              <button
                onClick={handleClearCache}
                disabled={clearingCache || loading}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-2 transition-colors disabled:opacity-50"
                title="Limpar cache e recarregar produtos"
              >
                {clearingCache ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            </div>
          </div>
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

        {/* Barra de filtros */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => navigate('/producao-lancador')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-500 text-white hover:bg-gray-600"
              >
                ← Voltar ao Calendário
              </button>
              <button
                onClick={() => {
                  // Abre direto no primeiro produto pendente
                  const pendingProducts = filteredProducts.filter(p => !auditItems[p.codigo]?.checked);
                  if (pendingProducts.length > 0) {
                    handleEditItem(pendingProducts[0]);
                  } else {
                    setError('Todos os produtos já foram conferidos!');
                    setTimeout(() => setError(''), 3000);
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700"
              >
                🚀 Iniciar Auditoria
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos ({stats.total})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pendentes ({stats.pending})
              </button>
              <button
                onClick={() => setFilter('checked')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'checked' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Conferidos ({stats.checked})
              </button>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={selectedSecao}
                onChange={(e) => setSelectedSecao(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
              >
                {sections.map(secao => (
                  <option key={secao} value={secao}>{secao}</option>
                ))}
              </select>
              <select
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
              >
                <option value="PRODUCAO">PRODUCAO</option>
                <option value="DIRETA">DIRETA</option>
                <option value="COMPOSICAO">COMPOSICAO</option>
                <option value="DECOMPOSICAO">DECOMPOSICAO</option>
              </select>
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
              />
              {(todayAudit?.items?.length > 0 || stats.checked > 0) && (
                <button
                  onClick={handleSendWhatsApp}
                  disabled={savingAudit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAudit ? '⏳ Salvando...' : '💾 Salvar Auditoria'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal de edição */}
        {(editingItem || showEmptyModal) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
              {/* Header do modal */}
              <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 rounded-t-lg sticky top-0 z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold">{editingItem ? editingItem.descricao : 'Selecione um produto'}</h3>
                    <p className="text-sm text-white/80">Código: {editingItem?.codigo || '-'}</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setShowEmptyModal(false);
                      setProductSearchTerm('');
                    }}
                    className="text-white/80 hover:text-white text-2xl leading-none"
                  >
                    &times;
                  </button>
                </div>
                {/* Info do produto */}
                {editingItem && (
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-white/20 rounded px-2 py-1">
                      <p className="text-[10px] text-white/70">Peso Médio</p>
                      <p className="text-xs font-bold">
                        {editingItem.peso_medio_kg ? `${editingItem.peso_medio_kg.toFixed(3)} kg` : '-'}
                      </p>
                    </div>
                    <div className="bg-white/20 rounded px-2 py-1">
                      <p className="text-[10px] text-white/70">Venda Média</p>
                      <p className="text-xs font-bold">
                        {editingItem.vendaMedia ? `${editingItem.vendaMedia.toFixed(3)} kg/dia` : '-'}
                      </p>
                    </div>
                    <div className="bg-white/20 rounded px-2 py-1">
                      <p className="text-[10px] text-white/70">Dias Padrão</p>
                      <p className="text-xs font-bold">
                        {editingItem.production_days || 1}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* Busca de Produto */}
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🔍 Buscar Produto (nome ou código):
                  </label>
                  <input
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    placeholder="Digite o nome ou código..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm mb-2"
                  />
                  {productSearchTerm && (
                    <div className="max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-lg">
                      {filteredProducts
                        .filter(p =>
                          p.descricao.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                          (p.codigo && p.codigo.includes(productSearchTerm))
                        )
                        .slice(0, 10)
                        .map(product => (
                          <button
                            key={product.codigo}
                            onClick={() => {
                              handleEditItem(product);
                              setShowEmptyModal(false);
                              setProductSearchTerm('');
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-orange-100 border-b border-gray-100 last:border-b-0 text-sm ${
                              auditItems[product.codigo]?.checked ? 'bg-green-50' : ''
                            }`}
                          >
                            <span className={auditItems[product.codigo]?.checked ? 'text-green-700' : 'text-gray-800'}>
                              {auditItems[product.codigo]?.checked ? '✅ ' : '⏳ '}{product.codigo} - {product.descricao}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Seletor de Produto (dropdown) */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selecionar Produto:
                  </label>
                  <select
                    value={editingItem?.codigo || ''}
                    onChange={(e) => {
                      const selectedProduct = products.find(p => p.codigo === e.target.value);
                      if (selectedProduct) {
                        handleEditItem(selectedProduct);
                        setShowEmptyModal(false);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                  >
                    <option value="">-- Selecione um produto --</option>
                    <optgroup label="⏳ Pendentes">
                      {products.filter(p => !auditItems[p.codigo]?.checked).map(product => (
                        <option key={product.codigo} value={product.codigo}>
                          {product.codigo} - {product.descricao}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="✅ Conferidos">
                      {products.filter(p => auditItems[p.codigo]?.checked).map(product => (
                        <option key={product.codigo} value={product.codigo}>
                          {product.codigo} - {product.descricao}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {editingItem && (
                  <>
                    {/* Imagem do Produto */}
                    {editingItem.foto_referencia && (
                      <div className="flex justify-center">
                        <img
                          src={editingItem.foto_referencia}
                          alt={editingItem.descricao}
                          className="w-40 h-40 object-cover rounded-lg border-2 border-orange-200 shadow-md"
                        />
                      </div>
                    )}

                    {/* Estoque em Unidades */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Estoque Atual (unidades):
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={itemForm.quantity_units}
                        onChange={(e) => setItemForm({ ...itemForm, quantity_units: e.target.value })}
                        placeholder="Ex: 10"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-lg"
                        autoFocus
                      />
                    </div>

                    {/* Dias de Produção */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dias de Produção:
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={itemForm.production_days}
                        onChange={(e) => setItemForm({ ...itemForm, production_days: e.target.value })}
                        placeholder="1"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-lg"
                      />
                    </div>

                    {/* Cálculos em tempo real */}
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-900 mb-3 text-sm">CÁLCULOS:</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Estoque em KG:</span>
                          <span className="font-bold text-gray-800">{estoqueKg?.toFixed(3) || '0.000'} kg</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Necessidade ({itemForm.production_days || 1} dias):</span>
                          <span className="font-bold text-gray-800">{necessidadeKg?.toFixed(3) || '0.000'} kg</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-orange-200 pt-2">
                          <span className="text-sm text-gray-600 font-semibold">Sugestão:</span>
                          <div className="text-right">
                            <span className="font-bold text-green-700 text-lg">{sugestaoKg?.toFixed(3) || '0.000'} kg</span>
                            <span className="text-blue-700 font-bold ml-2">({sugestaoUnidades} und)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botões */}
                    <div className="flex flex-col gap-3 pt-4 border-t">
                      <button
                        onClick={handleSaveAndNext}
                        disabled={saving}
                        className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
                      >
                        {saving ? 'Salvando...' : '✅ Salvar e Próximo'}
                      </button>
                      <button
                        onClick={handleSaveItem}
                        disabled={saving}
                        className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
                      >
                        {saving ? 'Salvando...' : '💾 Salvar Item'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingItem(null);
                          setShowEmptyModal(false);
                        }}
                        className="w-full px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lista de Itens Pendentes */}
        {filter !== 'checked' && stats.pending > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-yellow-800">
                ⏳ Itens Pendentes ({stats.pending})
              </h2>
              <span className="text-xs text-yellow-600">💡 Arraste os cabeçalhos para reordenar colunas</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {columnOrder.map((column, index) => (
                      <th
                        key={column.key}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onClick={() => column.sortable && handleSort(column.key)}
                        className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-grab select-none whitespace-nowrap
                          ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}
                          ${column.sortable ? 'hover:bg-gray-100' : ''}
                          ${draggedColumn === index ? 'bg-orange-100 border-2 border-dashed border-orange-400' : ''}
                        `}
                        title={column.sortable ? 'Clique para ordenar | Arraste para mover' : 'Arraste para mover'}
                      >
                        <span className="inline-flex items-center gap-1">
                          <span className="text-gray-300">⠿</span>
                          {column.label}
                          {column.sortable && sortConfig.key === column.key && (
                            <span className="text-orange-500 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts
                    .filter(p => !auditItems[p.codigo]?.checked)
                    .map((product) => (
                      <tr key={product.codigo} className="hover:bg-yellow-50 cursor-pointer" onClick={() => handleEditItem(product)}>
                        {columnOrder.map((column) => (
                          <td
                            key={column.key}
                            className={`px-4 py-3 text-sm ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'} ${getCellClass(product, column.key)}`}
                          >
                            {renderCellValue(product, column.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lista de Itens Conferidos - Usa dados salvos no banco */}
        {todayAudit && todayAudit.items && todayAudit.items.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-green-50 px-4 py-3 border-b border-green-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-green-800">
                ✅ Itens Conferidos ({todayAudit.items.length})
              </h2>
              {todayAudit.items.length > 0 && (
                <button
                  onClick={handleSendWhatsApp}
                  disabled={savingAudit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAudit ? '⏳ Salvando...' : '💾 Salvar Auditoria'}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Últ. Venda</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Dias S/Venda</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Peso Médio</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Venda Média</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estoque</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Dias Prod.</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-green-50">Sugestão (kg)</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-blue-50">Sugestão (und)</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {todayAudit.items
                    .sort((a, b) => a.product_name.localeCompare(b.product_name))
                    .map((item) => {
                      // Buscar produto na lista de produtos ERP para poder editar
                      const productFromERP = allProducts.find(p => p.codigo === item.product_code);
                      const diasSemVenda = item.days_without_sale ?? calcularDiasSemVenda(item.last_sale_date);

                      return (
                        <tr
                          key={item.product_code}
                          className="bg-green-50 hover:bg-green-100 cursor-pointer"
                          onClick={() => productFromERP && handleEditItem(productFromERP)}
                        >
                          <td className="px-3 py-3 text-sm text-gray-600">{item.product_code}</td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-gray-900 text-sm">{item.product_name}</p>
                          </td>
                          <td className="px-3 py-3 text-sm text-center text-gray-700">
                            {formatarData(item.last_sale_date)}
                          </td>
                          <td className={`px-3 py-3 text-sm text-center font-semibold ${
                            diasSemVenda === null ? 'text-gray-400' :
                            diasSemVenda <= 1 ? 'text-green-600' :
                            diasSemVenda <= 3 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {diasSemVenda ?? '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-gray-700">
                            {item.unit_weight_kg ? `${parseFloat(item.unit_weight_kg).toFixed(3)} kg` : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-gray-700">
                            {item.avg_sales_kg ? `${parseFloat(item.avg_sales_kg).toFixed(3)} kg/dia` : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-medium">{item.quantity_units} und</td>
                          <td className="px-3 py-3 text-sm text-center">{item.production_days || 1}</td>
                          <td className="px-3 py-3 text-sm text-center font-semibold text-green-700 bg-green-50">
                            {parseFloat(item.suggested_production_kg || 0).toFixed(3)}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-semibold text-blue-700 bg-blue-50">
                            {item.suggested_production_units || 0}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              {productFromERP && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEditItem(productFromERP); }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUncheckItem({ codigo: item.product_code }); }}
                                className="text-yellow-600 hover:text-yellow-800 text-sm"
                                title="Remover"
                              >
                                ↩️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mensagem quando não há itens */}
        {loading && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">Carregando produtos...</p>
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">Nenhum produto encontrado para esta seção/tipo</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
