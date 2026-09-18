/**
 * Gerenciador de Sala e Lógica do Jogo KBUM
 */

const { normalizeWord, containsPrompt } = require('./utils');
const dictionary = require('./dictionary');
const promptGenerator = require('./promptGenerator');

const INITIAL_LIVES = 3;
const TENSION_STAGES = {
  CALM: 1,      // 0% a 40%
  WARNING: 2,   // 40% a 70%
  ALERT: 3,     // 70% a 90%
  PANIC: 4      // 90% a 100%
};

class GameRoom {
  constructor(roomCode, io) {
    this.code = roomCode;
    this.io = io;

    this.players = new Map(); // socketId -> player object
    this.hostSocketId = null;
    this.status = 'waiting'; // 'waiting', 'countdown', 'playing', 'round_pause', 'game_over'

    this.roundQueue = []; // Ordem de jogadores na rodada atual (cada um joga exatamente uma vez)
    this.currentQueueIndex = 0;
    this.lastVictimId = null; // Vítima da última explosão (para garantir que passa para outro)

    // Mata-Mata (Duelo entre os 2 últimos sobreviventes com dificuldade variável progressiva)
    this.isMataMata = false;
    this.mataMataHits = 0;

    this.currentPrompt = '';
    this.promptDifficulty = 'facil';
    this.recentPrompts = [];
    this.usedPrompts = new Set(); // Prompts/sílabas já sorteadas na partida inteira
    this.usedWords = new Set(); // Palavras normalizadas usadas na partida inteira
    this.wordHistory = []; // Histórico das últimas palavras faladas

    this.turnCount = 0;
    this.roundCount = 0;

    // Configurações definidas pelo Host
    this.settings = {
      difficulty: 'dinamico', // 'facil', 'medio', 'dificil', 'dinamico'
      turnOrder: 'aleatorio',  // 'aleatorio', 'circular'
      timerType: 'aleatorio',  // 'aleatorio', 'rapido', 'normal', 'lento'
      mataMata: 'ativado',     // 'ativado', 'desativado'
      initialLives: 3,         // 1, 2, 3, 5
      minWordLength: 2         // 2, 3, 4, 5
    };

    // Temporizador Invisível da Batata
    this.bombTotalTimeMs = 0;
    this.bombStartTime = 0;
    this.bombEndTime = 0;
    this.bombTimerInterval = null;
    this.currentTensionStage = TENSION_STAGES.CALM;

    this.lastExplodedExamples = [];

    // Modo Single Player (Desafio Solo com Pontuação, Combos e Progressão Balanceada)
    this.isSolo = false;
    this.soloCombo = 0;
    this.maxSoloCombo = 0;
  }

  /**
   * Calcula o piso mínimo de tempo garantido ao passar a batata para o próximo jogador.
   * Evita a tática de segurar a bomba até o último segundo para passar prestes a explodir.
   * O piso começa confortável (8.5s) e decai suavemente com o avanço dos turnos até um limite seguro (5.5s).
   */
  getMinimumTurnBufferMs() {
    if (this.isSolo) return 3000;

    // No Mata-Mata: ritmo mais tenso e acelerado
    if (this.isMataMata) {
      // Começa em 7.5s e decai 250ms por acerto, com limite inferior de 4.8s
      return Math.max(4800, 7500 - ((this.mataMataHits || 0) * 250));
    }

    // Multiplayer normal:
    // Começa em 8.500ms e reduz 150ms a cada turno jogado, com piso mínimo de 5.500ms
    const baseBufferMs = 8500;
    const decayMs = (this.turnCount || 0) * 150;
    const minCapMs = 5500;

    return Math.max(minCapMs, baseBufferMs - decayMs);
  }

  getSoloLevelInfo() {
    const player = this.getCurrentPlayer();
    const hits = player ? player.wordsCount : 0;

    if (hits < 5) {
      return {
        level: 1,
        name: 'Iniciante',
        baseTimeMs: 22000,
        bonusSec: 3.5,
        difficulty: 'facil'
      };
    } else if (hits < 10) {
      return {
        level: 2,
        name: 'Aquecimento',
        baseTimeMs: 20000,
        bonusSec: 3.0,
        difficulty: Math.random() < 0.25 ? 'medio' : 'facil'
      };
    } else if (hits < 17) {
      return {
        level: 3,
        name: 'Ritmo',
        baseTimeMs: 19000,
        bonusSec: 2.8,
        difficulty: Math.random() < 0.55 ? 'medio' : 'facil'
      };
    } else if (hits < 26) {
      return {
        level: 4,
        name: 'Desafio',
        baseTimeMs: 18000,
        bonusSec: 2.4,
        difficulty: Math.random() < 0.35 ? 'dificil' : 'medio'
      };
    } else if (hits < 36) {
      return {
        level: 5,
        name: 'Frenético',
        baseTimeMs: 17000,
        bonusSec: 2.0,
        difficulty: Math.random() < 0.65 ? 'dificil' : 'medio'
      };
    } else if (hits < 48) {
      return {
        level: 6,
        name: 'Pesadelo',
        baseTimeMs: 16000,
        bonusSec: 1.8,
        difficulty: Math.random() < 0.85 ? 'dificil' : 'medio'
      };
    } else if (hits < 62) {
      return {
        level: 7,
        name: 'Insano',
        baseTimeMs: 15000,
        bonusSec: 1.5,
        difficulty: Math.random() < 0.40 ? 'mestre' : 'dificil'
      };
    } else {
      const extra = Math.floor((hits - 62) / 10);
      return {
        level: 8 + extra,
        name: 'Mestre Supremo',
        baseTimeMs: 15000,
        bonusSec: 1.2,
        difficulty: 'mestre'
      };
    }
  }

  getSoloMultiplier() {
    if (this.soloCombo >= 13) return 2.5;
    if (this.soloCombo >= 8) return 2.0;
    if (this.soloCombo >= 4) return 1.5;
    return 1.0;
  }

  updateSettings(socketId, newSettings) {
    const player = this.players.get(socketId);
    if (!player || !player.isHost) {
      return { success: false, message: 'Apenas o anfitrião pode alterar as configurações.' };
    }
    if (this.status !== 'waiting') {
      return { success: false, message: 'Não é possível alterar as configurações com a partida em andamento.' };
    }

    if (newSettings.difficulty && ['facil', 'medio', 'dificil', 'dinamico'].includes(newSettings.difficulty)) {
      this.settings.difficulty = newSettings.difficulty;
    }
    if (newSettings.turnOrder && ['aleatorio', 'circular'].includes(newSettings.turnOrder)) {
      this.settings.turnOrder = newSettings.turnOrder;
    }
    if (newSettings.timerType && ['aleatorio', 'rapido', 'normal', 'lento'].includes(newSettings.timerType)) {
      this.settings.timerType = newSettings.timerType;
    }
    if (newSettings.mataMata && ['ativado', 'desativado'].includes(newSettings.mataMata)) {
      this.settings.mataMata = newSettings.mataMata;
    }
    if (newSettings.initialLives && [1, 2, 3, 5].includes(Number(newSettings.initialLives))) {
      this.settings.initialLives = Number(newSettings.initialLives);
      // Atualiza vidas de quem estiver aguardando na sala
      for (const p of this.players.values()) {
        p.lives = this.settings.initialLives;
      }
    }
    if (newSettings.minWordLength && [2, 3, 4, 5].includes(Number(newSettings.minWordLength))) {
      this.settings.minWordLength = Number(newSettings.minWordLength);
    }

    this.broadcastRoomState();
    return { success: true, settings: this.settings };
  }

  // --- Gerenciamento de Jogadores ---

  addPlayer(socketId, nickname, isHost = false) {
    const cleanNick = (nickname || 'Jogador').trim().substring(0, 16);
    
    // Gera uma cor de avatar ou seed
    const colors = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6'];
    const avatarColor = colors[this.players.size % colors.length];

    const player = {
      id: socketId,
      nickname: cleanNick,
      lives: this.settings.initialLives || INITIAL_LIVES,
      score: 0,
      isHost: isHost || this.players.size === 0,
      avatarColor,
      isAlive: true,
      connected: true,
      wordsCount: 0,
      rareWordsCount: 0,
      longestWord: '',
      bestWord: null,
      survivalBonus: 0,
      finalScore: 0
    };

    this.players.set(socketId, player);
    if (player.isHost) {
      this.hostSocketId = socketId;
    }

    this.broadcastRoomState();
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    const wasCurrentTurn = this.getCurrentPlayer()?.id === socketId;
    this.players.delete(socketId);

    // Reorganiza a fila de turnos da rodada
    const qIdx = this.roundQueue.indexOf(socketId);
    if (qIdx !== -1) {
      this.roundQueue.splice(qIdx, 1);
      if (this.currentQueueIndex >= this.roundQueue.length) {
        this.currentQueueIndex = 0;
      }
    }

    // Se o host saiu, elege outro
    if (this.hostSocketId === socketId && this.players.size > 0) {
      const nextHost = this.players.values().next().value;
      nextHost.isHost = true;
      this.hostSocketId = nextHost.id;
    }

    // Se a partida está em andamento
    if (this.status === 'playing') {
      const alivePlayers = this.getAlivePlayers();
      const allowMataMata = (this.settings.mataMata !== 'desativado');
      this.isMataMata = allowMataMata && (alivePlayers.length === 2);

      if (alivePlayers.length <= 1) {
        this.endGame();
      } else if (wasCurrentTurn) {
        // Se era a vez de quem saiu, passa a batata para o próximo
        this.advanceTurn(false);
      }
    }

    this.broadcastRoomState();
  }

  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  getAlivePlayers() {
    return Array.from(this.players.values()).filter(p => p.lives > 0);
  }

  getCurrentPlayer() {
    if (this.roundQueue.length === 0) return null;
    const socketId = this.roundQueue[this.currentQueueIndex];
    return this.players.get(socketId) || null;
  }

  // --- Ciclo do Jogo ---

  startGame(requestingSocketId) {
    const player = this.players.get(requestingSocketId);
    if (!player || !player.isHost) {
      return { success: false, message: 'Apenas o anfitrião (Host) pode iniciar a partida.' };
    }

    const playerList = Array.from(this.players.values());
    if (!this.isSolo && playerList.length < 2) {
      return { success: false, message: 'É necessário ter pelo menos 2 jogadores para iniciar a partida!' };
    }

    // Reset geral dos jogadores
    const startLives = this.settings.initialLives || INITIAL_LIVES;
    for (const p of playerList) {
      p.lives = startLives;
      p.score = 0;
      p.isAlive = true;
      p.wordsCount = 0;
      p.rareWordsCount = 0;
      p.longestWord = '';
      p.bestWord = null;
      p.survivalBonus = 0;
      p.finalScore = 0;
    }

    this.roundQueue = [];
    this.currentQueueIndex = 0;
    this.lastVictimId = null;
    this.turnCount = 0;
    this.roundCount = 1;
    this.isMataMata = false;
    this.mataMataHits = 0;
    this.recentPrompts = [];
    this.usedPrompts.clear();
    this.usedWords.clear();
    this.wordHistory = [];
    this.lastExplodedExamples = [];

    this.status = 'countdown';
    this.broadcastRoomState();

    // Contagem regressiva de 3 segundos para suspense inicial
    let count = 3;
    const countInterval = setInterval(() => {
      this.io.to(this.code).emit('countdown_tick', { count });
      count--;
      if (count < 0) {
        clearInterval(countInterval);
        this.startRound();
      }
    }, 1000);

    return { success: true };
  }

  startRound() {
    this.status = 'playing';
    this.turnCount++;

    const alivePlayers = this.getAlivePlayers();
    if (!this.isSolo && alivePlayers.length <= 1) {
      this.endGame();
      return;
    }
    if (this.isSolo && alivePlayers.length === 0) {
      this.endGame();
      return;
    }

    if (this.isSolo) {
      this.isMataMata = false;
      this.roundQueue = [alivePlayers[0].id];
      this.currentQueueIndex = 0;
      const soloInfo = this.getSoloLevelInfo();
      this.bombTotalTimeMs = soloInfo.baseTimeMs;
    } else {
      // Mata-Mata: ativado quando sobram exatamente 2 players vivos (se habilitado nas configurações)
      const allowMataMata = (this.settings.mataMata !== 'desativado');
      this.isMataMata = allowMataMata && (alivePlayers.length === 2);

    const aliveIds = alivePlayers.map(p => p.id);

    // 1. Regra: Cada jogador joga EXATAMENTE UMA VEZ por rodada
    // Se a batata explodiu na rodada anterior, o próximo a receber a batata NUNCA será a vítima!
    if (this.settings.turnOrder === 'aleatorio') {
      let firstCandidatePool = aliveIds;
      if (this.lastVictimId && aliveIds.length > 1) {
        const withoutVictim = aliveIds.filter(id => id !== this.lastVictimId);
        if (withoutVictim.length > 0) {
          firstCandidatePool = withoutVictim;
        }
      }

      // Sorteia o primeiro da rodada
      const firstId = firstCandidatePool[Math.floor(Math.random() * firstCandidatePool.length)];
      // Embaralha o restante para que cada um jogue exatamente 1 vez
      const others = aliveIds.filter(id => id !== firstId).sort(() => Math.random() - 0.5);
      this.roundQueue = [firstId, ...others];
    } else {
      // Sequencial em círculo: inicia no jogador seguinte à última vítima
      let startIdx = 0;
      if (this.lastVictimId) {
        const vIdx = aliveIds.indexOf(this.lastVictimId);
        if (vIdx !== -1) {
          startIdx = (vIdx + 1) % aliveIds.length;
        }
      }
      this.roundQueue = [...aliveIds.slice(startIdx), ...aliveIds.slice(0, startIdx)];
    }

    this.currentQueueIndex = 0;
    this.lastVictimId = null; // Limpa para a rodada atual

    // 2. Tempo da batata:
    // No Mata-Mata, a dificuldade interna variável acelera o tempo a cada acerto!
    if (this.isMataMata) {
      const baseMataMataTime = Math.max(7000, 16000 - this.mataMataHits * 750);
      this.bombTotalTimeMs = baseMataMataTime;
    } else if (this.settings.timerType === 'rapido') {
      this.bombTotalTimeMs = 10000;
    } else if (this.settings.timerType === 'normal') {
      this.bombTotalTimeMs = 16000;
    } else if (this.settings.timerType === 'lento') {
      this.bombTotalTimeMs = 24000;
    } else {
      const baseMin = Math.max(14000, 18000 - this.roundCount * 300);
      const baseMax = Math.max(20000, 26000 - this.roundCount * 400);
      this.bombTotalTimeMs = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
    }
  }
    
    this.bombStartTime = Date.now();
    this.bombEndTime = this.bombStartTime + this.bombTotalTimeMs;
    this.currentTensionStage = TENSION_STAGES.CALM;

    // 3. Sorteia prompt respeitando dificuldade e mata-mata
    this.pickNewPrompt();

    // 4. Inicia o monitor de tensão invisível da batata
    this.startBombLoop();

    this.io.to(this.code).emit('round_started', {
      round: this.roundCount,
      currentPlayer: this.getCurrentPlayer(),
      prompt: this.currentPrompt,
      difficulty: this.promptDifficulty,
      tensionStage: this.currentTensionStage,
      isMataMata: this.isMataMata,
      mataMataHits: this.mataMataHits,
      isSolo: this.isSolo,
      soloCombo: this.soloCombo,
      maxSoloCombo: this.maxSoloCombo,
      soloMultiplier: this.isSolo ? this.getSoloMultiplier() : 1.0,
      soloLevel: this.isSolo ? this.getSoloLevelInfo().level : 1,
      soloLevelName: this.isSolo ? this.getSoloLevelInfo().name : '',
      timeLeftSec: this.isSolo ? Math.ceil(this.bombTotalTimeMs / 1000) : undefined
    });

    this.broadcastRoomState();
  }

  pickNewPrompt() {
    let effectiveDifficulty = this.settings.difficulty;

    if (this.isSolo) {
      const soloInfo = this.getSoloLevelInfo();
      effectiveDifficulty = soloInfo.difficulty;
    } else if (this.isMataMata) {
      if (this.mataMataHits >= 6) {
        effectiveDifficulty = 'dificil';
      } else if (this.mataMataHits >= 3) {
        effectiveDifficulty = 'medio';
      } else {
        effectiveDifficulty = 'facil';
      }
    }

    const nextPromptObj = promptGenerator.getPrompt(
      effectiveDifficulty,
      this.turnCount,
      this.usedPrompts
    );
    this.currentPrompt = nextPromptObj.prompt;
    this.promptDifficulty = nextPromptObj.difficulty;

    this.usedPrompts.add(this.currentPrompt);
    this.recentPrompts.push(this.currentPrompt);
    if (this.recentPrompts.length > 8) {
      this.recentPrompts.shift();
    }
  }

  startBombLoop() {
    if (this.bombTimerInterval) {
      clearInterval(this.bombTimerInterval);
    }

    // Intervalo frequente no servidor para verificar tempo e atualizar estágio de tensão
    this.bombTimerInterval = setInterval(() => {
      if (this.status !== 'playing') {
        clearInterval(this.bombTimerInterval);
        return;
      }

      const now = Date.now();
      const remainingMs = Math.max(0, this.bombEndTime - now);
      const remainingSec = Math.ceil(remainingMs / 1000);

      let newStage = TENSION_STAGES.CALM;
      if (this.isSolo) {
        // No Solo, a tensão reflete a proximidade do estouro:
        if (remainingSec <= 3) {
          newStage = TENSION_STAGES.PANIC;
        } else if (remainingSec <= 7) {
          newStage = TENSION_STAGES.ALERT;
        } else if (remainingSec <= 12) {
          newStage = TENSION_STAGES.WARNING;
        } else {
          newStage = TENSION_STAGES.CALM;
        }
      } else {
        const elapsed = now - this.bombStartTime;
        const total = this.bombEndTime - this.bombStartTime;
        const progress = Math.min(1, elapsed / total);

        if (progress >= 0.90) {
          newStage = TENSION_STAGES.PANIC;
        } else if (progress >= 0.70) {
          newStage = TENSION_STAGES.ALERT;
        } else if (progress >= 0.40) {
          newStage = TENSION_STAGES.WARNING;
        }
      }

      // Emite tensão (e no Solo, sincroniza o tempo restante a cada segundo)
      const shouldBroadcast = (newStage !== this.currentTensionStage) || 
                              (this.isSolo && remainingSec !== this.lastBroadcastSec);

      if (shouldBroadcast) {
        this.currentTensionStage = newStage;
        this.lastBroadcastSec = remainingSec;
        this.io.to(this.code).emit('bomb_tension', {
          stage: this.currentTensionStage,
          isSolo: this.isSolo,
          timeLeftSec: this.isSolo ? remainingSec : undefined
        });
      }

      // BOMBA EXPLODIU!
      if (now >= this.bombEndTime) {
        clearInterval(this.bombTimerInterval);
        this.handleBombExplosion();
      }
    }, 250);
  }

  handleBombExplosion() {
    if (this.status !== 'playing') return;
    this.status = 'round_pause';

    const victim = this.getCurrentPlayer();
    if (!victim) return;

    // Perde 1 vida
    victim.lives = Math.max(0, victim.lives - 1);
    if (this.isSolo) {
      this.soloCombo = 0; // Quebra a sequência de combo ao queimar a batata
    }
    if (victim.lives === 0) {
      victim.isAlive = false;
      // Remove da fila da rodada atual se ainda estiver presente
      const idx = this.roundQueue.indexOf(victim.id);
      if (idx !== -1) {
        this.roundQueue.splice(idx, 1);
        if (this.currentQueueIndex >= this.roundQueue.length) {
          this.currentQueueIndex = 0;
        }
      }
    }

    // Salva a vítima para garantir que na próxima rodada a batata NUNCA comece com ela!
    this.lastVictimId = victim.id;

    // No Mata-Mata, arrefece um pouco os acertos após a explosão
    if (this.isMataMata) {
      this.mataMataHits = Math.max(0, this.mataMataHits - 2);
    }

    // Busca sugestões de palavras que o jogador poderia ter respondido
    const missedExamples = dictionary.getExamplesForPrompt(this.currentPrompt, 5);
    this.lastExplodedExamples = missedExamples;

    this.io.to(this.code).emit('bomb_exploded', {
      victim: {
        id: victim.id,
        nickname: victim.nickname,
        lives: victim.lives,
        isAlive: victim.isAlive
      },
      prompt: this.currentPrompt,
      examples: missedExamples,
      isMataMata: this.isMataMata,
      isSolo: this.isSolo,
      soloCombo: 0
    });

    this.broadcastRoomState();

    // Checa fim de jogo
    const alivePlayers = this.getAlivePlayers();
    if (this.isSolo && alivePlayers.length === 0) {
      setTimeout(() => {
        this.endGame();
      }, 2500);
      return;
    }
    if (!this.isSolo && alivePlayers.length <= 1) {
      setTimeout(() => {
        this.endGame();
      }, 2500);
      return;
    }

    // Se ainda há 2 ou mais jogadores vivos, prepara próxima rodada
    // e garante que a batata comece com outro jogador!
    setTimeout(() => {
      this.roundCount++;
      this.startRound();
    }, 3200);
  }

  /**
   * Processa tentativa de palavra do jogador ativo
   */
  submitWord(socketId, rawWord) {
    if (this.status !== 'playing') {
      if (this.status === 'countdown') {
        return { success: false, reason: 'Aguarde a contagem regressiva terminar!' };
      }
      if (this.status === 'round_pause') {
        return { success: false, reason: 'Aguarde o início da próxima rodada!' };
      }
      return { success: false, reason: 'A partida não está em andamento.' };
    }

    const isSoloMode = Boolean(this.isSolo);
    const currentPlayer = isSoloMode
      ? (this.players.get(socketId) || this.getCurrentPlayer())
      : this.getCurrentPlayer();

    if (!currentPlayer || (!isSoloMode && currentPlayer.id !== socketId)) {
      return { success: false, reason: 'Não é o seu turno de jogar!' };
    }

    if (!currentPlayer.isAlive) {
      return { success: false, reason: 'Você foi eliminado nesta partida!' };
    }

    if (!rawWord || typeof rawWord !== 'string') {
      return { success: false, reason: 'Digite uma palavra válida!' };
    }

    // Limpa pontuações acidentais nas bordas (ex: "casa.", "gato!", quotes)
    const trimmed = rawWord.trim().replace(/^[^a-zA-Z\u00C0-\u017F]+|[^a-zA-Z\u00C0-\u017F]+$/g, '');
    const minLength = this.settings.minWordLength || 2;
    if (trimmed.length < minLength) {
      return { success: false, reason: `A palavra deve ter pelo menos ${minLength} letras!` };
    }

    const normalized = normalizeWord(trimmed);

    // 1. Checa se contém o prompt/sílaba
    if (!containsPrompt(normalized, this.currentPrompt)) {
      return {
        success: false,
        reason: `A palavra não contém a combinação "${this.currentPrompt.toUpperCase()}"!`
      };
    }

    // 2. Checa se já foi usada na partida
    if (this.usedWords.has(normalized)) {
      return {
        success: false,
        reason: `🔒 A palavra "${trimmed}" já foi usada nesta partida!`,
        isDuplicate: true,
        duplicateWord: trimmed
      };
    }

    // 3. Checa se existe no vocabulário PT-BR
    const check = dictionary.checkWord(trimmed);
    if (!check.valid) {
      return {
        success: false,
        reason: `"${trimmed}" não foi encontrada no dicionário PT-BR!`
      };
    }

    // --- Palavra Aceita com Sucesso! ---
    const displayWord = check.display;
    const wordDiff = check.difficulty;
    this.usedWords.add(normalized);

    // Pontuação balanceada: base por tamanho + bônus de complexidade + bônus de rapidez
    const wordLen = displayWord.length;
    let basePoints = 15;
    if (wordLen <= 5) {
      basePoints = 15 + Math.max(0, wordLen - 3) * 5;
    } else if (wordLen <= 8) {
      basePoints = 25 + (wordLen - 5) * 8;
    } else {
      basePoints = 49 + (wordLen - 8) * 10;
    }

    let diffBonusPoints = 0;
    let diffMultiplier = 1.0;
    let baseTimeBonus = this.isMataMata ? 0.5 : 1.0;
    let extraTimeBonus = 0;
    let bonusReason = '';

    if (wordDiff) {
      if (wordDiff.level === 'mestre') {
        diffBonusPoints = 70;
        diffMultiplier = 1.5;
        extraTimeBonus = this.isMataMata ? 2.0 : 3.0;
        bonusReason = 'Palavra Mestre! 💎';
      } else if (wordDiff.level === 'dificil') {
        diffBonusPoints = 35;
        diffMultiplier = 1.3;
        extraTimeBonus = this.isMataMata ? 1.0 : 1.5;
        bonusReason = 'Vocabulário Rico! ⚡';
      } else if (wordDiff.level === 'medio') {
        diffBonusPoints = 12;
        diffMultiplier = 1.1;
        extraTimeBonus = this.isMataMata ? 0.3 : 0.5;
        bonusReason = 'Boa Palavra! ✨';
      }
    }

    // Bônus de Rapidez / Agilidade (recompensa generosamente quem despacha a batata rápido)
    let stageBonus = 0;
    if (this.currentTensionStage === TENSION_STAGES.CALM) {
      stageBonus = 20;
      if (!bonusReason) bonusReason = 'Reflexo Rápido! ⚡';
    }

    let wordPoints = Math.round((basePoints + diffBonusPoints) * diffMultiplier) + stageBonus;
    let timeBonusSeconds = parseFloat((baseTimeBonus + extraTimeBonus).toFixed(1));

    if (this.isSolo) {
      this.soloCombo++;
      this.maxSoloCombo = Math.max(this.maxSoloCombo, this.soloCombo);
      const multiplier = this.getSoloMultiplier();
      wordPoints = Math.round(wordPoints * multiplier);
      const soloInfo = this.getSoloLevelInfo();

      // Bônus base do nível
      let soloBase = soloInfo.bonusSec;
      let soloExtra = 0;

      // Recompensa generosa por vocabulário amplo e raridade da palavra
      if (wordDiff && wordDiff.level === 'mestre') {
        soloExtra += 3.5;
        bonusReason = 'Palavra Mestre! 💎';
      } else if (wordDiff && wordDiff.level === 'dificil') {
        soloExtra += 2.0;
        bonusReason = 'Vocabulário Rico! ⚡';
      } else if (wordDiff && wordDiff.level === 'medio') {
        soloExtra += 0.8;
        bonusReason = 'Boa Palavra! ✨';
      } else if (displayWord.length >= 9) {
        soloExtra += 1.5;
        bonusReason = 'Palavra Longa! 🌟';
      } else if (displayWord.length >= 7) {
        soloExtra += 1.0;
        bonusReason = 'Boa Palavra! ✨';
      }

      // Recompensa por sequência de acertos (combo)
      if (this.soloCombo >= 10) {
        soloExtra += 1.5;
        bonusReason = bonusReason ? `${bonusReason} + Super Combo! 🔥` : 'Super Combo! 🔥';
      } else if (this.soloCombo >= 5) {
        soloExtra += 0.8;
        bonusReason = bonusReason ? `${bonusReason} + Combo! 🔥` : 'Combo! 🔥';
      }

      timeBonusSeconds = parseFloat((soloBase + soloExtra).toFixed(1));

      // Acumula tempo na batata com teto de até 45 segundos para manter uma run longa!
      const MAX_SOLO_TIME_MS = 45000;
      const now = Date.now();
      const currentRemaining = Math.max(0, this.bombEndTime - now);
      const addedMs = Math.round(timeBonusSeconds * 1000);
      const newRemaining = Math.min(MAX_SOLO_TIME_MS, currentRemaining + addedMs);

      this.bombEndTime = now + newRemaining;
      this.bombTotalTimeMs = Math.max(this.bombTotalTimeMs, newRemaining);

      // Recalcula o estágio de tensão imediatamente com o novo tempo acumulado
      const remainingSec = Math.ceil(newRemaining / 1000);
      let newStage = TENSION_STAGES.CALM;
      if (remainingSec <= 3) newStage = TENSION_STAGES.PANIC;
      else if (remainingSec <= 7) newStage = TENSION_STAGES.ALERT;
      else if (remainingSec <= 12) newStage = TENSION_STAGES.WARNING;
      else newStage = TENSION_STAGES.CALM;

      this.currentTensionStage = newStage;
    } else {
      const timeBonusMs = Math.round(timeBonusSeconds * 1000);
      this.bombEndTime += timeBonusMs;
      this.bombTotalTimeMs += timeBonusMs;

      // Piso dinâmico anti-stalling: garante tempo viável e resfriamento para o próximo jogador
      const minBufferMs = this.getMinimumTurnBufferMs();
      const timeLeft = this.bombEndTime - Date.now();
      if (timeLeft < minBufferMs) {
        this.bombEndTime = Date.now() + minBufferMs;
        // Resfria a batata para não cair no próximo jogador em pânico extremo imediato
        this.bombStartTime = Date.now() - Math.round(minBufferMs * 0.35);
        this.bombTotalTimeMs = Math.round(minBufferMs / 0.65);
      }
    }

    currentPlayer.score += wordPoints;
    currentPlayer.wordsCount++;
    if (wordDiff && (wordDiff.level === 'dificil' || wordDiff.level === 'mestre')) {
      currentPlayer.rareWordsCount = (currentPlayer.rareWordsCount || 0) + 1;
    }
    if (!currentPlayer.longestWord || displayWord.length > currentPlayer.longestWord.length) {
      currentPlayer.longestWord = displayWord;
    }
    if (!currentPlayer.bestWord || wordPoints > (currentPlayer.bestWord.points || 0)) {
      currentPlayer.bestWord = {
        word: displayWord,
        points: wordPoints,
        difficulty: wordDiff ? wordDiff.level : 'facil'
      };
    }

    // No Mata-Mata, a dificuldade interna variável aumenta a cada acerto!
    if (!this.isSolo && this.isMataMata) {
      this.mataMataHits++;
    }

    const historyItem = {
      word: displayWord,
      player: currentPlayer.nickname,
      prompt: this.currentPrompt,
      difficulty: wordDiff,
      timestamp: Date.now()
    };
    this.wordHistory.unshift(historyItem);
    if (this.wordHistory.length > 20) {
      this.wordHistory.pop();
    }

    const answeredPrompt = this.currentPrompt;

    if (this.isSolo) {
      this.turnCount++;
      this.pickNewPrompt();

      const remainingSec = Math.ceil(Math.max(0, this.bombEndTime - Date.now()) / 1000);

      this.io.to(this.code).emit('turn_passed', {
        lastWord: historyItem,
        nextPlayer: { id: currentPlayer.id, nickname: currentPlayer.nickname },
        prompt: this.currentPrompt,
        difficulty: this.promptDifficulty,
        turnCount: this.turnCount,
        isSolo: true,
        soloCombo: this.soloCombo,
        maxSoloCombo: this.maxSoloCombo,
        soloMultiplier: this.getSoloMultiplier(),
        soloLevel: this.getSoloLevelInfo().level,
        soloLevelName: this.getSoloLevelInfo().name,
        timeBonus: timeBonusSeconds,
        bonusReason: bonusReason,
        timeLeftSec: remainingSec
      });

      this.broadcastRoomState();

      return {
        success: true,
        word: displayWord,
        points: wordPoints,
        prompt: answeredPrompt,
        timeBonus: timeBonusSeconds,
        bonusReason: bonusReason,
        timeLeftSec: remainingSec,
        isSolo: true,
        soloCombo: this.soloCombo,
        soloMultiplier: this.getSoloMultiplier(),
        multiplier: this.getSoloMultiplier(),
        difficulty: wordDiff
      };
    }

    // Avança para o próximo jogador (cada um joga 1x por rodada no multiplayer)
    this.advanceTurn(true, historyItem, timeBonusSeconds, bonusReason);

    return {
      success: true,
      word: displayWord,
      points: wordPoints,
      prompt: answeredPrompt,
      timeBonus: timeBonusSeconds,
      bonusReason: bonusReason,
      difficulty: wordDiff
    };
  }

  advanceTurn(successfulPass = true, lastWordItem = null, timeBonus = 1.0, bonusReason = '') {
    if (this.roundQueue.length === 0) return;

    this.currentQueueIndex++;

    // Regra: cada jogador joga UMA vez por rodada!
    // Se todos jogaram nesta rodada, inicia a próxima com novo sorteio de jogadores
    if (this.currentQueueIndex >= this.roundQueue.length) {
      this.roundCount++;
      this.startRound();
      return;
    }

    this.turnCount++;

    // Sorteia novo prompt
    this.pickNewPrompt();

    // Recalcula o estágio de tensão com base no tempo atual (após buffer e resfriamento)
    const now = Date.now();
    const elapsed = now - this.bombStartTime;
    const total = Math.max(1, this.bombEndTime - this.bombStartTime);
    const progress = Math.min(1, elapsed / total);
    if (progress >= 0.90) {
      this.currentTensionStage = TENSION_STAGES.PANIC;
    } else if (progress >= 0.70) {
      this.currentTensionStage = TENSION_STAGES.ALERT;
    } else if (progress >= 0.40) {
      this.currentTensionStage = TENSION_STAGES.WARNING;
    } else {
      this.currentTensionStage = TENSION_STAGES.CALM;
    }

    const nextPlayer = this.getCurrentPlayer();

    this.io.to(this.code).emit('turn_passed', {
      lastWord: lastWordItem,
      nextPlayer: nextPlayer ? { id: nextPlayer.id, nickname: nextPlayer.nickname } : null,
      prompt: this.currentPrompt,
      difficulty: this.promptDifficulty,
      turnCount: this.turnCount,
      tensionStage: this.currentTensionStage,
      isMataMata: this.isMataMata,
      mataMataHits: this.mataMataHits,
      timeBonus: timeBonus,
      bonusReason: bonusReason
    });

    this.broadcastRoomState();
  }

  nextTurn(successfulPass = true, lastWordItem = null) {
    this.advanceTurn(successfulPass, lastWordItem);
  }

  endGame() {
    if (this.bombTimerInterval) {
      clearInterval(this.bombTimerInterval);
    }
    this.status = 'game_over';

    const LIFE_BONUS = 200;
    const LAST_SURVIVOR_BONUS = 300;

    const alivePlayers = this.getAlivePlayers();
    const lastSurvivor = (!this.isSolo && alivePlayers.length > 0) ? alivePlayers[0] : null;

    // Calcula bônus de sobrevivência e pontuação final combinada para todos os jogadores
    for (const p of this.players.values()) {
      const isLastSurvivor = Boolean(lastSurvivor && p.id === lastSurvivor.id);
      const lifeBonus = Math.max(0, p.lives || 0) * LIFE_BONUS;
      const survivorBonus = isLastSurvivor ? LAST_SURVIVOR_BONUS : 0;
      p.survivalBonus = lifeBonus + survivorBonus;
      p.finalScore = (p.score || 0) + p.survivalBonus;
    }

    // Ordena ranking pelo finalScore (desempenho geral combinado)
    // Critérios de desempate: vidas restantes, palavras acertadas, pontuação de palavras
    const ranking = Array.from(this.players.values()).sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.lives !== a.lives) return b.lives - a.lives;
      if (b.wordsCount !== a.wordsCount) return b.wordsCount - a.wordsCount;
      return b.score - a.score;
    });

    const grandChampion = ranking.length > 0 ? ranking[0] : null;

    // Prêmios e condecorações especiais da partida (Awards)
    const awards = [];

    if (!this.isSolo && this.players.size >= 2) {
      // 1. Grande Campeão Geral
      if (grandChampion) {
        awards.push({
          id: 'champion',
          icon: '👑',
          title: 'Grande Campeão',
          playerId: grandChampion.id,
          playerName: grandChampion.nickname,
          detail: `${grandChampion.finalScore} pts totais (${grandChampion.score} de palavras + ${grandChampion.survivalBonus} de sobrevivência)`
        });
      }

      // 2. Último Sobrevivente (quem resistiu na arena)
      if (lastSurvivor) {
        awards.push({
          id: 'survivor',
          icon: '🛡️',
          title: 'Último Sobrevivente',
          playerId: lastSurvivor.id,
          playerName: lastSurvivor.nickname,
          detail: `Sobreviveu com ${lastSurvivor.lives} vida${lastSurvivor.lives > 1 ? 's' : ''} (+${lastSurvivor.survivalBonus} pts de bônus)!`
        });
      }

      // 3. Mestre das Palavras / MVP (quem fez mais pontos puramente por palavras)
      const mvp = [...this.players.values()].sort((a, b) => b.score - a.score)[0];
      if (mvp && mvp.score > 0) {
        awards.push({
          id: 'mvp',
          icon: '🌟',
          title: 'Mestre das Palavras (MVP)',
          playerId: mvp.id,
          playerName: mvp.nickname,
          detail: `${mvp.score} pts conquistados apenas digitando palavras!`
        });
      }

      // 4. Dicionário Ambulante (quem digitou a maior palavra)
      let longestWordPlayer = null;
      let longestWordStr = '';
      for (const p of this.players.values()) {
        if (p.longestWord && p.longestWord.length > longestWordStr.length) {
          longestWordStr = p.longestWord;
          longestWordPlayer = p;
        }
      }
      if (longestWordPlayer && longestWordStr.length >= 6) {
        awards.push({
          id: 'longest_word',
          icon: '📚',
          title: 'Dicionário Ambulante',
          playerId: longestWordPlayer.id,
          playerName: longestWordPlayer.nickname,
          detail: `Mandou "${longestWordStr.toUpperCase()}" (${longestWordStr.length} letras)!`
        });
      }

      // 5. Gatilho Rápido (quem mais acertou palavras)
      const mostWordsPlayer = [...this.players.values()].sort((a, b) => b.wordsCount - a.wordsCount)[0];
      if (mostWordsPlayer && mostWordsPlayer.wordsCount >= 3) {
        awards.push({
          id: 'most_words',
          icon: '⚡',
          title: 'Gatilho Rápido',
          playerId: mostWordsPlayer.id,
          playerName: mostWordsPlayer.nickname,
          detail: `Acertou ${mostWordsPlayer.wordsCount} palavras durante a partida!`
        });
      }
    }

    this.io.to(this.code).emit('game_over', {
      isSolo: this.isSolo,
      soloStats: this.isSolo ? {
        score: ranking[0]?.score || 0,
        wordsCount: ranking[0]?.wordsCount || 0,
        maxCombo: this.maxSoloCombo,
        level: this.getSoloLevelInfo().level,
        levelName: this.getSoloLevelInfo().name
      } : null,
      winner: grandChampion ? {
        id: grandChampion.id,
        nickname: grandChampion.nickname,
        score: grandChampion.score,
        survivalBonus: grandChampion.survivalBonus,
        finalScore: grandChampion.finalScore,
        lives: grandChampion.lives,
        wordsCount: grandChampion.wordsCount
      } : null,
      lastSurvivor: lastSurvivor ? {
        id: lastSurvivor.id,
        nickname: lastSurvivor.nickname,
        lives: lastSurvivor.lives,
        survivalBonus: lastSurvivor.survivalBonus
      } : null,
      awards,
      ranking: ranking.map(p => ({
        id: p.id,
        nickname: p.nickname,
        lives: p.lives,
        score: p.score,
        survivalBonus: p.survivalBonus || 0,
        finalScore: p.finalScore || p.score,
        wordsCount: p.wordsCount || 0,
        longestWord: p.longestWord || '',
        avatarColor: p.avatarColor,
        isLastSurvivor: Boolean(lastSurvivor && p.id === lastSurvivor.id)
      }))
    });

    this.broadcastRoomState();
  }

  restartSolo(requestingSocketId) {
    if (!this.isSolo) return this.restartLobby(requestingSocketId);
    if (this.bombTimerInterval) {
      clearInterval(this.bombTimerInterval);
    }
    const p = this.players.get(requestingSocketId);
    if (p) {
      p.lives = INITIAL_LIVES;
      p.score = 0;
      p.isAlive = true;
      p.wordsCount = 0;
      p.rareWordsCount = 0;
      p.longestWord = '';
      p.bestWord = null;
      p.survivalBonus = 0;
      p.finalScore = 0;
    }
    this.soloCombo = 0;
    this.maxSoloCombo = 0;
    this.turnCount = 0;
    this.roundCount = 1;
    this.usedWords.clear();
    this.usedPrompts.clear();
    this.wordHistory = [];
    this.lastExplodedExamples = [];
    return this.startGame(requestingSocketId);
  }

  restartLobby(requestingSocketId) {
    const player = this.players.get(requestingSocketId);
    if (!player || !player.isHost) {
      return { success: false, message: 'Apenas o anfitrião pode reiniciar a sala.' };
    }

    if (this.bombTimerInterval) {
      clearInterval(this.bombTimerInterval);
    }

    this.status = 'waiting';
    const startLives = this.settings.initialLives || INITIAL_LIVES;
    for (const p of this.players.values()) {
      p.lives = startLives;
      p.score = 0;
      p.isAlive = true;
      p.wordsCount = 0;
      p.rareWordsCount = 0;
      p.longestWord = '';
      p.bestWord = null;
      p.survivalBonus = 0;
      p.finalScore = 0;
    }

    this.roundQueue = [];
    this.currentQueueIndex = 0;
    this.lastVictimId = null;
    this.isMataMata = false;
    this.mataMataHits = 0;
    this.usedWords.clear();
    this.usedPrompts.clear();
    this.wordHistory = [];
    this.lastExplodedExamples = [];
    this.turnCount = 0;
    this.roundCount = 0;

    this.io.to(this.code).emit('lobby_reset');
    this.broadcastRoomState();

    return { success: true };
  }

  // --- Broadcast de Estado ---

  getPublicState() {
    const currentPlayer = this.getCurrentPlayer();
    return {
      code: this.code,
      status: this.status,
      hostId: this.hostSocketId,
      maxLives: this.settings.initialLives || INITIAL_LIVES,
      isSolo: this.isSolo,
      soloCombo: this.soloCombo,
      maxSoloCombo: this.maxSoloCombo,
      soloLevel: this.isSolo ? this.getSoloLevelInfo().level : 1,
      soloLevelName: this.isSolo ? this.getSoloLevelInfo().name : '',
      soloMultiplier: this.isSolo ? this.getSoloMultiplier() : 1.0,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        nickname: p.nickname,
        lives: p.lives,
        score: p.score,
        survivalBonus: p.survivalBonus || 0,
        finalScore: p.finalScore || p.score,
        isHost: p.isHost,
        isAlive: p.isAlive,
        avatarColor: p.avatarColor,
        wordsCount: p.wordsCount
      })),
      currentPlayerId: currentPlayer ? currentPlayer.id : null,
      currentPlayerNick: currentPlayer ? currentPlayer.nickname : null,
      currentPrompt: this.currentPrompt,
      promptDifficulty: this.promptDifficulty,
      roundCount: this.roundCount,
      turnCount: this.turnCount,
      tensionStage: this.currentTensionStage,
      settings: this.settings,
      isMataMata: this.isMataMata,
      mataMataHits: this.mataMataHits,
      wordHistory: this.wordHistory.slice(0, 10),
      lastExplodedExamples: this.lastExplodedExamples
    };
  }

  broadcastRoomState() {
    this.io.to(this.code).emit('room_state', this.getPublicState());
  }
}

module.exports = GameRoom;
