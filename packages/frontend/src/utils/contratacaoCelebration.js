// Comemoração ao contratar candidato: confete + som de palmas/AEEEE
import confetti from 'canvas-confetti';

/** Toca som de palmas + grito de AEEEE usando Web Audio API
 *  (assim nao precisa de arquivo externo nem CORS) */
function tocarSomComemoracao() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // 1) Palmas: sequencia de bursts curtos de noise branco filtrado
    const tocarPalma = (delay) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        // envelope de decay rapido
        const env = Math.pow(1 - i / data.length, 2);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.value = 0.6;
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(ctx.currentTime + delay);
    };

    // Sequencia de 12 palmas em ritmo
    for (let i = 0; i < 12; i++) {
      tocarPalma(0.05 + i * 0.12);
    }

    // 2) "AEEEEE" — voz alegre simulada com osciladores em harmonia
    const tocarAe = (startTime) => {
      const fund = ctx.createOscillator();
      fund.type = 'sawtooth';
      fund.frequency.setValueAtTime(440, ctx.currentTime + startTime); // A
      fund.frequency.linearRampToValueAtTime(660, ctx.currentTime + startTime + 0.6); // sobe
      fund.frequency.linearRampToValueAtTime(620, ctx.currentTime + startTime + 1.4);

      const harm = ctx.createOscillator();
      harm.type = 'square';
      harm.frequency.setValueAtTime(880, ctx.currentTime + startTime);
      harm.frequency.linearRampToValueAtTime(1320, ctx.currentTime + startTime + 0.6);
      harm.frequency.linearRampToValueAtTime(1240, ctx.currentTime + startTime + 1.4);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + startTime + 0.05);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + startTime + 1.2);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + 1.5);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2500;

      fund.connect(filter); harm.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      fund.start(ctx.currentTime + startTime);
      harm.start(ctx.currentTime + startTime);
      fund.stop(ctx.currentTime + startTime + 1.5);
      harm.stop(ctx.currentTime + startTime + 1.5);
    };
    tocarAe(0.1);
  } catch (e) {
    console.warn('Audio ctx blocked:', e);
  }
}

/** Dispara confete em rajadas de varios pontos da tela */
function dispararConfete() {
  const duration = 2500;
  const end = Date.now() + duration;

  const colors = ['#ff6b35', '#f7931e', '#ffd23f', '#06d6a0', '#118ab2', '#ef476f', '#a855f7'];

  // Rajadas continuas
  const interval = setInterval(() => {
    if (Date.now() > end) return clearInterval(interval);
    const particleCount = 50;
    confetti({
      particleCount,
      spread: 70,
      startVelocity: 35,
      origin: { x: Math.random() * 0.3 + 0.1, y: 0.5 },
      colors,
    });
    confetti({
      particleCount,
      spread: 70,
      startVelocity: 35,
      origin: { x: Math.random() * 0.3 + 0.7, y: 0.5 },
      colors,
    });
  }, 250);

  // Burst inicial grande no centro
  confetti({
    particleCount: 150,
    spread: 90,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.4 },
    colors,
  });
}

/** Comemoracao completa: confete + som */
export function celebrarContratacao() {
  dispararConfete();
  tocarSomComemoracao();
}
