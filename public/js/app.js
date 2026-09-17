/**
 * KBUM! - Lógica do Cliente Frontend (SPA + Socket.IO + UX Mobile + Modo TV)
 */

(function () {
  'use strict';

  // Conexão com o servidor Socket.IO (Resiliente para Túneis Cloudflare e redes 4G)
  const socket = io({
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000
  });

  // Estado Local
  let myPlayerId = null;
  let currentRoomCode = null;
  let isHost = false;
  let isMyTurn = false;
  let qrCodeInstance = null;

  // Elementos do DOM - Cabeçalho
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  const soundIcon = document.getElementById('sound-icon');
  const btnToggleTv = document.getElementById('btn-toggle-tv');
  const btnShowRules = document.getElementById('btn-show-rules');
  const modalRules = document.getElementById('modal-rules');
  const btnCloseRules = document.getElementById('btn-close-rules');

  // Telas
  const screenLobby = document.getElementById('screen-lobby');
  const screenWaiting = document.getElementById('screen-waiting');
  const screenGame = document.getElementById('screen-game');

  // Lobby
  const formJoin = document.getElementById('form-join');
  const inputNickname = document.getElementById('input-nickname');
  const inputRoomCode = document.getElementById('input-room-code');
  const btnRandomCode = document.getElementById('btn-random-code');
  const btnEnterRoom = document.getElementById('btn-enter-room');
  const dictStatusText = document.getElementById('dict-status-text');

  // Sala de Espera
  const displayRoomCode = document.getElementById('display-room-code');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const qrcodeContainer = document.getElementById('qrcode-container');
  const waitingPlayersList = document.getElementById('waiting-players-list');
  const playerCountBadge = document.getElementById('player-count-badge');
  const hostControls = document.getElementById('host-controls');
  const guestControls = document.getElementById('guest-controls');
  const btnStartGame = document.getElementById('btn-start-game');
  const startHint = document.getElementById('start-hint');

  // Configurações da Sala (Host)
  const settingDifficulty = document.getElementById('setting-difficulty');
  const settingTurnOrder = document.getElementById('setting-turn-order');
  const settingTimerType = document.getElementById('setting-timer-type');
  const settingsRoleTag = document.getElementById('settings-role-tag');

  // Arena de Jogo
  const hudRoomCode = document.getElementById('hud-room-code');
  const hudRoundNumber = document.getElementById('hud-round-number');
  const hudDifficultyBadge = document.getElementById('hud-difficulty-badge');
  const hudTimerBadge = document.getElementById('hud-timer-badge');
  const tensionHalo = document.getElementById('tension-halo');
  const bombContainer = document.getElementById('bomb-container');
  const displayPrompt = document.getElementById('display-prompt');
  const currentPlayerName = document.getElementById('current-player-name');
  const turnPointerArrow = document.getElementById('turn-pointer-arrow');
  const pointerTargetName = document.getElementById('pointer-target-name');
  const matamataBanner = document.getElementById('matamata-banner');
  const matamataLevel = document.getElementById('matamata-level');
  const potatoExpression = document.getElementById('potato-expression');
  const gamePlayersBar = document.getElementById('game-players-bar');
  const wordsFeedList = document.getElementById('words-feed-list');
  const liveTypingDisplay = document.getElementById('live-typing-display');
  const liveTypingLetters = document.getElementById('live-typing-letters');
  const liveTypingTag = document.querySelector('.live-typing-tag');
  const lastWordBanner = document.getElementById('last-word-banner');
  const lastWordAuthor = document.getElementById('last-word-author');
  const lastWordHighlighted = document.getElementById('last-word-highlighted');

  let activePrompt = '';
  let lastWordTimeout = null;

  /**
   * Destaca em verde apenas as letras que correspondem ao prompt sorteado
   * Exemplo: prompt "FE" com palavra "café" -> "ca<span class='matched-prompt-green'>fé</span>"
   */
  function formatWordWithPromptHighlight(word, prompt) {
    if (!word) return '';
    if (!prompt) return escapeHtml(word);

    const normPrompt = prompt.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ç/g, 'c');
    const normWord = word.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ç/g, 'c');

    const idx = normWord.indexOf(normPrompt);
    if (idx === -1) {
      return escapeHtml(word);
    }

    const before = word.slice(0, idx);
    const matched = word.slice(idx, idx + normPrompt.length);
    const after = word.slice(idx + normPrompt.length);

    return `${escapeHtml(before)}<span class="matched-prompt-green">${escapeHtml(matched)}</span>${escapeHtml(after)}`;
  }

  // Ação do Jogador (Mobile-First)
  const myTurnPanel = document.getElementById('my-turn-panel');
  const otherTurnPanel = document.getElementById('other-turn-panel');
  const eliminatedPanel = document.getElementById('eliminated-panel');
  const formWordSubmit = document.getElementById('form-word-submit');
  const inputWord = document.getElementById('input-word');
  const btnSubmitWord = document.getElementById('btn-submit-word');
  const feedbackMessage = document.getElementById('feedback-message');
  const waitingOtherMsg = document.getElementById('waiting-other-msg');

  // Overlays
  const overlayCountdown = document.getElementById('overlay-countdown');
  const countdownNumber = document.getElementById('countdown-number');
  const overlayExplosion = document.getElementById('overlay-explosion');
  const explosionVictimText = document.getElementById('explosion-victim-text');
  const missedWordsList = document.getElementById('missed-words-list');
  const overlayGameOver = document.getElementById('overlay-game-over');
  const winnerName = document.getElementById('winner-name');
  const rankingList = document.getElementById('ranking-list');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const playAgainHint = document.getElementById('play-again-hint');

  // Modo Solo Elements
  const btnPlaySolo = document.getElementById('btn-play-solo');
  const hudSoloScoreItem = document.getElementById('hud-solo-score-item');
  const hudSoloScore = document.getElementById('hud-solo-score');
  const hudSoloComboItem = document.getElementById('hud-solo-combo-item');
  const hudSoloCombo = document.getElementById('hud-solo-combo');
  const hudSoloRecordItem = document.getElementById('hud-solo-record-item');
  const hudSoloRecord = document.getElementById('hud-solo-record');
  const gameoverMultiplayerBox = document.getElementById('gameover-multiplayer-box');
  const gameoverSoloBox = document.getElementById('gameover-solo-box');
  const soloHighscoreAlert = document.getElementById('solo-highscore-alert');
  const soloFinalScore = document.getElementById('solo-final-score');
  const soloBestScore = document.getElementById('solo-best-score');
  const soloFinalWords = document.getElementById('solo-final-words');
  const soloFinalCombo = document.getElementById('solo-final-combo');
  const soloFinalLevel = document.getElementById('solo-final-level');
  const btnPlayAgainSolo = document.getElementById('btn-play-again-solo');
  const btnExitSolo = document.getElementById('btn-exit-solo');

  let personalBestScore = parseInt(localStorage.getItem('batatoom_solo_highscore') || localStorage.getItem('kbum_solo_highscore') || '0', 10);

  // =========================================================================
  // INICIALIZAÇÃO E UTILITÁRIOS
  // =========================================================================

  function showScreen(screen) {
    [screenLobby, screenWaiting, screenGame].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  // Atualiza ícone do som
  function updateSoundUI() {
    soundIcon.textContent = window.soundEngine.isMuted ? '🔇' : '🔊';
  }
  updateSoundUI();

  btnToggleSound.addEventListener('click', () => {
    window.soundEngine.toggleMute();
    updateSoundUI();
  });

  // Modo Telão / TV
  const savedTvMode = (localStorage.getItem('batatoom_tv_mode') ?? localStorage.getItem('kbum_tv_mode')) === 'true';
  if (savedTvMode) {
    document.body.classList.add('tv-mode');
    btnToggleTv.classList.add('active');
  }

  btnToggleTv.addEventListener('click', () => {
    const isTv = document.body.classList.toggle('tv-mode');
    btnToggleTv.classList.toggle('active', isTv);
    localStorage.setItem('batatoom_tv_mode', isTv ? 'true' : 'false');
  });

  // Regras
  btnShowRules.addEventListener('click', () => { modalRules.style.display = 'flex'; });
  btnCloseRules.addEventListener('click', () => { modalRules.style.display = 'none'; });
  modalRules.addEventListener('click', (e) => {
    if (e.target === modalRules) modalRules.style.display = 'none';
  });

  // Verifica Parâmetros de URL (?room=BOMB ou #BOMB)
  function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomParam = urlParams.get('room');
    if (!roomParam && window.location.hash) {
      roomParam = window.location.hash.replace('#', '');
    }
    if (roomParam) {
      inputRoomCode.value = roomParam.trim().toUpperCase();
      inputNickname.focus();
    }
  }
  checkUrlParams();

  // Recupera apelido salvo anteriormente
  const savedNick = localStorage.getItem('batatoom_nick') || localStorage.getItem('kbum_nick');
  if (savedNick) {
    inputNickname.value = savedNick;
  }

  // Gerar código aleatório amigável no lobby
  btnRandomCode.addEventListener('click', () => {
    const presets = ['BOMB', 'FOGO', 'BATA', 'TOOM', 'VAPO', 'POW', 'BOOM', 'RAIO'];
    inputRoomCode.value = presets[Math.floor(Math.random() * presets.length)];
  });

  let serverTunnelUrl = null;

  // Checa status do vocabulário da API
  fetch('/api/info')
    .then(r => r.json())
    .then(data => {
      if (data && data.wordsCount) {
        dictStatusText.textContent = `Dicionário Ativo: ${data.wordsCount.toLocaleString('pt-BR')} palavras | ${data.promptsCount.toLocaleString('pt-BR')} combinações`;
      }
      if (data && data.tunnelUrl) {
        serverTunnelUrl = data.tunnelUrl;
      }
    })
    .catch(() => {
      dictStatusText.textContent = 'Dicionário PT-BR Carregado';
    });

  // =========================================================================
  // ENTRADA NA SALA E LOBBY
  // =========================================================================

  function submitJoinRoom() {
    const nickname = inputNickname.value.trim();
    const roomCode = (inputRoomCode.value.trim() || 'BOMB').toUpperCase();

    if (!nickname) {
      alert('Por favor, informe seu apelido!');
      inputNickname.focus();
      return;
    }

    localStorage.setItem('batatoom_nick', nickname);
    btnEnterRoom.disabled = true;
    btnEnterRoom.innerHTML = 'Conectando...';

    // Desbloqueia áudio no primeiro clique
    window.soundEngine.ensureContext();

    socket.emit('join_room', {
      roomCode,
      nickname,
      isHost: false
    });
  }

  formJoin.addEventListener('submit', (e) => {
    e.preventDefault();
    submitJoinRoom();
  });

  if (btnEnterRoom) {
    btnEnterRoom.addEventListener('click', (e) => {
      e.preventDefault();
      submitJoinRoom();
    });
  }

  btnCopyCode.addEventListener('click', () => {
    const baseUrl = serverTunnelUrl || window.location.origin;
    const inviteUrl = `${baseUrl}/?room=${currentRoomCode}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        btnCopyCode.textContent = '✅ Copiado!';
        setTimeout(() => { btnCopyCode.textContent = '📋 Copiar'; }, 2000);
      });
    } else {
      prompt('Copie o link de convite:', inviteUrl);
    }
  });

  btnStartGame.addEventListener('click', () => {
    socket.emit('start_game');
  });

  btnPlayAgain.addEventListener('click', () => {
    socket.emit('restart_lobby');
  });

  if (btnPlaySolo) {
    btnPlaySolo.addEventListener('click', () => {
      const nickname = inputNickname.value.trim() || 'Jogador Solo';
      localStorage.setItem('batatoom_nick', nickname);
      window.soundEngine.ensureContext();
      btnPlaySolo.disabled = true;
      btnPlaySolo.textContent = 'Iniciando Desafio...';
      showScreen(screenGame);
      socket.emit('create_solo_game', { nickname });
    });
  }

  if (btnPlayAgainSolo) {
    btnPlayAgainSolo.addEventListener('click', () => {
      overlayGameOver.style.display = 'none';
      socket.emit('restart_solo');
    });
  }

  if (btnExitSolo) {
    btnExitSolo.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  // Alteração das configurações da sala (Host)
  function emitSettingsChange() {
    if (!isHost) return;
    socket.emit('update_settings', {
      difficulty: settingDifficulty.value,
      turnOrder: settingTurnOrder.value,
      timerType: settingTimerType.value
    });
  }

  settingDifficulty.addEventListener('change', emitSettingsChange);
  settingTurnOrder.addEventListener('change', emitSettingsChange);
  settingTimerType.addEventListener('change', emitSettingsChange);

  // =========================================================================
  // ENVIO DE PALAVRA E AÇÕES DO JOGADOR
  // =========================================================================

  function submitCurrentWord() {
    const raw = inputWord.value;
    if (!raw) return;
    const word = raw.trim().replace(/^[^a-zA-Z\u00C0-\u017F]+|[^a-zA-Z\u00C0-\u017F]+$/g, '');
    if (!word) {
      inputWord.value = '';
      return;
    }

    // Resiliência no Modo Solo: o jogador solitário está sempre no seu turno
    const isSoloActive = Boolean(
      (currentRoomCode && currentRoomCode.startsWith('SOLO')) ||
      (hudSoloScoreItem && hudSoloScoreItem.style.display === 'flex')
    );

    if (!isMyTurn && !isSoloActive) {
      console.warn('Tentativa de envio fora da sua vez.');
      return;
    }

    // Envia a palavra para validação no backend
    socket.emit('submit_word', { word });

    // Limpa o input imediatamente para permitir digitação rápida da próxima palavra
    inputWord.value = '';
    clearLiveTyping();
    inputWord.focus();
  }

  formWordSubmit.addEventListener('submit', (e) => {
    e.preventDefault();
    submitCurrentWord();
  });

  if (btnSubmitWord) {
    btnSubmitWord.addEventListener('click', (e) => {
      e.preventDefault();
      submitCurrentWord();
    });
  }

  inputWord.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      submitCurrentWord();
    }
  });

  // Digitação em tempo real pelo jogador ativo
  inputWord.addEventListener('input', () => {
    const isSoloActive = Boolean(
      (currentRoomCode && currentRoomCode.startsWith('SOLO')) ||
      (hudSoloScoreItem && hudSoloScoreItem.style.display === 'flex')
    );
    if (!isMyTurn && !isSoloActive) return;
    const val = inputWord.value;

    // Atualiza imediatamente na tela local
    updateLiveTypingPreview(val, 'Você', activePrompt);

    // Transmite para todos os outros jogadores e telão (se multiplayer)
    if (!isSoloActive) {
      socket.emit('typing_word', { text: val });
    }
  });

  // Atualização de digitação recebida de outro jogador
  socket.on('player_typing', ({ nickname, text }) => {
    updateLiveTypingPreview(text, nickname, activePrompt);
  });

  function updateLiveTypingPreview(text, author, prompt) {
    if (!liveTypingLetters) return;

    if (!text || text.trim().length === 0) {
      liveTypingLetters.innerHTML = `<span class="empty-placeholder">Aguardando letras...</span>`;
      if (liveTypingTag) liveTypingTag.textContent = author ? `DIGITANDO (${author}):` : 'DIGITANDO:';
      return;
    }

    if (liveTypingTag) {
      liveTypingTag.textContent = author ? `DIGITANDO (${author}):` : 'DIGITANDO:';
    }

    // Se já tiver a sílaba na palavra digitada, ela já fica verde em tempo real!
    liveTypingLetters.innerHTML = formatWordWithPromptHighlight(text, prompt);
  }

  function clearLiveTyping() {
    inputWord.value = '';
    if (liveTypingLetters) {
      liveTypingLetters.innerHTML = `<span class="empty-placeholder">Aguardando letras...</span>`;
    }
    if (liveTypingTag) {
      liveTypingTag.textContent = 'DIGITANDO:';
    }
  }

  // Vibração Tátil no Mobile
  function vibrate(pattern) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }

  // Foco automático inteligente no campo de digitação no celular
  function autoFocusInput() {
    if (isMyTurn) {
      setTimeout(() => {
        inputWord.focus();
        // Em telas móveis, rolar suavemente para o input se necessário
        inputWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }

  // =========================================================================
  // EVENTOS RECEBIDOS VIA SOCKET.IO
  // =========================================================================

  // Entrou na sala
  socket.on('joined_room', ({ roomCode, player, roomState }) => {
    myPlayerId = player.id;
    currentRoomCode = roomCode;
    isHost = player.isHost;

    displayRoomCode.textContent = roomCode;
    hudRoomCode.textContent = (roomState && roomState.isSolo) ? 'SOLO' : roomCode;

    // Atualiza URL apenas se for sala multiplayer aberta
    if (!roomState || !roomState.isSolo) {
      window.history.replaceState(null, '', `?room=${roomCode}`);
      const baseUrl = serverTunnelUrl || window.location.origin;
      generateQrCode(`${baseUrl}/?room=${roomCode}`);
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }

    handleRoomState(roomState);
  });

  // Atualização geral do estado da sala
  socket.on('room_state', (state) => {
    handleRoomState(state);
  });

  function handleRoomState(state) {
    if (!state) return;

    currentRoomCode = state.code;
    displayRoomCode.textContent = state.code;
    hudRoomCode.textContent = state.isSolo ? 'SOLO' : state.code;

    // Verifica se sou host
    isHost = (state.hostId === myPlayerId);

    // Atualiza opções de regras na sala de espera
    if (state.settings) {
      if (document.activeElement !== settingDifficulty) {
        settingDifficulty.value = state.settings.difficulty || 'dinamico';
      }
      if (document.activeElement !== settingTurnOrder) {
        settingTurnOrder.value = state.settings.turnOrder || 'aleatorio';
      }
      if (document.activeElement !== settingTimerType) {
        settingTimerType.value = state.settings.timerType || 'aleatorio';
      }

      if (hudTimerBadge) {
        hudTimerBadge.textContent = state.settings.timerType === 'normal' ? 'NORMAL (15s)' : 'ALEATÓRIO';
      }
    }

    // Renderiza controles de host na sala de espera
    if (isHost) {
      hostControls.style.display = 'block';
      guestControls.style.display = 'none';
      btnPlayAgain.style.display = 'inline-flex';
      playAgainHint.style.display = 'none';

      settingDifficulty.disabled = false;
      settingTurnOrder.disabled = false;
      settingTimerType.disabled = false;
      settingsRoleTag.textContent = '(Você é o Anfitrião - Altere como quiser)';
      settingsRoleTag.style.color = '#34d399';
    } else {
      hostControls.style.display = 'none';
      guestControls.style.display = 'block';
      btnPlayAgain.style.display = 'none';
      playAgainHint.style.display = 'block';

      settingDifficulty.disabled = true;
      settingTurnOrder.disabled = true;
      settingTimerType.disabled = true;
      settingsRoleTag.textContent = '(Definido pelo Anfitrião da sala)';
      settingsRoleTag.style.color = '#94a3b8';
    }

    // Atualiza estado das telas
    if (state.isSolo) {
      // Modo Solo NUNCA deve exibir a tela de espera do multiplayer!
      showScreen(screenGame);
      updateGameView(state);
      if (state.status === 'playing') {
        overlayCountdown.style.display = 'none';
      }
    } else if (state.status === 'waiting') {
      showScreen(screenWaiting);
      overlayCountdown.style.display = 'none';
      overlayExplosion.style.display = 'none';
      overlayGameOver.style.display = 'none';
      window.soundEngine.stopTickLoop();
      renderWaitingPlayers(state.players);
    } else if (state.status === 'countdown') {
      showScreen(screenGame);
      updateGameView(state);
    } else if (state.status === 'playing' || state.status === 'round_pause') {
      showScreen(screenGame);
      updateGameView(state);
    } else if (state.status === 'game_over') {
      showScreen(screenGame);
      updateGameView(state);
    }
  }

  function renderWaitingPlayers(players) {
    playerCountBadge.textContent = players.length;
    waitingPlayersList.innerHTML = '';

    players.forEach(p => {
      const card = document.createElement('div');
      card.className = 'player-card';

      const initial = p.nickname.charAt(0).toUpperCase();
      card.innerHTML = `
        <div class="player-avatar" style="background-color: ${p.avatarColor || '#f43f5e'}">${initial}</div>
        <span class="player-name">${escapeHtml(p.nickname)}</span>
        ${p.isHost ? '<span class="host-tag" title="Anfitrião">👑</span>' : ''}
      `;
      waitingPlayersList.appendChild(card);
    });

    if (btnStartGame) {
      btnStartGame.disabled = (players.length < 2);
      startHint.textContent = players.length < 2
        ? 'Aguardando pelo menos mais 1 jogador entrar...'
        : 'Pronto para começar a diversão!';
    }
  }

  function generateQrCode(url) {
    if (!qrcodeContainer) return;
    qrcodeContainer.innerHTML = '';
    try {
      if (window.QRCode) {
        qrCodeInstance = new QRCode(qrcodeContainer, {
          text: url,
          width: 140,
          height: 140,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    } catch (e) {
      console.warn('QRCode JS não disponível:', e);
    }
  }

  // Contagem Regressiva 3, 2, 1
  socket.on('countdown_tick', ({ count }) => {
    overlayCountdown.style.display = 'flex';
    countdownNumber.textContent = count > 0 ? count : 'VAI!';
    countdownNumber.classList.remove('pulse');
    void countdownNumber.offsetWidth;
    countdownNumber.classList.add('pulse');

    window.soundEngine.playCountdownTick(count === 0);
  });

  // Rodada Iniciou
  socket.on('round_started', (data) => {
    overlayCountdown.style.display = 'none';
    overlayExplosion.style.display = 'none';
    overlayGameOver.style.display = 'none';

    showScreen(screenGame);

    hudRoundNumber.textContent = data.round;
    updatePrompt(data.prompt, data.difficulty, data.isMataMata, data.mataMataHits);
    updateTensionUI(data.tensionStage || 1);
    clearLiveTyping();
    if (lastWordBanner) lastWordBanner.style.display = 'none';

    const isCurrent = data.isSolo || (data.currentPlayer && data.currentPlayer.id === myPlayerId);
    if (isCurrent) {
      isMyTurn = true;
      myTurnPanel.style.display = 'block';
      otherTurnPanel.style.display = 'none';
      eliminatedPanel.style.display = 'none';
      autoFocusInput();
    } else {
      isMyTurn = false;
      myTurnPanel.style.display = 'none';
      otherTurnPanel.style.display = 'block';
      eliminatedPanel.style.display = 'none';
      if (data.currentPlayer) {
        waitingOtherMsg.innerHTML = `<span class="pulse-dot"></span> É a vez de <strong>${escapeHtml(data.currentPlayer.nickname)}</strong> responder...`;
      }
    }

    if (data.isSolo) {
      if (hudSoloScoreItem) hudSoloScoreItem.style.display = 'flex';
      if (hudSoloComboItem) hudSoloComboItem.style.display = 'flex';
      if (hudSoloRecordItem) hudSoloRecordItem.style.display = 'flex';
      if (hudSoloCombo) hudSoloCombo.textContent = `🔥 x${data.soloMultiplier || 1.0} (${data.soloCombo || 0})`;
      if (hudSoloRecord) hudSoloRecord.textContent = personalBestScore;
      if (hudDifficultyBadge) {
        hudDifficultyBadge.className = 'badge-diff easy';
        hudDifficultyBadge.textContent = `${data.soloLevelName || 'INICIANTE'} (NV. ${data.soloLevel || 1})`;
      }
      if (data.timeLeftSec !== undefined && hudTimerBadge) {
        hudTimerBadge.className = 'badge-diff easy';
        hudTimerBadge.textContent = `⏱️ ${data.timeLeftSec}s`;
      }
    }

    window.soundEngine.startTickLoop(data.tensionStage || 1);
  });

  function showTimeBonusEffect(seconds, reason = '') {
    if (!bombContainer) return;
    const badge = document.createElement('div');
    badge.className = 'time-bonus-badge';
    const text = reason ? `+${seconds}s ⏱️ ${reason}` : `+${seconds}s ⏱️`;
    badge.textContent = text;
    bombContainer.appendChild(badge);
    setTimeout(() => {
      badge.remove();
    }, 1400);
  }

  // Turno Passou (alguém acertou a palavra)
  socket.on('turn_passed', (data) => {
    window.soundEngine.playSuccess();
    updatePrompt(data.prompt, data.difficulty, data.isMataMata, data.mataMataHits);
    clearLiveTyping();

    const isCurrent = data.isSolo || (data.nextPlayer && data.nextPlayer.id === myPlayerId);
    if (isCurrent) {
      isMyTurn = true;
      myTurnPanel.style.display = 'block';
      otherTurnPanel.style.display = 'none';
      eliminatedPanel.style.display = 'none';
      autoFocusInput();
    } else {
      isMyTurn = false;
      myTurnPanel.style.display = 'none';
      otherTurnPanel.style.display = 'block';
      eliminatedPanel.style.display = 'none';
      if (data.nextPlayer) {
        waitingOtherMsg.innerHTML = `<span class="pulse-dot"></span> É a vez de <strong>${escapeHtml(data.nextPlayer.nickname)}</strong> responder...`;
      }
    }

    if (data.isSolo) {
      if (hudSoloCombo) hudSoloCombo.textContent = `🔥 x${data.soloMultiplier || 1.0} (${data.soloCombo || 0})`;
      if (hudDifficultyBadge) {
        const diffClass = (data.soloLevel || 1) >= 6 ? 'hard' : (data.soloLevel || 1) >= 4 ? 'medium' : 'easy';
        hudDifficultyBadge.className = `badge-diff ${diffClass}`;
        hudDifficultyBadge.textContent = `${data.soloLevelName || 'INICIANTE'} (NV. ${data.soloLevel || 1})`;
      }
      if (data.timeLeftSec !== undefined && hudTimerBadge) {
        const diffClass = data.timeLeftSec <= 3 ? 'hard' : data.timeLeftSec <= 7 ? 'medium' : 'easy';
        hudTimerBadge.className = `badge-diff ${diffClass}`;
        hudTimerBadge.textContent = `⏱️ ${data.timeLeftSec}s`;
      }
    }

    if (data.timeBonus) {
      showTimeBonusEffect(data.timeBonus, data.bonusReason);
    }

    // Banner da palavra aceita com a sílaba destacada em verde (ex: "caFE" com "fe" em verde)
    if (data.lastWord && data.lastWord.word && lastWordBanner) {
      lastWordAuthor.textContent = `${data.lastWord.player} acertou:`;
      let diffBadge = '';
      if (data.lastWord.difficulty) {
        const lvl = data.lastWord.difficulty.level;
        if (lvl === 'mestre') diffBadge = ' <span class="badge-diff hard" style="font-size:0.7rem;padding:2px 6px;">💎 Mestre</span>';
        else if (lvl === 'dificil') diffBadge = ' <span class="badge-diff hard" style="font-size:0.7rem;padding:2px 6px;">⚡ Difícil</span>';
      }
      lastWordHighlighted.innerHTML = formatWordWithPromptHighlight(data.lastWord.word, data.lastWord.prompt) + diffBadge;
      lastWordBanner.style.display = 'flex';

      if (lastWordTimeout) clearTimeout(lastWordTimeout);
      lastWordTimeout = setTimeout(() => {
        if (lastWordBanner) lastWordBanner.style.display = 'none';
      }, 3500);
    }
  });

  // Atualização do Estágio de Tensão da Bomba
  socket.on('bomb_tension', ({ stage, isSolo, timeLeftSec }) => {
    updateTensionUI(stage);
    window.soundEngine.updateTension(stage);

    if (isSolo && timeLeftSec !== undefined && hudTimerBadge) {
      const diffClass = timeLeftSec <= 3 ? 'hard' : timeLeftSec <= 7 ? 'medium' : 'easy';
      hudTimerBadge.className = `badge-diff ${diffClass}`;
      hudTimerBadge.textContent = `⏱️ ${timeLeftSec}s`;
    }
  });

  function updateTensionUI(stage) {
    if (tensionHalo) tensionHalo.className = `tension-halo tension-stage-${stage}`;
    if (bombContainer) bombContainer.className = `potato-container wobble-stage-${stage}`;

    if (potatoExpression) {
      const faces = {
        1: '🥔',
        2: '😅',
        3: '😰',
        4: '🥵'
      };
      potatoExpression.textContent = faces[stage] || '🥔';
    }
  }

  function updatePrompt(prompt, difficulty, isMataMata = false, mataMataHits = 0) {
    activePrompt = prompt;
    displayPrompt.textContent = prompt;
    displayPrompt.classList.remove('pulse-prompt');
    void displayPrompt.offsetWidth;
    displayPrompt.classList.add('pulse-prompt');

    // Dificuldade (Com tratamento especial em Mata-Mata)
    if (isMataMata) {
      hudDifficultyBadge.className = 'badge-diff matamata';
      hudDifficultyBadge.textContent = `🔥 MATA-MATA (${mataMataHits + 1})`;
    } else {
      hudDifficultyBadge.className = `badge-diff ${difficulty || 'easy'}`;
      const diffNames = { facil: 'FÁCIL', medio: 'MÉDIO', dificil: 'DIFÍCIL', mestre: 'MESTRE 💎', dinamico: 'DINÂMICO' };
      hudDifficultyBadge.textContent = diffNames[difficulty] || 'FÁCIL';
    }
  }

  // Palavra Aceita
  socket.on('word_accepted', ({ word, points, prompt, timeBonus, bonusReason, timeLeftSec, isSolo, soloCombo, soloMultiplier, difficulty }) => {
    window.soundEngine.playSuccess();
    feedbackMessage.className = 'feedback-message success';
    const highlighted = formatWordWithPromptHighlight(word, prompt || activePrompt);
    const bonusText = timeBonus ? ` (+${timeBonus}s ⏱️)` : '';
    const comboText = (isSolo && soloMultiplier > 1.0) ? ` [COMBO x${soloMultiplier} 🔥]` : '';
    const diffTag = difficulty && (difficulty.level === 'mestre' ? ' 💎 [Palavra Rara!]' : difficulty.level === 'dificil' ? ' ⚡ [Avançada!]' : '');
    feedbackMessage.innerHTML = `Boa! "+${points} pts"${bonusText}${comboText}${diffTag} (${highlighted})`;
    inputWord.classList.add('success-input');
    vibrate([40]);
    if (timeBonus) {
      showTimeBonusEffect(timeBonus, bonusReason);
    }
    if (isSolo && hudSoloCombo) {
      hudSoloCombo.textContent = `🔥 x${soloMultiplier || 1.0} (${soloCombo || 0})`;
    }
    if (isSolo && timeLeftSec !== undefined && hudTimerBadge) {
      const diffClass = timeLeftSec <= 3 ? 'hard' : timeLeftSec <= 7 ? 'medium' : 'easy';
      hudTimerBadge.className = `badge-diff ${diffClass}`;
      hudTimerBadge.textContent = `⏱️ ${timeLeftSec}s`;
    }

    setTimeout(() => {
      inputWord.classList.remove('success-input');
      feedbackMessage.textContent = '';
      if (inputWord.value === word) {
        inputWord.value = '';
        clearLiveTyping();
      }
    }, 1200);

    autoFocusInput();
  });

  // Palavra Rejeitada / Errada
  socket.on('word_rejected', ({ reason, word }) => {
    window.soundEngine.playError();
    vibrate([100, 50, 100]);

    feedbackMessage.className = 'feedback-message error';
    feedbackMessage.textContent = reason;
    inputWord.classList.add('shake-input');

    if (word && !inputWord.value) {
      inputWord.value = word;
      inputWord.select();
    }

    setTimeout(() => {
      inputWord.classList.remove('shake-input');
    }, 500);

    inputWord.focus();
  });

  // Bomba Explodiu!
  socket.on('bomb_exploded', ({ victim, prompt, examples }) => {
    window.soundEngine.playExplosion();
    vibrate([300, 100, 300]);
    clearLiveTyping();
    if (lastWordBanner) lastWordBanner.style.display = 'none';

    // Tela treme
    document.body.classList.add('shake-screen');
    setTimeout(() => document.body.classList.remove('shake-screen'), 600);

    overlayExplosion.style.display = 'flex';
    explosionVictimText.textContent = `${victim.nickname} perdeu 1 vida! Restam: ${victim.lives} ❤️`;

    // Renderiza palavras que poderiam ter sido ditas
    missedWordsList.innerHTML = '';
    if (examples && examples.length > 0) {
      examples.forEach(ex => {
        const span = document.createElement('span');
        span.className = 'missed-tag';
        span.textContent = ex;
        missedWordsList.appendChild(span);
      });
    }

    setTimeout(() => {
      overlayExplosion.style.display = 'none';
    }, 3000);
  });

  // Fim de Jogo
  socket.on('game_over', (data) => {
    window.soundEngine.playVictory();
    vibrate([100, 50, 100, 50, 300]);

    overlayGameOver.style.display = 'flex';

    if (data.isSolo && data.soloStats) {
      if (gameoverMultiplayerBox) gameoverMultiplayerBox.style.display = 'none';
      if (gameoverSoloBox) gameoverSoloBox.style.display = 'block';

      const finalScore = data.soloStats.score || 0;
      const isNewHigh = (finalScore > personalBestScore);
      if (isNewHigh && finalScore > 0) {
        personalBestScore = finalScore;
        localStorage.setItem('batatoom_solo_highscore', personalBestScore);
        localStorage.setItem('kbum_solo_highscore', personalBestScore);
        if (soloHighscoreAlert) soloHighscoreAlert.style.display = 'block';
      } else {
        if (soloHighscoreAlert) soloHighscoreAlert.style.display = 'none';
      }

      if (soloFinalScore) soloFinalScore.textContent = finalScore;
      if (soloBestScore) soloBestScore.textContent = personalBestScore;
      if (soloFinalWords) soloFinalWords.textContent = data.soloStats.wordsCount;
      if (soloFinalCombo) soloFinalCombo.textContent = `🔥 ${data.soloStats.maxCombo || 0}`;
      if (soloFinalLevel) soloFinalLevel.textContent = `Nível ${data.soloStats.level} (${data.soloStats.levelName})`;

      if (btnPlayAgain) btnPlayAgain.style.display = 'none';
      if (playAgainHint) playAgainHint.style.display = 'none';
      if (btnPlayAgainSolo) btnPlayAgainSolo.style.display = 'inline-flex';
      if (btnExitSolo) btnExitSolo.style.display = 'inline-flex';
    } else {
      if (gameoverMultiplayerBox) gameoverMultiplayerBox.style.display = 'block';
      if (gameoverSoloBox) gameoverSoloBox.style.display = 'none';
      if (btnPlayAgainSolo) btnPlayAgainSolo.style.display = 'none';
      if (btnExitSolo) btnExitSolo.style.display = 'none';

      winnerName.textContent = data.winner ? data.winner.nickname : 'Ninguém!';
      rankingList.innerHTML = '';
      (data.ranking || []).forEach((r, idx) => {
        const item = document.createElement('div');
        item.className = 'ranking-item';

        const medals = ['🥇', '🥈', '🥉'];
        const pos = medals[idx] || `#${idx + 1}`;

        item.innerHTML = `
          <span class="ranking-pos">${pos}</span>
          <span class="ranking-name">${escapeHtml(r.nickname)}</span>
          <span class="ranking-score">${r.score} pts (${r.wordsCount} palavras)</span>
        `;
        rankingList.appendChild(item);
      });
    }
  });

  // Reset do Lobby
  socket.on('lobby_reset', () => {
    overlayGameOver.style.display = 'none';
    overlayExplosion.style.display = 'none';
    showScreen(screenWaiting);
  });

  // Erros gerais
  socket.on('error_message', ({ message }) => {
    alert(message);
    btnEnterRoom.disabled = false;
    btnEnterRoom.innerHTML = '<span>ENTRAR NO JOGO</span> 🚀';
  });

  // =========================================================================
  // ATUALIZAÇÃO DA VIEW DE JOGO (HUD, CHIPS, DOCK)
  // =========================================================================

  function updateGameView(state) {
    const currentPlayer = state.players.find(p => p.id === state.currentPlayerId);
    const me = state.players.find(p => p.id === myPlayerId);

    // Nome na bomba
    if (currentPlayer) {
      currentPlayerName.textContent = currentPlayer.nickname;
    }

    if (state.isSolo) {
      isMyTurn = me ? me.isAlive : true;
    } else {
      isMyTurn = (state.currentPlayerId === myPlayerId && me && me.isAlive);
    }

    // Painéis de Ação do Jogador
    if (state.isSolo) {
      myTurnPanel.style.display = isMyTurn ? 'block' : 'none';
      otherTurnPanel.style.display = 'none';
      eliminatedPanel.style.display = (me && !me.isAlive) ? 'block' : 'none';
      if (isMyTurn) {
        autoFocusInput();
      }
    } else if (!me || !me.isAlive) {
      myTurnPanel.style.display = 'none';
      otherTurnPanel.style.display = 'none';
      eliminatedPanel.style.display = 'block';
    } else if (isMyTurn) {
      myTurnPanel.style.display = 'block';
      otherTurnPanel.style.display = 'none';
      eliminatedPanel.style.display = 'none';
      autoFocusInput();
    } else {
      myTurnPanel.style.display = 'none';
      otherTurnPanel.style.display = 'block';
      eliminatedPanel.style.display = 'none';
      if (currentPlayer) {
        waitingOtherMsg.innerHTML = `<span class="pulse-dot"></span> É a vez de <strong>${escapeHtml(currentPlayer.nickname)}</strong> responder...`;
      }
    }

    if (state.currentPrompt && (!activePrompt || activePrompt !== state.currentPrompt)) {
      updatePrompt(state.currentPrompt, state.promptDifficulty, state.isMataMata, state.mataMataHits);
    }

    // Modo Solo HUD
    if (state.isSolo) {
      if (hudSoloScoreItem) hudSoloScoreItem.style.display = 'flex';
      if (hudSoloComboItem) hudSoloComboItem.style.display = 'flex';
      if (hudSoloRecordItem) hudSoloRecordItem.style.display = 'flex';
      if (hudSoloScore && currentPlayer) hudSoloScore.textContent = currentPlayer.score || 0;
      if (hudSoloCombo) hudSoloCombo.textContent = `🔥 x${state.soloMultiplier || 1.0} (${state.soloCombo || 0})`;
      if (hudSoloRecord) hudSoloRecord.textContent = personalBestScore;

      if (hudDifficultyBadge) {
        hudDifficultyBadge.className = 'badge-diff easy';
        hudDifficultyBadge.textContent = `${state.soloLevelName || 'INICIANTE'} (NV. ${state.soloLevel || 1})`;
      }

      if (pointerTargetName) {
        pointerTargetName.textContent = 'Desafio Solo de Pontuação! 🥔';
      }
    } else {
      if (hudSoloScoreItem) hudSoloScoreItem.style.display = 'none';
      if (hudSoloComboItem) hudSoloComboItem.style.display = 'none';
      if (hudSoloRecordItem) hudSoloRecordItem.style.display = 'none';
    }

    // Mata-Mata (Duelo entre os 2 últimos jogadores vivos no multiplayer)
    if (!state.isSolo && state.isMataMata) {
      if (matamataBanner) {
        matamataBanner.style.display = 'flex';
        if (matamataLevel) {
          matamataLevel.textContent = `NÍVEL ${(state.mataMataHits || 0) + 1}`;
        }
      }
      if (hudDifficultyBadge) {
        hudDifficultyBadge.className = 'badge-diff matamata';
        hudDifficultyBadge.textContent = `🔥 MATA-MATA (${(state.mataMataHits || 0) + 1})`;
      }
    } else {
      if (matamataBanner) {
        matamataBanner.style.display = 'none';
      }
    }

    // Barra de Jogadores com Vidas
    renderGamePlayers(state.players, state.currentPlayerId);

    // Feed de Palavras
    renderWordsFeed(state.wordHistory);
  }

  function renderGamePlayers(players, currentId) {
    gamePlayersBar.innerHTML = '';
    const activePlayer = players.find(p => p.id === currentId);

    if (pointerTargetName && activePlayer) {
      pointerTargetName.textContent = `A batata está com ${activePlayer.nickname}! 🥔`;
    }

    players.forEach(p => {
      const isTurn = (p.id === currentId);
      const card = document.createElement('div');
      card.className = `player-spread-card ${isTurn ? 'is-active-turn' : ''} ${!p.isAlive ? 'is-dead' : ''}`;

      const initial = p.nickname.charAt(0).toUpperCase();

      // Corações
      let heartsHtml = '';
      for (let i = 0; i < 3; i++) {
        heartsHtml += (i < p.lives) ? '❤️' : '🖤';
      }

      // Seta animada apontando para o jogador que está com a batata quente
      const arrowBadge = isTurn ? `<div class="player-turn-arrow-badge" title="Com a Batata!">👇</div>` : '';

      card.innerHTML = `
        ${arrowBadge}
        <div class="card-avatar" style="background-color: ${p.avatarColor || '#3b82f6'}">${initial}</div>
        <span class="card-name">${escapeHtml(p.nickname)}</span>
        <span class="card-lives">${heartsHtml}</span>
      `;
      gamePlayersBar.appendChild(card);
    });
  }

  function renderWordsFeed(history) {
    if (!history) return;
    wordsFeedList.innerHTML = '';
    history.slice(0, 8).forEach(item => {
      const tag = document.createElement('div');
      tag.className = 'feed-word-tag';
      const highlighted = formatWordWithPromptHighlight(item.word, item.prompt);
      tag.innerHTML = `<strong>${highlighted}</strong> <span class="feed-word-author">(${escapeHtml(item.player)})</span>`;
      wordsFeedList.appendChild(tag);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
