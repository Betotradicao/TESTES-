import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';

/**
 * Componente de Popover para mostrar detalhamento de Emprestei/Emprestado
 * Mostra de onde vieram os valores (decomposição, produção, associação)
 */
export default function DetalheEmprestimoPopover({
  tipo, // 'emprestei' | 'emprestado'
  nivel, // 'secao' | 'grupo' | 'subgrupo' | 'item'
  codSecao,
  codGrupo,
  codSubGrupo,
  codProduto,
  filters, // filtros atuais (dataInicio, dataFim, codLoja, etc)
  valor, // valor total do empréstimo
  children // elemento trigger (o valor formatado)
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target) &&
          triggerRef.current && !triggerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Calcular posição do popover
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popoverWidth = 600; // largura estimada do popover
      const popoverHeight = 400; // altura estimada do popover

      let top = rect.bottom + 8;
      let left = rect.left;

      // Ajustar se sair da tela pela direita
      if (left + popoverWidth > viewportWidth - 20) {
        left = viewportWidth - popoverWidth - 20;
      }

      // Ajustar se sair da tela por baixo
      if (top + popoverHeight > viewportHeight - 20) {
        top = rect.top - popoverHeight - 8;
      }

      setPosition({ top, left });
    }
  }, [isOpen]);

  // Buscar dados ao abrir
  const handleOpen = async () => {
    if (!valor || valor === 0) return;

    setIsOpen(true);

    if (data) return; // já carregou

    setLoading(true);
    try {
      const params = new URLSearchParams({
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        nivel,
        tipo,
        tipoCompras: filters.tipoNotaFiscal?.compras ? 'true' : 'false',
        tipoOutras: filters.tipoNotaFiscal?.outras ? 'true' : 'false',
        tipoBonificacao: filters.tipoNotaFiscal?.bonificacao ? 'true' : 'false'
      });

      if (filters.codLoja) params.append('codLoja', filters.codLoja);
      if (codSecao) params.append('codSecao', codSecao);
      if (codGrupo) params.append('codGrupo', codGrupo);
      if (codSubGrupo) params.append('codSubGrupo', codSubGrupo);
      if (codProduto) params.append('codProduto', codProduto);

      const response = await api.get(`/compra-venda/detalhe-emprestimo?${params.toString()}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const tipoLabel = tipo === 'emprestei' ? 'EMPRESTEI' : 'EMPRESTADO';
  const tipoEmoji = tipo === 'emprestei' ? '📤' : '📥';

  // Se valor é 0 ou não tem, não mostra o ícone
  if (!valor || valor === 0) {
    return children;
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      {children}
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="opacity-40 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200"
        title="Ver detalhamento"
      >
        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
          style={{
            top: position.top,
            left: position.left,
            width: '600px',
            maxHeight: '80vh'
          }}
        >
          {/* Header */}
          <div className={`px-4 py-3 border-b ${tipo === 'emprestei' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{tipoEmoji}</span>
                <div>
                  <h3 className={`font-semibold ${tipo === 'emprestei' ? 'text-orange-900' : 'text-green-900'}`}>
                    Detalhamento - {tipoLabel}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Total: {formatCurrency(valor)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-gray-200 text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 60px)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                <span className="ml-3 text-gray-500">Carregando...</span>
              </div>
            ) : data ? (
              <div className="p-4 space-y-4">
                {/* DECOMPOSIÇÃO */}
                <Section
                  title="Decomposição"
                  emoji="🔀"
                  subtitle={tipo === 'emprestei' ? 'Matriz → Filhos' : 'Filhos ← Matriz'}
                  items={data.decomposicao}
                  total={data.totalDecomposicao}
                  tipo={tipo}
                  formatCurrency={formatCurrency}
                />

                {/* PRODUÇÃO */}
                <Section
                  title="Produção"
                  emoji="🍳"
                  subtitle={tipo === 'emprestei' ? 'Insumo → Produto Final' : 'Produto Final ← Insumo'}
                  items={data.producao}
                  total={data.totalProducao}
                  tipo={tipo}
                  formatCurrency={formatCurrency}
                />

                {/* ASSOCIAÇÃO */}
                <Section
                  title="Associação"
                  emoji="🔗"
                  subtitle={tipo === 'emprestei' ? 'Base → Associado' : 'Associado ← Base'}
                  items={data.associacao}
                  total={data.totalAssociacao}
                  tipo={tipo}
                  formatCurrency={formatCurrency}
                />

                {/* Total Geral */}
                <div className={`mt-4 p-3 rounded-lg ${tipo === 'emprestei' ? 'bg-orange-100' : 'bg-green-100'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-semibold ${tipo === 'emprestei' ? 'text-orange-900' : 'text-green-900'}`}>
                      TOTAL {tipoLabel}
                    </span>
                    <span className={`font-bold text-lg ${tipo === 'emprestei' ? 'text-orange-700' : 'text-green-700'}`}>
                      {formatCurrency(data.total)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500">
                Nenhum dado encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de Seção (Decomposição, Produção, Associação)
function Section({ title, emoji, subtitle, items, total, tipo, formatCurrency }) {
  const [expanded, setExpanded] = useState(true);
  const hasItems = items && items.length > 0;
  const bgColor = tipo === 'emprestei' ? 'bg-orange-50' : 'bg-green-50';
  const borderColor = tipo === 'emprestei' ? 'border-orange-200' : 'border-green-200';

  return (
    <div className={`border rounded-lg overflow-hidden ${borderColor}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-3 py-2 flex items-center justify-between ${bgColor} hover:brightness-95 transition-all`}
      >
        <div className="flex items-center gap-2">
          <span>{emoji}</span>
          <span className="font-medium text-gray-800">{title}</span>
          <span className="text-xs text-gray-500">({subtitle})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${total > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatCurrency(total)}
          </span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="bg-white">
          {hasItems ? (
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {tipo === 'emprestei' ? 'Origem (Este Item)' : 'Este Item'}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    {tipo === 'emprestei' ? 'Destino' : 'Origem'}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.slice(0, 20).map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-700 truncate max-w-[180px]" title={item.PRODUTO_ORIGEM}>
                      <span className="text-gray-400 mr-1">{item.COD_ORIGEM || item.COD_DESTINO}</span>
                      {tipo === 'emprestei' ? item.PRODUTO_ORIGEM : item.PRODUTO_DESTINO}
                    </td>
                    <td className="px-3 py-1.5 text-gray-700 truncate max-w-[180px]" title={item.PRODUTO_DESTINO}>
                      <span className="text-gray-400 mr-1">{tipo === 'emprestei' ? item.COD_DESTINO : item.COD_ORIGEM}</span>
                      {tipo === 'emprestei' ? item.PRODUTO_DESTINO : item.PRODUTO_ORIGEM}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900">
                      {formatCurrency(item.VALOR)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-3 py-4 text-center text-gray-400 text-xs">
              Nenhum registro encontrado
            </div>
          )}
          {hasItems && items.length > 20 && (
            <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center">
              Mostrando 20 de {items.length} registros
            </div>
          )}
        </div>
      )}
    </div>
  );
}
