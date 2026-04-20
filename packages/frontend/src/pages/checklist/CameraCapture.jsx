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
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/70 text-white p-3 flex items-center justify-between">
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

      {/* Stream */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {erro ? (
          <div className="text-center p-6">
            <div className="text-5xl mb-3">🎥</div>
            <div className="text-white text-base font-semibold mb-2">Câmera não disponível</div>
            <div className="text-white/70 text-sm max-w-md mx-auto">{erro}</div>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="max-w-full max-h-full" />
            {!ready && <div className="absolute text-white/80 text-sm">Abrindo câmera…</div>}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Botão capturar */}
      <div className="bg-black/70 py-5 flex items-center justify-center">
        <button
          onClick={capturar}
          disabled={!ready || capturando || !!erro}
          className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition ${!ready || erro ? 'bg-gray-500 opacity-50' : 'bg-white hover:scale-105 active:scale-95'}`}
          title="Capturar"
        >
          <div className={`w-14 h-14 rounded-full ${ready && !erro ? 'bg-red-500' : 'bg-gray-400'}`} />
        </button>
      </div>
    </div>
  );
}
