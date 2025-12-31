import { useState } from 'react';

/**
 * Componente para exibir célula de validação IA na tabela de bipagens
 *
 * Classificação:
 * - 🟢 Verde (86-100%): Pouco Suspeito (OK para prosseguir)
 * - 🟡 Amarelo (61-85%): Suspeito (Alertar funcionário)
 * - 🔴 Vermelho (0-60%): Muito Suspeito (Bloquear)
 */
export default function CelulaValidacao({ validacao, detalhes, foto }) {
  const [showDetails, setShowDetails] = useState(false);

  // Se não houver validação, não exibe nada
  if (validacao === null || validacao === undefined) {
    return <span className="text-gray-400 text-xs">-</span>;
  }

  // Determinar configuração baseada na porcentagem
  const getStatusConfig = () => {
    if (validacao >= 86) {
      return {
        cor: 'text-green-600',
        bgCor: 'bg-green-100',
        icone: '🟢',
        label: 'OK',
        descricao: 'Pouco Suspeito'
      };
    } else if (validacao >= 61) {
      return {
        cor: 'text-yellow-600',
        bgCor: 'bg-yellow-100',
        icone: '🟡',
        label: 'SUSPEITO',
        descricao: 'Suspeito'
      };
    } else {
      return {
        cor: 'text-red-600',
        bgCor: 'bg-red-100',
        icone: '🔴',
        label: 'M.SUSPEITO',
        descricao: 'Muito Suspeito'
      };
    }
  };

  const status = getStatusConfig();

  return (
    <div className="relative">
      {/* Célula principal */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`${status.bgCor} ${status.cor} px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-2 hover:opacity-80 transition-opacity`}
      >
        <span>{status.icone}</span>
        <span>{validacao.toFixed(0)}%</span>
        <span className="hidden sm:inline">{status.label}</span>
      </button>

      {/* Modal de detalhes */}
      {showDetails && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowDetails(false)}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl p-6 z-50 max-w-md w-full mx-4">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Validação IA - {status.descricao}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Porcentagem grande */}
            <div className={`${status.bgCor} rounded-lg p-6 mb-4 text-center`}>
              <div className="text-4xl mb-2">{status.icone}</div>
              <div className={`${status.cor} text-5xl font-bold mb-2`}>
                {validacao.toFixed(1)}%
              </div>
              <div className={`${status.cor} font-semibold`}>
                {status.label}
              </div>
            </div>

            {/* Foto do produto */}
            {foto && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto capturada:
                </label>
                <img
                  src={foto}
                  alt="Produto no balcão"
                  className="w-full rounded-lg border border-gray-300"
                />
              </div>
            )}

            {/* Detalhes técnicos */}
            {detalhes && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Análise detalhada:
                </label>
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-2">
                  {detalhes.posicao !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Posição no balcão:</span>
                      <span className={`font-semibold ${detalhes.posicao >= 80 ? 'text-green-600' : detalhes.posicao >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {detalhes.posicao}%
                      </span>
                    </div>
                  )}
                  {detalhes.cor !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cor do produto:</span>
                      <span className={`font-semibold ${detalhes.cor >= 80 ? 'text-green-600' : detalhes.cor >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {detalhes.cor}%
                      </span>
                    </div>
                  )}
                  {detalhes.tamanho !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tamanho/Forma:</span>
                      <span className={`font-semibold ${detalhes.tamanho >= 80 ? 'text-green-600' : detalhes.tamanho >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {detalhes.tamanho}%
                      </span>
                    </div>
                  )}
                  {detalhes.produto_esperado && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <span className="text-gray-600">Produto esperado:</span>
                      <div className="font-semibold text-gray-900 mt-1">
                        {detalhes.produto_esperado}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Botão fechar */}
            <button
              onClick={() => setShowDetails(false)}
              className="w-full bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 transition-colors font-semibold"
            >
              Fechar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
