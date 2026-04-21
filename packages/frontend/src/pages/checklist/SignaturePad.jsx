import { useRef, useEffect, useState } from 'react';

/**
 * Pad de assinatura via canvas (dedo/mouse).
 *
 * props:
 *   value: URL (data:image/png;base64,...) atual (opcional)
 *   onChange(dataUrl | null)
 *   label: string rotulo
 */
export default function SignaturePad({ value, onChange, label = 'Assinatura' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const [temAssinatura, setTemAssinatura] = useState(!!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Define resolução interna pelo tamanho do container (alta DPI)
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Se veio valor inicial, desenha
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
      setTemAssinatura(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pontoDoEvento = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const iniciar = (e) => {
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = pontoDoEvento(e);
  };

  const mover = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pontoDoEvento(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
  };

  const parar = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setTemAssinatura(true);
    onChange?.(dataUrl);
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemAssinatura(false);
    onChange?.(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          ✍️ {label}
        </label>
        <button type="button" onClick={limpar}
          className="text-xs text-red-600 hover:text-red-800 font-medium">
          Limpar
        </button>
      </div>
      <div ref={containerRef}
        className={`border-2 rounded-lg bg-gray-50 ${temAssinatura ? 'border-teal-300' : 'border-dashed border-gray-300'} transition`}>
        <canvas
          ref={canvasRef}
          className="w-full block rounded-lg touch-none"
          style={{ height: 180, cursor: 'crosshair' }}
          onMouseDown={iniciar}
          onMouseMove={mover}
          onMouseUp={parar}
          onMouseLeave={parar}
          onTouchStart={iniciar}
          onTouchMove={mover}
          onTouchEnd={parar}
        />
      </div>
      <div className="text-[11px] text-gray-500 mt-1 italic">
        {temAssinatura ? '✅ Assinado' : '✏️ Desenhe com o dedo ou mouse no espaço acima'}
      </div>
    </div>
  );
}
