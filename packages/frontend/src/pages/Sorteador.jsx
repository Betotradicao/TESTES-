import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

/**
 * Sorteador — escolhe um grupo/comunidade do WhatsApp e sorteia ganhadores,
 * com roleta girando dígito a dígito e fogos no final.
 *
 * ⚠️ Os contadores do rodapé são DOIS de propósito: "sem número visível" (o
 * WhatsApp ocultou — limitação real) e "administradores fora" (filtro que o
 * usuário ligou). Juntar os dois faz o resultado mentir. Ver
 * bugs-resolvidos/2026-07-20-comunidade-whatsapp-numeros-ocultos-lid.
 */

const CORES_FOGOS = [
  '#f97316', '#fb923c', '#fbbf24', '#facc15', '#22c55e',
  '#38bdf8', '#a855f7', '#ec4899', '#ef4444',
];

/** Fogos de artifício em canvas — sem lib externa (CSP/bundle enxutos). */
function useFogos(ativo) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!ativo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let raf;
    let particulas = [];
    let disparos = 0;

    const redimensionar = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    redimensionar();
    window.addEventListener('resize', redimensionar);

    const explodir = (x, y) => {
      const cor = CORES_FOGOS[Math.floor(Math.random() * CORES_FOGOS.length)];
      for (let i = 0; i < 46; i++) {
        const ang = (Math.PI * 2 * i) / 46;
        const vel = 2 + Math.random() * 4;
        particulas.push({
          x, y,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel,
          vida: 1,
          cor: Math.random() > 0.25 ? cor : '#fff',
          raio: 1.5 + Math.random() * 2,
        });
      }
    };

    const intervalo = setInterval(() => {
      if (disparos++ > 7) return clearInterval(intervalo);
      explodir(
        canvas.width * (0.15 + Math.random() * 0.7),
        canvas.height * (0.1 + Math.random() * 0.45),
      );
    }, 420);

    const animar = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particulas = particulas.filter((p) => p.vida > 0.02);
      for (const p of particulas) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.055;      // gravidade
        p.vx *= 0.985;      // arrasto
        p.vida *= 0.962;
        ctx.globalAlpha = Math.max(0, p.vida);
        ctx.fillStyle = p.cor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(animar);
    };
    animar();

    return () => {
      clearInterval(intervalo);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', redimensionar);
    };
  }, [ativo]);

  return canvasRef;
}

/** 5512997778281 -> ['1','2','9','9','7','7','7','8','2','8','1'] (sem o 55) */
const digitosDoTelefone = (tel) =>
  String(tel || '').replace(/\D/g, '').replace(/^55/, '').split('');

const formatarTelefone = (tel) => {
  const n = digitosDoTelefone(tel).join('');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return tel;
};

/**
 * Mesmo telefone, com o ultimo digito virando "*".
 * Precisa valer no resumo e no podio tambem: esconder so na roleta nao adianta
 * nada se o numero inteiro aparece logo abaixo — o "*" vira enfeite.
 */
const formatarTelefoneMascarado = (tel, revelar) => {
  const txt = formatarTelefone(tel);
  return revelar ? txt : txt.slice(0, -1) + '*';
};

/**
 * Roleta: cada dígito gira e trava da esquerda pra direita.
 * O ÚLTIMO fica escondido como "*" até o usuário clicar no olhinho — é o
 * suspense que o Roberto pediu.
 */
function Roleta({ telefone, girando, travados, revelarUltimo }) {
  const digitos = digitosDoTelefone(telefone);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!girando) return;
    const i = setInterval(() => setTick((t) => t + 1), 60);
    return () => clearInterval(i);
  }, [girando]);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
      {digitos.map((d, i) => {
        const travado = i < travados;
        const ehUltimo = i === digitos.length - 1;
        const escondido = travado && ehUltimo && !revelarUltimo;

        let mostra;
        if (escondido) mostra = '*';
        else if (travado) mostra = d;
        else mostra = String((Math.floor(Math.random() * 10) + tick + i) % 10);

        return (
          <span key={i} className="contents">
            {(i === 2 || i === 7) && (
              <span className="w-2 sm:w-3 text-white/40 text-2xl font-light select-none">·</span>
            )}
            <span
              className={`
                inline-flex items-center justify-center rounded-xl font-mono font-black
                w-9 h-14 sm:w-12 sm:h-20 text-2xl sm:text-4xl transition-all duration-300
                ${travado
                  ? escondido
                    ? 'bg-gradient-to-b from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/40 scale-105'
                    : 'bg-white text-orange-600 shadow-lg shadow-black/20 scale-105'
                  : 'bg-white/15 text-white/70 backdrop-blur-sm animate-pulse'}
              `}
            >
              {mostra}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function Sorteador() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [grupos, setGrupos] = useState([]);
  const [numeroInstancia, setNumeroInstancia] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [grupoId, setGrupoId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [excluirAdmins, setExcluirAdmins] = useState(true);

  const [sorteando, setSorteando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Estado da animação
  const [girando, setGirando] = useState(false);
  const [travados, setTravados] = useState(0);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [revelados, setRevelados] = useState([]);   // ganhadores já animados
  const [revelarUltimo, setRevelarUltimo] = useState(false);
  const [terminou, setTerminou] = useState(false);

  const timers = useRef([]);
  const canvasFogos = useFogos(terminou);

  const selecionado = grupos.find((g) => g.id === grupoId) || null;

  useEffect(() => {
    carregarGrupos();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const carregarGrupos = async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.get('/whatsapp/comunidades');
      setGrupos(data?.data || []);
      setNumeroInstancia(data?.numeroInstancia || '');
    } catch (e) {
      setErro(e?.response?.data?.error || 'Não foi possível carregar os grupos.');
    } finally {
      setCarregando(false);
    }
  };

  const limparAnimacao = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setGirando(false);
    setTravados(0);
    setIndiceAtual(0);
    setRevelados([]);
    setRevelarUltimo(false);
    setTerminou(false);
  };

  /** Trava os dígitos um a um; ao acabar, empurra pro pódio e chama o próximo. */
  const animarGanhador = useCallback((ganhadores, idx) => {
    const total = digitosDoTelefone(ganhadores[idx]).length;
    setIndiceAtual(idx);
    setTravados(0);
    setRevelarUltimo(false);
    setGirando(true);

    for (let d = 1; d <= total; d++) {
      timers.current.push(setTimeout(() => setTravados(d), 700 + d * 380));
    }

    timers.current.push(setTimeout(() => {
      setGirando(false);
      const ehUltimo = idx === ganhadores.length - 1;
      if (ehUltimo) {
        setTerminou(true);
      } else {
        timers.current.push(setTimeout(() => {
          setRevelados((r) => [...r, ganhadores[idx]]);
          animarGanhador(ganhadores, idx + 1);
        }, 2200));
      }
    }, 700 + total * 380 + 250));
  }, []);

  const sortear = async () => {
    if (!selecionado?.sorteioId) return;
    limparAnimacao();
    setSorteando(true);
    setErro('');
    setResultado(null);
    try {
      const { data } = await api.post('/whatsapp/sorteio', {
        sorteioId: selecionado.sorteioId,
        quantidade,
        excluirAdmins,
      });
      const r = data?.data;
      setResultado(r);
      if (r?.ganhadores?.length) animarGanhador(r.ganhadores, 0);
    } catch (e) {
      setErro(e?.response?.data?.error || 'Erro ao sortear.');
    } finally {
      setSorteando(false);
    }
  };

  const ganhadorAtual = resultado?.ganhadores?.[indiceAtual];
  const totalGanhadores = resultado?.ganhadores?.length || 0;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={sidebarOpen}
        setIsMobileMenuOpen={setSidebarOpen}
      />

      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-xl p-6 text-white shadow-lg">
            <h1 className="text-2xl font-bold flex items-center gap-2">🎲 Sorteador</h1>
            <p className="text-orange-100 text-sm">
              Sorteie ganhadores entre os membros dos seus grupos e comunidades do WhatsApp
            </p>
            {numeroInstancia && (
              <p className="text-orange-100/80 text-xs mt-2">
                Lista baseada no WhatsApp do sistema
                (<strong>{formatarTelefone(numeroInstancia)}</strong>). Grupo que não aparece
                aqui é grupo onde esse número não é administrador.
              </p>
            )}
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
              {erro}
            </div>
          )}

          {/* Configuração */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <div className="grid gap-4 md:grid-cols-12 items-end">
              <div className="md:col-span-6">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                  Grupo ou comunidade
                </label>
                <select
                  value={grupoId}
                  onChange={(e) => { setGrupoId(e.target.value); limparAnimacao(); setResultado(null); }}
                  disabled={carregando}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                >
                  <option value="">
                    {carregando ? 'Carregando seus grupos...' : 'Selecione um grupo...'}
                  </option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id} disabled={g.sorteaveis === 0}>
                      {g.tipo === 'comunidade' ? '🏘️' : '👥'} {g.nome} — {g.sorteaveis} sorteáve{g.sorteaveis === 1 ? 'l' : 'is'}
                      {g.sorteaveis === 0 ? ' (ninguém com número)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                  Ganhadores
                </label>
                <input
                  type="number"
                  min="1"
                  max={selecionado?.sorteaveis || 1}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  disabled={!selecionado}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                />
              </div>

              <div className="md:col-span-4 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={excluirAdmins}
                    onChange={(e) => setExcluirAdmins(e.target.checked)}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  Não sortear administradores
                </label>
                <button
                  onClick={carregarGrupos}
                  title="Atualizar lista de grupos"
                  className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg"
                >
                  🔄
                </button>
              </div>
            </div>

            {selecionado && (
              <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600">
                <span>
                  Concorrendo: <strong className="text-orange-600 text-sm">{selecionado.sorteaveis}</strong>
                </span>
                <span>Total de membros: <strong>{selecionado.totalMembros}</strong></span>
                {selecionado.semNumero > 0 && (
                  <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded">
                    ⚠️ {selecionado.semNumero} sem número visível — o WhatsApp oculta o
                    telefone de membro de comunidade, então essas pessoas não entram
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Palco do sorteio */}
          {selecionado && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-700 via-orange-600 to-amber-500 shadow-2xl">
              <canvas
                ref={canvasFogos}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />

              <div className="relative z-0 p-6 sm:p-10 text-center">
                {!resultado ? (
                  <>
                    <p className="text-white/90 text-sm mb-1">Sorteando em</p>
                    <h2 className="text-white text-xl sm:text-2xl font-bold mb-6">
                      {selecionado.nome}
                    </h2>
                    <button
                      onClick={sortear}
                      disabled={sorteando || selecionado.sorteaveis === 0}
                      className="bg-white text-orange-600 font-black text-lg px-10 py-4 rounded-full shadow-xl hover:scale-105 active:scale-95 transition disabled:opacity-60 disabled:hover:scale-100"
                    >
                      {sorteando ? '⏳ Sorteando...' : '🎲 SORTEAR AGORA'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-white/90 text-sm">
                      {girando ? '🥁 Sorteando...' : terminou ? '🎉 Temos ganhador!' : '⏳ Próximo...'}
                    </p>
                    {totalGanhadores > 1 && (
                      <p className="text-white font-bold text-lg mt-1">
                        {indiceAtual + 1}º de {totalGanhadores}
                      </p>
                    )}

                    <div className="my-8">
                      <Roleta
                        telefone={ganhadorAtual}
                        girando={girando}
                        travados={travados}
                        revelarUltimo={revelarUltimo}
                      />
                    </div>

                    {!girando && travados > 0 && (
                      <button
                        onClick={() => setRevelarUltimo((v) => !v)}
                        className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur text-white text-sm font-semibold px-5 py-2.5 rounded-full transition"
                      >
                        {revelarUltimo ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                            Esconder último dígito
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Revelar último dígito
                          </>
                        )}
                      </button>
                    )}

                    {revelados.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-white/20">
                        <p className="text-white/70 text-xs uppercase tracking-wide mb-3">
                          Já sorteados
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {revelados.map((t, i) => (
                            <span
                              key={t}
                              className="bg-white/20 backdrop-blur text-white font-mono text-sm px-3 py-1.5 rounded-full"
                            >
                              {i + 1}º {formatarTelefoneMascarado(t, revelarUltimo)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {terminou && (
                      <button
                        onClick={() => { limparAnimacao(); setResultado(null); }}
                        className="mt-8 bg-white text-orange-600 font-bold px-8 py-3 rounded-full shadow-xl hover:scale-105 transition"
                      >
                        🎲 Sortear de novo
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Resumo — só depois que a animação acaba, pra não estragar o suspense */}
          {terminou && resultado && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-1">
                🏆 {totalGanhadores > 1 ? 'Ganhadores' : 'Ganhador'}
              </h3>
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
                      {formatarTelefoneMascarado(tel, revelarUltimo)}
                    </span>
                    {revelarUltimo ? (
                      <a
                        href={`https://wa.me/${tel}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-sm text-green-700 hover:underline"
                      >
                        Abrir conversa →
                      </a>
                    ) : (
                      // O link carrega o numero completo na URL — some junto com o "*"
                      <span className="ml-auto text-xs text-gray-400">
                        revele o último dígito para abrir
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t text-xs text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
                <span>Concorreram: <strong>{resultado.participaram}</strong></span>
                <span>Total de membros: <strong>{resultado.totalMembros}</strong></span>
                {resultado.adminsExcluidos > 0 && (
                  <span>
                    Administradores fora (você escolheu):{' '}
                    <strong>{resultado.adminsExcluidos}</strong>
                  </span>
                )}
                {resultado.semNumero > 0 && (
                  <span className="text-amber-700">
                    Sem número visível (WhatsApp ocultou):{' '}
                    <strong>{resultado.semNumero}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
