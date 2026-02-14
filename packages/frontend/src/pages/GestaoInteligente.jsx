import { useState, useEffect, Fragment } from 'react';
import Layout from '../components/Layout';
import RadarLoading from '../components/RadarLoading';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';

// Função para obter datas padrão (primeiro dia do mês atual até hoje)
const getDefaultDates = () => {
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    dataInicio: formatDate(primeiroDiaMes),
    dataFim: formatDate(hoje)
  };
};

// Formatar valor como moeda
const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Formatar percentual
const formatPercent = (value) => {
  if (value === null || value === undefined) return '0,00%';
  return `${value.toFixed(2).replace('.', ',')}%`;
};

// Formatar número inteiro
const formatNumber = (value) => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
};

// Formatar moeda com casas decimais completas (para comparativos)
const formatCurrencyFull = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Componente para exibir comparativo com valor original + diferença com setinha e cores
const Comparativo = ({ label, valor, valorAtual, tipo = 'currency', invertido = false }) => {
  // Formatar o valor original
  const formatarValor = () => {
    if (tipo === 'currency') return formatCurrencyFull(valor);
    if (tipo === 'percent') return formatPercent(valor);
    if (tipo === 'number') return formatNumber(valor);
    return valor;
  };

  // Calcular a diferença (atual - passado)
  const diferenca = (valorAtual || 0) - (valor || 0);

  // Formatar a diferença
  const formatarDiferenca = () => {
    if (valor === 0 || valorAtual === undefined) return '';
    if (tipo === 'currency') {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(diferenca));
      return formatted;
    }
    if (tipo === 'percent') {
      return `${Math.abs(diferenca).toFixed(2).replace('.', ',')}%`;
    }
    return formatNumber(Math.abs(diferenca));
  };

  // Determinar se é positivo ou negativo (considerando invertido)
  const isPositivo = invertido ? diferenca < 0 : diferenca > 0;

  // Cor baseada na diferença
  const getCorDiferenca = () => {
    if (diferenca === 0 || valor === 0) return 'text-gray-500';
    return isPositivo ? 'text-green-600' : 'text-red-600';
  };

  // Setinha
  const Setinha = () => {
    if (diferenca === 0 || valor === 0) return null;
    if (isPositivo) {
      return (
        <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-400">{label}:</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-600">{formatarValor()}</span>
        {diferenca !== 0 && valor !== 0 && (
          <span className={`font-medium ${getCorDiferenca()}`}>
            <Setinha /> {isPositivo ? '+' : '-'}{formatarDiferenca()}
          </span>
        )}
      </div>
    </div>
  );
};

// Estado inicial dos indicadores com estrutura de comparativos
const initialIndicadores = {
  vendas: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  lucro: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  custoVendas: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  compras: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  impostos: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  markdown: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  margemLimpa: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  ticketMedio: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  pctCompraVenda: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  qtdCupons: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  qtdItens: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  qtdSkus: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  pctVendasOferta: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  vendasOferta: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  markdownOferta: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 }
};

export default function GestaoInteligente() {
  const [indicadores, setIndicadores] = useState(initialIndicadores);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(getDefaultDates());
  const [clearingCache, setClearingCache] = useState(false);
  const [analiseAtiva, setAnaliseAtiva] = useState(null); // 'vendas-setor', 'vendas-ano', 'vendas-dia-semana', 'vendas-analiticas', 'vendas-setor-anual'
  const [dadosAnalise, setDadosAnalise] = useState([]);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const { lojaSelecionada } = useLoja();

  // Estados para hierarquia expansível
  const [expandedSecoes, setExpandedSecoes] = useState({}); // { codSecao: { grupos: [], loading: false } }
  const [expandedGrupos, setExpandedGrupos] = useState({}); // { codGrupo: { subgrupos: [], loading: false } }
  const [expandedSubgrupos, setExpandedSubgrupos] = useState({}); // { codSubgrupo: { itens: [], loading: false } }

  // Estado para vendas por ano
  const [vendasAno, setVendasAno] = useState([]);
  const [anoAnteriorData, setAnoAnteriorData] = useState(null);
  const [loadingVendasAno, setLoadingVendasAno] = useState(false);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  // Estado para vendas por dia da semana
  const [vendasDiaSemana, setVendasDiaSemana] = useState([]);
  const [loadingVendasDiaSemana, setLoadingVendasDiaSemana] = useState(false);
  const [anoDiaSemana, setAnoDiaSemana] = useState(new Date().getFullYear());

  // Estado para vendas analíticas por setor
  const [vendasAnaliticas, setVendasAnaliticas] = useState([]);
  const [loadingVendasAnaliticas, setLoadingVendasAnaliticas] = useState(false);

  // Estado para cascata analítica (Seção > Grupo > Subgrupo > Item)
  const [expandedAnaliticaSecoes, setExpandedAnaliticaSecoes] = useState({});
  const [expandedAnaliticaGrupos, setExpandedAnaliticaGrupos] = useState({});
  const [expandedAnaliticaSubgrupos, setExpandedAnaliticaSubgrupos] = useState({});

  // Estado para vendas por setor anual
  const [vendasSetorAnual, setVendasSetorAnual] = useState([]);
  const [loadingVendasSetorAnual, setLoadingVendasSetorAnual] = useState(false);
  const [anoSetorAnual, setAnoSetorAnual] = useState(new Date().getFullYear());
  const [expandedSetoresAnual, setExpandedSetoresAnual] = useState({});

  // Estado para ordem dos cards (drag and drop)
  const defaultCardOrder = ['vendas', 'lucro', 'markdown', 'margemLimpa', 'ticketMedio', 'pctCompraVenda'];
  const defaultCardOrder2 = ['pctVendasOferta', 'qtdSkus', 'qtdCupons', 'qtdItens', 'vendasOfertaValor', 'emBreve2'];
  const defaultCardOrder3 = ['custoVendas', 'markdownOferta', 'emBreve5', 'emBreve6', 'emBreve7', 'emBreve8'];

  const migrateCardIds = (ids) => ids.map(id => {
    if (id === 'emBreve1') return 'vendasOfertaValor';
    if (id === 'emBreve3') return 'custoVendas';
    if (id === 'emBreve4') return 'markdownOferta';
    return id;
  });

  const [cardOrder, setCardOrder] = useState(() => {
    const saved = localStorage.getItem('gestao_card_order');
    return saved ? migrateCardIds(JSON.parse(saved)) : defaultCardOrder;
  });
  const [cardOrder2, setCardOrder2] = useState(() => {
    const saved = localStorage.getItem('gestao_card_order_2');
    return saved ? migrateCardIds(JSON.parse(saved)) : defaultCardOrder2;
  });
  const [cardOrder3, setCardOrder3] = useState(() => {
    const saved = localStorage.getItem('gestao_card_order_3');
    return saved ? migrateCardIds(JSON.parse(saved)) : defaultCardOrder3;
  });
  const [draggedCard, setDraggedCard] = useState(null);
  const [draggedRow, setDraggedRow] = useState(null);
  const [cardExpandido, setCardExpandido] = useState('vendas'); // qual card de cima está expandido mostrando sub-cards

  // Estado para ordem dos cards de análise (drag and drop)
  const defaultAnaliseOrder = ['vendas-setor', 'vendas-ano', 'vendas-dia-semana', 'vendas-analiticas', 'vendas-setor-anual'];
  const [analiseCardOrder, setAnaliseCardOrder] = useState(() => {
    const saved = localStorage.getItem('gestao_analise_card_order');
    return saved ? JSON.parse(saved) : defaultAnaliseOrder;
  });
  const [draggedAnaliseCard, setDraggedAnaliseCard] = useState(null);

  // Estado para ordem das colunas da tabela (drag and drop)
  const defaultColOrder = ['venda', 'repr', 'custo', 'lucro', 'markdown', 'ticketMedio', 'vendasOferta', 'qtd'];
  const [colOrder, setColOrder] = useState(() => {
    const saved = localStorage.getItem('gestao_col_order');
    return saved ? JSON.parse(saved) : defaultColOrder;
  });
  const [draggedCol, setDraggedCol] = useState(null);

  // Salvar ordem no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem('gestao_card_order', JSON.stringify(cardOrder));
  }, [cardOrder]);

  useEffect(() => {
    localStorage.setItem('gestao_card_order_2', JSON.stringify(cardOrder2));
  }, [cardOrder2]);

  useEffect(() => {
    localStorage.setItem('gestao_card_order_3', JSON.stringify(cardOrder3));
  }, [cardOrder3]);

  useEffect(() => {
    localStorage.setItem('gestao_col_order', JSON.stringify(colOrder));
  }, [colOrder]);

  useEffect(() => {
    localStorage.setItem('gestao_analise_card_order', JSON.stringify(analiseCardOrder));
  }, [analiseCardOrder]);

  // Drag and drop de colunas
  const handleColDragStart = (e, colId) => {
    setDraggedCol(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };
  const handleColDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedCol(null);
  };
  const handleColDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleColDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetColId) return;
    const newOrder = [...colOrder];
    const fromIdx = newOrder.indexOf(draggedCol);
    const toIdx = newOrder.indexOf(targetColId);
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedCol);
    setColOrder(newOrder);
    setDraggedCol(null);
  };

  // Drag and drop dos cards de análise
  const handleAnaliseCardDragStart = (e, cardId) => {
    setDraggedAnaliseCard(cardId);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };
  const handleAnaliseCardDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedAnaliseCard(null);
  };
  const handleAnaliseCardDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleAnaliseCardDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedAnaliseCard || draggedAnaliseCard === targetId) return;
    const newOrder = [...analiseCardOrder];
    const fromIdx = newOrder.indexOf(draggedAnaliseCard);
    const toIdx = newOrder.indexOf(targetId);
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedAnaliseCard);
    setAnaliseCardOrder(newOrder);
    setDraggedAnaliseCard(null);
  };

  // Config dos cards de análise (classes completas para Tailwind JIT)
  const analiseCardConfig = {
    'vendas-setor': { label: 'Vendas por Setor', desc: 'Hierarquia completa por setor', emoji: '🏪', onClick: () => fetchVendasPorSetor(),
      active: 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400', inactive: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
      icon: 'bg-emerald-200', title: 'text-emerald-800', sub: 'text-emerald-600' },
    'vendas-ano': { label: 'Vendas por Ano', desc: 'Indicadores mensais consolidados', emoji: '📅', onClick: () => toggleVendasPorAno(),
      active: 'bg-blue-100 border-blue-400 ring-2 ring-blue-400', inactive: 'bg-blue-50 border-blue-200 hover:border-blue-400',
      icon: 'bg-blue-200', title: 'text-blue-800', sub: 'text-blue-600' },
    'vendas-dia-semana': { label: 'Venda Média Dia da Semana', desc: 'Padroes semanais por mes', emoji: '📊', onClick: () => toggleVendasPorDiaSemana(),
      active: 'bg-violet-100 border-violet-400 ring-2 ring-violet-400', inactive: 'bg-violet-50 border-violet-200 hover:border-violet-400',
      icon: 'bg-violet-200', title: 'text-violet-800', sub: 'text-violet-600' },
    'vendas-analiticas': { label: 'Vendas Analiticas', desc: 'Comparativos por setor', emoji: '📈', onClick: () => toggleVendasAnaliticas(),
      active: 'bg-amber-100 border-amber-400 ring-2 ring-amber-400', inactive: 'bg-amber-50 border-amber-200 hover:border-amber-400',
      icon: 'bg-amber-200', title: 'text-amber-800', sub: 'text-amber-600' },
    'vendas-setor-anual': { label: 'Vendas por Setor Anual', desc: 'Evolucao anual por setor', emoji: '🗓', onClick: () => toggleVendasPorSetorAnual(),
      active: 'bg-sky-100 border-sky-400 ring-2 ring-sky-400', inactive: 'bg-sky-50 border-sky-200 hover:border-sky-400',
      icon: 'bg-sky-200', title: 'text-sky-800', sub: 'text-sky-600' },
  };

  // Definição das colunas da tabela de vendas por setor
  const colDefs = {
    venda: {
      label: 'Venda',
      headerClass: 'text-emerald-700',
      renderSetor: (d) => ({ cls: 'font-semibold text-emerald-700', val: formatCurrency(d.venda) }),
      renderGrupo: (d) => ({ cls: 'font-medium text-emerald-700', val: formatCurrency(d.venda) }),
      renderSub: (d) => ({ cls: 'text-emerald-700', val: formatCurrency(d.venda) }),
      renderItem: (d) => ({ cls: 'text-emerald-700', val: formatCurrency(d.venda) }),
      renderTotal: (dados) => ({ cls: 'font-bold text-emerald-700', val: formatCurrency(dados.reduce((a, i) => a + i.venda, 0)) }),
    },
    repr: {
      label: '% Repr.',
      headerClass: 'text-blue-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-blue-600', val: formatPercent(d.percentualSetor) }),
      renderGrupo: (d) => ({ cls: 'font-medium text-blue-600', val: formatPercent(d.percentualSetor) }),
      renderSub: (d) => ({ cls: 'text-blue-600', val: formatPercent(d.percentualSetor) }),
      renderItem: (d) => ({ cls: 'text-blue-600', val: formatPercent(d.percentualSetor) }),
      renderTotal: () => ({ cls: 'font-bold text-blue-600', val: '100,00%' }),
    },
    custo: {
      label: 'Custo',
      headerClass: 'text-orange-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-orange-600', val: formatCurrency(d.custo) }),
      renderGrupo: (d) => ({ cls: 'text-orange-600', val: formatCurrency(d.custo) }),
      renderSub: (d) => ({ cls: 'text-orange-600', val: formatCurrency(d.custo) }),
      renderItem: (d) => ({ cls: 'text-orange-600', val: formatCurrency(d.custo) }),
      renderTotal: (dados) => ({ cls: 'font-bold text-orange-600', val: formatCurrency(dados.reduce((a, i) => a + (i.custo || 0), 0)) }),
    },
    lucro: {
      label: 'Lucro',
      headerClass: 'text-green-600',
      renderSetor: (d) => ({ cls: `font-semibold ${d.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`, val: formatCurrency(d.lucro) }),
      renderGrupo: (d) => ({ cls: `font-medium ${d.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`, val: formatCurrency(d.lucro) }),
      renderSub: (d) => ({ cls: d.lucro >= 0 ? 'text-green-600' : 'text-red-600', val: formatCurrency(d.lucro) }),
      renderItem: (d) => ({ cls: d.lucro >= 0 ? 'text-green-600' : 'text-red-600', val: formatCurrency(d.lucro) }),
      renderTotal: (dados) => {
        const tv = dados.reduce((a, i) => a + i.venda, 0);
        const tc = dados.reduce((a, i) => a + (i.custo || 0), 0);
        return { cls: `font-bold ${(tv - tc) >= 0 ? 'text-green-600' : 'text-red-600'}`, val: formatCurrency(tv - tc) };
      },
    },
    markdown: {
      label: 'Markdown %',
      headerClass: 'text-purple-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-purple-600', val: formatPercent(d.margem) }),
      renderGrupo: (d) => ({ cls: 'font-medium text-purple-600', val: formatPercent(d.margem) }),
      renderSub: (d) => ({ cls: 'text-purple-600', val: formatPercent(d.margem) }),
      renderItem: (d) => ({ cls: 'text-purple-600', val: formatPercent(d.margem) }),
      renderTotal: (dados) => {
        const tv = dados.reduce((a, i) => a + i.venda, 0);
        const tc = dados.reduce((a, i) => a + (i.custo || 0), 0);
        return { cls: 'font-bold text-purple-600', val: formatPercent(tv > 0 ? ((tv - tc) / tv) * 100 : 0) };
      },
    },
    ticketMedio: {
      label: 'Ticket Medio',
      headerClass: 'text-teal-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-teal-600', val: formatCurrency(d.ticketMedio) }),
      renderGrupo: (d) => ({ cls: 'text-teal-600', val: formatCurrency(d.ticketMedio) }),
      renderSub: (d) => ({ cls: 'text-teal-600', val: formatCurrency(d.ticketMedio) }),
      renderItem: (d) => ({ cls: 'text-teal-600', val: formatCurrency(d.ticketMedio) }),
      renderTotal: (dados) => {
        const totalVenda = dados.reduce((a, i) => a + i.venda, 0);
        const totalCupons = dados.reduce((a, i) => a + (i.qtdCupons || 0), 0);
        return { cls: 'font-bold text-teal-600', val: formatCurrency(totalCupons > 0 ? totalVenda / totalCupons : 0) };
      },
    },
    vendasOferta: {
      label: 'Vendas Oferta',
      headerClass: 'text-rose-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-rose-600', val: formatCurrency(d.vendasOferta) }),
      renderGrupo: (d) => ({ cls: 'text-rose-600', val: formatCurrency(d.vendasOferta) }),
      renderSub: (d) => ({ cls: 'text-rose-600', val: formatCurrency(d.vendasOferta) }),
      renderItem: (d) => ({ cls: 'text-rose-600', val: formatCurrency(d.vendasOferta) }),
      renderTotal: (dados) => ({ cls: 'font-bold text-rose-600', val: formatCurrency(dados.reduce((a, i) => a + (i.vendasOferta || 0), 0)) }),
    },
    qtd: {
      label: 'Qtd',
      headerClass: 'text-cyan-700',
      renderSetor: (d) => ({ cls: 'font-semibold text-cyan-700', val: formatNumber(d.qtd) }),
      renderGrupo: (d) => ({ cls: 'text-cyan-700', val: formatNumber(d.qtd) }),
      renderSub: (d) => ({ cls: 'text-cyan-700', val: formatNumber(d.qtd) }),
      renderItem: (d) => ({ cls: 'text-cyan-700', val: formatNumber(d.qtd) }),
      renderTotal: (dados) => ({ cls: 'font-bold text-cyan-700', val: formatNumber(dados.reduce((a, i) => a + i.qtd, 0)) }),
    },
  };

  // Funções de drag and drop
  const handleDragStart = (e, cardId, row) => {
    setDraggedCard(cardId);
    setDraggedRow(row);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedCard(null);
    setDraggedRow(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetCardId, targetRow) => {
    e.preventDefault();
    if (!draggedCard) return;

    const getRowData = (row) => {
      if (row === 1) return [cardOrder, setCardOrder];
      if (row === 2) return [cardOrder2, setCardOrder2];
      return [cardOrder3, setCardOrder3];
    };

    if (draggedRow === targetRow) {
      const [orderArray, setOrderArray] = getRowData(targetRow);
      const draggedIndex = orderArray.indexOf(draggedCard);
      const targetIndex = orderArray.indexOf(targetCardId);
      if (draggedIndex !== targetIndex) {
        const newOrder = [...orderArray];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedCard);
        setOrderArray(newOrder);
      }
    } else {
      const [sourceArray, setSourceArray] = getRowData(draggedRow);
      const [targetArray, setTargetArray] = getRowData(targetRow);
      const draggedIndex = sourceArray.indexOf(draggedCard);
      const targetIndex = targetArray.indexOf(targetCardId);
      const newSourceArray = [...sourceArray];
      const newTargetArray = [...targetArray];
      newSourceArray[draggedIndex] = targetCardId;
      newTargetArray[targetIndex] = draggedCard;
      setSourceArray(newSourceArray);
      setTargetArray(newTargetArray);
    }

    setDraggedCard(null);
    setDraggedRow(null);
  };

  // Lista de meses completa para exibição
  const mesesCompletos = [
    { num: 1, nome: 'JAN' },
    { num: 2, nome: 'FEV' },
    { num: 3, nome: 'MAR' },
    { num: 4, nome: 'ABR' },
    { num: 5, nome: 'MAI' },
    { num: 6, nome: 'JUN' },
    { num: 7, nome: 'JUL' },
    { num: 8, nome: 'AGO' },
    { num: 9, nome: 'SET' },
    { num: 10, nome: 'OUT' },
    { num: 11, nome: 'NOV' },
    { num: 12, nome: 'DEZ' }
  ];

  // Função para obter dados do mês ou retornar zeros
  const getDadosMes = (mesNum) => {
    const dados = vendasAno.find(m => m.mesNum === mesNum);
    return dados || {
      mes: mesesCompletos.find(m => m.num === mesNum)?.nome || '',
      mesNum,
      venda: 0,
      lucro: 0,
      margem: 0,
      margemLiquida: 0,
      ticketMedio: 0,
      cupons: 0,
      skus: 0,
      itensVendidos: 0,
      vendasOferta: 0,
      pctOferta: 0
    };
  };

  // Buscar indicadores
  const fetchIndicadores = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/indicadores', { params });
      setIndicadores(response.data);
    } catch (err) {
      console.error('Erro ao buscar indicadores:', err);
      setError(err.response?.data?.error || 'Erro ao carregar indicadores');
    } finally {
      setLoading(false);
    }
  };

  // Limpar cache
  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await api.post('/gestao-inteligente/clear-cache');
      await fetchIndicadores();
    } catch (err) {
      console.error('Erro ao limpar cache:', err);
    } finally {
      setClearingCache(false);
    }
  };

  // Buscar vendas por setor
  const fetchVendasPorSetor = async () => {
    if (analiseAtiva === 'vendas-setor') {
      setAnaliseAtiva(null);
      setDadosAnalise([]);
      // Limpar expansões
      setExpandedSecoes({});
      setExpandedGrupos({});
      setExpandedSubgrupos({});
      return;
    }

    setLoadingAnalise(true);
    setAnaliseAtiva('vendas-setor');
    // Limpar expansões anteriores
    setExpandedSecoes({});
    setExpandedGrupos({});
    setExpandedSubgrupos({});
    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/vendas-por-setor', { params });
      setDadosAnalise(response.data);
    } catch (err) {
      console.error('Erro ao buscar vendas por setor:', err);
      setDadosAnalise([]);
    } finally {
      setLoadingAnalise(false);
    }
  };

  // Expandir/Recolher seção para ver grupos
  const toggleSecao = async (codSecao) => {
    if (expandedSecoes[codSecao]) {
      // Recolher
      setExpandedSecoes(prev => {
        const newState = { ...prev };
        delete newState[codSecao];
        return newState;
      });
      return;
    }

    // Expandir - buscar grupos
    setExpandedSecoes(prev => ({
      ...prev,
      [codSecao]: { grupos: [], loading: true }
    }));

    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        codSecao
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/grupos-por-secao', { params });
      setExpandedSecoes(prev => ({
        ...prev,
        [codSecao]: { grupos: response.data, loading: false }
      }));
    } catch (err) {
      console.error('Erro ao buscar grupos:', err);
      setExpandedSecoes(prev => ({
        ...prev,
        [codSecao]: { grupos: [], loading: false }
      }));
    }
  };

  // Expandir/Recolher grupo para ver subgrupos
  const toggleGrupo = async (codGrupo, codSecao) => {
    if (expandedGrupos[codGrupo]) {
      // Recolher
      setExpandedGrupos(prev => {
        const newState = { ...prev };
        delete newState[codGrupo];
        return newState;
      });
      return;
    }

    // Expandir - buscar subgrupos
    setExpandedGrupos(prev => ({
      ...prev,
      [codGrupo]: { subgrupos: [], loading: true }
    }));

    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        codGrupo,
        codSecao // Filtrar também por seção
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/subgrupos-por-grupo', { params });
      setExpandedGrupos(prev => ({
        ...prev,
        [codGrupo]: { subgrupos: response.data, loading: false, codSecao }
      }));
    } catch (err) {
      console.error('Erro ao buscar subgrupos:', err);
      setExpandedGrupos(prev => ({
        ...prev,
        [codGrupo]: { subgrupos: [], loading: false }
      }));
    }
  };

  // Expandir/Recolher subgrupo para ver itens
  const toggleSubgrupo = async (codSubgrupo, codGrupo, codSecao) => {
    if (expandedSubgrupos[codSubgrupo]) {
      // Recolher
      setExpandedSubgrupos(prev => {
        const newState = { ...prev };
        delete newState[codSubgrupo];
        return newState;
      });
      return;
    }

    // Expandir - buscar itens
    setExpandedSubgrupos(prev => ({
      ...prev,
      [codSubgrupo]: { itens: [], loading: true }
    }));

    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        codSubgrupo,
        codGrupo,   // Filtrar também por grupo
        codSecao    // Filtrar também por seção
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/itens-por-subgrupo', { params });
      setExpandedSubgrupos(prev => ({
        ...prev,
        [codSubgrupo]: { itens: response.data, loading: false }
      }));
    } catch (err) {
      console.error('Erro ao buscar itens:', err);
      setExpandedSubgrupos(prev => ({
        ...prev,
        [codSubgrupo]: { itens: [], loading: false }
      }));
    }
  };

  // Buscar vendas por ano
  const fetchVendasPorAno = async (ano = anoSelecionado) => {
    setLoadingVendasAno(true);
    setAnaliseAtiva('vendas-ano');
    // Limpar dados anteriores
    setDadosAnalise([]);
    setExpandedSecoes({});
    setExpandedGrupos({});
    setExpandedSubgrupos({});

    try {
      const params = { ano };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/vendas-por-ano', { params });
      // A resposta agora é { meses: [], anoAnterior: {} }
      setVendasAno(response.data.meses || response.data);
      setAnoAnteriorData(response.data.anoAnterior || null);
    } catch (err) {
      console.error('Erro ao buscar vendas por ano:', err);
      setVendasAno([]);
      setAnoAnteriorData(null);
    } finally {
      setLoadingVendasAno(false);
    }
  };

  // Handler para mudança de ano
  const handleAnoChange = (novoAno) => {
    setAnoSelecionado(novoAno);
    if (analiseAtiva === 'vendas-ano') {
      fetchVendasPorAno(novoAno);
    }
  };

  // Toggle vendas por ano
  const toggleVendasPorAno = () => {
    if (analiseAtiva === 'vendas-ano') {
      setAnaliseAtiva(null);
      setVendasAno([]);
      setAnoAnteriorData(null);
    } else {
      fetchVendasPorAno(anoSelecionado);
    }
  };

  // Buscar vendas por dia da semana
  const fetchVendasPorDiaSemana = async (ano = anoDiaSemana) => {
    setLoadingVendasDiaSemana(true);
    setAnaliseAtiva('vendas-dia-semana');
    setDadosAnalise([]);
    setExpandedSecoes({});
    setExpandedGrupos({});
    setExpandedSubgrupos({});
    setVendasAno([]);
    setAnoAnteriorData(null);

    try {
      const params = { ano };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/vendas-por-dia-semana', { params });
      setVendasDiaSemana(response.data.meses || []);
    } catch (err) {
      console.error('Erro ao buscar vendas por dia da semana:', err);
      setVendasDiaSemana([]);
    } finally {
      setLoadingVendasDiaSemana(false);
    }
  };

  // Handler para mudança de ano (dia da semana)
  const handleAnoDiaSemanaChange = (novoAno) => {
    setAnoDiaSemana(novoAno);
    if (analiseAtiva === 'vendas-dia-semana') {
      fetchVendasPorDiaSemana(novoAno);
    }
  };

  // Toggle vendas por dia da semana
  const toggleVendasPorDiaSemana = () => {
    if (analiseAtiva === 'vendas-dia-semana') {
      setAnaliseAtiva(null);
      setVendasDiaSemana([]);
    } else {
      fetchVendasPorDiaSemana(anoDiaSemana);
    }
  };

  // Buscar vendas analíticas por setor
  const fetchVendasAnaliticas = async () => {
    setLoadingVendasAnaliticas(true);
    setAnaliseAtiva('vendas-analiticas');
    setDadosAnalise([]);
    setExpandedSecoes({});
    setExpandedGrupos({});
    setExpandedSubgrupos({});
    setVendasAno([]);
    setAnoAnteriorData(null);
    setVendasDiaSemana([]);
    setExpandedAnaliticaSecoes({});
    setExpandedAnaliticaGrupos({});
    setExpandedAnaliticaSubgrupos({});

    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/vendas-analiticas-setor', { params });
      setVendasAnaliticas(response.data);
    } catch (err) {
      console.error('Erro ao buscar vendas analíticas:', err);
      setVendasAnaliticas([]);
    } finally {
      setLoadingVendasAnaliticas(false);
    }
  };

  // Toggle vendas analíticas
  const toggleVendasAnaliticas = () => {
    if (analiseAtiva === 'vendas-analiticas') {
      setAnaliseAtiva(null);
      setVendasAnaliticas([]);
    } else {
      fetchVendasAnaliticas();
    }
  };

  // Cascata analítica: Expandir/Recolher seção → grupos
  const toggleAnaliticaSecao = async (codSecao) => {
    if (expandedAnaliticaSecoes[codSecao]) {
      setExpandedAnaliticaSecoes(prev => { const n = { ...prev }; delete n[codSecao]; return n; });
      return;
    }
    setExpandedAnaliticaSecoes(prev => ({ ...prev, [codSecao]: { data: [], loading: true } }));
    try {
      const params = { dataInicio: filters.dataInicio, dataFim: filters.dataFim, codSecao };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const response = await api.get('/gestao-inteligente/grupos-analiticos', { params });
      setExpandedAnaliticaSecoes(prev => ({ ...prev, [codSecao]: { data: response.data, loading: false } }));
    } catch (err) {
      console.error('Erro ao buscar grupos analíticos:', err);
      setExpandedAnaliticaSecoes(prev => ({ ...prev, [codSecao]: { data: [], loading: false } }));
    }
  };

  // Cascata analítica: Expandir/Recolher grupo → subgrupos
  const toggleAnaliticaGrupo = async (codGrupo, codSecao) => {
    const key = `${codSecao}_${codGrupo}`;
    if (expandedAnaliticaGrupos[key]) {
      setExpandedAnaliticaGrupos(prev => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    setExpandedAnaliticaGrupos(prev => ({ ...prev, [key]: { data: [], loading: true } }));
    try {
      const params = { dataInicio: filters.dataInicio, dataFim: filters.dataFim, codSecao, codGrupo };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const response = await api.get('/gestao-inteligente/subgrupos-analiticos', { params });
      setExpandedAnaliticaGrupos(prev => ({ ...prev, [key]: { data: response.data, loading: false } }));
    } catch (err) {
      console.error('Erro ao buscar subgrupos analíticos:', err);
      setExpandedAnaliticaGrupos(prev => ({ ...prev, [key]: { data: [], loading: false } }));
    }
  };

  // Cascata analítica: Expandir/Recolher subgrupo → itens
  const toggleAnaliticaSubgrupo = async (codSubgrupo, codGrupo, codSecao) => {
    const key = `${codSecao}_${codGrupo}_${codSubgrupo}`;
    if (expandedAnaliticaSubgrupos[key]) {
      setExpandedAnaliticaSubgrupos(prev => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    setExpandedAnaliticaSubgrupos(prev => ({ ...prev, [key]: { data: [], loading: true } }));
    try {
      const params = { dataInicio: filters.dataInicio, dataFim: filters.dataFim, codSecao, codGrupo, codSubgrupo };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const response = await api.get('/gestao-inteligente/itens-analiticos', { params });
      setExpandedAnaliticaSubgrupos(prev => ({ ...prev, [key]: { data: response.data, loading: false } }));
    } catch (err) {
      console.error('Erro ao buscar itens analíticos:', err);
      setExpandedAnaliticaSubgrupos(prev => ({ ...prev, [key]: { data: [], loading: false } }));
    }
  };

  // Buscar vendas por setor anual
  const fetchVendasPorSetorAnual = async (ano = anoSetorAnual) => {
    setLoadingVendasSetorAnual(true);
    setAnaliseAtiva('vendas-setor-anual');
    setDadosAnalise([]);
    setExpandedSecoes({});
    setExpandedGrupos({});
    setExpandedSubgrupos({});
    setVendasAno([]);
    setAnoAnteriorData(null);
    setVendasDiaSemana([]);
    setVendasAnaliticas([]);
    setExpandedSetoresAnual({});
    try {
      const params = { ano };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const response = await api.get('/gestao-inteligente/vendas-por-setor-anual', { params });
      setVendasSetorAnual(response.data.setores || []);
    } catch (err) {
      console.error('Erro ao buscar vendas por setor anual:', err);
      setVendasSetorAnual([]);
    } finally {
      setLoadingVendasSetorAnual(false);
    }
  };

  const handleAnoSetorAnualChange = (novoAno) => {
    setAnoSetorAnual(novoAno);
    if (analiseAtiva === 'vendas-setor-anual') fetchVendasPorSetorAnual(novoAno);
  };

  const toggleVendasPorSetorAnual = () => {
    if (analiseAtiva === 'vendas-setor-anual') {
      setAnaliseAtiva(null);
      setVendasSetorAnual([]);
    } else {
      fetchVendasPorSetorAnual(anoSetorAnual);
    }
  };

  useEffect(() => {
    fetchIndicadores();
  }, [filters, lojaSelecionada]);

  // Auto-carregar Venda por Ano ao abrir a página
  useEffect(() => {
    fetchVendasPorAno(anoSelecionado);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-executar análise ativa quando filtros mudarem
  useEffect(() => {
    if (analiseAtiva === 'vendas-setor') {
      // Limpar expansões quando filtros mudam
      setExpandedSecoes({});
      setExpandedGrupos({});
      setExpandedSubgrupos({});

      const fetchData = async () => {
        setLoadingAnalise(true);
        try {
          const params = {
            dataInicio: filters.dataInicio,
            dataFim: filters.dataFim
          };
          if (lojaSelecionada) {
            params.codLoja = lojaSelecionada;
          }
          const response = await api.get('/gestao-inteligente/vendas-por-setor', { params });
          setDadosAnalise(response.data);
        } catch (err) {
          console.error('Erro ao buscar vendas por setor:', err);
          setDadosAnalise([]);
        } finally {
          setLoadingAnalise(false);
        }
      };
      fetchData();
    }

    if (analiseAtiva === 'vendas-analiticas') {
      fetchVendasAnaliticas();
    }

    if (analiseAtiva === 'vendas-setor-anual') {
      fetchVendasPorSetorAnual(anoSetorAnual);
    }
  }, [filters, lojaSelecionada, analiseAtiva]);

  // Formatar período para exibição
  const formatPeriodo = () => {
    const inicio = filters.dataInicio.split('-').reverse().join('/');
    const fim = filters.dataFim.split('-').reverse().join('/');
    return `${inicio} a ${fim}`;
  };

  // Definição dos cards para renderização dinâmica
  const cardsConfig = {
    vendas: {
      borderColor: 'border-green-500',
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
      icon: <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
      label: 'Faturamento',
      title: 'VENDAS',
      getValue: () => formatCurrency(indicadores.vendas?.atual),
      tipo: 'currency',
      indicador: 'vendas'
    },
    lucro: {
      borderColor: 'border-cyan-500',
      bgColor: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      icon: <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>,
      label: 'Lucro Bruto',
      title: 'LUCRO',
      getValue: () => formatCurrency(indicadores.lucro?.atual),
      tipo: 'currency',
      indicador: 'lucro'
    },
    markdown: {
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>,
      label: 'Margem Bruta',
      title: 'MARKDOWN',
      getValue: () => formatPercent(indicadores.markdown?.atual),
      tipo: 'percent',
      indicador: 'markdown'
    },
    margemLimpa: {
      borderColor: 'border-purple-500',
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
      icon: <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
      label: 'Sem Impostos',
      title: 'MARGEM LIMPA',
      getValue: () => formatPercent(indicadores.margemLimpa?.atual),
      tipo: 'percent',
      indicador: 'margemLimpa'
    },
    ticketMedio: {
      borderColor: 'border-orange-500',
      bgColor: 'bg-orange-100',
      iconColor: 'text-orange-600',
      icon: <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>,
      label: 'Por Cupom',
      title: 'TICKET MEDIO',
      getValue: () => formatCurrency(indicadores.ticketMedio?.atual),
      getExtra: () => <span className="text-sm font-semibold text-green-600">({formatNumber(indicadores.qtdCupons?.atual)} cupons)</span>,
      tipo: 'currency',
      indicador: 'ticketMedio'
    },
    pctCompraVenda: {
      borderColor: 'border-teal-500',
      bgColor: 'bg-teal-100',
      iconColor: 'text-teal-600',
      icon: <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>,
      label: 'Compras',
      title: '% COMPRA E VENDA',
      getValue: () => formatPercent(indicadores.pctCompraVenda?.atual),
      tipo: 'percent',
      indicador: 'pctCompraVenda',
      invertido: true
    },
    pctVendasOferta: {
      borderColor: 'border-rose-500',
      bgColor: 'bg-rose-100',
      iconColor: 'text-rose-600',
      icon: <span className="text-xl">🏷️</span>,
      label: 'Promocoes',
      title: 'VENDAS EM OFERTA',
      getValue: () => formatPercent(indicadores.pctVendasOferta?.atual),
      getExtra: () => (
        <>
          <span className="text-sm font-semibold text-rose-600">({formatCurrency(indicadores.vendasOferta?.atual)})</span>
          <span className="text-sm font-semibold text-blue-600">MKD: {formatPercent(indicadores.markdownOferta?.atual)}</span>
        </>
      ),
      tipo: 'percent',
      indicador: 'pctVendasOferta'
    },
    qtdSkus: {
      borderColor: 'border-indigo-500',
      bgColor: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      icon: <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>,
      label: 'Produtos',
      title: 'SKUS VENDIDOS',
      getValue: () => formatNumber(indicadores.qtdSkus?.atual),
      tipo: 'number',
      indicador: 'qtdSkus'
    },
    qtdCupons: {
      borderColor: 'border-purple-500',
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
      icon: <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
      label: 'Vendas',
      title: 'CUPONS',
      getValue: () => formatNumber(indicadores.qtdCupons?.atual),
      tipo: 'number',
      indicador: 'qtdCupons'
    },
    qtdItens: {
      borderColor: 'border-pink-500',
      bgColor: 'bg-pink-100',
      iconColor: 'text-pink-600',
      icon: <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>,
      label: 'Quantidade',
      title: 'ITENS VENDIDOS',
      getValue: () => formatNumber(indicadores.qtdItens?.atual),
      tipo: 'number',
      indicador: 'qtdItens'
    },
    vendasOfertaValor: {
      borderColor: 'border-rose-500',
      bgColor: 'bg-rose-100',
      iconColor: 'text-rose-600',
      icon: <span className="text-xl">💰</span>,
      label: 'Oferta R$',
      title: 'VENDAS EM OFERTA',
      getValue: () => formatCurrency(indicadores.vendasOferta?.atual),
      tipo: 'currency',
      indicador: 'vendasOferta'
    },
    emBreve2: {
      borderColor: 'border-fuchsia-500',
      bgColor: 'bg-fuchsia-100',
      icon: <span className="text-xl">⚡</span>,
      label: 'Em breve',
      title: '-',
      getValue: () => '-',
      emBreve: true
    },
    custoVendas: {
      borderColor: 'border-red-500', bgColor: 'bg-red-100', iconColor: 'text-red-600',
      icon: <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
      label: 'Custo', title: 'CUSTO DAS VENDAS',
      getValue: () => formatCurrency(indicadores.custoVendas?.atual),
      tipo: 'currency', indicador: 'custoVendas', invertido: true
    },
    markdownOferta: {
      borderColor: 'border-pink-500', bgColor: 'bg-pink-100', iconColor: 'text-pink-600',
      icon: <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>,
      label: 'Oferta MKD', title: 'MARKDOWN EM OFERTA',
      getValue: () => formatPercent(indicadores.markdownOferta?.atual),
      tipo: 'percent', indicador: 'markdownOferta'
    },
    emBreve5: { borderColor: 'border-emerald-500', bgColor: 'bg-emerald-100', icon: <span className="text-xl">🔔</span>, label: 'Em breve', title: '-', getValue: () => '-', emBreve: true },
    emBreve6: { borderColor: 'border-violet-500', bgColor: 'bg-violet-100', icon: <span className="text-xl">📌</span>, label: 'Em breve', title: '-', getValue: () => '-', emBreve: true },
    emBreve7: { borderColor: 'border-amber-500', bgColor: 'bg-amber-100', icon: <span className="text-xl">🎯</span>, label: 'Em breve', title: '-', getValue: () => '-', emBreve: true },
    emBreve8: { borderColor: 'border-teal-500', bgColor: 'bg-teal-100', icon: <span className="text-xl">⭐</span>, label: 'Em breve', title: '-', getValue: () => '-', emBreve: true }
  };

  // Função para renderizar um card
  const renderCard = (cardId, row) => {
    const config = cardsConfig[cardId];
    if (!config) return null;

    const isDragging = draggedCard === cardId;

    if (config.emBreve) {
      return (
        <div
          key={cardId}
          draggable
          onDragStart={(e) => handleDragStart(e, cardId, row)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, cardId, row)}
          className={`bg-white rounded-xl shadow-lg p-4 border-t-4 ${config.borderColor} hover:shadow-xl transition-all cursor-grab active:cursor-grabbing h-full flex flex-col justify-between ${isDragging ? 'opacity-50 scale-95' : ''}`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center`}>
                {config.icon}
              </div>
              <span className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
                {config.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-400 mb-1">-</p>
            <p className="text-xs text-gray-500 mb-3">EM BREVE</p>
          </div>
          <div className="space-y-1 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-300">Indicador em desenvolvimento</p>
          </div>
        </div>
      );
    }

    const indicador = indicadores[config.indicador];
    const isExpanded = cardExpandido === cardId;

    return (
      <div
        key={cardId}
        draggable
        onDragStart={(e) => handleDragStart(e, cardId, row)}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, cardId, row)}
        onClick={() => setCardExpandido(isExpanded ? null : cardId)}
        className={`bg-white rounded-xl shadow-lg p-4 border-t-4 ${config.borderColor} hover:shadow-xl transition-all cursor-grab active:cursor-grabbing h-full ${isDragging ? 'opacity-50 scale-95' : ''} ${isExpanded ? 'ring-2 ring-orange-400 shadow-orange-200' : ''}`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center`}>
            {config.icon}
          </div>
          <span className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
            {config.label}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <p className="text-2xl font-bold text-gray-800">{config.getValue()}</p>
          {config.getExtra && config.getExtra()}
        </div>
        <p className="text-xs text-gray-500 mb-3">{config.title}</p>
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <Comparativo label="Mes Passado" valor={indicador?.mesPassado} valorAtual={indicador?.atual} tipo={config.tipo} invertido={config.invertido} />
          <Comparativo label="Ano Passado" valor={indicador?.anoPassado} valorAtual={indicador?.atual} tipo={config.tipo} invertido={config.invertido} />
          <Comparativo label="Media Linear" valor={indicador?.mediaLinear} valorAtual={indicador?.atual} tipo={config.tipo} invertido={config.invertido} />
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Header Laranja - Compacto */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg px-4 py-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <h1 className="text-lg font-bold text-white">Gestao Inteligente</h1>
              <span className="bg-white/20 text-white px-3 py-0.5 rounded-full text-xs font-medium ml-2">
                {formatPeriodo()}
              </span>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                className="bg-white rounded px-2 py-1 text-sm text-gray-700"
              />
              <span className="text-white text-sm">a</span>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                className="bg-white rounded px-2 py-1 text-sm text-gray-700"
              />
              <button
                onClick={handleClearCache}
                disabled={clearingCache}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                title="Atualizar dados"
              >
                {clearingCache ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Loading - Radar girando */}
        {loading && <RadarLoading message="Atualizando dados..." />}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Cards de Indicadores */}
        {!loading && !error && (
          <>
          {/* Linha 1 - Cards Principais (Drag and Drop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {cardOrder.map((cardId) => renderCard(cardId, 1))}
          </div>

          {/* Linha 2 - Cards Secundários (Drag and Drop) */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {cardOrder2.map((cardId) => renderCard(cardId, 2))}
          </div>

          {/* Linha 3 - Cards Terciários (Drag and Drop) */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {cardOrder3.map((cardId) => renderCard(cardId, 3))}
          </div>

          {/* Sub-cards: VENDAS expandido */}
          {cardExpandido === 'vendas' && (
          <>
          {/* Linha de Cards de Análise - Drag and Drop */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {analiseCardOrder.map((cardId) => {
              const cfg = analiseCardConfig[cardId];
              if (!cfg) return null;
              return (
                <div
                  key={cardId}
                  draggable
                  onDragStart={(e) => handleAnaliseCardDragStart(e, cardId)}
                  onDragEnd={handleAnaliseCardDragEnd}
                  onDragOver={handleAnaliseCardDragOver}
                  onDrop={(e) => handleAnaliseCardDrop(e, cardId)}
                  onClick={cfg.onClick}
                  className={`rounded-xl shadow-md p-4 border hover:shadow-lg transition-all cursor-pointer select-none ${
                    analiseAtiva === cardId ? cfg.active : cfg.inactive
                  } ${draggedAnaliseCard === cardId ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-9 h-9 ${cfg.icon} rounded-lg flex items-center justify-center`}>
                      <span className="text-lg">{cfg.emoji}</span>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${cfg.title}`}>{cfg.label}</p>
                  <p className={`text-[10px] ${cfg.sub} mt-1`}>{cfg.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Conteúdo das Análises */}
              {/* Tabela de Vendas por Dia da Semana - 3 sub-colunas por mês */}
              {analiseAtiva === 'vendas-dia-semana' && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Vendas por Dia da Semana</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAnoDiaSemanaChange(anoDiaSemana - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                      </button>
                      <span className="text-white font-bold text-lg min-w-[60px] text-center">{anoDiaSemana}</span>
                      <button
                        onClick={() => handleAnoDiaSemanaChange(anoDiaSemana + 1)}
                        disabled={anoDiaSemana >= new Date().getFullYear()}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors ${
                          anoDiaSemana >= new Date().getFullYear()
                            ? 'bg-white/10 cursor-not-allowed opacity-50'
                            : 'bg-white/20 hover:bg-white/30'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  {loadingVendasDiaSemana ? (
                    <RadarLoading size="sm" message="" />
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        {/* Header: nome do mês spanning 3 colunas */}
                        <tr className="bg-gray-100">
                          <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase border-b border-r border-gray-200 sticky left-0 bg-gray-100 min-w-[110px] z-10">Dia da Semana</th>
                          {mesesCompletos.map((mes) => {
                            const mesData = vendasDiaSemana.find(m => m.mesNum === mes.num);
                            const temDados = mesData && mesData.dias.some(d => d.totalVendas > 0);
                            return (
                              <th key={`ds-mh-${mes.num}`} colSpan={3} className={`px-1 py-2 text-center text-xs font-bold uppercase border-b border-r border-gray-300 ${
                                temDados ? 'text-gray-700 bg-gray-100' : 'text-gray-400 bg-gray-50'
                              }`}>
                                {mes.nome}
                              </th>
                            );
                          })}
                          <th colSpan={3} className="px-1 py-2 text-center text-xs font-bold uppercase border-b border-gray-300 text-orange-800 bg-orange-100">TOTAL</th>
                        </tr>
                        {/* Sub-header: Dias | Vendas | Média */}
                        <tr className="bg-gray-50">
                          {mesesCompletos.map((mes) => (
                            <Fragment key={`ds-sh-${mes.num}`}>
                              <th className="px-2 py-1 text-center text-[10px] font-semibold text-gray-500 border-b border-gray-200 min-w-[40px]">Dias</th>
                              <th className="px-2 py-1 text-center text-[10px] font-semibold text-gray-500 border-b border-gray-200 min-w-[110px]">Vendas</th>
                              <th className="px-2 py-1 text-center text-[10px] font-semibold text-gray-500 border-b border-r border-gray-300 min-w-[100px]">Média</th>
                            </Fragment>
                          ))}
                          <th className="px-2 py-1 text-center text-[10px] font-semibold text-orange-700 border-b border-gray-200 bg-orange-50 min-w-[40px]">Dias</th>
                          <th className="px-2 py-1 text-center text-[10px] font-semibold text-orange-700 border-b border-gray-200 bg-orange-50 min-w-[110px]">Vendas</th>
                          <th className="px-2 py-1 text-center text-[10px] font-semibold text-orange-700 border-b border-gray-200 bg-orange-50 min-w-[100px]">Média</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo', 'Feriado'].map((diaSemana, idx) => {
                          const totalAnoDias = vendasDiaSemana.reduce((acc, mes) => {
                            const d = mes.dias.find(dd => dd.diaSemana === diaSemana);
                            return acc + (d?.totalDias || 0);
                          }, 0);
                          const totalAnoVendas = vendasDiaSemana.reduce((acc, mes) => {
                            const d = mes.dias.find(dd => dd.diaSemana === diaSemana);
                            return acc + (d?.totalVendas || 0);
                          }, 0);
                          const totalAnoMedia = totalAnoDias > 0 ? totalAnoVendas / totalAnoDias : 0;

                          return (
                            <tr key={diaSemana} className={`hover:bg-orange-50/50 border-b border-gray-100 ${diaSemana === 'Feriado' ? 'bg-red-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                              <td className={`px-3 py-2 text-xs font-bold sticky left-0 border-r border-gray-200 z-10 ${
                                diaSemana === 'Feriado' ? 'text-red-700 bg-red-50' :
                                diaSemana === 'Domingo' ? 'text-orange-700' :
                                diaSemana === 'Sábado' ? 'text-blue-700' :
                                'text-gray-800'
                              } ${diaSemana !== 'Feriado' ? (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50') : ''}`}>
                                {diaSemana}
                              </td>
                              {mesesCompletos.map((mes) => {
                                const mesData = vendasDiaSemana.find(m => m.mesNum === mes.num);
                                const diaData = mesData ? mesData.dias.find(d => d.diaSemana === diaSemana) : null;
                                const dias = diaData?.totalDias || 0;
                                const vendas = diaData?.totalVendas || 0;
                                const media = diaData?.mediaVendas || 0;

                                return (
                                  <Fragment key={`ds-${diaSemana}-${mes.num}`}>
                                    <td className={`px-1 py-2 text-xs text-center ${dias > 0 ? 'text-gray-600' : 'text-gray-300'}`}>
                                      {dias > 0 ? dias : '-'}
                                    </td>
                                    <td className={`px-1 py-2 text-xs text-center font-medium ${vendas > 0 ? (diaSemana === 'Feriado' ? 'text-red-600' : 'text-gray-800') : 'text-gray-300'}`}>
                                      {vendas > 0 ? formatCurrency(vendas) : '-'}
                                    </td>
                                    <td className={`px-1 py-2 text-xs text-center border-r border-gray-200 ${media > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                                      {media > 0 ? formatCurrency(media) : '-'}
                                    </td>
                                  </Fragment>
                                );
                              })}
                              {/* TOTAL do ano */}
                              <td className="px-1 py-2 text-xs text-center font-bold text-orange-800 bg-orange-50/70">{totalAnoDias > 0 ? totalAnoDias : '-'}</td>
                              <td className="px-1 py-2 text-xs text-center font-bold text-orange-800 bg-orange-50/70">{totalAnoVendas > 0 ? formatCurrency(totalAnoVendas) : '-'}</td>
                              <td className="px-1 py-2 text-xs text-center font-bold text-emerald-700 bg-orange-50/70">{totalAnoMedia > 0 ? formatCurrency(totalAnoMedia) : '-'}</td>
                            </tr>
                          );
                        })}
                        {/* Linha TOTAL (soma de todos os dias da semana por mês) */}
                        <tr className="bg-orange-50 border-t-2 border-orange-300">
                          <td className="px-3 py-2 text-xs font-bold text-orange-800 sticky left-0 bg-orange-50 border-r border-gray-200 z-10">TOTAL</td>
                          {mesesCompletos.map((mes) => {
                            const mesData = vendasDiaSemana.find(m => m.mesNum === mes.num);
                            const totalDiasMes = mesData ? mesData.dias.reduce((acc, d) => acc + d.totalDias, 0) : 0;
                            const totalVendasMes = mesData ? mesData.dias.reduce((acc, d) => acc + d.totalVendas, 0) : 0;
                            const mediaMes = totalDiasMes > 0 ? totalVendasMes / totalDiasMes : 0;
                            return (
                              <Fragment key={`ds-total-${mes.num}`}>
                                <td className="px-1 py-2 text-xs text-center font-bold text-orange-800">{totalDiasMes > 0 ? totalDiasMes : '-'}</td>
                                <td className="px-1 py-2 text-xs text-center font-bold text-orange-800">{totalVendasMes > 0 ? formatCurrency(totalVendasMes) : '-'}</td>
                                <td className="px-1 py-2 text-xs text-center font-bold text-emerald-700 border-r border-gray-300">{mediaMes > 0 ? formatCurrency(mediaMes) : '-'}</td>
                              </Fragment>
                            );
                          })}
                          {/* TOTAL geral do ano */}
                          {(() => {
                            const totalGeralDias = vendasDiaSemana.reduce((acc, mes) => acc + mes.dias.reduce((a, d) => a + d.totalDias, 0), 0);
                            const totalGeralVendas = vendasDiaSemana.reduce((acc, mes) => acc + mes.dias.reduce((a, d) => a + d.totalVendas, 0), 0);
                            const mediaGeral = totalGeralDias > 0 ? totalGeralVendas / totalGeralDias : 0;
                            return (
                              <>
                                <td className="px-1 py-2 text-xs text-center font-bold text-orange-900 bg-orange-100">{totalGeralDias || '-'}</td>
                                <td className="px-1 py-2 text-xs text-center font-bold text-orange-900 bg-orange-100">{totalGeralVendas > 0 ? formatCurrency(totalGeralVendas) : '-'}</td>
                                <td className="px-1 py-2 text-xs text-center font-bold text-emerald-800 bg-orange-100">{mediaGeral > 0 ? formatCurrency(mediaGeral) : '-'}</td>
                              </>
                            );
                          })()}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              {/* Tabela de Vendas por Ano - Meses nas colunas, indicadores nas linhas */}
              {analiseAtiva === 'vendas-ano' && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Vendas por Ano</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAnoChange(anoSelecionado - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                      </button>
                      <span className="text-white font-bold text-lg min-w-[60px] text-center">{anoSelecionado}</span>
                      <button
                        onClick={() => handleAnoChange(anoSelecionado + 1)}
                        disabled={anoSelecionado >= new Date().getFullYear()}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors ${
                          anoSelecionado >= new Date().getFullYear()
                            ? 'bg-white/10 cursor-not-allowed opacity-50'
                            : 'bg-white/20 hover:bg-white/30'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  {loadingVendasAno ? (
                    <RadarLoading size="sm" message="" />
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 sticky left-0 bg-gray-100 min-w-[140px]">Indicador</th>
                          {mesesCompletos.map((mes) => (
                            <th key={`header-${mes.num}`} className={`px-2 py-3 text-center text-xs font-semibold uppercase border-b border-gray-200 min-w-[90px] ${
                              getDadosMes(mes.num).venda > 0 ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {mes.nome}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-center text-xs font-semibold text-orange-800 uppercase border-b border-gray-200 bg-orange-100 min-w-[100px]">{anoSelecionado}</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-blue-800 uppercase border-b border-gray-200 bg-blue-100 min-w-[100px]">{anoSelecionado - 1}</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-gray-800 uppercase border-b border-gray-200 bg-gray-300 min-w-[100px]">DIFERENÇA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Linha VENDA */}
                        <tr className="hover:bg-orange-50 bg-white border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-white">VENDA</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`venda-${mes.num}`} className={`px-2 py-3 text-sm text-center font-medium ${dados.venda > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                                {dados.venda > 0 ? formatCurrency(dados.venda) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-orange-800 bg-orange-50">
                            {formatCurrency(vendasAno.reduce((acc, m) => acc + m.venda, 0))}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-blue-800 bg-blue-50">
                            {anoAnteriorData ? formatCurrency(anoAnteriorData.venda) : '-'}
                          </td>
                          <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                            anoAnteriorData && (vendasAno.reduce((acc, m) => acc + m.venda, 0) - anoAnteriorData.venda) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {anoAnteriorData ? (
                              <>
                                {(vendasAno.reduce((acc, m) => acc + m.venda, 0) - anoAnteriorData.venda) >= 0 ? '+' : ''}
                                {formatCurrency(vendasAno.reduce((acc, m) => acc + m.venda, 0) - anoAnteriorData.venda)}
                              </>
                            ) : '-'}
                          </td>
                        </tr>
                        {/* Linha VENDAS EM OFERTA */}
                        <tr className="hover:bg-orange-50 bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-gray-50">VENDAS EM OFERTA</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`oferta-${mes.num}`} className={`px-2 py-3 text-sm text-center ${dados.venda > 0 ? 'text-rose-600' : 'text-gray-300'}`}>
                                {dados.venda > 0 ? (
                                  <>
                                    {formatCurrency(dados.vendasOferta)}
                                    <span className="text-xs text-gray-400 block">({formatPercent(dados.pctOferta)})</span>
                                  </>
                                ) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-rose-600 bg-orange-50">
                            {formatCurrency(vendasAno.reduce((acc, m) => acc + m.vendasOferta, 0))}
                            <span className="text-xs text-gray-400 block">
                              ({formatPercent(vendasAno.reduce((acc, m) => acc + m.venda, 0) > 0
                                ? (vendasAno.reduce((acc, m) => acc + m.vendasOferta, 0) / vendasAno.reduce((acc, m) => acc + m.venda, 0)) * 100
                                : 0)})
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-rose-600 bg-blue-50">
                            {anoAnteriorData ? (
                              <>
                                {formatCurrency(anoAnteriorData.vendasOferta)}
                                <span className="text-xs text-gray-400 block">({formatPercent(anoAnteriorData.pctOferta)})</span>
                              </>
                            ) : '-'}
                          </td>
                          <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                            anoAnteriorData && (vendasAno.reduce((acc, m) => acc + m.vendasOferta, 0) - anoAnteriorData.vendasOferta) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {anoAnteriorData ? (
                              <>
                                {(vendasAno.reduce((acc, m) => acc + m.vendasOferta, 0) - anoAnteriorData.vendasOferta) >= 0 ? '+' : ''}
                                {formatCurrency(vendasAno.reduce((acc, m) => acc + m.vendasOferta, 0) - anoAnteriorData.vendasOferta)}
                              </>
                            ) : '-'}
                          </td>
                        </tr>
                        {/* Linha LUCRO */}
                        <tr className="hover:bg-orange-50 bg-white border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-white">LUCRO</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`lucro-${mes.num}`} className={`px-2 py-3 text-sm text-center font-medium ${dados.venda > 0 ? 'text-cyan-600' : 'text-gray-300'}`}>
                                {dados.venda > 0 ? formatCurrency(dados.lucro) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-cyan-600 bg-orange-50">
                            {formatCurrency(vendasAno.reduce((acc, m) => acc + m.lucro, 0))}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-cyan-600 bg-blue-50">
                            {anoAnteriorData ? formatCurrency(anoAnteriorData.lucro) : '-'}
                          </td>
                          <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                            anoAnteriorData && (vendasAno.reduce((acc, m) => acc + m.lucro, 0) - anoAnteriorData.lucro) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {anoAnteriorData ? (
                              <>
                                {(vendasAno.reduce((acc, m) => acc + m.lucro, 0) - anoAnteriorData.lucro) >= 0 ? '+' : ''}
                                {formatCurrency(vendasAno.reduce((acc, m) => acc + m.lucro, 0) - anoAnteriorData.lucro)}
                              </>
                            ) : '-'}
                          </td>
                        </tr>
                        {/* Linha MARGEM */}
                        <tr className="hover:bg-orange-50 bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-gray-50">MARGEM</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`margem-${mes.num}`} className={`px-2 py-3 text-sm text-center font-medium ${
                                dados.venda > 0 ? 'text-green-600' : 'text-gray-300'
                              }`}>
                                {dados.venda > 0 ? formatPercent(dados.margem) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-green-600 bg-orange-50">
                            {formatPercent(
                              vendasAno.reduce((acc, m) => acc + m.venda, 0) > 0
                                ? (vendasAno.reduce((acc, m) => acc + m.lucro, 0) / vendasAno.reduce((acc, m) => acc + m.venda, 0)) * 100
                                : 0
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-green-600 bg-blue-50">
                            {anoAnteriorData ? formatPercent(anoAnteriorData.margem) : '-'}
                          </td>
                          {(() => {
                            const margemAtual = vendasAno.reduce((acc, m) => acc + m.venda, 0) > 0
                              ? (vendasAno.reduce((acc, m) => acc + m.lucro, 0) / vendasAno.reduce((acc, m) => acc + m.venda, 0)) * 100
                              : 0;
                            const diff = anoAnteriorData ? margemAtual - anoAnteriorData.margem : 0;
                            return (
                              <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                                diff >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {anoAnteriorData ? (
                                  <>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(2).replace('.', ',')}%
                                  </>
                                ) : '-'}
                              </td>
                            );
                          })()}
                        </tr>
                        {/* Linha MARGEM LIQUIDA */}
                        <tr className="hover:bg-orange-50 bg-white border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-white">MARGEM LIQUIDA</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`margemLiq-${mes.num}`} className={`px-2 py-3 text-sm text-center font-medium ${
                                dados.venda > 0 ? 'text-yellow-600' : 'text-gray-300'
                              }`}>
                                {dados.venda > 0 ? formatPercent(dados.margemLiquida) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-yellow-600 bg-orange-50">
                            {(() => {
                              const totalVenda = vendasAno.reduce((acc, m) => acc + m.venda, 0);
                              const totalLucro = vendasAno.reduce((acc, m) => acc + m.lucro, 0);
                              // Média ponderada pela venda de cada mês
                              const somaMargemPonderada = vendasAno.reduce((acc, m) => acc + (m.margemLiquida * m.venda), 0);
                              return totalVenda > 0 ? formatPercent(somaMargemPonderada / totalVenda) : '-';
                            })()}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-yellow-600 bg-blue-50">
                            {anoAnteriorData ? formatPercent(anoAnteriorData.margemLiquida) : '-'}
                          </td>
                          {(() => {
                            const totalVenda = vendasAno.reduce((acc, m) => acc + m.venda, 0);
                            const somaMargemPonderada = vendasAno.reduce((acc, m) => acc + (m.margemLiquida * m.venda), 0);
                            const margemAtual = totalVenda > 0 ? somaMargemPonderada / totalVenda : 0;
                            const diff = anoAnteriorData ? margemAtual - anoAnteriorData.margemLiquida : 0;
                            return (
                              <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                                diff >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {anoAnteriorData ? (
                                  <>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(2).replace('.', ',')}%
                                  </>
                                ) : '-'}
                              </td>
                            );
                          })()}
                        </tr>
                        {/* Linha TICKET MEDIO */}
                        <tr className="hover:bg-orange-50 bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-gray-50">TICKET MEDIO</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`ticket-${mes.num}`} className={`px-2 py-3 text-sm text-center font-medium ${dados.venda > 0 ? 'text-orange-600' : 'text-gray-300'}`}>
                                {dados.venda > 0 ? formatCurrency(dados.ticketMedio) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-orange-600 bg-orange-50">
                            {(() => {
                              // Média dos tickets (soma ponderada pela quantidade de vendas)
                              const mesesComVenda = vendasAno.filter(m => m.venda > 0);
                              if (mesesComVenda.length === 0) return '-';
                              const somaTickets = mesesComVenda.reduce((acc, m) => acc + m.ticketMedio, 0);
                              return formatCurrency(somaTickets / mesesComVenda.length);
                            })()}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-orange-600 bg-blue-50">
                            {anoAnteriorData ? formatCurrency(anoAnteriorData.ticketMedio) : '-'}
                          </td>
                          {(() => {
                            const mesesComVenda = vendasAno.filter(m => m.venda > 0);
                            const ticketAtual = mesesComVenda.length > 0
                              ? mesesComVenda.reduce((acc, m) => acc + m.ticketMedio, 0) / mesesComVenda.length
                              : 0;
                            const diff = anoAnteriorData ? ticketAtual - anoAnteriorData.ticketMedio : 0;
                            return (
                              <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                                diff >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {anoAnteriorData ? (
                                  <>
                                    {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                                  </>
                                ) : '-'}
                              </td>
                            );
                          })()}
                        </tr>
                        {/* Linha SKUS VENDIDOS */}
                        <tr className="hover:bg-orange-50 bg-white border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-white">SKUS VENDIDOS</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`skus-${mes.num}`} className={`px-2 py-3 text-sm text-center ${dados.venda > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                                {dados.venda > 0 ? formatNumber(dados.skus || 0) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-indigo-600 bg-orange-50">
                            {formatNumber(Math.max(...vendasAno.map(m => m.skus || 0)))}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-indigo-600 bg-blue-50">
                            {anoAnteriorData ? formatNumber(anoAnteriorData.skus) : '-'}
                          </td>
                          {(() => {
                            const skusAtual = Math.max(...vendasAno.map(m => m.skus || 0));
                            const diff = anoAnteriorData ? skusAtual - anoAnteriorData.skus : 0;
                            return (
                              <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                                diff >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {anoAnteriorData ? (
                                  <>
                                    {diff >= 0 ? '+' : ''}{formatNumber(diff)}
                                  </>
                                ) : '-'}
                              </td>
                            );
                          })()}
                        </tr>
                        {/* Linha CUPONS */}
                        <tr className="hover:bg-orange-50 bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-gray-50">CUPONS</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`cupons-${mes.num}`} className={`px-2 py-3 text-sm text-center ${dados.venda > 0 ? 'text-purple-600' : 'text-gray-300'}`}>
                                {dados.venda > 0 ? formatNumber(dados.cupons || 0) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-purple-600 bg-orange-50">
                            {formatNumber(vendasAno.reduce((acc, m) => acc + (m.cupons || 0), 0))}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-purple-600 bg-blue-50">
                            {anoAnteriorData ? formatNumber(anoAnteriorData.cupons) : '-'}
                          </td>
                          {(() => {
                            const cuponsAtual = vendasAno.reduce((acc, m) => acc + (m.cupons || 0), 0);
                            const diff = anoAnteriorData ? cuponsAtual - anoAnteriorData.cupons : 0;
                            return (
                              <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                                diff >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {anoAnteriorData ? (
                                  <>
                                    {diff >= 0 ? '+' : ''}{formatNumber(diff)}
                                  </>
                                ) : '-'}
                              </td>
                            );
                          })()}
                        </tr>
                        {/* Linha ITENS VENDIDOS */}
                        <tr className="hover:bg-orange-50 bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-gray-50">ITENS VENDIDOS</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`itens-${mes.num}`} className={`px-2 py-3 text-sm text-center ${dados.venda > 0 ? 'text-gray-600' : 'text-gray-300'}`}>
                                {dados.venda > 0 ? formatNumber(dados.itensVendidos) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-gray-600 bg-orange-50">
                            {formatNumber(vendasAno.reduce((acc, m) => acc + m.itensVendidos, 0))}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-gray-600 bg-blue-50">
                            {anoAnteriorData ? formatNumber(anoAnteriorData.itensVendidos) : '-'}
                          </td>
                          {(() => {
                            const itensAtual = vendasAno.reduce((acc, m) => acc + m.itensVendidos, 0);
                            const diff = anoAnteriorData ? itensAtual - anoAnteriorData.itensVendidos : 0;
                            return (
                              <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                                diff >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {anoAnteriorData ? (
                                  <>
                                    {diff >= 0 ? '+' : ''}{formatNumber(diff)}
                                  </>
                                ) : '-'}
                              </td>
                            );
                          })()}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              {/* Tabela de Vendas por Setor - Hierárquica */}
              {/* Tabela de Vendas Analíticas por Setor */}
              {analiseAtiva === 'vendas-analiticas' && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3">
                    <h3 className="text-white font-semibold">Vendas Analíticas - {formatPeriodo()}</h3>
                  </div>
                  {loadingVendasAnaliticas ? (
                    <RadarLoading size="sm" message="" />
                  ) : vendasAnaliticas.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-200">
                            <th rowSpan={2} className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase border-b border-r border-gray-300 min-w-[200px] sticky left-0 bg-gray-200 z-10">Setor / Grupo / Subgrupo / Item</th>
                            <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase border-b border-r border-gray-300 bg-orange-50">Vendas</th>
                            <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-cyan-700 uppercase border-b border-r border-gray-300 bg-cyan-50">Lucro</th>
                            <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-purple-700 uppercase border-b border-r border-gray-300 bg-purple-50">Markdown</th>
                            <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-emerald-700 uppercase border-b border-gray-300 bg-emerald-50">Margem Limpa</th>
                          </tr>
                          <tr className="bg-gray-100">
                            {/* Vendas sub-headers */}
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[120px]">Atual</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-blue-600 uppercase border-b border-gray-200 min-w-[120px]">Méd.Linear</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[120px]">Ano Ant.</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-r border-gray-300 min-w-[120px]">Mês Ant.</th>
                            {/* Lucro sub-headers */}
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[120px]">Atual</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-blue-600 uppercase border-b border-gray-200 min-w-[120px]">Méd.Linear</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[120px]">Ano Ant.</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-r border-gray-300 min-w-[120px]">Mês Ant.</th>
                            {/* Markdown sub-headers */}
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[90px]">Atual</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-blue-600 uppercase border-b border-gray-200 min-w-[90px]">Méd.Linear</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[90px]">Ano Ant.</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-r border-gray-300 min-w-[90px]">Mês Ant.</th>
                            {/* Margem Limpa sub-headers */}
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[90px]">Atual</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-blue-600 uppercase border-b border-gray-200 min-w-[90px]">Méd.Linear</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[90px]">Ano Ant.</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[90px]">Mês Ant.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vendasAnaliticas.map((setor, index) => {
                            const secExpanded = expandedAnaliticaSecoes[setor.codSecao];
                            const renderAnaliticaCells = (d, sz = 'text-sm') => (<>
                              <td className={`px-3 py-2 ${sz} text-right font-bold text-gray-800`}>{formatCurrency(d.vendaAtual)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold ${d.vendaAtual >= d.mediaLinear ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(d.mediaLinear)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold ${d.vendaAtual >= d.vendaAnoPassado ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(d.vendaAnoPassado)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold border-r border-gray-200 ${d.vendaAtual >= d.vendaMesPassado ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(d.vendaMesPassado)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-bold text-gray-800`}>{formatCurrency(d.lucroAtual)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold ${d.lucroAtual >= d.lucroMediaLinear ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(d.lucroMediaLinear)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold ${d.lucroAtual >= d.lucroAnoPassado ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(d.lucroAnoPassado)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold border-r border-gray-200 ${d.lucroAtual >= d.lucroMesPassado ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(d.lucroMesPassado)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-bold text-gray-800`}>{formatPercent(d.markdownAtual)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold ${d.markdownAtual >= d.markdownMediaLinear ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(d.markdownMediaLinear)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold ${d.markdownAtual >= d.markdownAnoPassado ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(d.markdownAnoPassado)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold border-r border-gray-200 ${d.markdownAtual >= d.markdownMesPassado ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(d.markdownMesPassado)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-bold text-gray-800`}>{formatPercent(d.margemLimpaAtual)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold ${d.margemLimpaAtual >= d.margemLimpaMediaLinear ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(d.margemLimpaMediaLinear)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold ${d.margemLimpaAtual >= d.margemLimpaAnoPassado ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(d.margemLimpaAnoPassado)}</td>
                              <td className={`px-3 py-2 ${sz} text-right font-semibold ${d.margemLimpaAtual >= d.margemLimpaMesPassado ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(d.margemLimpaMesPassado)}</td>
                            </>);
                            return (
                            <Fragment key={`analitica-${setor.codSecao || index}`}>
                              {/* Nível 1: Seção */}
                              <tr className={`hover:bg-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} border-b border-gray-100`}>
                                <td className="px-4 py-2 text-sm font-semibold text-gray-800 sticky left-0 z-10" style={{ backgroundColor: index % 2 === 0 ? '#f9fafb' : '#fff' }}>
                                  <button onClick={() => toggleAnaliticaSecao(setor.codSecao)} className="flex items-center gap-2 font-semibold text-gray-800">
                                    <span className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors ${secExpanded ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                      {secExpanded?.loading ? '...' : secExpanded ? '−' : '+'}
                                    </span>
                                    {setor.setor}
                                  </button>
                                </td>
                                {renderAnaliticaCells(setor)}
                              </tr>

                              {/* Nível 2: Grupos */}
                              {secExpanded?.data?.map((grupo, gIdx) => {
                                const grupoKey = `${setor.codSecao}_${grupo.codGrupo}`;
                                const grpExpanded = expandedAnaliticaGrupos[grupoKey];
                                return (
                                <Fragment key={`ag-${grupoKey}`}>
                                  <tr className={`hover:bg-gray-100 ${gIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
                                    <td className="px-4 py-2 text-sm text-gray-700 pl-10 sticky left-0 z-10 bg-white">
                                      <button onClick={() => toggleAnaliticaGrupo(grupo.codGrupo, setor.codSecao)} className="flex items-center gap-2 font-medium text-gray-700">
                                        <span className={`w-4 h-4 flex items-center justify-center rounded text-xs font-bold transition-colors ${grpExpanded ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                          {grpExpanded?.loading ? '.' : grpExpanded ? '−' : '+'}
                                        </span>
                                        {grupo.grupo}
                                      </button>
                                    </td>
                                    {renderAnaliticaCells(grupo)}
                                  </tr>

                                  {/* Nível 3: Subgrupos */}
                                  {grpExpanded?.data?.map((sub, sgIdx) => {
                                    const subKey = `${setor.codSecao}_${grupo.codGrupo}_${sub.codSubgrupo}`;
                                    const subExpanded = expandedAnaliticaSubgrupos[subKey];
                                    return (
                                    <Fragment key={`asg-${subKey}`}>
                                      <tr className={`hover:bg-gray-100 ${sgIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
                                        <td className="px-4 py-2 text-sm text-gray-600 pl-16 sticky left-0 z-10 bg-white">
                                          <button onClick={() => toggleAnaliticaSubgrupo(sub.codSubgrupo, grupo.codGrupo, setor.codSecao)} className="flex items-center gap-2 text-gray-600">
                                            <span className={`w-4 h-4 flex items-center justify-center rounded text-xs font-bold transition-colors ${subExpanded ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                              {subExpanded?.loading ? '.' : subExpanded ? '−' : '+'}
                                            </span>
                                            {sub.subgrupo}
                                          </button>
                                        </td>
                                        {renderAnaliticaCells(sub)}
                                      </tr>

                                      {/* Nível 4: Itens */}
                                      {subExpanded?.data?.map((item, iIdx) => (
                                        <tr key={`ai-${item.codProduto || iIdx}`} className={`hover:bg-amber-100 ${iIdx % 2 === 0 ? 'bg-amber-50/50' : 'bg-amber-50'} border-b border-amber-100/50`}>
                                          <td className="px-4 py-1.5 text-xs text-gray-500 pl-24 sticky left-0 z-10 bg-amber-50/50">
                                            <span className="flex items-center gap-2">
                                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                              {item.produto}
                                            </span>
                                          </td>
                                          {renderAnaliticaCells(item, 'text-xs')}
                                        </tr>
                                      ))}
                                    </Fragment>);
                                  })}
                                </Fragment>);
                              })}
                            </Fragment>);
                          })}
                        </tbody>
                        <tfoot className="bg-gray-200">
                          <tr>
                            <td className="px-4 py-2 text-sm font-bold text-gray-800 sticky left-0 bg-gray-200 z-10">TOTAL</td>
                            {/* Totais Vendas */}
                            {(() => {
                              const tAtual = vendasAnaliticas.reduce((acc, s) => acc + s.vendaAtual, 0);
                              const tML = vendasAnaliticas.reduce((acc, s) => acc + s.mediaLinear, 0);
                              const tAP = vendasAnaliticas.reduce((acc, s) => acc + s.vendaAnoPassado, 0);
                              const tMP = vendasAnaliticas.reduce((acc, s) => acc + s.vendaMesPassado, 0);
                              return (<>
                                <td className="px-3 py-2 text-sm text-right font-bold text-gray-800">{formatCurrency(tAtual)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${tAtual >= tML ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(tML)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${tAtual >= tAP ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(tAP)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold border-r border-gray-300 ${tAtual >= tMP ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(tMP)}</td>
                              </>);
                            })()}
                            {/* Totais Lucro */}
                            {(() => {
                              const tAtual = vendasAnaliticas.reduce((acc, s) => acc + (s.lucroAtual || 0), 0);
                              const tML = vendasAnaliticas.reduce((acc, s) => acc + (s.lucroMediaLinear || 0), 0);
                              const tAP = vendasAnaliticas.reduce((acc, s) => acc + (s.lucroAnoPassado || 0), 0);
                              const tMP = vendasAnaliticas.reduce((acc, s) => acc + (s.lucroMesPassado || 0), 0);
                              return (<>
                                <td className="px-3 py-2 text-sm text-right font-bold text-gray-800">{formatCurrency(tAtual)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${tAtual >= tML ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(tML)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${tAtual >= tAP ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(tAP)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold border-r border-gray-300 ${tAtual >= tMP ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(tMP)}</td>
                              </>);
                            })()}
                            {/* Totais Markdown (média ponderada) */}
                            {(() => {
                              const calcMkd = (vendaKey, lucroKey) => {
                                const v = vendasAnaliticas.reduce((acc, s) => acc + (s[vendaKey] || 0), 0);
                                const c = vendasAnaliticas.reduce((acc, s) => acc + ((s[vendaKey] || 0) - (s[lucroKey] || 0)), 0);
                                return v > 0 ? ((v - c) / v) * 100 : 0;
                              };
                              const mkdAtual = calcMkd('vendaAtual', 'lucroAtual');
                              const mkdML = calcMkd('mediaLinear', 'lucroMediaLinear');
                              const mkdAP = calcMkd('vendaAnoPassado', 'lucroAnoPassado');
                              const mkdMP = calcMkd('vendaMesPassado', 'lucroMesPassado');
                              return (<>
                                <td className="px-3 py-2 text-sm text-right font-bold text-gray-800">{formatPercent(mkdAtual)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${mkdAtual >= mkdML ? 'text-green-700' : 'text-red-700'}`}>{formatPercent(mkdML)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${mkdAtual >= mkdAP ? 'text-green-700' : 'text-red-700'}`}>{formatPercent(mkdAP)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold border-r border-gray-300 ${mkdAtual >= mkdMP ? 'text-green-700' : 'text-red-700'}`}>{formatPercent(mkdMP)}</td>
                              </>);
                            })()}
                            {/* Totais Margem Limpa */}
                            <td className="px-3 py-2 text-sm text-right font-bold text-gray-800">-</td>
                            <td className="px-3 py-2 text-sm text-right font-bold text-gray-800">-</td>
                            <td className="px-3 py-2 text-sm text-right font-bold text-gray-800">-</td>
                            <td className="px-3 py-2 text-sm text-right font-bold text-gray-800">-</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">Nenhum dado encontrado para o período selecionado</div>
                  )}
                </div>
              )}

              {analiseAtiva === 'vendas-setor' && dadosAnalise.length > 0 && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3">
                    <h3 className="text-white font-semibold">Vendas por Setor - {formatPeriodo()}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Setor / Grupo / Subgrupo / Item</th>
                          {colOrder.map((colId) => {
                            const col = colDefs[colId];
                            if (!col) return null;
                            return (
                              <th
                                key={colId}
                                draggable
                                onDragStart={(e) => handleColDragStart(e, colId)}
                                onDragEnd={handleColDragEnd}
                                onDragOver={handleColDragOver}
                                onDrop={(e) => handleColDrop(e, colId)}
                                className={`px-4 py-3 text-right text-xs font-semibold ${col.headerClass} uppercase border-b border-gray-200 cursor-grab active:cursor-grabbing select-none ${draggedCol === colId ? 'opacity-50 bg-blue-100' : 'hover:bg-gray-200'}`}
                                title="Arraste para reordenar"
                              >
                                {col.label}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {dadosAnalise.map((secao, index) => (
                          <Fragment key={`secao-${secao.codSecao || index}`}>
                            {/* Linha da Seção (Nível 1) */}
                            <tr className={`hover:bg-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} border-b border-gray-100`}>
                              <td className="px-4 py-3 text-sm text-gray-800">
                                <button
                                  onClick={() => toggleSecao(secao.codSecao)}
                                  className="flex items-center gap-2 font-semibold text-gray-800"
                                >
                                  <span className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors ${expandedSecoes[secao.codSecao] ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                    {expandedSecoes[secao.codSecao]?.loading ? '...' : expandedSecoes[secao.codSecao] ? '−' : '+'}
                                  </span>
                                  {secao.setor}
                                </button>
                              </td>
                              {colOrder.map((colId) => {
                                const col = colDefs[colId];
                                if (!col) return null;
                                const r = col.renderSetor(secao);
                                return <td key={colId} className={`px-4 py-3 text-sm text-right ${r.cls}`}>{r.val}</td>;
                              })}
                            </tr>

                            {/* Linhas dos Grupos (Nível 2) */}
                            {expandedSecoes[secao.codSecao]?.grupos?.map((grupo, gIndex) => (
                              <Fragment key={`grupo-${grupo.codGrupo || gIndex}`}>
                                <tr className={`hover:bg-gray-100 ${gIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
                                  <td className="px-4 py-2 text-sm text-gray-700 pl-10">
                                    <button
                                      onClick={() => toggleGrupo(grupo.codGrupo, secao.codSecao)}
                                      className="flex items-center gap-2 font-medium text-gray-700"
                                    >
                                      <span className={`w-4 h-4 flex items-center justify-center rounded text-xs font-bold transition-colors ${expandedGrupos[grupo.codGrupo] ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                        {expandedGrupos[grupo.codGrupo]?.loading ? '.' : expandedGrupos[grupo.codGrupo] ? '−' : '+'}
                                      </span>
                                      {grupo.grupo}
                                    </button>
                                  </td>
                                  {colOrder.map((colId) => {
                                    const col = colDefs[colId];
                                    if (!col) return null;
                                    const r = col.renderGrupo(grupo);
                                    return <td key={colId} className={`px-4 py-2 text-sm text-right ${r.cls}`}>{r.val}</td>;
                                  })}
                                </tr>

                                {/* Linhas dos Subgrupos (Nível 3) */}
                                {expandedGrupos[grupo.codGrupo]?.subgrupos?.map((subgrupo, sgIndex) => (
                                  <Fragment key={`subgrupo-${subgrupo.codSubgrupo || sgIndex}`}>
                                    <tr className={`hover:bg-gray-100 ${sgIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
                                      <td className="px-4 py-2 text-sm text-gray-600 pl-16">
                                        <button
                                          onClick={() => toggleSubgrupo(subgrupo.codSubgrupo, grupo.codGrupo, secao.codSecao)}
                                          className="flex items-center gap-2 text-gray-600"
                                        >
                                          <span className={`w-4 h-4 flex items-center justify-center rounded text-xs font-bold transition-colors ${expandedSubgrupos[subgrupo.codSubgrupo] ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                            {expandedSubgrupos[subgrupo.codSubgrupo]?.loading ? '.' : expandedSubgrupos[subgrupo.codSubgrupo] ? '−' : '+'}
                                          </span>
                                          {subgrupo.subgrupo}
                                        </button>
                                      </td>
                                      {colOrder.map((colId) => {
                                        const col = colDefs[colId];
                                        if (!col) return null;
                                        const r = col.renderSub(subgrupo);
                                        return <td key={colId} className={`px-4 py-2 text-sm text-right ${r.cls}`}>{r.val}</td>;
                                      })}
                                    </tr>

                                    {/* Linhas dos Itens (Nível 4) */}
                                    {expandedSubgrupos[subgrupo.codSubgrupo]?.itens?.map((item, iIndex) => (
                                      <tr key={`item-${item.codProduto || iIndex}`} className={`hover:bg-amber-100 ${iIndex % 2 === 0 ? 'bg-amber-50/50' : 'bg-amber-50'} border-b border-amber-100/50`}>
                                        <td className="px-4 py-1.5 text-xs text-gray-500 pl-24">
                                          <span className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                            {item.produto}
                                          </span>
                                        </td>
                                        {colOrder.map((colId) => {
                                          const col = colDefs[colId];
                                          if (!col) return null;
                                          const r = col.renderItem(item);
                                          return <td key={colId} className={`px-4 py-1.5 text-xs text-right ${r.cls}`}>{r.val}</td>;
                                        })}
                                      </tr>
                                    ))}
                                  </Fragment>
                                ))}
                              </Fragment>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-200">
                        <tr>
                          <td className="px-4 py-3 text-sm font-bold text-gray-800">TOTAL</td>
                          {colOrder.map((colId) => {
                            const col = colDefs[colId];
                            if (!col) return null;
                            const r = col.renderTotal(dadosAnalise);
                            return <td key={colId} className={`px-4 py-3 text-sm text-right ${r.cls}`}>{r.val}</td>;
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== VENDAS POR SETOR ANUAL ===== */}
              {analiseAtiva === 'vendas-setor-anual' && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Vendas por Setor Anual</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleAnoSetorAnualChange(anoSetorAnual - 1)} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                      </button>
                      <span className="text-white font-bold text-lg min-w-[60px] text-center">{anoSetorAnual}</span>
                      <button onClick={() => handleAnoSetorAnualChange(anoSetorAnual + 1)} disabled={anoSetorAnual >= new Date().getFullYear()} className={`w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors ${anoSetorAnual >= new Date().getFullYear() ? 'bg-white/10 cursor-not-allowed opacity-50' : 'bg-white/20 hover:bg-white/30'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  </div>
                  {loadingVendasSetorAnual ? (
                    <RadarLoading size="sm" message="" />
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 sticky left-0 bg-gray-100 min-w-[160px]">Setor</th>
                          {mesesCompletos.map((mes) => (
                            <th key={`sa-h-${mes.num}`} className="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 min-w-[90px]">{mes.nome}</th>
                          ))}
                          <th className="px-3 py-3 text-center text-xs font-semibold text-orange-800 uppercase border-b border-gray-200 bg-orange-100 min-w-[100px]">{anoSetorAnual}</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-blue-800 uppercase border-b border-gray-200 bg-blue-100 min-w-[100px]">{anoSetorAnual - 1}</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-gray-800 uppercase border-b border-gray-200 bg-gray-300 min-w-[100px]">DIFERENÇA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendasSetorAnual.map((s, idx) => {
                          const isExp = expandedSetoresAnual[s.codSecao];
                          const diff = s.total.venda - (s.anoAnterior?.venda || 0);
                          return (
                            <Fragment key={s.codSecao}>
                              <tr className={`hover:bg-orange-50 cursor-pointer border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`} onClick={() => setExpandedSetoresAnual(prev => ({ ...prev, [s.codSecao]: !prev[s.codSecao] }))}>
                                <td className={`px-3 py-2.5 text-sm font-semibold text-gray-800 sticky left-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                  <span className={`inline-block mr-1 transition-transform ${isExp ? 'rotate-90' : ''}`}>▸</span>
                                  {s.setor}
                                </td>
                                {mesesCompletos.map((mes) => {
                                  const v = s.meses[mes.num]?.venda || 0;
                                  return <td key={`sa-v-${s.codSecao}-${mes.num}`} className={`px-2 py-2.5 text-xs text-center font-medium ${v > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{v > 0 ? formatCurrency(v) : '-'}</td>;
                                })}
                                <td className="px-3 py-2.5 text-xs text-center font-bold text-orange-800 bg-orange-50">{formatCurrency(s.total.venda)}</td>
                                <td className="px-3 py-2.5 text-xs text-center font-bold text-blue-800 bg-blue-50">{s.anoAnterior ? formatCurrency(s.anoAnterior.venda) : '-'}</td>
                                <td className={`px-3 py-2.5 text-xs text-center font-bold bg-gray-200 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {s.anoAnterior ? <>{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</> : '-'}
                                </td>
                              </tr>
                              {isExp && [
                                { key: 'oferta', label: 'Vendas Oferta', field: 'vendasOferta', color: 'text-rose-600', fmt: formatCurrency },
                                { key: 'lucro', label: 'Lucro', field: 'lucro', color: 'text-cyan-600', fmt: formatCurrency },
                                { key: 'margem', label: 'Markdown', field: 'margem', color: 'text-purple-600', fmt: formatPercent },
                                { key: 'pctOferta', label: 'Markdown em Oferta', field: 'pctOferta', color: 'text-pink-600', fmt: formatPercent },
                                { key: 'ticket', label: 'Ticket Médio', field: 'ticketMedio', color: 'text-amber-600', fmt: formatCurrency },
                                { key: 'skus', label: 'SKUs', field: 'skus', color: 'text-blue-600', fmt: (v) => v?.toLocaleString('pt-BR') || '0' },
                                { key: 'cupons', label: 'Cupons', field: 'cupons', color: 'text-indigo-600', fmt: (v) => v?.toLocaleString('pt-BR') || '0' },
                                { key: 'itens', label: 'Itens Vendidos', field: 'itensVendidos', color: 'text-teal-600', fmt: (v) => v?.toLocaleString('pt-BR') || '0' },
                              ].map((sub) => (
                                <tr key={`sa-sub-${s.codSecao}-${sub.key}`} className="bg-gray-50/50 border-b border-gray-50">
                                  <td className="px-3 py-1.5 text-xs text-gray-500 sticky left-0 bg-gray-50/50 pl-8">{sub.label}</td>
                                  {mesesCompletos.map((mes) => {
                                    const d = s.meses[mes.num];
                                    const v = d ? d[sub.field] : 0;
                                    return <td key={`sa-${s.codSecao}-${sub.key}-${mes.num}`} className={`px-2 py-1.5 text-xs text-center ${v ? sub.color : 'text-gray-300'}`}>{v ? sub.fmt(v) : '-'}</td>;
                                  })}
                                  <td className={`px-3 py-1.5 text-xs text-center font-semibold ${sub.color} bg-orange-50`}>{sub.fmt(s.total[sub.field])}</td>
                                  <td className={`px-3 py-1.5 text-xs text-center font-semibold ${sub.color} bg-blue-50`}>{s.anoAnterior ? sub.fmt(s.anoAnterior[sub.field]) : '-'}</td>
                                  {(() => {
                                    const curr = s.total[sub.field] || 0;
                                    const prev = s.anoAnterior?.[sub.field] || 0;
                                    const d2 = curr - prev;
                                    if (sub.field === 'margem') {
                                      return <td className={`px-3 py-1.5 text-xs text-center font-semibold bg-gray-200 ${d2 >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.anoAnterior ? <>{d2 >= 0 ? '+' : ''}{d2.toFixed(2).replace('.', ',')}%</> : '-'}</td>;
                                    }
                                    return <td className={`px-3 py-1.5 text-xs text-center font-semibold bg-gray-200 ${d2 >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.anoAnterior ? <>{d2 >= 0 ? '+' : ''}{sub.fmt(d2)}</> : '-'}</td>;
                                  })()}
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}
          </>
          )}

          {/* Sub-cards: Outros cards expandidos (Em Breve) */}
          {cardExpandido && cardExpandido !== 'vendas' && !cardsConfig[cardExpandido]?.emBreve && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { emoji: '📊', bg: 'bg-rose-50', border: 'border-rose-200', iconBg: 'bg-rose-200', titleCls: 'text-rose-400', subCls: 'text-rose-300' },
                { emoji: '📈', bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-200', titleCls: 'text-amber-400', subCls: 'text-amber-300' },
                { emoji: '📉', bg: 'bg-teal-50', border: 'border-teal-200', iconBg: 'bg-teal-200', titleCls: 'text-teal-400', subCls: 'text-teal-300' },
                { emoji: '🔍', bg: 'bg-indigo-50', border: 'border-indigo-200', iconBg: 'bg-indigo-200', titleCls: 'text-indigo-400', subCls: 'text-indigo-300' },
                { emoji: '⚡', bg: 'bg-pink-50', border: 'border-pink-200', iconBg: 'bg-pink-200', titleCls: 'text-pink-400', subCls: 'text-pink-300' },
              ].map((item, i) => (
                <div key={i} className={`rounded-xl shadow-md p-4 border ${item.bg} ${item.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-9 h-9 ${item.iconBg} rounded-lg flex items-center justify-center`}>
                      <span className="text-lg">{item.emoji}</span>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${item.titleCls}`}>Em Breve</p>
                  <p className={`text-[10px] ${item.subCls} mt-1`}>Funcionalidade em desenvolvimento</p>
                </div>
              ))}
            </div>
          )}
          </>
        )}

        {/* Informativo do Cache */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Os dados sao atualizados automaticamente a cada 5 minutos. Clique em "Atualizar" para forcar uma nova consulta.
          </p>
        </div>
      </div>
    </Layout>
  );
}
