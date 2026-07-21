import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import RadarLoading from '../components/RadarLoading';
import api from '../utils/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Tabs removidas por enquanto - usando apenas Geral

const INITIAL_COLUMNS = [
  { id: 'META', header: 'Meta', headerDesp: 'Meta', minW: 130 },
  { id: 'PCT_META', header: '% Receitas', headerDesp: '% Despesas', minW: 100 },
  { id: 'VAL_ABERTO', header: 'Val. Aberto', headerDesp: 'Val. Aberto', minW: 130 },
  { id: 'VAL_QUITADO', header: 'Val. Quitado', headerDesp: 'Val. Quitado', minW: 130 },
  { id: 'PCT_QUIT', header: '% Receitas', headerDesp: '% Despesas', minW: 100 },
  { id: 'VAL_REALIZADO', header: 'Quitado + Aberto', headerDesp: 'Quitado + Aberto', minW: 150 },
  { id: 'PCT_REAL', header: '% Receitas', headerDesp: '% Despesas', minW: 100 },
  { id: 'VAL_DIFERENCA', header: 'Val. Diferença', headerDesp: 'Val. Diferença', minW: 130 },
];

const STORAGE_KEY = 'demonstrativo_caixa_columns_v3';

function formatCurrency(val) {
  if (val == null || isNaN(val)) return '-';
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (val < 0) return `(${formatted})`;
  return formatted;
}

function formatPercent(val) {
  if (val == null || isNaN(val) || val === 0) return '';
  return val.toFixed(2).replace('.', ',') + '%';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch { return dateStr; }
}

// Render cell value based on column id for a category row
// % columns are contextual: show % Receitas for receita rows, % Despesas for despesa rows
function getCatCellValue(colId, cat, totais) {
  // % Despesas = valor da despesa / total receitas (não total despesas)
  const metaPct = cat.IS_RECEITA
    ? (totais.totalMetaReceitas ? (cat.META / totais.totalMetaReceitas * 100) : 0)
    : (totais.totalMetaReceitas ? (cat.META / totais.totalMetaReceitas * 100) : 0);
  const realPct = cat.IS_RECEITA
    ? (totais.totalReceitas ? (cat.VAL_REALIZADO / totais.totalReceitas * 100) : 0)
    : (totais.totalReceitas ? (cat.VAL_REALIZADO / totais.totalReceitas * 100) : 0);
  const quitPct = cat.IS_RECEITA
    ? (totais.totalQuitadoReceitas ? (cat.VAL_QUITADO / totais.totalQuitadoReceitas * 100) : 0)
    : (totais.totalQuitadoReceitas ? (cat.VAL_QUITADO / totais.totalQuitadoReceitas * 100) : 0);

  switch (colId) {
    case 'META': return formatCurrency(cat.META);
    case 'PCT_META': return formatPercent(metaPct);
    case 'VAL_ABERTO': return formatCurrency(cat.VAL_ABERTO);
    case 'VAL_QUITADO': return formatCurrency(cat.VAL_QUITADO);
    case 'PCT_QUIT': return formatPercent(quitPct);
    case 'VAL_REALIZADO': return formatCurrency(cat.VAL_REALIZADO);
    case 'PCT_REAL': return formatPercent(realPct);
    case 'VAL_DIFERENCA': return formatCurrency(cat.VAL_DIFERENCA);
    default: return '';
  }
}

function getSubCellValue(colId, sub, cat, totais) {
  // % Despesas = valor da despesa / total receitas (não total despesas)
  const subMetaPct = cat.IS_RECEITA
    ? (totais.totalMetaReceitas ? (sub.META / totais.totalMetaReceitas * 100) : 0)
    : (totais.totalMetaReceitas ? (sub.META / totais.totalMetaReceitas * 100) : 0);
  const subRealPct = cat.IS_RECEITA
    ? (totais.totalReceitas ? (sub.VAL_REALIZADO / totais.totalReceitas * 100) : 0)
    : (totais.totalReceitas ? (sub.VAL_REALIZADO / totais.totalReceitas * 100) : 0);
  const subQuitPct = cat.IS_RECEITA
    ? (totais.totalQuitadoReceitas ? (sub.VAL_QUITADO / totais.totalQuitadoReceitas * 100) : 0)
    : (totais.totalQuitadoReceitas ? (sub.VAL_QUITADO / totais.totalQuitadoReceitas * 100) : 0);

  switch (colId) {
    case 'META': return formatCurrency(sub.META);
    case 'PCT_META': return formatPercent(subMetaPct);
    case 'VAL_ABERTO': return formatCurrency(sub.VAL_ABERTO);
    case 'VAL_QUITADO': return formatCurrency(sub.VAL_QUITADO);
    case 'PCT_QUIT': return formatPercent(subQuitPct);
    case 'VAL_REALIZADO': return formatCurrency(sub.VAL_REALIZADO);
    case 'PCT_REAL': return formatPercent(subRealPct);
    case 'VAL_DIFERENCA': return formatCurrency(sub.VAL_DIFERENCA);
    default: return '';
  }
}

function getTotalCellValue(colId, totais, type) {
  // type: 'receitas' | 'despesas' | 'saldo'
  if (type === 'receitas') {
    switch (colId) {
      case 'META': return formatCurrency(totais.totalMetaReceitas);
      case 'PCT_META': return '100,00%';
      case 'VAL_ABERTO': return formatCurrency(totais.totalAbertoReceitas);
      case 'VAL_QUITADO': return formatCurrency(totais.totalQuitadoReceitas);
      case 'PCT_QUIT': return '100,00%';
      case 'VAL_REALIZADO': return formatCurrency(totais.totalReceitas);
      case 'PCT_REAL': return '100,00%';
      case 'VAL_DIFERENCA': return formatCurrency((totais.totalMetaReceitas || 0) - (totais.totalReceitas || 0));
      default: return '';
    }
  }
  if (type === 'despesas') {
    const pctMeta = totais.totalMetaReceitas ? ((totais.totalMetaDespesas || 0) / totais.totalMetaReceitas * 100) : 0;
    const pctQuit = totais.totalQuitadoReceitas ? ((totais.totalQuitadoDespesas || 0) / totais.totalQuitadoReceitas * 100) : 0;
    const pctReal = totais.totalReceitas ? ((totais.totalDespesas || 0) / totais.totalReceitas * 100) : 0;
    switch (colId) {
      case 'META': return formatCurrency(totais.totalMetaDespesas);
      case 'PCT_META': return formatPercent(pctMeta);
      case 'VAL_ABERTO': return formatCurrency(totais.totalAbertoDespesas);
      case 'VAL_QUITADO': return formatCurrency(totais.totalQuitadoDespesas);
      case 'PCT_QUIT': return formatPercent(pctQuit);
      case 'VAL_REALIZADO': return formatCurrency(totais.totalDespesas);
      case 'PCT_REAL': return formatPercent(pctReal);
      case 'VAL_DIFERENCA': return formatCurrency((totais.totalMetaDespesas || 0) - (totais.totalDespesas || 0));
      default: return '';
    }
  }
  // saldo
  switch (colId) {
    case 'META': return formatCurrency((totais.totalMetaReceitas || 0) - (totais.totalMetaDespesas || 0));
    case 'VAL_ABERTO': return formatCurrency((totais.totalAbertoReceitas || 0) - (totais.totalAbertoDespesas || 0));
    case 'VAL_QUITADO': return formatCurrency((totais.totalQuitadoReceitas || 0) - (totais.totalQuitadoDespesas || 0));
    case 'VAL_REALIZADO': return formatCurrency(totais.saldo);
    case 'VAL_DIFERENCA': return formatCurrency(((totais.totalMetaReceitas || 0) - (totais.totalMetaDespesas || 0)) - (totais.saldo || 0));
    default: return '';
  }
}

// Demonstrativo montado pelas amarrações da Conciliação (modo Direto Manual)
/** Setinha de ordenação que mora DENTRO da linha do grupo (verde/laranja). */
function SetaOrdem({ ativo, dir }) {
  return (
    <span className={`ml-1 text-xs ${ativo ? 'opacity-100' : 'opacity-40'}`}>
      {ativo ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
}

function DemonstrativoManual({ data, loading }) {
  // Hooks antes de qualquer return — senão a ordem quebra entre renders.
  // Ordenação é POR GRUPO: cada faixa verde/laranja ordena só as contas dela.
  const [ordemPorGrupo, setOrdemPorGrupo] = useState({});
  const [abertos, setAbertos] = useState({});     // quais contas estão com o (+) aberto
  const [ordemLanc, setOrdemLanc] = useState({}); // ordenação dentro de cada (+)

  const handleSortLanc = (chave, col) => {
    setOrdemLanc((prev) => {
      const atual = prev[chave];
      if (!atual || atual.col !== col) return { ...prev, [chave]: { col, dir: 'asc' } };
      if (atual.dir === 'asc') return { ...prev, [chave]: { col, dir: 'desc' } };
      const { [chave]: _, ...resto } = prev;
      return resto;   // 3º clique volta pro padrão (data desc)
    });
  };

  const ordenarLancamentos = (lancamentos, chave) => {
    const ordem = ordemLanc[chave];
    if (!ordem) return lancamentos;
    const mult = ordem.dir === 'asc' ? 1 : -1;
    return [...lancamentos].sort((a, b) => {
      if (ordem.col === 'data') {
        return mult * (new Date(a.data || 0).getTime() - new Date(b.data || 0).getTime());
      }
      if (ordem.col === 'valor') return mult * ((a.valor || 0) - (b.valor || 0));
      return mult * String(a.descricao || '').localeCompare(String(b.descricao || ''), 'pt-BR');
    });
  };

  // 1º clique A→Z, 2º Z→A, 3º volta pra ordem original (valor desc)
  const handleSort = (grupoNome, col) => {
    setOrdemPorGrupo((prev) => {
      const atual = prev[grupoNome];
      if (!atual || atual.col !== col) return { ...prev, [grupoNome]: { col, dir: 'asc' } };
      if (atual.dir === 'asc') return { ...prev, [grupoNome]: { col, dir: 'desc' } };
      const { [grupoNome]: _, ...resto } = prev;
      return resto;
    });
  };

  const ordenarContas = (contas, grupoNome) => {
    const ordem = ordemPorGrupo[grupoNome];
    if (!ordem) return contas;
    const mult = ordem.dir === 'asc' ? 1 : -1;
    return [...contas].sort((a, b) => {
      if (ordem.col === 'nome') {
        return mult * String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      }
      // 'valor' e 'pct' ordenam igual — a % é o valor dividido pelo mesmo total
      return mult * ((a.valor || 0) - (b.valor || 0));
    });
  };

  if (loading) return <div className="flex justify-center py-20"><RadarLoading /></div>;
  if (!data) return <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-400"><p className="text-lg font-medium">Carregando o extrato...</p></div>;

  const grupos = data.grupos || [];
  const t = data.totais || {};
  const naoClass = data.naoClassificado || { total: 0, qtd: 0 };
  // % sobre o total de Entradas (Receitas) — análise vertical
  const pct = (v) => (t.totalReceitas ? (v / t.totalReceitas * 100) : null);

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-sm text-green-700 font-medium">Receitas</div>
          <div className="text-xl font-bold text-green-800 mt-1">R$ {formatCurrency(t.totalReceitas)}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="text-sm text-orange-700 font-medium">Despesas</div>
          <div className="text-xl font-bold text-orange-800 mt-1">R$ {formatCurrency(t.totalDespesas)}</div>
        </div>
        <div className={`${(t.saldo || 0) >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-3`}>
          <div className={`text-sm font-medium ${(t.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>Saldo</div>
          <div className={`text-xl font-bold mt-1 ${(t.saldo || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>R$ {formatCurrency(t.saldo)}</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-sm text-gray-600 font-medium">Não Classificado</div>
          <div className="text-xl font-bold text-gray-700 mt-1">R$ {formatCurrency(naoClass.total)}</div>
          <div className="text-xs text-gray-400">{naoClass.qtd} lançamento(s)</div>
        </div>
      </div>

      {/* Tabela agrupada */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <colgroup>
            <col style={{ width: 460 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 100 }} />
            <col />
          </colgroup>
          <thead>
            <tr className="bg-gray-700 text-white">
              <th className="text-left py-2 px-3 font-semibold">Movimento (Manual)</th>
              <th className="text-right py-2 px-3 font-semibold">Valor</th>
              <th className="text-right py-2 px-3 font-semibold">% Entradas</th>
              <th className="bg-gray-700"></th>
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && naoClass.total === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nenhuma amarração no período. Amarre linhas na Conciliação (Direto Manual).</td></tr>
            )}
            {grupos.map((g, gi) => {
              const ordem = ordemPorGrupo[g.nome];
              const hover = g.fora_dre
                ? 'hover:bg-gray-200'
                : g.is_receita ? 'hover:bg-green-200' : 'hover:bg-orange-200';

              return (
              <React.Fragment key={g.nome + gi}>
                {/* A própria faixa do grupo é o controle: clicar em cada célula
                    ordena as contas DAQUELE grupo por aquela coluna. */}
                <tr className={
                  g.fora_dre
                    ? 'bg-gray-100 text-gray-500'      // fora do cálculo: sai de cena
                    : g.is_receita ? 'bg-green-100 text-green-900' : 'bg-orange-100 text-orange-900'
                }>
                  <td
                    onClick={() => handleSort(g.nome, 'nome')}
                    title="Ordenar as contas deste grupo por nome"
                    className={`py-1.5 px-3 font-bold cursor-pointer select-none ${hover}`}
                  >
                    {g.nome}
                    {g.fora_dre && (
                      <span className="ml-2 text-[10px] font-normal bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                        fora do cálculo
                      </span>
                    )}
                    <SetaOrdem ativo={ordem?.col === 'nome'} dir={ordem?.dir} />
                  </td>
                  <td
                    onClick={() => handleSort(g.nome, 'valor')}
                    title="Ordenar as contas deste grupo por valor"
                    className={`py-1.5 px-3 text-right font-bold cursor-pointer select-none ${hover}`}
                  >
                    R$ {formatCurrency(g.total)}
                    <SetaOrdem ativo={ordem?.col === 'valor'} dir={ordem?.dir} />
                  </td>
                  <td
                    onClick={() => handleSort(g.nome, 'pct')}
                    title="Ordenar as contas deste grupo por %"
                    className={`py-1.5 px-3 text-right font-bold cursor-pointer select-none ${hover}`}
                  >
                    {formatPercent(pct(g.total))}
                    <SetaOrdem ativo={ordem?.col === 'pct'} dir={ordem?.dir} />
                  </td>
                  <td></td>
                </tr>

                {ordenarContas(g.contas || [], g.nome).map((c, ci) => {
                  const chave = `${g.nome}|${c.id ?? ci}`;
                  const aberto = !!abertos[chave];
                  const lancamentos = c.lancamentos || [];

                  return (
                    <React.Fragment key={chave}>
                      <tr
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setAbertos((a) => ({ ...a, [chave]: !a[chave] }))}
                      >
                        <td className="py-1.5 px-3 pl-6 text-gray-700">
                          <span className={`inline-flex items-center justify-center w-4 h-4 mr-1.5 rounded border text-[11px] font-bold leading-none ${
                            aberto
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'bg-white border-gray-300 text-gray-500'
                          }`}>
                            {aberto ? '−' : '+'}
                          </span>
                          {c.nome} <span className="text-xs text-gray-400">({c.qtd})</span>
                        </td>
                        <td className={`py-1.5 px-3 text-right font-semibold ${g.is_receita ? 'text-green-700' : 'text-red-700'}`}>R$ {formatCurrency(c.valor)}</td>
                        <td className="py-1.5 px-3 text-right text-gray-500">{formatPercent(pct(c.valor))}</td>
                        <td></td>
                      </tr>

                      {aberto && (
                        <tr>
                          <td colSpan={4} className="bg-gray-50 px-3 py-2 pl-12 border-b border-gray-200">
                            {lancamentos.length === 0 ? (
                              <div className="text-xs text-gray-400 py-1">Nenhum lançamento detalhado.</div>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 border-b border-gray-200">
                                    <th
                                      onClick={() => handleSortLanc(chave, 'data')}
                                      className="text-left py-1 font-medium w-24 cursor-pointer select-none hover:text-orange-600"
                                    >
                                      Data
                                      <SetaOrdem ativo={ordemLanc[chave]?.col === 'data'} dir={ordemLanc[chave]?.dir} />
                                    </th>
                                    <th
                                      onClick={() => handleSortLanc(chave, 'descricao')}
                                      className="text-left py-1 font-medium cursor-pointer select-none hover:text-orange-600"
                                    >
                                      Descrição
                                      <SetaOrdem ativo={ordemLanc[chave]?.col === 'descricao'} dir={ordemLanc[chave]?.dir} />
                                    </th>
                                    <th
                                      onClick={() => handleSortLanc(chave, 'valor')}
                                      className="text-right py-1 font-medium w-32 cursor-pointer select-none hover:text-orange-600"
                                    >
                                      Valor
                                      <SetaOrdem ativo={ordemLanc[chave]?.col === 'valor'} dir={ordemLanc[chave]?.dir} />
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ordenarLancamentos(lancamentos, chave).map((l, li) => (
                                    <tr key={li} className="border-b border-gray-100 last:border-0">
                                      <td className="py-1 text-gray-600 whitespace-nowrap">
                                        {l.data ? new Date(l.data).toLocaleDateString('pt-BR') : '—'}
                                      </td>
                                      <td className="py-1 text-gray-700">{l.descricao || '—'}</td>
                                      <td className={`py-1 text-right font-semibold ${g.is_receita ? 'text-green-700' : 'text-red-700'}`}>
                                        R$ {formatCurrency(l.valor)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
              );
            })}
            {naoClass.total > 0 && (
              <>
                <tr
                  className="bg-red-100 text-red-900 cursor-pointer hover:bg-red-200"
                  onClick={() => setAbertos((a) => ({ ...a, __naoClass: !a.__naoClass }))}
                  title="Clique para ver o que está sem classificação"
                >
                  <td className="py-1.5 px-3 font-bold">
                    <span className={`inline-flex items-center justify-center w-4 h-4 mr-1.5 rounded border text-[11px] font-bold leading-none ${
                      abertos.__naoClass ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-red-300 text-red-600'
                    }`}>
                      {abertos.__naoClass ? '−' : '+'}
                    </span>
                    ⚠️ NÃO CLASSIFICADO <span className="text-xs">({naoClass.qtd})</span>
                  </td>
                  <td className="py-1.5 px-3 text-right font-bold">R$ {formatCurrency(naoClass.total)}</td>
                  <td className="py-1.5 px-3 text-right font-bold">{formatPercent(pct(naoClass.total))}</td>
                  <td></td>
                </tr>

                {abertos.__naoClass && (
                  <tr>
                    <td colSpan={4} className="bg-red-50 px-3 py-2 pl-12 border-b border-red-200">
                      <div className="text-xs text-red-800 mb-2">
                        Estes lançamentos não têm conta amarrada. Classifique-os na
                        <strong> Conciliação (Direto Manual)</strong> — lembre de trocar
                        a <strong>conta</strong> lá, porque a Conciliação mostra uma conta por vez.
                      </div>
                      <div className="max-h-96 overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-red-50">
                            <tr className="text-gray-600 border-b border-red-200">
                              <th
                                onClick={() => handleSortLanc('__naoClass', 'data')}
                                className="text-left py-1 font-medium w-24 cursor-pointer select-none hover:text-orange-600"
                              >
                                Data<SetaOrdem ativo={ordemLanc.__naoClass?.col === 'data'} dir={ordemLanc.__naoClass?.dir} />
                              </th>
                              <th
                                onClick={() => handleSortLanc('__naoClass', 'descricao')}
                                className="text-left py-1 font-medium cursor-pointer select-none hover:text-orange-600"
                              >
                                Descrição<SetaOrdem ativo={ordemLanc.__naoClass?.col === 'descricao'} dir={ordemLanc.__naoClass?.dir} />
                              </th>
                              <th className="text-left py-1 font-medium w-44">Conta bancária</th>
                              <th
                                onClick={() => handleSortLanc('__naoClass', 'valor')}
                                className="text-right py-1 font-medium w-32 cursor-pointer select-none hover:text-orange-600"
                              >
                                Valor<SetaOrdem ativo={ordemLanc.__naoClass?.col === 'valor'} dir={ordemLanc.__naoClass?.dir} />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ordenarLancamentos(naoClass.lancamentos || [], '__naoClass').map((l, li) => (
                              <tr key={li} className="border-b border-red-100 last:border-0">
                                <td className="py-1 text-gray-600 whitespace-nowrap">
                                  {l.data ? new Date(l.data).toLocaleDateString('pt-BR') : '—'}
                                </td>
                                <td className="py-1 text-gray-700">{l.descricao || '—'}</td>
                                <td className="py-1 text-gray-500">{l.banco || '—'}</td>
                                <td className={`py-1 text-right font-semibold ${l.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                                  R$ {formatCurrency(l.valor)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DemonstrativoCaixa() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  // Tabs removidas - sempre Geral
  const [regime, setRegime] = useState('caixa');
  const [incluirMovBanco, setIncluirMovBanco] = useState('sim');
  // Modo: 'sistema' (ERP) | 'manual' (amarrações do extrato)
  const [modo, setModo] = useState('sistema');
  const [manualData, setManualData] = useState(null);
  const [loadingManual, setLoadingManual] = useState(false);
  const [manualBankId, setManualBankId] = useState('');   // '' = todas as contas
  const [contasManual, setContasManual] = useState([]);
  const [considerarEntradaBancos, setConsiderarEntradaBancos] = useState(false);
  const [entradaBancosTotal, setEntradaBancosTotal] = useState(0);
  const [entradaBancosList, setEntradaBancosList] = useState([]);
  const [loadingBancos, setLoadingBancos] = useState(false);
  const [expandedBancos, setExpandedBancos] = useState(false);

  // Datas livres
  const now = new Date();
  const mesStr = String(now.getMonth() + 1).padStart(2, '0');
  const anoStr = String(now.getFullYear());
  const diaStr = String(now.getDate()).padStart(2, '0');
  const defaultInicio = `${anoStr}-${mesStr}-01`;
  const defaultFim = `${anoStr}-${mesStr}-${diaStr}`;

  const [dataInicio, setDataInicio] = useState(defaultInicio);
  const [dataFim, setDataFim] = useState(defaultFim);

  // Colunas com ordem persistida
  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const validIds = new Set(INITIAL_COLUMNS.map(c => c.id));
        const filtered = parsed.filter(c => validIds.has(c.id));
        if (filtered.length === INITIAL_COLUMNS.length) return filtered;
      }
    } catch {}
    return INITIAL_COLUMNS;
  });

  // Drag state
  const dragColRef = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Persistir ordem
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  // Painel de detalhamento de títulos
  const [detalhePainel, setDetalhePainel] = useState(null); // { codCategoria, codSubcategoria, desCategoria, desSubcategoria }
  const [detalheStatus, setDetalheStatus] = useState('todos'); // 'aberto', 'quitado', 'todos'
  const [detalheTitulos, setDetalheTitulos] = useState(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [expandedTitulo, setExpandedTitulo] = useState(null);
  const [itensNF, setItensNF] = useState([]);
  const [itensLoading, setItensLoading] = useState(false);

  // Buscar dados principais
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { dataInicio, dataFim, regime, incluirMovBanco };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const res = await api.get('/demonstrativo-caixa/dados', { params });
      if (res.data?.success) {
        setData(res.data);
        const exp = {};
        for (const cat of (res.data.categorias || [])) exp[cat.COD_CATEGORIA] = true;
        setExpandedCats(exp);
      }
    } catch (err) {
      console.error('Erro ao buscar demonstrativo:', err);
      toast.error('Erro ao buscar dados do demonstrativo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [dataInicio, dataFim, regime, lojaSelecionada, incluirMovBanco]);

  // Modo Manual: monta o demonstrativo a partir das amarrações do extrato
  const fetchManual = async () => {
    setLoadingManual(true);
    try {
      // Antes daqui ficava a conta 130075973 CHUMBADA: o extrato das outras
      // (ADM COMERCIAL, Tricard) nunca subia pro demonstrativo e não havia
      // como perceber — a tela não mostrava de que conta era o dado.
      let contas = contasManual;
      if (!contas.length) {
        const accRes = await api.get('/bank-accounts');
        contas = (accRes.data?.data || []).filter(a => a.ativo);
        setContasManual(contas);
      }

      // '' = todas as contas (padrão)
      const ids = manualBankId ? [manualBankId] : contas.map(a => a.id);

      const params = { dtaInicio: dataInicio, dtaFim: dataFim };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      if (ids.length) params.bankIds = ids.join(',');
      const res = await api.get('/conciliacao/demonstrativo-manual', { params });
      if (res.data?.success) setManualData(res.data);
      else toast.error(res.data?.message || 'Falha ao montar demonstrativo manual');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao montar demonstrativo manual');
    } finally {
      setLoadingManual(false);
    }
  };

  useEffect(() => {
    if (modo === 'manual') fetchManual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, dataInicio, dataFim, lojaSelecionada, manualBankId]);

  // Buscar entradas dos bancos quando flag ativada
  const fetchEntradaBancos = async () => {
    setLoadingBancos(true);
    try {
      const ini = dataInicio; // YYYY-MM-DD
      const fim = dataFim;   // YYYY-MM-DD
      console.log('[DemostrativoCaixa] Buscando entradas bancos:', ini, 'a', fim);
      // Buscar lista de bancos cadastrados
      const banksRes = await api.get('/bank-accounts');
      const banks = Array.isArray(banksRes.data) ? banksRes.data : (banksRes.data?.banks || banksRes.data?.data || []);
      console.log('[DemostrativoCaixa] Bancos:', banks.length, JSON.stringify(banks.map(b => ({ id: b.id, name: b.name }))));
      let totalCredito = 0;
      // Buscar extrato de cada banco
      const promises = banks.map(async (bank) => {
        try {
          const res = await api.get('/santander/extrato-completo', { params: { initialDate: ini, finalDate: fim, bankId: bank.id } });
          const items = res.data?.items || res.data?.data || [];
          return items
            .filter(i => i.creditDebitType === 'CREDITO')
            .reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);
        } catch { return 0; }
      });
      if (banks.length > 0) {
        const results = await Promise.all(promises);
        totalCredito = results.reduce((acc, v) => acc + v, 0);
        setEntradaBancosList(banks.map((b, i) => ({ id: b.id, name: b.name || b.bank_name || `Banco ${i+1}`, valor: results[i] })));
      } else {
        // Fallback: buscar sem bankId (conta padrão)
        const res = await api.get('/santander/extrato-completo', { params: { initialDate: ini, finalDate: fim } });
        const items = res.data?.items || res.data?.data || [];
        totalCredito = items
          .filter(i => i.creditDebitType === 'CREDITO')
          .reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);
      }
      setEntradaBancosTotal(Math.round(totalCredito * 100) / 100);
    } catch (err) {
      console.error('Erro ao buscar entradas bancos:', err);
      setEntradaBancosTotal(0);
    } finally {
      setLoadingBancos(false);
    }
  };

  useEffect(() => {
    if (considerarEntradaBancos) fetchEntradaBancos();
    else setEntradaBancosTotal(0);
  }, [considerarEntradaBancos, dataInicio, dataFim]);

  // Buscar títulos do painel lateral
  const fetchTitulos = async () => {
    if (!detalhePainel) return;
    setDetalheLoading(true);
    try {
      const params = {
        codCategoria: detalhePainel.codCategoria,
        codSubcategoria: detalhePainel.codSubcategoria,
        dataInicio,
        dataFim,
        regime,
        status: detalheStatus,
      };
      if (lojaSelecionada) params.codLoja = lojaSelecionada;
      const res = await api.get('/demonstrativo-caixa/titulos', { params });
      if (res.data?.success) {
        setDetalheTitulos(res.data);
      }
    } catch (err) {
      console.error('Erro ao buscar títulos:', err);
      toast.error('Erro ao buscar títulos');
    } finally {
      setDetalheLoading(false);
    }
  };

  useEffect(() => {
    if (detalhePainel) fetchTitulos();
  }, [detalhePainel, detalheStatus]);

  // Buscar itens NF ao expandir título
  const fetchItensNF = async (titulo) => {
    if (!titulo.NUM_NF) {
      setItensNF([]);
      return;
    }
    setItensLoading(true);
    try {
      const res = await api.get('/demonstrativo-caixa/titulos/itens-nf', {
        params: {
          numNf: titulo.NUM_NF,
          numSerieNf: titulo.NUM_SERIE_NF || '',
          codParceiro: titulo.COD_PARCEIRO,
        }
      });
      if (res.data?.success) {
        setItensNF(res.data.itens || []);
      }
    } catch (err) {
      console.error('Erro ao buscar itens NF:', err);
      setItensNF([]);
    } finally {
      setItensLoading(false);
    }
  };

  const handleTituloClick = (titulo) => {
    if (expandedTitulo === titulo.NUM_REGISTRO) {
      setExpandedTitulo(null);
      setItensNF([]);
    } else {
      setExpandedTitulo(titulo.NUM_REGISTRO);
      fetchItensNF(titulo);
    }
  };

  const abrirDetalhe = (cat, sub) => {
    setDetalhePainel({
      codCategoria: cat.COD_CATEGORIA,
      codSubcategoria: sub ? sub.COD_SUBCATEGORIA : null,
      desCategoria: cat.DES_CATEGORIA,
      desSubcategoria: sub ? sub.DES_SUBCATEGORIA : null,
    });
    setDetalheStatus('todos');
    setExpandedTitulo(null);
    setItensNF([]);
  };

  const fecharDetalhe = () => {
    setDetalhePainel(null);
    setDetalheTitulos(null);
    setExpandedTitulo(null);
    setItensNF([]);
  };

  const toggleCat = (codCat) => setExpandedCats(prev => ({ ...prev, [codCat]: !prev[codCat] }));
  const expandAll = () => {
    const exp = {};
    for (const cat of (data?.categorias || [])) exp[cat.COD_CATEGORIA] = true;
    setExpandedCats(exp);
  };
  const collapseAll = () => setExpandedCats({});

  const totais = data?.totais || {};

  // Exportar PDF
  const handleExportPDF = () => {
    if (!data) {
      toast.error('Não há dados para exportar');
      return;
    }
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const cats = data.categorias || [];
    const receitas = cats.filter(c => c.IS_RECEITA);
    const despesas = cats.filter(c => c.IS_DESPESA);
    const custosArr = despesas.filter(c => c.DES_CATEGORIA && c.DES_CATEGORIA.toUpperCase().includes('CUSTO'));
    const demaisDespesas = despesas.filter(c => !(c.DES_CATEGORIA && c.DES_CATEGORIA.toUpperCase().includes('CUSTO')));

    // Header
    doc.setFontSize(14);
    doc.text('DEMONSTRATIVO DE CAIXA', 14, 12);
    doc.setFontSize(9);
    doc.text(`Regime: ${regime === 'caixa' ? 'Caixa' : 'Competência'} | Período: ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`, 14, 18);
    if (lojaSelecionada?.des_loja) doc.text(`Loja: ${lojaSelecionada.des_loja}`, 14, 23);

    const colHeaders = ['Movimento', ...columns.map(c => c.header)];

    const fmtVal = (v) => v != null && !isNaN(v) ? (Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '-';
    const fmtPct = (v) => v != null && !isNaN(v) && v !== 0 ? (v.toFixed(2).replace('.', ',') + '%') : '';

    const buildCatRow = (cat) => {
      return [cat.DES_CATEGORIA, ...columns.map(col => getCatCellValue(col.id, cat, totais))];
    };
    const buildSubRow = (sub, cat) => {
      return ['   ' + sub.DES_SUBCATEGORIA, ...columns.map(col => getSubCellValue(col.id, sub, cat, totais))];
    };

    const rows = [];
    const rowStyles = {};

    // Receitas (respeita estado aberto/fechado)
    receitas.forEach(cat => {
      const idx = rows.length;
      rows.push(buildCatRow(cat));
      rowStyles[idx] = { fillColor: [220, 252, 231] }; // green-100
      if (expandedCats[cat.COD_CATEGORIA]) {
        (cat.subcategorias || []).forEach(sub => rows.push(buildSubRow(sub, cat)));
      }
    });

    // Total Receitas
    let trIdx = rows.length;
    rows.push(['TOTAL RECEITAS', ...columns.map(col => getTotalCellValue(col.id, totais, 'receitas'))]);
    rowStyles[trIdx] = { fillColor: [187, 247, 208], fontStyle: 'bold' }; // green-200

    // Custos (respeita estado aberto/fechado)
    custosArr.forEach(cat => {
      const idx = rows.length;
      rows.push(buildCatRow(cat));
      rowStyles[idx] = { fillColor: [233, 213, 255] }; // purple-200
      if (expandedCats[cat.COD_CATEGORIA]) {
        (cat.subcategorias || []).forEach(sub => rows.push(buildSubRow(sub, cat)));
      }
    });

    // Despesas Operacionais (respeita estado aberto/fechado)
    demaisDespesas.forEach(cat => {
      const idx = rows.length;
      rows.push(buildCatRow(cat));
      rowStyles[idx] = { fillColor: [255, 237, 213] }; // orange-100
      if (expandedCats[cat.COD_CATEGORIA]) {
        (cat.subcategorias || []).forEach(sub => rows.push(buildSubRow(sub, cat)));
      }
    });

    // Subtotal Desp. Operacionais
    if (demaisDespesas.length > 0) {
      const subDespOp = {
        META: demaisDespesas.reduce((s, c) => s + (c.META || 0), 0),
        VAL_ABERTO: demaisDespesas.reduce((s, c) => s + (c.VAL_ABERTO || 0), 0),
        VAL_QUITADO: demaisDespesas.reduce((s, c) => s + (c.VAL_QUITADO || 0), 0),
        VAL_REALIZADO: demaisDespesas.reduce((s, c) => s + (c.VAL_REALIZADO || 0), 0),
        VAL_DIFERENCA: demaisDespesas.reduce((s, c) => s + (c.VAL_DIFERENCA || 0), 0),
        IS_RECEITA: false, IS_DESPESA: true,
      };
      let sdIdx = rows.length;
      rows.push(['TOTAL DESP. OPERACIONAIS', ...columns.map(col => getCatCellValue(col.id, subDespOp, totais))]);
      rowStyles[sdIdx] = { fillColor: [254, 215, 170], fontStyle: 'bold' }; // orange-200
    }

    // Total Despesas (Custos + Operacionais)
    let tdIdx = rows.length;
    rows.push(['TOTAL DESPESAS', ...columns.map(col => getTotalCellValue(col.id, totais, 'despesas'))]);
    rowStyles[tdIdx] = { fillColor: [216, 180, 254], fontStyle: 'bold' }; // purple-300

    // Saldo
    let sIdx = rows.length;
    rows.push(['SALDO (Receitas - Despesas)', ...columns.map(col => getTotalCellValue(col.id, totais, 'saldo'))]);
    rowStyles[sIdx] = { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' };

    autoTable(doc, {
      head: [colHeaders],
      body: rows,
      startY: lojaSelecionada?.des_loja ? 27 : 22,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 65 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          const style = rowStyles[hookData.row.index];
          if (style) {
            if (style.fillColor) hookData.cell.styles.fillColor = style.fillColor;
            if (style.textColor) hookData.cell.styles.textColor = style.textColor;
            if (style.fontStyle) hookData.cell.styles.fontStyle = style.fontStyle;
          }
          // Alinhar valores à direita (todas exceto coluna 0)
          if (hookData.column.index > 0) {
            hookData.cell.styles.halign = 'right';
          }
        }
      },
    });

    doc.save(`demonstrativo-caixa-${dataInicio}-a-${dataFim}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  // Drag & Drop handlers
  const handleDragStart = (e, colId) => {
    dragColRef.current = colId;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (dragColRef.current && dragColRef.current !== colId) setDragOverCol(colId);
  };
  const handleDragLeave = () => setDragOverCol(null);
  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    setDragOverCol(null);
    const srcId = dragColRef.current;
    if (!srcId || srcId === targetColId) return;
    setColumns(prev => {
      const arr = [...prev];
      const srcIdx = arr.findIndex(c => c.id === srcId);
      const tgtIdx = arr.findIndex(c => c.id === targetColId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      const [moved] = arr.splice(srcIdx, 1);
      arr.splice(tgtIdx, 0, moved);
      return arr;
    });
    dragColRef.current = null;
  };
  const handleDragEnd = () => { dragColRef.current = null; setDragOverCol(null); };

  // Helper: coluna "real" (Val. Quitado) com destaque visual
  const realColClass = (colId) => colId === 'VAL_QUITADO' ? 'bg-gray-800/5 font-semibold' : '';
  const realColHeaderClass = (colId) => colId === 'VAL_QUITADO' ? 'bg-gray-600' : '';

  // Helper: categoria de Custos (CMV) com cor roxa para distinguir
  const isCustos = (cat) => cat.DES_CATEGORIA && cat.DES_CATEGORIA.toUpperCase().includes('CUSTO');

  // Helper: extra class for VAL_DIFERENCA
  const getCatDifClass = (colId, cat) => {
    if (colId === 'VAL_DIFERENCA') {
      if (cat.VAL_DIFERENCA < 0) return 'text-red-600';
      if (cat.VAL_DIFERENCA > 0) return 'text-green-700';
    }
    return '';
  };
  const getSubDifClass = (colId, sub) => {
    if (colId === 'VAL_DIFERENCA') {
      if (sub.VAL_DIFERENCA < 0) return 'text-red-600 font-medium';
      if (sub.VAL_DIFERENCA > 0) return 'text-green-700 font-medium';
    }
    return '';
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <main className="flex-1 overflow-auto print:overflow-visible">
        {/* Header laranja */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4 print:bg-white print:text-black">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">DEMONSTRATIVO DE CAIXA</h1>
              <p className="text-orange-100 text-sm print:text-gray-500">Orçamento Gerencial - Regime de {regime === 'caixa' ? 'Caixa' : 'Competência'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={expandAll} className="p-2 bg-white/20 rounded hover:bg-white/30 transition" title="Expandir tudo">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
              </button>
              <button onClick={collapseAll} className="p-2 bg-white/20 rounded hover:bg-white/30 transition" title="Recolher tudo">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5m-4.5 0v4.5m0-4.5l5.5 5.5"/></svg>
              </button>
              <button onClick={handleExportPDF} className="p-2 bg-white/20 rounded hover:bg-white/30 transition flex items-center gap-1 text-sm" title="Exportar PDF">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                PDF
              </button>
              <button onClick={() => window.print()} className="p-2 bg-white/20 rounded hover:bg-white/30 transition flex items-center gap-1 text-sm" title="Imprimir">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Imprimir
              </button>
              <button onClick={() => setColumns(INITIAL_COLUMNS)} className="p-2 bg-white/20 rounded hover:bg-white/30 transition" title="Resetar colunas">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4">
          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm border p-3 mb-4 print:hidden">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">De:</label>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Até:</label>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Regime:</label>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => setRegime('caixa')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${regime === 'caixa' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Caixa</button>
                  <button onClick={() => setRegime('competencia')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${regime === 'competencia' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Competência</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-orange-600">Modo:</label>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => setModo('sistema')} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${modo === 'sistema' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Direto Sistema</button>
                  <button onClick={() => setModo('manual')} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${modo === 'manual' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Direto Manual</button>
                </div>
              </div>

              {/* Só no Manual: qual(is) conta(s) alimentam o demonstrativo.
                  Antes era uma conta fixa no código e o usuário não tinha
                  como saber que faltava dinheiro de outra conta ali. */}
              {modo === 'manual' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">Conta:</label>
                  <select
                    value={manualBankId}
                    onChange={(e) => setManualBankId(e.target.value)}
                    className="border rounded-lg px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Todas as contas ({contasManual.length})</option>
                    {contasManual.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}{a.conta ? ` | ${a.conta}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Mov. Banco:</label>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => setIncluirMovBanco('sim')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${incluirMovBanco === 'sim' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Com</button>
                  <button onClick={() => setIncluirMovBanco('nao')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${incluirMovBanco === 'nao' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Sem</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={considerarEntradaBancos} onChange={e => setConsiderarEntradaBancos(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-blue-700">Considerar Entrada Bancos</span>
                  {loadingBancos && <span className="text-xs text-gray-400">carregando...</span>}
                </label>
              </div>
            </div>
          </div>

          {/* Tabela (modo Sistema) */}
          {modo === 'sistema' && (loading ? (
            <div className="flex justify-center py-20"><RadarLoading /></div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border overflow-x-auto print:shadow-none print:border-none">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: 320 }} />
                  {columns.map(col => (
                    <col key={col.id} style={{ width: col.id === 'VAL_REALIZADO' ? 150 : col.id.startsWith('PCT_') ? 100 : 130 }} />
                  ))}
                  <col />
                </colgroup>
                <thead>
                  <tr className="bg-gray-700 text-white">
                    <th className="text-left py-2 px-2 font-semibold sticky left-0 bg-gray-700 z-10 whitespace-nowrap">
                      Movimento
                    </th>
                    {columns.map(col => (
                      <th
                        key={col.id}
                        className={`text-right py-2 px-2 font-semibold select-none whitespace-nowrap ${dragOverCol === col.id ? 'bg-gray-500' : realColHeaderClass(col.id)}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, col.id)}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="flex items-center justify-end gap-1 cursor-grab">
                          <svg className="w-3 h-3 opacity-40 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                            <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                          </svg>
                          <span>{col.header}</span>
                        </div>
                      </th>
                    ))}
                    <th className="bg-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const cats = data?.categorias || [];
                    const receitas = cats.filter(c => c.IS_RECEITA);
                    const despesas = cats.filter(c => c.IS_DESPESA);

                    const renderCat = (cat) => {
                      const isExpanded = expandedCats[cat.COD_CATEGORIA];
                      const custos = isCustos(cat);
                      const catBg = cat.IS_RECEITA ? 'bg-green-100' : custos ? 'bg-purple-200' : 'bg-orange-100';
                      const catText = cat.IS_RECEITA ? 'text-green-900' : custos ? 'text-purple-900' : 'text-orange-900';
                      const subBg = custos ? 'bg-purple-50' : 'bg-white';
                      const subText = custos ? 'text-purple-800' : 'text-gray-700';
                      return (
                        <React.Fragment key={cat.COD_CATEGORIA}>
                          <tr className={`${catBg} ${catText} cursor-pointer hover:opacity-80 transition-opacity`} onClick={() => toggleCat(cat.COD_CATEGORIA)}>
                            <td className={`py-1.5 px-3 font-bold sticky left-0 z-10 ${catBg}`}>
                              <div className="flex items-center gap-2">
                                <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                                </svg>
                                <span className="truncate">{cat.DES_CATEGORIA}</span>
                              </div>
                            </td>
                            {columns.map(col => (
                              <td key={col.id} className={`text-right py-1.5 px-2 font-bold ${getCatDifClass(col.id, cat)} ${realColClass(col.id)}`}>
                                {getCatCellValue(col.id, cat, totais)}
                              </td>
                            ))}
                            <td className={catBg}></td>
                          </tr>
                          {isExpanded && (cat.subcategorias || []).map((sub) => (
                            <tr key={`${cat.COD_CATEGORIA}_${sub.COD_SUBCATEGORIA}`}
                              className={`${subBg} hover:bg-gray-50 border-b border-gray-100 cursor-pointer`}
                              onClick={() => abrirDetalhe(cat, sub)}
                            >
                              <td className={`py-1 px-3 pl-8 sticky left-0 z-10 ${subBg}`}>
                                <span className={subText}>{sub.DES_SUBCATEGORIA}</span>
                              </td>
                              {columns.map(col => (
                                <td key={col.id} className={`text-right py-1 px-2 ${custos ? 'text-purple-700' : 'text-gray-600'} ${getSubDifClass(col.id, sub)} ${realColClass(col.id)}`}>
                                  {getSubCellValue(col.id, sub, cat, totais)}
                                </td>
                              ))}
                              <td></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    };

                    return (
                      <>
                        {/* Receitas */}
                        {!considerarEntradaBancos && receitas.map(renderCat)}

                        {/* Receita Bancos (quando flag ativa) */}
                        {considerarEntradaBancos && (
                          <>
                          <tr className="bg-blue-100 text-blue-900 font-semibold border-b border-blue-200 cursor-pointer hover:bg-blue-200" onClick={() => setExpandedBancos(!expandedBancos)}>
                            <td className="py-2 px-3 sticky left-0 bg-blue-100 z-10">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{expandedBancos ? '−' : '+'}</span>
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                RECEITA BANCOS
                              </div>
                            </td>
                            {columns.map(col => (
                              <td key={col.id} className={`text-right py-1.5 px-2 ${realColClass(col.id)}`}>
                                {col.id === 'VAL_QUITADO' || col.id === 'VAL_REALIZADO' ? formatCurrency(entradaBancosTotal) :
                                 col.id === 'PCT_QUIT' || col.id === 'PCT_REAL' ? '100,00%' : '-'}
                              </td>
                            ))}
                            <td className="bg-blue-100"></td>
                          </tr>
                          {expandedBancos && entradaBancosList.map(bank => (
                            <tr key={bank.id} className="bg-blue-50 text-blue-800 border-b border-blue-100">
                              <td className="py-1.5 px-3 pl-10 sticky left-0 bg-blue-50 z-10 text-sm">{bank.name}</td>
                              {columns.map(col => (
                                <td key={col.id} className={`text-right py-1.5 px-2 text-sm ${realColClass(col.id)}`}>
                                  {col.id === 'VAL_QUITADO' || col.id === 'VAL_REALIZADO' ? formatCurrency(bank.valor) :
                                   col.id === 'PCT_QUIT' || col.id === 'PCT_REAL' ? (entradaBancosTotal > 0 ? ((bank.valor / entradaBancosTotal) * 100).toFixed(2) + '%' : '-') : '-'}
                                </td>
                              ))}
                              <td className="bg-blue-50"></td>
                            </tr>
                          ))}
                          </>
                        )}

                        {/* Subtotal Receitas (entre receitas e despesas) */}
                        {data && (receitas.length > 0 || considerarEntradaBancos) && (
                          <tr className="bg-green-200 text-green-950 font-bold border-t-2 border-green-300">
                            <td className="py-2 px-3 sticky left-0 bg-green-200 z-10">TOTAL RECEITAS</td>
                            {columns.map(col => {
                              if (considerarEntradaBancos) {
                                if (col.id === 'VAL_QUITADO' || col.id === 'VAL_REALIZADO') return <td key={col.id} className={`text-right py-1.5 px-2 font-bold ${realColClass(col.id)}`}>{formatCurrency(entradaBancosTotal)}</td>;
                                if (col.id === 'PCT_QUIT' || col.id === 'PCT_REAL') return <td key={col.id} className={`text-right py-1.5 px-2 ${realColClass(col.id)}`}>100,00%</td>;
                                return <td key={col.id} className={`text-right py-1.5 px-2 ${realColClass(col.id)}`}>-</td>;
                              }
                              const difRec = (totais.totalMetaReceitas || 0) - (totais.totalReceitas || 0);
                              const difClass = col.id === 'VAL_DIFERENCA' ? (difRec < 0 ? 'text-red-600' : difRec > 0 ? 'text-green-800' : '') : '';
                              return <td key={col.id} className={`text-right py-1.5 px-2 ${difClass} ${realColClass(col.id)}`}>{getTotalCellValue(col.id, totais, 'receitas')}</td>;
                            })}
                            <td className="bg-green-200"></td>
                          </tr>
                        )}

                        {/* Separar custos (CMV) das demais despesas */}
                        {(() => {
                          const custosArr = despesas.filter(c => isCustos(c));
                          const demaisDespesas = despesas.filter(c => !isCustos(c));
                          return (
                            <>
                              {/* Cabeçalho da seção Custos */}
                              {custosArr.length > 0 && (
                                <>
                                  <tr className="bg-gray-700 text-white">
                                    <th className="text-left py-2 px-2 font-semibold sticky left-0 bg-gray-700 z-10 whitespace-nowrap">
                                      Movimento
                                    </th>
                                    {columns.map(col => (
                                      <th key={col.id} className={`text-right py-2 px-2 font-semibold whitespace-nowrap ${realColHeaderClass(col.id)}`}>
                                        {col.headerDesp || col.header}
                                      </th>
                                    ))}
                                    <th className="bg-gray-700"></th>
                                  </tr>
                                  {custosArr.map(renderCat)}
                                </>
                              )}

                              {/* Cabeçalho da seção Despesas Operacionais */}
                              {demaisDespesas.length > 0 && (
                                <>
                                  <tr className="bg-gray-700 text-white">
                                    <th className="text-left py-2 px-2 font-semibold sticky left-0 bg-gray-700 z-10 whitespace-nowrap">
                                      Movimento
                                    </th>
                                    {columns.map(col => (
                                      <th key={col.id} className={`text-right py-2 px-2 font-semibold whitespace-nowrap ${realColHeaderClass(col.id)}`}>
                                        {col.headerDesp || col.header}
                                      </th>
                                    ))}
                                    <th className="bg-gray-700"></th>
                                  </tr>
                                  {demaisDespesas.map(renderCat)}

                                  {/* Subtotal Despesas Operacionais */}
                                  {(() => {
                                    const subDespOp = {
                                      META: demaisDespesas.reduce((s, c) => s + (c.META || 0), 0),
                                      VAL_ABERTO: demaisDespesas.reduce((s, c) => s + (c.VAL_ABERTO || 0), 0),
                                      VAL_QUITADO: demaisDespesas.reduce((s, c) => s + (c.VAL_QUITADO || 0), 0),
                                      VAL_REALIZADO: demaisDespesas.reduce((s, c) => s + (c.VAL_REALIZADO || 0), 0),
                                      VAL_DIFERENCA: demaisDespesas.reduce((s, c) => s + (c.VAL_DIFERENCA || 0), 0),
                                      IS_RECEITA: false, IS_DESPESA: true,
                                    };
                                    return (
                                      <tr className="bg-orange-200 text-orange-950 font-bold border-t-2 border-orange-300">
                                        <td className="py-2 px-3 sticky left-0 bg-orange-200 z-10">TOTAL DESP. OPERACIONAIS</td>
                                        {columns.map(col => (
                                          <td key={col.id} className={`text-right py-1.5 px-2 ${realColClass(col.id)}`}>
                                            {getCatCellValue(col.id, subDespOp, totais)}
                                          </td>
                                        ))}
                                        <td className="bg-orange-200"></td>
                                      </tr>
                                    );
                                  })()}
                                </>
                              )}
                            </>
                          );
                        })()}
                      </>
                    );
                  })()}

                  {/* Totais finais */}
                  {data && (
                    <>
                      <tr className="bg-purple-300 text-purple-950 font-bold border-t-2 border-purple-400">
                        <td className="py-2 px-3 sticky left-0 bg-purple-300 z-10">TOTAL DESPESAS</td>
                        {columns.map(col => {
                          const difDesp = (totais.totalMetaDespesas || 0) - (totais.totalDespesas || 0);
                          const difClass = col.id === 'VAL_DIFERENCA' ? (difDesp < 0 ? 'text-red-600' : difDesp > 0 ? 'text-green-800' : '') : '';
                          return <td key={col.id} className={`text-right py-1.5 px-2 ${difClass} ${realColClass(col.id)}`}>{getTotalCellValue(col.id, totais, 'despesas')}</td>;
                        })}
                        <td className="bg-purple-300"></td>
                      </tr>
                      <tr className="bg-gray-800 text-white font-bold text-base">
                        <td className="py-2.5 px-3 sticky left-0 bg-gray-800 z-10">SALDO (Receitas - Despesas)</td>
                        {columns.map(col => {
                          // Determina valor numérico para cor condicional
                          let saldoVal = null;
                          if (col.id === 'META') saldoVal = (totais.totalMetaReceitas || 0) - (totais.totalMetaDespesas || 0);
                          else if (col.id === 'VAL_ABERTO') saldoVal = (totais.totalAbertoReceitas || 0) - (totais.totalAbertoDespesas || 0);
                          else if (col.id === 'VAL_QUITADO') saldoVal = (totais.totalQuitadoReceitas || 0) - (totais.totalQuitadoDespesas || 0);
                          else if (col.id === 'VAL_REALIZADO') saldoVal = totais.saldo;
                          else if (col.id === 'VAL_DIFERENCA') saldoVal = ((totais.totalMetaReceitas || 0) - (totais.totalMetaDespesas || 0)) - (totais.saldo || 0);
                          const colorClass = saldoVal !== null ? (saldoVal < 0 ? 'text-red-300' : 'text-green-300') : '';
                          // Indicador de quanto passou ou ficou abaixo de 100% (despesas vs receitas)
                          let diff100 = null;
                          if (col.id === 'PCT_META') {
                            const pct = totais.totalMetaReceitas ? ((totais.totalMetaDespesas || 0) / totais.totalMetaReceitas * 100) : 0;
                            if (pct !== 0 && pct !== 100) diff100 = pct - 100;
                          } else if (col.id === 'PCT_QUIT') {
                            const pct = totais.totalQuitadoReceitas ? ((totais.totalQuitadoDespesas || 0) / totais.totalQuitadoReceitas * 100) : 0;
                            if (pct !== 0 && pct !== 100) diff100 = pct - 100;
                          } else if (col.id === 'PCT_REAL') {
                            const pct = totais.totalReceitas ? ((totais.totalDespesas || 0) / totais.totalReceitas * 100) : 0;
                            if (pct !== 0 && pct !== 100) diff100 = pct - 100;
                          }
                          return (
                            <td key={col.id} className={`text-right py-2.5 px-2 ${colorClass} ${col.id === 'VAL_QUITADO' ? 'bg-gray-700' : ''}`}>
                              {getTotalCellValue(col.id, totais, 'saldo')}
                              {diff100 !== null && (
                                <div className={`text-xs font-semibold ${diff100 > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                  ({diff100 > 0 ? '+' : ''}{diff100.toFixed(2).replace('.', ',')}%)
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="bg-gray-800"></td>
                      </tr>
                    </>
                  )}

                  {!data && !loading && (
                    <tr>
                      <td colSpan={2 + columns.length} className="text-center py-10 text-gray-400">
                        Nenhum dado encontrado para o período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}

          {/* Resumo em cards (modo Sistema) */}
          {modo === 'sistema' && data && (() => {
            const saldoQuitado = (totais.totalQuitadoReceitas || 0) - (totais.totalQuitadoDespesas || 0);
            return (<>
            {/* Cards Quitados */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 print:grid-cols-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm text-green-700 font-medium">Receitas Quitadas</div>
                <div className="text-xl font-bold text-green-800 mt-1">R$ {formatCurrency(totais.totalQuitadoReceitas)}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="text-sm text-orange-700 font-medium">Despesas Quitadas</div>
                <div className="text-xl font-bold text-orange-800 mt-1">R$ {formatCurrency(totais.totalQuitadoDespesas)}</div>
              </div>
              <div className={`${saldoQuitado >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-3`}>
                <div className={`text-sm font-medium ${saldoQuitado >= 0 ? 'text-green-600' : 'text-red-600'}`}>Saldo Quitado</div>
                <div className={`text-xl font-bold mt-1 ${saldoQuitado >= 0 ? 'text-green-700' : 'text-red-700'}`}>R$ {formatCurrency(saldoQuitado)}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-600 font-medium">Período</div>
                <div className="text-base font-bold text-gray-700 mt-1">
                  {dataInicio.split('-').reverse().join('/')} a {dataFim.split('-').reverse().join('/')}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">Regime: {regime === 'caixa' ? 'Caixa' : 'Competência'}</div>
              </div>
            </div>
            {/* Cards Realizado (Quitado + Aberto) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 print:grid-cols-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm text-green-700 font-medium">Total Receitas</div>
                <div className="text-xl font-bold text-green-800 mt-1">R$ {formatCurrency(totais.totalReceitas)}</div>
                <div className="text-sm text-green-600 mt-0.5">Meta: R$ {formatCurrency(totais.totalMetaReceitas)}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="text-sm text-orange-700 font-medium">Total Despesas</div>
                <div className="text-xl font-bold text-orange-800 mt-1">R$ {formatCurrency(totais.totalDespesas)}</div>
                <div className="text-sm text-orange-600 mt-0.5">Meta: R$ {formatCurrency(totais.totalMetaDespesas)}</div>
              </div>
              <div className={`${(totais.saldo || 0) >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-3`}>
                <div className={`text-sm font-medium ${(totais.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>Saldo</div>
                <div className={`text-xl font-bold mt-1 ${(totais.saldo || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>R$ {formatCurrency(totais.saldo)}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-600 font-medium">Período</div>
                <div className="text-base font-bold text-gray-700 mt-1">
                  {dataInicio.split('-').reverse().join('/')} a {dataFim.split('-').reverse().join('/')}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">Regime: {regime === 'caixa' ? 'Caixa' : 'Competência'}</div>
              </div>
            </div>
            </>);
          })()}

          {/* Demonstrativo (modo Manual) */}
          {modo === 'manual' && <DemonstrativoManual data={manualData} loading={loadingManual} />}
        </div>
      </main>

      {/* Painel lateral - Detalhamento de Títulos */}
      {detalhePainel && (
        <div className="w-[620px] flex-shrink-0 border-l border-gray-300 bg-white flex flex-col overflow-hidden shadow-xl">
          {/* Header do painel */}
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate">Detalhamento de Títulos</h2>
              <p className="text-orange-100 text-xs truncate">{detalhePainel.desCategoria}{detalhePainel.desSubcategoria ? ` > ${detalhePainel.desSubcategoria}` : ''}</p>
            </div>
            <button onClick={fecharDetalhe} className="p-1 hover:bg-white/20 rounded transition ml-2 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Filtros status */}
          <div className="px-4 py-2 border-b flex items-center gap-2 shrink-0 bg-gray-50">
            {[
              { id: 'todos', label: 'TODOS' },
              { id: 'aberto', label: 'ABERTOS' },
              { id: 'quitado', label: 'QUITADOS' },
            ].map(s => (
              <button key={s.id} onClick={() => setDetalheStatus(s.id)}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${detalheStatus === s.id ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >{s.label}</button>
            ))}
            {detalheTitulos && (
              <span className="text-xs text-gray-500 ml-auto">{detalheTitulos.totais?.qtdTitulos || 0} títulos</span>
            )}
          </div>

          {/* Lista de títulos */}
          <div className="flex-1 overflow-auto">
            {detalheLoading ? (
              <div className="flex justify-center py-10"><RadarLoading /></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(detalheTitulos?.titulos || []).map((t) => (
                  <div key={t.NUM_REGISTRO}>
                    <div
                      className={`px-4 py-2 cursor-pointer hover:bg-gray-50 transition ${expandedTitulo === t.NUM_REGISTRO ? 'bg-orange-50' : ''}`}
                      onClick={() => handleTituloClick(t)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${t.FLG_QUITADO === 'S' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-sm font-medium text-gray-800 truncate flex-1">{t.DES_PARCEIRO || 'Sem parceiro'}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${t.FLG_COMPENSADO === 'S' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-600 border border-red-300'}`}>
                          {t.FLG_COMPENSADO === 'S' ? 'CONCILIADA' : 'NÃO CONCILIADA'}
                        </span>
                        <span className="text-sm font-bold text-gray-700 shrink-0">
                          {formatCurrency(t.VAL_PARCELA)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 ml-4 text-xs text-gray-500">
                        {t.NUM_DOCTO && <span>Doc: {t.NUM_DOCTO}</span>}
                        {t.NUM_NF && <span>NF: {t.NUM_NF}</span>}
                        <span>{t.FLG_QUITADO === 'S' ? 'Quitado' : 'Aberto'}</span>
                        {t.DES_ENTIDADE && <span>{t.DES_ENTIDADE}</span>}
                        <span className="ml-auto">{formatDate(t.DTA_VENCIMENTO)}</span>
                      </div>
                    </div>

                    {/* Itens da NF expandidos */}
                    {expandedTitulo === t.NUM_REGISTRO && (
                      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2">
                        {itensLoading ? (
                          <div className="text-xs text-gray-400 py-2 text-center">Carregando produtos...</div>
                        ) : itensNF.length === 0 ? (
                          <div className="text-xs text-gray-400 py-2 text-center">
                            {t.NUM_NF ? 'Nenhum produto encontrado para esta NF' : 'Título sem NF vinculada'}
                          </div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 border-b">
                                <th className="text-left py-1 font-medium">Cód</th>
                                <th className="text-left py-1 font-medium">Produto</th>
                                <th className="text-right py-1 font-medium">Qtd</th>
                                <th className="text-right py-1 font-medium">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itensNF.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-100">
                                  <td className="py-1 text-gray-600">{item.COD_ITEM}</td>
                                  <td className="py-1 text-gray-700 truncate max-w-[200px]">{item.DES_PRODUTO || '-'}</td>
                                  <td className="py-1 text-right text-gray-600">{item.QTD_TOTAL != null ? Number(item.QTD_TOTAL).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : '-'}</td>
                                  <td className="py-1 text-right text-gray-700 font-medium">{formatCurrency(item.VAL_TOTAL_ITEM)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {!detalheLoading && (!detalheTitulos?.titulos || detalheTitulos.titulos.length === 0) && (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    Nenhum título encontrado para o filtro selecionado.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Totais do painel */}
          {detalheTitulos?.totais && (
            <div className="border-t bg-gray-50 px-4 py-3 shrink-0">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-red-500 font-medium">Aberto</div>
                  <div className="text-sm font-bold text-red-600">{formatCurrency(detalheTitulos.totais.totalAberto)}</div>
                </div>
                <div>
                  <div className="text-xs text-green-500 font-medium">Quitado</div>
                  <div className="text-sm font-bold text-green-600">{formatCurrency(detalheTitulos.totais.totalQuitado)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">Total</div>
                  <div className="text-sm font-bold text-gray-700">{formatCurrency(detalheTitulos.totais.totalGeral)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
