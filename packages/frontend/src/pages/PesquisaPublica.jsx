import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

export default function PesquisaPublica() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [respostas, setRespostas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [iniciadoEm] = useState(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/pesquisa-clima/publico/${token}`);
        setData(r.data);
        // Bloqueio adicional via localStorage
        if (r.data.ja_respondeu || localStorage.getItem(`pesquisa_${token}_done`) === '1') {
          setErro('Você já respondeu esta pesquisa anteriormente. Obrigado pela contribuição!');
        }
      } catch (e) {
        setErro(e.response?.data?.error || 'Erro ao carregar pesquisa');
      } finally { setLoading(false); }
    })();
  }, [token]);

  const setResp = (perguntaId, valor) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: { ...(prev[perguntaId] || {}), valor } }));
  };

  const enviar = async () => {
    if (!data) return;
    // Valida obrigatorias
    const faltando = data.perguntas.filter(p => p.obrigatoria && (
      respostas[p.id]?.valor === undefined ||
      respostas[p.id]?.valor === '' ||
      respostas[p.id]?.valor === null ||
      (Array.isArray(respostas[p.id]?.valor) && respostas[p.id].valor.length === 0)
    ));
    if (faltando.length > 0) {
      toast.error(`Falta responder: "${faltando[0].enunciado.slice(0, 60)}"`);
      return;
    }

    setEnviando(true);
    try {
      const tempo_segundos = Math.round((Date.now() - iniciadoEm) / 1000);
      const arr = Object.entries(respostas).map(([pid, r]) => ({
        pergunta_id: parseInt(pid),
        valor: r.valor,
        colaborador_id: r.colaborador_id,
        setor_id: r.setor_id,
      }));
      await api.post(`/pesquisa-clima/publico/${token}/submeter`, { respostas: arr, tempo_segundos });
      localStorage.setItem(`pesquisa_${token}_done`, '1');
      setEnviado(true);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao enviar');
    } finally { setEnviando(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-orange-50">
        <div className="text-center">
          <div className="text-4xl mb-2">⏳</div>
          <div>Carregando pesquisa...</div>
        </div>
      </div>
    );
  }
  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-orange-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-6xl mb-3">🤝</div>
          <h1 className="text-xl font-bold text-rose-700 mb-2">Obrigado!</h1>
          <p className="text-gray-700">{erro}</p>
        </div>
      </div>
    );
  }
  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
          <div className="text-6xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-emerald-700 mb-2">Resposta enviada!</h1>
          <p className="text-gray-700">Obrigado pela sua contribuição. Sua resposta é anônima.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 pb-20">
      <div className="bg-gradient-to-r from-rose-600 to-orange-500 text-white px-4 py-6 shadow">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-5xl">{data.rodada.icone || '📋'}</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{data.rodada.modelo_nome}</h1>
              <p className="text-rose-100 text-sm">{data.rodada.nome}</p>
            </div>
          </div>
          {data.rodada.modelo_descricao && (
            <p className="text-sm text-rose-50 mt-3 leading-relaxed">{data.rodada.modelo_descricao}</p>
          )}
          {data.rodada.anonima && (
            <div className="mt-3 inline-flex items-center gap-1 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs">
              🔒 Pesquisa 100% anônima
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {agrupaPorSecao(data.perguntas).map(([secao, perguntas]) => (
          <div key={secao}>
            {secao && <h2 className="text-lg font-bold text-rose-700 mt-4 mb-2 px-2">{secao}</h2>}
            {perguntas.map((p, idx) => (
              <div key={p.id} className="bg-white rounded-lg shadow p-4 mb-3 border-l-4 border-rose-400">
                <div className="font-semibold text-gray-800 mb-3">
                  {p.enunciado} {p.obrigatoria && <span className="text-red-500">*</span>}
                </div>
                <PerguntaInput pergunta={p} valor={respostas[p.id]?.valor}
                  onChange={(v) => setResp(p.id, v)} />
              </div>
            ))}
          </div>
        ))}

        <button onClick={enviar} disabled={enviando}
          className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg disabled:opacity-50 mt-4">
          {enviando ? 'Enviando...' : '✅ Enviar Respostas'}
        </button>
      </div>
    </div>
  );
}

function agrupaPorSecao(perguntas) {
  const grupos = {};
  perguntas.forEach(p => {
    const k = p.secao || '';
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(p);
  });
  return Object.entries(grupos);
}

function PerguntaInput({ pergunta, valor, onChange }) {
  const cfg = pergunta.configuracao || {};

  if (pergunta.tipo === 'rating_5_matriz') {
    const matriz = valor || {};
    return (
      <div className="space-y-2">
        {(cfg.criterios || []).map(c => (
          <div key={c} className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[150px] text-sm">{c}</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n}
                  onClick={() => onChange({ ...matriz, [c]: n })}
                  className={`w-9 h-9 rounded-lg border-2 font-bold transition ${
                    matriz[c] === n ? 'bg-rose-500 text-white border-rose-500' : 'bg-gray-50 hover:bg-rose-50 border-gray-200'
                  }`}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (pergunta.tipo === 'nps_0_10') {
    return (
      <div>
        <div className="flex flex-wrap gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n}
              onClick={() => onChange(n)}
              className={`w-10 h-10 rounded-lg border-2 font-bold transition ${
                valor === n
                  ? (n >= 9 ? 'bg-emerald-500 border-emerald-500 text-white' : n >= 7 ? 'bg-amber-500 border-amber-500 text-white' : 'bg-red-500 border-red-500 text-white')
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}>{n}</button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
          <span>Não recomendaria</span>
          <span>Recomendaria muito</span>
        </div>
      </div>
    );
  }

  if (pergunta.tipo === 'multipla_escolha' || pergunta.tipo === 'sim_nao') {
    const opcoes = pergunta.tipo === 'sim_nao' ? ['Sim', 'Não'] : (cfg.opcoes || []);
    return (
      <div className="space-y-2">
        {opcoes.map(o => (
          <label key={o} className="flex items-center gap-2 p-2 rounded hover:bg-rose-50 cursor-pointer">
            <input type="radio" name={`p-${pergunta.id}`} checked={valor === o} onChange={() => onChange(o)}
              className="w-4 h-4 accent-rose-500" />
            <span>{o}</span>
          </label>
        ))}
      </div>
    );
  }

  if (pergunta.tipo === 'checkbox') {
    const sel = Array.isArray(valor) ? valor : [];
    return (
      <div className="space-y-2">
        {(cfg.opcoes || []).map(o => (
          <label key={o} className="flex items-center gap-2 p-2 rounded hover:bg-rose-50 cursor-pointer">
            <input type="checkbox" checked={sel.includes(o)}
              onChange={() => {
                const next = sel.includes(o) ? sel.filter(x => x !== o) : [...sel, o];
                onChange(next);
              }}
              className="w-4 h-4 accent-rose-500" />
            <span>{o}</span>
          </label>
        ))}
      </div>
    );
  }

  if (pergunta.tipo === 'texto_curto') {
    return <input type="text" value={valor || ''} onChange={e => onChange(e.target.value)}
      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-rose-400 focus:outline-none" />;
  }

  if (pergunta.tipo === 'texto_longo') {
    return <textarea value={valor || ''} onChange={e => onChange(e.target.value)}
      rows={3}
      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-rose-400 focus:outline-none" />;
  }

  return <div className="text-xs text-red-500">Tipo de pergunta não suportado: {pergunta.tipo}</div>;
}
