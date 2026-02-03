import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [employees, setEmployees] = useState([]); // Lista de colaboradores
  const [selectedResponsible, setSelectedResponsible] = useState('TODOS'); // Filtro por responsável
  const [perdasMensais, setPerdasMensais] = useState({}); // Perdas por produto (mês anterior e atual)

  // Estados de Grupo e Subgrupo
  const [grupos, setGrupos] = useState([]);
  const [subgrupos, setSubgrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('TODOS');
  const [selectedSubgrupo, setSelectedSubgrupo] = useState('TODOS');

  // Estados do modal
  const [editingItem, setEditingItem] = useState(null);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingAudit, setSavingAudit] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  // Estados do modal de detalhes (receita/nutricional)
  const [detailsModal, setDetailsModal] = useState({ type: null, code: null, data: null, loading: false });

  // Estado do formulário do item
  const [itemForm, setItemForm] = useState({
    quantity_units: '',
    responsible_id: null
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

  // Ordem padrão das colunas
  const defaultColumnOrder = [
    { key: 'foto', label: 'Foto', sortable: false, align: 'center' },
    { key: 'codigo', label: 'Código', sortable: true, align: 'left' },
    { key: 'descricao', label: 'Produto', sortable: true, align: 'left' },
    { key: 'responsible_name', label: 'Responsável', sortable: true, align: 'center' },
    { key: 'dtaUltMovVenda', label: 'Última\nVenda', sortable: true, align: 'center' },
    { key: 'diasSemVenda', label: 'Dias\nS/Venda', sortable: true, align: 'center' },
    { key: 'peso_medio_kg', label: 'Peso\nMédio', sortable: true, align: 'right' },
    { key: 'vendaMedia', label: 'Venda\nMéd (kg)', sortable: true, align: 'right' },
    { key: 'vendaMediaUnd', label: 'Venda\nMéd (und)', sortable: true, align: 'right' },
    { key: 'custo', label: 'Custo', sortable: true, align: 'right' },
    { key: 'precoVenda', label: 'Preço\nVenda', sortable: true, align: 'right' },
    { key: 'margemRef', label: 'Margem\nRef', sortable: true, align: 'right' },
    { key: 'margemReal', label: 'Margem\nReal', sortable: true, align: 'right' },
    { key: 'perdasMesAnterior', label: 'Perdas\nMês Ant', sortable: true, align: 'right' },
    { key: 'qtdPerdasMesAnterior', label: 'Qtd Prd\nMês Ant', sortable: true, align: 'right' },
    { key: 'perdasMesAtual', label: 'Perdas\nMês Atual', sortable: true, align: 'right' },
    { key: 'qtdPerdasMesAtual', label: 'Qtd Prd\nMês Atual', sortable: true, align: 'right' },
    { key: 'curva', label: 'Curva', sortable: true, align: 'center' },
    { key: 'receita', label: 'Receita', sortable: true, align: 'center' },
    { key: 'nutricional', label: 'Nutricional', sortable: true, align: 'center' },
    { key: 'acoes', label: 'Ações', sortable: false, align: 'center' },
  ];

  // Estado para ordem das colunas (drag-and-drop) - carrega do localStorage se existir
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('producao-auditoria-column-order');
      if (saved) {
        const savedOrder = JSON.parse(saved);
        // Verificar se tem todas as colunas corretas (mesmo tamanho E mesmas chaves)
        const defaultKeys = defaultColumnOrder.map(c => c.key).sort();
        const savedKeys = savedOrder.map(c => c.key).sort();
        const keysMatch = defaultKeys.length === savedKeys.length &&
                          defaultKeys.every((key, idx) => key === savedKeys[idx]);
        if (keysMatch) {
          return savedOrder;
        } else {
          // Chaves mudaram, limpar o localStorage e usar o padrão
          localStorage.removeItem('producao-auditoria-column-order');
          console.log('Colunas mudaram, resetando para ordem padrão');
        }
      }
    } catch (e) {
      console.error('Erro ao carregar ordem das colunas:', e);
      localStorage.removeItem('producao-auditoria-column-order');
    }
    return defaultColumnOrder;
  });
  const [draggedColumn, setDraggedColumn] = useState(null);

  // Carregar dados ao iniciar
  useEffect(() => {
    setError('');
    setSuccess('');
    loadSections();
    loadTodayAudit();
    loadEmployees();
    loadPerdasMensais();
  }, []);

  // Carregar perdas mensais por produto
  const loadPerdasMensais = async () => {
    try {
      const response = await api.get('/losses/oracle/perdas-mensais');
      const perdas = response.data.perdasPorProduto || {};
      setPerdasMensais(perdas);
      console.log('📊 Perdas mensais carregadas:', Object.keys(perdas).length, 'produtos');
      console.log('📊 Amostra de chaves de perdas:', Object.keys(perdas).slice(0, 20));
      // Debug: mostrar algumas perdas com valores > 0
      const comValor = Object.entries(perdas).filter(([_, v]) => v.mesAnterior > 0 || v.mesAtual > 0).slice(0, 5);
      console.log('📊 Amostra de perdas com valor:', comValor);
    } catch (err) {
      console.error('Erro ao carregar perdas mensais:', err);
      // Não impede o carregamento principal
    }
  };

  // Carregar detalhes de receita ou nutricional
  const loadDetails = async (type, code) => {
    if (!code) return;
    setDetailsModal({ type, code, data: null, loading: true });
    try {
      const endpoint = type === 'receita'
        ? `/production/receita/${code}`
        : `/production/nutricional/${code}`;
      const response = await api.get(endpoint);
      setDetailsModal({ type, code, data: response.data, loading: false });
    } catch (err) {
      console.error(`Erro ao carregar ${type}:`, err);
      setDetailsModal({ type, code, data: null, loading: false });
    }
  };

  // Carregar lista de colaboradores
  const loadEmployees = async () => {
    try {
      // A API retorna { data: [...], pagination: {...} }
      const response = await api.get('/employees?limit=100');
      setEmployees(response.data?.data || []);
    } catch (err) {
      console.error('Erro ao carregar colaboradores:', err);
    }
  };

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

  // Carregar grupos do ERP (filtrados por seção)
  const loadGrupos = async (secao) => {
    try {
      const response = await api.get(`/production/erp-grupos?section=${encodeURIComponent(secao)}`);
      setGrupos(response.data);
      // Resetar seleção de grupo e subgrupo
      setSelectedGrupo('TODOS');
      setSelectedSubgrupo('TODOS');
      setSubgrupos([]);
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
      setGrupos([]);
    }
  };

  // Carregar subgrupos do ERP (filtrados por grupo)
  const loadSubgrupos = async (codGrupo) => {
    try {
      const response = await api.get(`/production/erp-subgrupos?codGrupo=${codGrupo}`);
      setSubgrupos(response.data);
      // Resetar seleção de subgrupo
      setSelectedSubgrupo('TODOS');
    } catch (err) {
      console.error('Erro ao carregar subgrupos:', err);
      setSubgrupos([]);
    }
  };

  // Carregar grupos quando mudar seção
  useEffect(() => {
    if (selectedSecao) {
      loadGrupos(selectedSecao);
    }
  }, [selectedSecao]);

  // Carregar subgrupos quando mudar grupo
  useEffect(() => {
    if (selectedGrupo && selectedGrupo !== 'TODOS' && selectedGrupo !== 'SEM_GRUPO') {
      loadSubgrupos(selectedGrupo);
    } else {
      setSubgrupos([]);
      setSelectedSubgrupo('TODOS');
    }
  }, [selectedGrupo]);

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
      // Debug: mostrar códigos dos produtos carregados
      console.log('📦 Produtos carregados:', filtered.length);
      console.log('📦 Amostra de produtos com grupo/subgrupo:', filtered.slice(0, 5).map(p => ({
        codigo: p.codigo,
        descricao: p.descricao?.substring(0, 20),
        codGrupo: p.codGrupo,
        codSubgrupo: p.codSubgrupo,
        desGrupo: p.desGrupo,
        desSubgrupo: p.desSubgrupo
      })));
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

  // Atualizar responsável do produto
  const handleUpdateResponsible = async (productCode, responsibleId) => {
    try {
      await api.patch(`/production/products/${productCode}/responsible`, {
        responsible_id: responsibleId || null
      });

      // Atualizar produto na lista local
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.codigo === productCode
            ? { ...p, responsible_id: responsibleId || null, responsible_name: employees.find(e => e.id === responsibleId)?.name || null }
            : p
        )
      );

      setAllProducts(prevProducts =>
        prevProducts.map(p =>
          p.codigo === productCode
            ? { ...p, responsible_id: responsibleId || null, responsible_name: employees.find(e => e.id === responsibleId)?.name || null }
            : p
        )
      );

      // Atualizar editingItem se for o mesmo produto
      if (editingItem && editingItem.codigo === productCode) {
        setEditingItem(prev => ({
          ...prev,
          responsible_id: responsibleId || null,
          responsible_name: employees.find(e => e.id === responsibleId)?.name || null
        }));
      }

      console.log(`✅ Responsável atualizado: ${productCode} -> ${responsibleId || 'nenhum'}`);
    } catch (err) {
      console.error('Erro ao atualizar responsável:', err);
      setError('Erro ao salvar responsável');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Exportar para PDF - Itens PENDENTES (tabela atual)
  const handleExportPDF = async () => {
    try {
      setLoading(true);

      // Produtos PENDENTES (não conferidos) - mesma lista exibida na tabela
      const productsToExport = filteredProducts.filter(p => !auditItems[p.codigo]?.checked);

      if (productsToExport.length === 0) {
        setError('Nenhum produto pendente para exportar.');
        setTimeout(() => setError(''), 3000);
        setLoading(false);
        return;
      }

      // Criar PDF em modo paisagem para caber todas colunas
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Cores
      const orangeColor = [234, 88, 12]; // #EA580C
      const whiteColor = [255, 255, 255];

      // Header com fundo laranja
      doc.setFillColor(...orangeColor);
      doc.rect(0, 0, 297, 25, 'F');

      // Título
      doc.setTextColor(...whiteColor);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Itens Pendentes - ${todayStr.split('-').reverse().join('/')}`, 14, 12);

      // Subtítulo
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Seção: ${selectedSecao} | Tipo: ${selectedTipo} | Total: ${productsToExport.length} itens pendentes`, 14, 20);

      // Colunas do PDF - TODAS as colunas da tabela (exceto foto e ações)
      // Larguras reduzidas para caber em A4 paisagem (~267mm útil)
      const pdfColumns = [
        { key: 'codigo', label: 'Cód', width: 11 },
        { key: 'descricao', label: 'Produto', width: 28 },
        { key: 'responsible_name', label: 'Resp', width: 12 },
        { key: 'curva', label: 'Cv', width: 7 },
        { key: 'dtaUltMovVenda', label: 'Últ Venda', width: 13 },
        { key: 'diasSemVenda', label: 'D S/V', width: 9 },
        { key: 'peso_medio_kg', label: 'Peso', width: 11 },
        { key: 'vendaMedia', label: 'V.Md kg', width: 12 },
        { key: 'vendaMediaUnd', label: 'V.Md ud', width: 11 },
        { key: 'custo', label: 'Custo', width: 11 },
        { key: 'precoVenda', label: 'Preço', width: 11 },
        { key: 'margemRef', label: 'MgRf', width: 9 },
        { key: 'margemReal', label: 'MgRl', width: 9 },
        { key: 'perdasMesAnterior', label: 'Prd Ant', width: 12 },
        { key: 'qtdPerdasMesAnterior', label: 'Qt Ant', width: 10 },
        { key: 'perdasMesAtual', label: 'Prd Atu', width: 12 },
        { key: 'qtdPerdasMesAtual', label: 'Qt Atu', width: 10 },
        { key: 'receita', label: 'Rec', width: 9 },
        { key: 'nutricional', label: 'Nut', width: 9 },
      ];

      // Função para formatar data YYYYMMDD para DD/MM/YYYY
      const formatDateYYYYMMDD = (dateStr) => {
        if (!dateStr || dateStr.length !== 8) return '-';
        return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
      };

      // Função para obter valor de uma coluna
      const getColumnValue = (product, key) => {
        const diasSemVenda = calcularDiasSemVenda(product.dtaUltMovVenda);

        switch (key) {
          case 'codigo': return product.codigo || '-';
          case 'descricao': return product.descricao || '-';
          case 'responsible_name': {
            if (!product.responsible_id) return '-';
            const emp = employees.find(e => e.id === product.responsible_id);
            return emp ? emp.name : '-';
          }
          case 'curva': return product.curva || '-';
          case 'dtaUltMovVenda': return formatDateYYYYMMDD(product.dtaUltMovVenda);
          case 'diasSemVenda': return diasSemVenda !== null ? diasSemVenda : '-';
          case 'peso_medio_kg': return product.peso_medio_kg ? `${product.peso_medio_kg.toFixed(3)} kg` : '-';
          case 'vendaMedia': return product.vendaMedia ? `${product.vendaMedia.toFixed(3)} kg/d` : '-';
          case 'vendaMediaUnd': {
            if (product.vendaMedia && product.peso_medio_kg > 0) {
              return `${(product.vendaMedia / product.peso_medio_kg).toFixed(1)} und/d`;
            }
            return '-';
          }
          case 'custo': return product.custo ? `R$ ${product.custo.toFixed(2)}` : '-';
          case 'precoVenda': return product.precoVenda ? `R$ ${product.precoVenda.toFixed(2)}` : '-';
          case 'margemRef': return product.margemRef ? `${product.margemRef.toFixed(1)}%` : '-';
          case 'margemReal': return product.margemReal ? `${product.margemReal.toFixed(1)}%` : '-';
          case 'perdasMesAnterior': {
            const perda = perdasMensais[product.codigo]?.mesAnterior || 0;
            return perda > 0 ? `R$ ${perda.toFixed(2)}` : '-';
          }
          case 'qtdPerdasMesAnterior': {
            const qtdKg = perdasMensais[product.codigo]?.qtdMesAnterior || 0;
            const pesoMedio = product.peso_medio_kg || 0;
            const qtdUnd = pesoMedio > 0 ? Math.round(qtdKg / pesoMedio) : 0;
            return qtdUnd > 0 ? `${qtdUnd} und` : '-';
          }
          case 'perdasMesAtual': {
            const perda = perdasMensais[product.codigo]?.mesAtual || 0;
            return perda > 0 ? `R$ ${perda.toFixed(2)}` : '-';
          }
          case 'qtdPerdasMesAtual': {
            const qtdKg = perdasMensais[product.codigo]?.qtdMesAtual || 0;
            const pesoMedio = product.peso_medio_kg || 0;
            const qtdUnd = pesoMedio > 0 ? Math.round(qtdKg / pesoMedio) : 0;
            return qtdUnd > 0 ? `${qtdUnd} und` : '-';
          }
          case 'receita': return product.codInfoReceita || '-';
          case 'nutricional': return product.codInfoNutricional || '-';
          default: return '-';
        }
      };

      // Preparar dados da tabela
      const tableData = productsToExport.map(product =>
        pdfColumns.map(col => getColumnValue(product, col.key))
      );

      // Headers
      const headers = pdfColumns.map(col => col.label);

      // Gerar columnStyles dinâmico
      const columnStyles = {};
      pdfColumns.forEach((col, idx) => {
        columnStyles[idx] = {
          cellWidth: col.width,
          halign: (col.key === 'codigo' || col.key === 'descricao' || col.key === 'responsible_name') ? 'left' : 'center'
        };
      });

      // Calcular totais para o rodapé
      const totalPerdasAnt = productsToExport.reduce((sum, p) => sum + (perdasMensais[p.codigo]?.mesAnterior || 0), 0);
      const totalPerdasAtual = productsToExport.reduce((sum, p) => sum + (perdasMensais[p.codigo]?.mesAtual || 0), 0);

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 30,
        theme: 'grid',
        styles: {
          fontSize: 6,
          cellPadding: 1.5,
          overflow: 'linebreak',
          halign: 'center'
        },
        headStyles: {
          fillColor: orangeColor,
          textColor: whiteColor,
          fontStyle: 'bold',
          fontSize: 6
        },
        columnStyles,
        didParseCell: function(data) {
          // Aplicar cores nas células baseado na key da coluna
          if (data.section === 'body') {
            const colIndex = data.column.index;
            const product = productsToExport[data.row.index];
            const colKey = pdfColumns[colIndex]?.key;

            // Coluna Curva
            if (colKey === 'curva') {
              if (product.curva === 'A') {
                data.cell.styles.fillColor = [220, 252, 231];
                data.cell.styles.textColor = [22, 163, 74];
              } else if (product.curva === 'B') {
                data.cell.styles.fillColor = [219, 234, 254];
                data.cell.styles.textColor = [37, 99, 235];
              } else if (product.curva === 'C') {
                data.cell.styles.fillColor = [254, 249, 195];
                data.cell.styles.textColor = [202, 138, 4];
              } else if (product.curva === 'D' || product.curva === 'E') {
                data.cell.styles.fillColor = [254, 226, 226];
                data.cell.styles.textColor = [220, 38, 38];
              }
              data.cell.styles.fontStyle = 'bold';
            }

            // Coluna Dias Sem Venda
            if (colKey === 'diasSemVenda') {
              const diasSemVenda = calcularDiasSemVenda(product.dtaUltMovVenda);
              if (diasSemVenda !== null) {
                if (diasSemVenda <= 1) {
                  data.cell.styles.fillColor = [220, 252, 231]; // verde
                  data.cell.styles.textColor = [22, 163, 74];
                } else if (diasSemVenda <= 3) {
                  data.cell.styles.fillColor = [254, 249, 195]; // amarelo
                  data.cell.styles.textColor = [202, 138, 4];
                } else {
                  data.cell.styles.fillColor = [254, 226, 226]; // vermelho
                  data.cell.styles.textColor = [220, 38, 38];
                }
                data.cell.styles.fontStyle = 'bold';
              }
            }

            // Coluna Margem Real - comparar com margem ref
            if (colKey === 'margemReal' && product.margemReal && product.margemRef) {
              if (product.margemReal >= product.margemRef) {
                data.cell.styles.fillColor = [220, 252, 231]; // verde
                data.cell.styles.textColor = [22, 163, 74];
              } else {
                data.cell.styles.fillColor = [254, 226, 226]; // vermelho
                data.cell.styles.textColor = [220, 38, 38];
              }
              data.cell.styles.fontStyle = 'bold';
            }

            // Colunas de Perdas - Azul para mês anterior
            if (colKey === 'perdasMesAnterior' || colKey === 'qtdPerdasMesAnterior') {
              data.cell.styles.textColor = [37, 99, 235]; // azul
            }

            // Colunas de Perdas - Roxo para mês atual
            if (colKey === 'perdasMesAtual' || colKey === 'qtdPerdasMesAtual') {
              data.cell.styles.textColor = [147, 51, 234]; // roxo
            }
          }
        },
        margin: { top: 30, left: 5, right: 5 },
        didDrawPage: function(data) {
          // Footer com número de página e totais
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(128, 128, 128);
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            data.settings.margin.left,
            doc.internal.pageSize.height - 10
          );

          // Totais de perdas
          doc.setTextColor(37, 99, 235);
          doc.text(
            `Total Perdas Ant: R$ ${totalPerdasAnt.toFixed(2)}`,
            100,
            doc.internal.pageSize.height - 10
          );
          doc.setTextColor(147, 51, 234);
          doc.text(
            `Total Perdas Atual: R$ ${totalPerdasAtual.toFixed(2)}`,
            160,
            doc.internal.pageSize.height - 10
          );

          doc.setTextColor(128, 128, 128);
          doc.text(
            `Gerado em ${new Date().toLocaleString('pt-BR')}`,
            doc.internal.pageSize.width - data.settings.margin.right - 50,
            doc.internal.pageSize.height - 10
          );
        }
      });

      // Salvar PDF
      doc.save(`itens-pendentes-${selectedSecao}-${todayStr}.pdf`);

      setSuccess('PDF exportado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      setError('Erro ao exportar PDF: ' + err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal para editar item
  const handleEditItem = (product) => {
    setEditingItem(product);
    const existingData = auditItems[product.codigo];
    setItemForm({
      quantity_units: existingData?.quantity_units?.toString() || '',
      responsible_id: product.responsible_id || null
    });
  };

  // Salvar item individual
  const handleSaveItem = async () => {
    if (!editingItem) return;

    setSaving(true);
    setError('');

    try {
      const estoqueUnidades = parseInt(itemForm.quantity_units) || 0;
      const estoqueKg = estoqueUnidades * (editingItem.peso_medio_kg || 0);
      // Calcular sugestão para 1 dia (valor padrão para backend)
      const sugestaoKg = Math.max(0, (editingItem.vendaMedia || 0) - estoqueKg);
      const sugestaoUnidades = editingItem.peso_medio_kg > 0 ? Math.ceil(sugestaoKg / editingItem.peso_medio_kg) : 0;

      const itemData = {
        product_code: editingItem.codigo,
        product_name: editingItem.descricao,
        quantity_units: estoqueUnidades,
        production_days: 1, // Fixo em 1 dia (sugestões para 1, 3, 7 dias são calculadas no PDF)
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
      setItemForm({ quantity_units: '', responsible_id: null });
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
      const estoqueUnidades = parseInt(itemForm.quantity_units) || 0;
      const estoqueKg = estoqueUnidades * (editingItem.peso_medio_kg || 0);
      // Calcular sugestão para 1 dia (valor padrão para backend)
      const sugestaoKg = Math.max(0, (editingItem.vendaMedia || 0) - estoqueKg);
      const sugestaoUnidades = editingItem.peso_medio_kg > 0 ? Math.ceil(sugestaoKg / editingItem.peso_medio_kg) : 0;

      const itemData = {
        product_code: editingItem.codigo,
        product_name: editingItem.descricao,
        quantity_units: estoqueUnidades,
        production_days: 1, // Fixo em 1 dia
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
          responsible_id: nextProduct.responsible_id || null
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
      case 'responsible_name':
        return product.responsible_name || 'zzz'; // zzz para ordenar sem responsável por último
      case 'perdasMesAnterior':
        return perdasMensais[product.codigo]?.mesAnterior || 0;
      case 'qtdPerdasMesAnterior':
        // Quantidade em unidades = kg / peso_medio
        const qtdKgAnt = perdasMensais[product.codigo]?.qtdMesAnterior || 0;
        const pesoMedioAnt = product.peso_medio_kg || 1;
        return pesoMedioAnt > 0 ? qtdKgAnt / pesoMedioAnt : 0;
      case 'perdasMesAtual':
        return perdasMensais[product.codigo]?.mesAtual || 0;
      case 'qtdPerdasMesAtual':
        // Quantidade em unidades = kg / peso_medio
        const qtdKgAtual = perdasMensais[product.codigo]?.qtdMesAtual || 0;
        const pesoMedioAtual = product.peso_medio_kg || 1;
        return pesoMedioAtual > 0 ? qtdKgAtual / pesoMedioAtual : 0;
      case 'receita':
        return product.codInfoReceita || 0;
      case 'nutricional':
        return product.codInfoNutricional || 0;
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

    // Salvar ordem no localStorage
    try {
      localStorage.setItem('producao-auditoria-column-order', JSON.stringify(newOrder));
    } catch (e) {
      console.error('Erro ao salvar ordem das colunas:', e);
    }
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
      case 'perdasMesAnterior':
        const perdaAnterior = perdasMensais[product.codigo]?.mesAnterior;
        return perdaAnterior > 0 ? (
          <span className="font-semibold text-blue-600">R$ {perdaAnterior.toFixed(2)}</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'qtdPerdasMesAnterior':
        const qtdKgAnt = perdasMensais[product.codigo]?.qtdMesAnterior || 0;
        const pesoMedioAnt = product.peso_medio_kg || 0;
        const qtdUndAnt = pesoMedioAnt > 0 ? Math.round(qtdKgAnt / pesoMedioAnt) : 0;
        return qtdUndAnt > 0 ? (
          <span className="font-semibold text-blue-600">{qtdUndAnt} und</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'perdasMesAtual':
        const perdaAtual = perdasMensais[product.codigo]?.mesAtual;
        return perdaAtual > 0 ? (
          <span className="font-semibold text-purple-600">R$ {perdaAtual.toFixed(2)}</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'qtdPerdasMesAtual':
        const qtdKgAtual = perdasMensais[product.codigo]?.qtdMesAtual || 0;
        const pesoMedioAtual = product.peso_medio_kg || 0;
        const qtdUndAtual = pesoMedioAtual > 0 ? Math.round(qtdKgAtual / pesoMedioAtual) : 0;
        return qtdUndAtual > 0 ? (
          <span className="font-semibold text-purple-600">{qtdUndAtual} und</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'responsible_name':
        return (
          <select
            value={product.responsible_id || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              handleUpdateResponsible(product.codigo, e.target.value || null);
            }}
            className={`w-full px-2 py-1 text-xs border rounded cursor-pointer ${
              product.responsible_id
                ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-300 bg-gray-50 text-gray-500'
            }`}
          >
            <option value="">Sem responsável</option>
            {(Array.isArray(employees) ? employees : []).filter(e => e.active).map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        );
      case 'receita':
        return product.codInfoReceita ? (
          <button
            onClick={(e) => { e.stopPropagation(); loadDetails('receita', product.codInfoReceita); }}
            className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-medium"
          >
            {product.codInfoReceita}
          </button>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case 'nutricional':
        return product.codInfoNutricional ? (
          <button
            onClick={(e) => { e.stopPropagation(); loadDetails('nutricional', product.codInfoNutricional); }}
            className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium"
          >
            {product.codInfoNutricional}
          </button>
        ) : (
          <span className="text-gray-400">-</span>
        );
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

      // Filtro por grupo
      if (selectedGrupo !== 'TODOS') {
        if (selectedGrupo === 'SEM_GRUPO') {
          if (product.codGrupo) return false; // Mostrar apenas sem grupo
        } else {
          if (product.codGrupo !== parseInt(selectedGrupo)) return false;
        }
      }

      // Filtro por subgrupo
      if (selectedSubgrupo !== 'TODOS') {
        if (selectedSubgrupo === 'SEM_SUBGRUPO') {
          if (product.codSubgrupo) return false; // Mostrar apenas sem subgrupo
        } else {
          if (product.codSubgrupo !== parseInt(selectedSubgrupo)) return false;
        }
      }

      // Filtro por responsável
      if (selectedResponsible !== 'TODOS') {
        if (selectedResponsible === 'SEM_RESPONSAVEL') {
          if (product.responsible_id) return false;
        } else {
          if (product.responsible_id !== selectedResponsible) return false;
        }
      }

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
              {/* Botão PDF - Exporta itens pendentes */}
              <button
                onClick={handleExportPDF}
                disabled={loading || filteredProducts.filter(p => !auditItems[p.codigo]?.checked).length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Exportar PDF com os itens pendentes da tabela atual"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF
              </button>
              <select
                value={selectedSecao}
                onChange={(e) => setSelectedSecao(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                title="Seção"
              >
                {sections.map(secao => (
                  <option key={secao} value={secao}>{secao}</option>
                ))}
              </select>
              <select
                value={selectedGrupo}
                onChange={(e) => setSelectedGrupo(e.target.value)}
                className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm bg-green-50"
                title="Grupo"
              >
                <option value="TODOS">Grupo: TODOS</option>
                <option value="SEM_GRUPO">⚠️ SEM GRUPO</option>
                {grupos.map(grupo => (
                  <option key={grupo.codigo} value={grupo.codigo}>{grupo.descricao}</option>
                ))}
              </select>
              <select
                value={selectedSubgrupo}
                onChange={(e) => setSelectedSubgrupo(e.target.value)}
                className="px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm bg-purple-50"
                disabled={selectedGrupo === 'TODOS' || selectedGrupo === 'SEM_GRUPO'}
                title="Subgrupo"
              >
                <option value="TODOS">Subgrupo: TODOS</option>
                <option value="SEM_SUBGRUPO">⚠️ SEM SUBGRUPO</option>
                {subgrupos.map(subgrupo => (
                  <option key={subgrupo.codigo} value={subgrupo.codigo}>{subgrupo.descricao}</option>
                ))}
              </select>
              <select
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                title="Tipo"
              >
                <option value="PRODUCAO">PRODUCAO</option>
                <option value="DIRETA">DIRETA</option>
                <option value="COMPOSICAO">COMPOSICAO</option>
                <option value="DECOMPOSICAO">DECOMPOSICAO</option>
              </select>
              <select
                value={selectedResponsible}
                onChange={(e) => setSelectedResponsible(e.target.value)}
                className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-blue-50"
              >
                <option value="TODOS">TODOS</option>
                <option value="SEM_RESPONSAVEL">Sem Responsável</option>
                {(Array.isArray(employees) ? employees : []).filter(e => e.active).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
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
                      <p className="text-[10px] text-white/70">Peso Médio</p>
                      <p className="text-xs font-bold">
                        {editingItem.peso_medio_kg ? `${editingItem.peso_medio_kg.toFixed(3)} kg` : '-'}
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

                    {/* Responsável */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <label className="block text-sm font-medium text-blue-800 mb-1">
                        👤 Responsável:
                      </label>
                      <select
                        value={itemForm.responsible_id || ''}
                        onChange={(e) => {
                          const newValue = e.target.value || null;
                          setItemForm({ ...itemForm, responsible_id: newValue });
                          // Salvar automaticamente quando mudar
                          if (editingItem) {
                            handleUpdateResponsible(editingItem.codigo, newValue);
                          }
                        }}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="">Sem responsável</option>
                        {(Array.isArray(employees) ? employees : []).filter(e => e.active).map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

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

                    {/* Cálculos em tempo real - Sugestões para 1, 3 e 7 dias */}
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-900 mb-3 text-sm">SUGESTÃO DE PRODUÇÃO:</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Estoque informado:</span>
                          <span className="font-bold text-gray-800">
                            {itemForm.quantity_units || 0} und = {((parseInt(itemForm.quantity_units) || 0) * (editingItem?.peso_medio_kg || 0)).toFixed(3)} kg
                          </span>
                        </div>
                        <div className="border-t border-orange-200 pt-2 space-y-2">
                          {/* 1 dia */}
                          <div className="flex justify-between items-center bg-green-50 rounded px-2 py-1">
                            <span className="text-sm font-medium text-green-800">📅 1 dia:</span>
                            <span className="font-bold text-green-700">
                              {Math.max(0, ((editingItem?.vendaMedia || 0) * 1) - ((parseInt(itemForm.quantity_units) || 0) * (editingItem?.peso_medio_kg || 0))).toFixed(3)} kg
                              <span className="text-green-600 ml-1">
                                ({Math.ceil(Math.max(0, ((editingItem?.vendaMedia || 0) * 1) - ((parseInt(itemForm.quantity_units) || 0) * (editingItem?.peso_medio_kg || 0))) / (editingItem?.peso_medio_kg || 1))} und)
                              </span>
                            </span>
                          </div>
                          {/* 3 dias */}
                          <div className="flex justify-between items-center bg-blue-50 rounded px-2 py-1">
                            <span className="text-sm font-medium text-blue-800">📅 3 dias:</span>
                            <span className="font-bold text-blue-700">
                              {Math.max(0, ((editingItem?.vendaMedia || 0) * 3) - ((parseInt(itemForm.quantity_units) || 0) * (editingItem?.peso_medio_kg || 0))).toFixed(3)} kg
                              <span className="text-blue-600 ml-1">
                                ({Math.ceil(Math.max(0, ((editingItem?.vendaMedia || 0) * 3) - ((parseInt(itemForm.quantity_units) || 0) * (editingItem?.peso_medio_kg || 0))) / (editingItem?.peso_medio_kg || 1))} und)
                              </span>
                            </span>
                          </div>
                          {/* 7 dias */}
                          <div className="flex justify-between items-center bg-purple-50 rounded px-2 py-1">
                            <span className="text-sm font-medium text-purple-800">📅 7 dias:</span>
                            <span className="font-bold text-purple-700">
                              {Math.max(0, ((editingItem?.vendaMedia || 0) * 7) - ((parseInt(itemForm.quantity_units) || 0) * (editingItem?.peso_medio_kg || 0))).toFixed(3)} kg
                              <span className="text-purple-600 ml-1">
                                ({Math.ceil(Math.max(0, ((editingItem?.vendaMedia || 0) * 7) - ((parseInt(itemForm.quantity_units) || 0) * (editingItem?.peso_medio_kg || 0))) / (editingItem?.peso_medio_kg || 1))} und)
                              </span>
                            </span>
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
                        className={`px-2 py-2 text-xs font-medium text-gray-500 uppercase cursor-grab select-none
                          ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}
                          ${column.sortable ? 'hover:bg-gray-100' : ''}
                          ${draggedColumn === index ? 'bg-orange-100 border-2 border-dashed border-orange-400' : ''}
                        `}
                        title={column.sortable ? 'Clique para ordenar | Arraste para mover' : 'Arraste para mover'}
                      >
                        <span className="inline-flex items-center gap-1">
                          <span className="text-gray-300">⠿</span>
                          <span className="whitespace-pre-line leading-tight">{column.label}</span>
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
                {/* Rodapé com soma total das perdas */}
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={columnOrder.length} className="px-4 py-3 text-right">
                      <div className="flex justify-end items-center gap-6 text-sm font-semibold">
                        <span className="text-blue-600">
                          Total Perdas Mês Ant: R$ {filteredProducts
                            .filter(p => !auditItems[p.codigo]?.checked)
                            .reduce((sum, p) => sum + (perdasMensais[p.codigo]?.mesAnterior || 0), 0)
                            .toFixed(2)}
                        </span>
                        <span className="text-purple-600">
                          Total Perdas Mês Atual: R$ {filteredProducts
                            .filter(p => !auditItems[p.codigo]?.checked)
                            .reduce((sum, p) => sum + (perdasMensais[p.codigo]?.mesAtual || 0), 0)
                            .toFixed(2)}
                        </span>
                        <span className="text-red-600 text-base">
                          📊 TOTAL GERAL: R$ {filteredProducts
                            .filter(p => !auditItems[p.codigo]?.checked)
                            .reduce((sum, p) => sum + (perdasMensais[p.codigo]?.mesAnterior || 0) + (perdasMensais[p.codigo]?.mesAtual || 0), 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
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
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">Curva</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase whitespace-pre-line leading-tight">Dias{'\n'}S/Venda</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Estoque</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-pre-line leading-tight">Venda{'\n'}Média</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-blue-600 uppercase whitespace-pre-line leading-tight">Perdas{'\n'}Mês Ant</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-blue-600 uppercase whitespace-pre-line leading-tight">Qtd Prd{'\n'}Mês Ant</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-purple-600 uppercase whitespace-pre-line leading-tight">Perdas{'\n'}Mês Atual</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-purple-600 uppercase whitespace-pre-line leading-tight">Qtd Prd{'\n'}Mês Atual</th>
                    {/* Sugestão 1 dia - Verde */}
                    <th className="px-2 py-2 text-center text-xs font-medium text-green-700 uppercase bg-green-100" colSpan="2">📅 1 Dia</th>
                    {/* Sugestão 3 dias - Azul */}
                    <th className="px-2 py-2 text-center text-xs font-medium text-blue-700 uppercase bg-blue-100" colSpan="2">📅 3 Dias</th>
                    {/* Sugestão 7 dias - Roxo */}
                    <th className="px-2 py-2 text-center text-xs font-medium text-purple-700 uppercase bg-purple-100" colSpan="2">📅 7 Dias</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                  <tr className="bg-gray-100">
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50">kg</th>
                    <th className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50">und</th>
                    <th className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50">kg</th>
                    <th className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50">und</th>
                    <th className="px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50">kg</th>
                    <th className="px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50">und</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {todayAudit.items
                    .sort((a, b) => a.product_name.localeCompare(b.product_name))
                    .map((item) => {
                      // Buscar produto na lista de produtos ERP para poder editar
                      const productFromERP = allProducts.find(p => p.codigo === item.product_code);
                      const diasSemVenda = item.days_without_sale ?? calcularDiasSemVenda(item.last_sale_date);

                      // Calcular sugestões para 1, 3 e 7 dias
                      const estoqueKg = (item.quantity_units || 0) * (parseFloat(item.unit_weight_kg) || 0);
                      const vendaMediaKg = parseFloat(item.avg_sales_kg) || 0;
                      const pesoMedio = parseFloat(item.unit_weight_kg) || 0;

                      const calcSug = (dias) => {
                        const necessidade = vendaMediaKg * dias;
                        const sugKg = Math.max(0, necessidade - estoqueKg);
                        const sugUnd = pesoMedio > 0 ? Math.ceil(sugKg / pesoMedio) : 0;
                        return { kg: sugKg, und: sugUnd };
                      };

                      const sug1 = calcSug(1);
                      const sug3 = calcSug(3);
                      const sug7 = calcSug(7);

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
                          <td className={`px-3 py-3 text-sm text-center font-bold ${
                            item.curva === 'A' ? 'text-green-600 bg-green-100' :
                            item.curva === 'B' ? 'text-blue-600 bg-blue-100' :
                            item.curva === 'C' ? 'text-yellow-600 bg-yellow-100' :
                            'text-red-600 bg-red-100'
                          }`}>
                            {item.curva || '-'}
                          </td>
                          <td className={`px-3 py-3 text-sm text-center font-semibold ${
                            diasSemVenda === null ? 'text-gray-400' :
                            diasSemVenda <= 1 ? 'text-green-600 bg-green-100' :
                            diasSemVenda <= 3 ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100'
                          }`}>
                            {diasSemVenda ?? '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-gray-700">
                            {item.quantity_units} und ({estoqueKg.toFixed(2)} kg)
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-gray-700">
                            {item.avg_sales_kg ? `${parseFloat(item.avg_sales_kg).toFixed(2)} kg/dia` : '-'}
                          </td>
                          {/* Perdas Mês Anterior - Valor */}
                          <td className="px-2 py-3 text-sm text-right">
                            {perdasMensais[item.product_code]?.mesAnterior > 0 ? (
                              <span className="font-semibold text-blue-600">
                                R$ {perdasMensais[item.product_code]?.mesAnterior.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          {/* Perdas Mês Anterior - Quantidade */}
                          <td className="px-2 py-3 text-sm text-right">
                            {(() => {
                              const qtdKg = perdasMensais[item.product_code]?.qtdMesAnterior || 0;
                              const pesoMed = parseFloat(item.unit_weight_kg) || 0;
                              const qtdUnd = pesoMed > 0 ? Math.round(qtdKg / pesoMed) : 0;
                              return qtdUnd > 0 ? (
                                <span className="font-semibold text-blue-600">{qtdUnd} und</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              );
                            })()}
                          </td>
                          {/* Perdas Mês Atual - Valor */}
                          <td className="px-2 py-3 text-sm text-right">
                            {perdasMensais[item.product_code]?.mesAtual > 0 ? (
                              <span className="font-semibold text-purple-600">
                                R$ {perdasMensais[item.product_code]?.mesAtual.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          {/* Perdas Mês Atual - Quantidade */}
                          <td className="px-2 py-3 text-sm text-right">
                            {(() => {
                              const qtdKg = perdasMensais[item.product_code]?.qtdMesAtual || 0;
                              const pesoMed = parseFloat(item.unit_weight_kg) || 0;
                              const qtdUnd = pesoMed > 0 ? Math.round(qtdKg / pesoMed) : 0;
                              return qtdUnd > 0 ? (
                                <span className="font-semibold text-purple-600">{qtdUnd} und</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              );
                            })()}
                          </td>
                          {/* Sugestão 1 dia - Verde */}
                          <td className="px-2 py-3 text-sm text-center font-semibold text-green-700 bg-green-50">
                            {sug1.kg.toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-sm text-center font-semibold text-green-700 bg-green-50">
                            {sug1.und}
                          </td>
                          {/* Sugestão 3 dias - Azul */}
                          <td className="px-2 py-3 text-sm text-center font-semibold text-blue-700 bg-blue-50">
                            {sug3.kg.toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-sm text-center font-semibold text-blue-700 bg-blue-50">
                            {sug3.und}
                          </td>
                          {/* Sugestão 7 dias - Roxo */}
                          <td className="px-2 py-3 text-sm text-center font-semibold text-purple-700 bg-purple-50">
                            {sug7.kg.toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-sm text-center font-semibold text-purple-700 bg-purple-50">
                            {sug7.und}
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

        {/* Modal de Detalhes (Receita/Nutricional) */}
        {detailsModal.type && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-auto">
              <div className={`px-4 py-3 border-b ${detailsModal.type === 'receita' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex justify-between items-center">
                  <h3 className={`font-semibold text-lg ${detailsModal.type === 'receita' ? 'text-green-800' : 'text-blue-800'}`}>
                    {detailsModal.type === 'receita' ? '📜 Receita' : '🥗 Informação Nutricional'} #{detailsModal.code}
                  </h3>
                  <button
                    onClick={() => setDetailsModal({ type: null, code: null, data: null, loading: false })}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4">
                {detailsModal.loading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Carregando...</p>
                  </div>
                ) : detailsModal.data ? (
                  detailsModal.type === 'receita' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Descrição:</label>
                        <p className="text-gray-900 font-semibold">{detailsModal.data.descricao || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Detalhamento:</label>
                        <p className="text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded border text-sm">
                          {detailsModal.data.detalhamento || 'Sem detalhamento disponível'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Descrição:</label>
                        <p className="text-gray-900 font-semibold mb-3">{detailsModal.data.descricao || '-'}</p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded border border-blue-200">
                        <h4 className="font-semibold text-blue-800 mb-2">Valores Nutricionais</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {detailsModal.data.porcao && (
                            <div className="col-span-2">
                              <span className="text-gray-600">Porção:</span>
                              <span className="ml-2 font-medium">{detailsModal.data.porcao}</span>
                            </div>
                          )}
                          {detailsModal.data.valorCalorico != null && (
                            <div><span className="text-gray-600">Calorias:</span> <span className="font-medium">{detailsModal.data.valorCalorico} kcal</span></div>
                          )}
                          {detailsModal.data.carboidrato != null && (
                            <div><span className="text-gray-600">Carboidratos:</span> <span className="font-medium">{detailsModal.data.carboidrato}g</span></div>
                          )}
                          {detailsModal.data.proteina != null && (
                            <div><span className="text-gray-600">Proteínas:</span> <span className="font-medium">{detailsModal.data.proteina}g</span></div>
                          )}
                          {detailsModal.data.gorduraTotal != null && (
                            <div><span className="text-gray-600">Gordura Total:</span> <span className="font-medium">{detailsModal.data.gorduraTotal}g</span></div>
                          )}
                          {detailsModal.data.gorduraSaturada != null && (
                            <div><span className="text-gray-600">Gordura Saturada:</span> <span className="font-medium">{detailsModal.data.gorduraSaturada}g</span></div>
                          )}
                          {detailsModal.data.gorduraTrans != null && (
                            <div><span className="text-gray-600">Gordura Trans:</span> <span className="font-medium">{detailsModal.data.gorduraTrans}g</span></div>
                          )}
                          {detailsModal.data.fibraAlimentar != null && (
                            <div><span className="text-gray-600">Fibra Alimentar:</span> <span className="font-medium">{detailsModal.data.fibraAlimentar}g</span></div>
                          )}
                          {detailsModal.data.sodio != null && (
                            <div><span className="text-gray-600">Sódio:</span> <span className="font-medium">{detailsModal.data.sodio}mg</span></div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Nenhuma informação encontrada</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t bg-gray-50">
                <button
                  onClick={() => setDetailsModal({ type: null, code: null, data: null, loading: false })}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
