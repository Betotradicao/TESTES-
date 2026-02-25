import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

// Converte Date string (YYYY-MM-DD ou ISO) para DD/MM/YYYY
function toBackendDate(d) {
  if (!d) return '';
  const s = String(d).split('T')[0]; // pegar só a parte da data
  const [y, m, day] = s.split('-');
  if (y && m && day) return `${day}/${m}/${y}`;
  return '';
}

// Ranges de classificação idênticos ao AnaliseOferta
const OFERTA_RANGES = [
  { id: 'excelente', label: 'Excelente', cls: 'bg-green-100 text-green-800',   de: 100,    ate: 9999  },
  { id: 'boa',       label: 'Boa',       cls: 'bg-blue-100 text-blue-800',     de: 30,     ate: 99.9  },
  { id: 'regular',   label: 'Regular',   cls: 'bg-yellow-100 text-yellow-800', de: 0,      ate: 29.9  },
  { id: 'ruim',      label: 'Ruim',      cls: 'bg-orange-100 text-orange-800', de: -50,    ate: -0.1  },
  { id: 'pessima',   label: 'Péssima',   cls: 'bg-red-100 text-red-800',       de: -9999,  ate: -50.1 },
];

function getClassif(crescPct) {
  if (crescPct == null || isNaN(crescPct)) return null;
  return OFERTA_RANGES.find(r => crescPct >= r.de && crescPct <= r.ate) || null;
}

function crescCor(v) {
  if (v === null || v === undefined || isNaN(v)) return 'text-gray-400';
  if (v > 30) return 'text-green-700 font-semibold';
  if (v > 0) return 'text-green-600';
  if (v < -20) return 'text-red-700 font-semibold';
  if (v < 0) return 'text-red-500';
  return 'text-gray-500';
}

// Calcular dias entre duas strings DD/MM/YYYY
function calcDias(ini, fim) {
  if (!ini || !fim) return 1;
  const [d1, m1, y1] = ini.split('/').map(Number);
  const [d2, m2, y2] = fim.split('/').map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
}

function BasketTable({ basket, crescCor, getClassif }) {
  const temPreco = basket.some(b => b.precoVenda > 0);
  const temMargem = basket.some(b => b.margem != null && b.margem !== 0);
  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 sticky top-0">
        <tr>
          <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
          <th className="px-3 py-2 text-left text-gray-500 font-medium">Descrição</th>
          <th className="px-3 py-2 text-right text-gray-500 font-medium">VD Média</th>
          <th className="px-3 py-2 text-right text-gray-500 font-medium">VD Real./dia</th>
          {temPreco && <th className="px-3 py-2 text-right text-gray-500 font-medium">Preço Venda</th>}
          {temMargem && <th className="px-3 py-2 text-right text-gray-500 font-medium">Margem</th>}
          <th className="px-3 py-2 text-right text-gray-500 font-medium">Cresc. Período</th>
          <th className="px-3 py-2 text-center text-gray-500 font-medium">Classif.</th>
        </tr>
      </thead>
      <tbody>
        {basket.map((b, idx) => {
          const cl = getClassif(b.crescimentoPct);
          return (
            <tr key={b.codProduto} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <td className="px-3 py-1.5 text-gray-400 font-bold">{idx + 1}</td>
              <td className="px-3 py-1.5">
                <p className="font-medium text-gray-800 truncate max-w-[150px]" title={b.descricao}>{b.descricao}</p>
                <p className="text-gray-400 font-mono text-[10px]">{b.codBarras || b.codProduto}</p>
              </td>
              <td className="px-3 py-1.5 text-right text-gray-500">
                {b.vdMediaHistorica.toFixed(2).replace('.', ',')}
                <p className="text-gray-400 font-normal text-[10px]">{b.freqJunto} cupons</p>
              </td>
              <td className="px-3 py-1.5 text-right font-semibold text-blue-700">
                {b.vdOferta.toFixed(2).replace('.', ',')}
              </td>
              {temPreco && (
                <td className="px-3 py-1.5 text-right text-gray-700">
                  {b.precoVenda > 0 ? `R$ ${b.precoVenda.toFixed(2).replace('.', ',')}` : '-'}
                </td>
              )}
              {temMargem && (
                <td className={`px-3 py-1.5 text-right font-semibold ${b.margem == null ? 'text-gray-400' : b.margem >= 20 ? 'text-green-600' : b.margem >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>
                  {b.margem != null ? `${b.margem.toFixed(1)}%` : '-'}
                </td>
              )}
              <td className={`px-3 py-1.5 text-right font-semibold ${crescCor(b.crescimentoPct)}`}>
                {b.crescimentoPct > 0 ? '+' : ''}{b.crescimentoPct.toFixed(1)}%
              </td>
              <td className="px-3 py-1.5 text-center">
                {cl ? <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cl.cls}`}>{cl.label}</span> : '-'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function SimuladorVenda() {
  const { user } = useAuth();
  const { lojaSelecionada } = useLoja();

  // Dados
  const [ofertas, setOfertas] = useState([]);           // ofertas salvas (PostgreSQL)
  const [programacoes, setProgramacoes] = useState([]); // programações Oracle
  const [loading, setLoading] = useState(false);
  const [soAtivas, setSoAtivas] = useState(false);      // filtro ativas/todas

  // Seleção: "salva::NOME_OFERTA" ou "prog::COD_PROG"
  const [selecao, setSelecao] = useState('');

  // Itens carregados
  const [itensOferta, setItensOferta] = useState([]);
  const [itensLoading, setItensLoading] = useState(false);
  const [dtaInicio, setDtaInicio] = useState('');
  const [dtaFim, setDtaFim] = useState('');

  // Crescimentos
  const [crescimentos, setCrescimentos] = useState({});
  const [crescLoading, setCrescLoading] = useState(false);

  // Basket
  const [produtoAtivo, setProdutoAtivo] = useState(null);
  const [basket, setBasket] = useState([]);
  const [basketLoading, setBasketLoading] = useState(false);

  const codLoja = lojaSelecionada || 1;

  // Carregar ofertas salvas + programações em paralelo (recarrega ao mudar filtro)
  useEffect(() => {
    setLoading(true);
    setSelecao('');
    setItensOferta([]);
    setCrescimentos({});
    setProdutoAtivo(null);
    setBasket([]);
    Promise.all([
      api.get(`/api/ofertas/sugestoes-salvas?codLoja=${codLoja}`).then(r => r.data || []).catch(() => []),
      api.get(`/api/ofertas/programacoes?codLoja=${codLoja}&ativas=${soAtivas}`).then(r => r.data || []).catch(() => []),
    ]).then(([salvas, progs]) => {
      setOfertas(salvas);
      setProgramacoes(progs);
    }).finally(() => setLoading(false));
  }, [codLoja, soAtivas]);

  // Agrupar ofertas salvas por nome_oferta
  const grupos = useMemo(() => {
    const map = {};
    for (const item of ofertas) {
      const key = item.nome_oferta || `sem-nome-${item.id}`;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [ofertas]);

  const nomeOfertas = Object.keys(grupos).sort();

  // Ao mudar seleção
  const handleSelecao = async (valor) => {
    setSelecao(valor);
    setProdutoAtivo(null);
    setBasket([]);
    setCrescimentos({});
    setItensOferta([]);
    setDtaInicio('');
    setDtaFim('');

    if (!valor) return;

    if (valor.startsWith('salva::')) {
      const nome = valor.replace('salva::', '');
      const itens = grupos[nome] || [];
      const primeiro = itens[0];
      const ini = primeiro?.vigencia_inicio ? toBackendDate(primeiro.vigencia_inicio) : '';
      const fim = primeiro?.vigencia_fim ? toBackendDate(primeiro.vigencia_fim) : '';
      setDtaInicio(ini);
      setDtaFim(fim);
      // Normalizar campos para interface unificada
      const normalized = itens.map(p => ({
        cod_produto: p.cod_produto,
        descricao: p.descricao,
        cod_barras: p.cod_barras || p.cod_produto,
        curva: p.curva || '-',
        preco_oferta: p.preco_rebaixo ?? p.preco_club ?? p.preco_leve_mais ?? p.preco_normal,
        tipo_oferta: p.tipo_oferta_escolhido || null,
        origem: 'salva',
      }));
      setItensOferta(normalized);
      if (ini && fim) carregarCrescimentos(normalized, ini, fim);

    } else if (valor.startsWith('prog::')) {
      const codProg = valor.replace('prog::', '');
      setItensLoading(true);
      try {
        const res = await api.get(`/api/ofertas/produtos/${codProg}?codLoja=${codLoja}`);
        const prog = programacoes.find(p => String(p.COD_PROG) === String(codProg));
        const ini = prog?.DTA_INICIAL || '';
        const fim = prog?.DTA_FINAL || '';
        setDtaInicio(ini);
        setDtaFim(fim);
        const normalized = (res.data?.produtos || []).map(p => ({
          cod_produto: String(p.COD_PRODUTO),
          descricao: p.DESCRICAO,
          cod_barras: p.COD_BARRAS || String(p.COD_PRODUTO),
          curva: p.CURVA || '-',
          preco_oferta: p.PRECO_OFERTA,
          preco_normal: p.PRECO_NORMAL,
          custo: p.CUSTO,
          margem_oferta: p.MARGEM_OFERTA,
          margem_normal: p.MARGEM_NORMAL,
          vd_media: p.VD_MEDIA,
          tipo_oferta: p.tipo_oferta_escolhido || null,
          origem: 'oracle',
        }));
        setItensOferta(normalized);
        if (ini && fim) carregarCrescimentos(normalized, ini, fim);
      } catch {
        setItensOferta([]);
      } finally {
        setItensLoading(false);
      }
    }
  };

  const carregarCrescimentos = (itens, ini, fim) => {
    if (!itens.length || !ini || !fim) return;
    setCrescLoading(true);
    const payload = {
      codLoja,
      produtos: itens.map(p => ({ codProduto: p.cod_produto, dtaInicio: ini, dtaFim: fim, vdMedia: p.vd_media || 0 }))
    };
    api.post('/api/ofertas/crescimentos-oferta', payload)
      .then(res => setCrescimentos(res.data || {}))
      .catch(() => setCrescimentos({}))
      .finally(() => setCrescLoading(false));
  };

  const handleProdutoClick = (item) => {
    if (produtoAtivo?.cod_produto === item.cod_produto) { setProdutoAtivo(null); setBasket([]); return; }
    setProdutoAtivo(item);
    setBasketLoading(true);
    setBasket([]);
    api.get('/api/ofertas/carrinho-junto', {
      params: { codLoja, codProduto: item.cod_produto, dtaInicio, dtaFim }
    })
      .then(res => setBasket(res.data || []))
      .catch(() => setBasket([]))
      .finally(() => setBasketLoading(false));
  };

  const diasPeriodo = calcDias(dtaInicio, dtaFim);
  const temConteudo = itensOferta.length > 0 || itensLoading;

  // Cards de resumo calculados a partir dos crescimentos + itens
  const resumoCards = useMemo(() => {
    if (!selecao || !itensOferta.length || Object.keys(crescimentos).length === 0) return null;
    const lista = itensOferta.map(item => ({
      item,
      cresc: crescimentos[item.cod_produto],
    })).filter(x => x.cresc);

    if (!lista.length) return null;

    // VD total / dia (unidades)
    const vdDia = lista.reduce((s, x) => s + (x.cresc.vdOferta || 0), 0);

    // Venda estimada no período (R$)
    const vendaPeriodo = lista.reduce((s, x) => {
      const preco = x.item.preco_oferta || 0;
      return s + (x.cresc.vdOferta || 0) * diasPeriodo * preco;
    }, 0);
    const vendaDia = vendaPeriodo / diasPeriodo;

    // Crescimento médio (só dos que têm crescimento != 0)
    const comCresc = lista.filter(x => x.cresc.crescimentoPct !== 0);
    const crescMedio = comCresc.length > 0
      ? comCresc.reduce((s, x) => s + x.cresc.crescimentoPct, 0) / comCresc.length
      : null;

    // Margem média da oferta (só para oracle progs que têm margem_oferta)
    const comMargem = lista.filter(x => x.item.margem_oferta != null);
    const margemMedia = comMargem.length > 0
      ? comMargem.reduce((s, x) => s + x.item.margem_oferta, 0) / comMargem.length
      : null;

    // Contagem de classificações
    const excelente = lista.filter(x => x.cresc.crescimentoPct >= 100).length;
    const boa       = lista.filter(x => x.cresc.crescimentoPct >= 30 && x.cresc.crescimentoPct < 100).length;
    const ruim      = lista.filter(x => x.cresc.crescimentoPct < 0).length;

    return { vdDia, vendaDia, vendaPeriodo, crescMedio, margemMedia, excelente, boa, ruim, total: lista.length };
  }, [crescimentos, itensOferta, diasPeriodo, selecao]);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-6 py-4 shadow-lg flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-wide">SIMULADOR DE VENDA</h1>
              <p className="text-orange-100 text-sm mt-0.5">Análise de cesta de compras por oferta salva ou programação ativa</p>
            </div>
            <svg className="w-10 h-10 text-orange-200 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>

          {/* Seletor */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {/* Filtro Ativas/Todas */}
            <div className="flex rounded-lg overflow-hidden border border-white/30 text-sm font-medium">
              <button
                onClick={() => setSoAtivas(true)}
                className={`px-3 py-1.5 transition-colors ${soAtivas ? 'bg-white text-orange-600' : 'bg-white/15 text-white hover:bg-white/25'}`}
              >Ativas</button>
              <button
                onClick={() => setSoAtivas(false)}
                className={`px-3 py-1.5 transition-colors ${!soAtivas ? 'bg-white text-orange-600' : 'bg-white/15 text-white hover:bg-white/25'}`}
              >Todas</button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-orange-100 font-medium whitespace-nowrap">Oferta / Programação:</label>
              {loading ? (
                <span className="text-orange-200 text-sm">Carregando...</span>
              ) : (
                <select
                  value={selecao}
                  onChange={e => handleSelecao(e.target.value)}
                  className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 min-w-[260px]"
                >
                  <option value="" className="text-gray-800">Selecione...</option>
                  {programacoes.length > 0 && (
                    <optgroup label="── Programações Oracle ──" className="text-gray-600 font-semibold">
                      {programacoes.map(p => (
                        <option key={`prog::${p.COD_PROG}`} value={`prog::${p.COD_PROG}`} className="text-gray-800">
                          {p.DES_PROGRAMACAO} ({p.DTA_INICIAL} a {p.DTA_FINAL}) — {p.TOTAL_PRODUTOS} itens
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {nomeOfertas.length > 0 && (
                    <optgroup label="── Ofertas Salvas ──" className="text-gray-600 font-semibold">
                      {nomeOfertas.map(nome => (
                        <option key={`salva::${nome}`} value={`salva::${nome}`} className="text-gray-800">
                          {nome.startsWith('sem-nome-') ? '(sem nome)' : nome} — {grupos[nome]?.length || 0} itens
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </div>
            {dtaInicio && dtaFim && (
              <div className="flex items-center gap-2 text-sm text-orange-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <span>Vigência: <strong>{dtaInicio}</strong> a <strong>{dtaFim}</strong> ({diasPeriodo} dias)</span>
              </div>
            )}
          </div>
        </div>

        {/* Cards de resumo (exibidos quando há crescimentos carregados) */}
        {resumoCards && (
          <div className="px-4 pt-3 pb-0 flex gap-3 flex-shrink-0 flex-wrap">
            {/* Venda das Ofertas/dia (R$) */}
            <div className="bg-white rounded-lg shadow px-4 py-2.5 flex flex-col min-w-[150px]">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Vd. Ofertas/dia</span>
              <span className="text-lg font-bold text-gray-800">
                R$ {resumoCards.vendaDia.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-gray-400">{resumoCards.vdDia.toFixed(1)} un/dia (somente oferta)</span>
            </div>
            {/* Venda em Oferta total no período (R$) */}
            <div className="bg-white rounded-lg shadow px-4 py-2.5 flex flex-col min-w-[160px]">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Venda Total Oferta</span>
              <span className="text-lg font-bold text-orange-600">
                R$ {resumoCards.vendaPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-gray-400">{diasPeriodo} dias de vigência</span>
            </div>
            {/* Crescimento Médio */}
            {resumoCards.crescMedio != null && (
              <div className="bg-white rounded-lg shadow px-4 py-2.5 flex flex-col min-w-[140px]">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Cresc. Médio</span>
                <span className={`text-lg font-bold ${resumoCards.crescMedio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {resumoCards.crescMedio > 0 ? '+' : ''}{resumoCards.crescMedio.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400">vs. VD histórica</span>
              </div>
            )}
            {/* Margem Oferta (só para oracle progs) */}
            {resumoCards.margemMedia != null && (
              <div className="bg-white rounded-lg shadow px-4 py-2.5 flex flex-col min-w-[130px]">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Margem Oferta</span>
                <span className={`text-lg font-bold ${resumoCards.margemMedia >= 20 ? 'text-green-600' : resumoCards.margemMedia >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {resumoCards.margemMedia.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400">margem média</span>
              </div>
            )}
            {/* Classificação resumo */}
            <div className="bg-white rounded-lg shadow px-4 py-2.5 flex flex-col min-w-[130px]">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Classificação</span>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {resumoCards.excelente > 0 && <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800 font-medium">{resumoCards.excelente} Exc.</span>}
                {resumoCards.boa > 0 && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800 font-medium">{resumoCards.boa} Boa</span>}
                {resumoCards.ruim > 0 && <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-800 font-medium">{resumoCards.ruim} Ruim</span>}
              </div>
              <span className="text-xs text-gray-400 mt-0.5">{resumoCards.total} itens c/ dados</span>
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-hidden p-4">
          {!selecao ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <p className="text-lg font-medium">Selecione uma programação ou oferta salva</p>
                <p className="text-sm mt-1">As programações ativas do Oracle e ofertas salvas aparecem no menu acima</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 h-full">
              {/* Esquerda: itens */}
              <div className="flex flex-col bg-white rounded-lg shadow overflow-hidden" style={{ flex: '0 0 55%' }}>
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-700 text-sm">
                    ITENS DA OFERTA
                    <span className="ml-2 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-bold">{itensOferta.length}</span>
                  </h2>
                  {crescLoading && (
                    <span className="text-xs text-blue-500 flex items-center gap-1">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/>
                      </svg>
                      Calculando crescimentos...
                    </span>
                  )}
                </div>
                <div className="overflow-auto flex-1">
                  {itensLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/>
                      <span className="ml-2 text-gray-500 text-sm">Carregando itens...</span>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Cód. Barras</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Descrição</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">Preço Oferta</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">Curva</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">VD Média</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">Cresc. Oferta</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">Classif.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensOferta.map((item, idx) => {
                          const cresc = crescimentos[item.cod_produto];
                          const isAtivo = produtoAtivo?.cod_produto === item.cod_produto;
                          const vdMediaVal = item.vd_media != null ? item.vd_media : cresc?.vdHist;
                          const vdMediaStr = vdMediaVal != null ? Number(vdMediaVal).toFixed(2).replace('.', ',') : null;
                          const cl = cresc != null ? getClassif(cresc.crescimentoPct) : null;
                          return (
                            <tr
                              key={item.cod_produto + idx}
                              onClick={() => handleProdutoClick(item)}
                              className={`border-b border-gray-100 cursor-pointer transition-colors ${
                                isAtivo ? 'bg-orange-50 border-l-2 border-l-orange-400' : idx % 2 === 0 ? 'bg-white hover:bg-orange-50' : 'bg-gray-50 hover:bg-orange-50'
                              }`}
                            >
                              <td className="px-3 py-1.5 text-gray-400 font-mono">{item.cod_barras}</td>
                              <td className="px-3 py-1.5 text-gray-800 font-medium max-w-[200px] truncate" title={item.descricao}>{item.descricao}</td>
                              <td className="px-3 py-1.5 text-right font-semibold text-green-700">
                                {item.preco_oferta != null ? `R$ ${Number(item.preco_oferta).toFixed(2).replace('.', ',')}` : '-'}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                {item.curva && item.curva !== '-' ? (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">{item.curva}</span>
                                ) : '-'}
                              </td>
                              {/* VD Média histórica (igual ao painel basket) */}
                              <td className="px-3 py-1.5 text-right text-gray-500">
                                {crescLoading && vdMediaStr == null
                                  ? <span className="text-gray-300">...</span>
                                  : vdMediaStr != null ? vdMediaStr : '-'}
                              </td>
                              <td className={`px-3 py-1.5 text-right ${crescLoading ? 'text-gray-300' : crescCor(cresc?.crescimentoPct)}`}>
                                {crescLoading ? '...' : cresc != null ? `${cresc.crescimentoPct > 0 ? '+' : ''}${cresc.crescimentoPct.toFixed(1)}%` : '-'}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                {crescLoading ? (
                                  <span className="text-gray-300 text-xs">...</span>
                                ) : cl ? (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cl.cls}`}>{cl.label}</span>
                                ) : (
                                  <span className="text-gray-400 text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Direita: basket */}
              <div className="flex flex-col bg-white rounded-lg shadow overflow-hidden" style={{ flex: '0 0 44%' }}>
                {!produtoAtivo ? (
                  <div className="h-full flex items-center justify-center p-6 text-center text-gray-400">
                    <div>
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      <p className="font-medium">Clique em um produto</p>
                      <p className="text-sm mt-1">para ver os 10 mais comprados junto</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
                      <p className="text-xs text-orange-500 font-medium uppercase tracking-wide">Comprados junto com</p>
                      <p className="font-bold text-gray-800 text-sm truncate" title={produtoAtivo.descricao}>{produtoAtivo.descricao}</p>
                      {dtaInicio && dtaFim && (
                        <p className="text-xs text-gray-400 mt-0.5">{dtaInicio} a {dtaFim}</p>
                      )}
                    </div>
                    <div className="overflow-auto flex-1">
                      {basketLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/>
                          <span className="ml-2 text-gray-500 text-sm">Buscando cestas...</span>
                        </div>
                      ) : basket.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
                          Nenhum produto encontrado para este período
                        </div>
                      ) : (
                        <BasketTable basket={basket} crescCor={crescCor} getClassif={getClassif} />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
