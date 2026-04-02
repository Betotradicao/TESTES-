import { useState, useEffect, Fragment, useMemo } from 'react';
import Layout from '../components/Layout';
import RadarLoading from '../components/RadarLoading';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

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
  markdownOferta: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  excessoCompras: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  excessoComprasRs: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  margemCV: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 }
};

export default function GestaoInteligente() {
  const [indicadores, setIndicadores] = useState(initialIndicadores);
  const [produtosRevenda, setProdutosRevenda] = useState({ qtdProdutos: 0, valorEstoque: 0, qtdProducao: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(getDefaultDates());
  const [clearingCache, setClearingCache] = useState(false);
  const [modoVisao, setModoVisao] = useState('ataque'); // 'ataque' | 'defesa'
  const [tipoVenda, setTipoVenda] = useState({
    pdv: true,
    combustivel: true,
    vendaBalcao: true,
    ecommerce: true,
    nfCliente: true,
    nfTransferencia: true
  });
  const [defesaData, setDefesaData] = useState({
    naoBipados: { valor: 0, pct: 0, total: 0 },
    furtos: { valor: 0, qtd: 0 },
    loadingDefesa: false
  });
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
  const [showGraficoAno, setShowGraficoAno] = useState(true);
  const [graficoMetricaAno, setGraficoMetricaAno] = useState('venda');

  // Estado para vendas por dia da semana
  const [vendasDiaSemana, setVendasDiaSemana] = useState([]);
  const [loadingVendasDiaSemana, setLoadingVendasDiaSemana] = useState(false);
  const [anoDiaSemana, setAnoDiaSemana] = useState(new Date().getFullYear());

  // Estado para vendas dia a dia
  const [vendasDiaDia, setVendasDiaDia] = useState(null);
  const [loadingDiaDia, setLoadingDiaDia] = useState(false);
  const [mesDiaDia, setMesDiaDia] = useState(new Date().getMonth() + 1);
  const [anoDiaDia, setAnoDiaDia] = useState(new Date().getFullYear());
  const [metricaDiaDia, setMetricaDiaDia] = useState('venda');
  const [modoDiaDia, setModoDiaDia] = useState('corrente'); // 'corrente' ou 'semana'

  // Estado para vendas analíticas por setor
  const [vendasAnaliticas, setVendasAnaliticas] = useState([]);
  const [loadingVendasAnaliticas, setLoadingVendasAnaliticas] = useState(false);

  // Estado para cascata analítica (Seção > Grupo > Subgrupo > Item)
  const [expandedAnaliticaSecoes, setExpandedAnaliticaSecoes] = useState({});
  const [expandedAnaliticaGrupos, setExpandedAnaliticaGrupos] = useState({});
  const [expandedAnaliticaSubgrupos, setExpandedAnaliticaSubgrupos] = useState({});
  const [expandedAnaliticaSegmentos, setExpandedAnaliticaSegmentos] = useState({});

  // Estado para filtro de oferta na Análise Comparativa: 'com' = todas as vendas, 'sem' = subtraindo ofertas
  const [filtroOferta, setFiltroOferta] = useState('com');

  // Seções inativas na Análise Comparativa (excluídas dos totais/cards)
  const [secoesInativasGI, setSecoesInativasGI] = useState([]);
  const [indicadoresOriginais, setIndicadoresOriginais] = useState(null); // backup dos indicadores originais do backend

  // Recalcular indicadores quando seções inativas mudam
  useEffect(() => {
    if (!indicadoresOriginais || vendasAnaliticas.length === 0 || secoesInativasGI.length === 0) {
      // Sem inativas: restaurar originais
      if (indicadoresOriginais && secoesInativasGI.length === 0) {
        setIndicadores(indicadoresOriginais);
      }
      return;
    }
    // Somar valores APENAS das seções ATIVAS (não inativas)
    let vAt = 0, vMP = 0, vAP = 0, vML = 0;
    let cAt = 0, cMP = 0, cAP = 0, cML = 0;
    let iAt = 0, iMP = 0, iAP = 0, iML = 0;
    let oAt = 0, oMP = 0, oAP = 0, oML = 0;
    for (const s of vendasAnaliticas) {
      if (secoesInativasGI.includes(String(s.codSecao))) continue; // pular inativas
      vAt += s.vendaAtual || 0; vMP += s.vendaMesPassado || 0;
      vAP += s.vendaAnoPassado || 0; vML += s.mediaLinear || 0;
      cAt += s.custoAtual || 0; cMP += s.custoMesPassado || 0;
      cAP += s.custoAnoPassado || 0; cML += s.custoMediaLinear || 0;
      iAt += s.impostosAtual || 0; iMP += s.impostosMesPassado || 0;
      iAP += s.impostosAnoPassado || 0; iML += s.impostosMediaLinear || 0;
      oAt += s.vendasOfertaAtual || 0; oMP += s.vendasOfertaMesPassado || 0;
      oAP += s.vendasOfertaAnoPassado || 0; oML += s.vendasOfertaMediaLinear || 0;
    }
    const lucroAt = vAt - cAt; const lucroMP = vMP - cMP;
    const lucroAP = vAP - cAP; const lucroML = vML - cML;
    const mkdAt = vAt > 0 ? (lucroAt / vAt) * 100 : 0;
    const mkdMP = vMP > 0 ? (lucroMP / vMP) * 100 : 0;
    const mkdAP = vAP > 0 ? (lucroAP / vAP) * 100 : 0;
    const mkdML = vML > 0 ? (lucroML / vML) * 100 : 0;
    // Margem Limpa = (Vendas - Custo - ImpostosLiquidos) / Vendas * 100
    const mlAt = vAt > 0 ? ((vAt - cAt - iAt) / vAt) * 100 : 0;
    const mlMP = vMP > 0 ? ((vMP - cMP - iMP) / vMP) * 100 : 0;
    const mlAP = vAP > 0 ? ((vAP - cAP - iAP) / vAP) * 100 : 0;
    const mlML = vML > 0 ? ((vML - cML - iML) / vML) * 100 : 0;
    // % Vendas em Oferta
    const poAt = vAt > 0 ? (oAt / vAt) * 100 : 0;
    const poMP = vMP > 0 ? (oMP / vMP) * 100 : 0;
    const poAP = vAP > 0 ? (oAP / vAP) * 100 : 0;
    const poML = vML > 0 ? (oML / vML) * 100 : 0;
    setIndicadores(prev => ({
      ...prev,
      vendas: { atual: vAt, mesPassado: vMP, anoPassado: vAP, mediaLinear: vML },
      lucro: { atual: lucroAt, mesPassado: lucroMP, anoPassado: lucroAP, mediaLinear: lucroML },
      custoVendas: { atual: cAt, mesPassado: cMP, anoPassado: cAP, mediaLinear: cML },
      impostos: { atual: iAt, mesPassado: iMP, anoPassado: iAP, mediaLinear: iML },
      markdown: { atual: mkdAt, mesPassado: mkdMP, anoPassado: mkdAP, mediaLinear: mkdML },
      margemLimpa: { atual: mlAt, mesPassado: mlMP, anoPassado: mlAP, mediaLinear: mlML },
      vendasOferta: { atual: oAt, mesPassado: oMP, anoPassado: oAP, mediaLinear: oML },
      pctVendasOferta: { atual: poAt, mesPassado: poMP, anoPassado: poAP, mediaLinear: poML },
    }));
  }, [secoesInativasGI, vendasAnaliticas, indicadoresOriginais]);

  // Dados da análise comparativa filtrados por oferta
  const vendasAnaliticasFiltradas = useMemo(() => {
    if (filtroOferta === 'com' || vendasAnaliticas.length === 0) return vendasAnaliticas;
    // Sem oferta: subtrair vendasOferta de cada período e recalcular indicadores
    return vendasAnaliticas.map(d => {
      const va = (d.vendaAtual || 0) - (d.vendasOfertaAtual || 0);
      const vml = (d.mediaLinear || 0) - (d.vendasOfertaMediaLinear || 0);
      const vap = (d.vendaAnoPassado || 0) - (d.vendasOfertaAnoPassado || 0);
      const vmp = (d.vendaMesPassado || 0) - (d.vendasOfertaMesPassado || 0);
      // Proporção sem oferta para recalcular custo/lucro/impostos proporcionalmente
      const propA = d.vendaAtual > 0 ? va / d.vendaAtual : 0;
      const propML = d.mediaLinear > 0 ? vml / d.mediaLinear : 0;
      const propAP = d.vendaAnoPassado > 0 ? vap / d.vendaAnoPassado : 0;
      const propMP = d.vendaMesPassado > 0 ? vmp / d.vendaMesPassado : 0;
      const custoA = (d.custoAtual || 0) * propA;
      const custoML = (d.custoMediaLinear || 0) * propML;
      const custoAP = (d.custoAnoPassado || 0) * propAP;
      const custoMP = (d.custoMesPassado || 0) * propMP;
      const impA = (d.impostosAtual || 0) * propA;
      const impML = (d.impostosMediaLinear || 0) * propML;
      const impAP = (d.impostosAnoPassado || 0) * propAP;
      const impMP = (d.impostosMesPassado || 0) * propMP;
      return {
        ...d,
        vendaAtual: parseFloat(va.toFixed(2)), mediaLinear: parseFloat(vml.toFixed(2)),
        vendaAnoPassado: parseFloat(vap.toFixed(2)), vendaMesPassado: parseFloat(vmp.toFixed(2)),
        custoAtual: parseFloat(custoA.toFixed(2)), custoMediaLinear: parseFloat(custoML.toFixed(2)),
        custoAnoPassado: parseFloat(custoAP.toFixed(2)), custoMesPassado: parseFloat(custoMP.toFixed(2)),
        lucroAtual: parseFloat((va - custoA).toFixed(2)), lucroMediaLinear: parseFloat((vml - custoML).toFixed(2)),
        lucroAnoPassado: parseFloat((vap - custoAP).toFixed(2)), lucroMesPassado: parseFloat((vmp - custoMP).toFixed(2)),
        markdownAtual: va > 0 ? parseFloat((((va - custoA) / va) * 100).toFixed(2)) : 0,
        markdownMediaLinear: vml > 0 ? parseFloat((((vml - custoML) / vml) * 100).toFixed(2)) : 0,
        markdownAnoPassado: vap > 0 ? parseFloat((((vap - custoAP) / vap) * 100).toFixed(2)) : 0,
        markdownMesPassado: vmp > 0 ? parseFloat((((vmp - custoMP) / vmp) * 100).toFixed(2)) : 0,
        margemLimpaAtual: va > 0 ? parseFloat((((va - custoA - impA) / va) * 100).toFixed(2)) : 0,
        margemLimpaMediaLinear: vml > 0 ? parseFloat((((vml - custoML - impML) / vml) * 100).toFixed(2)) : 0,
        margemLimpaAnoPassado: vap > 0 ? parseFloat((((vap - custoAP - impAP) / vap) * 100).toFixed(2)) : 0,
        margemLimpaMesPassado: vmp > 0 ? parseFloat((((vmp - custoMP - impMP) / vmp) * 100).toFixed(2)) : 0,
        impostosAtual: parseFloat(impA.toFixed(2)), impostosMediaLinear: parseFloat(impML.toFixed(2)),
        impostosAnoPassado: parseFloat(impAP.toFixed(2)), impostosMesPassado: parseFloat(impMP.toFixed(2)),
        vendasOfertaAtual: 0, vendasOfertaMediaLinear: 0, vendasOfertaAnoPassado: 0, vendasOfertaMesPassado: 0,
        pctOfertaAtual: 0, pctOfertaMediaLinear: 0, pctOfertaAnoPassado: 0, pctOfertaMesPassado: 0,
      };
    });
  }, [vendasAnaliticas, filtroOferta]);

  // Atualizar gráfico quando filtro de oferta muda
  useEffect(() => {
    if (vendasAnaliticasFiltradas.length > 0 && graficoAnaliticaDrill.level === 'secoes') {
      setGraficoAnaliticaDrill({ level: 'secoes', data: vendasAnaliticasFiltradas, breadcrumb: [{ label: 'Seções' }] });
    }
  }, [filtroOferta, vendasAnaliticasFiltradas]);

  // Estado para gráfico das Vendas Analíticas
  const [showGraficoAnalitica, setShowGraficoAnalitica] = useState(true);
  const [graficoAnaliticaMetrica, setGraficoAnaliticaMetrica] = useState('vendaAtual');
  // Drill-down: { level: 'secoes'|'grupos'|'subgrupos'|'itens', data: [], breadcrumb: [{label, codSecao?, codGrupo?, codSubgrupo?}] }
  const [graficoAnaliticaDrill, setGraficoAnaliticaDrill] = useState({ level: 'secoes', data: [], breadcrumb: [{ label: 'Seções' }] });
  const [filtroSetoresAnalitica, setFiltroSetoresAnalitica] = useState(null); // null = todos, Set de indices filtrados

  // Estado para vendas por setor anual
  const [vendasSetorAnual, setVendasSetorAnual] = useState([]);
  const [loadingVendasSetorAnual, setLoadingVendasSetorAnual] = useState(false);
  const [anoSetorAnual, setAnoSetorAnual] = useState(new Date().getFullYear());
  const [showGraficoSetorAnual, setShowGraficoSetorAnual] = useState(true);
  const [selectedSetoresGrafico, setSelectedSetoresGrafico] = useState(null); // null = todos, Set de indices
  const [graficoMetrica, setGraficoMetrica] = useState('venda'); // campo ativo no gráfico
  const [expandedSetoresAnual, setExpandedSetoresAnual] = useState({});

  // Estado para Analise Produtos Anual
  const [produtoAnualSetores, setProdutoAnualSetores] = useState([]);
  const [loadingProdutoAnual, setLoadingProdutoAnual] = useState(false);
  const [anoProdutoAnual, setAnoProdutoAnual] = useState(new Date().getFullYear());
  const [produtoAnualMetrica, setProdutoAnualMetrica] = useState('venda');
  const [expandedProdAnualSecoes, setExpandedProdAnualSecoes] = useState({});
  const [expandedProdAnualGrupos, setExpandedProdAnualGrupos] = useState({});
  const [expandedProdAnualSubgrupos, setExpandedProdAnualSubgrupos] = useState({});
  const [produtoSelecionadoGrafico, setProdutoSelecionadoGrafico] = useState(null); // { nome, meses, total }

  // Estado para ordem dos cards (drag and drop)
  const defaultCardOrder = ['vendas', 'lucro', 'markdown', 'margemLimpa', 'ticketMedio', 'pctCompraVenda'];
  const defaultCardOrder2 = ['pctVendasOferta', 'qtdSkus', 'qtdCupons', 'qtdItens', 'vendasOfertaValor', 'valorEstoque'];
  const defaultCardOrder3 = ['custoVendas', 'markdownOferta', 'impostoPrevisto', 'produtosRevenda', 'excessoCompras', 'margemCV'];
  const defaultCardOrder4 = ['vendasPorMetro', 'skuPorMetro', 'skuVendidoPorMetro', 'produtosProducao', 'produtosLojaTodos', 'emBreveC'];

  const migrateCardIds = (ids) => ids.map(id => {
    if (id === 'emBreve1') return 'vendasOfertaValor';
    if (id === 'emBreve2') return 'valorEstoque';
    if (id === 'emBreve3') return 'custoVendas';
    if (id === 'emBreve4') return 'markdownOferta';
    if (id === 'emBreve5') return 'impostoPrevisto';
    if (id === 'emBreve6') return 'produtosRevenda';
    if (id === 'emBreve7') return 'excessoCompras';
    if (id === 'emBreve8') return 'margemCV';
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
  const [cardOrder4, setCardOrder4] = useState(() => {
    const saved = localStorage.getItem('gestao_card_order_4');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrar IDs antigos
      const migrated = parsed.map(id => {
        if (id === 'emBreveA') return 'produtosProducao';
        if (id === 'emBreveB') return 'produtosLojaTodos';
        return id;
      });
      // Se mudou, salvar
      if (JSON.stringify(migrated) !== saved) {
        localStorage.setItem('gestao_card_order_4', JSON.stringify(migrated));
      }
      return migrated;
    }
    return defaultCardOrder4;
  });
  const [draggedCard, setDraggedCard] = useState(null);
  const [draggedRow, setDraggedRow] = useState(null);
  const [cardExpandido, setCardExpandido] = useState('vendas'); // qual card de cima está expandido mostrando sub-cards

  // Estado para configuração de Área de Venda (m²)
  const [showAreaVendaModal, setShowAreaVendaModal] = useState(false);
  const [areaVenda, setAreaVenda] = useState(() => {
    const key = `gestao_area_venda_${lojaSelecionada}`;
    const saved = localStorage.getItem(key);
    return saved ? Number(saved) : 0;
  });
  const [areaVendaTemp, setAreaVendaTemp] = useState(areaVenda);

  const saveAreaVenda = (val) => {
    const num = Number(val) || 0;
    setAreaVenda(num);
    localStorage.setItem(`gestao_area_venda_${lojaSelecionada}`, String(num));
    setShowAreaVendaModal(false);
  };

  // Estado para configuração de colaboradores (card Media Performance)
  const [showColabModal, setShowColabModal] = useState(false);
  const [colabConfig, setColabConfig] = useState(() => {
    const key = `gestao_colab_config_${lojaSelecionada}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : { clt: 0, aprendiz: 0, estagiario: 0, pesoClt: 1, pesoAprendiz: 0.5, pesoEstagiario: 0.5 };
  });
  const [colabConfigTemp, setColabConfigTemp] = useState(colabConfig);

  const saveColabConfig = (cfg) => {
    setColabConfig(cfg);
    localStorage.setItem(`gestao_colab_config_${lojaSelecionada}`, JSON.stringify(cfg));
    setShowColabModal(false);
  };

  // Estado para configuração de faixas SKU/M²
  const defaultSkuFaixas = [
    { label: 'PESSIMO', min: null, max: 5 },
    { label: 'RUIM', min: 5, max: 10 },
    { label: 'REGULAR', min: 11, max: 14 },
    { label: 'BOM', min: 15, max: 23 },
    { label: 'OTIMO', min: 23, max: null },
  ];
  const [showSkuFaixasModal, setShowSkuFaixasModal] = useState(false);
  const [skuFaixas, setSkuFaixas] = useState(() => {
    const key = `gestao_sku_faixas_${lojaSelecionada}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultSkuFaixas;
  });
  const [skuFaixasTemp, setSkuFaixasTemp] = useState(skuFaixas);

  const saveSkuFaixas = (faixas) => {
    setSkuFaixas(faixas);
    localStorage.setItem(`gestao_sku_faixas_${lojaSelecionada}`, JSON.stringify(faixas));
    setShowSkuFaixasModal(false);
  };

  const getSkuClassificacao = (valor) => {
    if (!valor || valor === '-') return null;
    const v = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : valor;
    if (isNaN(v)) return null;
    // Itera do último ao primeiro, encontra a faixa onde v >= min
    for (let i = skuFaixas.length - 1; i >= 0; i--) {
      const f = skuFaixas[i];
      if (f.min === null) continue;
      if (v >= f.min) return f;
    }
    return skuFaixas[0]; // PESSIMO (abaixo de tudo)
  };

  const skuClassifCores = {
    PESSIMO: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    RUIM: { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    REGULAR: { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    BOM: { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    OTIMO: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    EXCELENTE: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  };

  // Estado para configuração de faixas Vendas/M²
  const defaultVendasFaixas = [
    { label: 'PESSIMO', min: null, max: 2000 },
    { label: 'RUIM', min: 2000, max: 2500 },
    { label: 'REGULAR', min: 2500, max: 2700 },
    { label: 'BOM', min: 2700, max: 3000 },
    { label: 'EXCELENTE', min: 3000, max: null },
  ];
  const [showVendasFaixasModal, setShowVendasFaixasModal] = useState(false);
  const [vendasFaixas, setVendasFaixas] = useState(() => {
    const key = `gestao_vendas_faixas_${lojaSelecionada}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultVendasFaixas;
  });
  const [vendasFaixasTemp, setVendasFaixasTemp] = useState(vendasFaixas);

  const saveVendasFaixas = (faixas) => {
    setVendasFaixas(faixas);
    localStorage.setItem(`gestao_vendas_faixas_${lojaSelecionada}`, JSON.stringify(faixas));
    setShowVendasFaixasModal(false);
  };

  const getVendasClassificacao = (valor) => {
    if (!valor || areaVenda <= 0) return null;
    const v = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[R$\s.]/g, '').replace(',', '.'));
    if (isNaN(v)) return null;
    for (let i = vendasFaixas.length - 1; i >= 0; i--) {
      const f = vendasFaixas[i];
      if (f.min === null) continue;
      if (v >= f.min) return f;
    }
    return vendasFaixas[0];
  };

  // Estado para configuração de Ticket Médio por Área
  const defaultTicketFaixas = [
    { minArea: 0, maxArea: 50, ticketEsperado: 20 },
    { minArea: 50, maxArea: 100, ticketEsperado: 25 },
    { minArea: 100, maxArea: 200, ticketEsperado: 30 },
    { minArea: 200, maxArea: 400, ticketEsperado: 35 },
    { minArea: 400, maxArea: 800, ticketEsperado: 40 },
    { minArea: 800, maxArea: 1200, ticketEsperado: 45 },
    { minArea: 1200, maxArea: 1600, ticketEsperado: 50 },
    { minArea: 1600, maxArea: 2000, ticketEsperado: 55 },
    { minArea: 2000, maxArea: 2400, ticketEsperado: 60 },
    { minArea: 2400, maxArea: null, ticketEsperado: 65 },
  ];
  const [showTicketFaixasModal, setShowTicketFaixasModal] = useState(false);
  const [ticketFaixas, setTicketFaixas] = useState(() => {
    const key = `gestao_ticket_faixas_${lojaSelecionada}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultTicketFaixas;
  });
  const [ticketFaixasTemp, setTicketFaixasTemp] = useState(ticketFaixas);

  const saveTicketFaixas = (faixas) => {
    setTicketFaixas(faixas);
    localStorage.setItem(`gestao_ticket_faixas_${lojaSelecionada}`, JSON.stringify(faixas));
    setShowTicketFaixasModal(false);
  };

  const getTicketMedioEsperado = () => {
    if (areaVenda <= 0) return null;
    for (const f of ticketFaixas) {
      if (f.maxArea === null && areaVenda >= f.minArea) return f.ticketEsperado;
      if (areaVenda >= f.minArea && areaVenda < f.maxArea) return f.ticketEsperado;
    }
    return null;
  };

  const mediaPerformColab = useMemo(() => {
    const { clt, aprendiz, estagiario, pesoClt, pesoAprendiz, pesoEstagiario } = colabConfig;
    const totalPonderado = (clt * pesoClt) + (aprendiz * pesoAprendiz) + (estagiario * pesoEstagiario);
    const calc = (fat) => totalPonderado > 0 ? (fat || 0) / totalPonderado : 0;
    // Projecao: usa os dias reais do periodo selecionado nos filtros
    const dtIni = new Date(filters.dataInicio + 'T00:00:00');
    const dtFim = new Date(filters.dataFim + 'T00:00:00');
    const diasPeriodo = Math.round((dtFim - dtIni) / 86400000) + 1; // dias no periodo selecionado
    const diasNoMes = new Date(dtIni.getFullYear(), dtIni.getMonth() + 1, 0).getDate();
    const fatAtual = defesaData.faturamento?.atual || 0;
    const projecaoMes = diasPeriodo > 0 ? (fatAtual / diasPeriodo) * diasNoMes : 0;
    const mediaProjetada = totalPonderado > 0 && diasPeriodo > 0 ? projecaoMes / totalPonderado : 0;
    return { media: calc(fatAtual), mesPassado: calc(defesaData.faturamento?.mesPassado), anoPassado: calc(defesaData.faturamento?.anoPassado), mediaProjetada, totalPonderado, clt, aprendiz, estagiario, configurado: totalPonderado > 0 };
  }, [colabConfig, defesaData.faturamento, filters.dataInicio, filters.dataFim]);

  // Estado para ordem dos cards DEFESA (drag and drop)
  const defaultDefesaOrder1 = ['naoBipados', 'furtos', 'cancelamentos', 'descontos', 'valeTroca', 'valeDesconto'];
  const defaultDefesaOrder2 = ['sobraCaixa', 'faltaCaixa', 'rupturaTaxa', 'rupturaPerdaVenda', 'rupturaPerdaLucro', 'etiquetaTaxa'];
  const defaultDefesaOrder3 = ['fluxoCaixa', 'perdasEstoque', 'mediaPerformColab', 'trocasFornecedor', 'defesa17', 'dre'];
  const migrateDefesaIds = (ids) => ids.map(id => {
    if (id === 'defesa13') return 'fluxoCaixa';
    if (id === 'defesa14') return 'perdasEstoque';
    if (id === 'defesa15') return 'mediaPerformColab';
    if (id === 'defesa16') return 'trocasFornecedor';
    if (id === 'defesa18') return 'dre';
    return id;
  });
  const [defesaOrder1, setDefesaOrder1] = useState(() => {
    const saved = localStorage.getItem('gestao_defesa_order_1');
    return saved ? migrateDefesaIds(JSON.parse(saved)) : defaultDefesaOrder1;
  });
  const [defesaOrder2, setDefesaOrder2] = useState(() => {
    const saved = localStorage.getItem('gestao_defesa_order_2');
    return saved ? migrateDefesaIds(JSON.parse(saved)) : defaultDefesaOrder2;
  });
  const [defesaOrder3, setDefesaOrder3] = useState(() => {
    const saved = localStorage.getItem('gestao_defesa_order_3');
    return saved ? migrateDefesaIds(JSON.parse(saved)) : defaultDefesaOrder3;
  });
  const [draggedDefesaCard, setDraggedDefesaCard] = useState(null);
  const [draggedDefesaRow, setDraggedDefesaRow] = useState(null);

  // Estado para ordem dos cards de análise (drag and drop)
  const defaultAnaliseOrder = ['vendas-analiticas', 'vendas-setor-anual', 'vendas-ano', 'vendas-setor', 'vendas-dia-semana', 'vendas-dia-dia', 'produto-anual'];
  const [analiseCardOrder, setAnaliseCardOrder] = useState(() => {
    const saved = localStorage.getItem('gestao_analise_card_order');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Adicionar cards novos que não existem no localStorage salvo
      const missing = defaultAnaliseOrder.filter(id => !parsed.includes(id));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        localStorage.setItem('gestao_analise_card_order', JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }
    return defaultAnaliseOrder;
  });
  const [draggedAnaliseCard, setDraggedAnaliseCard] = useState(null);

  // Estado para ordem das colunas da tabela (drag and drop)
  const defaultColOrder = ['venda', 'repr', 'custo', 'lucro', 'markdown', 'margemLimpa', 'impostos', 'ticketMedio', 'vendasOferta', 'pctOferta', 'cupons', 'qtd', 'skus'];
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
    localStorage.setItem('gestao_card_order_4', JSON.stringify(cardOrder4));
  }, [cardOrder4]);

  useEffect(() => {
    localStorage.setItem('gestao_col_order', JSON.stringify(colOrder));
  }, [colOrder]);

  useEffect(() => {
    localStorage.setItem('gestao_analise_card_order', JSON.stringify(analiseCardOrder));
  }, [analiseCardOrder]);

  // Salvar ordem DEFESA no localStorage
  useEffect(() => {
    localStorage.setItem('gestao_defesa_order_1', JSON.stringify(defesaOrder1));
  }, [defesaOrder1]);
  useEffect(() => {
    localStorage.setItem('gestao_defesa_order_2', JSON.stringify(defesaOrder2));
  }, [defesaOrder2]);
  useEffect(() => {
    localStorage.setItem('gestao_defesa_order_3', JSON.stringify(defesaOrder3));
  }, [defesaOrder3]);

  // Recarregar config de colaboradores quando loja muda
  useEffect(() => {
    const key = `gestao_colab_config_${lojaSelecionada}`;
    const saved = localStorage.getItem(key);
    setColabConfig(saved ? JSON.parse(saved) : { clt: 0, aprendiz: 0, estagiario: 0, pesoClt: 1, pesoAprendiz: 0.5, pesoEstagiario: 0.5 });
  }, [lojaSelecionada]);

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
    'vendas-analiticas': { label: 'Analise Comparativa', desc: 'Comparativos por setor', emoji: '📈', onClick: () => toggleVendasAnaliticas(),
      active: 'bg-amber-100 border-amber-400 ring-2 ring-amber-400', inactive: 'bg-amber-50 border-amber-200 hover:border-amber-400',
      icon: 'bg-amber-200', title: 'text-amber-800', sub: 'text-amber-600' },
    'vendas-ano': { label: 'Analise por Ano', desc: 'Indicadores mensais consolidados', emoji: '📅', onClick: () => toggleVendasPorAno(),
      active: 'bg-blue-100 border-blue-400 ring-2 ring-blue-400', inactive: 'bg-blue-50 border-blue-200 hover:border-blue-400',
      icon: 'bg-blue-200', title: 'text-blue-800', sub: 'text-blue-600' },
    'vendas-setor': { label: 'Analise por Setor Periodo Atual', desc: 'Hierarquia completa por setor', emoji: '🏪', onClick: () => fetchVendasPorSetor(),
      active: 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400', inactive: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
      icon: 'bg-emerald-200', title: 'text-emerald-800', sub: 'text-emerald-600' },
    'vendas-dia-semana': { label: 'Analise Linear Dia da Semana', desc: 'Padroes semanais por mes', emoji: '📊', onClick: () => toggleVendasPorDiaSemana(),
      active: 'bg-violet-100 border-violet-400 ring-2 ring-violet-400', inactive: 'bg-violet-50 border-violet-200 hover:border-violet-400',
      icon: 'bg-violet-200', title: 'text-violet-800', sub: 'text-violet-600' },
    'vendas-setor-anual': { label: 'Analise por Setor Anual', desc: 'Evolucao anual por setor', emoji: '🗓', onClick: () => toggleVendasPorSetorAnual(),
      active: 'bg-sky-100 border-sky-400 ring-2 ring-sky-400', inactive: 'bg-sky-50 border-sky-200 hover:border-sky-400',
      icon: 'bg-sky-200', title: 'text-sky-800', sub: 'text-sky-600' },
    'produto-anual': { label: 'Analise Produtos Anual', desc: 'Evolucao mensal por produto', emoji: '📦', onClick: () => toggleProdutoAnual(),
      active: 'bg-rose-100 border-rose-400 ring-2 ring-rose-400', inactive: 'bg-rose-50 border-rose-200 hover:border-rose-400',
      icon: 'bg-rose-200', title: 'text-rose-800', sub: 'text-rose-600' },
    'vendas-dia-dia': { label: 'Venda Dia a Dia', desc: 'Vendas diarias por setor', emoji: '📆', onClick: () => toggleVendasDiaDia(),
      active: 'bg-orange-100 border-teal-400 ring-2 ring-teal-400', inactive: 'bg-orange-50 border-orange-200 hover:border-teal-400',
      icon: 'bg-orange-200', title: 'text-orange-800', sub: 'text-orange-600' },
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
      headerClass: 'text-orange-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-orange-600', val: formatCurrency(d.ticketMedio) }),
      renderGrupo: (d) => ({ cls: 'text-orange-600', val: formatCurrency(d.ticketMedio) }),
      renderSub: (d) => ({ cls: 'text-orange-600', val: formatCurrency(d.ticketMedio) }),
      renderItem: (d) => ({ cls: 'text-orange-600', val: formatCurrency(d.ticketMedio) }),
      renderTotal: (dados) => {
        const totalVenda = dados.reduce((a, i) => a + i.venda, 0);
        const totalCupons = dados.reduce((a, i) => a + (i.qtdCupons || 0), 0);
        return { cls: 'font-bold text-orange-600', val: formatCurrency(totalCupons > 0 ? totalVenda / totalCupons : 0) };
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
    margemLimpa: {
      label: 'MG Limpa %',
      headerClass: 'text-emerald-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-emerald-600', val: formatPercent(d.margemLimpa) }),
      renderGrupo: (d) => ({ cls: 'font-medium text-emerald-600', val: formatPercent(d.margemLimpa) }),
      renderSub: (d) => ({ cls: 'text-emerald-600', val: formatPercent(d.margemLimpa) }),
      renderItem: (d) => ({ cls: 'text-emerald-600', val: formatPercent(d.margemLimpa) }),
      renderTotal: (dados) => {
        const tv = dados.reduce((a, i) => a + i.venda, 0);
        const tc = dados.reduce((a, i) => a + (i.custo || 0), 0);
        const ti = dados.reduce((a, i) => a + (i.impostos || 0), 0);
        const tic = dados.reduce((a, i) => a + (i.impostoCredito || 0), 0);
        return { cls: 'font-bold text-emerald-600', val: formatPercent(tv > 0 ? ((tv - tc - ti + tic) / tv) * 100 : 0) };
      },
    },
    impostos: {
      label: 'Impostos',
      headerClass: 'text-red-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-red-600', val: formatCurrency(d.impostos) }),
      renderGrupo: (d) => ({ cls: 'text-red-600', val: formatCurrency(d.impostos) }),
      renderSub: (d) => ({ cls: 'text-red-600', val: formatCurrency(d.impostos) }),
      renderItem: (d) => ({ cls: 'text-red-600', val: formatCurrency(d.impostos) }),
      renderTotal: (dados) => ({ cls: 'font-bold text-red-600', val: formatCurrency(dados.reduce((a, i) => a + (i.impostos || 0), 0)) }),
    },
    pctOferta: {
      label: '% Oferta',
      headerClass: 'text-amber-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-amber-600', val: formatPercent(d.pctOferta) }),
      renderGrupo: (d) => ({ cls: 'font-medium text-amber-600', val: formatPercent(d.pctOferta) }),
      renderSub: (d) => ({ cls: 'text-amber-600', val: formatPercent(d.pctOferta) }),
      renderItem: (d) => ({ cls: 'text-amber-600', val: formatPercent(d.pctOferta) }),
      renderTotal: (dados) => {
        const tv = dados.reduce((a, i) => a + i.venda, 0);
        const to = dados.reduce((a, i) => a + (i.vendasOferta || 0), 0);
        return { cls: 'font-bold text-amber-600', val: formatPercent(tv > 0 ? (to / tv) * 100 : 0) };
      },
    },
    cupons: {
      label: 'Cupons',
      headerClass: 'text-indigo-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-indigo-600', val: formatNumber(d.qtdCupons) }),
      renderGrupo: (d) => ({ cls: 'text-indigo-600', val: formatNumber(d.qtdCupons) }),
      renderSub: (d) => ({ cls: 'text-indigo-600', val: formatNumber(d.qtdCupons) }),
      renderItem: (d) => ({ cls: 'text-indigo-600', val: formatNumber(d.qtdCupons) }),
      renderTotal: (dados) => ({ cls: 'font-bold text-indigo-600', val: formatNumber(dados.reduce((a, i) => a + (i.qtdCupons || 0), 0)) }),
    },
    skus: {
      label: 'SKUs',
      headerClass: 'text-slate-600',
      renderSetor: (d) => ({ cls: 'font-semibold text-slate-600', val: formatNumber(d.qtdSkus) }),
      renderGrupo: (d) => ({ cls: 'text-slate-600', val: formatNumber(d.qtdSkus) }),
      renderSub: (d) => ({ cls: 'text-slate-600', val: formatNumber(d.qtdSkus) }),
      renderItem: (d) => ({ cls: 'text-slate-600', val: formatNumber(d.qtdSkus) }),
      renderTotal: (dados) => ({ cls: 'font-bold text-slate-600', val: formatNumber(dados.reduce((a, i) => a + (i.qtdSkus || 0), 0)) }),
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
      if (row === 3) return [cardOrder3, setCardOrder3];
      return [cardOrder4, setCardOrder4];
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

  // Drag and drop DEFESA cards
  const handleDefesaDragStart = (e, cardId, row) => {
    setDraggedDefesaCard(cardId);
    setDraggedDefesaRow(row);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };
  const handleDefesaDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedDefesaCard(null);
    setDraggedDefesaRow(null);
  };
  const handleDefesaDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDefesaDrop = (e, targetCardId, targetRow) => {
    e.preventDefault();
    if (!draggedDefesaCard) return;
    const getRowData = (row) => {
      if (row === 1) return [defesaOrder1, setDefesaOrder1];
      if (row === 2) return [defesaOrder2, setDefesaOrder2];
      return [defesaOrder3, setDefesaOrder3];
    };
    if (draggedDefesaRow === targetRow) {
      const [orderArray, setOrderArray] = getRowData(targetRow);
      const draggedIndex = orderArray.indexOf(draggedDefesaCard);
      const targetIndex = orderArray.indexOf(targetCardId);
      if (draggedIndex !== targetIndex) {
        const newOrder = [...orderArray];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedDefesaCard);
        setOrderArray(newOrder);
      }
    } else {
      const [sourceArray, setSourceArray] = getRowData(draggedDefesaRow);
      const [targetArray, setTargetArray] = getRowData(targetRow);
      const draggedIndex = sourceArray.indexOf(draggedDefesaCard);
      const targetIndex = targetArray.indexOf(targetCardId);
      const newSourceArray = [...sourceArray];
      const newTargetArray = [...targetArray];
      newSourceArray[draggedIndex] = targetCardId;
      newTargetArray[targetIndex] = draggedDefesaCard;
      setSourceArray(newSourceArray);
      setTargetArray(newTargetArray);
    }
    setDraggedDefesaCard(null);
    setDraggedDefesaRow(null);
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
  const buildTiposSaida = () => {
    const t = [];
    if (tipoVenda.pdv) t.push(0);
    if (tipoVenda.combustivel) t.push(1);
    if (tipoVenda.vendaBalcao) t.push(2);
    if (tipoVenda.ecommerce) t.push(3);
    if (tipoVenda.nfCliente) t.push(4);
    if (tipoVenda.nfTransferencia) t.push(8);
    return t.join(',');
  };

  const fetchIndicadores = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        tiposSaida: buildTiposSaida()
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/indicadores', { params });
      const data = response.data;
      // Calcular indicadores derivados: Excesso de Compras e Margem Compra e Venda
      // Usa valor real de compras (não recalcula do %) para bater com tela Compra e Venda
      const calcExcesso = (vendas, custo, compras) => {
        if (!vendas || vendas === 0) return { pct: 0, rs: 0 };
        const pct = ((custo / vendas) - (compras / vendas)) * 100;
        const rs = custo - compras;
        return { pct: parseFloat(pct.toFixed(2)), rs: parseFloat(rs.toFixed(2)) };
      };
      const calcMargemCV = (markdown, excPct) => parseFloat((markdown + excPct).toFixed(2));
      const exAt = calcExcesso(data.vendas?.atual, data.custoVendas?.atual, data.compras?.atual || 0);
      const exMP = calcExcesso(data.vendas?.mesPassado, data.custoVendas?.mesPassado, data.compras?.mesPassado || 0);
      const exAP = calcExcesso(data.vendas?.anoPassado, data.custoVendas?.anoPassado, data.compras?.anoPassado || 0);
      const exML = calcExcesso(data.vendas?.mediaLinear, data.custoVendas?.mediaLinear, data.compras?.mediaLinear || 0);
      data.excessoCompras = { atual: exAt.pct, mesPassado: exMP.pct, anoPassado: exAP.pct, mediaLinear: exML.pct };
      data.excessoComprasRs = { atual: exAt.rs, mesPassado: exMP.rs, anoPassado: exAP.rs, mediaLinear: exML.rs };
      data.margemCV = {
        atual: calcMargemCV(data.markdown?.atual, exAt.pct),
        mesPassado: calcMargemCV(data.markdown?.mesPassado, exMP.pct),
        anoPassado: calcMargemCV(data.markdown?.anoPassado, exAP.pct),
        mediaLinear: calcMargemCV(data.markdown?.mediaLinear, exML.pct)
      };
      setIndicadores(data);
      setIndicadoresOriginais(JSON.parse(JSON.stringify(data))); // backup para recalcular com seções inativas
    } catch (err) {
      console.error('Erro ao buscar indicadores:', err);
      setError(err.response?.data?.error || 'Erro ao carregar indicadores');
    } finally {
      setLoading(false);
    }
  };

  // Buscar produtos revenda e valor estoque
  const fetchProdutosRevenda = async () => {
    try {
      const params = {};
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const { data } = await api.get('/gestao-inteligente/produtos-revenda-estoque', { params });
      setProdutosRevenda(data);
    } catch (err) {
      console.error('Erro ao buscar produtos revenda:', err);
    }
  };

  // Buscar dados DEFESA (não bipados + furtos + frente de caixa + ruptura + etiquetas)
  const fetchDefesaData = async () => {
    setDefesaData(prev => ({ ...prev, loadingDefesa: true }));
    try {
      const fmtDateBR = (d) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
      const codLoja = lojaSelecionada || '';

      // Calcular períodos comparativos
      const dtIni = new Date(filters.dataInicio + 'T00:00:00');
      const dtFim = new Date(filters.dataFim + 'T00:00:00');
      const mesPassIni = new Date(dtIni); mesPassIni.setMonth(mesPassIni.getMonth() - 1);
      const mesPassFim = new Date(dtFim); mesPassFim.setMonth(mesPassFim.getMonth() - 1);
      const anoPassIni = new Date(dtIni); anoPassIni.setFullYear(anoPassIni.getFullYear() - 1);
      const anoPassFim = new Date(dtFim); anoPassFim.setFullYear(anoPassFim.getFullYear() - 1);
      const fmtISO = (d) => d.toISOString().split('T')[0];
      const fmtBR = (d) => { const s = fmtISO(d).split('-'); return `${s[2]}/${s[1]}/${s[0]}`; };

      const mkFCParams = (ini, fim) => {
        const p = new URLSearchParams(); p.append('dataInicio', ini); p.append('dataFim', fim);
        if (codLoja) p.append('codLoja', codLoja); return p.toString();
      };
      const mkAuditParams = (ini, fim) => {
        const p = new URLSearchParams({ data_inicio: ini, data_fim: fim, produto: '', fornecedor: '', auditor: '' });
        if (codLoja) p.append('codLoja', codLoja); return p.toString();
      };

      const mkLossParams = (ini, fim) => {
        const p = new URLSearchParams({ data_inicio: ini, data_fim: fim, motivo: 'todos', tipo: 'todos' });
        if (codLoja) p.append('codLoja', codLoja); return p.toString();
      };

      const safe = (p) => p.catch((err) => { console.warn('Defesa API error:', err?.message); return { data: {} }; });

      const mkDREParams = (ini, fim) => {
        const p = new URLSearchParams({ dataInicio: ini, dataFim: fim, regime: 'caixa', incluirMovBanco: 'sim' });
        if (codLoja) p.append('codLoja', codLoja); return p.toString();
      };

      const [sellsRes, bipsRes, fcAt, fcMP, fcAP, rAt, rMP, rAP, eAt, eMP, eAP, bkAt, bkMP, bkAP, lsAt, lsMP, lsAP, trocasRes, dreRes] = await Promise.all([
        safe(api.get('/sells', { params: { page: 1, limit: 1, date_from: filters.dataInicio, date_to: filters.dataFim } })),
        safe(api.get('/bips', { params: { page: 1, limit: 1000, status: 'cancelled', date_from: filters.dataInicio, date_to: filters.dataFim } })),
        safe(api.get(`/frente-caixa/totais?${mkFCParams(fmtDateBR(filters.dataInicio), fmtDateBR(filters.dataFim))}`)),
        safe(api.get(`/frente-caixa/totais?${mkFCParams(fmtBR(mesPassIni), fmtBR(mesPassFim))}`)),
        safe(api.get(`/frente-caixa/totais?${mkFCParams(fmtBR(anoPassIni), fmtBR(anoPassFim))}`)),
        safe(api.get(`/rupture-surveys/agregado?${mkAuditParams(filters.dataInicio, filters.dataFim)}`)),
        safe(api.get(`/rupture-surveys/agregado?${mkAuditParams(fmtISO(mesPassIni), fmtISO(mesPassFim))}`)),
        safe(api.get(`/rupture-surveys/agregado?${mkAuditParams(fmtISO(anoPassIni), fmtISO(anoPassFim))}`)),
        safe(api.get(`/label-audits/agregado?${mkAuditParams(filters.dataInicio, filters.dataFim)}`)),
        safe(api.get(`/label-audits/agregado?${mkAuditParams(fmtISO(mesPassIni), fmtISO(mesPassFim))}`)),
        safe(api.get(`/label-audits/agregado?${mkAuditParams(fmtISO(anoPassIni), fmtISO(anoPassFim))}`)),
        safe(api.get('/santander/extrato-completo', { params: { initialDate: filters.dataInicio, finalDate: filters.dataFim, bankId: 'all' }, timeout: 120000 })),
        safe(api.get('/santander/extrato-completo', { params: { initialDate: fmtISO(mesPassIni), finalDate: fmtISO(mesPassFim), bankId: 'all' }, timeout: 120000 })),
        safe(api.get('/santander/extrato-completo', { params: { initialDate: fmtISO(anoPassIni), finalDate: fmtISO(anoPassFim), bankId: 'all' }, timeout: 120000 })),
        safe(api.get(`/losses/oracle?${mkLossParams(filters.dataInicio, filters.dataFim)}`)),
        safe(api.get(`/losses/oracle?${mkLossParams(fmtISO(mesPassIni), fmtISO(mesPassFim))}`)),
        safe(api.get(`/losses/oracle?${mkLossParams(fmtISO(anoPassIni), fmtISO(anoPassFim))}`)),
        safe(api.get('/losses/oracle/trocas', { params: { loja: codLoja || 1, tipo: 'saldo' } })),
        safe(api.get(`/demonstrativo-caixa/dados?${mkDREParams(filters.dataInicio, filters.dataFim)}`)),
      ]);

      // Não bipados
      const m = sellsRes.data.metrics || {};
      const totalV = m.total_value_cents || 0; const notV = m.total_not_verified_cents || 0;

      // Furtos
      const furtos = (bipsRes.data.data || []).filter(b => b.motivo_cancelamento === 'furto');
      const furtoVal = furtos.reduce((s, b) => s + (b.bip_price_cents || 0), 0);

      // Parse frente caixa
      const pFC = (r) => { const t = r.data?.success ? r.data.totais : (r.data?.totais || {}); const v = t.TOTAL_VENDAS || 0; return {
        cancel: (t.CANCELAMENTOS || 0) + (t.ESTORNOS_ORFAOS || 0), pctC: v > 0 ? (((t.CANCELAMENTOS||0)+(t.ESTORNOS_ORFAOS||0))/v*100) : 0,
        desc: t.TOTAL_DESCONTOS||0, pctD: v>0?((t.TOTAL_DESCONTOS||0)/v*100):0,
        vt: t.VALE_TROCA||0, pctVT: v>0?((t.VALE_TROCA||0)/v*100):0,
        vd: t.VALE_DESCONTO||0, sob: t.TOTAL_SOBRA||0, fal: t.TOTAL_QUEBRA||0, faturamento: v
      };};
      const fc1=pFC(fcAt), fc2=pFC(fcMP), fc3=pFC(fcAP);

      // Parse ruptura (usar campos direto de estatisticas)
      const pR = (r) => { const s=r.data?.estatisticas||{};
        return { taxa: Number(s.taxa_ruptura||0), pv: Number(s.perda_venda_periodo||0), pl: Number(s.perda_lucro_periodo||0) };};
      const r1=pR(rAt), r2=pR(rMP), r3=pR(rAP);

      // Parse etiqueta
      const pE = (r) => ({ taxa: Number(r.data?.estatisticas?.taxa_ruptura||0) });
      const e1=pE(eAt), e2=pE(eMP), e3=pE(eAP);

      // Parse banco (extrato santander)
      const pBK = (r) => { const t=r.data?.totais||{}; return (t.creditos||0) - (t.debitos||0); };
      const bk1=pBK(bkAt), bk2=pBK(bkMP), bk3=pBK(bkAP);

      // Parse perdas de estoque (losses/oracle) - Perdas - Ganhos
      const pLS = (r) => {
        const prods = r.data?.produtos_ranking || [];
        const perdas = prods.filter(p => p.quantidade < 0).reduce((a, p) => a + Math.abs(p.valorPerda || 0), 0);
        const entradas = prods.filter(p => p.quantidade > 0).reduce((a, p) => a + (p.valorPerda || 0), 0);
        return Math.round((perdas - entradas) * 100) / 100;
      };
      const ls1=pLS(lsAt), ls2=pLS(lsMP), ls3=pLS(lsAP);

      // Parse trocas fornecedor (saldo pendente - snapshot atual)
      const trocasEst = trocasRes.data?.estatisticas || {};
      const trocasCusto = Math.round((trocasEst.total_custo || 0) * 100) / 100;
      const trocasForns = trocasEst.total_fornecedores || 0;
      const trocasItens = Math.round((trocasEst.total_itens || 0) * 100) / 100;

      // Parse DRE (Demonstrativo de Caixa)
      const dreCats = dreRes.data?.categorias || [];
      let dreReceitas = 0, dreCustos = 0, dreDespesas = 0;
      for (const cat of dreCats) {
        const nome = (cat.DES_CATEGORIA || '').toUpperCase();
        const val = cat.VAL_QUITADO || 0;
        if (cat.IS_RECEITA) {
          dreReceitas += val;
        } else if (nome.includes('CUSTO')) {
          dreCustos += val;
        } else {
          dreDespesas += val;
        }
      }
      const dreLiquido = dreReceitas - dreCustos - dreDespesas;
      const drePctCustos = dreReceitas > 0 ? (dreCustos / dreReceitas * 100) : 0;
      const drePctDespesas = dreReceitas > 0 ? (dreDespesas / dreReceitas * 100) : 0;
      const drePctLiquido = dreReceitas > 0 ? (dreLiquido / dreReceitas * 100) : 0;

      setDefesaData({
        naoBipados: { valor: notV/100, pct: totalV>0?(notV/totalV*100):0, total: totalV/100 },
        furtos: { valor: furtoVal/100, qtd: furtos.length },
        cancelamentos: { atual: fc1.cancel, mesPassado: fc2.cancel, anoPassado: fc3.cancel, pct: fc1.pctC },
        descontos: { atual: fc1.desc, mesPassado: fc2.desc, anoPassado: fc3.desc, pct: fc1.pctD },
        valeTroca: { atual: fc1.vt, mesPassado: fc2.vt, anoPassado: fc3.vt, pct: fc1.pctVT },
        valeDesconto: { atual: fc1.vd, mesPassado: fc2.vd, anoPassado: fc3.vd },
        sobraCaixa: { atual: fc1.sob, mesPassado: fc2.sob, anoPassado: fc3.sob },
        faltaCaixa: { atual: fc1.fal, mesPassado: fc2.fal, anoPassado: fc3.fal },
        rupturaTaxa: { atual: r1.taxa, mesPassado: r2.taxa, anoPassado: r3.taxa },
        rupturaPerdaVenda: { atual: r1.pv, mesPassado: r2.pv, anoPassado: r3.pv },
        rupturaPerdaLucro: { atual: r1.pl, mesPassado: r2.pl, anoPassado: r3.pl },
        etiquetaTaxa: { atual: e1.taxa, mesPassado: e2.taxa, anoPassado: e3.taxa },
        fluxoCaixa: { atual: bk1, mesPassado: bk2, anoPassado: bk3 },
        perdasEstoque: { atual: ls1, mesPassado: ls2, anoPassado: ls3, pct: fc1.faturamento > 0 ? (ls1 / fc1.faturamento * 100) : 0 },
        trocasFornecedor: { atual: trocasCusto, fornecedores: trocasForns, itens: trocasItens },
        faturamento: { atual: fc1.faturamento, mesPassado: fc2.faturamento, anoPassado: fc3.faturamento },
        dre: { receitas: dreReceitas, custos: dreCustos, despesas: dreDespesas, liquido: dreLiquido, pctCustos: drePctCustos, pctDespesas: drePctDespesas, pctLiquido: drePctLiquido },
        loadingDefesa: false
      });
    } catch (err) {
      console.error('Erro ao buscar dados defesa:', err);
      setDefesaData(prev => ({ ...prev, loadingDefesa: false }));
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

  // Toggle vendas dia a dia
  const toggleVendasDiaDia = () => {
    if (analiseAtiva === 'vendas-dia-dia') {
      setAnaliseAtiva(null);
      setVendasDiaDia(null);
    } else {
      fetchVendasDiaDia(anoDiaDia, mesDiaDia);
    }
  };

  const fetchVendasDiaDia = async (ano = anoDiaDia, mes = mesDiaDia) => {
    setLoadingDiaDia(true);
    setAnaliseAtiva('vendas-dia-dia');
    try {
      const params = { ano, mes };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const tiposAtivos = [];
      if (tipoVenda.pdv) tiposAtivos.push(0);
      if (tipoVenda.nfCliente) tiposAtivos.push(1);
      if (tipoVenda.vendaBalcao) tiposAtivos.push(2);
      if (tipoVenda.nfTransferencia) tiposAtivos.push(8);
      if (tiposAtivos.length > 0 && tiposAtivos.length < 4) params.tipoVenda = tiposAtivos.join(',');
      const res = await api.get('/gestao-inteligente/vendas-dia-dia', { params });
      setVendasDiaDia(res.data);
      setAnoDiaDia(ano);
      setMesDiaDia(mes);
    } catch (err) {
      console.error('Erro vendas dia a dia:', err);
    } finally {
      setLoadingDiaDia(false);
    }
  };

  const mudarMesDiaDia = (delta) => {
    let novoMes = mesDiaDia + delta;
    let novoAno = anoDiaDia;
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    setMesDiaDia(novoMes);
    setAnoDiaDia(novoAno);
    if (analiseAtiva === 'vendas-dia-dia') fetchVendasDiaDia(novoAno, novoMes);
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
      const [response, inativasRes] = await Promise.all([
        api.get('/gestao-inteligente/vendas-analiticas-setor', { params }),
        api.get(`/compra-venda/secoes-inativas?codLoja=${lojaSelecionada || ''}`).catch(() => ({ data: { data: [] } }))
      ]);
      setVendasAnaliticas(response.data);
      setSecoesInativasGI(inativasRes.data?.data || []);
      setGraficoAnaliticaDrill({ level: 'secoes', data: response.data, breadcrumb: [{ label: 'Seções' }] });
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

  // Toggle seção inativa na Análise Comparativa
  const toggleSecaoInativaGI = async (codSecao) => {
    const cod = String(codSecao);
    const isInativa = secoesInativasGI.includes(cod);
    try {
      await api.post('/compra-venda/secoes-inativas/toggle', {
        codSecao: cod,
        codLoja: lojaSelecionada || null,
        ativa: isInativa
      });
      if (isInativa) {
        setSecoesInativasGI(prev => prev.filter(s => s !== cod));
      } else {
        setSecoesInativasGI(prev => [...prev, cod]);
      }
    } catch (err) {
      console.error('Erro ao toggle seção inativa:', err);
    }
  };

  // Cascata analítica: Expandir/Recolher seção → grupos
  const toggleAnaliticaSecao = async (codSecao) => {
    if (expandedAnaliticaSecoes[codSecao]) {
      setExpandedAnaliticaSecoes(prev => { const n = { ...prev }; delete n[codSecao]; return n; });
      // Se o gráfico estava mostrando os grupos dessa seção, voltar pra seções
      if (graficoAnaliticaDrill.level === 'grupos' && graficoAnaliticaDrill.breadcrumb[1]?.codSecao === codSecao) {
        setGraficoAnaliticaDrill({ level: 'secoes', data: vendasAnaliticasFiltradas, breadcrumb: [{ label: 'Seções' }] });
      }
      return;
    }
    setExpandedAnaliticaSecoes(prev => ({ ...prev, [codSecao]: { data: [], loading: true } }));
    try {
      const params = { dataInicio: filters.dataInicio, dataFim: filters.dataFim, codSecao };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const response = await api.get('/gestao-inteligente/grupos-analiticos', { params });
      setExpandedAnaliticaSecoes(prev => ({ ...prev, [codSecao]: { data: response.data, loading: false } }));
      // Atualizar gráfico para mostrar grupos da seção expandida
      const secaoInfo = vendasAnaliticas.find(s => s.codSecao === codSecao);
      setGraficoAnaliticaDrill({
        level: 'grupos', data: response.data,
        breadcrumb: [{ label: 'Seções' }, { label: secaoInfo?.setor || `Seção ${codSecao}`, codSecao }]
      });
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
      // Se o gráfico estava mostrando subgrupos desse grupo, voltar pra grupos
      const secExp = expandedAnaliticaSecoes[codSecao];
      if (graficoAnaliticaDrill.level === 'subgrupos' && secExp?.data) {
        const secaoInfo = vendasAnaliticas.find(s => s.codSecao === codSecao);
        setGraficoAnaliticaDrill({
          level: 'grupos', data: secExp.data,
          breadcrumb: [{ label: 'Seções' }, { label: secaoInfo?.setor || `Seção ${codSecao}`, codSecao }]
        });
      }
      return;
    }
    setExpandedAnaliticaGrupos(prev => ({ ...prev, [key]: { data: [], loading: true } }));
    try {
      const params = { dataInicio: filters.dataInicio, dataFim: filters.dataFim, codSecao, codGrupo };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const response = await api.get('/gestao-inteligente/subgrupos-analiticos', { params });
      setExpandedAnaliticaGrupos(prev => ({ ...prev, [key]: { data: response.data, loading: false } }));
      // Atualizar gráfico para mostrar subgrupos
      const secaoInfo = vendasAnaliticas.find(s => s.codSecao === codSecao);
      const grupoInfo = expandedAnaliticaSecoes[codSecao]?.data?.find(g => g.codGrupo === codGrupo);
      setGraficoAnaliticaDrill({
        level: 'subgrupos', data: response.data,
        breadcrumb: [
          { label: 'Seções' },
          { label: secaoInfo?.setor || `Seção ${codSecao}`, codSecao },
          { label: grupoInfo?.grupo || `Grupo ${codGrupo}`, codSecao, codGrupo }
        ]
      });
    } catch (err) {
      console.error('Erro ao buscar subgrupos analíticos:', err);
      setExpandedAnaliticaGrupos(prev => ({ ...prev, [key]: { data: [], loading: false } }));
    }
  };

  // Cascata analítica: Expandir/Recolher subgrupo → segmentos
  const toggleAnaliticaSubgrupo = async (codSubgrupo, codGrupo, codSecao) => {
    const key = `${codSecao}_${codGrupo}_${codSubgrupo}`;
    if (expandedAnaliticaSubgrupos[key]) {
      setExpandedAnaliticaSubgrupos(prev => { const n = { ...prev }; delete n[key]; return n; });
      const grpKey = `${codSecao}_${codGrupo}`;
      const grpExp = expandedAnaliticaGrupos[grpKey];
      if ((graficoAnaliticaDrill.level === 'segmentos' || graficoAnaliticaDrill.level === 'itens') && grpExp?.data) {
        const secaoInfo = vendasAnaliticas.find(s => s.codSecao === codSecao);
        const grupoInfo = expandedAnaliticaSecoes[codSecao]?.data?.find(g => g.codGrupo === codGrupo);
        setGraficoAnaliticaDrill({
          level: 'subgrupos', data: grpExp.data,
          breadcrumb: [
            { label: 'Seções' },
            { label: secaoInfo?.setor || `Seção ${codSecao}`, codSecao },
            { label: grupoInfo?.grupo || `Grupo ${codGrupo}`, codSecao, codGrupo }
          ]
        });
      }
      return;
    }
    setExpandedAnaliticaSubgrupos(prev => ({ ...prev, [key]: { data: [], loading: true, type: null } }));
    try {
      const params = { dataInicio: filters.dataInicio, dataFim: filters.dataFim, codSecao, codGrupo, codSubgrupo };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      // Tentar buscar segmentos primeiro
      const segResponse = await api.get('/gestao-inteligente/segmentos-analiticos', { params });
      const segmentos = segResponse.data.filter(s => s.codSegmento != null);
      if (segmentos.length > 0) {
        // Tem segmentos — mostrar nível de segmentos
        setExpandedAnaliticaSubgrupos(prev => ({ ...prev, [key]: { data: segmentos, loading: false, type: 'segmentos' } }));
      } else {
        // Sem segmentos — buscar itens diretamente
        const itensResponse = await api.get('/gestao-inteligente/itens-analiticos', { params });
        setExpandedAnaliticaSubgrupos(prev => ({ ...prev, [key]: { data: itensResponse.data, loading: false, type: 'itens' } }));
      }
      const secaoInfo = vendasAnaliticas.find(s => s.codSecao === codSecao);
      const grupoInfo = expandedAnaliticaSecoes[codSecao]?.data?.find(g => g.codGrupo === codGrupo);
      const subInfo = expandedAnaliticaGrupos[`${codSecao}_${codGrupo}`]?.data?.find(s => s.codSubgrupo === codSubgrupo);
      setGraficoAnaliticaDrill({
        level: segmentos.length > 0 ? 'segmentos' : 'itens', data: segmentos.length > 0 ? segmentos : segResponse.data,
        breadcrumb: [
          { label: 'Seções' },
          { label: secaoInfo?.setor || `Seção ${codSecao}`, codSecao },
          { label: grupoInfo?.grupo || `Grupo ${codGrupo}`, codSecao, codGrupo },
          { label: subInfo?.subgrupo || `Subgrupo ${codSubgrupo}`, codSecao, codGrupo, codSubgrupo }
        ]
      });
    } catch (err) {
      console.error('Erro ao buscar segmentos/itens analíticos:', err);
      setExpandedAnaliticaSubgrupos(prev => ({ ...prev, [key]: { data: [], loading: false, type: null } }));
    }
  };

  // Cascata analítica: Expandir/Recolher segmento → itens
  const toggleAnaliticaSegmento = async (codSegmento, codSubgrupo, codGrupo, codSecao) => {
    const key = `${codSecao}_${codGrupo}_${codSubgrupo}_${codSegmento}`;
    if (expandedAnaliticaSegmentos[key]) {
      setExpandedAnaliticaSegmentos(prev => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    setExpandedAnaliticaSegmentos(prev => ({ ...prev, [key]: { data: [], loading: true } }));
    try {
      const params = { dataInicio: filters.dataInicio, dataFim: filters.dataFim, codSecao, codGrupo, codSubgrupo, codSegmento };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const response = await api.get('/gestao-inteligente/itens-analiticos', { params });
      setExpandedAnaliticaSegmentos(prev => ({ ...prev, [key]: { data: response.data, loading: false } }));
    } catch (err) {
      console.error('Erro ao buscar itens do segmento:', err);
      setExpandedAnaliticaSegmentos(prev => ({ ...prev, [key]: { data: [], loading: false } }));
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

  // ===== ANALISE PRODUTOS ANUAL =====
  const fetchProdutoAnualSetores = async (ano = anoProdutoAnual) => {
    setLoadingProdutoAnual(true);
    setAnaliseAtiva('produto-anual');
    setProdutoAnualSetores([]);
    setExpandedProdAnualSecoes({});
    setExpandedProdAnualGrupos({});
    setExpandedProdAnualSubgrupos({});
    setProdutoSelecionadoGrafico(null);
    try {
      const params = { ano };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const response = await api.get('/gestao-inteligente/produto-anual-setores', { params });
      setProdutoAnualSetores(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar produto anual setores:', err);
      setProdutoAnualSetores([]);
    } finally {
      setLoadingProdutoAnual(false);
    }
  };

  const toggleProdutoAnual = () => {
    if (analiseAtiva === 'produto-anual') {
      setAnaliseAtiva(null);
      setProdutoAnualSetores([]);
    } else {
      fetchProdutoAnualSetores(anoProdutoAnual);
    }
  };

  const handleAnoProdutoAnualChange = (novoAno) => {
    setAnoProdutoAnual(novoAno);
    if (analiseAtiva === 'produto-anual') fetchProdutoAnualSetores(novoAno);
  };

  const toggleProdAnualSecao = async (codSecao) => {
    if (expandedProdAnualSecoes[codSecao]) {
      const copy = { ...expandedProdAnualSecoes };
      delete copy[codSecao];
      setExpandedProdAnualSecoes(copy);
      return;
    }
    setExpandedProdAnualSecoes(prev => ({ ...prev, [codSecao]: { loading: true, data: [] } }));
    try {
      const params = { ano: anoProdutoAnual, codSecao };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const res = await api.get('/gestao-inteligente/produto-anual-grupos', { params });
      setExpandedProdAnualSecoes(prev => ({ ...prev, [codSecao]: { loading: false, data: res.data || [] } }));
    } catch (err) {
      console.error('Erro grupos produto anual:', err);
      setExpandedProdAnualSecoes(prev => ({ ...prev, [codSecao]: { loading: false, data: [] } }));
    }
  };

  const toggleProdAnualGrupo = async (codGrupo, codSecao) => {
    const key = `${codSecao}_${codGrupo}`;
    if (expandedProdAnualGrupos[key]) {
      const copy = { ...expandedProdAnualGrupos };
      delete copy[key];
      setExpandedProdAnualGrupos(copy);
      return;
    }
    setExpandedProdAnualGrupos(prev => ({ ...prev, [key]: { loading: true, data: [] } }));
    try {
      const params = { ano: anoProdutoAnual, codGrupo, codSecao };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const res = await api.get('/gestao-inteligente/produto-anual-subgrupos', { params });
      setExpandedProdAnualGrupos(prev => ({ ...prev, [key]: { loading: false, data: res.data || [] } }));
    } catch (err) {
      console.error('Erro subgrupos produto anual:', err);
      setExpandedProdAnualGrupos(prev => ({ ...prev, [key]: { loading: false, data: [] } }));
    }
  };

  const toggleProdAnualSubgrupo = async (codSubgrupo, codGrupo, codSecao) => {
    const key = `${codSecao}_${codGrupo}_${codSubgrupo}`;
    if (expandedProdAnualSubgrupos[key]) {
      const copy = { ...expandedProdAnualSubgrupos };
      delete copy[key];
      setExpandedProdAnualSubgrupos(copy);
      return;
    }
    setExpandedProdAnualSubgrupos(prev => ({ ...prev, [key]: { loading: true, data: [] } }));
    try {
      const params = { ano: anoProdutoAnual, codSubgrupo, codGrupo, codSecao };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const res = await api.get('/gestao-inteligente/produto-anual-itens', { params });
      setExpandedProdAnualSubgrupos(prev => ({ ...prev, [key]: { loading: false, data: res.data || [] } }));
    } catch (err) {
      console.error('Erro itens produto anual:', err);
      setExpandedProdAnualSubgrupos(prev => ({ ...prev, [key]: { loading: false, data: [] } }));
    }
  };

  // Helper para formatar células da tabela Produto Anual conforme métrica selecionada
  const fmtProdAnualCell = (v) => {
    if (!v && v !== 0) return '-';
    if (['margem', 'margemLimpa', 'pctOferta'].includes(produtoAnualMetrica)) return formatPercent(v);
    if (['cupons', 'skus', 'qtd'].includes(produtoAnualMetrica)) return formatNumber(v);
    return formatCurrency(v);
  };

  // NÃO carregar automaticamente ao abrir - só ao clicar "Buscar"

  // Carregar dados DEFESA apenas quando ativar o modo (sem reagir a filtros)
  useEffect(() => {
    if (modoVisao === 'defesa' && indicadores.vendas.atual > 0) {
      fetchDefesaData();
    }
  }, [modoVisao]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nenhum auto-fetch ao mudar filtros - tudo controlado pelo botão "Buscar"

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
      getExtra: () => (
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-green-600">({formatNumber(indicadores.qtdCupons?.atual)} cupons)</span>
          <button onClick={(e) => { e.stopPropagation(); setTicketFaixasTemp(JSON.parse(JSON.stringify(ticketFaixas))); setShowTicketFaixasModal(true); }} className="p-1 hover:bg-gray-100 rounded-full transition-colors" title="Configurar ticket médio por área">
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>
        </div>
      ),
      tipo: 'currency',
      indicador: 'ticketMedio',
      getFooterExtra: () => {
        const esperado = getTicketMedioEsperado();
        if (esperado === null) return null;
        const atual = indicadores.ticketMedio?.atual || 0;
        const dentro = atual >= esperado;
        const diff = atual - esperado;
        return { dentro, esperado, diff };
      },
    },
    pctCompraVenda: {
      borderColor: 'border-orange-500',
      bgColor: 'bg-orange-100',
      iconColor: 'text-orange-600',
      icon: <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>,
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
    valorEstoque: {
      borderColor: 'border-fuchsia-500', bgColor: 'bg-fuchsia-100', iconColor: 'text-fuchsia-600',
      icon: <svg className="w-5 h-5 text-fuchsia-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
      label: 'Estoque', title: 'VALOR ESTOQUE',
      getValue: () => formatCurrency(produtosRevenda.valorEstoque),
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
    impostoPrevisto: {
      borderColor: 'border-emerald-500', bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600',
      icon: <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>,
      label: 'Impostos', title: 'IMPOSTO PREVISTO',
      getValue: () => {
        const pct = (indicadores.markdown?.atual || 0) - (indicadores.margemLimpa?.atual || 0);
        return formatPercent(pct);
      },
      getExtra: () => {
        const pct = (indicadores.markdown?.atual || 0) - (indicadores.margemLimpa?.atual || 0);
        const vendas = indicadores.vendas?.atual || 0;
        const val = vendas * (pct / 100);
        return <span className="text-sm font-semibold text-red-500">({formatCurrency(val)})</span>;
      },
      tipo: 'currency', indicador: 'impostos'
    },
    produtosRevenda: {
      borderColor: 'border-gray-300', bgColor: 'bg-gray-100', iconColor: 'text-gray-400',
      icon: <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>,
      label: 'Novo', title: 'EM BREVE',
      emBreve: true,
    },
    excessoCompras: {
      borderColor: 'border-purple-500', bgColor: 'bg-purple-100', iconColor: 'text-purple-600',
      icon: <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>,
      label: 'Excesso Compras', title: 'EXCESSO DE COMPRAS',
      getValue: () => formatPercent(indicadores.excessoCompras?.atual || 0),
      getExtra: () => {
        const val = indicadores.excessoComprasRs?.atual || 0;
        return <span className={`text-sm font-semibold ${val >= 0 ? 'text-green-600' : 'text-red-500'}`}>({formatCurrency(val)})</span>;
      },
      tipo: 'percent', indicador: 'excessoCompras'
    },
    margemCV: {
      borderColor: 'border-orange-500', bgColor: 'bg-orange-100', iconColor: 'text-orange-600',
      icon: <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
      label: 'Margem C&V', title: 'MARGEM COMPRA E VENDA',
      getValue: () => formatPercent(indicadores.margemCV?.atual || 0),
      tipo: 'percent', indicador: 'margemCV'
    },
    vendasPorMetro: {
      borderColor: 'border-cyan-500', bgColor: 'bg-cyan-100', iconColor: 'text-cyan-600',
      icon: <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
      label: 'Vendas/m²', title: 'VENDAS POR MTRS',
      getValue: () => areaVenda > 0 ? formatCurrency((indicadores.vendas?.atual || 0) / areaVenda) : '-',
      getExtra: () => (
        <div className="flex items-center gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); setAreaVendaTemp(areaVenda); setVendasFaixasTemp(JSON.parse(JSON.stringify(vendasFaixas))); setShowAreaVendaModal(true); }} className="p-1 hover:bg-gray-100 rounded-full transition-colors" title="Configurar área de venda">
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); setVendasFaixasTemp(JSON.parse(JSON.stringify(vendasFaixas))); setShowVendasFaixasModal(true); }} className="p-1 hover:bg-gray-100 rounded-full transition-colors" title="Configurar faixas Vendas/M²">
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </button>
        </div>
      ),
      customCard: true,
    },
    skuPorMetro: {
      borderColor: 'border-sky-500', bgColor: 'bg-sky-100', iconColor: 'text-sky-600',
      icon: <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>,
      label: 'SKU/m²', title: 'SKU POR M²',
      getValue: () => areaVenda > 0 ? (((produtosRevenda.qtdProdutos || 0) + (produtosRevenda.qtdProducao || 0)) / areaVenda).toFixed(2).replace('.', ',') : '-',
      getExtra: () => (
        <button onClick={(e) => { e.stopPropagation(); setSkuFaixasTemp(JSON.parse(JSON.stringify(skuFaixas))); setShowSkuFaixasModal(true); }} className="p-1 hover:bg-gray-100 rounded-full transition-colors" title="Configurar faixas SKU/M²">
          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </button>
      ),
      customCard: true,
    },
    skuVendidoPorMetro: {
      borderColor: 'border-blue-500', bgColor: 'bg-blue-100', iconColor: 'text-blue-600',
      icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>,
      label: 'SKU Vend/m²', title: 'SKU VENDIDO POR M²',
      getValue: () => areaVenda > 0 ? ((indicadores.qtdSkus?.atual || 0) / areaVenda).toFixed(2).replace('.', ',') : '-',
      customCard: true,
    },
    produtosProducao: {
      borderColor: 'border-gray-300', bgColor: 'bg-gray-100', iconColor: 'text-gray-400',
      icon: <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>,
      label: 'Novo', title: 'EM BREVE',
      emBreve: true,
    },
    produtosLojaTodos: {
      borderColor: 'border-violet-500', bgColor: 'bg-violet-100', iconColor: 'text-violet-600',
      icon: <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>,
      label: 'Todos', title: 'PRODUTOS EM LOJA',
      getValue: () => ((produtosRevenda.qtdProdutos || 0) + (produtosRevenda.qtdProducao || 0)).toLocaleString('pt-BR'),
      getExtra: () => <span className="text-xs text-gray-400">Direta + Producao</span>,
      customCard: true,
    },
    emBreveC: {
      borderColor: 'border-gray-300', bgColor: 'bg-gray-100', iconColor: 'text-gray-400',
      icon: <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>,
      label: 'Novo', title: 'EM BREVE',
      emBreve: true,
    }
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
          className={`bg-white rounded-xl shadow-lg p-3 sm:p-4 border-t-4 ${config.borderColor} hover:shadow-xl transition-all cursor-grab active:cursor-grabbing h-full flex flex-col justify-between ${isDragging ? 'opacity-50 scale-95' : ''}`}
        >
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 ${config.bgColor} rounded-lg flex items-center justify-center`}>
                {config.icon}
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
                {config.label}
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-400 mb-1">-</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3">EM BREVE</p>
          </div>
          <div className="space-y-1 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-300">Indicador em desenvolvimento</p>
          </div>
        </div>
      );
    }

    if (config.customCard) {
      const isMetroCard = ['vendasPorMetro', 'skuPorMetro', 'skuVendidoPorMetro'].includes(cardId);
      const isVendasMetro = cardId === 'vendasPorMetro';
      const isSkuMetro = cardId === 'skuPorMetro';
      // Calcular valor projetado/m² para o card vendasPorMetro
      let valorProjetadoMetro = null;
      if (isVendasMetro && areaVenda > 0) {
        const vendaAtual = indicadores.vendas?.atual || 0;
        const hoje = new Date();
        const diaAnterior = hoje.getDate() - 1;
        const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        if (diaAnterior > 0 && vendaAtual > 0) {
          const mediaDia = vendaAtual / diaAnterior;
          const projetadoMes = mediaDia * diasNoMes;
          valorProjetadoMetro = projetadoMes / areaVenda;
        }
      }
      return (
        <div
          key={cardId}
          draggable
          onDragStart={(e) => handleDragStart(e, cardId, row)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, cardId, row)}
          className={`bg-white rounded-xl shadow-lg p-3 sm:p-4 border-t-4 ${config.borderColor} hover:shadow-xl transition-all cursor-grab active:cursor-grabbing h-full ${isDragging ? 'opacity-50 scale-95' : ''}`}
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 ${config.bgColor} rounded-lg flex items-center justify-center`}>
              {config.icon}
            </div>
            <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
              {config.getExtra && config.getExtra()}
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <p className="text-xl sm:text-2xl font-bold text-gray-800">{config.getValue()}</p>
            {isSkuMetro && areaVenda > 0 && (() => {
              const classif = getSkuClassificacao(config.getValue());
              if (!classif) return null;
              const cores = skuClassifCores[classif.label] || {};
              return <span className={`text-xs sm:text-sm font-bold px-2 py-0.5 rounded-full ${cores.text} ${cores.bg} border ${cores.border}`}>{classif.label}</span>;
            })()}
            {isVendasMetro && areaVenda > 0 && (() => {
              const vendasMetroVal = (indicadores.vendas?.atual || 0) / areaVenda;
              const classif = getVendasClassificacao(vendasMetroVal);
              if (!classif) return null;
              const cores = skuClassifCores[classif.label] || {};
              return <span className={`text-xs sm:text-sm font-bold px-2 py-0.5 rounded-full ${cores.text} ${cores.bg} border ${cores.border}`}>{classif.label}</span>;
            })()}
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3">{config.title}</p>
          <div className="space-y-1 pt-2 border-t border-gray-100">
            {isMetroCard ? (
              areaVenda > 0 ? (
                <>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Area de Venda:</span><span className="font-medium text-gray-600">{formatNumber(areaVenda)} m²</span></div>
                  {isVendasMetro && valorProjetadoMetro !== null ? (() => {
                    const classifProj = getVendasClassificacao(valorProjetadoMetro);
                    const coresProj = classifProj ? (skuClassifCores[classifProj.label] || {}) : {};
                    return (
                      <>
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-gray-400">Projetado:</span>
                          <span className="flex items-center gap-1">
                            <span className="font-medium text-gray-600">{formatCurrency(valorProjetadoMetro)}</span>
                            {classifProj && <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded-full ${coresProj.text} ${coresProj.bg} border ${coresProj.border}`}>{classifProj.label}</span>}
                          </span>
                        </div>
                      </>
                    );
                  })() : (
                    <div className="flex justify-between text-xs"><span className="text-gray-400">&nbsp;</span></div>
                  )}
                  <div className="flex justify-between text-xs"><span className="text-gray-400">&nbsp;</span></div>
                </>
              ) : (
                <>
                  <p className="text-xs text-amber-500">Configure a area de venda (m²)</p>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">&nbsp;</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">&nbsp;</span></div>
                </>
              )
            ) : (
              <>
                <div className="flex justify-between text-xs"><span className="text-gray-400">Revenda:</span><span className="font-medium text-gray-600">{(produtosRevenda.qtdProdutos || 0).toLocaleString('pt-BR')}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400">Producao:</span><span className="font-medium text-gray-600">{(produtosRevenda.qtdProducao || 0).toLocaleString('pt-BR')}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400">&nbsp;</span></div>
              </>
            )}
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
        className={`bg-white rounded-xl shadow-lg p-3 sm:p-4 border-t-4 ${config.borderColor} hover:shadow-xl transition-all cursor-grab active:cursor-grabbing h-full ${isDragging ? 'opacity-50 scale-95' : ''}`}
      >
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 ${config.bgColor} rounded-lg flex items-center justify-center`}>
            {config.icon}
          </div>
          <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
            {config.label}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2 mb-1">
          <p className="text-xl sm:text-2xl font-bold text-gray-800">{config.getValue()}</p>
          {config.getExtra && config.getExtra()}
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3">{config.title}</p>
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <Comparativo label="Mes Passado" valor={indicador?.mesPassado} valorAtual={indicador?.atual} tipo={config.tipo} invertido={config.invertido} />
          <Comparativo label="Ano Passado" valor={indicador?.anoPassado} valorAtual={indicador?.atual} tipo={config.tipo} invertido={config.invertido} />
          <Comparativo label="Média Projetada" valor={indicador?.mediaLinear} valorAtual={indicador?.atual} tipo={config.tipo} invertido={config.invertido} />
          {indicador?.atual != null && ['vendas', 'custoVendas', 'lucro'].includes(config.indicador) && (() => {
            const dtIni = new Date(filters.dataInicio + 'T00:00:00');
            const dtFim = new Date(filters.dataFim + 'T00:00:00');
            const diasPassados = Math.max(1, Math.round((dtFim - dtIni) / 86400000) + 1);
            const diasDoMes = new Date(dtFim.getFullYear(), dtFim.getMonth() + 1, 0).getDate();
            const mediaLinearCalc = (indicador.atual / diasPassados) * diasDoMes;
            const formatVal = config.tipo === 'currency' ? formatCurrency(mediaLinearCalc) : config.tipo === 'number' ? Math.round(mediaLinearCalc).toLocaleString('pt-BR') : formatPercent(mediaLinearCalc);
            return (
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Média Linear:</span>
                <span className="font-semibold text-gray-700">{formatVal}</span>
              </div>
            );
          })()}
          {config.getFooterExtra && (() => {
            const info = config.getFooterExtra();
            if (!info) return null;
            return (
              <div className={`flex justify-between text-xs items-center pt-1 border-t border-gray-100 mt-1`}>
                <span className={`font-bold px-1.5 py-0.5 rounded ${info.dentro ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                  {info.dentro ? 'DENTRO DA MEDIA' : 'FORA DA MEDIA'}
                </span>
                <span className={`font-semibold ${info.dentro ? 'text-green-600' : 'text-red-600'}`}>
                  {info.diff >= 0 ? '+' : ''}{formatCurrency(info.diff)}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="min-w-0">
        {/* Header Laranja - Compacto */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg px-3 sm:px-4 py-3 mb-4 sm:mb-6">
          {/* Linha 1: Titulo + Periodo */}
          <div className="flex items-center gap-2 mb-2">
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
              <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full" fill="none" stroke="white" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" opacity="0.5" />
                <circle cx="12" cy="12" r="6" opacity="0.3" />
                <circle cx="12" cy="12" r="2" fill="white" stroke="white" />
              </svg>
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
                <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="white">
                  <line x1="12" y1="12" x2="20" y2="8" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white truncate">Gestao Inteligente</h1>
            <span className="bg-white/20 text-white px-2 sm:px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap">
              {formatPeriodo()}
            </span>
          </div>
          {/* Linha 2: Botoes ATAQUE/DEFESA + Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Botões ATAQUE / DEFESA */}
            <div className="flex rounded-lg overflow-hidden border border-white/30">
              <button
                onClick={() => setModoVisao('ataque')}
                className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-1 ${
                  modoVisao === 'ataque'
                    ? 'bg-white text-orange-600 shadow-inner'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                ATAQUE
              </button>
              <button
                onClick={() => setModoVisao('defesa')}
                className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-1 ${
                  modoVisao === 'defesa'
                    ? 'bg-white text-blue-600 shadow-inner'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                DEFESA
              </button>
            </div>

            {/* Tipo Venda */}
            <div className="flex flex-wrap items-center gap-2 ml-2">
              {[
                { key: 'pdv', label: 'PDV' },
                { key: 'combustivel', label: 'Combustível' },
                { key: 'vendaBalcao', label: 'Vda Balcão' },
                { key: 'ecommerce', label: 'e-Commerce' },
                { key: 'nfCliente', label: 'NF Cliente' },
                { key: 'nfTransferencia', label: 'NF Transf.' },
              ].map(t => (
                <label key={t.key} className="flex items-center gap-1 text-xs sm:text-sm text-white cursor-pointer select-none">
                  <input type="checkbox" checked={tipoVenda[t.key]}
                    onChange={e => setTipoVenda(prev => ({ ...prev, [t.key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-2 border-white bg-white/20 checked:bg-white checked:text-orange-600 accent-orange-500" />
                  {t.label}
                </label>
              ))}
            </div>

            {/* Filtros de data */}
            <div className="flex items-center gap-1.5 ml-auto">
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                className="bg-white rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm text-gray-700 w-[110px] sm:w-auto"
              />
              <span className="text-white text-xs sm:text-sm">a</span>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                className="bg-white rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm text-gray-700 w-[110px] sm:w-auto"
              />
              <button
                onClick={() => {
                  fetchIndicadores();
                  fetchProdutosRevenda();
                  if (analiseAtiva === 'vendas-analiticas') {
                    fetchVendasAnaliticas();
                  } else {
                    // Ativa vendas-analiticas e busca
                    fetchVendasAnaliticas();
                  }
                  if (modoVisao === 'defesa') fetchDefesaData();
                }}
                disabled={loading || loadingVendasAnaliticas}
                className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
                title="Buscar dados do período"
              >
                {(loading || loadingVendasAnaliticas) ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                Buscar
              </button>
              <button
                onClick={handleClearCache}
                disabled={clearingCache}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
                title="Limpar cache e atualizar"
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
        {!loading && !error && modoVisao === 'ataque' && (
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

          {/* Linha 4 - Cards Metro Quadrado (Drag and Drop) */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {cardOrder4.map((cardId) => renderCard(cardId, 4))}
          </div>

          {/* Linha de Cards de Análise - Sempre visível */}
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
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
                  className={`rounded-lg shadow-sm p-2 sm:p-3 border hover:shadow-md transition-all cursor-pointer select-none ${
                    analiseAtiva === cardId ? cfg.active : cfg.inactive
                  } ${draggedAnaliseCard === cardId ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-7 h-7 ${cfg.icon} rounded flex items-center justify-center`}>
                      <span className="text-base">{cfg.emoji}</span>
                    </div>
                    <p className={`text-xs sm:text-sm font-bold ${cfg.title} leading-tight`}>{cfg.label}</p>
                  </div>
                  <p className={`text-[9px] sm:text-xs ${cfg.sub}`}>{cfg.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Conteúdo das Análises */}
              {/* Tabela de Vendas por Dia da Semana - 3 sub-colunas por mês */}
              {analiseAtiva === 'vendas-dia-semana' && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                    <h3 className="text-white font-semibold text-sm sm:text-base">Analise Linear Dia da Semana</h3>
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

              {/* Venda Dia a Dia */}
              {analiseAtiva === 'vendas-dia-dia' && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-white font-semibold text-sm sm:text-base">Venda Dia a Dia</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => mudarMesDiaDia(-1)} className="text-white hover:bg-orange-600 rounded px-2 py-1 text-sm">◀</button>
                      <span className="text-white font-bold text-sm">
                        {['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][mesDiaDia]} {anoDiaDia}
                      </span>
                      <button onClick={() => mudarMesDiaDia(1)} className="text-white hover:bg-orange-600 rounded px-2 py-1 text-sm">▶</button>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-2 flex flex-wrap gap-1 border-b">
                    {[
                      { key: 'venda', label: 'Vendas' }, { key: 'custo', label: 'Custo' }, { key: 'lucro', label: 'Lucro' },
                      { key: 'markdown', label: 'Markdown %' }, { key: 'mgLimpa', label: 'MG Limpa %' }, { key: 'impostos', label: 'Impostos' },
                      { key: 'ticketMedio', label: 'Ticket Medio' }, { key: 'vendaOferta', label: 'Vendas Oferta' }, { key: 'pctOferta', label: '% Oferta' },
                      { key: 'cupons', label: 'Cupons' }, { key: 'skus', label: 'SKUs' }, { key: 'qtd', label: 'Qtd' }
                    ].map(m => (
                      <button key={m.key} onClick={() => setMetricaDiaDia(m.key)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${metricaDiaDia === m.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    // Cores por dia da semana
                    const corDia = { 'Dom': 'bg-red-50', 'Seg': 'bg-blue-50', 'Ter': 'bg-green-50', 'Qua': 'bg-yellow-50', 'Qui': 'bg-purple-50', 'Sex': 'bg-orange-50', 'Sáb': 'bg-pink-50' };
                    const corDiaHeader = { 'Dom': 'bg-red-100 text-red-700', 'Seg': 'bg-blue-100 text-blue-700', 'Ter': 'bg-green-100 text-green-700', 'Qua': 'bg-yellow-100 text-yellow-700', 'Qui': 'bg-purple-100 text-purple-700', 'Sex': 'bg-orange-100 text-orange-700', 'Sáb': 'bg-pink-100 text-pink-700' };
                    if (vendasDiaDia) { vendasDiaDia._corDia = corDia; vendasDiaDia._corDiaHeader = corDiaHeader; }
                    return null;
                  })()}
                  {(() => {
                    // Reordenar dias por dia da semana quando modo = 'semana'
                    if (vendasDiaDia?.diasInfo && modoDiaDia === 'semana') {
                      const ordem = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                      vendasDiaDia._diasOrdenados = [...vendasDiaDia.diasInfo].sort((a, b) => ordem.indexOf(a.diaSemana) - ordem.indexOf(b.diaSemana));
                    } else if (vendasDiaDia?.diasInfo) {
                      vendasDiaDia._diasOrdenados = vendasDiaDia.diasInfo;
                    }
                    return null;
                  })()}
                  {loadingDiaDia ? (
                    <div className="p-8 text-center text-gray-400">Carregando...</div>
                  ) : vendasDiaDia && vendasDiaDia.setores?.length > 0 ? (
                    <div className="overflow-auto max-h-[70vh]">
                      <table className="w-full text-xs border-collapse">
                        <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20">
                          <tr className="bg-orange-100">
                            <th rowSpan={2} className="px-3 py-2 text-left font-bold text-orange-800 border-b border-r border-orange-200 min-w-[180px] sticky left-0 bg-orange-100 z-30">
                              <div>SETOR</div>
                              <div className="flex gap-2 mt-1">
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input type="radio" name="modoDiaDia" checked={modoDiaDia === 'corrente'} onChange={() => setModoDiaDia('corrente')} className="w-3 h-3" />
                                  <span className="text-[9px] font-normal">Dia Corrente</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input type="radio" name="modoDiaDia" checked={modoDiaDia === 'semana'} onChange={() => setModoDiaDia('semana')} className="w-3 h-3" />
                                  <span className="text-[9px] font-normal">Dia da Semana</span>
                                </label>
                              </div>
                            </th>
                            {vendasDiaDia._diasOrdenados.map(d => (
                              <th key={d.dia} className={`px-2 py-1 text-center font-bold border-b border-orange-200 min-w-[85px] ${vendasDiaDia._corDiaHeader?.[d.diaSemana] || 'text-orange-700'} ${d.dia > vendasDiaDia.ultimoDia ? 'opacity-30' : ''}`}>
                                Dia {d.dia}
                              </th>
                            ))}
                            <th rowSpan={2} className="px-3 py-2 text-right font-bold text-orange-900 border-b border-l-2 border-orange-300 min-w-[110px] bg-orange-200">TOTAL</th>
                          </tr>
                          <tr className="bg-orange-50">
                            {vendasDiaDia._diasOrdenados.map(d => (
                              <th key={`ds-${d.dia}`} className={`px-2 py-1 text-center text-[10px] font-bold border-b border-orange-200 ${vendasDiaDia._corDiaHeader?.[d.diaSemana] || 'text-orange-600'} ${d.dia > vendasDiaDia.ultimoDia ? 'opacity-30' : ''}`}>
                                {d.diaSemana}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const isPct = ['markdown', 'mgLimpa', 'pctOferta'].includes(metricaDiaDia);
                            const isInt = ['cupons', 'skus'].includes(metricaDiaDia);
                            const fmtVal = (v) => {
                              if (!v && v !== 0) return '-';
                              if (isPct) return v.toFixed(2) + '%';
                              if (isInt) return Math.round(v).toLocaleString('pt-BR');
                              return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            };
                            const getVal = (diaObj) => diaObj ? (diaObj[metricaDiaDia] || 0) : 0;
                            return vendasDiaDia.setores.map((setor, idx) => {
                              const total = Object.values(setor.dias).reduce((s, d) => s + getVal(d), 0);
                              let totalForPct = total;
                              if (isPct) {
                                const tV = Object.values(setor.dias).reduce((s, d) => s + (d?.venda || 0), 0);
                                const tC = Object.values(setor.dias).reduce((s, d) => s + (d?.custo || 0), 0);
                                const tI = Object.values(setor.dias).reduce((s, d) => s + (d?.impostos || 0), 0);
                                const tO = Object.values(setor.dias).reduce((s, d) => s + (d?.vendaOferta || 0), 0);
                                if (metricaDiaDia === 'markdown') totalForPct = tV > 0 ? ((tV - tC) / tV) * 100 : 0;
                                else if (metricaDiaDia === 'mgLimpa') totalForPct = tV > 0 ? ((tV - tC - tI) / tV) * 100 : 0;
                                else if (metricaDiaDia === 'pctOferta') totalForPct = tV > 0 ? (tO / tV) * 100 : 0;
                              }
                              return (
                                <tr key={setor.codSecao} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50`}>
                                  <td className={`px-3 py-2 font-semibold text-gray-800 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>{setor.secao}</td>
                                  {vendasDiaDia._diasOrdenados.map(d => {
                                    const val = getVal(setor.dias[d.dia]);
                                    return (
                                      <td key={d.dia} className={`px-2 py-2 text-right font-mono ${vendasDiaDia._corDia?.[d.diaSemana] || ''} ${val > 0 ? 'text-gray-700' : val < 0 ? 'text-red-600' : 'text-gray-300'} ${d.dia > vendasDiaDia.ultimoDia ? 'opacity-30' : ''}`}>
                                        {val !== 0 ? fmtVal(val) : '-'}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-right font-bold text-orange-700 border-l-2 border-orange-200 font-mono">
                                    {fmtVal(isPct ? totalForPct : total)}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                          {/* Linha TOTAL */}
                          {/* Linha TOTAL */}
                          <tr className="bg-orange-200 font-bold border-t-2 border-orange-300">
                            <td className="px-3 py-2 text-orange-900 sticky left-0 bg-orange-200 z-10">TOTAL</td>
                            {(() => {
                              const isPct = ['markdown', 'mgLimpa', 'pctOferta'].includes(metricaDiaDia);
                              const isInt = ['cupons', 'skus'].includes(metricaDiaDia);
                              const fmtVal = (v) => {
                                if (!v && v !== 0) return '-';
                                if (isPct) return v.toFixed(2) + '%';
                                if (isInt) return Math.round(v).toLocaleString('pt-BR');
                                return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              };
                              return vendasDiaDia._diasOrdenados.map(d => {
                                let val = 0;
                                if (isPct) {
                                  const tV = vendasDiaDia.setores.reduce((s, st) => s + (st.dias[d.dia]?.venda || 0), 0);
                                  const tC = vendasDiaDia.setores.reduce((s, st) => s + (st.dias[d.dia]?.custo || 0), 0);
                                  const tI = vendasDiaDia.setores.reduce((s, st) => s + (st.dias[d.dia]?.impostos || 0), 0);
                                  const tO = vendasDiaDia.setores.reduce((s, st) => s + (st.dias[d.dia]?.vendaOferta || 0), 0);
                                  if (metricaDiaDia === 'markdown') val = tV > 0 ? ((tV - tC) / tV) * 100 : 0;
                                  else if (metricaDiaDia === 'mgLimpa') val = tV > 0 ? ((tV - tC - tI) / tV) * 100 : 0;
                                  else if (metricaDiaDia === 'pctOferta') val = tV > 0 ? (tO / tV) * 100 : 0;
                                } else {
                                  val = vendasDiaDia.setores.reduce((s, st) => s + (st.dias[d.dia] ? (st.dias[d.dia][metricaDiaDia] || 0) : 0), 0);
                                }
                                return (
                                  <td key={`t-${d.dia}`} className={`px-2 py-2 text-right font-mono text-orange-900 ${d.dia > vendasDiaDia.ultimoDia ? 'opacity-30' : ''}`}>
                                    {val !== 0 ? fmtVal(val) : '-'}
                                  </td>
                                );
                              });
                            })()}
                            <td className="px-3 py-2 text-right font-mono text-orange-900 border-l-2 border-orange-300">
                              {(() => {
                                const isPct = ['markdown', 'mgLimpa', 'pctOferta'].includes(metricaDiaDia);
                                const isInt = ['cupons', 'skus'].includes(metricaDiaDia);
                                if (isPct) {
                                  const tV = vendasDiaDia.setores.reduce((s, st) => s + Object.values(st.dias).reduce((a, d) => a + (d?.venda || 0), 0), 0);
                                  const tC = vendasDiaDia.setores.reduce((s, st) => s + Object.values(st.dias).reduce((a, d) => a + (d?.custo || 0), 0), 0);
                                  const tI = vendasDiaDia.setores.reduce((s, st) => s + Object.values(st.dias).reduce((a, d) => a + (d?.impostos || 0), 0), 0);
                                  const tO = vendasDiaDia.setores.reduce((s, st) => s + Object.values(st.dias).reduce((a, d) => a + (d?.vendaOferta || 0), 0), 0);
                                  let val = 0;
                                  if (metricaDiaDia === 'markdown') val = tV > 0 ? ((tV - tC) / tV) * 100 : 0;
                                  else if (metricaDiaDia === 'mgLimpa') val = tV > 0 ? ((tV - tC - tI) / tV) * 100 : 0;
                                  else if (metricaDiaDia === 'pctOferta') val = tV > 0 ? (tO / tV) * 100 : 0;
                                  return val.toFixed(2) + '%';
                                }
                                const total = vendasDiaDia.setores.reduce((s, st) => s + Object.values(st.dias).reduce((a, d) => a + (d ? (d[metricaDiaDia] || 0) : 0), 0), 0);
                                if (isInt) return Math.round(total).toLocaleString('pt-BR');
                                return total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-400">Nenhum dado encontrado</div>
                  )}
                </div>
              )}

              {/* Analise por Ano - Meses nas colunas, indicadores nas linhas */}
              {analiseAtiva === 'vendas-ano' && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                    <h3 className="text-white font-semibold text-sm sm:text-base">Analise por Ano</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setShowGraficoAno(prev => !prev)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${showGraficoAno ? 'bg-white text-orange-600' : 'bg-white/20 hover:bg-white/30 text-white'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                        Gráfico
                      </button>
                      <button onClick={() => handleAnoChange(anoSelecionado - 1)} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                      </button>
                      <span className="text-white font-bold text-lg min-w-[60px] text-center">{anoSelecionado}</span>
                      <button onClick={() => handleAnoChange(anoSelecionado + 1)} disabled={anoSelecionado >= new Date().getFullYear()} className={`w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors ${anoSelecionado >= new Date().getFullYear() ? 'bg-white/10 cursor-not-allowed opacity-50' : 'bg-white/20 hover:bg-white/30'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  </div>
                  {/* Gráfico Vendas por Ano */}
                  {showGraficoAno && vendasAno.length > 0 && (() => {
                    const metricasAno = [
                      { field: 'venda', label: 'Vendas', isPct: false, isQtd: false },
                      { field: 'custo', label: 'Custo', isPct: false, isQtd: false },
                      { field: 'lucro', label: 'Lucro', isPct: false, isQtd: false },
                      { field: 'vendasOferta', label: 'Vendas Oferta', isPct: false, isQtd: false },
                      { field: 'margem', label: 'Markdown %', isPct: true, isQtd: false },
                      { field: 'margemLiquida', label: 'Margem Líquida %', isPct: true, isQtd: false },
                      { field: 'pctOferta', label: 'Oferta %', isPct: true, isQtd: false },
                      { field: 'markdownOferta', label: 'MKD Oferta %', isPct: true, isQtd: false },
                      { field: 'ticketMedio', label: 'Ticket Médio', isPct: false, isQtd: false },
                      { field: 'skus', label: 'SKUs', isPct: false, isQtd: true },
                      { field: 'cupons', label: 'Cupons', isPct: false, isQtd: true },
                      { field: 'itensVendidos', label: 'Itens', isPct: false, isQtd: true },
                    ];
                    const metAtual = metricasAno.find(m => m.field === graficoMetricaAno) || metricasAno[0];
                    const barData = mesesCompletos.map(m => {
                      const d = vendasAno.find(v => v.mesNum === m.num);
                      return d ? (d[graficoMetricaAno] || 0) : 0;
                    });
                    const fmtAno = (v) => {
                      if (metAtual.isPct) return v > 0 ? `${v.toFixed(1)}%` : '';
                      if (metAtual.isQtd) return v > 0 ? v.toLocaleString('pt-BR') : '';
                      return v > 0 ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '';
                    };
                    const totalAno = barData.reduce((a, b) => a + b, 0);
                    return (
                    <div className="p-4 bg-white border-b border-gray-200">
                      <div className="mb-3 flex flex-wrap items-center gap-1 sm:gap-1.5">
                        {metricasAno.map(m => (
                          <button key={m.field} onClick={() => setGraficoMetricaAno(m.field)} className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold transition-colors ${graficoMetricaAno === m.field ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{m.label}</button>
                        ))}
                      </div>
                      <div className="h-[280px] sm:h-[380px]">
                        <Bar
                          plugins={[ChartDataLabels]}
                          data={{
                            labels: mesesCompletos.map(m => m.nome),
                            datasets: [{
                              type: 'bar',
                              label: metAtual.label,
                              data: barData,
                              backgroundColor: 'rgba(249,115,22,0.75)',
                              borderColor: 'rgba(249,115,22,1)',
                              borderWidth: 1,
                              borderRadius: 4,
                              barPercentage: 0.7,
                              categoryPercentage: 0.8,
                              datalabels: {
                                display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
                                align: 'top',
                                anchor: 'end',
                                offset: 4,
                                font: { size: 13, weight: 'bold' },
                                color: '#374151',
                                formatter: fmtAno
                              }
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: { padding: { top: 35 } },
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                              datalabels: { display: false },
                              legend: { display: false },
                              title: { display: true, text: `${metAtual.label} - ${anoSelecionado}  |  Total: ${fmtAno(totalAno)}`, font: { size: 14, weight: 'bold' }, color: '#374151' },
                              tooltip: {
                                callbacks: {
                                  label: (ctx) => {
                                    if (metAtual.isPct) return `${ctx.raw.toFixed(2).replace('.', ',')}%`;
                                    if (metAtual.isQtd) return ctx.raw.toLocaleString('pt-BR');
                                    return `R$ ${ctx.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                  }
                                }
                              }
                            },
                            scales: {
                              x: { grid: { display: false }, ticks: { font: { size: 12, weight: 'bold' } } },
                              y: { ticks: { callback: (v) => fmtAno(v), font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } }
                            }
                          }}
                        />
                      </div>
                    </div>
                    );
                  })()}
                  {loadingVendasAno ? (
                    <RadarLoading size="sm" message="" />
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-600">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase border-b border-gray-500 sticky left-0 bg-gray-600 min-w-[140px]">Indicador</th>
                          {mesesCompletos.map((mes) => (
                            <th key={`header-${mes.num}`} className={`px-2 py-3 text-center text-xs font-semibold uppercase border-b border-gray-500 min-w-[90px] ${
                              getDadosMes(mes.num).venda > 0 ? 'text-white' : 'text-gray-400'
                            }`}>
                              {mes.nome}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-center text-xs font-semibold text-orange-300 uppercase border-b border-gray-500 bg-gray-700 min-w-[100px]">{anoSelecionado}</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-blue-300 uppercase border-b border-gray-500 bg-gray-700 min-w-[100px]">{anoSelecionado - 1}</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-gray-200 uppercase border-b border-gray-500 bg-gray-800 min-w-[100px]">DIFERENÇA</th>
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
                        {/* Linha CUSTO */}
                        <tr className="hover:bg-orange-50 bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-gray-50">CUSTO</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`custo-${mes.num}`} className={`px-2 py-3 text-sm text-center font-medium ${dados.venda > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                {dados.venda > 0 ? formatCurrency(dados.custo || 0) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-red-600 bg-orange-50">
                            {formatCurrency(vendasAno.reduce((acc, m) => acc + (m.custo || 0), 0))}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-red-600 bg-blue-50">
                            {anoAnteriorData ? formatCurrency(anoAnteriorData.custo || 0) : '-'}
                          </td>
                          {(() => {
                            const custoAtual = vendasAno.reduce((acc, m) => acc + (m.custo || 0), 0);
                            const diff = anoAnteriorData ? custoAtual - (anoAnteriorData.custo || 0) : 0;
                            return (
                              <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${diff <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {anoAnteriorData ? <>{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</> : '-'}
                              </td>
                            );
                          })()}
                        </tr>
                        {/* Linha VENDAS EM OFERTA */}
                        <tr className="hover:bg-orange-50 bg-white border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-white">VENDAS EM OFERTA</td>
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
                        {/* Linha IMPOSTOS */}
                        <tr className="hover:bg-orange-50 bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-gray-50">IMPOSTOS</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            const imp = dados.venda > 0 && dados.margem && dados.margemLiquida ? parseFloat(((dados.margem - dados.margemLiquida) / 100 * dados.venda).toFixed(2)) : 0;
                            return (
                              <td key={`imp-${mes.num}`} className={`px-2 py-3 text-sm text-center font-medium ${dados.venda > 0 ? 'text-orange-700' : 'text-gray-300'}`}>
                                {dados.venda > 0 ? (
                                  <>
                                    {formatPercent(dados.margem - dados.margemLiquida)}
                                    <span className="text-xs text-red-400 block">({formatCurrency(imp)})</span>
                                  </>
                                ) : '-'}
                              </td>
                            );
                          })}
                          {(() => {
                            const totalVenda = vendasAno.reduce((acc, m) => acc + m.venda, 0);
                            const totalImp = vendasAno.reduce((acc, m) => acc + (m.impostos || 0), 0);
                            const pctImp = totalVenda > 0 ? (totalImp / totalVenda) * 100 : 0;
                            return (
                              <>
                                <td className="px-3 py-3 text-sm text-center font-bold text-orange-700 bg-orange-50">
                                  {formatPercent(pctImp)}
                                  <span className="text-xs text-red-400 block">({formatCurrency(totalImp)})</span>
                                </td>
                                <td className="px-3 py-3 text-sm text-center font-bold text-orange-700 bg-blue-50">
                                  {anoAnteriorData ? (
                                    <>
                                      {formatPercent(anoAnteriorData.venda > 0 ? ((anoAnteriorData.impostos || 0) / anoAnteriorData.venda) * 100 : 0)}
                                      <span className="text-xs text-red-400 block">({formatCurrency(anoAnteriorData.impostos || 0)})</span>
                                    </>
                                  ) : '-'}
                                </td>
                                <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${
                                  anoAnteriorData && (totalImp - (anoAnteriorData.impostos || 0)) <= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {anoAnteriorData ? (
                                    <>{(totalImp - (anoAnteriorData.impostos || 0)) >= 0 ? '+' : ''}{formatCurrency(totalImp - (anoAnteriorData.impostos || 0))}</>
                                  ) : '-'}
                                </td>
                              </>
                            );
                          })()}
                        </tr>
                        {/* Linha MKD OFERTA */}
                        <tr className="hover:bg-orange-50 bg-white border-b border-gray-100">
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 sticky left-0 bg-white">MKD OFERTA</td>
                          {mesesCompletos.map((mes) => {
                            const dados = getDadosMes(mes.num);
                            return (
                              <td key={`mkdOferta-${mes.num}`} className={`px-2 py-3 text-sm text-center font-medium ${
                                dados.venda > 0 ? 'text-pink-600' : 'text-gray-300'
                              }`}>
                                {dados.venda > 0 ? formatPercent(dados.markdownOferta || 0) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-center font-bold text-pink-600 bg-orange-50">
                            {(() => {
                              const totalOferta = vendasAno.reduce((acc, m) => acc + (m.vendasOferta || 0), 0);
                              const totalCustoOf = vendasAno.reduce((acc, m) => {
                                const c = m.custo || 0; const v = m.venda || 0; const of2 = m.vendasOferta || 0;
                                return acc + (v > 0 ? (c / v) * of2 : 0);
                              }, 0);
                              return totalOferta > 0 ? formatPercent(((totalOferta - totalCustoOf) / totalOferta) * 100) : '-';
                            })()}
                          </td>
                          <td className="px-3 py-3 text-sm text-center font-bold text-pink-600 bg-blue-50">
                            {anoAnteriorData ? formatPercent(anoAnteriorData.markdownOferta || 0) : '-'}
                          </td>
                          {(() => {
                            const totalOferta = vendasAno.reduce((acc, m) => acc + (m.vendasOferta || 0), 0);
                            const totalCustoOf = vendasAno.reduce((acc, m) => {
                              const c2 = m.custo || 0; const v2 = m.venda || 0; const of3 = m.vendasOferta || 0;
                              return acc + (v2 > 0 ? (c2 / v2) * of3 : 0);
                            }, 0);
                            const mkdAtual = totalOferta > 0 ? ((totalOferta - totalCustoOf) / totalOferta) * 100 : 0;
                            const diff = anoAnteriorData ? mkdAtual - (anoAnteriorData.markdownOferta || 0) : 0;
                            return (
                              <td className={`px-3 py-3 text-sm text-center font-bold bg-gray-200 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {anoAnteriorData ? <>{diff >= 0 ? '+' : ''}{diff.toFixed(2).replace('.', ',')}%</> : '-'}
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

              {/* Analise Comparativa por Setor */}
              {analiseAtiva === 'vendas-analiticas' && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-4">
                      <h3 className="text-white font-semibold text-sm sm:text-base">Analise Comparativa - {formatPeriodo()}</h3>
                      <div className="flex items-center gap-3 bg-white/20 rounded-lg px-3 py-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="filtroOferta" value="com" checked={filtroOferta === 'com'} onChange={() => setFiltroOferta('com')} className="accent-orange-600" />
                          <span className="text-white text-xs font-medium">Com Oferta</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="filtroOferta" value="sem" checked={filtroOferta === 'sem'} onChange={() => setFiltroOferta('sem')} className="accent-orange-600" />
                          <span className="text-white text-xs font-medium">Sem Oferta</span>
                        </label>
                      </div>
                    </div>
                    {vendasAnaliticasFiltradas.length > 0 && (
                      <button onClick={() => setShowGraficoAnalitica(prev => !prev)} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        {showGraficoAnalitica ? 'Ocultar Gráfico' : 'Gráfico'}
                      </button>
                    )}
                  </div>

                  {/* Gráfico Vendas Analíticas com drill-down */}
                  {showGraficoAnalitica && vendasAnaliticasFiltradas.length > 0 && !loadingVendasAnaliticas && (() => {
                    const drill = graficoAnaliticaDrill;
                    const allData = drill.data || [];
                    if (allData.length === 0) return null;

                    // Filtro: no nível Seções, permite filtrar por setor selecionado
                    const chartData = (drill.level === 'secoes' && filtroSetoresAnalitica !== null)
                      ? allData.filter((_, i) => filtroSetoresAnalitica.has(i))
                      : allData;
                    if (chartData.length === 0) return null;

                    const metricasAnalitica = {
                      vendaAtual: { label: 'Vendas R$', fmt: '$' },
                      reprAtual: { label: '% Repr.', fmt: '%' },
                      lucroAtual: { label: 'Lucro R$', fmt: '$' },
                      custoAtual: { label: 'Custo R$', fmt: '$' },
                      markdownAtual: { label: 'Markdown %', fmt: '%' },
                      margemLimpaAtual: { label: 'MG Limpa %', fmt: '%' },
                      impostosAtual: { label: 'Impostos R$', fmt: '$' },
                      vendasOfertaAtual: { label: 'Oferta R$', fmt: '$' },
                      pctOfertaAtual: { label: '% Oferta', fmt: '%' },
                      ticketMedioAtual: { label: 'Ticket Médio', fmt: '$' },
                      cuponsAtual: { label: 'Cupons', fmt: '#' },
                      qtdItensAtual: { label: 'Itens', fmt: '#' },
                      skusAtual: { label: 'SKUs', fmt: '#' },
                    };
                    const metrica = graficoAnaliticaMetrica;
                    const mInfo = metricasAnalitica[metrica] || metricasAnalitica.vendaAtual;
                    const isPct = mInfo.fmt === '%';
                    const isMoney = mInfo.fmt === '$';
                    const getLabel = (d) => d.setor || d.grupo || d.subgrupo || d.produto || '?';
                    const getComps = (key) => {
                      if (key === 'vendaAtual') return { ml: 'mediaLinear', ap: 'vendaAnoPassado', mp: 'vendaMesPassado' };
                      if (key === 'reprAtual') return { ml: 'reprMediaLinear', ap: 'reprAnoPassado', mp: 'reprMesPassado' };
                      const base = key.replace('Atual', '');
                      return { ml: base + 'MediaLinear', ap: base + 'AnoPassado', mp: base + 'MesPassado' };
                    };
                    const comps = getComps(metrica);
                    const labels = chartData.map(d => getLabel(d));
                    const valuesAtual = chartData.map(d => d[metrica] || 0);
                    const valuesML = chartData.map(d => d[comps.ml] || 0);
                    const valuesAP = chartData.map(d => d[comps.ap] || 0);
                    const valuesMP = chartData.map(d => d[comps.mp] || 0);
                    const colors = {
                      atual: { bg: 'rgba(34,197,94,0.7)', border: 'rgb(34,197,94)' },
                      ml: { bg: 'rgba(168,85,247,0.5)', border: 'rgb(168,85,247)' },
                      ap: { bg: 'rgba(59,130,246,0.5)', border: 'rgb(59,130,246)' },
                      mp: { bg: 'rgba(245,158,11,0.5)', border: 'rgb(245,158,11)' },
                    };
                    const datasets = [
                      { label: 'Atual', data: valuesAtual, backgroundColor: colors.atual.bg, borderColor: colors.atual.border, borderWidth: 1 },
                      { label: 'Méd. Linear', data: valuesML, backgroundColor: colors.ml.bg, borderColor: colors.ml.border, borderWidth: 1 },
                      { label: 'Ano Anterior', data: valuesAP, backgroundColor: colors.ap.bg, borderColor: colors.ap.border, borderWidth: 1 },
                      { label: 'Mês Anterior', data: valuesMP, backgroundColor: colors.mp.bg, borderColor: colors.mp.border, borderWidth: 1 },
                    ];

                    // Plugin: linha POR CATEGORIA conectando as 4 barras de cada grupo
                    const intraGroupLinePlugin = {
                      id: 'intraGroupLine',
                      afterDatasetsDraw(chart) {
                        const { ctx } = chart;
                        const metas = [0, 1, 2, 3].map(di => chart.getDatasetMeta(di)).filter(m => m && !m.hidden);
                        if (metas.length < 2) return;
                        const count = metas[0].data.length;
                        for (let i = 0; i < count; i++) {
                          ctx.save();
                          ctx.beginPath();
                          ctx.strokeStyle = 'rgba(239,68,68,0.6)';
                          ctx.lineWidth = 2;
                          metas.forEach((meta, j) => {
                            const bar = meta.data[i];
                            if (!bar) return;
                            if (j === 0) ctx.moveTo(bar.x, bar.y);
                            else ctx.lineTo(bar.x, bar.y);
                          });
                          ctx.stroke();
                          // Pontos
                          metas.forEach(meta => {
                            const bar = meta.data[i];
                            if (!bar) return;
                            ctx.beginPath();
                            ctx.arc(bar.x, bar.y, 3, 0, Math.PI * 2);
                            ctx.fillStyle = 'rgba(239,68,68,0.8)';
                            ctx.fill();
                          });
                          ctx.restore();
                        }
                      }
                    };

                    const levelLabels = { secoes: 'Seções', grupos: 'Grupos', subgrupos: 'Subgrupos', itens: 'Itens' };

                    // Breadcrumb click handler
                    const handleBreadcrumbClick = (bcIdx) => {
                      if (bcIdx === 0) {
                        setGraficoAnaliticaDrill({ level: 'secoes', data: vendasAnaliticasFiltradas, breadcrumb: [{ label: 'Seções' }] });
                        setFiltroSetoresAnalitica(null);
                      } else {
                        const bc = drill.breadcrumb.slice(0, bcIdx + 1);
                        const last = bc[bc.length - 1];
                        if (bcIdx === 1 && last.codSecao) {
                          const secExp = expandedAnaliticaSecoes[last.codSecao];
                          if (secExp?.data) setGraficoAnaliticaDrill({ level: 'grupos', data: secExp.data, breadcrumb: bc });
                        } else if (bcIdx === 2 && last.codGrupo) {
                          const key = `${last.codSecao}_${last.codGrupo}`;
                          const grpExp = expandedAnaliticaGrupos[key];
                          if (grpExp?.data) setGraficoAnaliticaDrill({ level: 'subgrupos', data: grpExp.data, breadcrumb: bc });
                        }
                      }
                    };

                    const fmtVal = (v) => {
                      if (isPct) return (v || 0).toFixed(1) + '%';
                      if (isMoney) return 'R$ ' + Math.round(v || 0).toLocaleString('pt-BR');
                      return Math.round(v || 0).toLocaleString('pt-BR');
                    };

                    const nItems = chartData.length;
                    const chartHeight = nItems <= 3 ? 420 : nItems <= 8 ? 480 : 520;
                    const totalAtual = valuesAtual.reduce((a, b) => a + b, 0);
                    const totalML = valuesML.reduce((a, b) => a + b, 0);
                    const totalAP = valuesAP.reduce((a, b) => a + b, 0);
                    const totalMP = valuesMP.reduce((a, b) => a + b, 0);

                    return (
                      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                        {/* Breadcrumb */}
                        <div className="flex flex-wrap items-center gap-1 mb-2 text-sm">
                          {drill.breadcrumb.map((bc, bi) => (
                            <span key={bi} className="flex items-center gap-1">
                              {bi > 0 && <span className="text-gray-400">›</span>}
                              <button onClick={() => handleBreadcrumbClick(bi)}
                                className={`px-2 py-0.5 rounded ${bi === drill.breadcrumb.length - 1 ? 'bg-orange-500 text-white font-semibold' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'} text-xs`}
                              >{bc.label}</button>
                            </span>
                          ))}
                          <span className="ml-2 text-xs text-gray-400">({levelLabels[drill.level]} - {nItems})</span>
                          {filtroSetoresAnalitica && (
                            <button onClick={() => setFiltroSetoresAnalitica(null)} className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-semibold hover:bg-red-200">Mostrar todos</button>
                          )}
                        </div>

                        {/* Botões de FILTRO (Seções) / seleção no topo */}
                        {drill.level === 'secoes' && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {allData.map((item, i) => {
                              const isActive = filtroSetoresAnalitica === null || filtroSetoresAnalitica.has(i);
                              return (
                                <button key={i}
                                  onClick={() => {
                                    setFiltroSetoresAnalitica(prev => {
                                      if (prev === null) return new Set([i]);
                                      const ns = new Set(prev);
                                      if (ns.has(i)) { ns.delete(i); return ns.size === 0 ? null : ns; }
                                      ns.add(i); return ns;
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${isActive ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white text-gray-400 border-gray-200'}`}
                                >
                                  {getLabel(item)}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Metric pills */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {Object.entries(metricasAnalitica).map(([key, info]) => (
                            <button key={key} onClick={() => setGraficoAnaliticaMetrica(key)}
                              className={`px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${metrica === key ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                            >{info.label}</button>
                          ))}
                        </div>

                        {/* Totais */}
                        <div className="flex flex-wrap gap-1.5 sm:gap-3 mb-3 px-1">
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5">
                            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: colors.atual.border }}></span>
                            <span className="text-[10px] sm:text-xs font-bold text-gray-700">Atual: <span className="text-green-700">{fmtVal(totalAtual)}</span></span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5">
                            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: colors.ml.border }}></span>
                            <span className="text-[10px] sm:text-xs font-bold text-gray-700">M.Lin: <span className="text-purple-700">{fmtVal(totalML)}</span></span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5">
                            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: colors.ap.border }}></span>
                            <span className="text-[10px] sm:text-xs font-bold text-gray-700">Ano Ant: <span className="text-blue-700">{fmtVal(totalAP)}</span></span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5">
                            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: colors.mp.border }}></span>
                            <span className="text-[10px] sm:text-xs font-bold text-gray-700">Mês Ant: <span className="text-amber-700">{fmtVal(totalMP)}</span></span>
                          </div>
                        </div>

                        {/* Chart */}
                        <div style={{ height: chartHeight }}>
                          <Bar
                            data={{ labels, datasets }}
                            plugins={[ChartDataLabels, intraGroupLinePlugin]}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              animation: { duration: 0 },
                              layout: { padding: { top: 40, left: 10, right: 10 } },
                              plugins: {
                                legend: { position: 'top', labels: { boxWidth: 14, padding: 12, font: { size: 13, weight: 'bold' } } },
                                tooltip: {
                                  titleFont: { size: 14, weight: 'bold' },
                                  bodyFont: { size: 13 },
                                  callbacks: {
                                    label: (ctx) => {
                                      const v = ctx.raw;
                                      if (isPct) return `${ctx.dataset.label}: ${(v || 0).toFixed(2)}%`;
                                      if (isMoney) return `${ctx.dataset.label}: R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                      return `${ctx.dataset.label}: ${Math.round(v || 0).toLocaleString('pt-BR')}`;
                                    }
                                  }
                                },
                                datalabels: {
                                  display: (ctx) => {
                                    const di = ctx.datasetIndex;
                                    if (di === 0) return true;
                                    const i = ctx.dataIndex;
                                    const atualVal = valuesAtual[i] || 0;
                                    const allVals = [valuesAtual[i], valuesML[i], valuesAP[i], valuesMP[i]];
                                    const maxVal = Math.max(...allVals);
                                    if (maxVal <= atualVal) return false;
                                    const thisVal = ctx.dataset.data[i] || 0;
                                    return thisVal === maxVal;
                                  },
                                  anchor: 'end', align: 'top',
                                  offset: (ctx) => {
                                    if (ctx.datasetIndex === 0) return 4;
                                    return 22; // valor maior fica bem mais acima
                                  },
                                  font: { size: 14, weight: 'bold' },
                                  color: (ctx) => ctx.datasetIndex === 0 ? '#111827' : '#dc2626',
                                  formatter: (v) => fmtVal(v)
                                }
                              },
                              scales: {
                                x: { ticks: { font: { size: 13, weight: 'bold' }, maxRotation: 45, minRotation: 0 } },
                                y: {
                                  beginAtZero: true,
                                  ticks: { font: { size: 12, weight: 'bold' }, callback: (v) => isPct ? v + '%' : isMoney ? 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) : v.toLocaleString('pt-BR') }
                                }
                              },
                              interaction: { mode: 'index', intersect: false },
                              barPercentage: 0.88,
                              categoryPercentage: 0.92,
                            }}
                          />
                        </div>

                        {/* Botões de drill-down abaixo do gráfico */}
                        {drill.level !== 'itens' && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-[10px] text-gray-400 mb-2">Detalhar:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {chartData.map((item, i) => {
                                const lbl = getLabel(item);
                                const val = item[metrica] || 0;
                                return (
                                  <button key={i}
                                    onClick={() => {
                                      if (drill.level === 'secoes' && item.codSecao) toggleAnaliticaSecao(item.codSecao);
                                      else if (drill.level === 'grupos' && item.codGrupo) {
                                        const parentSecao = drill.breadcrumb[drill.breadcrumb.length - 1]?.codSecao;
                                        toggleAnaliticaGrupo(item.codGrupo, parentSecao);
                                      } else if (drill.level === 'subgrupos' && item.codSubgrupo) {
                                        const bc = drill.breadcrumb;
                                        const parentSecao = bc[bc.length - 1]?.codSecao || bc[bc.length - 2]?.codSecao;
                                        const parentGrupo = bc[bc.length - 1]?.codGrupo;
                                        toggleAnaliticaSubgrupo(item.codSubgrupo, parentGrupo, parentSecao);
                                      }
                                    }}
                                    className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition-colors shadow-sm cursor-pointer"
                                  >
                                    <span className="text-[11px] font-semibold text-gray-700 leading-tight">{lbl}</span>
                                    <span className="text-[10px] text-green-600 font-bold">{fmtVal}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {loadingVendasAnaliticas ? (
                    <RadarLoading size="sm" message="" />
                  ) : vendasAnaliticasFiltradas.length > 0 ? (
                    <div className="overflow-auto max-h-[80vh]">
                      <table className="w-full border-collapse">
                        <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20">
                          <tr className="bg-gray-200">
                            <th rowSpan={2} className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase border-b border-r border-gray-300 min-w-[200px] sticky left-0 top-0 bg-gray-200 z-40">Setor / Grupo / Subgrupo / Item</th>
                            <th rowSpan={2} className="px-3 py-2 text-center text-xs font-bold text-sky-700 uppercase border-b border-r border-gray-300 bg-sky-50 min-w-[80px]">Estoque<br/>Atual</th>
                            <th colSpan={7} className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase border-b border-r border-gray-300 bg-orange-50">Vendas</th>
                            <th colSpan={7} className="px-2 py-2 text-center text-xs font-bold text-cyan-700 uppercase border-b border-r border-gray-300 bg-cyan-50">Lucro</th>
                            <th colSpan={7} className="px-2 py-2 text-center text-xs font-bold text-purple-700 uppercase border-b border-r border-gray-300 bg-purple-50">Markdown</th>
                            <th colSpan={7} className="px-2 py-2 text-center text-xs font-bold text-emerald-700 uppercase border-b border-r border-gray-300 bg-emerald-50">Margem Limpa</th>
                            <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-blue-700 uppercase border-b border-r border-gray-300 bg-blue-50">% Repr.</th>
                            <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-red-700 uppercase border-b border-r border-gray-300 bg-red-50">Custo</th>
                            <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-orange-700 uppercase border-b border-r border-gray-300 bg-orange-50">Impostos</th>
                            <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-amber-700 uppercase border-b border-r border-gray-300 bg-amber-50">Vendas Oferta R$</th>
                            <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-pink-700 uppercase border-b border-r border-gray-300 bg-pink-50">% Oferta</th>
                            <th colSpan={7} className="px-2 py-2 text-center text-xs font-bold text-indigo-700 uppercase border-b border-r border-gray-300 bg-indigo-50">Ticket Médio</th>
                            <th colSpan={7} className="px-2 py-2 text-center text-xs font-bold text-orange-700 uppercase border-b border-r border-gray-300 bg-orange-50">Cupons</th>
                            <th colSpan={7} className="px-2 py-2 text-center text-xs font-bold text-violet-700 uppercase border-b border-r border-gray-300 bg-violet-50">QTD Itens</th>
                            <th colSpan={7} className="px-2 py-2 text-center text-xs font-bold text-slate-700 uppercase border-b border-gray-300 bg-slate-50">SKUs</th>
                          </tr>
                          <tr className="bg-gray-100">
                            {/* Sub-headers repetidos para cada grupo: Atual, ML, Ano Ant, Mês Ant */}
                            {[...Array(13)].map((_, gi) => (
                              <Fragment key={`sh-${gi}`}>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-green-700 uppercase border-b border-gray-200 min-w-[100px] bg-green-50">Atual</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-purple-700 uppercase border-b border-gray-200 min-w-[100px] bg-gray-100">Méd.Proj</th>
                                {(gi <= 3 || gi >= 9) && <th className="px-2 py-2 text-center text-[10px] font-semibold text-purple-700 uppercase border-b border-gray-200 min-w-[55px] bg-orange-100">%</th>}
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-blue-700 uppercase border-b border-gray-200 min-w-[100px] bg-gray-100">Ano Ant</th>
                                {(gi <= 3 || gi >= 9) && <th className="px-2 py-2 text-center text-[10px] font-semibold text-blue-700 uppercase border-b border-gray-200 min-w-[55px] bg-orange-100">%</th>}
                                <th className={`px-3 py-2 text-right text-[10px] font-semibold text-amber-700 uppercase border-b min-w-[100px] bg-gray-100 ${(gi > 3 && gi < 9) && gi < 12 ? 'border-r border-gray-300' : 'border-gray-200'}`}>Mês Ant</th>
                                {(gi <= 3 || gi >= 9) && <th className="px-2 py-2 text-center text-[10px] font-semibold text-amber-700 uppercase border-b border-r border-gray-300 min-w-[55px] bg-orange-100">%</th>}
                              </Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {vendasAnaliticasFiltradas.map((setor, index) => {
                            const secExpanded = expandedAnaliticaSecoes[setor.codSecao];
                            const cc = (a, b) => a >= b ? 'text-green-600' : 'text-red-600';
                            const renderAnaliticaCells = (d, sz = 'text-sm') => {
                            const base = `px-3 py-2 ${sz} text-right font-semibold`;
                            const atCls = `${base} font-bold text-green-700 bg-green-50`;
                            const mlCls = (a, b) => `${base} ${cc(a, b)}`;
                            const aaCls = (a, b) => `${base} ${cc(a, b)}`;
                            const maCls = (a, b, br) => `${base} ${cc(a, b)} ${br ? 'border-r border-gray-200' : ''}`;
                            const fmtN = (v) => Math.round(v || 0).toLocaleString('pt-BR');
                            const calcVar = (atual, ref) => ref > 0 ? ((atual - ref) / ref * 100) : (atual > 0 ? 100 : 0);
                            const fmtVar = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
                            const varCls = (v, br) => `${base} font-bold ${v > 0 ? 'text-green-600 bg-green-50' : v < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500'} ${br ? 'border-r border-gray-300' : ''}`;
                            const varML = calcVar(d.vendaAtual, d.mediaLinear);
                            const varAP = calcVar(d.vendaAtual, d.vendaAnoPassado);
                            const varMP = calcVar(d.vendaAtual, d.vendaMesPassado);
                            return (<>
                              {/* Vendas */}
                              <td className={atCls}>{formatCurrency(d.vendaAtual)}</td>
                              <td className={mlCls(d.vendaAtual, d.mediaLinear)}>{formatCurrency(d.mediaLinear)}</td>
                              <td className={varCls(varML, false)}>{fmtVar(varML)}</td>
                              <td className={aaCls(d.vendaAtual, d.vendaAnoPassado)}>{formatCurrency(d.vendaAnoPassado)}</td>
                              <td className={varCls(varAP, false)}>{fmtVar(varAP)}</td>
                              <td className={maCls(d.vendaAtual, d.vendaMesPassado, false)}>{formatCurrency(d.vendaMesPassado)}</td>
                              <td className={varCls(varMP, true)}>{fmtVar(varMP)}</td>
                              {/* Lucro */}
                              {(() => { const lML = calcVar(d.lucroAtual, d.lucroMediaLinear), lAP = calcVar(d.lucroAtual, d.lucroAnoPassado), lMP = calcVar(d.lucroAtual, d.lucroMesPassado); return <>
                              <td className={atCls}>{formatCurrency(d.lucroAtual)}</td>
                              <td className={mlCls(d.lucroAtual, d.lucroMediaLinear)}>{formatCurrency(d.lucroMediaLinear)}</td>
                              <td className={varCls(lML, false)}>{fmtVar(lML)}</td>
                              <td className={aaCls(d.lucroAtual, d.lucroAnoPassado)}>{formatCurrency(d.lucroAnoPassado)}</td>
                              <td className={varCls(lAP, false)}>{fmtVar(lAP)}</td>
                              <td className={maCls(d.lucroAtual, d.lucroMesPassado, false)}>{formatCurrency(d.lucroMesPassado)}</td>
                              <td className={varCls(lMP, true)}>{fmtVar(lMP)}</td>
                              </>; })()}
                              {/* Markdown */}
                              {(() => { const mML = calcVar(d.markdownAtual, d.markdownMediaLinear), mAP = calcVar(d.markdownAtual, d.markdownAnoPassado), mMP = calcVar(d.markdownAtual, d.markdownMesPassado); return <>
                              <td className={atCls}>{formatPercent(d.markdownAtual)}</td>
                              <td className={mlCls(d.markdownAtual, d.markdownMediaLinear)}>{formatPercent(d.markdownMediaLinear)}</td>
                              <td className={varCls(mML, false)}>{fmtVar(mML)}</td>
                              <td className={aaCls(d.markdownAtual, d.markdownAnoPassado)}>{formatPercent(d.markdownAnoPassado)}</td>
                              <td className={varCls(mAP, false)}>{fmtVar(mAP)}</td>
                              <td className={maCls(d.markdownAtual, d.markdownMesPassado, false)}>{formatPercent(d.markdownMesPassado)}</td>
                              <td className={varCls(mMP, true)}>{fmtVar(mMP)}</td>
                              </>; })()}
                              {/* Margem Limpa */}
                              {(() => { const mlVarML = calcVar(d.margemLimpaAtual, d.margemLimpaMediaLinear), mlVarAP = calcVar(d.margemLimpaAtual, d.margemLimpaAnoPassado), mlVarMP = calcVar(d.margemLimpaAtual, d.margemLimpaMesPassado); return <>
                              <td className={atCls}>{formatPercent(d.margemLimpaAtual)}</td>
                              <td className={mlCls(d.margemLimpaAtual, d.margemLimpaMediaLinear)}>{formatPercent(d.margemLimpaMediaLinear)}</td>
                              <td className={varCls(mlVarML, false)}>{fmtVar(mlVarML)}</td>
                              <td className={aaCls(d.margemLimpaAtual, d.margemLimpaAnoPassado)}>{formatPercent(d.margemLimpaAnoPassado)}</td>
                              <td className={varCls(mlVarAP, false)}>{fmtVar(mlVarAP)}</td>
                              <td className={maCls(d.margemLimpaAtual, d.margemLimpaMesPassado, false)}>{formatPercent(d.margemLimpaMesPassado)}</td>
                              <td className={varCls(mlVarMP, true)}>{fmtVar(mlVarMP)}</td>
                              </>; })()}
                              {/* % Repr. */}
                              <td className={atCls}>{formatPercent(d.reprAtual)}</td>
                              <td className={mlCls(d.reprAtual, d.reprMediaLinear)}>{formatPercent(d.reprMediaLinear)}</td>
                              <td className={aaCls(d.reprAtual, d.reprAnoPassado)}>{formatPercent(d.reprAnoPassado)}</td>
                              <td className={maCls(d.reprAtual, d.reprMesPassado, true)}>{formatPercent(d.reprMesPassado)}</td>
                              {/* Custo (invertido: menor = melhor) */}
                              <td className={atCls}>{formatCurrency(d.custoAtual)}</td>
                              <td className={mlCls(d.custoMediaLinear, d.custoAtual)}>{formatCurrency(d.custoMediaLinear)}</td>
                              <td className={aaCls(d.custoAnoPassado, d.custoAtual)}>{formatCurrency(d.custoAnoPassado)}</td>
                              <td className={maCls(d.custoMesPassado, d.custoAtual, true)}>{formatCurrency(d.custoMesPassado)}</td>
                              {/* Impostos (invertido: menor = melhor) */}
                              <td className={atCls}>{formatCurrency(d.impostosAtual)}</td>
                              <td className={mlCls(d.impostosMediaLinear, d.impostosAtual)}>{formatCurrency(d.impostosMediaLinear)}</td>
                              <td className={aaCls(d.impostosAnoPassado, d.impostosAtual)}>{formatCurrency(d.impostosAnoPassado)}</td>
                              <td className={maCls(d.impostosMesPassado, d.impostosAtual, true)}>{formatCurrency(d.impostosMesPassado)}</td>
                              {/* Vendas Oferta R$ */}
                              <td className={atCls}>{formatCurrency(d.vendasOfertaAtual)}</td>
                              <td className={mlCls(d.vendasOfertaAtual, d.vendasOfertaMediaLinear)}>{formatCurrency(d.vendasOfertaMediaLinear)}</td>
                              <td className={aaCls(d.vendasOfertaAtual, d.vendasOfertaAnoPassado)}>{formatCurrency(d.vendasOfertaAnoPassado)}</td>
                              <td className={maCls(d.vendasOfertaAtual, d.vendasOfertaMesPassado, true)}>{formatCurrency(d.vendasOfertaMesPassado)}</td>
                              {/* % Oferta */}
                              <td className={atCls}>{formatPercent(d.pctOfertaAtual)}</td>
                              <td className={mlCls(d.pctOfertaAtual, d.pctOfertaMediaLinear)}>{formatPercent(d.pctOfertaMediaLinear)}</td>
                              <td className={aaCls(d.pctOfertaAtual, d.pctOfertaAnoPassado)}>{formatPercent(d.pctOfertaAnoPassado)}</td>
                              <td className={maCls(d.pctOfertaAtual, d.pctOfertaMesPassado, true)}>{formatPercent(d.pctOfertaMesPassado)}</td>
                              {/* Ticket Médio */}
                              {(() => { const tML = calcVar(d.ticketMedioAtual, d.ticketMedioMediaLinear), tAP = calcVar(d.ticketMedioAtual, d.ticketMedioAnoPassado), tMP = calcVar(d.ticketMedioAtual, d.ticketMedioMesPassado); return <>
                              <td className={atCls}>{formatCurrency(d.ticketMedioAtual)}</td>
                              <td className={mlCls(d.ticketMedioAtual, d.ticketMedioMediaLinear)}>{formatCurrency(d.ticketMedioMediaLinear)}</td>
                              <td className={varCls(tML, false)}>{fmtVar(tML)}</td>
                              <td className={aaCls(d.ticketMedioAtual, d.ticketMedioAnoPassado)}>{formatCurrency(d.ticketMedioAnoPassado)}</td>
                              <td className={varCls(tAP, false)}>{fmtVar(tAP)}</td>
                              <td className={maCls(d.ticketMedioAtual, d.ticketMedioMesPassado, false)}>{formatCurrency(d.ticketMedioMesPassado)}</td>
                              <td className={varCls(tMP, true)}>{fmtVar(tMP)}</td>
                              </>; })()}
                              {/* Cupons */}
                              {(() => { const cML = calcVar(d.cuponsAtual, d.cuponsMediaLinear), cAP = calcVar(d.cuponsAtual, d.cuponsAnoPassado), cMP = calcVar(d.cuponsAtual, d.cuponsMesPassado); return <>
                              <td className={atCls}>{fmtN(d.cuponsAtual)}</td>
                              <td className={mlCls(d.cuponsAtual, d.cuponsMediaLinear)}>{fmtN(d.cuponsMediaLinear)}</td>
                              <td className={varCls(cML, false)}>{fmtVar(cML)}</td>
                              <td className={aaCls(d.cuponsAtual, d.cuponsAnoPassado)}>{fmtN(d.cuponsAnoPassado)}</td>
                              <td className={varCls(cAP, false)}>{fmtVar(cAP)}</td>
                              <td className={maCls(d.cuponsAtual, d.cuponsMesPassado, false)}>{fmtN(d.cuponsMesPassado)}</td>
                              <td className={varCls(cMP, true)}>{fmtVar(cMP)}</td>
                              </>; })()}
                              {/* QTD Itens */}
                              {(() => { const qML = calcVar(d.qtdItensAtual, d.qtdItensMediaLinear), qAP = calcVar(d.qtdItensAtual, d.qtdItensAnoPassado), qMP = calcVar(d.qtdItensAtual, d.qtdItensMesPassado); return <>
                              <td className={atCls}>{fmtN(d.qtdItensAtual)}</td>
                              <td className={mlCls(d.qtdItensAtual, d.qtdItensMediaLinear)}>{fmtN(d.qtdItensMediaLinear)}</td>
                              <td className={varCls(qML, false)}>{fmtVar(qML)}</td>
                              <td className={aaCls(d.qtdItensAtual, d.qtdItensAnoPassado)}>{fmtN(d.qtdItensAnoPassado)}</td>
                              <td className={varCls(qAP, false)}>{fmtVar(qAP)}</td>
                              <td className={maCls(d.qtdItensAtual, d.qtdItensMesPassado, false)}>{fmtN(d.qtdItensMesPassado)}</td>
                              <td className={varCls(qMP, true)}>{fmtVar(qMP)}</td>
                              </>; })()}
                              {/* SKUs */}
                              {(() => { const sML = calcVar(d.skusAtual, d.skusMediaLinear), sAP = calcVar(d.skusAtual, d.skusAnoPassado), sMP = calcVar(d.skusAtual, d.skusMesPassado); return <>
                              <td className={atCls}>{fmtN(d.skusAtual)}</td>
                              <td className={mlCls(d.skusAtual, d.skusMediaLinear)}>{fmtN(d.skusMediaLinear)}</td>
                              <td className={varCls(sML, false)}>{fmtVar(sML)}</td>
                              <td className={aaCls(d.skusAtual, d.skusAnoPassado)}>{fmtN(d.skusAnoPassado)}</td>
                              <td className={varCls(sAP, false)}>{fmtVar(sAP)}</td>
                              <td className={maCls(d.skusAtual, d.skusMesPassado, false)}>{fmtN(d.skusMesPassado)}</td>
                              <td className={varCls(sMP, true)}>{fmtVar(sMP)}</td>
                              </>; })()}
                            </>);
                            };
                            return (
                            <Fragment key={`analitica-${setor.codSecao || index}`}>
                              {/* Nível 1: Seção */}
                              {(() => { const isInativaGI = secoesInativasGI.includes(String(setor.codSecao)); return (
                              <tr className={`hover:bg-gray-100 border-b border-gray-100 ${isInativaGI ? 'bg-gray-200 opacity-50 line-through' : index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                                <td className={`px-4 py-2 text-sm font-semibold text-gray-800 sticky left-0 z-10 ${isInativaGI ? 'bg-gray-200' : ''}`} style={!isInativaGI ? { backgroundColor: index % 2 === 0 ? '#f9fafb' : '#fff' } : {}}>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={isInativaGI}
                                      onChange={(e) => { e.stopPropagation(); toggleSecaoInativaGI(setor.codSecao); }}
                                      title={isInativaGI ? 'Ativar seção' : 'Inativar seção (excluir dos totais)'}
                                      className="w-3.5 h-3.5 accent-gray-500 cursor-pointer flex-shrink-0"
                                    />
                                  <button onClick={() => toggleAnaliticaSecao(setor.codSecao)} className="flex items-center gap-2 font-semibold text-gray-800 whitespace-nowrap">
                                    <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-xs font-bold transition-colors ${secExpanded ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                      {secExpanded?.loading ? '...' : secExpanded ? '−' : '+'}
                                    </span>
                                    {setor.setor}
                                  </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center text-sm text-gray-400">—</td>
                                {renderAnaliticaCells(setor)}
                              </tr>
                              ); })()}

                              {/* Nível 2: Grupos */}
                              {secExpanded?.data?.map((grupo, gIdx) => {
                                const grupoKey = `${setor.codSecao}_${grupo.codGrupo}`;
                                const grpExpanded = expandedAnaliticaGrupos[grupoKey];
                                return (
                                <Fragment key={`ag-${grupoKey}`}>
                                  <tr className={`hover:bg-gray-100 ${gIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
                                    <td className="px-4 py-2 text-sm text-gray-700 pl-10 sticky left-0 z-10 bg-white">
                                      <button onClick={() => toggleAnaliticaGrupo(grupo.codGrupo, setor.codSecao)} className="flex items-center gap-2 font-medium text-gray-700 whitespace-nowrap">
                                        <span className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded text-xs font-bold transition-colors ${grpExpanded ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                          {grpExpanded?.loading ? '.' : grpExpanded ? '−' : '+'}
                                        </span>
                                        {grupo.grupo}
                                      </button>
                                    </td>
                                    <td className="px-3 py-2 text-center text-sm text-gray-400">—</td>
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
                                          <button onClick={() => toggleAnaliticaSubgrupo(sub.codSubgrupo, grupo.codGrupo, setor.codSecao)} className="flex items-center gap-2 text-gray-600 whitespace-nowrap">
                                            <span className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded text-xs font-bold transition-colors ${subExpanded ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                              {subExpanded?.loading ? '.' : subExpanded ? '−' : '+'}
                                            </span>
                                            {sub.subgrupo}
                                          </button>
                                        </td>
                                        <td className="px-3 py-2 text-center text-sm text-gray-400">—</td>
                                        {renderAnaliticaCells(sub)}
                                      </tr>

                                      {/* Nível 4: Segmentos ou Itens diretos */}
                                      {subExpanded?.type === 'itens' ? (
                                        /* Sem segmentos — mostrar itens diretamente */
                                        subExpanded?.data?.map((item, iIdx) => (
                                          <tr key={`ai-${item.codProduto || iIdx}`} className={`hover:bg-amber-100 ${iIdx % 2 === 0 ? 'bg-amber-50' : 'bg-amber-50'} border-b border-amber-100/50`}>
                                            <td className="px-4 py-1.5 text-xs text-gray-500 pl-24 sticky left-0 z-10 bg-amber-50">
                                              <span className="flex items-center gap-2 whitespace-nowrap">
                                                <span className="relative group cursor-pointer">
                                                  <span className="w-3 h-3 rounded-full bg-gray-400 hover:bg-gray-600 inline-block transition-colors"></span>
                                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                                    {item.fornecedor || 'Sem fornecedor'}
                                                  </span>
                                                </span>
                                                {item.produto}
                                              </span>
                                            </td>
                                            <td className="px-3 py-1.5 text-center text-xs font-bold text-sky-700 bg-sky-50/50">{formatNumber(item.estoqueAtual)}</td>
                                            {renderAnaliticaCells(item, 'text-xs')}
                                          </tr>
                                        ))
                                      ) : (
                                        /* Com segmentos */
                                        subExpanded?.data?.map((seg, segIdx) => {
                                          const segKey = `${setor.codSecao}_${grupo.codGrupo}_${sub.codSubgrupo}_${seg.codSegmento}`;
                                          const segExpanded = expandedAnaliticaSegmentos[segKey];
                                          return (
                                          <Fragment key={`aseg-${segKey}`}>
                                            <tr className={`hover:bg-purple-100 ${segIdx % 2 === 0 ? 'bg-purple-50/30' : 'bg-purple-50/50'} border-b border-purple-100/50`}>
                                              <td className="px-4 py-2 text-xs text-purple-700 pl-20 sticky left-0 z-10 bg-white">
                                                <button onClick={() => toggleAnaliticaSegmento(seg.codSegmento, sub.codSubgrupo, grupo.codGrupo, setor.codSecao)} className="flex items-center gap-2 text-purple-700 whitespace-nowrap">
                                                  <span className={`w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center rounded text-[10px] font-bold transition-colors ${segExpanded ? 'bg-purple-500 text-white' : 'bg-purple-200 text-purple-700'}`}>
                                                    {segExpanded?.loading ? '.' : segExpanded ? '−' : '+'}
                                                  </span>
                                                  {seg.segmento || `Segmento ${seg.codSegmento}`}
                                                </button>
                                              </td>
                                              <td className="px-3 py-2 text-center text-xs text-gray-400">—</td>
                                              {renderAnaliticaCells(seg, 'text-xs')}
                                            </tr>

                                            {/* Nível 5: Itens dentro do Segmento */}
                                            {segExpanded?.data?.map((item, iIdx) => (
                                              <tr key={`ai-${item.codProduto || iIdx}`} className={`hover:bg-amber-100 ${iIdx % 2 === 0 ? 'bg-amber-50' : 'bg-amber-50'} border-b border-amber-100/50`}>
                                                <td className="px-4 py-1.5 text-xs text-gray-500 pl-28 sticky left-0 z-10 bg-amber-50">
                                                  <span className="flex items-center gap-2 whitespace-nowrap">
                                                    <span className="relative group cursor-pointer">
                                                      <span className="w-3 h-3 rounded-full bg-gray-400 hover:bg-gray-600 inline-block transition-colors"></span>
                                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                                        {item.fornecedor || 'Sem fornecedor'}
                                                      </span>
                                                    </span>
                                                    {item.produto}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-center text-xs font-bold text-sky-700 bg-sky-50/50">{formatNumber(item.estoqueAtual)}</td>
                                                {renderAnaliticaCells(item, 'text-xs')}
                                              </tr>
                                            ))}
                                          </Fragment>);
                                        })
                                      )}
                                    </Fragment>);
                                  })}
                                </Fragment>);
                              })}
                            </Fragment>);
                          })}
                        </tbody>
                        <tfoot className="bg-gray-200">
                          {(() => {
                            const sum = (key) => vendasAnaliticasFiltradas.filter(s => !secoesInativasGI.includes(String(s.codSecao))).reduce((acc, s) => acc + (s[key] || 0), 0);
                            const cc = (a, b) => a >= b ? 'text-green-700' : 'text-red-700';
                            const calcMkd = (vendaKey, lucroKey) => {
                              const v = sum(vendaKey); const c = sum(vendaKey) - sum(lucroKey);
                              return v > 0 ? ((v - c) / v) * 100 : 0;
                            };
                            const calcML = (vendaKey) => {
                              const v = sum(vendaKey);
                              if (v <= 0) return 0;
                              const mlKey = vendaKey === 'mediaLinear' ? 'margemLimpaMediaLinear' : vendaKey.replace('venda', 'margemLimpa');
                              const wSum = vendasAnaliticasFiltradas.filter(s => !secoesInativasGI.includes(String(s.codSecao))).reduce((a, d) => a + ((d[mlKey] || 0) * (d[vendaKey] || 0)), 0);
                              return wSum / v;
                            };
                            const calcPctOferta = (ofertaKey, vendaKey) => {
                              const v = sum(vendaKey); const o = sum(ofertaKey);
                              return v > 0 ? (o / v) * 100 : 0;
                            };
                            const calcTkt = (vendaKey, cuponsKey) => {
                              const v = sum(vendaKey); const c = sum(cuponsKey);
                              return c > 0 ? v / c : 0;
                            };
                            const vAt = sum('vendaAtual'), vML = sum('mediaLinear'), vAP = sum('vendaAnoPassado'), vMP = sum('vendaMesPassado');
                            const lAt = sum('lucroAtual'), lML = sum('lucroMediaLinear'), lAP = sum('lucroAnoPassado'), lMP = sum('lucroMesPassado');
                            const mkdAt = calcMkd('vendaAtual','lucroAtual'), mkdML = calcMkd('mediaLinear','lucroMediaLinear'), mkdAP = calcMkd('vendaAnoPassado','lucroAnoPassado'), mkdMP = calcMkd('vendaMesPassado','lucroMesPassado');
                            const mlAt = calcML('vendaAtual'), mlML = calcML('mediaLinear'), mlAP = calcML('vendaAnoPassado'), mlMP = calcML('vendaMesPassado');
                            const cAt = sum('custoAtual'), cML = sum('custoMediaLinear'), cAP = sum('custoAnoPassado'), cMP = sum('custoMesPassado');
                            const iAt = sum('impostosAtual'), iML = sum('impostosMediaLinear'), iAP = sum('impostosAnoPassado'), iMP = sum('impostosMesPassado');
                            const oAt = sum('vendasOfertaAtual'), oML = sum('vendasOfertaMediaLinear'), oAP = sum('vendasOfertaAnoPassado'), oMP = sum('vendasOfertaMesPassado');
                            const poAt = calcPctOferta('vendasOfertaAtual','vendaAtual'), poML = calcPctOferta('vendasOfertaMediaLinear','mediaLinear'), poAP = calcPctOferta('vendasOfertaAnoPassado','vendaAnoPassado'), poMP = calcPctOferta('vendasOfertaMesPassado','vendaMesPassado');
                            // Ticket médio TOTAL: usar indicadores gerais (cupons por setor são duplicados pois mesmo cupom aparece em vários setores)
                            const tAt = indicadores.ticketMedio?.atual || 0, tML = indicadores.ticketMedio?.mediaLinear || 0, tAP = indicadores.ticketMedio?.anoPassado || 0, tMP = indicadores.ticketMedio?.mesPassado || 0;
                            // Cupons, Itens e SKUs TOTAL: usar indicadores gerais (cupons/SKUs por setor contam duplicado)
                            const cupAt = indicadores.qtdCupons?.atual || 0, cupML = indicadores.qtdCupons?.mediaLinear || 0, cupAP = indicadores.qtdCupons?.anoPassado || 0, cupMP = indicadores.qtdCupons?.mesPassado || 0;
                            const qAt = indicadores.qtdItens?.atual || 0, qML = indicadores.qtdItens?.mediaLinear || 0, qAP = indicadores.qtdItens?.anoPassado || 0, qMP = indicadores.qtdItens?.mesPassado || 0;
                            const sAt = indicadores.qtdSkus?.atual || 0, sML = indicadores.qtdSkus?.mediaLinear || 0, sAP = indicadores.qtdSkus?.anoPassado || 0, sMP = indicadores.qtdSkus?.mesPassado || 0;
                            // col=0 Atual(verde), col=1 ML(roxa), col=2 AnoAnt(azul), col=3 MêsAnt(âmbar)
                            const colBg = ['bg-green-50', '', '', ''];
                            const colTxt = ['text-green-700', '', '', ''];
                            const fmt = (val, f) => f === '$' ? formatCurrency(val) : f === '%' ? formatPercent(val) : Math.round(val).toLocaleString('pt-BR');
                            const td4 = (vals, f, br) => vals.map((v, i) => (
                              <td key={i} className={`px-3 py-2 text-sm text-right font-bold ${colBg[i]} ${i === 0 ? colTxt[0] : cc(vals[0], v)} ${i === 3 && br ? 'border-r border-gray-300' : ''}`}>{fmt(v, f)}</td>
                            ));
                            return (
                          <tr>
                            <td className="px-4 py-2 text-sm font-bold text-gray-800 sticky left-0 bg-gray-200 z-10">TOTAL</td>
                            <td className="px-3 py-2 text-center text-sm text-gray-400 bg-gray-200">—</td>
                            {(() => {
                              const cv = (a, r) => r > 0 ? ((a - r) / r * 100) : (a > 0 ? 100 : 0);
                              const fv = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
                              const vc = (v, br) => `px-3 py-2 text-sm text-right font-bold ${v > 0 ? 'text-green-600 bg-green-50' : v < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500'} ${br ? 'border-r border-gray-300' : ''}`;
                              const vm = cv(vAt, vML), va = cv(vAt, vAP), vmp = cv(vAt, vMP);
                              return <>
                                <td className={`px-3 py-2 text-sm text-right font-bold bg-green-50 text-green-700`}>{formatCurrency(vAt)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(vAt, vML)}`}>{formatCurrency(vML)}</td>
                                <td className={vc(vm,false)}>{fv(vm)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(vAt, vAP)}`}>{formatCurrency(vAP)}</td>
                                <td className={vc(va,false)}>{fv(va)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(vAt, vMP)}`}>{formatCurrency(vMP)}</td>
                                <td className={vc(vmp,true)}>{fv(vmp)}</td>
                              </>;
                            })()}
                            {(() => {
                              const cv = (a, r) => r > 0 ? ((a - r) / r * 100) : (a > 0 ? 100 : 0);
                              const fv = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
                              const vc2 = (v, br) => `px-3 py-2 text-sm text-right font-bold ${v > 0 ? 'text-green-600 bg-green-50' : v < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500'} ${br ? 'border-r border-gray-300' : ''}`;
                              const lm = cv(lAt, lML), la = cv(lAt, lAP), lp = cv(lAt, lMP);
                              return <>
                                <td className={`px-3 py-2 text-sm text-right font-bold bg-green-50 text-green-700`}>{formatCurrency(lAt)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(lAt, lML)}`}>{formatCurrency(lML)}</td>
                                <td className={vc2(lm,false)}>{fv(lm)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(lAt, lAP)}`}>{formatCurrency(lAP)}</td>
                                <td className={vc2(la,false)}>{fv(la)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(lAt, lMP)}`}>{formatCurrency(lMP)}</td>
                                <td className={vc2(lp,true)}>{fv(lp)}</td>
                              </>;
                            })()}
                            {(() => {
                              const cv3 = (a, r) => r > 0 ? ((a - r) / r * 100) : (a > 0 ? 100 : 0);
                              const fv3 = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
                              const vc3 = (v, br) => `px-3 py-2 text-sm text-right font-bold ${v > 0 ? 'text-green-600 bg-green-50' : v < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500'} ${br ? 'border-r border-gray-300' : ''}`;
                              const mm = cv3(mkdAt, mkdML), ma = cv3(mkdAt, mkdAP), mp = cv3(mkdAt, mkdMP);
                              return <>
                                <td className={`px-3 py-2 text-sm text-right font-bold bg-green-50 text-green-700`}>{formatPercent(mkdAt)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(mkdAt, mkdML)}`}>{formatPercent(mkdML)}</td>
                                <td className={vc3(mm,false)}>{fv3(mm)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(mkdAt, mkdAP)}`}>{formatPercent(mkdAP)}</td>
                                <td className={vc3(ma,false)}>{fv3(ma)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(mkdAt, mkdMP)}`}>{formatPercent(mkdMP)}</td>
                                <td className={vc3(mp,true)}>{fv3(mp)}</td>
                              </>;
                            })()}
                            {(() => {
                              const cv4 = (a, r) => r > 0 ? ((a - r) / r * 100) : (a > 0 ? 100 : 0);
                              const fv4 = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
                              const vc4 = (v, br) => `px-3 py-2 text-sm text-right font-bold ${v > 0 ? 'text-green-600 bg-green-50' : v < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500'} ${br ? 'border-r border-gray-300' : ''}`;
                              const mm2 = cv4(mlAt, mlML), ma2 = cv4(mlAt, mlAP), mp2 = cv4(mlAt, mlMP);
                              return <>
                                <td className={`px-3 py-2 text-sm text-right font-bold bg-green-50 text-green-700`}>{formatPercent(mlAt)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(mlAt, mlML)}`}>{formatPercent(mlML)}</td>
                                <td className={vc4(mm2,false)}>{fv4(mm2)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(mlAt, mlAP)}`}>{formatPercent(mlAP)}</td>
                                <td className={vc4(ma2,false)}>{fv4(ma2)}</td>
                                <td className={`px-3 py-2 text-sm text-right font-bold ${cc(mlAt, mlMP)}`}>{formatPercent(mlMP)}</td>
                                <td className={vc4(mp2,true)}>{fv4(mp2)}</td>
                              </>;
                            })()}
                            {td4([100,100,100,100],'%',true)}
                            {/* Custo: invertido - menor é melhor */}
                            {[cAt,cML,cAP,cMP].map((v, i) => (
                              <td key={`c${i}`} className={`px-3 py-2 text-sm text-right font-bold ${colBg[i]} ${i === 0 ? colTxt[0] : cc(v, cAt)} ${i === 3 ? 'border-r border-gray-300' : ''}`}>{formatCurrency(v)}</td>
                            ))}
                            {/* Impostos: invertido - menor é melhor */}
                            {[iAt,iML,iAP,iMP].map((v, i) => (
                              <td key={`i${i}`} className={`px-3 py-2 text-sm text-right font-bold ${colBg[i]} ${i === 0 ? colTxt[0] : cc(v, iAt)} ${i === 3 ? 'border-r border-gray-300' : ''}`}>{formatCurrency(v)}</td>
                            ))}
                            {td4([oAt,oML,oAP,oMP],'$',true)}
                            {td4([poAt,poML,poAP,poMP],'%',true)}
                            {(() => {
                              const cv5 = (a, r) => r > 0 ? ((a - r) / r * 100) : (a > 0 ? 100 : 0);
                              const fv5 = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
                              const vc5 = (v, br) => `px-3 py-2 text-sm text-right font-bold ${v > 0 ? 'text-green-600 bg-green-50' : v < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500'} ${br ? 'border-r border-gray-300' : ''}`;
                              const td7 = (at, ml, ap, mp, f, br) => {
                                const fmt2 = (v) => f === '$' ? formatCurrency(v) : f === '%' ? formatPercent(v) : Math.round(v).toLocaleString('pt-BR');
                                const vm = cv5(at, ml), va = cv5(at, ap), vp = cv5(at, mp);
                                return <>
                                  <td className={`px-3 py-2 text-sm text-right font-bold bg-green-50 text-green-700`}>{fmt2(at)}</td>
                                  <td className={`px-3 py-2 text-sm text-right font-bold ${cc(at, ml)}`}>{fmt2(ml)}</td>
                                  <td className={vc5(vm,false)}>{fv5(vm)}</td>
                                  <td className={`px-3 py-2 text-sm text-right font-bold ${cc(at, ap)}`}>{fmt2(ap)}</td>
                                  <td className={vc5(va,false)}>{fv5(va)}</td>
                                  <td className={`px-3 py-2 text-sm text-right font-bold ${cc(at, mp)}`}>{fmt2(mp)}</td>
                                  <td className={vc5(vp,br)}>{fv5(vp)}</td>
                                </>;
                              };
                              return <>
                                {td7(tAt,tML,tAP,tMP,'$',true)}
                                {td7(cupAt,cupML,cupAP,cupMP,'#',true)}
                                {td7(qAt,qML,qAP,qMP,'#',true)}
                                {td7(sAt,sML,sAP,sMP,'#',false)}
                              </>;
                            })()}
                          </tr>
                            );
                          })()}
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
                    <h3 className="text-white font-semibold">Analise por Setor Periodo Atual - {formatPeriodo()}</h3>
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
                                      <tr key={`item-${item.codProduto || iIndex}`} className={`hover:bg-amber-100 ${iIndex % 2 === 0 ? 'bg-amber-50' : 'bg-amber-50'} border-b border-amber-100/50`}>
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
                  <div className="bg-orange-500 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                    <h3 className="text-white font-semibold text-sm sm:text-base">Analise por Setor Anual</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setShowGraficoSetorAnual(prev => !prev)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${showGraficoSetorAnual ? 'bg-white text-orange-600' : 'bg-white/20 hover:bg-white/30 text-white'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                        Gráfico
                      </button>
                      <button onClick={() => handleAnoSetorAnualChange(anoSetorAnual - 1)} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                      </button>
                      <span className="text-white font-bold text-lg min-w-[60px] text-center">{anoSetorAnual}</span>
                      <button onClick={() => handleAnoSetorAnualChange(anoSetorAnual + 1)} disabled={anoSetorAnual >= new Date().getFullYear()} className={`w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors ${anoSetorAnual >= new Date().getFullYear() ? 'bg-white/10 cursor-not-allowed opacity-50' : 'bg-white/20 hover:bg-white/30'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  </div>
                  {showGraficoSetorAnual && vendasSetorAnual.length > 0 && (() => {
                    const cores = [
                      'rgba(249,115,22,0.8)', 'rgba(34,197,94,0.8)', 'rgba(59,130,246,0.8)',
                      'rgba(168,85,247,0.8)', 'rgba(236,72,153,0.8)', 'rgba(234,179,8,0.8)',
                      'rgba(20,184,166,0.8)', 'rgba(239,68,68,0.8)', 'rgba(99,102,241,0.8)',
                      'rgba(14,165,233,0.8)', 'rgba(244,63,94,0.8)', 'rgba(132,204,22,0.8)',
                      'rgba(217,70,239,0.8)', 'rgba(251,146,60,0.8)', 'rgba(45,212,191,0.8)',
                      'rgba(129,140,248,0.8)', 'rgba(244,114,182,0.8)', 'rgba(163,230,53,0.8)',
                      'rgba(251,191,36,0.8)', 'rgba(96,165,250,0.8)', 'rgba(192,132,252,0.8)'
                    ];
                    const metricaLabels = { venda: 'Vendas', custo: 'Custo', vendasOferta: 'Vendas Oferta', lucro: 'Lucro', margem: 'Markdown %', pctOferta: 'Markdown em Oferta %', ticketMedio: 'Ticket Médio', skus: 'SKUs', cupons: 'Cupons', itensVendidos: 'Itens Vendidos' };
                    const isPct = graficoMetrica === 'margem' || graficoMetrica === 'pctOferta';
                    const isQtd = graficoMetrica === 'skus' || graficoMetrica === 'cupons' || graficoMetrica === 'itensVendidos';
                    const metricaLabel = metricaLabels[graficoMetrica] || 'Vendas';
                    const filteredSetores = selectedSetoresGrafico
                      ? vendasSetorAnual.filter((_, i) => selectedSetoresGrafico.has(i))
                      : vendasSetorAnual;
                    const nFilt = filteredSetores.length;
                    const barDatasets = filteredSetores.map((s, fi) => {
                      const origIdx = vendasSetorAnual.indexOf(s);
                      return {
                        type: 'bar',
                        label: s.setor,
                        data: mesesCompletos.map(m => s.meses[m.num]?.[graficoMetrica] || 0),
                        backgroundColor: cores[origIdx % cores.length],
                        borderColor: cores[origIdx % cores.length].replace('0.8', '1'),
                        borderWidth: 1,
                        borderRadius: 3,
                        barPercentage: 0.98,
                        categoryPercentage: nFilt === 1 ? 0.4 : nFilt <= 3 ? 0.65 : 0.98,
                        datalabels: { display: false }
                      };
                    });
                    // Linha de tendência: soma/média total por mês dos setores filtrados
                    const trendData = mesesCompletos.map(m => {
                      let soma = 0; let cnt = 0;
                      filteredSetores.forEach(s => { const v = s.meses[m.num]?.[graficoMetrica] || 0; soma += v; if (v) cnt++; });
                      return isPct ? (cnt > 0 ? soma / cnt : 0) : soma;
                    });
                    const fmtLabel = (v) => {
                      if (isPct) return v > 0 ? `${v.toFixed(1)}%` : '';
                      if (isQtd) return v > 0 ? v.toLocaleString('pt-BR') : '';
                      return v > 0 ? `R$ ${(v / 1000).toFixed(0)}k` : '';
                    };
                    const trendDataset = {
                      type: 'line',
                      label: isPct ? 'Média Mês' : 'Total Mês',
                      data: trendData,
                      borderColor: 'rgba(107,114,128,0.9)',
                      backgroundColor: 'rgba(107,114,128,0.1)',
                      borderWidth: 2,
                      borderDash: [6, 3],
                      pointRadius: 4,
                      pointBackgroundColor: 'rgba(107,114,128,1)',
                      pointBorderColor: '#fff',
                      pointBorderWidth: 2,
                      tension: 0.3,
                      fill: false,
                      order: 0,
                      datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'end',
                        offset: 6,
                        font: { size: 12, weight: 'bold' },
                        color: '#374151',
                        formatter: fmtLabel
                      }
                    };
                    const datasets = selectedSetoresGrafico ? [...barDatasets, trendDataset] : barDatasets;
                    const handleLegendClick = (_e, legendItem, legend) => {
                      const idx = vendasSetorAnual.findIndex(s => s.setor === legendItem.text);
                      if (legendItem.text === 'Total Mês') return; // ignora clique na linha
                      if (idx === -1) return;
                      setSelectedSetoresGrafico(prev => {
                        if (!prev) {
                          // Nenhum filtro ativo: seleciona apenas este
                          return new Set([idx]);
                        }
                        if (prev.has(idx) && prev.size === 1) {
                          // Já é o único selecionado: volta a mostrar todos
                          return null;
                        }
                        if (prev.has(idx)) {
                          // Remove este do filtro
                          const next = new Set(prev);
                          next.delete(idx);
                          return next;
                        }
                        // Adiciona este ao filtro
                        const next = new Set(prev);
                        next.add(idx);
                        return next;
                      });
                    };
                    const chartHeight = nFilt === 1 ? 400 : nFilt <= 3 ? 420 : 480;
                    return (
                    <div className="p-4 bg-white border-b border-gray-200">
                      {selectedSetoresGrafico && (
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">{selectedSetoresGrafico.size} setor(es) selecionado(s)</span>
                          <button onClick={() => setSelectedSetoresGrafico(null)} className="text-xs text-orange-600 hover:text-orange-800 font-semibold underline">Mostrar todos</button>
                        </div>
                      )}
                      <div className="mb-3 flex flex-wrap items-center gap-1.5">
                        {[
                          { field: 'venda', label: 'Vendas' },
                          { field: 'custo', label: 'Custo' },
                          { field: 'lucro', label: 'Lucro' },
                          { field: 'vendasOferta', label: 'Vendas Oferta' },
                          { field: 'margem', label: 'Markdown %' },
                          { field: 'pctOferta', label: 'Oferta %' },
                          { field: 'ticketMedio', label: 'Ticket Médio' },
                          { field: 'skus', label: 'SKUs' },
                          { field: 'cupons', label: 'Cupons' },
                          { field: 'itensVendidos', label: 'Itens' },
                        ].map(m => (
                          <button key={m.field} onClick={() => setGraficoMetrica(m.field)} className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${graficoMetrica === m.field ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{m.label}</button>
                        ))}
                      </div>
                      <div style={{ height: chartHeight + 'px' }}>
                        <Bar
                          plugins={[ChartDataLabels]}
                          data={{ labels: mesesCompletos.map(m => m.nome), datasets }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: { padding: { top: 20, left: 5, right: 5 } },
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                              datalabels: { display: false },
                              legend: {
                                position: 'bottom',
                                labels: {
                                  boxWidth: 10, padding: 6, font: { size: 9 },
                                  generateLabels: (chart) => {
                                    return vendasSetorAnual.map((s, i) => ({
                                      text: s.setor,
                                      fillStyle: cores[i % cores.length],
                                      strokeStyle: cores[i % cores.length].replace('0.8', '1'),
                                      lineWidth: 1,
                                      hidden: selectedSetoresGrafico ? !selectedSetoresGrafico.has(i) : false,
                                      index: i
                                    }));
                                  }
                                },
                                onClick: handleLegendClick
                              },
                              title: {
                                display: true,
                                text: `${metricaLabel} por Setor - ${anoSetorAnual}`,
                                font: { size: 14, weight: 'bold' }, color: '#374151'
                              },
                              tooltip: {
                                callbacks: {
                                  label: (ctx) => {
                                    if (isPct) return `${ctx.dataset.label}: ${ctx.raw.toFixed(2).replace('.', ',')}%`;
                                    if (isQtd) return `${ctx.dataset.label}: ${ctx.raw.toLocaleString('pt-BR')}`;
                                    return `${ctx.dataset.label}: R$ ${ctx.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                  }
                                }
                              }
                            },
                            scales: {
                              x: { stacked: false, grid: { display: false }, ticks: { font: { size: 12, weight: 'bold' } } },
                              y: {
                                stacked: false,
                                ticks: { callback: (v) => isPct ? `${v.toFixed(0)}%` : isQtd ? v.toLocaleString('pt-BR') : `R$ ${(v / 1000).toFixed(0)}k`, font: { size: 11 } },
                                grid: { color: 'rgba(0,0,0,0.06)' }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    );
                  })()}
                  {loadingVendasSetorAnual ? (
                    <RadarLoading size="sm" message="" />
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-600">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase border-b border-gray-500 sticky left-0 bg-gray-600 min-w-[160px]">Setor</th>
                          {mesesCompletos.map((mes) => (
                            <th key={`sa-h-${mes.num}`} className="px-2 py-3 text-center text-xs font-semibold text-white uppercase border-b border-gray-500 min-w-[90px]">{mes.nome}</th>
                          ))}
                          <th className="px-3 py-3 text-center text-xs font-semibold text-orange-300 uppercase border-b border-gray-500 bg-gray-700 min-w-[100px]">{anoSetorAnual}</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-blue-300 uppercase border-b border-gray-500 bg-gray-700 min-w-[100px]">{anoSetorAnual - 1}</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-gray-200 uppercase border-b border-gray-500 bg-gray-800 min-w-[100px]">DIFERENÇA</th>
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
                                { key: 'custo', label: 'Custo', field: 'custo', color: 'text-red-600', fmt: formatCurrency },
                                { key: 'oferta', label: 'Vendas Oferta', field: 'vendasOferta', color: 'text-rose-600', fmt: formatCurrency },
                                { key: 'lucro', label: 'Lucro', field: 'lucro', color: 'text-cyan-600', fmt: formatCurrency },
                                { key: 'margem', label: 'Markdown', field: 'margem', color: 'text-purple-600', fmt: formatPercent },
                                { key: 'pctOferta', label: 'Markdown em Oferta', field: 'pctOferta', color: 'text-pink-600', fmt: formatPercent },
                                { key: 'ticket', label: 'Ticket Médio', field: 'ticketMedio', color: 'text-amber-600', fmt: formatCurrency },
                                { key: 'skus', label: 'SKUs', field: 'skus', color: 'text-blue-600', fmt: (v) => v?.toLocaleString('pt-BR') || '0' },
                                { key: 'cupons', label: 'Cupons', field: 'cupons', color: 'text-indigo-600', fmt: (v) => v?.toLocaleString('pt-BR') || '0' },
                                { key: 'itens', label: 'Itens Vendidos', field: 'itensVendidos', color: 'text-orange-600', fmt: (v) => v?.toLocaleString('pt-BR') || '0' },
                              ].map((sub) => (
                                <tr key={`sa-sub-${s.codSecao}-${sub.key}`} className={`border-b border-gray-50 cursor-pointer transition-colors ${graficoMetrica === sub.field && showGraficoSetorAnual ? 'bg-orange-100/70' : 'bg-gray-50/50 hover:bg-orange-50/50'}`} onClick={() => { setGraficoMetrica(sub.field); if (!showGraficoSetorAnual) setShowGraficoSetorAnual(true); }}>
                                  <td className={`px-3 py-1.5 text-xs sticky left-0 pl-8 ${graficoMetrica === sub.field && showGraficoSetorAnual ? 'bg-orange-100/70 font-semibold text-orange-700' : 'bg-gray-50/50 text-gray-500'}`}>
                                    {graficoMetrica === sub.field && showGraficoSetorAnual ? '📊 ' : ''}{sub.label}
                                  </td>
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

              {/* ===== ANALISE PRODUTOS ANUAL ===== */}
              {analiseAtiva === 'produto-anual' && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                    <h3 className="text-white font-semibold text-sm sm:text-base">Analise Produtos Anual</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => handleAnoProdutoAnualChange(anoProdutoAnual - 1)} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                      </button>
                      <span className="text-white font-bold text-lg min-w-[60px] text-center">{anoProdutoAnual}</span>
                      <button onClick={() => handleAnoProdutoAnualChange(anoProdutoAnual + 1)} disabled={anoProdutoAnual >= new Date().getFullYear()} className={`w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors ${anoProdutoAnual >= new Date().getFullYear() ? 'bg-white/10 cursor-not-allowed opacity-50' : 'bg-white/20 hover:bg-white/30'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  </div>

                  {/* Metric pills */}
                  <div className="px-3 sm:px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-1 sm:gap-1.5">
                    {[
                      { key: 'venda', label: 'Vendas' },
                      { key: 'custo', label: 'Custo' },
                      { key: 'lucro', label: 'Lucro' },
                      { key: 'margem', label: 'Markdown %' },
                      { key: 'margemLimpa', label: 'MG Limpa %' },
                      { key: 'impostos', label: 'Impostos' },
                      { key: 'ticketMedio', label: 'Ticket Medio' },
                      { key: 'vendasOferta', label: 'Vendas Oferta' },
                      { key: 'pctOferta', label: '% Oferta' },
                      { key: 'cupons', label: 'Cupons' },
                      { key: 'skus', label: 'SKUs' },
                      { key: 'qtd', label: 'Qtd' },
                    ].map(m => (
                      <button key={m.key} onClick={() => setProdutoAnualMetrica(m.key)} className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold transition-colors ${produtoAnualMetrica === m.key ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>{m.label}</button>
                    ))}
                  </div>

                  {/* Chart when product selected */}
                  {produtoSelecionadoGrafico && (() => {
                    const isPct = ['margem', 'margemLimpa', 'pctOferta'].includes(produtoAnualMetrica);
                    const isQtd = ['cupons', 'skus', 'qtd'].includes(produtoAnualMetrica);
                    const metLabels = { venda: 'Vendas', custo: 'Custo', lucro: 'Lucro', margem: 'Markdown %', margemLimpa: 'MG Limpa %', impostos: 'Impostos', ticketMedio: 'Ticket Medio', vendasOferta: 'Vendas Oferta', pctOferta: '% Oferta', cupons: 'Cupons', skus: 'SKUs', qtd: 'Qtd' };
                    const metricaLabel = metLabels[produtoAnualMetrica] || 'Vendas';
                    const barData = mesesCompletos.map(m => produtoSelecionadoGrafico.meses[m.num]?.[produtoAnualMetrica] || 0);
                    const totalProd = produtoSelecionadoGrafico.total[produtoAnualMetrica] || 0;
                    const fmtGraf = (v) => {
                      if (isPct) return v > 0 ? `${v.toFixed(1)}%` : '';
                      if (isQtd) return v > 0 ? v.toLocaleString('pt-BR') : '';
                      return v > 0 ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '';
                    };
                    return (
                      <div className="p-4 bg-white border-b border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{produtoSelecionadoGrafico.nome}</span>
                            <span className="text-xs text-gray-400">|</span>
                            <span className="text-xs text-orange-600 font-semibold">{metricaLabel}: {fmtGraf(totalProd)}</span>
                          </div>
                          <button onClick={() => setProdutoSelecionadoGrafico(null)} className="text-gray-400 hover:text-gray-600 text-sm font-bold px-2">✕</button>
                        </div>
                        <div style={{ height: '300px' }}>
                          <Bar
                            plugins={[ChartDataLabels]}
                            data={{
                              labels: mesesCompletos.map(m => m.nome),
                              datasets: [{
                                label: produtoSelecionadoGrafico.nome,
                                data: barData,
                                backgroundColor: barData.map(v => v > 0 ? 'rgba(249, 115, 22, 0.7)' : 'rgba(229, 231, 235, 0.5)'),
                                borderColor: 'rgba(249, 115, 22, 1)',
                                borderWidth: 1,
                                borderRadius: 4,
                                barPercentage: 0.6,
                                categoryPercentage: 0.7,
                                datalabels: {
                                  display: true,
                                  anchor: 'end',
                                  align: 'top',
                                  offset: 4,
                                  font: { size: 11, weight: 'bold' },
                                  color: '#374151',
                                  formatter: fmtGraf
                                }
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              layout: { padding: { top: 30 } },
                              plugins: {
                                legend: { display: false },
                                title: {
                                  display: true,
                                  text: `${metricaLabel} - ${produtoSelecionadoGrafico.nome} - ${anoProdutoAnual}`,
                                  font: { size: 13, weight: 'bold' },
                                  color: '#374151'
                                },
                                tooltip: {
                                  callbacks: {
                                    label: (ctx) => {
                                      if (isPct) return `${ctx.raw.toFixed(2).replace('.', ',')}%`;
                                      if (isQtd) return ctx.raw.toLocaleString('pt-BR');
                                      return `R$ ${ctx.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                    }
                                  }
                                }
                              },
                              scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } },
                                y: {
                                  ticks: { callback: (v) => isPct ? `${v.toFixed(0)}%` : isQtd ? v.toLocaleString('pt-BR') : `R$ ${(v / 1000).toFixed(0)}k`, font: { size: 10 } },
                                  grid: { color: 'rgba(0,0,0,0.06)' }
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Table */}
                  {loadingProdutoAnual ? (
                    <RadarLoading size="sm" message="" />
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-600">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase border-b border-gray-500 sticky left-0 bg-gray-600 min-w-[200px] z-10">Setor / Grupo / Produto</th>
                          {mesesCompletos.map((mes) => (
                            <th key={`pa-h-${mes.num}`} className="px-2 py-3 text-center text-xs font-semibold text-white uppercase border-b border-gray-500 min-w-[90px]">{mes.nome}</th>
                          ))}
                          <th className="px-3 py-3 text-center text-xs font-semibold text-orange-300 uppercase border-b border-gray-500 bg-gray-700 min-w-[100px]">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produtoAnualSetores.map((setor, idx) => {
                          const isExpSecao = expandedProdAnualSecoes[setor.cod];
                          return (
                            <Fragment key={`pa-s-${setor.cod}`}>
                              <tr className={`hover:bg-orange-50 cursor-pointer border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`} onClick={() => toggleProdAnualSecao(setor.cod)}>
                                <td className={`px-3 py-2.5 text-sm font-bold text-gray-800 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                  <span className={`inline-block mr-1 transition-transform ${isExpSecao ? 'rotate-90' : ''}`}>▸</span>
                                  {setor.nome}
                                </td>
                                {mesesCompletos.map((mes) => {
                                  const v = setor.meses[mes.num]?.[produtoAnualMetrica] || 0;
                                  return <td key={`pa-s-${setor.cod}-${mes.num}`} className={`px-2 py-2.5 text-xs text-center font-medium ${v ? 'text-gray-800' : 'text-gray-300'}`}>{v ? fmtProdAnualCell(v) : '-'}</td>;
                                })}
                                <td className="px-3 py-2.5 text-xs text-center font-bold text-orange-800 bg-orange-50">{fmtProdAnualCell(setor.total[produtoAnualMetrica])}</td>
                              </tr>
                              {/* Loading grupos */}
                              {isExpSecao && isExpSecao.loading && (
                                <tr><td colSpan={14} className="py-2"><RadarLoading size="sm" message="" /></td></tr>
                              )}
                              {/* Grupos */}
                              {isExpSecao && !isExpSecao.loading && isExpSecao.data.map((grupo, gIdx) => {
                                const grpKey = `${setor.cod}_${grupo.cod}`;
                                const isExpGrupo = expandedProdAnualGrupos[grpKey];
                                return (
                                  <Fragment key={`pa-g-${grpKey}`}>
                                    <tr className="hover:bg-blue-50/50 cursor-pointer border-b border-gray-50 bg-blue-50/30" onClick={() => toggleProdAnualGrupo(grupo.cod, setor.cod)}>
                                      <td className="px-3 py-2 text-xs font-semibold text-blue-800 sticky left-0 z-10 bg-blue-50/30 pl-8">
                                        <span className={`inline-block mr-1 transition-transform ${isExpGrupo ? 'rotate-90' : ''}`}>▸</span>
                                        {grupo.nome}
                                      </td>
                                      {mesesCompletos.map((mes) => {
                                        const v = grupo.meses[mes.num]?.[produtoAnualMetrica] || 0;
                                        return <td key={`pa-g-${grpKey}-${mes.num}`} className={`px-2 py-2 text-xs text-center ${v ? 'text-blue-700' : 'text-gray-300'}`}>{v ? fmtProdAnualCell(v) : '-'}</td>;
                                      })}
                                      <td className="px-3 py-2 text-xs text-center font-semibold text-blue-800 bg-orange-50/50">{fmtProdAnualCell(grupo.total[produtoAnualMetrica])}</td>
                                    </tr>
                                    {/* Loading subgrupos */}
                                    {isExpGrupo && isExpGrupo.loading && (
                                      <tr><td colSpan={14} className="py-2"><RadarLoading size="sm" message="" /></td></tr>
                                    )}
                                    {/* Subgrupos */}
                                    {isExpGrupo && !isExpGrupo.loading && isExpGrupo.data.map((subgrupo) => {
                                      const sgKey = `${setor.cod}_${grupo.cod}_${subgrupo.cod}`;
                                      const isExpSub = expandedProdAnualSubgrupos[sgKey];
                                      return (
                                        <Fragment key={`pa-sg-${sgKey}`}>
                                          <tr className="hover:bg-purple-50/50 cursor-pointer border-b border-gray-50 bg-purple-50/20" onClick={() => toggleProdAnualSubgrupo(subgrupo.cod, grupo.cod, setor.cod)}>
                                            <td className="px-3 py-1.5 text-xs font-medium text-purple-700 sticky left-0 z-10 bg-purple-50/20 pl-14">
                                              <span className={`inline-block mr-1 transition-transform ${isExpSub ? 'rotate-90' : ''}`}>▸</span>
                                              {subgrupo.nome}
                                            </td>
                                            {mesesCompletos.map((mes) => {
                                              const v = subgrupo.meses[mes.num]?.[produtoAnualMetrica] || 0;
                                              return <td key={`pa-sg-${sgKey}-${mes.num}`} className={`px-2 py-1.5 text-xs text-center ${v ? 'text-purple-600' : 'text-gray-300'}`}>{v ? fmtProdAnualCell(v) : '-'}</td>;
                                            })}
                                            <td className="px-3 py-1.5 text-xs text-center font-semibold text-purple-700 bg-orange-50/30">{fmtProdAnualCell(subgrupo.total[produtoAnualMetrica])}</td>
                                          </tr>
                                          {/* Loading itens */}
                                          {isExpSub && isExpSub.loading && (
                                            <tr><td colSpan={14} className="py-2"><RadarLoading size="sm" message="" /></td></tr>
                                          )}
                                          {/* Itens (Produtos) */}
                                          {isExpSub && !isExpSub.loading && isExpSub.data.map((item) => {
                                            const isSel = produtoSelecionadoGrafico?.cod === item.cod;
                                            return (
                                              <tr key={`pa-i-${item.cod}`} className={`border-b border-gray-50 cursor-pointer transition-colors ${isSel ? 'bg-orange-100 ring-1 ring-orange-300' : 'bg-green-50 hover:bg-green-50/50'}`} onClick={() => setProdutoSelecionadoGrafico(isSel ? null : item)}>
                                                <td className={`px-3 py-1.5 text-xs sticky left-0 z-10 pl-20 ${isSel ? 'bg-orange-100 font-bold text-orange-700' : 'bg-green-50 text-green-800'}`}>
                                                  {isSel ? '>> ' : ''}{item.nome}
                                                </td>
                                                {mesesCompletos.map((mes) => {
                                                  const v = item.meses[mes.num]?.[produtoAnualMetrica] || 0;
                                                  return <td key={`pa-i-${item.cod}-${mes.num}`} className={`px-2 py-1.5 text-xs text-center ${v ? (isSel ? 'text-orange-700 font-semibold' : 'text-green-700') : 'text-gray-300'}`}>{v ? fmtProdAnualCell(v) : '-'}</td>;
                                                })}
                                                <td className={`px-3 py-1.5 text-xs text-center font-semibold ${isSel ? 'text-orange-800 bg-orange-50' : 'text-green-800 bg-orange-50/30'}`}>{fmtProdAnualCell(item.total[produtoAnualMetrica])}</td>
                                              </tr>
                                            );
                                          })}
                                        </Fragment>
                                      );
                                    })}
                                  </Fragment>
                                );
                              })}
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

        {/* ====== MODO DEFESA - Cards com dados reais (mesmo estilo ATAQUE) + Drag and Drop ====== */}
        {!loading && !error && modoVisao === 'defesa' && (
          <>
            {defesaData.loadingDefesa && <RadarLoading message="Carregando dados de defesa..." />}
            {!defesaData.loadingDefesa && (() => {
              // Config dos cards DEFESA (lookup por key)
              const defesaCardsConfig = {
                naoBipados: { border: 'border-yellow-500', bg: 'bg-yellow-100', ic: 'text-yellow-600', lb: 'NAO BIPADOS', val: () => formatPercent(defesaData.naoBipados?.pct), title: 'NAO VERIFICADOS', tipo: 'percent', d: defesaData.naoBipados, svg: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
                furtos: { border: 'border-red-600', bg: 'bg-red-100', ic: 'text-red-600', lb: 'FURTOS', val: () => formatCurrency(defesaData.furtos?.valor), extra: () => <span className="text-2xl font-bold text-red-600">({defesaData.furtos?.qtd || 0})</span>, title: 'FURTOS IDENTIFICADOS', tipo: 'currency', d: defesaData.furtos, svg: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
                cancelamentos: { border: 'border-orange-500', bg: 'bg-orange-100', ic: 'text-orange-600', lb: 'CANCELAMENTOS', val: () => formatCurrency(defesaData.cancelamentos?.atual), extra: () => <span className="text-2xl font-bold text-orange-600">{formatPercent(defesaData.cancelamentos?.pct)}</span>, title: 'CANCELAMENTOS + ESTORNOS', tipo: 'currency', d: defesaData.cancelamentos, inv: true, svg: 'M6 18L18 6M6 6l12 12' },
                descontos: { border: 'border-amber-500', bg: 'bg-amber-100', ic: 'text-amber-600', lb: 'DESCONTOS', val: () => formatCurrency(defesaData.descontos?.atual), extra: () => <span className="text-2xl font-bold text-amber-600">{formatPercent(defesaData.descontos?.pct)}</span>, title: 'DESCONTOS CONCEDIDOS', tipo: 'currency', d: defesaData.descontos, inv: true, svg: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
                valeTroca: { border: 'border-blue-500', bg: 'bg-blue-100', ic: 'text-blue-600', lb: 'VALE TROCA', val: () => formatCurrency(defesaData.valeTroca?.atual), extra: () => <span className="text-2xl font-bold text-blue-600">{formatPercent(defesaData.valeTroca?.pct)}</span>, title: 'VALE TROCA NO PERIODO', tipo: 'currency', d: defesaData.valeTroca, inv: true, svg: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
                valeDesconto: { border: 'border-purple-500', bg: 'bg-purple-100', ic: 'text-purple-600', lb: 'VALE DESCONTO', val: () => formatCurrency(defesaData.valeDesconto?.atual), title: 'VALE DESCONTO NO PERIODO', tipo: 'currency', d: defesaData.valeDesconto, inv: true, svg: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
                sobraCaixa: { border: 'border-green-500', bg: 'bg-green-100', ic: 'text-green-600', lb: 'SOBRA CAIXA', val: () => formatCurrency(defesaData.sobraCaixa?.atual), title: 'SOBRA DE CAIXA', tipo: 'currency', d: defesaData.sobraCaixa, svg: 'M5 10l7-7m0 0l7 7m-7-7v18' },
                faltaCaixa: { border: 'border-red-500', bg: 'bg-red-100', ic: 'text-red-600', lb: 'FALTA CAIXA', val: () => formatCurrency(defesaData.faltaCaixa?.atual), title: 'FALTA DE CAIXA', tipo: 'currency', d: defesaData.faltaCaixa, inv: true, svg: 'M19 14l-7 7m0 0l-7-7m7 7V3' },
                rupturaTaxa: { border: 'border-red-400', bg: 'bg-red-50', ic: 'text-red-500', lb: '% RUPTURA', val: () => formatPercent(defesaData.rupturaTaxa?.atual), title: 'TAXA DE RUPTURA IDENTIFICADA', tipo: 'percent', d: defesaData.rupturaTaxa, inv: true, svg: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7' },
                rupturaPerdaVenda: { border: 'border-emerald-500', bg: 'bg-emerald-100', ic: 'text-emerald-600', lb: 'PERDA VENDA', val: () => formatCurrency(defesaData.rupturaPerdaVenda?.atual), title: 'PERDA DE VENDA IDENTIFICADA', tipo: 'currency', d: defesaData.rupturaPerdaVenda, inv: true, svg: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' },
                rupturaPerdaLucro: { border: 'border-indigo-500', bg: 'bg-indigo-100', ic: 'text-indigo-600', lb: 'PERDA LUCRO', val: () => formatCurrency(defesaData.rupturaPerdaLucro?.atual), title: 'PERDA DE LUCRO IDENTIFICADA', tipo: 'currency', d: defesaData.rupturaPerdaLucro, inv: true, svg: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                etiquetaTaxa: { border: 'border-sky-500', bg: 'bg-sky-100', ic: 'text-sky-600', lb: 'ETIQ. DESCONF.', val: () => formatPercent(defesaData.etiquetaTaxa?.atual), title: 'TAXA ETIQUETAS DESCONFORMES', tipo: 'percent', d: defesaData.etiquetaTaxa, inv: true, svg: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                fluxoCaixa: { border: 'border-orange-500', bg: 'bg-orange-100', ic: 'text-orange-600', lb: 'FLUXO DE CAIXA', val: () => formatCurrency(defesaData.fluxoCaixa?.atual), title: 'RESULTADO DO PERIODO', tipo: 'currency', d: defesaData.fluxoCaixa, svg: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                perdasEstoque: { border: 'border-rose-500', bg: 'bg-rose-100', ic: 'text-rose-600', lb: 'PERDAS ESTOQUE', val: () => formatCurrency(defesaData.perdasEstoque?.atual), extra: () => <span className="text-2xl font-bold text-rose-600">{formatPercent(defesaData.perdasEstoque?.pct)}</span>, title: 'PERDAS DE ESTOQUE IDENTIFICADAS', tipo: 'currency', d: defesaData.perdasEstoque, inv: true, svg: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
                mediaPerformColab: { border: 'border-cyan-500', bg: 'bg-cyan-100', ic: 'text-cyan-600', lb: 'MEDIA COLAB.', val: () => formatCurrency(mediaPerformColab.media), extra: () => mediaPerformColab.configurado ? <span className="text-xs text-gray-400 ml-1">({mediaPerformColab.totalPonderado.toFixed(1)} colab.)</span> : <span className="text-xs text-orange-500 ml-1">Configurar</span>, title: 'MEDIA PERFORMANCE COLABORADORES', tipo: 'currency', d: { atual: mediaPerformColab.media, mesPassado: mediaPerformColab.mesPassado, anoPassado: mediaPerformColab.anoPassado }, hasGear: true, svg: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                trocasFornecedor: { border: 'border-orange-400', bg: 'bg-orange-50', ic: 'text-orange-500', lb: 'TROCAS FORN.', val: () => formatCurrency(defesaData.trocasFornecedor?.atual), extra: () => <span className="text-sm font-semibold text-orange-500">({defesaData.trocasFornecedor?.fornecedores || 0} forn.)</span>, title: 'TROCAS PENDENTES FORNECEDORES', tipo: 'currency', d: defesaData.trocasFornecedor, inv: true, svg: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
                defesa17: { emBreve: true },
                dre: { isDre: true, border: 'border-violet-500', bg: 'bg-violet-100', ic: 'text-violet-600', lb: 'DRE', svg: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
              };

              const renderDefesaCard = (cardId, row) => {
                const c = defesaCardsConfig[cardId];
                if (!c) return null;
                const isDragging = draggedDefesaCard === cardId;

                // Card DRE customizado
                if (c.isDre) {
                  const dre = defesaData.dre || {};
                  const liqColor = (dre.liquido || 0) >= 0 ? 'text-green-700' : 'text-red-700';
                  return (
                    <div key={cardId} draggable onDragStart={(e) => handleDefesaDragStart(e, cardId, row)} onDragEnd={handleDefesaDragEnd} onDragOver={handleDefesaDragOver} onDrop={(e) => handleDefesaDrop(e, cardId, row)}
                      className={`bg-white rounded-xl shadow-lg p-3 sm:p-4 border-t-4 ${c.border} hover:shadow-xl transition-all cursor-grab active:cursor-grabbing h-full flex flex-col justify-between ${isDragging ? 'opacity-50 scale-95' : ''}`}>
                      <div>
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
                            <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${c.ic}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d={c.svg} /></svg>
                          </div>
                          <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
                            <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${c.ic}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                            {c.lb}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1.5 mb-1">
                          <p className={`text-xl sm:text-2xl font-bold ${liqColor}`}>{formatCurrency(dre.liquido || 0)}</p>
                          <span className={`text-sm font-bold ${liqColor}`}>{formatPercent(dre.pctLiquido || 0)}</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 mb-1">LIQUIDO DO PERIODO</p>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-gray-100">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Receitas:</span>
                          <span className="font-semibold text-green-700">{formatCurrency(dre.receitas || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Custos:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-red-600">{formatCurrency(dre.custos || 0)}</span>
                            <span className="text-[10px] text-red-400">{formatPercent(dre.pctCustos || 0)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Despesas:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-orange-600">{formatCurrency(dre.despesas || 0)}</span>
                            <span className="text-[10px] text-orange-400">{formatPercent(dre.pctDespesas || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (c.emBreve) {
                  return (
                    <div key={cardId} draggable onDragStart={(e) => handleDefesaDragStart(e, cardId, row)} onDragEnd={handleDefesaDragEnd} onDragOver={handleDefesaDragOver} onDrop={(e) => handleDefesaDrop(e, cardId, row)}
                      className={`bg-white rounded-xl shadow-lg p-3 sm:p-4 border-t-4 border-gray-300 hover:shadow-xl transition-all cursor-grab active:cursor-grabbing h-full flex flex-col justify-between ${isDragging ? 'opacity-50 scale-95' : ''}`}>
                      <div>
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          </div>
                          <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
                            EM BREVE
                          </span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold text-gray-400 mb-1">-</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3">EM BREVE</p>
                      </div>
                      <div className="space-y-1 pt-2 border-t border-gray-100">
                        <div className="flex justify-between items-center text-xs"><span className="text-gray-400">Mes Passado:</span><span className="text-gray-300">-</span></div>
                        <div className="flex justify-between items-center text-xs"><span className="text-gray-400">Ano Passado:</span><span className="text-gray-300">-</span></div>
                        <div className="flex justify-between items-center text-xs"><span className="text-gray-400">&nbsp;</span></div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={cardId} draggable onDragStart={(e) => handleDefesaDragStart(e, cardId, row)} onDragEnd={handleDefesaDragEnd} onDragOver={handleDefesaDragOver} onDrop={(e) => handleDefesaDrop(e, cardId, row)}
                    className={`bg-white rounded-xl shadow-lg p-3 sm:p-4 border-t-4 ${c.border} hover:shadow-xl transition-all cursor-grab active:cursor-grabbing h-full flex flex-col justify-between ${isDragging ? 'opacity-50 scale-95' : ''}`}>
                    <div>
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
                          <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${c.ic}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d={c.svg} /></svg>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
                            <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${c.ic}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                            {c.lb}
                          </span>
                          {c.hasGear && (
                            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setColabConfigTemp({...colabConfig}); setShowColabModal(true); }} className="p-0.5 rounded hover:bg-gray-200 transition-colors" title="Configurar colaboradores">
                              <svg className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5 sm:gap-2 mb-1">
                        <p className="text-xl sm:text-2xl font-bold text-gray-800">{c.val()}</p>
                        {c.extra && c.extra()}
                      </div>
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-1">{c.title}</p>
                      {c.hasGear && mediaPerformColab.mediaProjetada > 0 && (
                        <div className="flex items-baseline gap-1.5 mb-2">
                          <span className="text-[10px] text-gray-400 uppercase">Proj. Mes:</span>
                          <span className="text-sm font-bold text-cyan-700">{formatCurrency(mediaPerformColab.mediaProjetada)}</span>
                        </div>
                      )}
                    </div>
                    {c.hasGear ? (
                      <div className="space-y-1 pt-2 border-t border-gray-100">
                        <Comparativo label="Mes Passado" valor={c.d?.mesPassado} valorAtual={c.d?.atual} tipo={c.tipo} />
                        <Comparativo label="Ano Passado" valor={c.d?.anoPassado} valorAtual={c.d?.atual} tipo={c.tipo} />
                        <div className="flex justify-between items-center text-[10px] text-gray-400 pt-0.5">
                          <span>CLT: {colabConfig.clt}</span><span>Apr: {colabConfig.aprendiz}</span><span>Est: {colabConfig.estagiario}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 pt-2 border-t border-gray-100">
                        <Comparativo label="Mes Passado" valor={c.d?.mesPassado} valorAtual={c.d?.atual} tipo={c.tipo} invertido={c.inv} />
                        <Comparativo label="Ano Passado" valor={c.d?.anoPassado} valorAtual={c.d?.atual} tipo={c.tipo} invertido={c.inv} />
                        <div className="flex justify-between items-center text-xs"><span className="text-gray-400">&nbsp;</span></div>
                      </div>
                    )}
                  </div>
                );
              };

              return (
              <>
              {/* Linha 1 - DEFESA (Drag and Drop) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {defesaOrder1.map((cardId) => renderDefesaCard(cardId, 1))}
              </div>
              {/* Linha 2 - DEFESA (Drag and Drop) */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {defesaOrder2.map((cardId) => renderDefesaCard(cardId, 2))}
              </div>
              {/* Linha 3 - DEFESA EM BREVE (Drag and Drop) */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {defesaOrder3.map((cardId) => renderDefesaCard(cardId, 3))}
              </div>
              </>
              );
            })()}
          </>
        )}

        {/* Modal Configuração de Colaboradores */}
        {/* Modal Configurar Área de Venda (m²) */}
        {showAreaVendaModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setShowAreaVendaModal(false)}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 flex justify-between items-center text-white flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold">AREA DE VENDA</h2>
                  <p className="text-cyan-200 text-xs mt-0.5">Defina a metragem da area de venda da loja</p>
                </div>
                <button onClick={() => setShowAreaVendaModal(false)} className="text-white hover:text-gray-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p>Informe a area de venda em metros quadrados (m²). Este valor sera usado para calcular os indicadores por metro quadrado.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area de Venda (m²)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={areaVendaTemp}
                    onChange={(e) => setAreaVendaTemp(Number(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="Ex: 500"
                    autoFocus
                  />
                </div>
                {areaVendaTemp > 0 && (() => {
                  const vendasMetroTemp = (indicadores.vendas?.atual || 0) / areaVendaTemp;
                  const classifTemp = getVendasClassificacao(vendasMetroTemp);
                  const coresTemp = classifTemp ? (skuClassifCores[classifTemp.label] || {}) : {};
                  return (
                    <div className="bg-cyan-50 rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-gray-600">Vendas Atual:</span><span className="font-bold">{formatCurrency(indicadores.vendas?.atual || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Area:</span><span className="font-bold">{formatNumber(areaVendaTemp)} m²</span></div>
                      <div className="flex justify-between text-cyan-700 border-t border-cyan-200 pt-1 mt-1">
                        <span className="font-semibold">Vendas/m²:</span>
                        <span className="font-bold text-lg">{formatCurrency(vendasMetroTemp)}</span>
                      </div>
                      {classifTemp && (
                        <div className="flex justify-between items-center border-t border-cyan-200 pt-1 mt-1">
                          <span className="font-semibold text-gray-600">Classificação:</span>
                          <span className={`font-bold text-lg px-3 py-0.5 rounded-full ${coresTemp.text} ${coresTemp.bg} border ${coresTemp.border}`}>{classifTemp.label}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="border-t border-gray-200 pt-3 mt-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Faixas de Classificação (Vendas/M²)</p>
                  <div className="space-y-2">
                    {vendasFaixasTemp.map((f, i) => {
                      const cores = skuClassifCores[f.label] || {};
                      return (
                        <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${cores.bg} border ${cores.border}`}>
                          <div className="flex-1 flex items-center gap-1 text-sm">
                            {f.min === null ? (
                              <>
                                <span className="text-gray-500 text-xs">ABAIXO DE</span>
                                <span className="text-gray-400 text-xs">R$</span>
                                <input type="number" min="0" step="0.01" value={f.max} onChange={(e) => { const nf = [...vendasFaixasTemp]; nf[i] = { ...nf[i], max: Number(e.target.value) || 0 }; setVendasFaixasTemp(nf); }} className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-cyan-500" />
                              </>
                            ) : f.max === null ? (
                              <>
                                <span className="text-gray-500 text-xs">ACIMA DE</span>
                                <span className="text-gray-400 text-xs">R$</span>
                                <input type="number" min="0" step="0.01" value={f.min} onChange={(e) => { const nf = [...vendasFaixasTemp]; nf[i] = { ...nf[i], min: Number(e.target.value) || 0 }; setVendasFaixasTemp(nf); }} className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-cyan-500" />
                              </>
                            ) : (
                              <>
                                <span className="text-gray-400 text-xs">R$</span>
                                <input type="number" min="0" step="0.01" value={f.min} onChange={(e) => { const nf = [...vendasFaixasTemp]; nf[i] = { ...nf[i], min: Number(e.target.value) || 0 }; setVendasFaixasTemp(nf); }} className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-cyan-500" />
                                <span className="text-gray-500 text-xs">A</span>
                                <span className="text-gray-400 text-xs">R$</span>
                                <input type="number" min="0" step="0.01" value={f.max} onChange={(e) => { const nf = [...vendasFaixasTemp]; nf[i] = { ...nf[i], max: Number(e.target.value) || 0 }; setVendasFaixasTemp(nf); }} className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-cyan-500" />
                              </>
                            )}
                          </div>
                          <span className={`font-bold text-xs ${cores.text}`}>{f.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 flex justify-end gap-2 border-t">
                <button onClick={() => setShowAreaVendaModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200">Cancelar</button>
                <button onClick={() => { saveAreaVenda(areaVendaTemp); saveVendasFaixas(vendasFaixasTemp); }} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-semibold">Salvar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Configurar Faixas SKU/M² */}
        {showSkuFaixasModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setShowSkuFaixasModal(false)}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-sky-600 to-sky-700 p-4 flex justify-between items-center text-white">
                <div>
                  <h2 className="text-lg font-bold">FAIXAS SKU POR M²</h2>
                  <p className="text-sky-200 text-xs mt-0.5">Configure as faixas de classificação</p>
                </div>
                <button onClick={() => setShowSkuFaixasModal(false)} className="text-white hover:text-gray-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 uppercase px-1">
                  <span>Faixa</span>
                  <span className="col-span-1 text-center">Valores</span>
                  <span className="text-right">Classificação</span>
                </div>
                {skuFaixasTemp.map((f, i) => {
                  const cores = skuClassifCores[f.label] || {};
                  return (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${cores.bg} border ${cores.border}`}>
                      <div className="flex-1 flex items-center gap-1 text-sm">
                        {f.min === null ? (
                          <>
                            <span className="text-gray-500 text-xs">ABAIXO DE</span>
                            <input type="number" min="0" value={f.max} onChange={(e) => { const nf = [...skuFaixasTemp]; nf[i] = { ...nf[i], max: Number(e.target.value) || 0 }; setSkuFaixasTemp(nf); }} className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-sky-500" />
                          </>
                        ) : f.max === null ? (
                          <>
                            <span className="text-gray-500 text-xs">ACIMA DE</span>
                            <input type="number" min="0" value={f.min} onChange={(e) => { const nf = [...skuFaixasTemp]; nf[i] = { ...nf[i], min: Number(e.target.value) || 0 }; setSkuFaixasTemp(nf); }} className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-sky-500" />
                          </>
                        ) : (
                          <>
                            <input type="number" min="0" value={f.min} onChange={(e) => { const nf = [...skuFaixasTemp]; nf[i] = { ...nf[i], min: Number(e.target.value) || 0 }; setSkuFaixasTemp(nf); }} className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-sky-500" />
                            <span className="text-gray-500 text-xs">A</span>
                            <input type="number" min="0" value={f.max} onChange={(e) => { const nf = [...skuFaixasTemp]; nf[i] = { ...nf[i], max: Number(e.target.value) || 0 }; setSkuFaixasTemp(nf); }} className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-sky-500" />
                          </>
                        )}
                      </div>
                      <span className={`font-bold text-sm ${cores.text}`}>{f.label}</span>
                    </div>
                  );
                })}
                {areaVenda > 0 && (() => {
                  const skuAtual = ((produtosRevenda.qtdProdutos || 0) + (produtosRevenda.qtdProducao || 0)) / areaVenda;
                  const classif = getSkuClassificacao(skuAtual.toFixed(2).replace('.', ','));
                  const cores = classif ? (skuClassifCores[classif.label] || {}) : {};
                  return (
                    <div className="bg-sky-50 rounded-lg p-3 text-sm space-y-1 border border-sky-200 mt-2">
                      <div className="flex justify-between"><span className="text-gray-600">SKU/M² Atual:</span><span className="font-bold">{skuAtual.toFixed(2).replace('.', ',')}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Classificação:</span><span className={`font-bold ${cores.text || ''}`}>{classif?.label || '-'}</span></div>
                    </div>
                  );
                })()}
              </div>
              <div className="px-4 py-3 bg-gray-50 flex justify-end gap-2 border-t">
                <button onClick={() => setShowSkuFaixasModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200">Cancelar</button>
                <button onClick={() => saveSkuFaixas(skuFaixasTemp)} className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold">Salvar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Configurar Faixas Vendas/M² */}
        {showVendasFaixasModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setShowVendasFaixasModal(false)}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 flex justify-between items-center text-white">
                <div>
                  <h2 className="text-lg font-bold">FAIXAS VENDAS POR M²</h2>
                  <p className="text-cyan-200 text-xs mt-0.5">Configure as faixas de classificação</p>
                </div>
                <button onClick={() => setShowVendasFaixasModal(false)} className="text-white hover:text-gray-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 space-y-3">
                {vendasFaixasTemp.map((f, i) => {
                  const cores = skuClassifCores[f.label] || {};
                  return (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${cores.bg} border ${cores.border}`}>
                      <div className="flex-1 flex items-center gap-1 text-sm">
                        {f.min === null ? (
                          <>
                            <span className="text-gray-500 text-xs">ABAIXO DE</span>
                            <span className="text-gray-400 text-xs">R$</span>
                            <input type="number" min="0" step="0.01" value={f.max} onChange={(e) => { const nf = [...vendasFaixasTemp]; nf[i] = { ...nf[i], max: Number(e.target.value) || 0 }; setVendasFaixasTemp(nf); }} className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-cyan-500" />
                          </>
                        ) : f.max === null ? (
                          <>
                            <span className="text-gray-500 text-xs">ACIMA DE</span>
                            <span className="text-gray-400 text-xs">R$</span>
                            <input type="number" min="0" step="0.01" value={f.min} onChange={(e) => { const nf = [...vendasFaixasTemp]; nf[i] = { ...nf[i], min: Number(e.target.value) || 0 }; setVendasFaixasTemp(nf); }} className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-cyan-500" />
                          </>
                        ) : (
                          <>
                            <span className="text-gray-400 text-xs">R$</span>
                            <input type="number" min="0" step="0.01" value={f.min} onChange={(e) => { const nf = [...vendasFaixasTemp]; nf[i] = { ...nf[i], min: Number(e.target.value) || 0 }; setVendasFaixasTemp(nf); }} className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-cyan-500" />
                            <span className="text-gray-500 text-xs">A</span>
                            <span className="text-gray-400 text-xs">R$</span>
                            <input type="number" min="0" step="0.01" value={f.max} onChange={(e) => { const nf = [...vendasFaixasTemp]; nf[i] = { ...nf[i], max: Number(e.target.value) || 0 }; setVendasFaixasTemp(nf); }} className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-cyan-500" />
                          </>
                        )}
                      </div>
                      <span className={`font-bold text-sm ${cores.text}`}>{f.label}</span>
                    </div>
                  );
                })}
                {areaVenda > 0 && (() => {
                  const vendasMetroVal = (indicadores.vendas?.atual || 0) / areaVenda;
                  const classif = getVendasClassificacao(vendasMetroVal);
                  const cores = classif ? (skuClassifCores[classif.label] || {}) : {};
                  return (
                    <div className="bg-cyan-50 rounded-lg p-3 text-sm space-y-1 border border-cyan-200 mt-2">
                      <div className="flex justify-between"><span className="text-gray-600">Vendas/M² Atual:</span><span className="font-bold">{formatCurrency(vendasMetroVal)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Classificação:</span><span className={`font-bold ${cores.text || ''}`}>{classif?.label || '-'}</span></div>
                    </div>
                  );
                })()}
              </div>
              <div className="px-4 py-3 bg-gray-50 flex justify-end gap-2 border-t">
                <button onClick={() => setShowVendasFaixasModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200">Cancelar</button>
                <button onClick={() => saveVendasFaixas(vendasFaixasTemp)} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-semibold">Salvar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Configurar Ticket Médio por Área */}
        {showTicketFaixasModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setShowTicketFaixasModal(false)}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 flex justify-between items-center text-white">
                <div>
                  <h2 className="text-lg font-bold">TICKET MEDIO POR M²</h2>
                  <p className="text-orange-200 text-xs mt-0.5">Configure o ticket esperado por faixa de área</p>
                </div>
                <button onClick={() => setShowTicketFaixasModal(false)} className="text-white hover:text-gray-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-500 uppercase px-1 mb-1">
                  <span>AREA EM M²</span>
                  <span className="text-right">TICKET MEDIO</span>
                </div>
                {(() => {
                  const ticketRowColors = ['bg-orange-50 border-orange-200','bg-amber-50 border-amber-200','bg-yellow-50 border-yellow-200','bg-lime-50 border-lime-200','bg-green-50 border-green-200','bg-emerald-50 border-emerald-200','bg-orange-50 border-orange-200','bg-cyan-50 border-cyan-200','bg-sky-50 border-sky-200','bg-blue-50 border-blue-200'];
                  return ticketFaixasTemp.map((f, i) => (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${ticketRowColors[i % ticketRowColors.length]}`}>
                      <div className="flex-1 flex items-center gap-1 text-sm">
                        <input type="number" min="0" value={f.minArea} onChange={(e) => { const nf = [...ticketFaixasTemp]; nf[i] = { ...nf[i], minArea: Number(e.target.value) || 0 }; setTicketFaixasTemp(nf); }} className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-orange-500" />
                        <span className="text-gray-500 text-xs">{f.maxArea !== null ? 'A' : '+'}</span>
                        {f.maxArea !== null ? (
                          <input type="number" min="0" value={f.maxArea} onChange={(e) => { const nf = [...ticketFaixasTemp]; nf[i] = { ...nf[i], maxArea: Number(e.target.value) || 0 }; setTicketFaixasTemp(nf); }} className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-orange-500" />
                        ) : (
                          <span className="w-16 text-center text-sm text-gray-400">...</span>
                        )}
                        <span className="text-gray-400 text-xs">m²</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 text-xs">R$</span>
                        <input type="number" min="0" step="0.01" value={f.ticketEsperado} onChange={(e) => { const nf = [...ticketFaixasTemp]; nf[i] = { ...nf[i], ticketEsperado: Number(e.target.value) || 0 }; setTicketFaixasTemp(nf); }} className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-center text-sm font-bold focus:ring-1 focus:ring-orange-500" />
                      </div>
                    </div>
                  ));
                })()}
                {areaVenda > 0 && (() => {
                  const esperado = getTicketMedioEsperado();
                  const atual = indicadores.ticketMedio?.atual || 0;
                  if (esperado === null) return null;
                  const dentro = atual >= esperado;
                  const diff = atual - esperado;
                  return (
                    <div className={`rounded-lg p-3 text-sm space-y-1 border mt-2 ${dentro ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex justify-between"><span className="text-gray-600">Sua área:</span><span className="font-bold">{formatNumber(areaVenda)} m²</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Ticket Esperado:</span><span className="font-bold">{formatCurrency(esperado)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Ticket Atual:</span><span className="font-bold">{formatCurrency(atual)}</span></div>
                      <div className={`flex justify-between border-t pt-1 mt-1 ${dentro ? 'border-green-200' : 'border-red-200'}`}>
                        <span className={`font-bold ${dentro ? 'text-green-600' : 'text-red-600'}`}>{dentro ? 'DENTRO DA MEDIA' : 'FORA DA MEDIA'}</span>
                        <span className={`font-bold ${dentro ? 'text-green-600' : 'text-red-600'}`}>{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="px-4 py-3 bg-gray-50 flex justify-end gap-2 border-t">
                <button onClick={() => setShowTicketFaixasModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200">Cancelar</button>
                <button onClick={() => saveTicketFaixas(ticketFaixasTemp)} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold">Salvar</button>
              </div>
            </div>
          </div>
        )}

        {showColabModal && (() => {
          const tp = (colabConfigTemp.clt * colabConfigTemp.pesoClt) + (colabConfigTemp.aprendiz * colabConfigTemp.pesoAprendiz) + (colabConfigTemp.estagiario * colabConfigTemp.pesoEstagiario);
          const tm = tp > 0 ? (defesaData.faturamento?.atual || 0) / tp : 0;
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setShowColabModal(false)}>
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 flex justify-between items-center text-white">
                  <div>
                    <h2 className="text-lg font-bold">CONFIGURAR COLABORADORES</h2>
                    <p className="text-cyan-200 text-xs mt-0.5">Defina a equipe para calcular a media de performance</p>
                  </div>
                  <button onClick={() => setShowColabModal(false)} className="text-white hover:text-gray-200">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                    <p className="font-semibold mb-1">Formula:</p>
                    <p>Total Ponderado = (CLT x Peso) + (Aprendiz x Peso) + (Estagiario x Peso)</p>
                    <p>Media = Faturamento / Total Ponderado</p>
                  </div>
                  {[
                    { key: 'clt', pesoKey: 'pesoClt', label: 'CLT' },
                    { key: 'aprendiz', pesoKey: 'pesoAprendiz', label: 'Aprendiz' },
                    { key: 'estagiario', pesoKey: 'pesoEstagiario', label: 'Estagiario' },
                  ].map(({ key, pesoKey, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-24 text-sm font-medium text-gray-700">{label}</span>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 uppercase">Qtd</label>
                        <input type="number" min="0" step="1" value={colabConfigTemp[key]} onChange={e => setColabConfigTemp(prev => ({...prev, [key]: parseInt(e.target.value) || 0}))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 uppercase">Peso</label>
                        <input type="number" min="0" max="2" step="0.1" value={colabConfigTemp[pesoKey]} onChange={e => setColabConfigTemp(prev => ({...prev, [pesoKey]: parseFloat(e.target.value) || 0}))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                      </div>
                    </div>
                  ))}
                  <div className="bg-cyan-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-600">Total Ponderado:</span><span className="font-bold">{tp.toFixed(1)} colaboradores</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Faturamento:</span><span className="font-bold">{formatCurrency(defesaData.faturamento?.atual || 0)}</span></div>
                    <div className="flex justify-between text-cyan-700 border-t border-cyan-200 pt-1 mt-1"><span className="font-semibold">Media por Colaborador:</span><span className="font-bold text-lg">{formatCurrency(tm)}</span></div>
                  </div>
                </div>
                <div className="px-4 py-3 bg-gray-50 flex justify-end gap-2 border-t">
                  <button onClick={() => setShowColabModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200">Cancelar</button>
                  <button onClick={() => saveColabConfig(colabConfigTemp)} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-semibold">Salvar</button>
                </div>
              </div>
            </div>
          );
        })()}

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
