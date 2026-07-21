import { useState, useEffect } from 'react';
import api from '../services/api';
import RadarLoading from '../components/RadarLoading';

/**
 * Sorteador — escolhe um grupo/comunidade do WhatsApp e sorteia ganhadores.
 *
 * ⚠️ O contador "sem número" NÃO é decoração: o WhatsApp oculta o telefone de
 * membro de comunidade, e em comunidade grande quase ninguém fica sorteável
 * (medido: Roldão 1713 membros → 2 números). Sem esse aviso na cara, o sorteio
 * parece cobrir todo mundo e pode estar cobrindo 2.
 */
export default function Sorteador() {
  const [grupos, setGrupos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [selecionado, setSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [excluirAdmins, setExcluirAdmins] = useState(true);

  const [sorteando, setSorteando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => { carregarGrupos(); }, []);

  const carregarGrupos = async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.get('/whatsapp/comunidades');
      setGrupos(data?.data || []);
    } catch (e) {
      setErro(e?.response?.data?.error || 'Não foi possível carregar os grupos.');
    } finally {
      setCarregando(false);
    }
  };

  const sortear = async () => {
    if (!selecionado?.sorteioId) return;
    setSorteando(true);
    setErro('');
    setResultado(null);
    try {
      const { data } = await api.post('/whatsapp/sorteio', {
        sorteioId: selecionado.sorteioId,
        quantidade,
        excluirAdmins,
      });
      setResultado(data?.data || null);
    } catch (e) {
      setErro(e?.response?.data?.error || 'Erro ao sortear.');
    } finally {
      setSorteando(false);
    }
  };

  // 5512988426869 -> (12) 98842-6869
  const formatarTelefone = (t) => {
    const n = String(t || '').replace(/\D/g, '').replace(/^55/, '');
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return t;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold">🎲 Sorteador</h1>
        <p className="text-orange-100 text-sm">
          Sorteie ganhadores entre os membros dos seus grupos e comunidades do WhatsApp
        </p>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
          {erro}
        </div>
      )}

      {carregando ? (
        <RadarLoading message="Buscando seus grupos no WhatsApp..." />
      ) : grupos.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          Nenhum grupo ou comunidade encontrado onde você seja administrador.
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">1. Escolha o grupo</h2>
              <button
                onClick={carregarGrupos}
                className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-md"
              >
                🔄 Atualizar
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {grupos.map((g) => {
                const ativo = selecionado?.id === g.id;
                const nenhum = g.sorteaveis === 0;
                return (
                  <button
                    key={g.id}
                    onClick={() => { setSelecionado(g); setResultado(null); }}
                    disabled={nenhum}
                    className={`text-left rounded-lg border-2 p-4 transition ${
                      ativo
                        ? 'border-orange-500 bg-orange-50'
                        : nenhum
                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-gray-200 bg-white hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{g.nome}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                        g.tipo === 'comunidade'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {g.tipo === 'comunidade' ? 'COMUNIDADE' : 'GRUPO'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-orange-600">{g.sorteaveis}</span>
                      <span className="text-xs text-gray-500">de {g.totalMembros} sorteáveis</span>
                    </div>

                    {g.semNumero > 0 && (
                      <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
                        ⚠️ {g.semNumero} sem número visível — o WhatsApp oculta
                        o telefone de membro de comunidade
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selecionado && (
            <div className="bg-white rounded-lg border p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">
                2. Sortear em <span className="text-orange-600">{selecionado.nome}</span>
              </h2>

              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Quantos ganhadores</label>
                  <input
                    type="number"
                    min="1"
                    max={selecionado.sorteaveis}
                    value={quantidade}
                    onChange={(e) => setQuantidade(Number(e.target.value))}
                    className="w-32 border rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                  <input
                    type="checkbox"
                    checked={excluirAdmins}
                    onChange={(e) => setExcluirAdmins(e.target.checked)}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  Não sortear administradores (você e sua equipe)
                </label>

                <button
                  onClick={sortear}
                  disabled={sorteando}
                  className="ml-auto bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-md"
                >
                  {sorteando ? 'Sorteando...' : '🎲 Sortear'}
                </button>
              </div>
            </div>
          )}

          {resultado && (
            <div className="bg-white rounded-lg border-2 border-orange-500 p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-1">
                🏆 {resultado.ganhadores.length > 1 ? 'Ganhadores' : 'Ganhador'}
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                {resultado.comunidade} · {new Date(resultado.sorteadoEm).toLocaleString('pt-BR')}
              </p>

              <div className="space-y-2">
                {resultado.ganhadores.map((tel, i) => (
                  <div
                    key={tel}
                    className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3"
                  >
                    <span className="text-orange-600 font-bold">{i + 1}º</span>
                    <span className="font-mono font-semibold text-gray-900">
                      {formatarTelefone(tel)}
                    </span>
                    <a
                      href={`https://wa.me/${tel}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-sm text-green-700 hover:underline"
                    >
                      Abrir conversa →
                    </a>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t text-xs text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
                <span>Concorreram: <strong>{resultado.participaram}</strong></span>
                <span>Total de membros: <strong>{resultado.totalMembros}</strong></span>
                {resultado.semNumero > 0 && (
                  <span className="text-amber-700">
                    Ficaram de fora (sem número): <strong>{resultado.semNumero}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
