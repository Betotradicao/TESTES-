import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const fmt = (v) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
const fmtPct = (v) => v != null ? Number(v).toFixed(2) + '%' : '0,00%';

const DEFAULT_TIERS = [
  { nome: 'Premium', cor: '#8B5CF6', ordem: 1 },
  { nome: 'Lider', cor: '#3B82F6', ordem: 2 },
  { nome: 'Intermediaria', cor: '#10B981', ordem: 3 },
  { nome: 'Combate', cor: '#F59E0B', ordem: 4 },
  { nome: 'Regional', cor: '#6366F1', ordem: 5 },
  { nome: 'Propria', cor: '#EC4899', ordem: 6 },
];

const CLASSIF_COL_DEFS = [
  { id: 'COD_PRODUTO', label: 'Código', align: 'left' },
  { id: 'COD_BARRAS', label: 'Cód.Barras', align: 'left' },
  { id: 'DESCRICAO', label: 'Descrição', align: 'left' },
  { id: 'DES_SEGMENTO', label: 'Segmento', align: 'left' },
  { id: 'PRECO_VENDA', label: 'Preço Venda', align: 'right' },
  { id: 'VAL_CUSTO', label: 'Custo', align: 'right' },
  { id: 'VAL_MARGEM', label: 'Margem %', align: 'right' },
  { id: 'CONC_BARATO', label: 'Conc. Barato', align: 'right' },
  { id: 'MARGEM_CONC', label: 'Margem Conc.', align: 'right' },
  { id: 'VD_MEDIA', label: 'Vd Média/Dia', align: 'right' },
  { id: 'CURVA', label: 'Curva', align: 'center' },
  { id: 'TIER', label: 'Tier', align: 'center', noSort: true },
];

const ANALISE_COL_DEFS = [
  { id: 'COD_PRODUTO', label: 'Código', align: 'left' },
  { id: 'DESCRICAO', label: 'Descrição', align: 'left' },
  { id: 'DES_MARCA', label: 'Marca', align: 'left' },
  { id: 'TIER_BADGE', label: 'Tier', align: 'center', noSort: true },
  { id: 'CURVA', label: 'Curva', align: 'center' },
  { id: 'PRECO_VENDA', label: 'Preço Venda', align: 'right' },
  { id: 'CONC_BARATO', label: 'Conc.Barato', align: 'right' },
  { id: 'MARKDOWN', label: 'Markdown%', align: 'right' },
  { id: 'MARGEM_META', label: 'Margem Meta%', align: 'right' },
  { id: 'CUSTO_ATUAL', label: 'Custo Atual', align: 'right' },
  { id: 'CUSTO_IDEAL', label: 'Custo Ideal', align: 'right' },
  { id: 'PRECO_SUGERIDO', label: 'Preço Sugerido', align: 'right' },
  { id: 'STATUS', label: 'Status', align: 'center', noSort: true },
];

const PREVIEW_COL_DEFS = [
  { id: 'COD_PRODUTO', label: 'Código', align: 'left' },
  { id: 'DESCRICAO', label: 'Descrição', align: 'left' },
  { id: 'PRECO_SUGERIDO', label: 'Preço Sugerido', align: 'right' },
  { id: 'MG_FUTURA', label: 'Margem Futura', align: 'right' },
  { id: 'PRECO_ATUAL', label: 'Preço Atual', align: 'right' },
  { id: 'DIFERENCA', label: 'Diferença', align: 'right' },
  { id: 'MG_ATUAL', label: 'Margem Atual', align: 'right' },
  { id: 'MG_META', label: 'Margem Meta', align: 'right' },
  { id: 'PRECO_CONC', label: 'Preço Conc.', align: 'right' },
  { id: 'MG_CONC', label: 'Margem Conc.', align: 'right' },
];
// Ordem padrão: Sugerido logo após Descrição
const DEFAULT_PREVIEW_ORDER = ['COD_PRODUTO','DESCRICAO','PRECO_SUGERIDO','MG_FUTURA','PRECO_ATUAL','DIFERENCA','MG_ATUAL','MG_META','PRECO_CONC','MG_CONC'];

export default function AncoragemPreco() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('classificacao');

  // Filtros
  const [lojas, setLojas] = useState([]);
  const [secoes, setSecoes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [subgrupos, setSubgrupos] = useState([]);
  const [segmentos, setSegmentos] = useState([]);
  const [codLoja, setCodLoja] = useState('');
  const [codSecao, setCodSecao] = useState('');
  const [codGrupo, setCodGrupo] = useState('');
  const [codSubGrupo, setCodSubGrupo] = useState('');
  const [codSegmento, setCodSegmento] = useState('');

  // Dados
  const [products, setProducts] = useState([]);
  const [classificacoes, setClassificacoes] = useState({}); // cod_produto -> tier
  const [regras, setRegras] = useState({}); // tier -> { tipo_gap, valor_gap, tier_referencia }
  const [analiseData, setAnaliseData] = useState(null);
  const [tiers, setTiers] = useState(() => {
    try { const s = localStorage.getItem('ancoragem_tiers'); return s ? JSON.parse(s) : [...DEFAULT_TIERS]; } catch { return [...DEFAULT_TIERS]; }
  });
  const [customTiers, setCustomTiers] = useState([]);
  const [savingClass, setSavingClass] = useState(false);
  const [savingRegras, setSavingRegras] = useState(false);

  // Modal novo tier
  const [showNewTierModal, setShowNewTierModal] = useState(false);
  const [newTierNome, setNewTierNome] = useState('');
  const [newTierCor, setNewTierCor] = useState('#6B7280');

  // Busca na tabela
  const [busca, setBusca] = useState('');

  // Drag-and-drop régua
  const dragTierRef = useRef(null);

  // Colunas configuráveis - Classificação (drag + sort) - persiste no localStorage
  const defaultClassifCols = ['COD_PRODUTO','COD_BARRAS','DESCRICAO','DES_SEGMENTO','PRECO_VENDA','VAL_CUSTO','VAL_MARGEM','CONC_BARATO','MARGEM_CONC','VD_MEDIA','CURVA','TIER'];
  const [colOrder, setColOrder] = useState(() => {
    try { const s = localStorage.getItem('ancoragem_classif_cols'); return s ? JSON.parse(s) : defaultClassifCols; } catch { return defaultClassifCols; }
  });
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const dragColRef = useRef(null);

  // Colunas configuráveis - Análise (drag + sort) - persiste no localStorage
  const defaultAnaliseCols = ANALISE_COL_DEFS.map(c => c.id);
  const [anlColOrder, setAnlColOrder] = useState(() => {
    try { const s = localStorage.getItem('ancoragem_analise_cols'); return s ? JSON.parse(s) : defaultAnaliseCols; } catch { return defaultAnaliseCols; }
  });
  const [anlSortCol, setAnlSortCol] = useState(null);
  const [anlSortDir, setAnlSortDir] = useState('asc');
  const dragAnlColRef = useRef(null);

  // Colunas configuráveis - Prévia (drag) - persiste no localStorage
  const [prvColOrder, setPrvColOrder] = useState(() => {
    try { const s = localStorage.getItem('ancoragem_preview_cols'); return s ? JSON.parse(s) : DEFAULT_PREVIEW_ORDER; } catch { return DEFAULT_PREVIEW_ORDER; }
  });
  const dragPrvColRef = useRef(null);

  // Persistir no localStorage
  useEffect(() => { localStorage.setItem('ancoragem_classif_cols', JSON.stringify(colOrder)); }, [colOrder]);
  useEffect(() => { localStorage.setItem('ancoragem_analise_cols', JSON.stringify(anlColOrder)); }, [anlColOrder]);
  useEffect(() => { localStorage.setItem('ancoragem_preview_cols', JSON.stringify(prvColOrder)); }, [prvColOrder]);
  useEffect(() => { localStorage.setItem('ancoragem_tiers', JSON.stringify(tiers)); }, [tiers]);

  // Merge tiers default + custom
  const allTiers = useMemo(() => {
    const merged = [...tiers];
    for (const ct of customTiers) {
      if (!merged.find(t => t.nome === ct.nome)) {
        merged.push({ nome: ct.nome, cor: ct.cor || '#6B7280', ordem: ct.ordem || 99 });
      }
    }
    return merged.sort((a, b) => a.ordem - b.ordem);
  }, [tiers, customTiers]);

  // Carregar dropdowns
  useEffect(() => {
    const load = async () => {
      try {
        const [lojasRes, secoesRes] = await Promise.all([
          api.get('/ponderacao/lojas'),
          api.get('/ponderacao/secoes'),
        ]);
        setLojas(lojasRes.data || []);
        setSecoes(secoesRes.data || []);
        if (lojaSelecionada && lojasRes.data?.length) {
          const match = lojasRes.data.find(l => l.COD_LOJA === lojaSelecionada);
          if (match) setCodLoja(String(match.COD_LOJA));
        }
        if (!codLoja && lojasRes.data?.length) {
          setCodLoja(String(lojasRes.data[0].COD_LOJA));
        }
      } catch (err) {
        console.error('Erro ao carregar dropdowns:', err);
      }
    };
    load();
  }, []);

  // Carregar tiers customizados
  useEffect(() => {
    if (!codLoja) return;
    api.get(`/ancoragem/tiers?codLoja=${codLoja}`).then(res => {
      setCustomTiers(res.data || []);
    }).catch(e => console.error('Erro tiers:', e));
  }, [codLoja]);

  // Cascata: Secao -> Grupos
  useEffect(() => {
    if (!codSecao) { setGrupos([]); setCodGrupo(''); return; }
    api.get(`/ponderacao/grupos?codSecao=${codSecao}`).then(res => {
      setGrupos(res.data || []);
      setCodGrupo('');
      setSubgrupos([]); setCodSubGrupo('');
      setSegmentos([]); setCodSegmento('');
    }).catch(e => console.error(e));
  }, [codSecao]);

  // Grupo -> Subgrupos
  useEffect(() => {
    if (!codGrupo) { setSubgrupos([]); setCodSubGrupo(''); return; }
    api.get(`/ponderacao/subgrupos?codSecao=${codSecao}&codGrupo=${codGrupo}`).then(res => {
      setSubgrupos(res.data || []);
      setCodSubGrupo('');
      setSegmentos([]); setCodSegmento('');
    }).catch(e => console.error(e));
  }, [codGrupo]);

  // Subgrupo -> Segmentos
  useEffect(() => {
    if (!codSubGrupo) { setSegmentos([]); setCodSegmento(''); return; }
    api.get(`/ponderacao/segmentos?codSecao=${codSecao}&codGrupo=${codGrupo}&codSubGrupo=${codSubGrupo}`).then(res => {
      setSegmentos(res.data || []);
      setCodSegmento('');
    }).catch(e => console.error(e));
  }, [codSubGrupo]);

  // Carregar produtos + classificacoes ao mudar filtros
  const carregarDados = useCallback(async () => {
    if (!codLoja || !codSecao) return;
    setLoading(true);
    try {
      const params = `codLoja=${codLoja}&codSecao=${codSecao}${codGrupo ? `&codGrupo=${codGrupo}` : ''}${codSubGrupo ? `&codSubGrupo=${codSubGrupo}` : ''}${codSegmento ? `&codSegmento=${codSegmento}` : ''}`;

      if (activeTab === 'analise') {
        const res = await api.get(`/ancoragem/analise?${params}`);
        setAnaliseData(res.data);
      } else {
        const [prodRes, classRes, regrasRes] = await Promise.all([
          api.get(`/ancoragem/products?${params}`),
          api.get(`/ancoragem/classificacoes?${params}`),
          api.get(`/ancoragem/regras?${params}`),
        ]);
        setProducts(prodRes.data || []);

        // Montar map classificacoes
        const classMap = {};
        for (const c of (classRes.data || [])) {
          classMap[String(c.cod_produto)] = c.tier;
        }
        setClassificacoes(classMap);

        // Montar map regras
        const regrasMap = {};
        for (const r of (regrasRes.data || [])) {
          regrasMap[r.tier] = { tipo_gap: r.tipo_gap, valor_gap: parseFloat(r.valor_gap), tier_referencia: r.tier_referencia };
        }
        setRegras(regrasMap);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [codLoja, codSecao, codGrupo, codSubGrupo, codSegmento, activeTab]);

  // Auto-carregar quando filtros mudam
  useEffect(() => {
    if (codLoja && codSecao) carregarDados();
  }, [codLoja, codSecao, codGrupo, codSubGrupo, codSegmento, activeTab]);

  // Auto-salvar classificação individual ao mudar dropdown
  const autoSaveClassificacao = async (codProduto, tier) => {
    if (!codLoja || !codSecao) return;
    setClassificacoes(prev => ({ ...prev, [codProduto]: tier }));
    try {
      const prod = products.find(p => p.COD_PRODUTO === codProduto);
      const items = [{
        cod_produto: codProduto,
        tier: tier || '',
        cod_marca: prod?.COD_MARCA || 0,
        des_marca: prod?.DES_MARCA || '',
        cod_secao: Number(codSecao),
        cod_grupo: Number(codGrupo) || 0,
        cod_subgrupo: Number(codSubGrupo) || 0,
        cod_segmento: Number(codSegmento) || 0,
      }];
      await api.post('/ancoragem/classificacoes', { codLoja: Number(codLoja), items });
      toast.success(`${prod?.DESCRICAO?.substring(0, 25) || codProduto} → ${tier || 'removido'}`, { duration: 1500, icon: '✅' });
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar classificação');
    }
  };

  // Salvar regras
  const salvarRegras = async () => {
    if (!codLoja || !codSecao) return;
    setSavingRegras(true);
    try {
      const regrasList = Object.entries(regras).map(([tier, r]) => ({
        tier,
        tipo_gap: 'R$',
        valor_gap: r.valor_gap,
        tier_referencia: r.tier_referencia || 'Lider',
        cod_secao: Number(codSecao),
        cod_grupo: Number(codGrupo) || 0,
        cod_subgrupo: Number(codSubGrupo) || 0,
        cod_segmento: Number(codSegmento) || 0,
      }));
      await api.post('/ancoragem/regras', { codLoja: Number(codLoja), regras: regrasList });
      toast.success(`${regrasList.length} regras salvas!`);
    } catch (err) {
      console.error('Erro ao salvar regras:', err);
      toast.error('Erro ao salvar regras');
    } finally {
      setSavingRegras(false);
    }
  };

  // Criar tier customizado
  const criarTierCustom = async () => {
    if (!newTierNome.trim()) return;
    try {
      await api.post('/ancoragem/tiers', { codLoja: Number(codLoja), nome: newTierNome.trim(), ordem: allTiers.length + 1, cor: newTierCor });
      setCustomTiers(prev => [...prev, { nome: newTierNome.trim(), cor: newTierCor, ordem: allTiers.length + 1 }]);
      setShowNewTierModal(false);
      setNewTierNome('');
      setNewTierCor('#6B7280');
      toast.success('Tier criado!');
    } catch (err) {
      toast.error('Erro ao criar tier');
    }
  };

  // Deletar tier customizado
  const deletarTier = async (nome) => {
    if (!window.confirm(`Remover tier "${nome}"?`)) return;
    try {
      await api.delete(`/ancoragem/tiers?codLoja=${codLoja}&nome=${encodeURIComponent(nome)}`);
      setCustomTiers(prev => prev.filter(t => t.nome !== nome));
      toast.success('Tier removido');
    } catch (err) {
      toast.error('Erro ao remover tier');
    }
  };

  // Filtrar produtos por busca
  const filteredProducts = useMemo(() => {
    if (!busca.trim()) return products;
    const b = busca.toLowerCase();
    return products.filter(p =>
      p.COD_PRODUTO?.toLowerCase().includes(b) ||
      p.DESCRICAO?.toLowerCase().includes(b) ||
      p.DES_MARCA?.toLowerCase().includes(b)
    );
  }, [products, busca]);

  // Agrupar produtos por tier na aba classificacao
  const productsByTier = useMemo(() => {
    const groups = {};
    for (const t of allTiers) groups[t.nome] = [];
    groups['Sem Classificação'] = [];
    for (const p of filteredProducts) {
      const tier = classificacoes[p.COD_PRODUTO] || '';
      if (tier && groups[tier]) {
        groups[tier].push(p);
      } else {
        groups['Sem Classificação'].push(p);
      }
    }
    return groups;
  }, [filteredProducts, classificacoes, allTiers]);

  // Stats por tier
  const tierStats = useMemo(() => {
    const stats = {};
    for (const [tierName, prods] of Object.entries(productsByTier)) {
      stats[tierName] = {
        count: prods.length,
        avgPreco: prods.length > 0 ? prods.reduce((s, p) => s + p.PRECO_VENDA, 0) / prods.length : 0,
        avgMargem: prods.length > 0 ? prods.reduce((s, p) => s + p.VAL_MARGEM, 0) / prods.length : 0,
      };
    }
    return stats;
  }, [productsByTier]);

  // Regua visual - resolve cadeia de referências para posições acumuladas
  const reguaVisual = useMemo(() => {
    const positions = {};
    const visited = new Set();
    const resolve = (tierName) => {
      if (positions[tierName] !== undefined) return positions[tierName];
      if (visited.has(tierName)) { positions[tierName] = 0; return 0; }
      visited.add(tierName);
      const r = regras[tierName];
      if (!r || r.valor_gap === 0) { positions[tierName] = 0; return 0; }
      const refPos = resolve(r.tier_referencia);
      positions[tierName] = refPos + r.valor_gap;
      return positions[tierName];
    };
    allTiers.forEach(t => resolve(t.nome));
    return allTiers.map(t => ({
      nome: t.nome,
      cor: t.cor,
      ordem: t.ordem,
      posicao: positions[t.nome] || 0,
      gapDireto: regras[t.nome]?.valor_gap || 0,
      tipo: regras[t.nome]?.tipo_gap || '%',
      ref: regras[t.nome]?.tier_referencia || '',
    })).sort((a, b) => a.ordem - b.ordem);
  }, [allTiers, regras]);

  // Prévia de preços ao vivo (régua) - calcula preço sugerido por tier
  const reguaPreview = useMemo(() => {
    if (!products.length) return { anchorPrice: 0, baseName: '', tiers: [] };
    // Encontrar âncora: prioridade 1=Lider com produtos, 2=qualquer tier com produtos, 3=primeiro tier
    const tiersComProdutos = allTiers.filter(t => products.some(p => classificacoes[p.COD_PRODUTO] === t.nome));
    const anchorTier = tiersComProdutos.find(t => t.nome === 'Lider') || tiersComProdutos[0] || allTiers[0];
    const baseName = anchorTier?.nome || 'Lider';
    // Preço âncora = média dos produtos do tier âncora
    const baseProds = products.filter(p => classificacoes[p.COD_PRODUTO] === baseName);
    const anchorPrice = baseProds.length > 0
      ? baseProds.reduce((s, p) => s + (Number(p.PRECO_VENDA) || 0), 0) / baseProds.length
      : 0;
    // Posição do âncora no reguaVisual
    const anchorPos = reguaVisual.find(t => t.nome === baseName)?.posicao || 0;
    // Para cada tier, calcular preço sugerido relativo ao âncora
    const tiers = reguaVisual.map(t => {
      const offsetFromAnchor = t.posicao - anchorPos;
      const sugerido = anchorPrice > 0 ? anchorPrice + offsetFromAnchor : 0;
      const prods = products.filter(p => classificacoes[p.COD_PRODUTO] === t.nome);
      return {
        ...t,
        sugerido,
        isBase: t.nome === baseName,
        baseName,
        produtos: prods.map(p => {
          const atual = Number(p.PRECO_VENDA) || 0;
          const custo = Number(p.VAL_CUSTO) || 0;
          const conc = Number(p.CONC_BARATO) || 0;
          const mgAtual = atual > 0 ? ((atual - custo) / atual) * 100 : 0;
          const mgMeta = Number(p.VAL_MARGEM) || 0;
          const mgConc = conc > 0 ? ((conc - custo) / conc) * 100 : 0;
          const mgFutura = sugerido > 0 ? ((sugerido - custo) / sugerido) * 100 : 0;
          return { cod: p.COD_PRODUTO, desc: p.DESCRICAO, atual, sugerido, diff: sugerido - atual, mgAtual, mgMeta, conc, mgConc, mgFutura };
        }),
      };
    });
    return { anchorPrice, baseName, tiers };
  }, [reguaVisual, products, classificacoes, allTiers]);

  // Analise: agrupar por tier
  const analiseByTier = useMemo(() => {
    if (!analiseData?.rows) return {};
    const groups = {};
    for (const r of analiseData.rows) {
      const tier = r.TIER || 'Sem Classificação';
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push(r);
    }
    return groups;
  }, [analiseData]);

  // Cor do tier helper
  const tierCor = (tierName) => {
    const t = allTiers.find(t => t.nome === tierName);
    return t?.cor || '#6B7280';
  };

  // Status badge helper
  const statusBadge = (status) => {
    const colors = {
      verde: 'bg-green-100 text-green-800 border-green-300',
      amarelo: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      vermelho: 'bg-red-100 text-red-800 border-red-300',
      cinza: 'bg-gray-100 text-gray-500 border-gray-300',
    };
    const labels = { verde: 'OK', amarelo: 'Atenção', vermelho: 'Fora', cinza: '-' };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${colors[status] || colors.cinza}`}>
        {labels[status] || '-'}
      </span>
    );
  };

  // Sort toggle para colunas
  const toggleSort = (colId) => {
    if (sortCol === colId) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  // Sorted products within tier groups
  const sortedProductsByTier = useMemo(() => {
    if (!sortCol) return productsByTier;
    const sorted = {};
    for (const [tierName, prods] of Object.entries(productsByTier)) {
      sorted[tierName] = [...prods].sort((a, b) => {
        let va = sortCol === 'TIER' ? (classificacoes[a.COD_PRODUTO] || '') : a[sortCol];
        let vb = sortCol === 'TIER' ? (classificacoes[b.COD_PRODUTO] || '') : b[sortCol];
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va == null) va = '';
        if (vb == null) vb = '';
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [productsByTier, sortCol, sortDir, classificacoes]);

  // Column drag handlers
  const onColDragStart = (idx) => { dragColRef.current = idx; };
  const onColDragOver = (e) => e.preventDefault();
  const onColDrop = (idx) => {
    const from = dragColRef.current;
    if (from === null || from === idx) return;
    setColOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragColRef.current = null;
  };

  // Render cell for classification table
  const renderClassifCell = (colId, p) => {
    switch (colId) {
      case 'COD_PRODUTO':
        return <span className="text-gray-600 font-mono text-xs">{p.COD_PRODUTO}</span>;
      case 'COD_BARRAS':
        return <span className="text-gray-500 font-mono text-xs">{p.COD_BARRAS || '-'}</span>;
      case 'DESCRICAO':
        return <span className="font-medium text-gray-800 max-w-xs truncate block">{p.DESCRICAO}</span>;
      case 'DES_SEGMENTO':
        return <span className="text-gray-500 text-xs">{p.DES_SEGMENTO || '-'}</span>;
      case 'DES_MARCA':
        return <span className="text-gray-600 text-xs">{p.DES_MARCA || '-'}</span>;
      case 'PRECO_VENDA':
        return <span className="font-bold">{fmt(p.PRECO_VENDA)}</span>;
      case 'VAL_CUSTO':
        return <span className="text-gray-600">{fmt(p.VAL_CUSTO)}</span>;
      case 'VAL_MARGEM':
        return <span className="text-orange-600 font-bold">{fmtPct(p.VAL_MARGEM)}</span>;
      case 'CONC_BARATO':
        return <span className="text-blue-600">{p.CONC_BARATO > 0 ? fmt(p.CONC_BARATO) : '-'}</span>;
      case 'MARGEM_CONC': {
        const cb = Number(p.CONC_BARATO) || 0;
        const cu = Number(p.VAL_CUSTO) || 0;
        if (cb <= 0) return <span className="text-gray-500">-</span>;
        const mgConc = ((cb - cu) / cb) * 100;
        if (isNaN(mgConc) || !isFinite(mgConc)) return <span className="text-gray-500">-</span>;
        return <span className={`font-bold ${mgConc < 0 ? 'text-red-600' : mgConc < 10 ? 'text-yellow-600' : 'text-green-600'}`}>{mgConc.toFixed(2)}%</span>;
      }
      case 'VD_MEDIA': {
        const vdm = Number(p.VD_MEDIA) || 0;
        if (vdm <= 0) return <span className="text-gray-500">-</span>;
        return <span className="text-purple-600 font-bold">{fmt(vdm)}</span>;
      }
      case 'CURVA':
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            p.CURVA === 'A' ? 'bg-green-100 text-green-800' :
            p.CURVA === 'B' ? 'bg-blue-100 text-blue-800' :
            p.CURVA === 'C' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-500'
          }`}>{p.CURVA || '-'}</span>
        );
      case 'TIER':
        return (
          <select
            value={classificacoes[p.COD_PRODUTO] || ''}
            onChange={e => autoSaveClassificacao(p.COD_PRODUTO, e.target.value)}
            className="border rounded px-2 py-1 text-xs w-40"
            style={{ borderColor: tierCor(classificacoes[p.COD_PRODUTO]) }}
          >
            <option value="">-- Selecionar --</option>
            {allTiers.map(t => (
              <option key={t.nome} value={t.nome}>{t.nome}</option>
            ))}
          </select>
        );
      default:
        return '-';
    }
  };

  // === ANÁLISE: Sort toggle ===
  const toggleAnlSort = (colId) => {
    if (anlSortCol === colId) setAnlSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setAnlSortCol(colId); setAnlSortDir('asc'); }
  };

  // === ANÁLISE: Sorted rows within tier groups ===
  const sortedAnaliseByTier = useMemo(() => {
    if (!anlSortCol) return analiseByTier;
    const colMap = { CUSTO_ATUAL: 'VAL_CUSTO', MARGEM_META: 'VAL_MARGEM', MARKDOWN: 'MARKDOWN_ATUAL', TIER_BADGE: 'TIER' };
    const realCol = colMap[anlSortCol] || anlSortCol;
    const sorted = {};
    for (const [tierName, rows] of Object.entries(analiseByTier)) {
      sorted[tierName] = [...rows].sort((a, b) => {
        let va = a[realCol], vb = b[realCol];
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va == null) va = '';
        if (vb == null) vb = '';
        if (va < vb) return anlSortDir === 'asc' ? -1 : 1;
        if (va > vb) return anlSortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [analiseByTier, anlSortCol, anlSortDir]);

  // === ANÁLISE: Column drag handlers ===
  const onAnlColDragStart = (idx) => { dragAnlColRef.current = idx; };
  const onAnlColDragOver = (e) => e.preventDefault();
  const onAnlColDrop = (idx) => {
    const from = dragAnlColRef.current;
    if (from === null || from === idx) return;
    setAnlColOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragAnlColRef.current = null;
  };

  // === ANÁLISE: Render cell ===
  const renderAnaliseCell = (colId, r) => {
    switch (colId) {
      case 'COD_PRODUTO':
        return <span className="text-gray-600 font-mono text-xs">{r.COD_PRODUTO}</span>;
      case 'DESCRICAO':
        return <span className="text-gray-800 text-xs truncate max-w-[200px] block">{r.DESCRICAO}</span>;
      case 'DES_MARCA':
        return <span className="text-gray-500 text-xs">{r.DES_MARCA || '-'}</span>;
      case 'TIER_BADGE':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: tierCor(r.TIER) }}>{r.TIER || '-'}</span>;
      case 'CURVA':
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            r.CURVA === 'A' ? 'bg-green-100 text-green-800' :
            r.CURVA === 'B' ? 'bg-blue-100 text-blue-800' :
            r.CURVA === 'C' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-500'
          }`}>{r.CURVA || '-'}</span>
        );
      case 'PRECO_VENDA':
        return <span className="font-bold">{fmt(r.PRECO_VENDA)}</span>;
      case 'CONC_BARATO':
        return <span className="text-blue-600">{r.CONC_BARATO > 0 ? fmt(r.CONC_BARATO) : '-'}</span>;
      case 'MARKDOWN':
        return <span className={`font-bold ${r.MARKDOWN_ATUAL >= 30 ? 'text-green-600' : r.MARKDOWN_ATUAL >= 15 ? 'text-yellow-600' : r.MARKDOWN_ATUAL > 0 ? 'text-red-600' : 'text-gray-500'}`}>{r.MARKDOWN_ATUAL !== 0 ? `${r.MARKDOWN_ATUAL.toFixed(1)}%` : '-'}</span>;
      case 'MARGEM_META':
        return <span className="text-orange-600 font-bold">{r.VAL_MARGEM > 0 ? fmtPct(r.VAL_MARGEM) : '-'}</span>;
      case 'CUSTO_ATUAL':
        return <span className="text-gray-600">{fmt(r.VAL_CUSTO)}</span>;
      case 'CUSTO_IDEAL':
        return <span className="text-purple-600">{r.CUSTO_IDEAL > 0 ? fmt(r.CUSTO_IDEAL) : '-'}</span>;
      case 'PRECO_SUGERIDO':
        return <span className="font-bold text-green-700">{r.PRECO_SUGERIDO > 0 ? fmt(r.PRECO_SUGERIDO) : '-'}</span>;
      case 'STATUS':
        return statusBadge(r.STATUS);
      default:
        return '-';
    }
  };

  // === PRÉVIA: Column drag handlers ===
  const onPrvColDragStart = (idx) => { dragPrvColRef.current = idx; };
  const onPrvColDragOver = (e) => e.preventDefault();
  const onPrvColDrop = (idx) => {
    const from = dragPrvColRef.current;
    if (from === null || from === idx) return;
    setPrvColOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragPrvColRef.current = null;
  };

  // === PRÉVIA: Render cell ===
  const renderPreviewCell = (colId, p, tierCor) => {
    switch (colId) {
      case 'COD_PRODUTO': return <span className="text-gray-500 font-mono text-xs">{p.cod}</span>;
      case 'DESCRICAO': return <span className="text-gray-700 text-xs truncate max-w-[250px] block">{p.desc}</span>;
      case 'PRECO_SUGERIDO': return <span className="font-bold" style={{ color: tierCor }}>R$ {fmt(p.sugerido)}</span>;
      case 'MG_FUTURA': return <span className={`font-bold ${p.mgFutura < 0 ? 'text-red-600' : p.mgFutura < 10 ? 'text-yellow-600' : 'text-green-600'}`}>{p.mgFutura.toFixed(1)}%</span>;
      case 'PRECO_ATUAL': return <span className="font-bold">R$ {fmt(p.atual)}</span>;
      case 'DIFERENCA': return p.diff !== 0 ? <span className={`font-bold text-xs px-2 py-0.5 rounded ${p.diff > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{p.diff > 0 ? '+' : ''}R$ {fmt(p.diff)}</span> : <span className="text-gray-400 text-xs">—</span>;
      case 'MG_ATUAL': return <span className={`font-bold ${p.mgAtual < 0 ? 'text-red-600' : p.mgAtual < 10 ? 'text-yellow-600' : 'text-green-600'}`}>{p.mgAtual.toFixed(1)}%</span>;
      case 'MG_META': return p.mgMeta > 0 ? <span className="text-orange-600 font-bold">{p.mgMeta.toFixed(1)}%</span> : <span className="text-gray-400">-</span>;
      case 'PRECO_CONC': return p.conc > 0 ? <span className="text-blue-600">R$ {fmt(p.conc)}</span> : <span className="text-gray-400">-</span>;
      case 'MG_CONC': return p.conc > 0 ? <span className={`font-bold ${p.mgConc < 0 ? 'text-red-600' : p.mgConc < 10 ? 'text-yellow-600' : 'text-green-600'}`}>{p.mgConc.toFixed(1)}%</span> : <span className="text-gray-400">-</span>;
      default: return '-';
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} onCloseMobileMenu={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 hover:bg-orange-400 rounded-lg text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                ⚓ Ancoragem de Preço
              </h1>
              <p className="text-sm text-orange-100">Classificação de Marcas + Régua de Preço + Análise</p>
            </div>
          </div>
        </header>

        <div className="p-4 space-y-4">
          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Loja</label>
                <select value={codLoja} onChange={e => setCodLoja(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Selecione...</option>
                  {lojas.map(l => <option key={l.COD_LOJA} value={l.COD_LOJA}>{l.COD_LOJA} - {l.DES_LOJA}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Seção</label>
                <select value={codSecao} onChange={e => setCodSecao(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Selecione...</option>
                  {secoes.map(s => <option key={s.COD_SECAO} value={s.COD_SECAO}>{s.COD_SECAO} - {s.DES_SECAO}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Grupo</label>
                <select value={codGrupo} onChange={e => setCodGrupo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Todos</option>
                  {grupos.map(g => <option key={g.COD_GRUPO} value={g.COD_GRUPO}>{g.COD_GRUPO} - {g.DES_GRUPO}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Subgrupo</label>
                <select value={codSubGrupo} onChange={e => setCodSubGrupo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Todos</option>
                  {subgrupos.map(sg => <option key={sg.COD_SUB_GRUPO} value={sg.COD_SUB_GRUPO}>{sg.COD_SUB_GRUPO} - {sg.DES_SUB_GRUPO}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Segmento</label>
                <select value={codSegmento} onChange={e => setCodSegmento(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Todos</option>
                  {segmentos.map(sg => <option key={sg.COD_SEGMENTO} value={sg.COD_SEGMENTO}>{sg.DES_SEGMENTO}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="flex gap-1 bg-white rounded-lg shadow p-1">
            {[
              { id: 'classificacao', label: 'CLASSIFICAÇÃO DE MARCAS', icon: '🏷️' },
              { id: 'regua', label: 'RÉGUA DE PREÇO', icon: '📏' },
              { id: 'analise', label: 'ANÁLISE / SIMULAÇÃO', icon: '📊' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {loading && <RadarLoading />}

          {/* ABA 1: CLASSIFICAÇÃO DE MARCAS */}
          {!loading && activeTab === 'classificacao' && (
            <div className="space-y-4">
              {/* Stats dos tiers */}
              <div className="flex gap-2">
                {allTiers.map(t => (
                  <div key={t.nome} className="flex-1 bg-white rounded-lg shadow p-3 border-l-4" style={{ borderColor: t.cor }}>
                    <div className="text-xs font-bold" style={{ color: t.cor }}>{t.nome}</div>
                    <div className="text-lg font-bold text-gray-800">{tierStats[t.nome]?.count || 0}</div>
                    <div className="text-xs text-gray-500">R$ {fmt(tierStats[t.nome]?.avgPreco || 0)} médio</div>
                  </div>
                ))}
                <div className="flex-1 bg-white rounded-lg shadow p-3 border-l-4 border-gray-300">
                  <div className="text-xs font-bold text-gray-400">Sem Class.</div>
                  <div className="text-lg font-bold text-gray-400">{tierStats['Sem Classificação']?.count || 0}</div>
                  <div className="text-xs text-gray-400">R$ {fmt(tierStats['Sem Classificação']?.avgPreco || 0)} médio</div>
                </div>
              </div>

              {/* Tabela de produtos */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-600 text-white">
                  <span className="font-bold text-sm">Produtos ({filteredProducts.length})</span>
                  <span className="text-xs text-green-300">Auto-save ativado</span>
                </div>

                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-600 text-white text-xs">
                        {colOrder.map((colId, idx) => {
                          const col = CLASSIF_COL_DEFS.find(c => c.id === colId);
                          if (!col) return null;
                          return (
                            <th
                              key={colId}
                              draggable
                              onDragStart={() => onColDragStart(idx)}
                              onDragOver={onColDragOver}
                              onDrop={() => onColDrop(idx)}
                              onClick={() => !col.noSort && toggleSort(colId)}
                              className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} cursor-pointer select-none hover:bg-gray-500 transition-colors ${colId === 'TIER' ? 'w-48' : ''}`}
                              title="Arraste para reordenar | Clique para ordenar"
                            >
                              <span className="inline-flex items-center gap-1">
                                {col.label}
                                {sortCol === colId && <span className="text-orange-300">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {allTiers.map(tier => {
                        const prods = sortedProductsByTier[tier.nome] || [];
                        if (prods.length === 0) return null;
                        return (
                          <React.Fragment key={tier.nome}>
                            <tr className="bg-gray-50">
                              <td colSpan={colOrder.length} className="px-3 py-2">
                                <span className="inline-flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: tier.cor }}></span>
                                  <span className="font-bold text-sm" style={{ color: tier.cor }}>{tier.nome}</span>
                                  <span className="text-xs text-gray-500">({prods.length} produtos)</span>
                                </span>
                              </td>
                            </tr>
                            {prods.map(p => (
                              <tr key={p.COD_PRODUTO} className="border-b border-gray-100 hover:bg-blue-50 transition-colors" style={{ borderLeft: `3px solid ${tier.cor}` }}>
                                {colOrder.map(colId => {
                                  const col = CLASSIF_COL_DEFS.find(c => c.id === colId);
                                  return (
                                    <td key={colId} className={`px-3 py-1.5 ${col?.align === 'right' ? 'text-right' : col?.align === 'center' ? 'text-center' : 'text-left'}`}>
                                      {renderClassifCell(colId, p)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      {/* Sem classificacao */}
                      {(sortedProductsByTier['Sem Classificação'] || []).length > 0 && (
                        <React.Fragment>
                          <tr className="bg-gray-50">
                            <td colSpan={colOrder.length} className="px-3 py-2">
                              <span className="inline-flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full inline-block bg-gray-300"></span>
                                <span className="font-bold text-sm text-gray-400">Sem Classificação</span>
                                <span className="text-xs text-gray-500">({(sortedProductsByTier['Sem Classificação'] || []).length} produtos)</span>
                              </span>
                            </td>
                          </tr>
                          {(sortedProductsByTier['Sem Classificação'] || []).map(p => (
                            <tr key={p.COD_PRODUTO} className="border-b border-gray-100 hover:bg-blue-50 transition-colors" style={{ borderLeft: '3px solid #D1D5DB' }}>
                              {colOrder.map(colId => {
                                const col = CLASSIF_COL_DEFS.find(c => c.id === colId);
                                return (
                                  <td key={colId} className={`px-3 py-1.5 ${col?.align === 'right' ? 'text-right' : col?.align === 'center' ? 'text-center' : 'text-left'}`}>
                                    {renderClassifCell(colId, p)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: RÉGUA DE PREÇO */}
          {!loading && activeTab === 'regua' && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-600 text-white">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">Régua de Preço</span>
                    {codSegmento && segmentos.length > 0 && (
                      <span className="px-3 py-1 bg-orange-500 rounded-full text-xs font-bold text-white">
                        {segmentos.find(s => String(s.COD_SEGMENTO) === codSegmento)?.DES_SEGMENTO || 'Segmento'}
                      </span>
                    )}
                    {!codSegmento && <span className="text-yellow-300 text-xs">Selecione um segmento nos filtros</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowNewTierModal(true)}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold"
                    >
                      + Novo Tier
                    </button>
                    <button
                      onClick={salvarRegras}
                      disabled={savingRegras}
                      className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                    >
                      {savingRegras ? 'Salvando...' : 'Salvar Regras'}
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {allTiers.map((t, idx) => {
                    const r = regras[t.nome] || { tipo_gap: 'R$', valor_gap: 0, tier_referencia: 'Lider' };
                    return (
                      <div
                        key={t.nome}
                        draggable
                        onDragStart={() => { dragTierRef.current = idx; }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => {
                          const from = dragTierRef.current;
                          if (from === null || from === idx) return;
                          // Reorder: move custom tiers
                          const newOrder = [...allTiers];
                          const [moved] = newOrder.splice(from, 1);
                          newOrder.splice(idx, 0, moved);
                          // Update ordem and save to customTiers
                          const updatedCustom = newOrder
                            .map((t, i) => ({ ...t, ordem: i + 1 }))
                            .filter(t => !DEFAULT_TIERS.find(d => d.nome === t.nome));
                          setCustomTiers(updatedCustom);
                          // Also update default tiers ordem via a local override
                          const allUpdated = newOrder.map((t, i) => ({ ...t, ordem: i + 1 }));
                          // We store the full reordered list in a local state
                          setTiers(allUpdated);
                          dragTierRef.current = null;
                        }}
                        className="flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all hover:shadow-md"
                        style={{ borderColor: t.cor + '40', backgroundColor: t.cor + '08' }}
                      >
                        {/* Drag handle */}
                        <div className="text-gray-400 hover:text-gray-600 cursor-grab" title="Arrastar para reordenar">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
                        </div>

                        {/* Nome do tier com badge */}
                        <div className="flex items-center gap-2 w-36 shrink-0">
                          <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.cor }}></span>
                          <span className="font-bold text-sm truncate" style={{ color: t.cor }}>{t.nome}</span>
                        </div>

                        {/* Inputs - todos iguais */}
                        <div className="flex-1 flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-gray-600 w-10 text-center">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={r.valor_gap}
                              onChange={e => setRegras(prev => ({ ...prev, [t.nome]: { ...r, tipo_gap: 'R$', valor_gap: parseFloat(e.target.value) || 0 } }))}
                              className="border rounded px-2 py-1.5 text-sm w-24 text-right"
                              placeholder="0.00"
                            />
                          </div>
                          <span className="text-xs text-gray-500">em relação ao</span>
                          <select
                            value={r.tier_referencia}
                            onChange={e => setRegras(prev => ({ ...prev, [t.nome]: { ...r, tier_referencia: e.target.value } }))}
                            className="border rounded px-2 py-1.5 text-sm"
                          >
                            {allTiers.map(ref => (
                              <option key={ref.nome} value={ref.nome}>{ref.nome}</option>
                            ))}
                          </select>
                          {/* Info calculado */}
                          <span className="text-xs text-gray-400">
                            {r.valor_gap !== 0 ? (
                              `(${r.valor_gap > 0 ? '+' : ''}R$ ${fmt(r.valor_gap)} do ${r.tier_referencia})`
                            ) : ''}
                          </span>
                        </div>

                        {/* Botao remover tier */}
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Excluir tier "${t.nome}" definitivamente?`)) return;
                            // Remove do estado local
                            setTiers(prev => prev.filter(p => p.nome !== t.nome));
                            setCustomTiers(prev => prev.filter(p => p.nome !== t.nome));
                            // Remove do banco
                            try { await api.delete(`/ancoragem/tiers?codLoja=${codLoja}&nome=${encodeURIComponent(t.nome)}`); } catch(e) { /* ok */ }
                            // Remove regras desse tier
                            setRegras(prev => {
                              const next = { ...prev };
                              delete next[t.nome];
                              return next;
                            });
                            toast.success(`Tier "${t.nome}" excluído`);
                          }}
                          className="text-red-300 hover:text-red-600 transition-colors shrink-0"
                          title={`Remover ${t.nome}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Gráfico de Barras - Visualização da Régua */}
                <div className="px-4 pb-6">
                  <div className="bg-gray-50 rounded-xl p-6 border">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Visualização da Régua de Preço</h3>
                      {codSegmento && segmentos.length > 0 && (
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold border border-orange-200">
                          Segmento: {segmentos.find(s => String(s.COD_SEGMENTO) === codSegmento)?.DES_SEGMENTO || ''}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const items = [...reguaVisual].sort((a, b) => a.ordem - b.ordem);
                      if (items.length === 0) return <p className="text-center text-gray-400 py-8 text-sm">Defina as regras de gap acima para visualizar o gráfico</p>;
                      const maxPos = Math.max(...items.map(i => Math.abs(i.posicao)), 0.01);
                      const allSameType = new Set(items.filter(i => i.gapDireto !== 0).map(i => i.tipo)).size <= 1;
                      const mainTipo = items.find(i => i.gapDireto !== 0)?.tipo || 'R$';
                      // Scale ticks
                      const ticks = [];
                      const step = maxPos <= 1 ? 0.25 : maxPos <= 5 ? 1 : maxPos <= 20 ? 5 : 10;
                      for (let v = 0; v <= maxPos * 1.1; v += step) { ticks.push(v); }
                      if (ticks.length < 2) ticks.push(maxPos);
                      const scaleMax = ticks[ticks.length - 1] || 1;

                      return (
                        <div>
                          {/* Barras */}
                          <div className="space-y-3">
                            {items.map((item) => {
                              const barPct = Math.max((item.posicao / scaleMax) * 100, 2);
                              const isBase = item.posicao === 0 && item.gapDireto === 0;
                              return (
                                <div key={item.nome} className="flex items-center gap-3">
                                  {/* Nome do tier */}
                                  <div className="w-32 shrink-0 flex items-center gap-2 justify-end">
                                    <span className="font-bold text-sm text-right truncate" style={{ color: item.cor }}>{item.nome}</span>
                                    <span className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.cor }}></span>
                                  </div>

                                  {/* Barra */}
                                  <div className="flex-1 relative">
                                    <div className="bg-gray-200 rounded-lg h-10 overflow-hidden relative">
                                      <div
                                        className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                                        style={{ width: `${barPct}%`, backgroundColor: item.cor + 'DD', minWidth: '40px' }}
                                      >
                                        <span className="text-white font-bold text-sm drop-shadow whitespace-nowrap">
                                          {mainTipo === 'R$' ? `R$ ${fmt(item.posicao)}` : `${item.posicao.toFixed(1)}%`}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Info do gap direto */}
                                  <div className="w-52 shrink-0 text-left">
                                    {isBase ? (
                                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">BASE / REFERÊNCIA</span>
                                    ) : (
                                      <div>
                                        <span className="text-sm font-bold" style={{ color: item.cor }}>
                                          {item.gapDireto > 0 ? '+' : ''}{item.tipo === 'R$' ? `R$ ${fmt(item.gapDireto)}` : `${item.gapDireto}%`}
                                        </span>
                                        <span className="text-xs text-gray-500 ml-1">do {item.ref}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Escala / eixo */}
                          <div className="mt-4 ml-[8.5rem] mr-[13.5rem]">
                            <div className="relative h-6 border-t-2 border-gray-300">
                              {ticks.map((v, i) => {
                                const pct = (v / scaleMax) * 100;
                                return (
                                  <div key={i} className="absolute -top-1 flex flex-col items-center" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
                                    <div className="w-0.5 h-3 bg-gray-400"></div>
                                    <span className="text-[11px] text-gray-500 font-mono mt-0.5 whitespace-nowrap">
                                      {mainTipo === 'R$' ? `R$${v.toFixed(2)}` : `${v.toFixed(0)}%`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Régua horizontal resumida */}
                          <div className="mt-8 relative" style={{ height: '80px' }}>
                            <div className="absolute top-1/2 left-8 right-8 h-2.5 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 shadow -translate-y-1/2"></div>
                            {items.map((item, i) => {
                              const pct = Math.max(Math.min((item.posicao / scaleMax) * 80 + 10, 95), 5);
                              const isTop = i % 2 === 0;
                              return (
                                <div key={item.nome} className="absolute" style={{ left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}>
                                  <div className="w-5 h-5 rounded-full border-[3px] border-white shadow-lg relative z-10" style={{ backgroundColor: item.cor }}></div>
                                  <div className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center`} style={isTop ? { bottom: '28px' } : { top: '28px' }}>
                                    <span className="px-2 py-0.5 rounded-md text-xs font-bold shadow-sm" style={{ backgroundColor: item.cor + '20', color: item.cor, border: `1px solid ${item.cor}50` }}>{item.nome}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>



            </div>
          )}

          {/* ABA 3: ANÁLISE / SIMULAÇÃO */}
          {!loading && activeTab === 'analise' && (
            <div className="space-y-4">
              {analiseData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-lg shadow p-3 border-l-4 border-blue-500">
                    <div className="text-xs text-gray-500">Total Produtos</div>
                    <div className="text-xl font-bold text-blue-600">{analiseData.totalProdutos}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-3 border-l-4 border-green-500">
                    <div className="text-xs text-gray-500">Classificados</div>
                    <div className="text-xl font-bold text-green-600">{analiseData.totalClassificados}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-3 border-l-4 border-purple-500">
                    <div className="text-xs text-gray-500">Regras Definidas</div>
                    <div className="text-xl font-bold text-purple-600">{analiseData.totalRegras}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-3 border-l-4 border-yellow-500">
                    <div className="text-xs text-gray-500">Preço Âncora (Líder)</div>
                    <div className="text-xl font-bold text-yellow-600">R$ {fmt(analiseData.precoAncora)}</div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 bg-gray-600 text-white font-bold text-sm">
                  Análise de Preços - Simulação por Tier
                </div>

                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-600 text-white text-xs">
                        {anlColOrder.map((colId, idx) => {
                          const def = ANALISE_COL_DEFS.find(c => c.id === colId);
                          if (!def) return null;
                          return (
                            <th
                              key={colId}
                              draggable
                              onDragStart={() => onAnlColDragStart(idx)}
                              onDragOver={onAnlColDragOver}
                              onDrop={() => onAnlColDrop(idx)}
                              onClick={() => !def.noSort && toggleAnlSort(colId)}
                              className={`px-2 py-2 text-${def.align} whitespace-nowrap select-none ${!def.noSort ? 'cursor-pointer hover:bg-gray-500' : ''}`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {def.label}
                                {anlSortCol === colId && <span className="text-orange-300">{anlSortDir === 'asc' ? '▲' : '▼'}</span>}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(sortedAnaliseByTier).map(([tierName, rows]) => (
                        <React.Fragment key={tierName}>
                          <tr className="bg-gray-50">
                            <td colSpan={anlColOrder.length} className="px-3 py-2">
                              <span className="inline-flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tierCor(tierName) }}></span>
                                <span className="font-bold text-sm" style={{ color: tierCor(tierName) }}>{tierName}</span>
                                <span className="text-xs text-gray-500">({rows.length} produtos)</span>
                                {tierName === 'Lider' && <span className="text-xs text-blue-600 font-bold ml-2">⚓ ÂNCORA</span>}
                              </span>
                            </td>
                          </tr>
                          {rows.map(r => (
                            <tr key={r.COD_PRODUTO} className="border-b border-gray-100 hover:bg-blue-50 transition-colors" style={{ borderLeft: `3px solid ${tierCor(r.TIER || tierName)}` }}>
                              {anlColOrder.map(colId => {
                                const def = ANALISE_COL_DEFS.find(c => c.id === colId);
                                return (
                                  <td key={colId} className={`px-2 py-1.5 text-${def?.align || 'left'}`}>
                                    {renderAnaliseCell(colId, r)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                      {(!analiseData?.rows || analiseData.rows.length === 0) && (
                        <tr>
                          <td colSpan={anlColOrder.length} className="text-center py-8 text-gray-400">
                            {!codLoja || !codSecao
                              ? 'Selecione Loja e Seção para ver a análise'
                              : 'Nenhum dado encontrado. Classifique produtos e defina regras primeiro.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Novo Tier */}
      {showNewTierModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Novo Tier Customizado</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Nome do Tier</label>
                <input
                  type="text"
                  value={newTierNome}
                  onChange={e => setNewTierNome(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Ex: Super Premium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Cor</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newTierCor}
                    onChange={e => setNewTierCor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-500">{newTierCor}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowNewTierModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={criarTierCustom}
                disabled={!newTierNome.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Criar Tier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
