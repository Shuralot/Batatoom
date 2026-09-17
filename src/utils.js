/**
 * Utilitários para o jogo Batatoom! (Batata Quente de Palavras PT-BR)
 */

/**
 * Remove acentuação gráfica, cedilha e converte para minúsculas.
 * Exemplo: "Maçã" -> "maca", "Coração" -> "coracao", "Árvore" -> "arvore"
 * @param {string} str
 * @returns {string}
 */
function normalizeWord(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    // Decomposição Unicode dos acentos (NFD)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Substituições específicas caso sobre algo
    .replace(/ç/g, 'c')
    // Remove pontuações, espaços internos e caracteres não-alfabéticos
    .replace(/[^a-z]/g, '');
}

/**
 * Verifica se a palavra (normalizada) contém a sílaba/combinação (normalizada).
 * @param {string} normalizedWord
 * @param {string} prompt
 * @returns {boolean}
 */
function containsPrompt(normalizedWord, prompt) {
  if (!normalizedWord || !prompt) return false;
  const cleanPrompt = normalizeWord(prompt);
  return normalizedWord.includes(cleanPrompt);
}

/**
 * Gera um código de sala aleatório amigável de 4 letras maiúsculas
 * @returns {string}
 */
function generateRoomCode() {
  const PRESET_WORDS = [
    'BATA', 'TOOM', 'BOMB', 'FOGO', 'POW', 'BOOM', 'RAIO', 'VAPO', 'TICK',
    'BURR', 'GATO', 'LOBO', 'ZAP', 'PATO', 'SOL', 'LUA', 'TOP',
    'MEGA', 'SUPER', 'ALVO', 'DADO', 'JOGO', 'CENA', 'SHOW', 'VIDA'
  ];
  
  if (Math.random() < 0.4) {
    const pick = PRESET_WORDS[Math.floor(Math.random() * PRESET_WORDS.length)];
    return pick;
  }
  
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I e O para evitar confusão com 1 e 0
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = {
  normalizeWord,
  containsPrompt,
  generateRoomCode
};
