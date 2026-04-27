import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

/**
 * Tela publica - candidato abre via /recrutamento/<token>
 * Sem auth. Suporta 3 modos: texto (chat), voz (Web Speech API), video (futuro).
 */
export default function RecrutamentoPublico() {
  const { token } = useParams();
  const [estado, setEstado] = useState('carregando');
  const [info, setInfo] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [input, setInput] = useState('');
  const [aguardandoIA, setAguardandoIA] = useState(false);
  const [erro, setErro] = useState(null);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const fimRef = useRef(null);

  // === Voice mode state ===
  const [vozFalando, setVozFalando] = useState(false);    // IA falando
  const [vozOuvindo, setVozOuvindo] = useState(false);    // candidato falando
  const recognitionRef = useRef(null);
  const ultimaIaMessageRef = useRef('');
  const modoVoz = info?.modo_entrevista === 'voz';

  // API base sem o /api porque este é endpoint público autenticado por token
  const API_BASE = (typeof window !== 'undefined' && window.location.origin) + '/api';

  useEffect(() => {
    fetch(`${API_BASE}/recrutador/publico/${token}`)
      .then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(d => {
        setInfo(d);
        if (d.historico && d.historico.length > 0) {
          // Reconstroi mensagens a partir do histórico
          const msgs = [];
          d.historico.forEach(h => {
            if (h.pergunta) msgs.push({ role: 'ia', content: h.pergunta });
            if (h.resposta) msgs.push({ role: 'eu', content: h.resposta });
          });
          setMensagens(msgs);
          setAceitouTermos(true);
        }
        setEstado('pronto');
      })
      .catch(e => { setErro(e.message); setEstado('erro'); });
  }, [token]);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens, aguardandoIA]);

  // ==================== VOICE: TTS ====================
  // Fala um texto usando a voz nativa do navegador (Web Speech API).
  // Tenta usar voz feminina em pt-BR se disponivel.
  const falarTTS = (texto) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // para qualquer fala anterior
      const utt = new SpeechSynthesisUtterance(texto);
      utt.lang = 'pt-BR';
      utt.rate = 1.0;
      utt.pitch = 1.05;
      // tentar voz feminina pt-BR
      const vozes = window.speechSynthesis.getVoices();
      // 1) Tenta usar a voz EXATA configurada pelo admin
      let escolhida = info?.voz_recrutadora ? vozes.find(v => v.name === info.voz_recrutadora) : null;
      // 2) Fallback: voz feminina pt-BR
      if (!escolhida) {
        escolhida = vozes.find(v => v.lang === 'pt-BR' && /female|mulher|maria|fernanda|helena/i.test(v.name))
                || vozes.find(v => v.lang === 'pt-BR')
                || vozes.find(v => v.lang.startsWith('pt'));
      }
      if (escolhida) utt.voice = escolhida;
      utt.onstart = () => setVozFalando(true);
      utt.onend = () => {
        setVozFalando(false);
        // ao terminar de falar, abrir microfone automaticamente
        if (modoVoz) iniciarReconhecimento();
      };
      utt.onerror = () => setVozFalando(false);
      window.speechSynthesis.speak(utt);
    } catch (err) {
      console.error('TTS erro:', err);
    }
  };

  // ==================== VOICE: STT ====================
  const iniciarReconhecimento = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Seu navegador não suporta reconhecimento de voz. Use Chrome/Edge ou troque pra modo texto.');
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'pt-BR';
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let textoFinal = '';
      rec.onstart = () => setVozOuvindo(true);
      rec.onresult = (ev) => {
        textoFinal = ev.results[0][0].transcript;
      };
      rec.onerror = (ev) => {
        console.error('STT erro:', ev.error);
        setVozOuvindo(false);
      };
      rec.onend = () => {
        setVozOuvindo(false);
        if (textoFinal && textoFinal.trim()) {
          enviarTextoVoz(textoFinal.trim());
        }
      };
      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error('STT inicio erro:', err);
      setVozOuvindo(false);
    }
  };

  const pararReconhecimento = () => {
    try { recognitionRef.current?.stop(); } catch {}
  };

  const enviarTextoVoz = async (texto) => {
    setMensagens(m => [...m, { role: 'eu', content: texto }]);
    setAguardandoIA(true);
    try {
      const r = await fetch(`${API_BASE}/recrutador/publico/${token}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resposta: texto }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      setMensagens(m => [...m, { role: 'ia', content: d.iaMessage }]);
      ultimaIaMessageRef.current = d.iaMessage;
      if (d.finalizada) setEstado('finalizada');
      // se modo voz, IA fala automaticamente
      if (modoVoz && d.iaMessage) {
        setTimeout(() => falarTTS(d.iaMessage), 200);
      }
    } catch (e) {
      setMensagens(m => [...m, { role: 'sistema', content: '⚠️ Erro: ' + e.message }]);
    } finally { setAguardandoIA(false); }
  };

  const iniciar = async () => {
    setAceitouTermos(true);
    setAguardandoIA(true);
    try {
      const r = await fetch(`${API_BASE}/recrutador/publico/${token}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resposta: '' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      setMensagens([{ role: 'ia', content: d.iaMessage }]);
      ultimaIaMessageRef.current = d.iaMessage;
      if (d.finalizada) setEstado('finalizada');
      // Se modo voz, IA fala a primeira mensagem
      if (modoVoz && d.iaMessage) {
        setTimeout(() => falarTTS(d.iaMessage), 300);
      }
    } catch (e) { setErro(e.message); }
    finally { setAguardandoIA(false); }
  };

  const enviar = async () => {
    if (!input.trim() || aguardandoIA) return;
    const minha = input.trim();
    setMensagens(m => [...m, { role: 'eu', content: minha }]);
    setInput('');
    setAguardandoIA(true);
    try {
      const r = await fetch(`${API_BASE}/recrutador/publico/${token}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resposta: minha }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      setMensagens(m => [...m, { role: 'ia', content: d.iaMessage }]);
      if (d.finalizada) setEstado('finalizada');
    } catch (e) {
      setMensagens(m => [...m, { role: 'sistema', content: '⚠️ Erro: ' + e.message + '. Tente enviar novamente.' }]);
    } finally { setAguardandoIA(false); }
  };

  if (estado === 'carregando') {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-500">Carregando...</p></div>;
  }

  if (estado === 'erro') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-bold mb-2">Link inválido ou expirado</h1>
          <p className="text-gray-600">{erro}</p>
          <p className="text-sm text-gray-500 mt-4">Entre em contato com o RH da empresa pra receber um novo link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 border-b border-gray-200">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="text-3xl">👩‍💼</span>
          <div>
            <h1 className="font-bold text-gray-900">Entrevista — {info?.vaga_titulo}</h1>
            <p className="text-xs text-gray-500">Candidato: {info?.candidato_nome}</p>
          </div>
        </div>
      </header>

      {/* Termos / Início */}
      {!aceitouTermos && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
            <h2 className="text-xl font-bold mb-3">Olá, {info?.candidato_nome}! 👋</h2>
            <p className="text-gray-700 mb-4">
              Você foi convidado(a) para uma entrevista para a vaga de <strong>{info?.vaga_titulo}</strong>.
            </p>
            <p className="text-gray-700 mb-4">
              A entrevista é conduzida pela <strong>{info?.nome_recrutadora || 'Helen'}</strong>, nossa recrutadora digital com IA. As perguntas são comportamentais — responda com naturalidade, contando situações reais que você viveu.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded text-sm text-blue-900 mb-4">
              <strong>📝 Dicas:</strong>
              <ul className="list-disc ml-5 mt-1">
                <li>Tome seu tempo pra responder com calma</li>
                <li>Use exemplos concretos do seu trabalho ou vida</li>
                <li>Seja honesto — vamos perceber se inventar</li>
              </ul>
            </div>

            {info?.modo_entrevista === 'voz' && (
              <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded text-sm text-orange-900 mb-4">
                <strong>🎤 Esta entrevista é por VOZ:</strong>
                <ul className="list-disc ml-5 mt-1">
                  <li>Você vai conversar com a {info?.nome_recrutadora || 'Helen'} falando no microfone</li>
                  <li>Use Chrome ou Edge atualizado (outros navegadores podem não funcionar)</li>
                  <li>Permita o acesso ao microfone quando o navegador pedir</li>
                  <li>Esteja num ambiente silencioso pra a IA entender bem</li>
                  <li>Se preferir, dá pra digitar também (botão "Preferir digitar?")</li>
                </ul>
              </div>
            )}
            <div className="bg-gray-50 border border-gray-200 p-3 rounded text-xs text-gray-700 mb-4">
              <strong>🔒 Privacidade:</strong> Suas respostas serão analisadas por IA e revisadas pelo RH. Os dados são armazenados de forma segura conforme a LGPD. Ao prosseguir, você concorda com o uso dessas informações para o processo seletivo.
            </div>
            <button onClick={iniciar} disabled={aguardandoIA}
              className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-medium text-lg disabled:opacity-50">
              {aguardandoIA ? 'Iniciando...' : '🚀 Começar Entrevista'}
            </button>
          </div>
        </div>
      )}

      {/* Chat */}
      {aceitouTermos && (
        <>
          <main className="flex-1 overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto space-y-4">
              {mensagens.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'eu' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    m.role === 'eu' ? 'bg-orange-500 text-white' :
                    m.role === 'sistema' ? 'bg-yellow-100 text-yellow-900 border border-yellow-300' :
                    'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    {m.role === 'ia' && <div className="text-xs text-orange-600 font-bold mb-1">👩‍💼 {info?.nome_recrutadora || 'Helen'}</div>}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
              {aguardandoIA && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse text-orange-500">👩‍💼</div>
                      <span className="text-sm text-gray-500">Pensando...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={fimRef} />
            </div>
          </main>

          {estado !== 'finalizada' && !modoVoz && (
            <footer className="bg-white border-t border-gray-200 p-4 sticky bottom-0">
              <div className="max-w-2xl mx-auto flex gap-2">
                <textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  rows={2} placeholder="Sua resposta..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-orange-500"
                  disabled={aguardandoIA} />
                <button onClick={enviar} disabled={aguardandoIA || !input.trim()}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50">
                  ▶ Enviar
                </button>
              </div>
            </footer>
          )}

          {/* Modo VOZ - controles de microfone e indicadores */}
          {estado !== 'finalizada' && modoVoz && (
            <footer className="bg-white border-t border-gray-200 p-4 sticky bottom-0">
              <div className="max-w-2xl mx-auto flex flex-col items-center gap-3">
                {vozFalando && (
                  <div className="flex items-center gap-2 text-orange-700 font-medium">
                    <span className="animate-pulse text-2xl">🔊</span>
                    <span>{info?.nome_recrutadora || 'Helen'} está falando...</span>
                  </div>
                )}
                {vozOuvindo && (
                  <div className="flex items-center gap-2 text-red-600 font-medium">
                    <span className="animate-pulse text-2xl">🔴</span>
                    <span>Ouvindo você... fale com calma</span>
                  </div>
                )}
                {!vozFalando && !vozOuvindo && !aguardandoIA && (
                  <button
                    onClick={iniciarReconhecimento}
                    className="w-24 h-24 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-4xl shadow-lg transition-transform hover:scale-105"
                    title="Clique pra falar"
                  >
                    🎤
                  </button>
                )}
                {vozOuvindo && (
                  <button
                    onClick={pararReconhecimento}
                    className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 text-white text-4xl shadow-lg"
                  >
                    ⏹️
                  </button>
                )}
                {aguardandoIA && (
                  <div className="text-gray-500 text-sm">Processando...</div>
                )}
                <div className="text-xs text-gray-500 text-center max-w-md">
                  {vozFalando ? 'Aguarde a Helen terminar de falar.' :
                   vozOuvindo ? 'Pode falar! O microfone fecha automaticamente quando você parar.' :
                   'Toque no microfone pra responder. Você também pode digitar abaixo se preferir.'}
                </div>
                {/* Fallback: caixa de texto sempre disponivel mesmo em modo voz */}
                <details className="w-full text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Preferir digitar?</summary>
                  <div className="flex gap-2 mt-2">
                    <textarea value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                      rows={2} placeholder="Digite a resposta..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                      disabled={aguardandoIA} />
                    <button onClick={enviar} disabled={aguardandoIA || !input.trim()}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm disabled:opacity-50">
                      Enviar
                    </button>
                  </div>
                </details>
              </div>
            </footer>
          )}

          {estado === 'finalizada' && (
            <footer className="bg-green-50 border-t border-green-200 p-4 text-center">
              <p className="text-green-900 font-medium">✅ Entrevista finalizada! Obrigado pelo seu tempo.</p>
              <p className="text-sm text-green-700 mt-1">Em breve o RH entrará em contato.</p>
            </footer>
          )}
        </>
      )}
    </div>
  );
}
