import { useState, useEffect } from 'react';

const MOTIVOS_ICONS = {
  produto_abandonado: '📦',
  falta_cancelamento: '❌',
  devolucao_mercadoria: '↩️',
  erro_operador: '👤',
  erro_balconista: '🛒',
  furto: '🚨'
};

const MOTIVOS_LABELS = {
  produto_abandonado: 'Produto Abandonado',
  falta_cancelamento: 'Falta de Cancelamento',
  devolucao_mercadoria: 'Devolução de Mercadoria',
  erro_operador: 'Erro do Operador',
  erro_balconista: 'Erro do Balconista',
  furto: 'Furto'
};

export default function RankingsSection({ bipages, sectors, employees }) {
  const [activeView, setActiveView] = useState('motivos'); // 'motivos', 'funcionarios', 'setores', 'valores'
  const [isExpanded, setIsExpanded] = useState(true);

  // Calcular estatísticas dos cancelamentos
  const cancelledBips = bipages.filter(bip => bip.status === 'cancelled');

  // Ranking por Motivos de Cancelamento
  const motivosStats = cancelledBips.reduce((acc, bip) => {
    if (!bip.motivo_cancelamento) return acc;

    const motivo = bip.motivo_cancelamento;
    if (!acc[motivo]) {
      acc[motivo] = {
        motivo,
        icon: MOTIVOS_ICONS[motivo] || '❓',
        label: MOTIVOS_LABELS[motivo] || motivo,
        count: 0,
        totalValue: 0
      };
    }

    acc[motivo].count++;
    acc[motivo].totalValue += bip.bip_price_cents || 0;

    return acc;
  }, {});

  const motivosRanking = Object.values(motivosStats).sort((a, b) => b.count - a.count);

  // Ranking por Funcionários Responsáveis (erros)
  const funcionariosStats = cancelledBips.reduce((acc, bip) => {
    if (!bip.employee_responsavel) return acc;

    const employeeId = bip.employee_responsavel.id;
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee: bip.employee_responsavel,
        count: 0,
        totalValue: 0,
        motivos: {}
      };
    }

    acc[employeeId].count++;
    acc[employeeId].totalValue += bip.bip_price_cents || 0;

    // Contar motivos por funcionário
    const motivo = bip.motivo_cancelamento;
    if (motivo) {
      if (!acc[employeeId].motivos[motivo]) {
        acc[employeeId].motivos[motivo] = 0;
      }
      acc[employeeId].motivos[motivo]++;
    }

    return acc;
  }, {});

  const funcionariosRanking = Object.values(funcionariosStats).sort((a, b) => b.count - a.count);

  // Ranking por Setores
  const setoresStats = cancelledBips.reduce((acc, bip) => {
    if (!bip.equipment?.sector) return acc;

    const sectorId = bip.equipment.sector.id;
    if (!acc[sectorId]) {
      acc[sectorId] = {
        sector: bip.equipment.sector,
        count: 0,
        totalValue: 0,
        motivos: {}
      };
    }

    acc[sectorId].count++;
    acc[sectorId].totalValue += bip.bip_price_cents || 0;

    // Contar motivos por setor
    const motivo = bip.motivo_cancelamento;
    if (motivo) {
      if (!acc[sectorId].motivos[motivo]) {
        acc[sectorId].motivos[motivo] = 0;
      }
      acc[sectorId].motivos[motivo]++;
    }

    return acc;
  }, {});

  const setoresRanking = Object.values(setoresStats).sort((a, b) => b.count - a.count);

  // Ranking por Valores Cancelados
  const valoresRanking = [...motivosRanking].sort((a, b) => b.totalValue - a.totalValue);

  // Função para formatar valor em centavos para reais
  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  // Calcular totais gerais
  const totalCancelamentos = cancelledBips.length;
  const totalValorCancelado = cancelledBips.reduce((sum, bip) => sum + (bip.bip_price_cents || 0), 0);

  if (totalCancelamentos === 0) {
    return null; // Não mostrar se não houver cancelamentos
  }

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      {/* Header */}
      <div
        className="px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            🏆 RANKINGS DE CANCELAMENTOS
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {totalCancelamentos} cancelamentos totalizando {formatCurrency(totalValorCancelado)}
          </p>
        </div>
        <button className="text-gray-500 hover:text-gray-700 transition-colors">
          <svg
            className={`w-6 h-6 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Abas de Visualização */}
          <div className="px-6 pt-4 border-b border-gray-200">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveView('motivos')}
                className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                  activeView === 'motivos'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📋 Por Motivo
              </button>
              <button
                onClick={() => setActiveView('valores')}
                className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                  activeView === 'valores'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                💰 Por Valor
              </button>
              <button
                onClick={() => setActiveView('funcionarios')}
                className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                  activeView === 'funcionarios'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                👥 Por Funcionário
              </button>
              <button
                onClick={() => setActiveView('setores')}
                className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                  activeView === 'setores'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🏢 Por Setor
              </button>
            </div>
          </div>

          {/* Conteúdo do Ranking */}
          <div className="p-6">
            {/* Ranking por Motivos */}
            {activeView === 'motivos' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Ranking por Motivo de Cancelamento
                </h3>
                {motivosRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum cancelamento com motivo registrado
                  </p>
                ) : (
                  motivosRanking.map((item, index) => (
                    <div
                      key={item.motivo}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold">
                          #{index + 1}
                        </div>
                        <span className="text-3xl">{item.icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-600">
                            Valor total: {formatCurrency(item.totalValue)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">{item.count}</p>
                        <p className="text-sm text-gray-500">cancelamentos</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Ranking por Valores */}
            {activeView === 'valores' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Ranking por Valor Cancelado
                </h3>
                {valoresRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum cancelamento registrado
                  </p>
                ) : (
                  valoresRanking.map((item, index) => (
                    <div
                      key={item.motivo}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600 font-bold">
                          #{index + 1}
                        </div>
                        <span className="text-3xl">{item.icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-600">
                            {item.count} cancelamentos
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(item.totalValue)}
                        </p>
                        <p className="text-sm text-gray-500">valor total</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Ranking por Funcionários */}
            {activeView === 'funcionarios' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Ranking de Erros por Funcionário
                </h3>
                {funcionariosRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum erro de funcionário registrado
                  </p>
                ) : (
                  funcionariosRanking.map((item, index) => (
                    <div
                      key={item.employee.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 font-bold">
                            #{index + 1}
                          </div>
                          {item.employee.avatar ? (
                            <img
                              src={item.employee.avatar}
                              alt={item.employee.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold">
                              {item.employee.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">{item.employee.name}</p>
                            <p className="text-sm text-gray-600">
                              Valor total: {formatCurrency(item.totalValue)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-red-600">{item.count}</p>
                          <p className="text-sm text-gray-500">erros</p>
                        </div>
                      </div>
                      {/* Detalhamento por tipo de erro */}
                      <div className="flex flex-wrap gap-2 ml-14">
                        {Object.entries(item.motivos).map(([motivo, count]) => (
                          <span
                            key={motivo}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs text-gray-700"
                          >
                            {MOTIVOS_ICONS[motivo]} {MOTIVOS_LABELS[motivo]}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Ranking por Setores */}
            {activeView === 'setores' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Ranking de Cancelamentos por Setor
                </h3>
                {setoresRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum cancelamento por setor registrado
                  </p>
                ) : (
                  setoresRanking.map((item, index) => (
                    <div
                      key={item.sector.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold">
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{item.sector.name}</p>
                            <p className="text-sm text-gray-600">
                              Valor total: {formatCurrency(item.totalValue)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{item.count}</p>
                          <p className="text-sm text-gray-500">cancelamentos</p>
                        </div>
                      </div>
                      {/* Detalhamento por motivo */}
                      <div className="flex flex-wrap gap-2 ml-14">
                        {Object.entries(item.motivos).map(([motivo, count]) => (
                          <span
                            key={motivo}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs text-gray-700"
                          >
                            {MOTIVOS_ICONS[motivo]} {MOTIVOS_LABELS[motivo]}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
