/**
 * Sintetizador Procedural de Áudio com Web Audio API para o Batatoom!
 * 100% autônomo, sem arquivos de áudio externos, funciona offline e em qualquer navegador.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = (localStorage.getItem('batatoom_muted') ?? localStorage.getItem('kbum_muted')) === 'true';
    this.tickTimer = null;
    this.currentTensionStage = 1;
    this.isTickingActive = false;

    // Desbloqueia contexto no primeiro clique/toque do usuário
    this.initAudioUnlock();
  }

  initAudioUnlock() {
    const unlock = () => {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    };

    window.addEventListener('click', unlock, { once: false, passive: true });
    window.addEventListener('touchstart', unlock, { once: false, passive: true });
    window.addEventListener('keydown', unlock, { once: false, passive: true });
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('batatoom_muted', this.isMuted ? 'true' : 'false');
    if (this.isMuted) {
      this.stopTickLoop();
    } else if (this.isTickingActive) {
      this.startTickLoop(this.currentTensionStage);
    }
    return this.isMuted;
  }

  /**
   * Toca um único "clique" do tique-taque da bomba
   */
  playSingleTick(stage = 1) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Varia a frequência e o tipo conforme o estágio de tensão
    let freq = 700;
    let duration = 0.04;
    let type = 'sine';

    if (stage === 2) {
      freq = 900;
      type = 'triangle';
    } else if (stage === 3) {
      freq = 1200;
      type = 'triangle';
    } else if (stage === 4) {
      freq = 1600;
      type = 'square';
      duration = 0.05;
    }

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + duration);

    gain.gain.setValueAtTime(stage === 4 ? 0.25 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Inicia loop do tique-taque conforme estágio de tensão
   */
  startTickLoop(stage = 1) {
    this.currentTensionStage = stage;
    this.isTickingActive = true;
    this.stopTickLoop();

    if (this.isMuted) return;

    // Intervalo de tique-taque baseado no estágio
    // Estágio 1: 900ms | Estágio 2: 600ms | Estágio 3: 350ms | Estágio 4: 180ms
    const intervals = {
      1: 900,
      2: 600,
      3: 350,
      4: 180
    };

    const intervalMs = intervals[stage] || 800;

    this.playSingleTick(stage);
    this.tickTimer = setInterval(() => {
      this.playSingleTick(this.currentTensionStage);
    }, intervalMs);
  }

  updateTension(stage) {
    if (this.currentTensionStage !== stage) {
      this.currentTensionStage = stage;
      if (this.isTickingActive) {
        this.startTickLoop(stage);
      }
    }
  }

  stopTickLoop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /**
   * Som de Sucesso: Arpejo ascendente e alegre
   */
  playSuccess() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const noteTime = now + idx * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.26);
    });
  }

  /**
   * Som de Erro: Buzzer grave descendente
   */
  playError() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Som de Troca de Turno: Quem joga a batata faz um 'whoosh' dinâmico no ar!
   * Se for a vez do usuário, toca um chime metálico alegre avisando 'A batata é sua!'.
   */
  playTurnPass(isMyTurn = false) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Whoosh do arremesso da batata (ruído modulado com filtro passa-banda)
    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.22);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.Q.setValueAtTime(3.0, now);
      bandpass.frequency.setValueAtTime(350, now);
      bandpass.frequency.exponentialRampToValueAtTime(1100, now + 0.09);
      bandpass.frequency.exponentialRampToValueAtTime(250, now + 0.21);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.22);
    } catch (e) {
      // Fallback gracioso
    }

    // 2. Se for a vez do próprio jogador: Chime metálico brilhante
    if (isMyTurn) {
      const notes = [659.25, 987.77]; // E5, B5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + 0.06 + (idx * 0.08);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.36);
      });
    }
  }

  /**
   * Som de Explosão: Ruído branco filtrado + sub-grave estrondoso
   */
  playExplosion() {
    this.stopTickLoop();
    this.isTickingActive = false;

    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Sub-grave oscilador
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.8);

    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.85);

    // 2. Ruído branco com filtro passa-baixas
    const bufferSize = ctx.sampleRate * 0.9;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.9);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + 0.95);
  }

  /**
   * Som de Contagem Regressiva (3, 2, 1)
   */
  playCountdownTick(isFinal = false) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freq = isFinal ? 880 : 440;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.21);
  }

  /**
   * Fanfarra de Vitória
   */
  playVictory() {
    this.stopTickLoop();
    this.isTickingActive = false;

    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5, E5, G5, C6
    const melody = [
      { f: 523.25, d: 0.15, pause: 0 },
      { f: 659.25, d: 0.15, pause: 0.15 },
      { f: 783.99, d: 0.2,  pause: 0.30 },
      { f: 1046.50, d: 0.6, pause: 0.50 }
    ];

    melody.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const noteTime = now + note.pause;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, noteTime);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.3, noteTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + note.d + 0.05);
    });
  }

  /**
   * Som de Alerta de Turno: Batata quente caindo nas mãos do jogador!
   * Efeito enérgico, quente e inconfundível (Pop + Chime duplo agudo).
   */
  playTurnAlert() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Chime duplo de atenção (E5 -> B5 -> E6 arpejo curto e cintilante)
    const tones = [
      { f: 659.25, time: 0, dur: 0.12, type: 'triangle' },
      { f: 987.77, time: 0.06, dur: 0.14, type: 'sine' },
      { f: 1318.51, time: 0.12, dur: 0.22, type: 'sine' }
    ];

    tones.forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = now + t.time;
      osc.type = t.type;
      osc.frequency.setValueAtTime(t.f, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + t.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + t.dur + 0.02);
    });

    // 2. Ruído quente de impacto/pegar a batata (woosh/catch)
    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.08);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(3.0, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);
    } catch (_) {}
  }
}

// Instância global de som
window.soundEngine = new SoundEngine();
