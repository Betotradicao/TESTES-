import { useState } from 'react';

export default function SimulatorTab() {
  const [simulatorData, setSimulatorData] = useState({
    ean: '2037040050854',
    scanner_id: '',
    machine_id: '',
    // Usa horário local sem conversão UTC
    event_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, -1)
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [isSimulatingSale, setIsSimulatingSale] = useState(false);
  const [saleResult, setSaleResult] = useState(null);

  const exampleEANs = [
    { value: '2037040050854', label: 'EAN Peso - Coxão Mole (2037040050854)' },
    { value: '2012345678905', label: 'EAN Peso - Genérico (2012345678905)' },
    { value: '7891234567890', label: 'EAN Preço - Produto comum (7891234567890)' },
    { value: '3122000000018', label: 'Código Colaborador - Exemplo (3122000000018)' }
  ];

  const handleSimulate = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    setSaleResult(null); // Limpa resultado de venda anterior

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('token');

      const response = await fetch(`${apiUrl}/bipagens/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          raw: simulatorData.ean,
          scanner_id: simulatorData.scanner_id || undefined,
          machine_id: simulatorData.machine_id || undefined,
          event_date: simulatorData.event_date
        })
      });

      const data = await response.json();

      setSimulationResult({
        success: response.ok && data.success,
        message: data.message || (data.success ? 'Bipagem simulada com sucesso!' : 'Erro ao simular bipagem'),
        data: data
      });
    } catch (error) {
      setSimulationResult({
        success: false,
        message: `Erro de conexão: ${error.message}`,
        data: null
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateSale = async () => {
    if (!simulationResult?.data?.bip?.id) {
      alert('Simule uma bipagem primeiro!');
      return;
    }

    setIsSimulatingSale(true);
    setSaleResult(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('token');

      const response = await fetch(`${apiUrl}/bipagens/simulate-sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bip_id: simulationResult.data.bip.id
        })
      });

      const data = await response.json();

      setSaleResult({
        success: response.ok && data.success,
        message: data.message || (data.success ? 'Venda simulada com sucesso!' : 'Erro ao simular venda'),
        data: data
      });
    } catch (error) {
      setSaleResult({
        success: false,
        message: `Erro de conexão: ${error.message}`,
        data: null
      });
    } finally {
      setIsSimulatingSale(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Simulador de Bipagens</h3>
        <p className="text-sm text-blue-800">
          Use este simulador para testar o fluxo completo de bipagens sem precisar de um leitor físico.
          As bipagens simuladas aparecerão em tempo real na aba "Bipagens Ao Vivo".
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Código EAN / Barcode
          </label>
          <input
            type="text"
            value={simulatorData.ean}
            onChange={(e) => setSimulatorData({ ...simulatorData, ean: e.target.value })}
            placeholder="Digite ou cole o código EAN"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-600 font-medium">Exemplos de EANs:</p>
            <div className="grid grid-cols-1 gap-1">
              {exampleEANs.map((example) => (
                <button
                  key={example.value}
                  onClick={() => setSimulatorData({ ...simulatorData, ean: example.value })}
                  className="text-left text-xs bg-gray-50 hover:bg-blue-50 px-3 py-1.5 rounded border border-gray-200 hover:border-blue-300 transition"
                >
                  <span className="font-mono text-blue-600">{example.value}</span>
                  <span className="text-gray-600 ml-2">- {example.label.split(' - ')[1]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scanner ID (Opcional)
            </label>
            <input
              type="text"
              value={simulatorData.scanner_id}
              onChange={(e) => setSimulatorData({ ...simulatorData, scanner_id: e.target.value })}
              placeholder="Ex: SCANNER_01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Machine ID (Opcional)
            </label>
            <input
              type="text"
              value={simulatorData.machine_id}
              onChange={(e) => setSimulatorData({ ...simulatorData, machine_id: e.target.value })}
              placeholder="Ex: MACHINE_01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Data/Hora do Evento
          </label>
          <input
            type="datetime-local"
            value={simulatorData.event_date.slice(0, 16)}
            onChange={(e) => {
              // Converte para ISO string mas remove o 'Z' para manter como horário local
              const localDate = new Date(e.target.value);
              const isoString = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, -1);
              setSimulatorData({ ...simulatorData, event_date: isoString });
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="pt-4 border-t">
          <button
            onClick={handleSimulate}
            disabled={isSimulating || !simulatorData.ean}
            className={`
              w-full px-6 py-3 rounded-lg font-medium transition flex items-center justify-center space-x-2
              ${isSimulating || !simulatorData.ean
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            `}
          >
            {isSimulating ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Simulando Bipagem...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Simular Bipagem</span>
              </>
            )}
          </button>
        </div>

        {simulationResult && (
          <div className={`p-4 rounded-lg ${simulationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {simulationResult.success ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 w-full">
                <h3 className={`text-sm font-medium ${simulationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {simulationResult.success ? 'Sucesso!' : 'Erro na simulação'}
                </h3>
                <div className={`mt-2 text-sm ${simulationResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  <p>{simulationResult.message}</p>
                  {simulationResult.data && (
                    <details className="mt-3">
                      <summary className="cursor-pointer font-medium hover:underline">
                        Ver detalhes da resposta
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-96 bg-white bg-opacity-50 p-3 rounded border border-gray-200">
                        {JSON.stringify(simulationResult.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                {simulationResult.success && simulationResult.data?.bip && (
                  <div className="mt-3 bg-white bg-opacity-70 p-3 rounded border border-green-300">
                    <h4 className="text-xs font-semibold text-green-900 mb-2">Bipagem Criada:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">ID:</span>
                        <span className="ml-2 font-mono font-medium">{simulationResult.data.bip.id}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">EAN:</span>
                        <span className="ml-2 font-mono font-medium">{simulationResult.data.bip.ean}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Produto:</span>
                        <span className="ml-2 font-medium">{simulationResult.data.bip.product_id}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                          simulationResult.data.bip.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {simulationResult.data.bip.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-green-700">
                      Acesse a aba "Bipagens Ao Vivo" para visualizar esta bipagem em tempo real!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Seção de Simulação de Venda/Conciliação */}
        {simulationResult?.success && simulationResult?.data?.bip?.status === 'pending' && (
          <div className="pt-4 border-t">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">Simulador de Venda no PDV</h3>
              <p className="text-sm text-purple-800">
                Agora você pode simular a passagem desta bipagem pelo caixa (PDV) para testá-la sendo verificada/conciliada.
                Isso mudará o status de <strong>pending</strong> para <strong>verified</strong>.
              </p>
            </div>

            <button
              onClick={handleSimulateSale}
              disabled={isSimulatingSale}
              className={`
                w-full px-6 py-3 rounded-lg font-medium transition flex items-center justify-center space-x-2
                ${isSimulatingSale
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
                }
              `}
            >
              {isSimulatingSale ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Simulando Venda...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Simular Venda no PDV (Conciliar)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Resultado da Simulação de Venda */}
        {saleResult && (
          <div className={`p-4 rounded-lg ${saleResult.success ? 'bg-purple-50 border border-purple-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {saleResult.success ? (
                  <svg className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 w-full">
                <h3 className={`text-sm font-medium ${saleResult.success ? 'text-purple-800' : 'text-red-800'}`}>
                  {saleResult.success ? 'Venda Conciliada!' : 'Erro na conciliação'}
                </h3>
                <div className={`mt-2 text-sm ${saleResult.success ? 'text-purple-700' : 'text-red-700'}`}>
                  <p>{saleResult.message}</p>
                  {saleResult.data && (
                    <details className="mt-3">
                      <summary className="cursor-pointer font-medium hover:underline">
                        Ver detalhes da resposta
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-96 bg-white bg-opacity-50 p-3 rounded border border-gray-200">
                        {JSON.stringify(saleResult.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                {saleResult.success && saleResult.data?.bip && (
                  <div className="mt-3 bg-white bg-opacity-70 p-3 rounded border border-purple-300">
                    <h4 className="text-xs font-semibold text-purple-900 mb-2">Bipagem Verificada:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">ID:</span>
                        <span className="ml-2 font-mono font-medium">{saleResult.data.bip.id}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {saleResult.data.bip.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Cupom Fiscal:</span>
                        <span className="ml-2 font-mono font-medium">{saleResult.data.bip.tax_cupon}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Produto:</span>
                        <span className="ml-2 font-medium">{saleResult.data.bip.product_id}</span>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                      <p className="text-xs text-green-800 font-medium flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Status alterado: pending → verified
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-purple-700">
                      A bipagem agora está verificada! Você pode visualizar a mudança na aba "Bipagens Ao Vivo".
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-900 mb-2">Dicas de Uso:</h4>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Use os EANs de exemplo para testar diferentes tipos de bipagens</li>
          <li>Código de colaborador (3122...) simula login de vendedor no equipamento</li>
          <li>EAN de peso (20...) simula bipagem de produtos pesados</li>
          <li>EAN de preço (78...) simula bipagem de produtos com preço fixo</li>
          <li>As bipagens aparecem com status "pending" por padrão</li>
          <li><strong>NOVO:</strong> Após criar uma bipagem, você pode simular a venda no PDV para conciliá-la</li>
          <li>A simulação de venda muda o status de "pending" para "verified" e gera um cupom fiscal</li>
          <li>Você pode cancelar ou verificar bipagens manualmente na aba "Bipagens Ao Vivo"</li>
        </ul>
      </div>
    </div>
  );
}
