import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';

/**
 * Componente de Popover para mostrar receita de produção de um produto
 * Mostra os insumos (ingredientes) com quantidades e % participação
 */
export default function ReceitaPopover({ codProduto, nomeProduto }) {
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
      const popoverWidth = 500;
      const popoverHeight = 350;

      let top = rect.bottom + 8;
      let left = rect.left;

      if (left + popoverWidth > viewportWidth - 20) {
        left = viewportWidth - popoverWidth - 20;
      }

      if (top + popoverHeight > viewportHeight - 20) {
        top = rect.top - popoverHeight - 8;
      }

      setPosition({ top, left });
    }
  }, [isOpen]);

  // Buscar dados ao abrir
  const handleOpen = async () => {
    setIsOpen(true);

    if (data) return;

    setLoading(true);
    try {
      const response = await api.get(`/compra-venda/receita/${codProduto}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar receita:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="w-5 h-5 rounded-full bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center cursor-pointer"
        title={`Ver receita: ${nomeProduto}`}
      >
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
          style={{
            top: position.top,
            left: position.left,
            width: '500px',
            maxHeight: '70vh'
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍳</span>
                <div>
                  <h3 className="font-semibold text-green-900">Receita de Produção</h3>
                  <p className="text-xs text-gray-600">
                    {codProduto} - {nomeProduto}
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
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 60px)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                <span className="ml-3 text-gray-500">Carregando...</span>
              </div>
            ) : data && data.insumos && data.insumos.length > 0 ? (
              <div>
                {/* Tabela de insumos */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Item</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Código</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Insumo</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Qtd. Receita</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">% Particip.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.insumos.map((insumo, idx) => (
                      <tr key={idx} className="hover:bg-green-50 transition-colors">
                        <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs text-green-700">{insumo.COD_INSUMO}</td>
                        <td className="px-3 py-2 text-gray-900">{insumo.INSUMO}</td>
                        <td className="px-3 py-2 text-right font-medium">{Number(insumo.QTD_RECEITA).toFixed(3)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-semibold">
                            {insumo.PARTICIPACAO}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Rodapé com total */}
                <div className="px-4 py-3 bg-green-50 border-t border-green-200 flex justify-between items-center">
                  <span className="text-sm font-semibold text-green-900">
                    Total: {data.insumos.length} insumos
                  </span>
                  <span className="text-sm font-bold text-green-700">
                    Qtd. Total: {Number(data.totalQtd).toFixed(3)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500">
                Nenhuma receita encontrada
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
