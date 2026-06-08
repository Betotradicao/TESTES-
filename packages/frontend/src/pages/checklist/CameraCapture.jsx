import { useEffect, useRef, useState } from 'react';

/**
 * Captura foto via câmera (getUserMedia). Sem opção de galeria.
 *
 * props:
 *   onCapture(blob)  — chamado com o Blob da foto capturada
 *   onClose()         — fecha sem capturar
 *   facingMode        — 'environment' (traseira, default) ou 'user' (frontal)
 */
export default function CameraCapture({ onCapture, onClose, facingMode = 'environment' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [erro, setErro] = useState('');
  const [ready, setReady] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [facing, setFacing] = useState(facingMode);

  useEffect(() => {
    (async () => {
      setErro('');
      setReady(false);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Navegador sem suporte a câmera nativa');
        }
        // Para stream anterior se houver
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        setErro(e?.message?.includes('Permission') || e?.name === 'NotAllowedError'
          ? 'Permissão da câmera negada. Habilite nas configurações do navegador.'
          : (e?.message || 'Não foi possível abrir a câmera.'));
      }
    })();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line
  }, [facing]);

  // Fallback: input file com capture, abre a camera NATIVA do celular.
  // Funciona em qualquer WebView/browser, ate quando getUserMedia falha em silencio.
  const onFileFallback = (e) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
  };

  const capturar = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturando(true);
    try {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth || 1280;
      c.height = v.videoHeight || 720;
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.9));
      if (blob) onCapture(blob);
    } catch (e) {
      setErro('Falha ao capturar imagem: ' + (e?.message || e));
    } finally {
      setCapturando(false);
    }
  };

  const trocarCamera = () => setFacing(f => f === 'environment' ? 'user' : 'environment');

  return (
    // 100dvh = altura dinamica do viewport mobile (descontando barra do browser
    // que aparece/some). Sem isso, o botao fica abaixo da barra em alguns celulares.
    // Fallback `height:100vh` cobre browsers velhos que nao suportam dvh.
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      style={{ height: '100vh', minHeight: '100dvh' }}
    >
      {/* Header — flex-shrink-0 garante que NAO encolhe quando viewport e curto */}
      <div className="bg-black/70 text-white p-3 flex items-center justify-between flex-shrink-0">
        <button onClick={onClose} className="text-white/90 hover:text-white text-sm font-medium flex items-center gap-1">
          ← Cancelar
        </button>
        <div className="text-sm font-semibold">📷 Câmera</div>
        <button onClick={trocarCamera} className="text-white/90 hover:text-white" title="Trocar câmera">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
          </svg>
        </button>
      </div>

      {/* Stream — min-h-0 e CRITICO em flex children: sem isso o video estica
          e empurra o botao pra fora do viewport visivel em mobile. */}
      <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center overflow-hidden">
        {erro ? (
          <div className="text-center p-6 flex flex-col items-center gap-3">
            <div className="text-5xl">🎥</div>
            <div className="text-white text-base font-semibold">Câmera não disponível</div>
            <div className="text-white/70 text-sm max-w-md mx-auto">{erro}</div>
            {/* Fallback: input file abre camera nativa do celular */}
            <label className="mt-2 inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-3 rounded-lg cursor-pointer active:scale-95 transition">
              📸 Tirar foto pela câmera do celular
              <input type="file" accept="image/*" capture={facing === 'user' ? 'user' : 'environment'} className="hidden" onChange={onFileFallback} />
            </label>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-contain"
            />
            {!ready && <div className="absolute text-white/80 text-sm">Abrindo câmera…</div>}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Botão capturar — flex-shrink-0 + safe-area-inset-bottom (iPhone home
          indicator + Android nav bar). py-5 minimo garantido. */}
      <div
        className="bg-black/70 flex items-center justify-center flex-shrink-0"
        style={{ paddingTop: 20, paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={capturar}
          disabled={!ready || capturando || !!erro}
          className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition ${!ready || erro ? 'bg-gray-500 opacity-50' : 'bg-white hover:scale-105 active:scale-95'}`}
          title="Capturar"
          aria-label="Tirar foto"
        >
          <div className={`w-14 h-14 rounded-full ${ready && !erro ? 'bg-red-500' : 'bg-gray-400'}`} />
        </button>
      </div>
    </div>
  );
}
