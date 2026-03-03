import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const fmtBRL = (v) => v != null ? Number(v).toFixed(2).replace('.', ',') : '-';
const fmtData = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

export default function AnaliseCotacao() {
  const [cotacoes, setCotacoes] = useState([]);
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCotacoes, setLoadingCotacoes] = useState(false);
  const [busca, setBusca] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [showRanking, setShowRanking] = useState(true);
  const [fornecedorFiltro, setFornecedorFiltro] = useState(null); // cod_fornecedor selecionado no ranking
  const [filtroCard, setFiltroCard] = useState(null); // 'todos' | 'cotados' | 'semCotacao' | null
  const [showConfigFaixas, setShowConfigFaixas] = useState(false);
  const [valorNegQtdEmb, setValorNegQtdEmb] = useState(true);
  const [faixas, setFaixas] = useState({
    pessimo: { min: 10, max: 100 },
    ruim: { min: 3, max: 10 },
    regular: { min: 0.1, max: 3 },
    bom: { min: 3, max: 8 },
    excelente: { min: 8, max: 100 },
  });

  // Calcular % ganho: positivo = economia, negativo = perda
  const calcPctGanho = (item) => {
    if (!item.vencedor || !item.valCustoRep || item.valCustoRep <= 0) return null;
    return ((item.valCustoRep - item.vencedor.valCustoTab) / item.valCustoRep) * 100;
  };

  // Calcular cobertura futura: estoque apos consumo durante prazo de entrega
  const calcCobFutura = (item) => {
    const vdaDiaria = (item.qtdVda30d || 0) / 30;
    const prazo = item.vencedor?.prazoEntrega || 0;
    if (vdaDiaria <= 0 || prazo <= 0) return null;
    const consumoAtePedido = vdaDiaria * prazo;
    const estoqueRestante = (item.qtdEstoque || 0) - consumoAtePedido;
    return estoqueRestante / vdaDiaria;
  };

  // Classificar % ganho nas faixas configuradas
  const classificarGanho = (pct) => {
    if (pct === null || pct === undefined) return null;
    const abs = Math.abs(pct);
    if (pct < 0) {
      // Perda
      if (abs >= faixas.pessimo.min) return { label: 'Pessimo', cor: 'bg-red-600 text-white' };
      if (abs >= faixas.ruim.min) return { label: 'Ruim', cor: 'bg-red-400 text-white' };
      return { label: 'Ruim', cor: 'bg-red-400 text-white' };
    }
    // Ganho
    if (abs >= faixas.excelente.min) return { label: 'Excelente', cor: 'bg-green-600 text-white' };
    if (abs >= faixas.bom.min) return { label: 'Bom', cor: 'bg-blue-500 text-white' };
    if (abs >= faixas.regular.min) return { label: 'Regular', cor: 'bg-yellow-500 text-white' };
    return { label: 'Regular', cor: 'bg-yellow-500 text-white' };
  };

  // Colunas reordenaveis
  const [colunas, setColunas] = useState([
    { id: 'num', label: '#', align: 'center' },
    { id: 'codProduto', label: 'Codigo', align: 'left' },
    { id: 'desProduto', label: 'Produto', align: 'left' },
    { id: 'unidade', label: 'Un', align: 'center' },
    { id: 'embalagem', label: 'Emb', align: 'center' },
    { id: 'codBarra', label: 'Cod.Barras', align: 'center' },
    { id: 'estoque', label: 'Estoque', align: 'right' },
    { id: 'cobertura', label: 'Cobert.', align: 'right' },
    { id: 'vdaDia', label: 'Vda Dia', align: 'right' },
    { id: 'vdaSemana', label: 'Vda Sem', align: 'right' },
    { id: 'vda30d', label: 'Vda 30d', align: 'right' },
    { id: 'custoRep', label: 'Custo Rep', align: 'right' },
    { id: 'valVenda', label: 'Pr.Venda', align: 'right' },
    { id: 'dtaUltCompra', label: 'Ult.Compra', align: 'center' },
    { id: 'vencedor', label: '1o Mais Barato', align: 'left' },
    { id: 'valVencedor', label: 'Valor 1o', align: 'right' },
    { id: 'pctGanho', label: '% Ganho', align: 'center' },
    { id: 'classif', label: 'Classif.', align: 'center' },
    { id: 'prazoVencedor', label: 'Prazo', align: 'center' },
    { id: 'previsaoVencedor', label: 'Previsao Entrega', align: 'center' },
    { id: 'cobFutura', label: 'Cob. Futura', align: 'right' },
    { id: 'segundo', label: '2o Mais Barato', align: 'left' },
    { id: 'valSegundo', label: 'Valor 2o', align: 'right' },
    { id: 'terceiro', label: '3o Mais Barato', align: 'left' },
    { id: 'valTerceiro', label: 'Valor 3o', align: 'right' },
  ]);
  const [dragColIdx, setDragColIdx] = useState(null);

  // Drag-and-drop colunas
  const handleDragStartCol = (idx) => setDragColIdx(idx);
  const handleDragOverCol = (e) => e.preventDefault();
  const handleDropCol = (dropIdx) => {
    if (dragColIdx === null || dragColIdx === dropIdx) return;
    const nova = [...colunas];
    const [removed] = nova.splice(dragColIdx, 1);
    nova.splice(dropIdx, 0, removed);
    setColunas(nova);
    setDragColIdx(null);
  };

  useEffect(() => { loadCotacoes(); }, []);

  const loadCotacoes = async () => {
    try {
      setLoadingCotacoes(true);
      const { data } = await api.get('/analise-cotacao/cotacoes');
      setCotacoes(data.cotacoes || []);
      if (data.cotacoes?.length > 0 && !cotacaoSelecionada) {
        setCotacaoSelecionada(data.cotacoes[0]);
      }
    } catch (err) {
      toast.error('Erro ao carregar cotacoes');
    } finally {
      setLoadingCotacoes(false);
    }
  };

  useEffect(() => {
    if (cotacaoSelecionada) {
      setFornecedorFiltro(null);
      loadDetalhes(cotacaoSelecionada.codCota, cotacaoSelecionada.codLoja);
    }
  }, [cotacaoSelecionada]);

  const loadDetalhes = async (codCota, codLoja) => {
    try {
      setLoading(true);
      const [detRes, rankRes] = await Promise.all([
        api.get('/analise-cotacao/detalhes', { params: { codCota, codLoja } }),
        api.get('/analise-cotacao/ranking', { params: { codCota, codLoja } }),
      ]);
      setProdutos(detRes.data.produtos || []);
      setRanking(rankRes.data.ranking || []);
    } catch (err) {
      toast.error('Erro ao carregar detalhes da cotacao');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar por card + fornecedor + busca
  const produtosFiltrados = produtos.filter(p => {
    // Filtro por card de stats
    if (filtroCard === 'cotados' && !p.vencedor) return false;
    if (filtroCard === 'semCotacao' && p.vencedor) return false;
    // Filtro por fornecedor do ranking
    if (fornecedorFiltro) {
      const temForn = p.fornecedores?.some(f => f.codFornecedor === fornecedorFiltro && f.valCustoTab > 0);
      if (!temForn) return false;
    }
    if (!busca) return true;
    const term = busca.toUpperCase();
    return (p.desProduto || '').toUpperCase().includes(term) ||
      (p.codProduto || '').includes(term) ||
      (p.codBarra || '').includes(term) ||
      (p.vencedor?.desFornecedor || '').toUpperCase().includes(term);
  });

  // Ordenar
  const produtosOrdenados = [...produtosFiltrados].sort((a, b) => {
    if (!sortCol) return 0;
    let va, vb;
    switch (sortCol) {
      case 'codProduto': va = a.codProduto; vb = b.codProduto; break;
      case 'desProduto': va = a.desProduto; vb = b.desProduto; break;
      case 'estoque': va = a.qtdEstoque; vb = b.qtdEstoque; break;
      case 'cobertura': va = a.qtdCobertura; vb = b.qtdCobertura; break;
      case 'vdaDia': va = a.qtdVda30d; vb = b.qtdVda30d; break;
      case 'vdaSemana': va = a.qtdVda30d; vb = b.qtdVda30d; break;
      case 'vda30d': va = a.qtdVda30d; vb = b.qtdVda30d; break;
      case 'custoRep': va = a.valCustoRep; vb = b.valCustoRep; break;
      case 'valVenda': va = a.valVenda; vb = b.valVenda; break;
      case 'dtaUltCompra': va = a.dtaUltCompra || ''; vb = b.dtaUltCompra || ''; break;
      case 'valVencedor': va = a.vencedor?.valCustoTab || 999999; vb = b.vencedor?.valCustoTab || 999999; break;
      case 'valSegundo': va = a.segundo?.valCustoTab || 999999; vb = b.segundo?.valCustoTab || 999999; break;
      case 'valTerceiro': va = a.terceiro?.valCustoTab || 999999; vb = b.terceiro?.valCustoTab || 999999; break;
      case 'vencedor': va = a.vencedor?.desFornecedor || ''; vb = b.vencedor?.desFornecedor || ''; break;
      case 'segundo': va = a.segundo?.desFornecedor || ''; vb = b.segundo?.desFornecedor || ''; break;
      case 'terceiro': va = a.terceiro?.desFornecedor || ''; vb = b.terceiro?.desFornecedor || ''; break;
      case 'pctGanho': va = calcPctGanho(a) ?? -9999; vb = calcPctGanho(b) ?? -9999; break;
      case 'classif': va = calcPctGanho(a) ?? -9999; vb = calcPctGanho(b) ?? -9999; break;
      case 'prazoVencedor': va = a.vencedor?.prazoEntrega || 999; vb = b.vencedor?.prazoEntrega || 999; break;
      case 'previsaoVencedor': va = a.vencedor?.prazoEntrega || 999; vb = b.vencedor?.prazoEntrega || 999; break;
      case 'cobFutura': va = calcCobFutura(a) ?? -9999; vb = calcCobFutura(b) ?? -9999; break;
      default: return 0;
    }
    if (typeof va === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
  });

  const handleSort = (colId) => {
    if (colId === 'num') return;
    if (sortCol === colId) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  const handleFornecedorClick = (codFornecedor) => {
    if (fornecedorFiltro === codFornecedor) {
      setFornecedorFiltro(null); // deselecionar
    } else {
      setFornecedorFiltro(codFornecedor);
    }
  };

  // Nome do fornecedor filtrado
  const fornecedorFiltroNome = fornecedorFiltro
    ? ranking.find(f => f.codFornecedor === fornecedorFiltro)?.desFornecedor || ''
    : '';

  // Renderizar celula
  const renderCel = (col, item, i) => {
    switch (col.id) {
      case 'num': return <span className="text-gray-400 text-xs">{i + 1}</span>;
      case 'codProduto': return <span className="text-xs font-mono text-gray-600">{item.codProduto}</span>;
      case 'desProduto': return <span className="font-medium text-gray-800 whitespace-nowrap">{item.desProduto}</span>;
      case 'unidade': return <span className="text-xs text-gray-500">{item.unidadeCompra}</span>;
      case 'embalagem': return <span className="text-xs text-gray-500">{item.qtdEmbalagem || '-'}</span>;
      case 'codBarra': return <span className="text-xs font-mono text-gray-500">{item.codBarra || '-'}</span>;
      case 'estoque': return <span className={`text-sm font-semibold ${item.qtdEstoque <= 0 ? 'text-red-600' : 'text-gray-700'}`}>{Number(item.qtdEstoque || 0).toFixed(3).replace('.', ',')}</span>;
      case 'cobertura': {
        const cob = item.qtdCobertura;
        const cor = cob <= 0 ? 'text-red-600 font-bold' : cob <= 3 ? 'text-orange-600 font-bold' : 'text-gray-600';
        return <span className={`text-sm ${cor}`}>{cob}d</span>;
      }
      case 'vdaDia': return <span className="text-sm text-gray-600">{((item.qtdVda30d || 0) / 30).toFixed(1).replace('.', ',')}</span>;
      case 'vdaSemana': return <span className="text-sm text-gray-600">{((item.qtdVda30d || 0) / 30 * 7).toFixed(1).replace('.', ',')}</span>;
      case 'vda30d': return <span className="text-sm text-gray-600">{Number(item.qtdVda30d || 0).toFixed(0)}</span>;
      case 'custoRep': return <span className="text-sm text-orange-700 font-semibold whitespace-nowrap">R$ {fmtBRL(item.valCustoRep)}</span>;
      case 'valVenda': return <span className="text-sm text-orange-700 font-semibold whitespace-nowrap">R$ {fmtBRL(item.valVenda)}</span>;
      case 'dtaUltCompra': return <span className="text-xs text-gray-500">{fmtData(item.dtaUltCompra)}</span>;
      case 'vencedor':
        if (!item.vencedor) return <span className="text-gray-300 text-xs">-</span>;
        return (
          <div className="flex items-center gap-1">
            {item.vencedor.ganhouPedido && <span className="text-green-600" title="Ganhou pedido">&#10003;</span>}
            <span className="text-sm text-green-700 font-semibold whitespace-nowrap truncate max-w-[180px]" title={item.vencedor.desFornecedor}>
              {item.vencedor.desFornecedor}
            </span>
          </div>
        );
      case 'valVencedor':
        if (!item.vencedor) return <span className="text-gray-300">-</span>;
        return <span className="text-sm text-green-700 font-bold whitespace-nowrap">R$ {fmtBRL(item.vencedor.valCustoTab)}</span>;
      case 'pctGanho': {
        const pct = calcPctGanho(item);
        if (pct === null) return <span className="text-gray-300">-</span>;
        const isGanho = pct >= 0;
        return (
          <span className={`text-sm font-bold flex items-center justify-center gap-0.5 ${isGanho ? 'text-green-600' : 'text-red-600'}`}>
            <span className="text-xs">{isGanho ? '\u25B2' : '\u25BC'}</span>
            {Math.abs(pct).toFixed(1).replace('.', ',')}%
          </span>
        );
      }
      case 'classif': {
        const pctC = calcPctGanho(item);
        const cl = classificarGanho(pctC);
        if (!cl) return <span className="text-gray-300">-</span>;
        return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cl.cor}`}>{cl.label}</span>;
      }
      case 'prazoVencedor': {
        if (!item.vencedor) return <span className="text-gray-300">-</span>;
        const pz = item.vencedor.prazoEntrega || 0;
        return pz > 0 ? <span className="text-sm text-orange-600 font-semibold">{pz}d</span> : <span className="text-gray-300">-</span>;
      }
      case 'previsaoVencedor': {
        if (!item.vencedor) return <span className="text-gray-300">-</span>;
        const dias = item.vencedor.prazoEntrega || 0;
        if (dias <= 0) return <span className="text-gray-300">-</span>;
        const prev = new Date();
        prev.setDate(prev.getDate() + dias);
        return <span className="text-sm text-gray-700 font-medium">{fmtData(prev)}</span>;
      }
      case 'cobFutura': {
        const cf = calcCobFutura(item);
        if (cf === null) return <span className="text-gray-300">-</span>;
        const dias = Math.round(cf);
        const cor = dias <= 0 ? 'text-red-600 font-bold' : dias <= 3 ? 'text-orange-600 font-bold' : dias <= 7 ? 'text-yellow-600 font-semibold' : 'text-green-600 font-semibold';
        return <span className={`text-sm ${cor}`}>{dias}d</span>;
      }
      case 'segundo':
        if (!item.segundo) return <span className="text-gray-300 text-xs">-</span>;
        return <span className="text-sm text-gray-600 whitespace-nowrap truncate max-w-[180px]" title={item.segundo.desFornecedor}>{item.segundo.desFornecedor}</span>;
      case 'valSegundo':
        if (!item.segundo) return <span className="text-gray-300">-</span>;
        return <span className="text-sm text-gray-600 whitespace-nowrap">R$ {fmtBRL(item.segundo.valCustoTab)}</span>;
      case 'terceiro':
        if (!item.terceiro) return <span className="text-gray-300 text-xs">-</span>;
        return <span className="text-sm text-gray-500 whitespace-nowrap truncate max-w-[150px]" title={item.terceiro.desFornecedor}>{item.terceiro.desFornecedor}</span>;
      case 'valTerceiro':
        if (!item.terceiro) return <span className="text-gray-300">-</span>;
        return <span className="text-sm text-gray-500">R$ {fmtBRL(item.terceiro.valCustoTab)}</span>;
      default: return '-';
    }
  };

  // Stats
  const totalCotaram = produtos.filter(p => p.vencedor).length;
  const totalSemCotacao = produtos.length - totalCotaram;
  const totalGeralPedidos = ranking.reduce((acc, f) => acc + (valorNegQtdEmb ? (f.valorTotalPedidosEmb || 0) : (f.valorTotalPedidos || 0)), 0);

  // Exportar PDF
  const handleExportPDF = () => {
    const dados = produtosOrdenados;
    const titulo = cotacaoSelecionada?.desCota || 'Cotacao';
    const dataStr = fmtData(cotacaoSelecionada?.dtaCota);

    const getCelText = (col, item) => {
      switch (col.id) {
        case 'num': return '';
        case 'codProduto': return item.codProduto;
        case 'desProduto': return item.desProduto;
        case 'unidade': return item.unidadeCompra;
        case 'embalagem': return item.qtdEmbalagem || '';
        case 'codBarra': return item.codBarra || '';
        case 'estoque': return item.qtdEstoque;
        case 'cobertura': return item.qtdCobertura + 'd';
        case 'vdaDia': return ((item.qtdVda30d || 0) / 30).toFixed(1).replace('.', ',');
        case 'vdaSemana': return ((item.qtdVda30d || 0) / 30 * 7).toFixed(1).replace('.', ',');
        case 'vda30d': return Number(item.qtdVda30d || 0).toFixed(0);
        case 'custoRep': return 'R$ ' + fmtBRL(item.valCustoRep);
        case 'valVenda': return 'R$ ' + fmtBRL(item.valVenda);
        case 'dtaUltCompra': return fmtData(item.dtaUltCompra);
        case 'vencedor': return item.vencedor?.desFornecedor || '-';
        case 'valVencedor': return item.vencedor ? 'R$ ' + fmtBRL(item.vencedor.valCustoTab) : '-';
        case 'pctGanho': {
          const pg = calcPctGanho(item);
          if (pg === null) return '-';
          return (pg >= 0 ? '+' : '') + pg.toFixed(1).replace('.', ',') + '%';
        }
        case 'classif': {
          const pgc = calcPctGanho(item);
          const clc = classificarGanho(pgc);
          return clc ? clc.label : '-';
        }
        case 'prazoVencedor': return item.vencedor?.prazoEntrega ? item.vencedor.prazoEntrega + 'd' : '-';
        case 'cobFutura': {
          const cfc = calcCobFutura(item);
          return cfc !== null ? Math.round(cfc) + 'd' : '-';
        }
        case 'previsaoVencedor': {
          const d = item.vencedor?.prazoEntrega;
          if (!d) return '-';
          const p = new Date(); p.setDate(p.getDate() + d);
          return fmtData(p);
        }
        case 'segundo': return item.segundo?.desFornecedor || '-';
        case 'valSegundo': return item.segundo ? 'R$ ' + fmtBRL(item.segundo.valCustoTab) : '-';
        case 'terceiro': return item.terceiro?.desFornecedor || '-';
        case 'valTerceiro': return item.terceiro ? 'R$ ' + fmtBRL(item.terceiro.valCustoTab) : '-';
        default: return '';
      }
    };

    const colsVisiveis = colunas.filter(c => c.id !== 'num');
    let html = `<html><head><title>${titulo}</title><style>
      body { font-family: Arial, sans-serif; font-size: 10px; margin: 10px; }
      h2 { color: #ea580c; margin-bottom: 4px; }
      .info { color: #666; margin-bottom: 10px; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #ea580c; color: white; padding: 4px 6px; text-align: left; font-size: 9px; white-space: nowrap; }
      td { padding: 3px 6px; border-bottom: 1px solid #eee; font-size: 9px; white-space: nowrap; }
      tr:nth-child(even) { background: #fafafa; }
      @media print { body { margin: 0; } }
    </style></head><body>`;
    html += `<h2>${titulo}</h2>`;
    html += `<div class="info">Data: ${dataStr} | Produtos: ${dados.length} | Fornecedores: ${ranking.length} | Total Pedido: R$ ${fmtBRL(totalGeralPedidos)}</div>`;
    html += '<table><thead><tr>';
    colsVisiveis.forEach(c => { html += `<th>${c.label}</th>`; });
    html += '</tr></thead><tbody>';
    dados.forEach((item, i) => {
      html += '<tr>';
      colsVisiveis.forEach(c => { html += `<td>${getCelText(c, item)}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table></body></html>';

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Header Laranja */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 rounded-b-xl shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">Analise de Cotacao</h1>
              <p className="text-orange-100 text-sm">Comparativo de precos entre fornecedores</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={cotacaoSelecionada?.codCota || ''}
                onChange={(e) => {
                  const cot = cotacoes.find(c => c.codCota === Number(e.target.value));
                  setCotacaoSelecionada(cot);
                }}
                className="border-0 rounded-lg px-3 py-2 text-sm bg-white/90 backdrop-blur min-w-[320px] shadow focus:ring-2 focus:ring-orange-300"
                disabled={loadingCotacoes}
              >
                <option value="">Selecione uma cotacao...</option>
                {cotacoes.map(c => (
                  <option key={c.codCota} value={c.codCota}>
                    {c.desCota} ({fmtData(c.dtaCota)}) - {c.totalProdutos} prod. / {c.totalFornecedores} forn.
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowRanking(!showRanking)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow ${showRanking ? 'bg-white text-orange-600' : 'bg-orange-700 text-white'}`}
              >
                Ranking
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {cotacaoSelecionada && !loading && (
          <div className="px-4 py-3 bg-gray-50 border-b flex gap-3 flex-wrap items-center">
            <div
              onClick={() => setFiltroCard(filtroCard === null ? null : null)}
              className={`rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer transition-all ${!filtroCard ? 'bg-orange-200 border-2 border-orange-500 shadow-sm' : 'bg-orange-50 border border-orange-200 hover:bg-orange-100'}`}
            >
              <span className="text-xs text-orange-600">Produtos:</span>
              <span className="font-bold text-orange-800 text-lg">{produtos.length}</span>
            </div>
            <div
              onClick={() => setFiltroCard(filtroCard === 'cotados' ? null : 'cotados')}
              className={`rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer transition-all ${filtroCard === 'cotados' ? 'bg-green-200 border-2 border-green-500 shadow-sm' : 'bg-green-50 border border-green-200 hover:bg-green-100'}`}
            >
              <span className="text-xs text-green-600">Cotados:</span>
              <span className="font-bold text-green-800 text-lg">{totalCotaram}</span>
            </div>
            <div
              onClick={() => setFiltroCard(filtroCard === 'semCotacao' ? null : 'semCotacao')}
              className={`rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer transition-all ${filtroCard === 'semCotacao' ? 'bg-red-200 border-2 border-red-500 shadow-sm' : 'bg-red-50 border border-red-200 hover:bg-red-100'}`}
            >
              <span className="text-xs text-red-500">Sem cotacao:</span>
              <span className="font-bold text-red-700 text-lg">{totalSemCotacao}</span>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-xs text-orange-600">Fornecedores:</span>
              <span className="font-bold text-orange-800 text-lg">{ranking.length}</span>
            </div>
            {totalGeralPedidos > 0 && (
              <div className="bg-orange-100 border-2 border-orange-400 rounded-lg px-5 py-2 flex items-center gap-2">
                <span className="text-xs text-orange-700 font-semibold">Total Pedido:</span>
                <span className="font-bold text-orange-900 text-xl">R$ {fmtBRL(totalGeralPedidos)}</span>
              </div>
            )}

            {/* Filtro ativo */}
            {(fornecedorFiltro || filtroCard) && (
              <div className="bg-orange-100 border border-orange-300 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="text-xs text-orange-700">Filtrando:</span>
                <span className="font-semibold text-orange-900 text-sm truncate max-w-[200px]">
                  {filtroCard === 'cotados' ? 'Cotados' : filtroCard === 'semCotacao' ? 'Sem Cotacao' : ''}{fornecedorFiltro && filtroCard ? ' + ' : ''}{fornecedorFiltro ? fornecedorFiltroNome : ''}
                </span>
                <button onClick={() => { setFornecedorFiltro(null); setFiltroCard(null); }} className="text-orange-500 hover:text-orange-800 font-bold ml-1" title="Limpar filtros">&times;</button>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Checkbox Valor Neg x Qtd Emb */}
              <label className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none" title="Multiplica valor negociado pela quantidade da embalagem">
                <input
                  type="checkbox"
                  checked={valorNegQtdEmb}
                  onChange={(e) => setValorNegQtdEmb(e.target.checked)}
                  className="accent-orange-500"
                />
                <span className="text-xs text-gray-700 font-medium whitespace-nowrap">Val Neg x Qtd Emb</span>
              </label>

              {/* Botao engrenagem - config faixas */}
              <div className="relative">
                <button
                  onClick={() => setShowConfigFaixas(!showConfigFaixas)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-1.5 rounded-lg transition-colors"
                  title="Configurar faixas de classificacao"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </button>
                {showConfigFaixas && (
                  <div className="absolute right-0 top-10 z-50 bg-white border border-gray-300 rounded-xl shadow-2xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-gray-800 text-sm">Faixas de Classificacao</h4>
                      <button onClick={() => setShowConfigFaixas(false)} className="text-gray-400 hover:text-gray-700 text-lg font-bold">&times;</button>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-red-600 font-bold mb-1.5">Perdas (custo subiu):</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full w-16 text-center">Pessimo</span>
                          <input type="number" value={faixas.pessimo.min} onChange={(e) => setFaixas({...faixas, pessimo: {...faixas.pessimo, min: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-400">a</span>
                          <input type="number" value={faixas.pessimo.max} onChange={(e) => setFaixas({...faixas, pessimo: {...faixas.pessimo, max: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-red-400 text-white px-2 py-0.5 rounded-full w-16 text-center">Ruim</span>
                          <input type="number" value={faixas.ruim.min} onChange={(e) => setFaixas({...faixas, ruim: {...faixas.ruim, min: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-400">a</span>
                          <input type="number" value={faixas.ruim.max} onChange={(e) => setFaixas({...faixas, ruim: {...faixas.ruim, max: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 font-bold mb-1.5">Ganhos (custo baixou):</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full w-16 text-center">Regular</span>
                          <input type="number" value={faixas.regular.min} onChange={(e) => setFaixas({...faixas, regular: {...faixas.regular, min: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-400">a</span>
                          <input type="number" value={faixas.regular.max} onChange={(e) => setFaixas({...faixas, regular: {...faixas.regular, max: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full w-16 text-center">Bom</span>
                          <input type="number" value={faixas.bom.min} onChange={(e) => setFaixas({...faixas, bom: {...faixas.bom, min: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-400">a</span>
                          <input type="number" value={faixas.bom.max} onChange={(e) => setFaixas({...faixas, bom: {...faixas.bom, max: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full w-16 text-center">Excelente</span>
                          <input type="number" value={faixas.excelente.min} onChange={(e) => setFaixas({...faixas, excelente: {...faixas.excelente, min: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-400">a</span>
                          <input type="number" value={faixas.excelente.max} onChange={(e) => setFaixas({...faixas, excelente: {...faixas.excelente, max: Number(e.target.value)}})} className="border rounded px-2 py-1 w-16 text-xs text-center" />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="Buscar produto, codigo ou fornecedor..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-72 focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
              />
              <button
                onClick={() => handleExportPDF()}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow"
                title="Exportar PDF"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
                PDF
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tabela Principal */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-3"></div>
                  <p className="text-gray-500">Carregando cotacao...</p>
                </div>
              </div>
            ) : !cotacaoSelecionada ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                Selecione uma cotacao para visualizar
              </div>
            ) : produtosOrdenados.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                Nenhum produto encontrado
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-700 sticky top-0 z-10">
                  <tr>
                    {colunas.map((col, ci) => (
                      <th
                        key={col.id}
                        className={`text-${col.align} p-2.5 font-semibold text-white text-xs cursor-grab select-none hover:bg-gray-600 whitespace-nowrap`}
                        draggable
                        onDragStart={() => handleDragStartCol(ci)}
                        onDragOver={handleDragOverCol}
                        onDrop={() => handleDropCol(ci)}
                        onClick={() => handleSort(col.id)}
                        title="Arraste para reordenar / Clique para ordenar"
                      >
                        <span className="flex items-center gap-1 justify-center">
                          {col.label}
                          {sortCol === col.id && (
                            <span className="text-orange-300">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {produtosOrdenados.map((item, i) => (
                    <tr key={item.codProduto} className={`border-b transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-orange-50/40`}>
                      {colunas.map((col) => (
                        <td key={col.id} className={`p-2.5 text-${col.align}`}>
                          {renderCel(col, item, i)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Ranking Lateral */}
          {showRanking && ranking.length > 0 && (
            <div className="w-80 border-l bg-white overflow-auto flex-shrink-0">
              <div className="p-3 border-b bg-gradient-to-r from-orange-500 to-orange-600">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  RANKING MAIS BARATO
                </h3>
              </div>
              <div className="divide-y">
                {ranking.map((f, idx) => {
                  const isSelected = fornecedorFiltro === f.codFornecedor;
                  const pedMin = f.pedidoMinimo || 0;
                  const totalPedidos = valorNegQtdEmb ? (f.valorTotalPedidosEmb || 0) : (f.valorTotalPedidos || 0);
                  const naoBateuMinimo = pedMin > 0 && totalPedidos > 0 && totalPedidos < pedMin;
                  return (
                    <div
                      key={f.codFornecedor}
                      onClick={() => handleFornecedorClick(f.codFornecedor)}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-orange-50 border-l-4 border-l-orange-500'
                          : naoBateuMinimo
                            ? 'bg-red-50/60 border-l-4 border-l-red-400 hover:bg-red-50'
                            : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{idx < 3 ? MEDALS[idx] : ''}</span>
                        <span className="text-xs font-bold text-gray-400">{idx + 1}&#186;</span>
                        <span className={`text-sm font-semibold truncate flex-1 ${isSelected ? 'text-orange-700' : naoBateuMinimo ? 'text-red-700' : 'text-gray-800'}`} title={f.desFornecedor}>
                          {f.desFornecedor}
                        </span>
                        {naoBateuMinimo && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap" title={`Ped.Min: R$ ${fmtBRL(pedMin)}`}>
                            &lt; MIN
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between ml-8 mt-1">
                        <div className="flex gap-2 text-xs">
                          <span className="text-green-700 font-bold">1&#186;:{f.qtdMaisBarato}</span>
                          <span className="text-orange-600 font-bold">2&#186;:{f.qtdSegundo}</span>
                          <span className="text-red-600 font-bold">3&#186;:{f.qtdTerceiro}</span>
                        </div>
                        {totalPedidos > 0 && (
                          <span className={`text-base font-bold ${naoBateuMinimo ? 'text-red-600' : 'text-green-700'}`}>
                            R$ {fmtBRL(totalPedidos)}
                          </span>
                        )}
                      </div>
                      {naoBateuMinimo && pedMin > 0 && (
                        <div className="ml-8 mt-0.5 text-xs text-red-500">
                          Min: R$ {fmtBRL(pedMin)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
