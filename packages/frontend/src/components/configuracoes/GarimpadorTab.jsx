import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function GarimpadorTab() {
  const [lojas, setLojas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [refCusto, setRefCusto] = useState('menor');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [testEan, setTestEan] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testErro, setTestErro] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setIsLoading(true);
    setErro('');
    try {
      const [resLojas, resConfig] = await Promise.all([
        api.get('/garimpador/lojas'),
        api.get('/garimpador/lojas-config'),
      ]);
      const listaLojas = resLojas.data?.lojas || [];
      setLojas(listaLojas);
      const selCfg = resConfig.data?.lojas || [1];
      setSelecionadas(selCfg);
      setRefCusto(resConfig.data?.refCusto === 'medio' ? 'medio' : 'menor');
    } catch (e) {
      setErro(e?.response?.data?.error || e.message || 'Erro ao carregar lojas');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLoja = (codigo) => {
    setSelecionadas((cur) =>
      cur.includes(codigo) ? cur.filter((c) => c !== codigo) : [...cur, codigo].sort((a, b) => a - b)
    );
  };

  const testar = async () => {
    setTestErro('');
    setTestResult(null);
    if (!testEan.trim()) {
      setTestErro('Informe o código de barras');
      return;
    }
    if (selecionadas.length === 0) {
      setTestErro('Selecione pelo menos uma loja antes de testar');
      return;
    }
    setTestLoading(true);
    try {
      const res = await api.post('/garimpador/test-barcode', {
        codigoBarras: testEan.trim(),
        lojas: selecionadas,
      });
      setTestResult(res.data);
    } catch (e) {
      setTestErro(e?.response?.data?.error || e.message || 'Erro ao testar');
    } finally {
      setTestLoading(false);
    }
  };

  const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const salvar = async () => {
    setErro('');
    setSucesso('');
    if (selecionadas.length === 0) {
      setErro('Selecione pelo menos uma loja');
      return;
    }
    setIsSaving(true);
    try {
      await api.post('/garimpador/lojas-config', { lojas: selecionadas, refCusto });
      setSucesso('Configuração salva com sucesso');
      setTimeout(() => setSucesso(''), 3000);
    } catch (e) {
      setErro(e?.response?.data?.error || e.message || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center text-gray-500 py-8">Carregando lojas...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border-l-4 border-orange-400 p-4 text-sm text-orange-800">
        <strong>Garimpador — Multi-loja:</strong> escolha quais lojas participam do cruzamento de produtos
        e como o custo/preço de referência deve ser calculado quando há mais de uma loja selecionada.
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{erro}</div>
      )}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm">{sucesso}</div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Lojas Participantes</label>
        {lojas.length === 0 ? (
          <div className="text-sm text-gray-500 italic">Nenhuma loja encontrada no ERP</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border rounded p-3 bg-white">
            {lojas.map((l) => (
              <label
                key={l.codigo}
                className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selecionadas.includes(l.codigo)}
                  onChange={() => toggleLoja(l.codigo)}
                  className="w-4 h-4 text-orange-600"
                />
                <span className="text-sm">
                  <strong>Loja {l.codigo}</strong> — {l.descricao}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Referência de Custo</label>
        <div className="space-y-2 border rounded p-3 bg-white">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="refCusto"
              value="menor"
              checked={refCusto === 'menor'}
              onChange={() => setRefCusto('menor')}
              className="w-4 h-4 text-orange-600"
            />
            <span className="text-sm">
              <strong>Menor custo entre as lojas</strong>
              <span className="text-gray-500"> — usa o menor custo dentre as lojas selecionadas</span>
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="refCusto"
              value="medio"
              checked={refCusto === 'medio'}
              onChange={() => setRefCusto('medio')}
              className="w-4 h-4 text-orange-600"
            />
            <span className="text-sm">
              <strong>Custo médio entre as lojas</strong>
              <span className="text-gray-500"> — soma os custos e divide pelo número de lojas</span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end border-t pt-4">
        <button
          onClick={salvar}
          disabled={isSaving}
          className={`px-6 py-2 rounded-lg font-medium transition ${
            isSaving ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-700'
          }`}
        >
          {isSaving ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>

      <div className="border-t pt-6 mt-2">
        <h3 className="text-base font-semibold text-gray-800 mb-2">🧪 Testar Cruzamento por Código de Barras</h3>
        <p className="text-xs text-gray-500 mb-3">
          Cole um EAN para ver o custo em cada loja selecionada. O menor custo é destacado em verde; quando "Custo médio" está ativo, exibe também a média das lojas.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <input
            type="text"
            value={testEan}
            onChange={(e) => setTestEan(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') testar(); }}
            placeholder="Ex.: 7891234567890"
            className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={testar}
            disabled={testLoading}
            className={`px-4 py-2 rounded text-sm font-medium ${
              testLoading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {testLoading ? 'Buscando...' : 'Testar'}
          </button>
        </div>

        {testErro && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{testErro}</div>
        )}

        {testResult && (
          <div className="mt-4 bg-white border rounded p-4">
            {testResult.produto ? (
              <>
                <div className="text-sm text-gray-700 mb-3">
                  <strong>Produto:</strong> {testResult.produto.descricao}
                  <span className="text-gray-400"> • Código {testResult.produto.codigo} • EAN {testResult.produto.ean}</span>
                </div>
                {testResult.lojas.length === 0 ? (
                  <div className="text-sm text-gray-500 italic">Produto não cadastrado em nenhuma das lojas selecionadas</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                        <tr>
                          <th className="text-left px-3 py-2">Loja</th>
                          <th className="text-right px-3 py-2">Custo</th>
                          <th className="text-right px-3 py-2">Preço Venda</th>
                          <th className="text-right px-3 py-2">Estoque</th>
                          {refCusto === 'medio' && (
                            <th className="text-right px-3 py-2 bg-orange-50">Custo Médio (ref)</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {testResult.lojas.map((l) => {
                          const isMenor = refCusto === 'menor' && l.custo > 0 && Math.abs(l.custo - testResult.menorCusto) < 0.001;
                          return (
                            <tr key={l.codigoLoja} className={isMenor ? 'bg-green-50' : ''}>
                              <td className="px-3 py-2">
                                <strong>Loja {l.codigoLoja}</strong>
                                <span className="text-gray-500"> — {l.nomeLoja}</span>
                                {isMenor && <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded">MENOR</span>}
                              </td>
                              <td className={`text-right px-3 py-2 tabular-nums ${isMenor ? 'font-bold text-green-700' : ''}`}>
                                {formatBRL(l.custo)}
                              </td>
                              <td className="text-right px-3 py-2 tabular-nums">{formatBRL(l.precoVenda)}</td>
                              <td className="text-right px-3 py-2 tabular-nums">{l.estoque}</td>
                              {refCusto === 'medio' && (
                                <td className="text-right px-3 py-2 tabular-nums font-semibold text-orange-700 bg-orange-50">
                                  {formatBRL(testResult.custoMedio)}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="text-xs text-gray-600">
                        <tr className="border-t">
                          <td className="px-3 py-2" colSpan={refCusto === 'medio' ? 5 : 4}>
                            {refCusto === 'menor' ? (
                              <>Referência: <strong className="text-green-700">menor custo = {formatBRL(testResult.menorCusto)}</strong></>
                            ) : (
                              <>Referência: <strong className="text-orange-700">custo médio = {formatBRL(testResult.custoMedio)}</strong> (soma dos custos ÷ {testResult.lojas.filter(l => l.custo > 0).length} lojas com preço)</>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-500 italic">Nenhum produto encontrado com esse código de barras</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
