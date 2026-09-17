/**
 * Servidor Central KBUM - Batata Quente de Palavras PT-BR
 * Express + Socket.IO + Dicionário em Memória + QR Code no Terminal
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const qrcode = require('qrcode-terminal');
const localtunnel = require('localtunnel');

const dictionary = require('./src/dictionary');
const promptGenerator = require('./src/promptGenerator');
const RoomManager = require('./src/roomManager');

process.on('uncaughtException', (err) => {
  console.error('[AVISO - ERRO INTERNO]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[AVISO - REJEIÇÃO NÃO TRATADA]:', reason);
});

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 30000,
  pingInterval: 10000,
  transports: ['polling', 'websocket']
});

// Arquivos estáticos da interface web
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let publicTunnelUrl = null;

// Endpoint de saúde e info do jogo
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Batatoom! - Batata Quente de Palavras',
    wordsCount: dictionary.wordsSet.size,
    promptsCount: promptGenerator.promptMap.size,
    tunnelUrl: publicTunnelUrl,
    status: 'online'
  });
});

const roomManager = new RoomManager(io);

// Conexões Socket.IO
io.on('connection', (socket) => {
  // Entrar ou criar sala
  socket.on('join_room', ({ roomCode, nickname, isHost }) => {
    try {
      const { room, player } = roomManager.joinRoom(socket, roomCode, nickname, isHost);
      socket.emit('joined_room', {
        roomCode: room.code,
        player,
        roomState: room.getPublicState()
      });
    } catch (err) {
      socket.emit('error_message', { message: 'Erro ao entrar na sala: ' + err.message });
    }
  });

  // Host inicia a partida
  socket.on('start_game', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;

    const result = room.startGame(socket.id);
    if (!result.success) {
      socket.emit('error_message', { message: result.message });
    }
  });

  // Host altera as configurações da sala
  socket.on('update_settings', (newSettings) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;

    const result = room.updateSettings(socket.id, newSettings);
    if (!result.success) {
      socket.emit('error_message', { message: result.message });
    }
  });

  // Digitação em tempo real do jogador da vez
  socket.on('typing_word', ({ text }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.status !== 'playing') return;

    const currentPlayer = room.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== socket.id) return;

    const safeText = String(text || '').slice(0, 35);
    // Transmite para todos na sala (inclusive telão)
    socket.to(room.code).emit('player_typing', {
      playerId: socket.id,
      nickname: currentPlayer.nickname,
      text: safeText
    });
  });

  // Envio de palavra
  socket.on('submit_word', ({ word }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) {
      console.warn(`[submit_word] Sala não encontrada para o socket: ${socket.id}`);
      socket.emit('word_rejected', {
        reason: 'Sala desconectada. Reinicie a partida!',
        word: word
      });
      return;
    }

    const result = room.submitWord(socket.id, word);
    if (!result.success) {
      socket.emit('word_rejected', {
        reason: result.reason,
        word: word
      });
    } else {
      socket.emit('word_accepted', {
        word: result.word,
        points: result.points,
        prompt: result.prompt,
        timeBonus: result.timeBonus,
        isSolo: result.isSolo,
        soloCombo: result.soloCombo,
        soloMultiplier: result.soloMultiplier
      });
    }
  });

  // Host reinicia o lobby
  socket.on('restart_lobby', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;

    const result = room.restartLobby(socket.id);
    if (!result.success) {
      socket.emit('error_message', { message: result.message });
    }
  });

  // Modo Single Player (Desafio Solo de Pontos)
  socket.on('create_solo_game', ({ nickname }) => {
    try {
      const safeNick = (nickname || 'Jogador Solo').trim().slice(0, 15);
      const { room, player } = roomManager.createSoloRoom(socket, safeNick);

      socket.emit('joined_room', {
        roomCode: room.code,
        player: player,
        roomState: room.getPublicState()
      });

      // Inicia imediatamente o jogo solo
      room.startGame(socket.id);
    } catch (err) {
      console.error('[create_solo_game] Erro:', err);
      socket.emit('error_message', { message: 'Erro ao iniciar modo solo: ' + err.message });
    }
  });

  // Reiniciar partida Solo
  socket.on('restart_solo', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;

    room.restartSolo(socket.id);
  });

  // Desconexão
  socket.on('disconnect', () => {
    roomManager.leaveRoom(socket.id);
  });
});

/**
 * Obtém os endereços IP da rede local (Wi-Fi / Ethernet)
 */
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Pega apenas IPv4 não-interno
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  return addresses;
}

// Inicialização com carga de dicionário e prompts
async function startServer() {
  console.log('\n======================================================');
  console.log('  🥔💣 BATATOOM! - BATATA QUENTE DE PALAVRAS (PT-BR) 💣🥔  ');
  console.log('======================================================\n');

  // 1. Carrega Dicionário
  await dictionary.load();

  // 2. Indexa Prompts e Dificuldades
  promptGenerator.initialize(dictionary.getAllWords());

  // 3. Inicia Servidor HTTP
  server.listen(PORT, '0.0.0.0', async () => {
    const ips = getLocalIpAddresses();
    const primaryIp = ips.length > 0 ? ips[0] : 'localhost';
    const localUrl = `http://localhost:${PORT}`;
    const networkUrl = `http://${primaryIp}:${PORT}`;

    const wantTunnel = process.argv.includes('--tunnel') || process.env.TUNNEL === 'true';

    console.log('\n------------------------------------------------------');
    console.log(`✅ Servidor Batatoom iniciado com sucesso!`);
    console.log(`💻 Acesso Local (este PC):   ${localUrl}`);
    console.log(`📱 Acesso Celular / Wi-Fi:    ${networkUrl}`);

    if (wantTunnel) {
      console.log('------------------------------------------------------');
      console.log('⏳ Conectando túnel seguro Cloudflare...');
      try {
        const { startTunnel } = await import('untun');
        const tunnel = await startTunnel({ port: PORT });
        publicTunnelUrl = await tunnel.getURL();

        console.log(`✅ Túnel Cloudflare conectado! (Sem quedas ou 502)`);
        console.log(`🌐 Link Público da Internet: ${publicTunnelUrl}`);
        console.log('------------------------------------------------------');
        console.log('📲 Escaneie o QR Code abaixo para jogar de qualquer lugar (Internet / 4G / Wi-Fi):\n');
        
        qrcode.generate(publicTunnelUrl, { small: true }, (qr) => {
          console.log(qr);
          console.log('------------------------------------------------------');
          console.log('Compartilhe o link acima com todos os seus amigos!');
          console.log('Pressione CTRL+C para encerrar o jogo e o túnel.');
          console.log('======================================================\n');
        });
      } catch (err) {
        console.warn('Falha no Cloudflare tunnel, tentando localtunnel:', err.message);
        try {
          const localtunnel = require('localtunnel');
          const tunnel = await localtunnel({ port: PORT });
          publicTunnelUrl = tunnel.url;
          console.log(`🌐 Link Público (Localtunnel): ${publicTunnelUrl}`);
        } catch (e2) {
          console.error('Falha geral nos túneis:', e2.message);
        }
      }
    } else {
      console.log('------------------------------------------------------');
      console.log('📲 Escaneie o QR Code abaixo com o celular no mesmo Wi-Fi:\n');
      qrcode.generate(networkUrl, { small: true }, (qr) => {
        console.log(qr);
        console.log('------------------------------------------------------');
        console.log('Dica: Para iniciar com túnel público automático, use: npm run dev');
        console.log('======================================================\n');
      });
    }
  });
}

startServer().catch((err) => {
  console.error('Falha crítica ao iniciar servidor:', err);
  process.exit(1);
});
