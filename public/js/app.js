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
  let currentMaxLives = 3;
  let currentRoomSettings = null;
  let isSoloMode = false;

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
  const settingMataMata = document.getElementById('setting-mata-mata');
  const settingLives = document.getElementById('setting-lives');
  const settingMinWordLength = document.getElementById('setting-min-word-length');
  const settingsRoleTag = document.getElementById('settings-role-tag');

  // Arena de Jogo
  const hudRoomCode = document.getElementById('hud-room-code');
  const hudRoundNumber = document.getElementById('hud-round-number');
  const hudDifficultyBadge = document.getElementById('hud-difficulty-badge');
  const hudTimerBadge = document.getElementById('hud-timer-badge');
  const hudLivesItem = document.getElementById('hud-lives-item');
  const hudLivesDisplay = document.getElementById('hud-lives-display');
  const tensionHalo = document.getElementById('tension-halo');
  const bombContainer = document.getElementById('bomb-container');
  const displayPrompt = document.getElementById('display-prompt');
  const currentPlayerName = document.getElementById('current-player-name');
  const turnCompassArrow = document.getElementById('turn-compass-arrow');
  const circlePlayersContainer = document.getElementById('circle-players-container') || document.getElementById('game-players-bar');
  const turnPointerArrow = document.getElementById('turn-pointer-arrow') || turnCompassArrow;
  const pointerTargetName = document.getElementById('pointer-target-name');
  const matamataBanner = document.getElementById('matamata-banner');
  const matamataLevel = document.getElementById('matamata-level');
  const potatoExpression = document.getElementById('potato-expression');
  const gamePlayersBar = circlePlayersContainer;
  let currentArrowDeg = 0;
  let lastActivePlayerId = null;
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

  // Ação do Jogador (Dock Unificado: Input na sua vez / Espelho ao vivo na vez de outros)
  const playerActionDock = document.getElementById('player-action-dock');
  const turnToast = document.getElementById('turn-toast');
  const turnBadgeMy = document.getElementById('turn-badge-my');
  const turnBadgeOther = document.getElementById('turn-badge-other');
  const spectatorStatusBadge = document.getElementById('spectator-status-badge');
  const spectatorBadgeLabel = document.getElementById('spectator-badge-label');
  const formWordSubmit = document.getElementById('form-word-submit');
  const inputWord = document.getElementById('input-word');
  const btnSubmitWord = document.getElementById('btn-submit-word');
  const feedbackMessage = document.getElementById('feedback-message');
  const waitingOtherMsg = document.getElementById('waiting-other-msg');
  let currentActivePlayerName = '';

  // Overlays
  const overlayCountdown = document.getElementById('overlay-countdown');
  const countdownNumber = document.getElementById('countdown-number');
  const overlayExplosion = document.getElementById('overlay-explosion');
  const explosionVictimText = document.getElementById('explosion-victim-text');
  const missedWordsList = document.getElementById('missed-words-list');
  const overlayGameOver = document.getElementById('overlay-game-over');
  const winnerName = document.getElementById('winner-name');
  const winnerBreakdown = document.getElementById('winner-breakdown');
  const awardsSection = document.getElementById('awards-section');
  const awardsGrid = document.getElementById('awards-grid');
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

  // Regras & Guia Detalhado
  btnShowRules.addEventListener('click', () => { modalRules.style.display = 'flex'; });
  btnCloseRules.addEventListener('click', () => { modalRules.style.display = 'none'; });
  modalRules.addEventListener('click', (e) => {
    if (e.target === modalRules) modalRules.style.display = 'none';
  });

  const guideTabBtns = document.querySelectorAll('.guide-tab-btn');
  const guideTabPanels = document.querySelectorAll('.guide-tab-panel');

  guideTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      guideTabBtns.forEach(b => b.classList.remove('active'));
      guideTabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
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

  // Renderizador unificado de corações (vidas ativas e quebradas/escuras)
  function getHeartsHtml(lives, maxLives = 3, newlyLostIndex = -1) {
    const total = Math.max(1, maxLives || 3);
    let html = '';
    for (let i = 0; i < total; i++) {
      if (i < lives) {
        html += '<span class="heart-icon heart-alive" title="Vida ativa">❤️</span>';
      } else if (i === newlyLostIndex) {
        html += '<span class="heart-icon heart-lost heart-break-anim" title="Vida perdida">💔</span>';
      } else {
        html += '<span class="heart-icon heart-lost" title="Vida perdida">💔</span>';
      }
    }
    return html;
  }

  // Gerar código aleatório amigável no lobby com animação de giro do dado
  btnRandomCode.addEventListener('click', () => {
    btnRandomCode.classList.remove('rolling');
    void btnRandomCode.offsetWidth; // Força reflow para reiniciar animação
    btnRandomCode.classList.add('rolling');
    setTimeout(() => btnRandomCode.classList.remove('rolling'), 500);

    const presets = [
      'BOMB', 'FOGO', 'BATA', 'TOOM', 'VAPO', 'POW', 'BOOM', 'RAIO',
      'PICO', 'TCHÊ', 'OXE', 'GURI', 'PIÁ', 'TREM', 'UAI', 'SOL'
    ];
    const currentVal = inputRoomCode.value.trim().toUpperCase();
    const pool = presets.filter(p => p !== currentVal);
    inputRoomCode.value = pool[Math.floor(Math.random() * pool.length)];

    if (window.soundEngine && typeof window.soundEngine.playTick === 'function') {
      window.soundEngine.playTick();
    }
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

    isSoloMode = false;
    if (hudLivesItem) hudLivesItem.style.display = 'none';

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
      isSoloMode = true;
      if (hudLivesItem) hudLivesItem.style.display = 'flex';
      btnPlaySolo.disabled = true;
      btnPlaySolo.textContent = 'Iniciando Desafio...';
      showScreen(screenGame);
      socket.emit('create_solo_game', { nickname });
    });
  }

  if (btnPlayAgainSolo) {
    btnPlayAgainSolo.addEventListener('click', () => {
      isSoloMode = true;
      if (hudLivesItem) hudLivesItem.style.display = 'flex';
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
      timerType: settingTimerType.value,
      mataMata: settingMataMata ? settingMataMata.value : 'ativado',
      initialLives: settingLives ? Number(settingLives.value) : 3,
      minWordLength: settingMinWordLength ? Number(settingMinWordLength.value) : 2
    });
  }

  settingDifficulty.addEventListener('change', emitSettingsChange);
  settingTurnOrder.addEventListener('change', emitSettingsChange);
  settingTimerType.addEventListener('change', emitSettingsChange);
  if (settingMataMata) settingMataMata.addEventListener('change', emitSettingsChange);
  if (settingLives) settingLives.addEventListener('change', emitSettingsChange);
  if (settingMinWordLength) settingMinWordLength.addEventListener('change', emitSettingsChange);

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
      const who = (author && author !== 'Você') ? author : (currentActivePlayerName || 'o jogador');
      liveTypingLetters.innerHTML = `<span class="empty-placeholder">Aguardando ${escapeHtml(who)} digitar...</span>`;
      return;
    }

    // Exibe letras em tempo real com destaque na sílaba correspondente e cursor piscante
    liveTypingLetters.innerHTML = formatWordWithPromptHighlight(text, prompt) + '<span class="typing-cursor">|</span>';
  }

  function clearLiveTyping() {
    inputWord.value = '';
    if (liveTypingLetters) {
      const who = currentActivePlayerName || 'o jogador';
      liveTypingLetters.innerHTML = `<span class="empty-placeholder">Aguardando ${escapeHtml(who)} digitar...</span>`;
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

  // Gerenciamento de Notificação de Aba no Navegador
  let originalDocumentTitle = document.title;
  let tabBlinkTimer = null;

  function notifyBrowserTabTurn() {
    if (document.hidden) {
      let blink = false;
      if (tabBlinkTimer) clearInterval(tabBlinkTimer);
      tabBlinkTimer = setInterval(() => {
        document.title = blink ? '🔥 SUA VEZ! 🥔' : '💥 A BATATA VAI EXPLODIR!';
        blink = !blink;
      }, 800);
    }
  }

  function resetBrowserTabTitle() {
    if (tabBlinkTimer) {
      clearInterval(tabBlinkTimer);
      tabBlinkTimer = null;
    }
    document.title = originalDocumentTitle;
  }

  window.addEventListener('focus', () => {
    resetBrowserTabTitle();
    if (isMyTurn) autoFocusInput();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isMyTurn) {
      resetBrowserTabTitle();
      autoFocusInput();
    }
  });

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

  // Ativação e Desativação Imersiva de Turno do Jogador
  let wasCurrentlyMyTurn = false;
  let turnToastTimeout = null;

  function activateMyTurn(promptText) {
    const isNewTurnArrival = !wasCurrentlyMyTurn;
    isMyTurn = true;
    wasCurrentlyMyTurn = true;

    // Modo Ativo: Mostra o input e o botão de envio
    inputWord.style.display = 'block';
    if (btnSubmitWord) btnSubmitWord.style.display = 'flex';
    if (liveTypingDisplay) liveTypingDisplay.style.display = 'none';
    if (spectatorStatusBadge) spectatorStatusBadge.style.display = 'none';

    if (turnBadgeMy) turnBadgeMy.style.display = 'inline-block';
    if (turnBadgeOther) turnBadgeOther.style.display = 'none';

    if (playerActionDock) {
      playerActionDock.classList.add('is-my-turn');
      playerActionDock.classList.remove('is-spectator-mode');
    }

    const p = promptText || activePrompt;
    const minLen = (currentRoomSettings && currentRoomSettings.minWordLength) ? currentRoomSettings.minWordLength : 2;
    const minHint = (minLen > 2) ? ` (mín. ${minLen} letras)` : '';
    if (p) {
      inputWord.placeholder = `🔥 Digite com "${p}"${minHint}...`;
    } else {
      inputWord.placeholder = `🔥 Sua vez! Digite uma palavra${minHint}...`;
    }

    // Ações acionadas apenas no momento em que a batata chega nas mãos
    if (isNewTurnArrival) {
      window.soundEngine.playTurnAlert();
      vibrate([120, 60, 120]);

      if (turnToast) {
        turnToast.style.display = 'flex';
        if (turnToastTimeout) clearTimeout(turnToastTimeout);
        turnToastTimeout = setTimeout(() => {
          if (turnToast) turnToast.style.display = 'none';
        }, 2000);
      }
    }

    autoFocusInput();
    notifyBrowserTabTurn();
  }

  function deactivateMyTurn(activePlayerName = '', isEliminated = false) {
    isMyTurn = false;
    wasCurrentlyMyTurn = false;

    // Modo Espectador: O campo se transforma no espelho em tempo real
    inputWord.style.display = 'none';
    if (btnSubmitWord) btnSubmitWord.style.display = 'none';
    if (liveTypingDisplay) liveTypingDisplay.style.display = 'flex';
    if (spectatorStatusBadge) spectatorStatusBadge.style.display = 'flex';

    if (turnBadgeMy) turnBadgeMy.style.display = 'none';
    if (turnBadgeOther) turnBadgeOther.style.display = 'inline-flex';

    if (playerActionDock) {
      playerActionDock.classList.remove('is-my-turn');
      playerActionDock.classList.add('is-spectator-mode');
    }

    if (turnToast) {
      turnToast.style.display = 'none';
      if (turnToastTimeout) {
        clearTimeout(turnToastTimeout);
        turnToastTimeout = null;
      }
    }

    const who = activePlayerName || currentActivePlayerName || 'Jogador';
    if (spectatorBadgeLabel) {
      spectatorBadgeLabel.textContent = isEliminated ? 'ELIMINADO' : `COM ${escapeHtml(who).toUpperCase()}`;
    }

    if (waitingOtherMsg) {
      if (isEliminated) {
        waitingOtherMsg.innerHTML = `<span class="pulse-dot"></span> 💀 Você foi eliminado — Vez de <strong>${escapeHtml(who)}</strong>:`;
      } else {
        waitingOtherMsg.innerHTML = `<span class="pulse-dot"></span> Vez de <strong>${escapeHtml(who)}</strong> — Digitando:`;
      }
    }

    // Se o display ao vivo estiver vazio, exibe o placeholder de aguardo com o nome do jogador
    if (liveTypingLetters && (!liveTypingLetters.textContent || liveTypingLetters.querySelector('.empty-placeholder'))) {
      liveTypingLetters.innerHTML = `<span class="empty-placeholder">Aguardando ${escapeHtml(who)} digitar...</span>`;
    }

    inputWord.placeholder = 'Digite uma palavra...';
    resetBrowserTabTitle();
  }

  // =========================================================================
  // EVENTOS RECEBIDOS VIA SOCKET.IO
  // =========================================================================

  // Entrou na sala
  socket.on('joined_room', ({ roomCode, player, roomState }) => {
    myPlayerId = player.id;
    currentRoomCode = roomCode;
    isHost = player.isHost;
    isSoloMode = Boolean(roomState && roomState.isSolo);
    if (hudLivesItem) {
      hudLivesItem.style.display = isSoloMode ? 'flex' : 'none';
    }

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

    if (state.isSolo !== undefined) {
      isSoloMode = Boolean(state.isSolo);
    }
    if (hudLivesItem) {
      hudLivesItem.style.display = isSoloMode ? 'flex' : 'none';
    }

    currentRoomCode = state.code;
    displayRoomCode.textContent = state.code;
    hudRoomCode.textContent = state.isSolo ? 'SOLO' : state.code;

    // Verifica se sou host
    isHost = (state.hostId === myPlayerId);

    currentRoomSettings = state.settings || null;
    currentMaxLives = state.maxLives || (state.settings && state.settings.initialLives) || 3;

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
      if (settingMataMata && document.activeElement !== settingMataMata) {
        settingMataMata.value = state.settings.mataMata || 'ativado';
      }
      if (settingLives && document.activeElement !== settingLives) {
        settingLives.value = String(state.settings.initialLives || 3);
      }
      if (settingMinWordLength && document.activeElement !== settingMinWordLength) {
        settingMinWordLength.value = String(state.settings.minWordLength || 2);
      }

      if (hudTimerBadge) {
        const timerLabels = {
          aleatorio: 'ALEATÓRIO',
          rapido: 'RÁPIDO (10s)',
          normal: 'NORMAL (16s)',
          lento: 'RELAX (24s)'
        };
        hudTimerBadge.textContent = timerLabels[state.settings.timerType] || 'ALEATÓRIO';
      }
    }

    // Renderiza controles de host na sala de espera
    if (isHost) {
      hostControls.style.display = 'block';
      guestControls.style.display = 'none';
      if (!state.isSolo) {
        btnPlayAgain.style.display = 'inline-flex';
      } else {
        btnPlayAgain.style.display = 'none';
      }
      playAgainHint.style.display = 'none';

      settingDifficulty.disabled = false;
      settingTurnOrder.disabled = false;
      settingTimerType.disabled = false;
      if (settingMataMata) settingMataMata.disabled = false;
      if (settingLives) settingLives.disabled = false;
      if (settingMinWordLength) settingMinWordLength.disabled = false;
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
      if (settingMataMata) settingMataMata.disabled = true;
      if (settingLives) settingLives.disabled = true;
      if (settingMinWordLength) settingMinWordLength.disabled = true;
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

    if (data.round === 1 && wordsFeedList) {
      wordsFeedList.innerHTML = '';
    }

    hudRoundNumber.textContent = data.round;
    updatePrompt(data.prompt, data.difficulty, data.isMataMata, data.mataMataHits);
    updateTensionUI(data.tensionStage || 1);
    clearLiveTyping();
    if (lastWordBanner) lastWordBanner.style.display = 'none';

    const isCurrent = data.isSolo || (data.currentPlayer && data.currentPlayer.id === myPlayerId);
    currentActivePlayerName = data.currentPlayer ? data.currentPlayer.nickname : '';
    if (isCurrent) {
      activateMyTurn(data.prompt);
    } else {
      deactivateMyTurn(currentActivePlayerName, false);
    }

    if (data.isSolo !== undefined) {
      isSoloMode = Boolean(data.isSolo);
    }
    if (hudLivesItem) {
      hudLivesItem.style.display = isSoloMode ? 'flex' : 'none';
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
    } else {
      if (hudSoloScoreItem) hudSoloScoreItem.style.display = 'none';
      if (hudSoloComboItem) hudSoloComboItem.style.display = 'none';
      if (hudSoloRecordItem) hudSoloRecordItem.style.display = 'none';
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
    currentActivePlayerName = data.nextPlayer ? data.nextPlayer.nickname : '';
    if (isCurrent) {
      activateMyTurn(data.prompt);
    } else {
      deactivateMyTurn(currentActivePlayerName, false);
    }

    if (data.tensionStage !== undefined) {
      updateTensionUI(data.tensionStage);
      window.soundEngine.updateTension(data.tensionStage);
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

      // Adiciona imediatamente ao feed das últimas palavras aceitas
      if (wordsFeedList) {
        const existingTags = Array.from(wordsFeedList.children);
        const isAlreadyFirst = existingTags.length > 0 && existingTags[0].textContent.includes(data.lastWord.word);
        if (!isAlreadyFirst) {
          const tag = document.createElement('div');
          tag.className = 'feed-word-tag';
          const highlighted = formatWordWithPromptHighlight(data.lastWord.word, data.lastWord.prompt);
          tag.innerHTML = `<strong>${highlighted}</strong> <span class="feed-word-author">(${escapeHtml(data.lastWord.player)})</span>`;
          wordsFeedList.insertBefore(tag, wordsFeedList.firstChild);
          while (wordsFeedList.children.length > 8) {
            wordsFeedList.removeChild(wordsFeedList.lastChild);
          }
        }
      }
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
  socket.on('word_rejected', ({ reason, word, isDuplicate, duplicateWord }) => {
    window.soundEngine.playError();
    vibrate([100, 50, 100]);

    if (isDuplicate) {
      feedbackMessage.className = 'feedback-message error lock-error';
      feedbackMessage.innerHTML = `<span class="lock-icon-bounce">🔒</span> <strong>Palavra Bloqueada!</strong> "${escapeHtml(word || duplicateWord)}" já foi usada nesta partida!`;
      inputWord.classList.add('lock-shake');
    } else {
      feedbackMessage.className = 'feedback-message error';
      feedbackMessage.textContent = reason;
      inputWord.classList.add('shake-input');
    }

    if (word && !inputWord.value) {
      inputWord.value = word;
      inputWord.select();
    }

    setTimeout(() => {
      inputWord.classList.remove('shake-input');
      inputWord.classList.remove('lock-shake');
    }, 600);

    inputWord.focus();
  });

  // Bomba Explodiu!
  socket.on('bomb_exploded', ({ victim, prompt, examples }) => {
    deactivateMyTurn();
    window.soundEngine.playExplosion();
    vibrate([300, 100, 300]);
    clearLiveTyping();
    if (lastWordBanner) lastWordBanner.style.display = 'none';

    // Tela treme
    document.body.classList.add('shake-screen');
    setTimeout(() => document.body.classList.remove('shake-screen'), 600);

    const maxL = currentMaxLives || 3;
    const isMe = (victim.id === myPlayerId);
    const victimTitle = isMe ? 'Você virou purê e perdeu 1 vida!' : `${escapeHtml(victim.nickname)} virou purê e perdeu 1 vida!`;
    const heartsExplosionHtml = getHeartsHtml(victim.lives, maxL, victim.lives);

    overlayExplosion.style.display = 'flex';
    explosionVictimText.innerHTML = `
      <div class="explosion-victim-name">${victimTitle}</div>
      <div class="explosion-hearts-bar">${heartsExplosionHtml}</div>
      <div class="explosion-remaining-label">Restam ${victim.lives} de ${maxL} vidas</div>
    `;

    // Se for o jogador local, quebra o coração no HUD na mesma hora com animação de rachadura
    if (isMe && hudLivesDisplay) {
      hudLivesDisplay.innerHTML = getHeartsHtml(victim.lives, maxL, victim.lives);
    }

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
    deactivateMyTurn();
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
      if (btnExitSolo) btnExitSolo.style.display = 'inline-flex';

      if (data.winner) {
        winnerName.textContent = data.winner.nickname;
        if (winnerBreakdown) {
          const wWords = data.winner.score || 0;
          const wBonus = data.winner.survivalBonus || 0;
          const wFinal = data.winner.finalScore !== undefined ? data.winner.finalScore : (wWords + wBonus);
          winnerBreakdown.innerHTML = `
            <div class="winner-score-badge">
              <span class="winner-score-number">${wFinal}</span>
              <span class="winner-score-unit">PONTOS TOTAIS</span>
            </div>
            <div class="winner-score-subdetails">
              <span>✍️ <strong>${wWords} pts</strong> de palavras</span>
              <span class="bullet-sep">&bull;</span>
              <span>🛡️ <strong>+${wBonus} pts</strong> de sobrevivência</span>
            </div>
          `;
          winnerBreakdown.style.display = 'flex';
        }
      } else {
        winnerName.textContent = 'Ninguém!';
        if (winnerBreakdown) winnerBreakdown.style.display = 'none';
      }

      // Renderiza Destaques & Condecorações (Awards)
      if (awardsSection && awardsGrid) {
        if (data.awards && data.awards.length > 0) {
          awardsGrid.innerHTML = '';
          data.awards.forEach(aw => {
            const card = document.createElement('div');
            card.className = `award-card award-${aw.id}`;
            card.innerHTML = `
              <div class="award-icon-box">${aw.icon}</div>
              <div class="award-text-box">
                <span class="award-role-title">${escapeHtml(aw.title)}</span>
                <span class="award-player-name">${escapeHtml(aw.playerName)}</span>
                <span class="award-detail-text">${escapeHtml(aw.detail)}</span>
              </div>
            `;
            awardsGrid.appendChild(card);
          });
          awardsSection.style.display = 'block';
        } else {
          awardsSection.style.display = 'none';
        }
      }

      rankingList.innerHTML = '';
      (data.ranking || []).forEach((r, idx) => {
        const item = document.createElement('div');
        item.className = 'ranking-item';

        const medals = ['🥇', '🥈', '🥉'];
        const pos = medals[idx] || `#${idx + 1}`;
        const finalPts = r.finalScore !== undefined ? r.finalScore : r.score;
        const survBadge = r.isLastSurvivor 
          ? `<span class="ranking-pill survivor-pill" title="Último sobrevivente da arena">🛡️ Sobreviveu</span>` 
          : (r.lives > 0 
              ? `<span class="ranking-pill" title="${r.lives} vidas">❤️ ${r.lives}</span>`
              : `<span class="ranking-pill pill-dead" title="Eliminado">💔 0</span>`);

        item.innerHTML = `
          <span class="ranking-pos">${pos}</span>
          <div class="ranking-col-user">
            <div class="ranking-user-top">
              <span class="ranking-name">${escapeHtml(r.nickname)}</span>
              ${survBadge}
            </div>
            <span class="ranking-sub">${r.score} pts palavras &bull; ${r.wordsCount} acertos &bull; +${r.survivalBonus || 0} vidas</span>
          </div>
          <div class="ranking-col-score">
            <span class="ranking-score-val">${finalPts}</span>
            <span class="ranking-score-unit">pts</span>
          </div>
        `;
        rankingList.appendChild(item);
      });
    }
  });

  // Reset do Lobby
  socket.on('lobby_reset', () => {
    deactivateMyTurn();
    lastActivePlayerId = null;
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
    const currentPlayer = state.players.find(p => p.id === state.currentPlayerId) || (state.isSolo ? state.players[0] : null);
    const me = state.players.find(p => p.id === myPlayerId) || (state.isSolo ? state.players[0] : null);

    const shouldBeMyTurn = state.isSolo
      ? (me ? me.isAlive : true)
      : (state.currentPlayerId === myPlayerId && me && me.isAlive);

    // Nome na bomba com destaque quando é a vez do jogador
    if (currentPlayer) {
      if (shouldBeMyTurn) {
        currentPlayerName.innerHTML = `<span style="color: #fbbf24; font-weight: 800; text-shadow: 0 0 10px rgba(251, 191, 36, 0.8);">VOCÊ! 🔥</span>`;
      } else {
        currentPlayerName.textContent = currentPlayer.nickname;
      }
    }

    // Painéis de Ação do Jogador com ativação imersiva de turno
    const currentActiveNick = currentPlayer ? currentPlayer.nickname : '';
    currentActivePlayerName = currentActiveNick;

    if (state.isSolo) {
      if (shouldBeMyTurn) {
        activateMyTurn(state.currentPrompt);
      } else {
        deactivateMyTurn(currentActiveNick, me && !me.isAlive);
      }
    } else if (!me || !me.isAlive) {
      deactivateMyTurn(currentActiveNick, true);
    } else if (shouldBeMyTurn) {
      activateMyTurn(state.currentPrompt);
    } else {
      deactivateMyTurn(currentActiveNick, false);
    }

    if (state.currentPrompt && (!activePrompt || activePrompt !== state.currentPrompt)) {
      updatePrompt(state.currentPrompt, state.promptDifficulty, state.isMataMata, state.mataMataHits);
    }

    // Modo Solo HUD vs Multiplayer HUD
    if (state.isSolo) {
      if (hudLivesItem) hudLivesItem.style.display = 'flex';
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
      if (hudLivesItem) hudLivesItem.style.display = 'none';
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

    // Atualiza vidas do jogador local no HUD
    const mePlayer = state.players.find(p => p.id === myPlayerId) || (state.isSolo ? state.players[0] : null);
    if (hudLivesDisplay && mePlayer) {
      hudLivesDisplay.innerHTML = getHeartsHtml(mePlayer.lives, currentMaxLives);
    }

    // Barra de Jogadores com Vidas
    renderGamePlayers(state.players, state.currentPlayerId, Boolean(state.isSolo));

    // Feed de Palavras
    renderWordsFeed(state.wordHistory);
  }

  function renderGamePlayers(players, currentId, isSolo = isSoloMode) {
    const container = circlePlayersContainer || document.getElementById('circle-players-container');
    if (!container || !players || players.length === 0) return;

    container.innerHTML = '';
    const activePlayer = players.find(p => p.id === currentId) || (isSolo ? players[0] : null);

    // Sinergia: Se o turno mudou para um novo jogador, dispara áudio e arremesso da batata
    if (lastActivePlayerId !== null && lastActivePlayerId !== currentId && currentId) {
      if (bombContainer) {
        bombContainer.classList.remove('potato-pass-bounce');
        void bombContainer.offsetWidth; // Reflow para reiniciar a animação
        bombContainer.classList.add('potato-pass-bounce');
      }
      const isMe = (currentId === myPlayerId);
      if (window.soundEngine && typeof window.soundEngine.playTurnPass === 'function') {
        window.soundEngine.playTurnPass(isMe);
      }
    }
    lastActivePlayerId = currentId;

    if (currentPlayerName && activePlayer) {
      if (activePlayer.id === myPlayerId) {
        currentPlayerName.innerHTML = `<span style="color: #fbbf24; font-weight: 800; text-shadow: 0 0 10px rgba(251, 191, 36, 0.8);">VOCÊ! 🔥</span>`;
      } else {
        currentPlayerName.textContent = activePlayer.nickname;
      }
    }

    if (pointerTargetName && activePlayer) {
      if (activePlayer.id === myPlayerId) {
        pointerTargetName.textContent = '🔥 A BATATA ESTÁ NAS SUAS MÃOS! DIGITE RÁPIDO! 🔥';
      } else {
        pointerTargetName.textContent = `A batata está com ${activePlayer.nickname}! 🥔`;
      }
    }

    // Identifica o índice do jogador local para orientar a mesa ("Você" na base para melhor ergonomia)
    let myIndex = players.findIndex(p => p.id === myPlayerId);
    if (myIndex === -1) myIndex = 0;

    const total = players.length;
    // Quando são 2 jogadores: esquerda (180°) e direita (0°)
    // Quando são 3 ou mais: usuário na base (90°) e os amigos distribuídos em círculo
    const startAngle = (total === 2) ? 180 : 90;

    // Raio da elipse em porcentagem do diâmetro da mesa
    const rx = 40;
    const ry = 36;

    let activeAngleDeg = null;

    players.forEach((p, i) => {
      const isTurn = (p.id === currentId);
      const isMe = (p.id === myPlayerId);
      const isMyTurnCard = (isTurn && isMe);

      // Ângulo em graus desta posição na roda
      const angleDeg = (startAngle + (i - myIndex) * (360 / total)) % 360;
      if (isTurn) {
        activeAngleDeg = angleDeg;
      }

      const rad = (angleDeg * Math.PI) / 180;
      const posX = 50 + rx * Math.cos(rad);
      const posY = 50 + ry * Math.sin(rad);

      const card = document.createElement('div');
      card.className = `circle-player-seat ${isTurn ? 'is-active-turn' : ''} ${isMyTurnCard ? 'is-my-card-active' : ''} ${!p.isAlive ? 'is-dead' : ''}`;
      card.style.left = `${posX}%`;
      card.style.top = `${posY}%`;

      const initial = p.nickname.charAt(0).toUpperCase();

      // Corações proporcionais à regra de vidas da sala (❤️ vivas e 💔 quebradas/escuras)
      const heartsHtml = getHeartsHtml(p.lives, currentMaxLives);

      // No modo singleplayer, não exibe o contador de vidas abaixo do ícone do jogador
      const seatLivesHtml = isSolo ? '' : `<span class="seat-lives">${heartsHtml}</span>`;

      // Badge flutuante indicativo de turno
      let turnBadge = '';
      if (isTurn) {
        turnBadge = isMe
          ? `<div class="seat-turn-badge" title="Sua vez!">⚡ SUA VEZ! ⚡</div>`
          : `<div class="seat-turn-badge" title="Com a Batata!">🥔 VEZ DELE</div>`;
      }

      const hostTag = p.isHost ? `<span class="seat-host-tag" title="Anfitrião">👑</span>` : '';

      const nameLabel = isMe
        ? `${escapeHtml(p.nickname)} <small style="color: #fbbf24; font-size: 0.8em;">(Você)</small>`
        : escapeHtml(p.nickname);

      card.innerHTML = `
        ${turnBadge}
        <div class="seat-avatar-wrapper">
          <div class="seat-avatar" style="background-color: ${p.avatarColor || '#3b82f6'}">${initial}</div>
          ${hostTag}
        </div>
        <span class="seat-name">${nameLabel}</span>
        ${seatLivesHtml}
      `;
      container.appendChild(card);
    });

    // Rotação dinâmica da Seta Giratória Central apontando diretamente para o jogador da vez
    if (turnCompassArrow) {
      if (activeAngleDeg !== null && total > 1) {
        turnCompassArrow.style.display = 'block';
        // Rotação suave no menor arco angular para manter a física do giro fluida
        let diff = (activeAngleDeg - (currentArrowDeg % 360) + 540) % 360 - 180;
        currentArrowDeg += diff;
        turnCompassArrow.style.transform = `rotate(${currentArrowDeg}deg)`;
      } else {
        turnCompassArrow.style.display = 'none';
      }
    }
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
