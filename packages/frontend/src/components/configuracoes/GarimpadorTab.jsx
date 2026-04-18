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
    </div>
  );
}
