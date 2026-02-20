import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PRIORIDADE_CONFIG = {
  1: { label: 'CURVA A', cor: 'bg-red-500', corTexto: 'text-white', corBadge: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'RUPTURA', cor: 'bg-orange-500', corTexto: 'text-white', corBadge: 'bg-orange-100 text-orange-700 border-orange-200' },
  3: { label: 'PRE-RUPTURA', cor: 'bg-yellow-500', corTexto: 'text-white', corBadge: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  4: { label: 'DEMAIS', cor: 'bg-gray-400', corTexto: 'text-white', corBadge: 'bg-gray-100 text-gray-600 border-gray-200' },
};

// Definição das colunas (ordem padrão)
const COLUNAS_PADRAO = [
  { id: 'prioridade', label: 'PRIORIDADE', align: 'center', w: 'w-28' },
  { id: 'produto', label: 'PRODUTO', align: 'left', w: '' },
  { id: 'cod_barras', label: 'COD. BARRAS', align: 'left', w: 'w-32' },
  { id: 'fornecedor', label: 'FORNECEDOR', align: 'left', w: '' },
  { id: 'secao', label: 'SECAO', align: 'left', w: 'w-32' },
  { id: 'grupo', label: 'GRUPO', align: 'left', w: 'w-32' },
  { id: 'subgrupo', label: 'SUBGRUPO', align: 'left', w: 'w-32' },
  { id: 'curva', label: 'CURVA', align: 'center', w: 'w-16' },
  { id: 'custo', label: 'CUSTO', align: 'right', w: 'w-24' },
  { id: 'preco_venda', label: 'PRECO VD', align: 'right', w: 'w-24' },
  { id: 'margem', label: 'MARGEM', align: 'right', w: 'w-20' },
  { id: 'estoque', label: 'ESTOQUE', align: 'right', w: 'w-20' },
  { id: 'venda_media', label: 'VND MEDIA', align: 'right', w: 'w-20' },
  { id: 'nf', label: 'NF', align: 'center', w: 'w-20' },
];

function getOntem() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export default function PrioridadeReposicao() {
  const { lojaSelecionada, lojas } = useLoja();
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState([]);
  const [resumo, setResumo] = useState({ total: 0, prioridade1: 0, prioridade2: 0, prioridade3: 0, prioridade4: 0 });
  const [filtros, setFiltros] = useState({ 1: true, 2: true, 3: true, 4: true });
  const [busca, setBusca] = useState('');
  const [dataEntrada, setDataEntrada] = useState(getOntem());

  // Filtros dropdown
  const [filtroTipo, setFiltroTipo] = useState('MERCADORIA');
  const [filtroSecao, setFiltroSecao] = useState('TODOS');
  const [filtroGrupo, setFiltroGrupo] = useState('TODOS');
  const [filtroSubgrupo, setFiltroSubgrupo] = useState('TODOS');

  // Colunas arrastáveis
  const [colunas, setColunas] = useState(COLUNAS_PADRAO);
  const dragCol = useRef(null);
  const dragOverCol = useRef(null);

  const fetchData = useCallback(async () => {
    const codLoja = lojaSelecionada || (lojas.length > 0 ? lojas[0].COD_LOJA : '1');
    setLoading(true);
    try {
      const res = await api.get(`/abastecimento/prioridade-reposicao?codLoja=${codLoja}&data=${dataEntrada}`);
      setItens(res.data.itens || []);
      setResumo(res.data.resumo || { total: 0, prioridade1: 0, prioridade2: 0, prioridade3: 0, prioridade4: 0 });
    } catch (err) {
      console.error('Erro ao buscar prioridade reposicao:', err);
      setItens([]);
      setResumo({ total: 0, prioridade1: 0, prioridade2: 0, prioridade3: 0, prioridade4: 0 });
    } finally {
      setLoading(false);
    }
  }, [lojaSelecionada, lojas, dataEntrada]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Opções de filtro derivadas dos dados
  const opcoesSecao = useMemo(() => {
    const set = new Set(itens.map(i => i.secao).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [itens]);

  const opcoesGrupo = useMemo(() => {
    const filtered = filtroSecao === 'TODOS' ? itens : itens.filter(i => i.secao === filtroSecao);
    const set = new Set(filtered.map(i => i.grupo).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [itens, filtroSecao]);

  const opcoesSubgrupo = useMemo(() => {
    let filtered = itens;
    if (filtroSecao !== 'TODOS') filtered = filtered.filter(i => i.secao === filtroSecao);
    if (filtroGrupo !== 'TODOS') filtered = filtered.filter(i => i.grupo === filtroGrupo);
    const set = new Set(filtered.map(i => i.subgrupo).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [itens, filtroSecao, filtroGrupo]);

  const opcoesTipo = useMemo(() => {
    const set = new Set(itens.map(i => i.tipo_especie).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [itens]);

  // Reset grupo/subgrupo quando seção muda
  useEffect(() => { setFiltroGrupo('TODOS'); setFiltroSubgrupo('TODOS'); }, [filtroSecao]);
  useEffect(() => { setFiltroSubgrupo('TODOS'); }, [filtroGrupo]);

  // Filtrar itens
  const itensFiltrados = itens.filter(item => {
    if (!filtros[item.prioridade]) return false;
    if (filtroTipo !== 'TODOS' && item.tipo_especie !== filtroTipo) return false;
    if (filtroSecao !== 'TODOS' && item.secao !== filtroSecao) return false;
    if (filtroGrupo !== 'TODOS' && item.grupo !== filtroGrupo) return false;
    if (filtroSubgrupo !== 'TODOS' && item.subgrupo !== filtroSubgrupo) return false;
    if (busca) {
      const termo = busca.toLowerCase();
      return (
        (item.descricao || '').toLowerCase().includes(termo) ||
        (item.codigo || '').toString().includes(termo) ||
        (item.codigo_barras || '').toString().includes(termo) ||
        (item.fornecedor || '').toLowerCase().includes(termo) ||
        (item.secao || '').toLowerCase().includes(termo) ||
        (item.grupo || '').toLowerCase().includes(termo)
      );
    }
    return true;
  });

  const toggleFiltro = (prioridade) => {
    setFiltros(prev => ({ ...prev, [prioridade]: !prev[prioridade] }));
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPercent = (val) => {
    const num = parseFloat(val) || 0;
    return num.toFixed(2) + '%';
  };

  const dataFormatada = (() => {
    const parts = dataEntrada.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  })();

  // Exportar PDF (agrupado por seção)
  const exportarPDF = () => {
    if (itensFiltrados.length === 0) return;

    const doc = new jsPDF('landscape');

    // Titulo
    doc.setFontSize(16);
    doc.setTextColor(234, 88, 12);
    doc.text('PRIORIDADE REPOSICAO', 148, 15, { align: 'center' });

    // Subtitulo
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Data Entrada NF: ${dataFormatada}  |  Total: ${itensFiltrados.length} itens  |  P1: ${resumo.prioridade1}  P2: ${resumo.prioridade2}  P3: ${resumo.prioridade3}  P4: ${resumo.prioridade4}`, 148, 22, { align: 'center' });

    const prioridadeLabel = { 1: 'P1-CURVA A', 2: 'P2-RUPTURA', 3: 'P3-PRE-RUPT', 4: 'P4-DEMAIS' };
    const headers = [['#', 'Prior.', 'Produto', 'Cod.Barras', 'Fornecedor', 'Grupo', 'Curva', 'Custo', 'Preco Vd', 'Margem', 'Estoque', 'NF']];

    let startY = 28;
    let globalIdx = 0;

    // Agrupar por seção
    const grupos = new Map();
    itensFiltrados.forEach(item => {
      const secao = item.secao || 'SEM SECAO';
      if (!grupos.has(secao)) grupos.set(secao, []);
      grupos.get(secao).push(item);
    });

    // Rastrear itens globais para didParseCell
    const allItems = [];

    grupos.forEach((itensSecao, secaoNome) => {
      // Barra da seção
      const curY = startY;
      if (curY > 180) {
        doc.addPage();
        startY = 15;
      }
      doc.setFillColor(234, 88, 12);
      doc.rect(14, startY, 269, 7, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`${secaoNome}  (${itensSecao.length} itens)`, 17, startY + 5);
      startY += 9;

      const secaoData = itensSecao.map((item) => {
        globalIdx++;
        allItems.push(item);
        return [
          globalIdx,
          prioridadeLabel[item.prioridade] || 'P4',
          (item.descricao || '').substring(0, 30),
          item.codigo_barras || '-',
          (item.fornecedor || '').substring(0, 20),
          (item.grupo || '').substring(0, 12),
          item.curva || '-',
          formatCurrency(item.custo),
          formatCurrency(item.preco_venda),
          formatPercent(item.margem),
          (parseFloat(item.estoque_atual) || 0).toFixed(0),
          item.numero_nf || '-',
        ];
      });

      autoTable(doc, {
        head: headers,
        body: secaoData,
        startY: startY,
        styles: { fontSize: 6.5, cellPadding: 1.5 },
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
        alternateRowStyles: { fillColor: [255, 247, 237] },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 45 },
          3: { cellWidth: 26 },
          4: { cellWidth: 35 },
          5: { cellWidth: 22 },
          6: { cellWidth: 12, halign: 'center' },
          7: { cellWidth: 20, halign: 'right' },
          8: { cellWidth: 20, halign: 'right' },
          9: { cellWidth: 17, halign: 'right' },
          10: { cellWidth: 17, halign: 'right' },
          11: { cellWidth: 20, halign: 'center' },
        },
        didParseCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 1) {
            const itemIdx = globalIdx - secaoData.length + hookData.row.index;
            const prior = allItems[itemIdx]?.prioridade;
            if (prior === 1) { hookData.cell.styles.textColor = [185, 28, 28]; hookData.cell.styles.fontStyle = 'bold'; }
            else if (prior === 2) { hookData.cell.styles.textColor = [194, 65, 12]; hookData.cell.styles.fontStyle = 'bold'; }
            else if (prior === 3) { hookData.cell.styles.textColor = [161, 98, 7]; hookData.cell.styles.fontStyle = 'bold'; }
          }
        },
      });

      startY = doc.lastAutoTable.finalY + 6;
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Pagina ${i} de ${pageCount} | Gerado em ${new Date().toLocaleString('pt-BR')}`,
        148,
        doc.internal.pageSize.height - 7,
        { align: 'center' }
      );
    }

    doc.save(`prioridade_reposicao_${dataEntrada}.pdf`);
  };

  // Drag & drop de colunas
  const handleDragStart = (idx) => {
    dragCol.current = idx;
  };

  const handleDragEnter = (idx) => {
    dragOverCol.current = idx;
  };

  const handleDragEnd = () => {
    if (dragCol.current === null || dragOverCol.current === null) return;
    const newCols = [...colunas];
    const dragItem = newCols.splice(dragCol.current, 1)[0];
    newCols.splice(dragOverCol.current, 0, dragItem);
    setColunas(newCols);
    dragCol.current = null;
    dragOverCol.current = null;
  };

  // Agrupar itens filtrados por seção (mantendo ordem)
  const itensAgrupadosPorSecao = useMemo(() => {
    const grupos = new Map();
    itensFiltrados.forEach(item => {
      const secao = item.secao || 'SEM SECAO';
      if (!grupos.has(secao)) {
        grupos.set(secao, []);
      }
      grupos.get(secao).push(item);
    });
    return grupos;
  }, [itensFiltrados]);

  // Renderizar célula de acordo com coluna
  const renderCell = (item, colId, idx) => {
    const config = PRIORIDADE_CONFIG[item.prioridade] || PRIORIDADE_CONFIG[4];
    switch (colId) {
      case 'prioridade':
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${config.corBadge}`}>
            P{item.prioridade}
          </span>
        );
      case 'produto':
        return (
          <>
            <div className="font-medium text-gray-800 text-xs">{item.descricao}</div>
            <div className="text-[10px] text-gray-400">Cod: {item.codigo}</div>
          </>
        );
      case 'cod_barras':
        return <span className="font-mono">{item.codigo_barras || '-'}</span>;
      case 'fornecedor':
        return <span className="truncate max-w-[200px] block" title={item.fornecedor}>{item.fornecedor || '-'}</span>;
      case 'secao':
        return item.secao || '-';
      case 'grupo':
        return item.grupo || '-';
      case 'subgrupo':
        return item.subgrupo || '-';
      case 'curva':
        return (
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
            item.curva === 'A' ? 'bg-red-100 text-red-700' :
            item.curva === 'B' ? 'bg-orange-100 text-orange-700' :
            item.curva === 'C' ? 'bg-yellow-100 text-yellow-700' :
            item.curva === 'D' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {item.curva || '-'}
          </span>
        );
      case 'custo':
        return formatCurrency(item.custo);
      case 'preco_venda':
        return formatCurrency(item.preco_venda);
      case 'margem':
        return formatPercent(item.margem);
      case 'estoque':
        return (
          <span className={item.estoque_atual <= 0 ? 'text-red-600 font-semibold' : 'text-gray-700 font-semibold'}>
            {(parseFloat(item.estoque_atual) || 0).toFixed(0)}
          </span>
        );
      case 'venda_media':
        return (parseFloat(item.venda_media) || 0).toFixed(1);
      case 'nf':
        return item.numero_nf || '-';
      default:
        return '-';
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Prioridade Reposicao</h1>
              <p className="text-orange-100 text-sm mt-1">
                Produtos que entraram via NF em {dataFormatada} - prioridade de abastecimento nas gondolas
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-white text-sm font-medium">Data Entrada:</label>
                <input
                  type="date"
                  value={dataEntrada}
                  onChange={(e) => setDataEntrada(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 [color-scheme:dark]"
                />
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar
              </button>
              <button
                onClick={exportarPDF}
                disabled={loading || itensFiltrados.length === 0}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Cards Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-xs text-gray-500 font-medium uppercase">Total de Itens</div>
              <div className="text-2xl font-bold text-gray-800 mt-1">{resumo.total}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4">
              <div className="text-xs text-red-500 font-medium uppercase">P1 - Curva A</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{resumo.prioridade1}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-4">
              <div className="text-xs text-orange-500 font-medium uppercase">P2 - Ruptura</div>
              <div className="text-2xl font-bold text-orange-600 mt-1">{resumo.prioridade2}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-yellow-200 p-4">
              <div className="text-xs text-yellow-600 font-medium uppercase">P3 - Pre-Ruptura</div>
              <div className="text-2xl font-bold text-yellow-600 mt-1">{resumo.prioridade3}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-xs text-gray-500 font-medium uppercase">P4 - Demais</div>
              <div className="text-2xl font-bold text-gray-600 mt-1">{resumo.prioridade4}</div>
            </div>
          </div>

          {/* Filtros: Tipo, Seção, Grupo, Subgrupo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Tipo:</label>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                >
                  {opcoesTipo.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Secao:</label>
                <select
                  value={filtroSecao}
                  onChange={(e) => setFiltroSecao(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                >
                  {opcoesSecao.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Grupo:</label>
                <select
                  value={filtroGrupo}
                  onChange={(e) => setFiltroGrupo(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                >
                  {opcoesGrupo.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Subgrupo:</label>
                <select
                  value={filtroSubgrupo}
                  onChange={(e) => setFiltroSubgrupo(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                >
                  {opcoesSubgrupo.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Filtros de Prioridade + Busca */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-600">Filtrar:</span>
              {[1, 2, 3, 4].map(p => {
                const config = PRIORIDADE_CONFIG[p];
                const ativo = filtros[p];
                return (
                  <button
                    key={p}
                    onClick={() => toggleFiltro(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      ativo
                        ? `${config.cor} ${config.corTexto} border-transparent shadow-sm`
                        : 'bg-gray-100 text-gray-400 border-gray-200'
                    }`}
                  >
                    P{p} - {config.label}
                  </button>
                );
              })}

              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar produto, codigo, fornecedor..."
                    className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {itensFiltrados.length} de {itens.length} itens
                </span>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">Carregando produtos...</span>
                </div>
              </div>
            ) : itensFiltrados.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <span className="text-sm text-gray-500">Nenhum produto encontrado</span>
                  <span className="text-xs text-gray-400">Verifique se houve entrada de NF em {dataFormatada}</span>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold w-10">#</th>
                      {colunas.map((col, idx) => (
                        <th
                          key={col.id}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragEnter={() => handleDragEnter(idx)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          className={`px-3 py-2.5 text-xs font-semibold ${col.w} cursor-grab active:cursor-grabbing select-none
                            ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                          `}
                          title="Arraste para reordenar"
                        >
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3 h-3 opacity-40" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
                            </svg>
                            {col.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let globalIdx = 0;
                      const rows = [];
                      itensAgrupadosPorSecao.forEach((itensSecao, secaoNome) => {
                        // Barra de seção
                        rows.push(
                          <tr key={`secao-${secaoNome}`}>
                            <td colSpan={colunas.length + 1} className="px-0 py-0">
                              <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 flex items-center gap-3">
                                <span className="text-white font-bold text-xs uppercase tracking-wide">{secaoNome}</span>
                                <span className="text-orange-100 text-[10px] font-medium">{itensSecao.length} {itensSecao.length === 1 ? 'item' : 'itens'}</span>
                              </div>
                            </td>
                          </tr>
                        );
                        // Itens da seção
                        itensSecao.forEach((item, localIdx) => {
                          globalIdx++;
                          rows.push(
                            <tr
                              key={`${item.codigo}-${globalIdx}`}
                              className={`border-b border-gray-100 hover:bg-orange-50/50 transition-colors ${localIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                            >
                              <td className="px-3 py-2 text-gray-400 text-xs">{globalIdx}</td>
                              {colunas.map((col) => (
                                <td
                                  key={col.id}
                                  className={`px-3 py-2 text-xs text-gray-600 ${
                                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                                  }`}
                                >
                                  {renderCell(item, col.id, globalIdx)}
                                </td>
                              ))}
                            </tr>
                          );
                        });
                      });
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
