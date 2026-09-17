/**
 * Gerenciador de Salas KBUM
 */

const GameRoom = require('./gameRoom');
const { generateRoomCode } = require('./utils');

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomCode -> GameRoom
    this.socketToRoom = new Map(); // socketId -> roomCode
  }

  /**
   * Cria uma nova sala ou reutiliza se vazia
   */
  createRoom() {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = new GameRoom(code, this.io);
    this.rooms.set(code, room);
    console.log(`Sala criada: [${code}]`);
    return room;
  }

  /**
   * Obtém ou cria uma sala pelo código
   */
  getOrCreateRoom(code) {
    const upperCode = (code || '').trim().toUpperCase();
    if (!upperCode) {
      return this.createRoom();
    }

    if (this.rooms.has(upperCode)) {
      return this.rooms.get(upperCode);
    }

    const room = new GameRoom(upperCode, this.io);
    this.rooms.set(upperCode, room);
    console.log(`Sala criada com código personalizado: [${upperCode}]`);
    return room;
  }

  getRoom(code) {
    if (!code) return null;
    return this.rooms.get(code.trim().toUpperCase()) || null;
  }

  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    return this.getRoom(code);
  }

  createSoloRoom(socket, nickname) {
    this.leaveRoom(socket.id);

    const soloRoomCode = 'SOLO' + Math.floor(100 + Math.random() * 900);
    const room = new GameRoom(soloRoomCode, this.io);
    room.isSolo = true;
    this.rooms.set(soloRoomCode, room);

    socket.join(room.code);
    this.socketToRoom.set(socket.id, room.code);

    const player = room.addPlayer(socket.id, nickname, true);
    console.log(`Jogador Solo [${player.nickname}] iniciou modo solo na sala [${room.code}]`);

    return { room, player };
  }

  joinRoom(socket, roomCode, nickname, isHost = false) {
    // Se o socket já estava em alguma sala, remove
    this.leaveRoom(socket.id);

    const room = this.getOrCreateRoom(roomCode);
    socket.join(room.code);
    this.socketToRoom.set(socket.id, room.code);

    const player = room.addPlayer(socket.id, nickname, isHost);
    console.log(`Jogador [${player.nickname}] entrou na sala [${room.code}] (Host: ${player.isHost})`);

    return { room, player };
  }

  leaveRoom(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return;

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(code);
    if (room) {
      room.removePlayer(socketId);
      console.log(`Jogador ${socketId} saiu da sala [${code}]`);

      // Se a sala ficou vazia, remove após 1 minuto
      if (room.players.size === 0) {
        setTimeout(() => {
          if (this.rooms.has(code) && this.rooms.get(code).players.size === 0) {
            this.rooms.delete(code);
            console.log(`Sala [${code}] limpa por inatividade.`);
          }
        }, 60000);
      }
    }
  }
}

module.exports = RoomManager;
