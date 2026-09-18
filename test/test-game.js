/**
 * Testes Automatizados para o Batatoom!
 * Valida normalização inteligente, cobertura do dicionário PT-BR,
 * gerador de sílabas e ciclo de vida da sala de jogo.
 */

const assert = require('assert');
const { normalizeWord, containsPrompt } = require('../src/utils');
const dictionary = require('../src/dictionary');
const promptGenerator = require('../src/promptGenerator');
const GameRoom = require('../src/gameRoom');

async function runTests() {
  console.log('🧪 === INICIANDO BATERIA DE TESTES DO BATATOOM ===\n');

  // TESTE 1: Normalização PT-BR inteligente
  console.log('1. Testando normalização inteligente...');
  assert.strictEqual(normalizeWord('Maçã'), 'maca');
  assert.strictEqual(normalizeWord('Coração'), 'coracao');
  assert.strictEqual(normalizeWord('CANTÁVAMOS'), 'cantavamos');
  assert.strictEqual(normalizeWord('  fizeram!  '), 'fizeram');
  assert.strictEqual(normalizeWord('água-viva'), 'aguaviva');
  console.log('   ✅ Normalização inteligente validada com sucesso.');

  // TESTE 2: Checagem de Substring / Prompt
  console.log('2. Testando checagem de substrings com e sem acentos...');
  assert.strictEqual(containsPrompt('coracao', 'ao'), true);
  assert.strictEqual(containsPrompt('maca', 'ca'), true);
  assert.strictEqual(containsPrompt('cantavamos', 'va'), true);
  assert.strictEqual(containsPrompt('abacate', 'xyz'), false);
  console.log('   ✅ Checagem de prompt validada.');

  // TESTE 3: Carregamento do Dicionário
  console.log('3. Testando carregamento do vocabulário PT-BR...');
  await dictionary.load();
  assert.ok(dictionary.wordsSet.size > 200000, `Dicionário deve ter mais de 200k palavras. Atual: ${dictionary.wordsSet.size}`);
  console.log(`   ✅ Dicionário carregado com ${dictionary.wordsSet.size} palavras.`);

  // TESTE 4: Validação de Palavras Flexionadas e Autênticas
  console.log('4. Testando palavras flexionadas, plurais e sem acento...');
  
  const testWords = [
    // Palavras autênticas do português
    { input: 'maçã', expected: true },
    { input: 'maca', expected: true },
    { input: 'coração', expected: true },
    { input: 'coracao', expected: true },
    { input: 'cantávamos', expected: true },
    { input: 'cantavamos', expected: true },
    { input: 'fizeram', expected: true },
    { input: 'computador', expected: true },
    { input: 'palavras', expected: true },
    { input: 'celular', expected: true },
    { input: 'internet', expected: true },
    { input: 'site', expected: true },
    { input: 'blog', expected: true },
    { input: 'time', expected: true },
    { input: 'show', expected: true },
    { input: 'inconstitucionalidade', expected: true },
    { input: 'nunca', expected: true },
    { input: 'quando', expected: true },
    { input: 'cerca', expected: true },
    // Palavras em inglês que NÃO são do português (devem ser rejeitadas)
    { input: 'look', expected: false },
    { input: 'game', expected: false },
    { input: 'play', expected: false },
    { input: 'food', expected: false },
    { input: 'boy', expected: false },
    { input: 'girl', expected: false },
    { input: 'book', expected: false },
    { input: 'door', expected: false },
    { input: 'run', expected: false },
    { input: 'drink', expected: false },
    // Municípios genéricos não-capitais aglutinados (devem ser rejeitados)
    { input: 'altaflorestadoeste', expected: false },
    { input: 'alfredowagner', expected: false },
    // Países, estados e capitais agora são aceitos com e sem espaço
    { input: 'saopaulo', expected: true },
    { input: 'riodejaneiro', expected: true },
    { input: 'estadosunidos', expected: true },
    // Siglas, abreviações e palavras sem vogal (devem ser rejeitadas)
    { input: 'vlw', expected: false },
    { input: 'fdp', expected: false },
    { input: 'mds', expected: false },
    { input: 'https', expected: false },
    { input: 'rpm', expected: false },
    { input: 'adj', expected: false },
    { input: 'adv', expected: false },
    // Termos em espanhol, ofensas estrangeiras e termos que obviamente nem existem (devem ser rejeitados)
    { input: 'perro', expected: false },
    { input: 'malo', expected: false },
    { input: 'bellend', expected: false },
    { input: 'bollok', expected: false },
    { input: 'ababaloalo', expected: false },
    { input: 'aabora', expected: false },
    { input: 'abafanetico', expected: false },
    { input: 'abachuchu', expected: false },
    { input: 'aa', expected: false },
    { input: 'ãã', expected: false },
    { input: 'asdfghjklqwerty', expected: false },
    { input: 'blablabla123', expected: false }
  ];

  for (const item of testWords) {
    const res = dictionary.checkWord(item.input);
    assert.strictEqual(
      res.valid,
      item.expected,
      `Falha na validação da palavra "${item.input}". Esperado: ${item.expected}, Obtido: ${res.valid}`
    );
  }
  console.log('   ✅ Palavras autênticas aceitas e termos inválidos/estrangeiros rejeitados com 100% de sucesso.');

  // TESTE 5: Gerador de Prompts e Níveis de Dificuldade
  console.log('5. Testando indexação de prompts...');
  promptGenerator.initialize(dictionary.getAllWords());

  assert.ok(promptGenerator.promptMap.size > 500, 'Deve haver mais de 500 combinações possíveis');
  assert.ok(promptGenerator.easyPrompts.length > 50, 'Deve haver prompts fáceis');
  assert.ok(promptGenerator.mediumPrompts.length > 50, 'Deve haver prompts médios');
  assert.ok(promptGenerator.hardPrompts.length > 50, 'Deve haver prompts difíceis');

  // Todo prompt sorteado deve ter pelo menos 20 palavras válidas
  for (let i = 1; i <= 30; i++) {
    const p = promptGenerator.getPromptForTurn(i, []);
    assert.ok(p.count >= 20, `Prompt ${p.prompt} deve ter >= 20 palavras. Atual: ${p.count}`);
  }
  console.log('   ✅ Prompts balanceados e classificados por dificuldade.');

  // TESTE 6: Lógica da Sala de Jogo
  console.log('6. Testando lógica da sala de jogo e regras de rodada...');
  
  // Mock do Socket.IO
  const mockIo = {
    to: () => ({
      emit: () => {}
    })
  };

  const room = new GameRoom('TEST', mockIo);
  const p1 = room.addPlayer('socket-1', 'Julio', true);
  const p2 = room.addPlayer('socket-2', 'Amigo', false);
  const p3 = room.addPlayer('socket-3', 'Terceiro', false);

  assert.strictEqual(room.players.size, 3);
  assert.strictEqual(p1.isHost, true);
  assert.strictEqual(p2.isHost, false);

  // Iniciar jogo
  const startResult = room.startGame('socket-1');
  assert.strictEqual(startResult.success, true);
  assert.strictEqual(room.status, 'countdown');

  // Inicia rodada
  room.startRound();
  assert.strictEqual(room.status, 'playing');
  assert.ok(room.currentPrompt.length >= 2);

  const currentPlayer = room.getCurrentPlayer();
  const waitingPlayerId = currentPlayer.id === 'socket-1' ? 'socket-2' : 'socket-1';

  // Tentativa fora da vez deve ser rejeitada
  const wrongTurnRes = room.submitWord(waitingPlayerId, 'palavra');
  assert.strictEqual(wrongTurnRes.success, false);
  assert.strictEqual(wrongTurnRes.reason, 'Não é o seu turno de jogar!');

  // Busca uma palavra válida que contenha o prompt atual
  const examples = dictionary.getExamplesForPrompt(room.currentPrompt, 2);
  assert.ok(examples.length > 0, `Deve encontrar exemplo para o prompt ${room.currentPrompt}`);
  const validWord = examples[0];

  // Envio de palavra válida no turno correto
  const validRes = room.submitWord(currentPlayer.id, validWord);
  assert.strictEqual(validRes.success, true);
  assert.ok(validRes.points >= 10);
  assert.ok(validRes.prompt, 'Deve retornar o prompt respondido');
  assert.ok(validRes.timeBonus >= 1.0, 'Deve conceder bônus de pelo menos 1.0s no jogo normal');
  assert.strictEqual(room.usedWords.has(normalizeWord(validWord)), true);

  // Tentativa de repetir a mesma palavra na mesma rodada deve ser rejeitada
  const nextPlayer = room.getCurrentPlayer();
  // Força o prompt atual a ser uma substring de validWord para passar no teste de substring
  room.currentPrompt = normalizeWord(validWord).substring(0, 2).toUpperCase();
  // Se o próximo tentar a mesma palavra:
  const repeatRes = room.submitWord(nextPlayer.id, validWord);
  assert.strictEqual(repeatRes.success, false);
  assert.strictEqual(repeatRes.isDuplicate, true, 'Deve indicar isDuplicate: true');
  assert.ok(repeatRes.reason.includes('já foi usada'), `Deveria avisar que já foi usada. Obtido: ${repeatRes.reason}`);

  // Verifica que mesmo iniciando uma nova rodada (startRound), a palavra continua bloqueada
  room.startRound();
  room.roundQueue = [nextPlayer.id];
  room.currentQueueIndex = 0;
  room.currentPrompt = normalizeWord(validWord).substring(0, 2).toUpperCase();
  const nextRoundRepeat = room.submitWord(nextPlayer.id, validWord);
  assert.strictEqual(nextRoundRepeat.success, false, 'Palavra já usada na partida deve continuar bloqueada na rodada seguinte');
  assert.strictEqual(nextRoundRepeat.isDuplicate, true);

  // TESTE 7: Regra de Turno Único por Rodada (roundQueue) e Passagem de Vítima
  console.log('7. Testando fila de turnos sem repetição e passagem de batata após explosão...');
  const room2 = new GameRoom('QUEUE_TEST', mockIo);
  room2.addPlayer('p1', 'Player 1', true);
  room2.addPlayer('p2', 'Player 2', false);
  room2.addPlayer('p3', 'Player 3', false);
  room2.settings.turnOrder = 'aleatorio';

  room2.startGame('p1');
  room2.startRound();

  // A fila da rodada deve conter exatamente os 3 jogadores sem repetições
  assert.strictEqual(room2.roundQueue.length, 3, 'Fila deve ter exatamente 3 jogadores');
  const uniqueInQueue = new Set(room2.roundQueue);
  assert.strictEqual(uniqueInQueue.size, 3, 'Todos os jogadores da rodada devem ser únicos');

  // Ao explodir a batata, a vítima deve ser registrada e a próxima rodada não pode começar nela
  const victim2 = room2.getCurrentPlayer();
  const victimId = victim2.id;
  room2.handleBombExplosion();
  assert.strictEqual(room2.lastVictimId, victimId, 'Última vítima deve ser registrada');

  // Testa eliminação completa (vidas chegam a 0) em handleBombExplosion
  victim2.lives = 1;
  room2.status = 'playing';
  room2.handleBombExplosion();
  assert.strictEqual(victim2.lives, 0);
  assert.strictEqual(victim2.isAlive, false, 'Jogador deve ser marcado como morto');
  assert.strictEqual(room2.roundQueue.includes(victimId), false, 'Jogador eliminado deve ser removido de roundQueue');

  // Limpa o timer do handleBombExplosion para podermos chamar startRound manualmente
  if (room2.bombTimerInterval) clearInterval(room2.bombTimerInterval);

  room2.startRound();
  const nextStarter = room2.getCurrentPlayer();
  assert.notStrictEqual(nextStarter.id, victimId, 'Próxima rodada deve passar a batata para outro jogador diferente da vítima');
  console.log('   ✅ Regra de 1 turno por jogador, eliminação e troca de vítima após explosão validadas.');

  // TESTE 8: Modo Mata-Mata (Duelo Final entre os 2 últimos sobreviventes)
  console.log('8. Testando ativação e escalonamento do Mata-Mata...');
  const roomMM = new GameRoom('MM_TEST', mockIo);
  roomMM.addPlayer('duel1', 'Duelo 1', true);
  roomMM.addPlayer('duel2', 'Duelo 2', false);

  roomMM.startGame('duel1');
  roomMM.startRound();
  assert.strictEqual(roomMM.isMataMata, true, 'Mata-Mata deve ser ativado com 2 jogadores restantes');
  assert.strictEqual(roomMM.mataMataHits, 0);

  // Acerto de palavra no Mata-Mata incrementa contador
  const mmPlayer = roomMM.getCurrentPlayer();
  const mmExamples = dictionary.getExamplesForPrompt(roomMM.currentPrompt, 2);
  const mmWord = mmExamples[0];
  const mmRes = roomMM.submitWord(mmPlayer.id, mmWord);
  assert.strictEqual(mmRes.success, true);
  assert.ok(mmRes.timeBonus >= 0.5, 'Deve conceder bônus de pelo menos 0.5s no Mata-Mata');
  assert.strictEqual(roomMM.mataMataHits, 1, 'Mata-Mata hits deve ser 1 após acerto');

  if (roomMM.bombTimerInterval) clearInterval(roomMM.bombTimerInterval);
  console.log('   ✅ Modo Mata-Mata com escalonamento dinâmico validado com sucesso.');

  // TESTE 9: Modo Single Player (Solo Mode)
  console.log('9. Testando Modo Solo: pontuação com combo, bônus de tempo e progressão...');
  const roomSolo = new GameRoom('SOLO_TEST', mockIo);
  roomSolo.isSolo = true;
  roomSolo.addPlayer('solo_player', 'Jogador Solitário', true);

  const startRes = roomSolo.startGame('solo_player');
  assert.strictEqual(startRes.success, true, 'Deve iniciar sala solo com 1 jogador');

  roomSolo.startRound();
  assert.strictEqual(roomSolo.status, 'playing');
  assert.strictEqual(roomSolo.soloCombo, 0);

  const soloPlayer = roomSolo.getCurrentPlayer();
  assert.strictEqual(soloPlayer.id, 'solo_player');

  // Submissão de palavras com combo
  const soloExamples1 = dictionary.getExamplesForPrompt(roomSolo.currentPrompt, 2);
  const word1 = soloExamples1[0];
  const resWord1 = roomSolo.submitWord('solo_player', word1);
  assert.strictEqual(resWord1.success, true);
  assert.strictEqual(resWord1.isSolo, true);
  assert.strictEqual(resWord1.soloCombo, 1);
  assert.ok(resWord1.timeBonus >= 3.5, `Nível 1 deve conceder bônus cumulativo generoso (>= 3.5s). Recebido: ${resWord1.timeBonus}`);
  assert.ok(resWord1.timeLeftSec > 0, 'Deve retornar o tempo restante acumulado');
  assert.strictEqual(roomSolo.soloCombo, 1);

  // Simula combo acumulado
  roomSolo.soloCombo = 8;
  const soloMultiplier = roomSolo.getSoloMultiplier();
  assert.strictEqual(soloMultiplier, 2.0, 'Combo 8 deve ter multiplicador 2.0x');

  // Simula explosão da batata no Solo
  roomSolo.handleBombExplosion();
  assert.strictEqual(roomSolo.soloCombo, 0, 'Combo deve ser zerado após explosão');
  assert.strictEqual(soloPlayer.lives, 2, 'Vidas devem ser decrementadas para 2');

  // Limpa o timer do handleBombExplosion
  if (roomSolo.bombTimerInterval) clearInterval(roomSolo.bombTimerInterval);

  console.log('   ✅ Modo Solo validado com sucesso (regras, bônus, combo e vidas).');

  // TESTE 11: Validação de Plurais, Flexões e Pontuações Acidentais
  console.log('11. Testando aceitação de plurais, femininos e limpeza de pontuação...');
  const inflectionTests = [
    'gatos', 'mesas', 'computadores', 'azuis', 'pães', 'paes', 'jogadores',
    'jogadora', 'bonitas', 'professores', 'professora', 'garotas',
    'casa!', '  maca.  ', 'fogo?'
  ];
  for (const w of inflectionTests) {
    const res = dictionary.checkWord(w);
    assert.strictEqual(res.valid, true, `Palavra legítima "${w}" deve ser aceita.`);
  }
  console.log('   ✅ Plurais regulares, flexões de gênero e limpeza de pontuação validadas.');

  // TESTE 12: createSoloRoom nativo do RoomManager
  console.log('12. Testando createSoloRoom nativo com isolamento total...');
  const RoomManager = require('../src/roomManager');
  const rm = new RoomManager(mockIo);
  const soloSocket = { id: 'solo_native_1', join: () => {}, emit: () => {} };
  const { room: nativeSoloRoom, player: nativeSoloPlayer } = rm.createSoloRoom(soloSocket, 'PlayerSolo');
  assert.strictEqual(nativeSoloRoom.isSolo, true, 'isSolo deve ser true desde o início');
  assert.strictEqual(nativeSoloPlayer.isHost, true);
  assert.ok(nativeSoloRoom.code.startsWith('SOLO'));

  nativeSoloRoom.startGame('solo_native_1');
  nativeSoloRoom.startRound();
  assert.strictEqual(nativeSoloRoom.status, 'playing');

  // Testando envio de palavra legítima no solo com pontuação
  const promptExamples = dictionary.getExamplesForPrompt(nativeSoloRoom.currentPrompt, 1);
  const wordWithExclamation = promptExamples[0] + '!';
  const soloWordRes = nativeSoloRoom.submitWord('solo_native_1', wordWithExclamation);
  assert.strictEqual(soloWordRes.success, true, 'Deve aceitar palavra com pontuação removida');
  if (nativeSoloRoom.bombTimerInterval) clearInterval(nativeSoloRoom.bombTimerInterval);
  console.log('   ✅ createSoloRoom e submissão resiliente validadas com sucesso.');

  // TESTE 13: Classificação em Níveis de Dificuldade do Dicionário
  console.log('13. Testando classificação em níveis de dificuldade (Cotidiano, Tamanho e Complexidade)...');
  const wFacil = dictionary.checkWord('casa');
  assert.strictEqual(wFacil.valid, true);
  assert.strictEqual(wFacil.difficulty.level, 'facil');
  assert.strictEqual(wFacil.difficulty.levelNumber, 1);

  const wMedio = dictionary.checkWord('computador');
  assert.strictEqual(wMedio.valid, true);
  assert.strictEqual(wMedio.difficulty.level, 'medio');
  assert.strictEqual(wMedio.difficulty.levelNumber, 2);

  const wDificil = dictionary.checkWord('perspicaz');
  assert.strictEqual(wDificil.valid, true);
  assert.strictEqual(wDificil.difficulty.level, 'dificil');
  assert.strictEqual(wDificil.difficulty.levelNumber, 3);

  const wMestre = dictionary.checkWord('inconstitucionalidade');
  assert.strictEqual(wMestre.valid, true);
  assert.strictEqual(wMestre.difficulty.level, 'mestre');
  assert.strictEqual(wMestre.difficulty.levelNumber, 4);

  // Verificação de particionamento e contagens
  const listFacil = dictionary.getWordsByLevel('facil');
  const listMedio = dictionary.getWordsByLevel('medio');
  const listDificil = dictionary.getWordsByLevel('dificil');
  const listMestre = dictionary.getWordsByLevel('mestre');

  assert.ok(listFacil.length >= 10000, 'Nível fácil deve conter vocabulário cotidiano robusto');
  assert.ok(listMedio.length >= 40000, 'Nível médio deve conter vocabulário intermediário');
  assert.ok(listDificil.length >= 100000, 'Nível difícil deve conter termos avançados e flexões');
  assert.ok(listMestre.length >= 50000, 'Nível mestre deve conter termos extensos e complexos');

  const stats = dictionary.getDifficultyStats();
  assert.ok(stats && stats.totalWords > 200000);
  assert.ok(stats.counts.facil > 0);

  // Verificação de exemplos que priorizam cotidiano
  const caExamples = dictionary.getExamplesForPrompt('CA', 4);
  assert.strictEqual(caExamples.length, 4);
  for (const ex of caExamples) {
    assert.ok(ex.length <= 12, 'Exemplos preferenciais devem ser palavras cotidianas acessíveis');
  }

  console.log('   ✅ Classificação em níveis de dificuldade e particionamento validados com 100% de sucesso.');

  // TESTE 14: Novas Opções de Configuração da Sala (Desativar Mata-Mata, Vidas Iniciais, Mínimo de Letras, Timer)
  console.log('14. Testando configurações avançadas da sala (desativar mata-mata, vidas, minWordLength e timer)...');
  const roomConfig = new GameRoom('CONFIG_TEST', mockIo);
  roomConfig.addPlayer('host_cfg', 'Host Master', true);
  roomConfig.addPlayer('p2_cfg', 'Player 2', false);

  // 14.1 Host altera opções
  const cfgRes = roomConfig.updateSettings('host_cfg', {
    mataMata: 'desativado',
    initialLives: 5,
    minWordLength: 4,
    timerType: 'rapido'
  });
  assert.strictEqual(cfgRes.success, true);
  assert.strictEqual(roomConfig.settings.mataMata, 'desativado');
  assert.strictEqual(roomConfig.settings.initialLives, 5);
  assert.strictEqual(roomConfig.settings.minWordLength, 4);
  assert.strictEqual(roomConfig.settings.timerType, 'rapido');

  // Vidas foram atualizadas na sala de espera para 5
  assert.strictEqual(roomConfig.getPlayer('host_cfg').lives, 5);
  assert.strictEqual(roomConfig.getPlayer('p2_cfg').lives, 5);

  // 14.2 Inicia o jogo com mata-mata desativado e 2 jogadores
  roomConfig.startGame('host_cfg');
  roomConfig.startRound();
  assert.strictEqual(roomConfig.isMataMata, false, 'Com mata-mata desativado, isMataMata deve ser false mesmo com 2 jogadores');
  assert.strictEqual(roomConfig.bombTotalTimeMs, 10000, 'Timer rápido deve configurar 10000ms de tempo total');

  // 14.3 Valida restrição de tamanho mínimo de palavra (minWordLength: 4)
  const cfgCurPlayer = roomConfig.getCurrentPlayer();
  const shortPrompt = roomConfig.currentPrompt;
  // Tenta enviar palavra com 2 ou 3 letras que contenha o prompt (ou mockando a validação)
  const shortTry = roomConfig.submitWord(cfgCurPlayer.id, 'sol');
  assert.strictEqual(shortTry.success, false);
  assert.ok(shortTry.reason.includes('4 letras'), 'Deve rejeitar palavras com menos de 4 letras quando configurado');

  if (roomConfig.bombTimerInterval) clearInterval(roomConfig.bombTimerInterval);
  console.log('   ✅ Novas opções de configuração da sala validadas com 100% de sucesso.');

  // TESTE 15: Recompensa de Palavras Difíceis e Mestre (Pontuações Altas e Mais Tempo)
  console.log('15. Testando alta pontuação e bônus de tempo extra para palavras difíceis e complexas...');
  const roomDiff = new GameRoom('DIFF_TEST', mockIo);
  roomDiff.addPlayer('p_diff1', 'Jogador 1', true);
  roomDiff.addPlayer('p_diff2', 'Jogador 2', false);
  roomDiff.addPlayer('p_diff3', 'Jogador 3', false);
  roomDiff.startGame('p_diff1');
  roomDiff.startRound();

  const curPlayerDiff = roomDiff.getCurrentPlayer();

  // Submissão de palavra Difícil: perspicaz (prompt "AZ")
  roomDiff.currentPrompt = 'AZ';
  const resDificil = roomDiff.submitWord(curPlayerDiff.id, 'perspicaz');
  assert.strictEqual(resDificil.success, true);
  assert.strictEqual(resDificil.difficulty.level, 'dificil');
  assert.ok(resDificil.points >= 50, `Palavra difícil deve gerar pontuação alta (>= 50). Obtido: ${resDificil.points}`);
  assert.strictEqual(resDificil.timeBonus, 2.5, `Palavra difícil no multiplayer deve dar 2.5s de bônus. Obtido: ${resDificil.timeBonus}`);
  assert.strictEqual(resDificil.bonusReason, 'Vocabulário Rico! ⚡');

  // Submissão de palavra Mestre: inconstitucionalidade (prompt "CION")
  const nextPlayerDiff = roomDiff.getCurrentPlayer();
  roomDiff.currentPrompt = 'CION';
  const resMestre = roomDiff.submitWord(nextPlayerDiff.id, 'inconstitucionalidade');
  assert.strictEqual(resMestre.success, true);
  assert.strictEqual(resMestre.difficulty.level, 'mestre');
  assert.ok(resMestre.points >= 100, `Palavra mestre deve gerar pontuação muito alta (>= 100). Obtido: ${resMestre.points}`);
  assert.strictEqual(resMestre.timeBonus, 4.0, `Palavra mestre no multiplayer deve dar 4.0s de bônus. Obtido: ${resMestre.timeBonus}`);
  assert.strictEqual(resMestre.bonusReason, 'Palavra Mestre! 💎');

  if (roomDiff.bombTimerInterval) clearInterval(roomDiff.bombTimerInterval);
  console.log('   ✅ Palavras difíceis e mestre geram altas pontuações e concedem mais tempo validado com sucesso.');

  // TESTE 16: Validação de Países, Estados do Brasil e Capitais
  console.log('16. Testando inclusão de países, estados do Brasil e capitais...');
  
  // 16.1 Todos os 27 estados do Brasil
  const todosEstados = [
    'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal',
    'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul',
    'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí',
    'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia',
    'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'
  ];
  for (const est of todosEstados) {
    const res = dictionary.checkWord(est);
    assert.strictEqual(res.valid, true, `Estado "${est}" deve ser aceito`);
    // Também deve ser aceito sem espaços nem acentos
    const norm = normalizeWord(est);
    const resNorm = dictionary.checkWord(norm);
    assert.strictEqual(resNorm.valid, true, `Estado normalizado "${norm}" deve ser aceito`);
  }

  // 16.2 Todas as 27 capitais brasileiras
  const todasCapitais = [
    'Rio Branco', 'Maceió', 'Macapá', 'Manaus', 'Salvador', 'Fortaleza',
    'Brasília', 'Vitória', 'Goiânia', 'São Luís', 'Cuiabá', 'Campo Grande',
    'Belo Horizonte', 'Belém', 'João Pessoa', 'Curitiba', 'Recife', 'Teresina',
    'Rio de Janeiro', 'Natal', 'Porto Alegre', 'Porto Velho', 'Boa Vista',
    'Florianópolis', 'São Paulo', 'Aracaju', 'Palmas'
  ];
  for (const cap of todasCapitais) {
    const res = dictionary.checkWord(cap);
    assert.strictEqual(res.valid, true, `Capital "${cap}" deve ser aceita`);
    const norm = normalizeWord(cap);
    const resNorm = dictionary.checkWord(norm);
    assert.strictEqual(resNorm.valid, true, `Capital normalizada "${norm}" deve ser aceita`);
  }

  // 16.3 Países e variantes comuns
  const amostraPaises = [
    'Brasil', 'brasil',
    'Estados Unidos', 'estados unidos', 'estadosunidos',
    'Alemanha', 'alemanha',
    'Japão', 'japao',
    'África do Sul', 'africadosul',
    'Coreia do Sul', 'coreiadosul',
    'Nova Zelândia', 'novazelandia',
    'Tchéquia', 'Catar', 'Portugal', 'França', 'Itália', 'Canadá',
    'Argentina', 'Chile', 'México', 'Uruguai', 'Austrália', 'China', 'Rússia'
  ];
  for (const pais of amostraPaises) {
    const res = dictionary.checkWord(pais);
    assert.strictEqual(res.valid, true, `País "${pais}" deve ser aceito`);
  }

  // 16.4 Submissão no fluxo de partida (GameRoom)
  const roomGeo = new GameRoom('GEO_TEST', mockIo);
  roomGeo.addPlayer('p_geo1', 'Viajante', true);
  roomGeo.addPlayer('p_geo2', 'Explorador', false);
  roomGeo.startGame('p_geo1');
  roomGeo.startRound();
  roomGeo.roundQueue = ['p_geo1', 'p_geo2'];
  roomGeo.currentQueueIndex = 0;

  // Teste com prompt "PA" -> "São Paulo"
  roomGeo.currentPrompt = 'PA';
  const resGeo1 = roomGeo.submitWord('p_geo1', 'São Paulo');
  assert.strictEqual(resGeo1.success, true, 'Submissão de "São Paulo" com prompt "PA" deve ter sucesso');

  // Teste com prompt "HOR" -> "Belo Horizonte"
  roomGeo.roundQueue = ['p_geo1', 'p_geo2'];
  roomGeo.currentQueueIndex = 1;
  roomGeo.currentPrompt = 'HOR';
  const resGeo2 = roomGeo.submitWord('p_geo2', 'belo horizonte');
  assert.strictEqual(resGeo2.success, true, 'Submissão de "belo horizonte" com prompt "HOR" deve ter sucesso');

  // Teste com prompt "UNI" -> "Estados Unidos"
  roomGeo.roundQueue = ['p_geo1', 'p_geo2'];
  roomGeo.currentQueueIndex = 0;
  roomGeo.currentPrompt = 'UNI';
  const resGeo3 = roomGeo.submitWord('p_geo1', 'estadosunidos');
  assert.strictEqual(resGeo3.success, true, 'Submissão de "estadosunidos" com prompt "UNI" deve ter sucesso');

  if (roomGeo.bombTimerInterval) clearInterval(roomGeo.bombTimerInterval);
  console.log('   ✅ 100% dos 27 estados, 27 capitais e países validados no motor do jogo com sucesso.');

  // 17. Testando pontuação híbrida, bônus de sobrevivência e awards de fim de jogo
  console.log('17. Testando pontuação híbrida, bônus de sobrevivência e awards de fim de jogo...');
  let emittedGameOver = null;
  const mockIoGameOver = {
    to: () => ({
      emit: (evt, payload) => {
        if (evt === 'game_over') emittedGameOver = payload;
      }
    })
  };

  const roomHybrid = new GameRoom('HYBRID_TEST', mockIoGameOver);
  const playerH1 = roomHybrid.addPlayer('pH1', 'CraqueDasPalavras', true);
  const playerH2 = roomHybrid.addPlayer('pH2', 'SobreviventeCalmo', false);
  roomHybrid.startGame('pH1');
  roomHybrid.startRound();

  // playerH1 faz palavra mestre e ganha muitos pontos
  roomHybrid.roundQueue = ['pH1', 'pH2'];
  roomHybrid.currentQueueIndex = 0;
  roomHybrid.currentPrompt = 'CION';
  const resMestreHybrid = roomHybrid.submitWord('pH1', 'inconstitucionalidade');
  assert.strictEqual(resMestreHybrid.success, true);
  assert.ok(playerH1.score >= 100, 'Palavra mestre longa deve render pontuação alta (> 100 pts)');

  // Simulamos playerH1 sendo eliminado na reta final (vidas = 0)
  playerH1.lives = 0;
  playerH1.isAlive = false;
  // E playerH2 sobrevive com 1 vida
  playerH2.lives = 1;
  playerH2.score = 30; // Fez apenas uma palavra simples
  playerH2.isAlive = true;

  roomHybrid.endGame();

  assert.ok(emittedGameOver, 'Deve emitir game_over');
  assert.strictEqual(typeof emittedGameOver.winner, 'object', 'Deve conter vencedor');
  assert.ok(emittedGameOver.awards.length >= 2, 'Deve gerar lista de awards/troféus');

  // Verifica que o bônus de sobrevivência foi computado: 1 vida * 200 + 300 (lastSurvivor) = 500
  const survivorData = emittedGameOver.ranking.find(r => r.id === 'pH2');
  assert.strictEqual(survivorData.survivalBonus, 500, 'Sobrevivente com 1 vida deve ter 500 pts de bônus');
  assert.strictEqual(survivorData.finalScore, 530, 'Final score do sobrevivente deve ser 530 (30 + 500)');

  // Se playerH1 fez uma palavra de 200 pts, mesmo eliminado com 0 vidas ele teve 200 pts
  const p1Data = emittedGameOver.ranking.find(r => r.id === 'pH1');
  assert.strictEqual(p1Data.survivalBonus, 0, 'Eliminado tem 0 de bônus de vida');
  assert.strictEqual(p1Data.finalScore, playerH1.score, 'Final score do eliminado é o seu word score');

  // Se playerH1 fizesse 700 pts, ele venceria mesmo eliminado! Testemos esse equilíbrio:
  playerH1.score = 700;
  roomHybrid.endGame();
  assert.strictEqual(emittedGameOver.winner.id, 'pH1', 'Jogador com pontuação extraordinária pode vencer pelo desempenho geral');
  assert.strictEqual(emittedGameOver.lastSurvivor.id, 'pH2', 'Último sobrevivente continua registrado como pH2');

  console.log('   ✅ Sistema de pontuação híbrida e awards no fim de partida validados com 100% de sucesso.');

  // 18. Testando piso dinâmico anti-stalling e resfriamento da batata
  console.log('18. Testando piso dinâmico anti-stalling e resfriamento da batata...');
  const roomStall = new GameRoom('STALL_TEST', mockIo);
  roomStall.addPlayer('ps1', 'Espertinho', true);
  roomStall.addPlayer('ps2', 'Inocente', false);
  roomStall.addPlayer('ps3', 'Amigo', false);
  roomStall.startGame('ps1');
  roomStall.startRound();

  // No início (turnCount = 0), o piso mínimo deve ser 8500ms
  roomStall.turnCount = 0;
  assert.strictEqual(roomStall.getMinimumTurnBufferMs(), 8500, 'Piso inicial deve ser 8500ms');

  // No turno 10, o piso decai para 8500 - 1500 = 7000ms
  roomStall.turnCount = 10;
  assert.strictEqual(roomStall.getMinimumTurnBufferMs(), 7000, 'Piso no turno 10 deve ser 7000ms');

  // Nos turnos avançados (ex: turno 30), deve respeitar o limite inferior de 5500ms
  roomStall.turnCount = 30;
  assert.strictEqual(roomStall.getMinimumTurnBufferMs(), 5500, 'Piso nos turnos avançados deve ser travado em 5500ms');

  // No Mata-Mata, decai de 7500ms até o piso de 4800ms
  roomStall.isMataMata = true;
  roomStall.mataMataHits = 0;
  assert.strictEqual(roomStall.getMinimumTurnBufferMs(), 7500, 'Mata-Mata inicial deve ser 7500ms');
  roomStall.mataMataHits = 15;
  assert.strictEqual(roomStall.getMinimumTurnBufferMs(), 4800, 'Mata-Mata avançado deve ser travado em 4800ms');

  // Simula jogador segurando a batata até restar apenas 1 segundo antes de enviar a palavra
  roomStall.isMataMata = false;
  roomStall.turnCount = 0;
  roomStall.roundQueue = ['ps1', 'ps2'];
  roomStall.currentQueueIndex = 0;
  roomStall.currentPrompt = 'CA';
  // Força tempo restante em apenas 800ms (quase estourando)
  roomStall.bombEndTime = Date.now() + 800;
  roomStall.currentTensionStage = 4; // Pânico

  const resStall = roomStall.submitWord('ps1', 'casa');
  assert.strictEqual(resStall.success, true);

  // O tempo restante deve ter sido estendido para pelo menos 8.500ms
  const remainingAfterPass = roomStall.bombEndTime - Date.now();
  assert.ok(remainingAfterPass >= 8400, `Tempo restante deve ser restaurado pelo piso anti-stalling (>= 8400ms). Obtido: ${remainingAfterPass}`);

  // A batata deve ter resfriado (não pode estar mais em Pânico imediato no colo do próximo jogador)
  assert.notStrictEqual(roomStall.currentTensionStage, 4, 'A batata deve resfriar após a aplicação do piso anti-stalling');

  if (roomStall.bombTimerInterval) clearInterval(roomStall.bombTimerInterval);
  console.log('   ✅ Piso dinâmico anti-stalling e resfriamento validados com 100% de sucesso.');

  // 19. Testando unicidade de prompts na partida e bloqueio de palavras
  console.log('19. Testando unicidade de prompts na partida e bloqueio de palavras...');
  const roomUniq = new GameRoom('UNIQ_TEST', mockIo);
  roomUniq.addPlayer('u1', 'PlayerA', true);
  roomUniq.addPlayer('u2', 'PlayerB', false);
  roomUniq.startGame('u1');

  // Sorteia 30 prompts consecutivos e garante que NENHUM se repete
  const drawnPrompts = new Set();
  for (let t = 0; t < 30; t++) {
    roomUniq.turnCount = t + 1;
    roomUniq.pickNewPrompt();
    assert.strictEqual(
      drawnPrompts.has(roomUniq.currentPrompt),
      false,
      `Prompt "${roomUniq.currentPrompt}" foi sorteado mais de uma vez na mesma partida!`
    );
    drawnPrompts.add(roomUniq.currentPrompt);
  }
  assert.strictEqual(drawnPrompts.size, 30, 'Todos os 30 prompts sorteados devem ser 100% distintos');

  if (roomUniq.bombTimerInterval) clearInterval(roomUniq.bombTimerInterval);
  console.log('   ✅ Prompts 100% únicos na partida e bloqueio global de repetição validados com sucesso.');

  // 20. Testando vocabulário regional brasileiro e nomes de comidas típicas no dicionário
  console.log('20. Testando vocabulário regional brasileiro e nomes de comidas típicas...');
  const regionalWordsToTest = [
    'macaxeira', 'aipim', 'mandioca', 'jerimum',
    'coxinha', 'acarajé', 'vatapá', 'caruru', 'tapioca', 'farofa',
    'picanha', 'torresmo', 'calabresa', 'paçoca', 'buchada', 'sarapatel',
    'brigadeiro', 'beijinho', 'quindim', 'pamonha', 'canjica', 'curau', 'mungunzá',
    'açaí', 'cupuaçu', 'pequi', 'jabuticaba', 'chimarrão', 'tucupi', 'jambu',
    'oxente', 'oxe', 'vixe', 'uai', 'tchê', 'guri', 'piá'
  ];

  for (const word of regionalWordsToTest) {
    const check = dictionary.checkWord(word);
    assert.strictEqual(
      check.valid,
      true,
      `Palavra regional/culinária "${word}" deveria ser aceita pelo dicionário!`
    );
  }

  // Testa submissão de palavra regional em sala de jogo
  const roomRegional = new GameRoom('REGIONAL_TEST', mockIo);
  roomRegional.addPlayer('r1', 'Regional Player 1', true);
  roomRegional.addPlayer('r2', 'Regional Player 2', false);
  roomRegional.startGame('r1');
  roomRegional.startRound();
  const curP = roomRegional.getCurrentPlayer();
  roomRegional.currentPrompt = 'MAC';
  const subRes = roomRegional.submitWord(curP.id, 'macaxeira');
  assert.strictEqual(subRes.success, true, 'Submissão de "macaxeira" deve ser aceita com sucesso');
  assert.ok(subRes.points >= 10);
  assert.strictEqual(roomRegional.usedWords.has('macaxeira'), true);

  if (roomRegional.bombTimerInterval) clearInterval(roomRegional.bombTimerInterval);
  console.log('   ✅ Vocabulário regional e comidas típicas brasileiras validados com 100% de sucesso.');

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO! 💣\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ ERRO NOS TESTES:', err);
  process.exit(1);
});

