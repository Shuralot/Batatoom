/**
 * Módulo de Gerenciamento do Dicionário PT-BR
 * Mantém em memória o Set com as 400k+ palavras normalizadas para validação O(1) instantânea.
 */

const fs = require('fs');
const path = require('path');
const { normalizeWord, containsPrompt } = require('./utils');
const { buildDictionary } = require('../scripts/build-dictionary');

const DICT_PATH = path.join(__dirname, '..', 'data', 'dictionary.json');

class Dictionary {
  constructor() {
    this.wordsSet = new Set();
    this.displayMap = new Map();
    this.allWordsList = [];
    this.wordIndexMap = new Map();
    this.levels = '';
    this.scores = null;
    this.meta = null;
    this.wordsByLevel = { facil: [], medio: [], dificil: [], mestre: [] };
    this.levelNames = { 1: 'facil', 2: 'medio', 3: 'dificil', 4: 'mestre' };
    this.levelLabels = {
      1: 'Fácil (Cotidiano)',
      2: 'Médio (Intermediário)',
      3: 'Difícil (Avançado)',
      4: 'Mestre (Complexo / Raro)'
    };
    this.isLoaded = false;
  }

  async load() {
    if (this.isLoaded) return;

    if (!fs.existsSync(DICT_PATH)) {
      console.log('Arquivo de dicionário não encontrado. Compilando automaticamente...');
      await buildDictionary();
    }

    console.log('Carregando dicionário na memória...');
    const start = Date.now();
    const rawData = fs.readFileSync(DICT_PATH, 'utf8');
    const parsed = JSON.parse(rawData);

    this.allWordsList = parsed.words || [];
    this.wordsSet = new Set(this.allWordsList);

    if (parsed.display) {
      this.displayMap = new Map(Object.entries(parsed.display));
    }

    this.levels = parsed.levels || '';
    if (parsed.scores) {
      this.scores = Buffer.from(parsed.scores, 'base64');
    }
    this.meta = parsed.meta || null;

    // Indexação O(1) de posições e separação em listas por nível
    this.wordIndexMap = new Map();
    this.wordsByLevel = { facil: [], medio: [], dificil: [], mestre: [] };

    for (let i = 0; i < this.allWordsList.length; i++) {
      const w = this.allWordsList[i];
      this.wordIndexMap.set(w, i);

      const lvlChar = this.levels ? this.levels.charCodeAt(i) - 48 : 2;
      const lvlKey = this.levelNames[lvlChar] || 'medio';
      this.wordsByLevel[lvlKey].push(w);
    }

    this.isLoaded = true;
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(
      `Dicionário carregado com sucesso em ${duration}s! Total de ${this.wordsSet.size.toLocaleString('pt-BR')} palavras ativas ` +
      `(Fácil: ${this.wordsByLevel.facil.length}, Médio: ${this.wordsByLevel.medio.length}, ` +
      `Difícil: ${this.wordsByLevel.dificil.length}, Mestre: ${this.wordsByLevel.mestre.length}).`
    );
  }

  /**
   * Retorna informações completas de dificuldade para uma palavra normalizada
   * @param {string} rawOrNorm
   * @returns {{ level: string, levelNumber: number, label: string, score: number }}
   */
  getWordDifficulty(rawOrNorm) {
    if (!rawOrNorm) {
      return { level: 'medio', levelNumber: 2, label: this.levelLabels[2], score: 40 };
    }

    const norm = normalizeWord(rawOrNorm);
    const idx = this.wordIndexMap.get(norm);

    if (idx !== undefined) {
      const lvlNum = this.levels ? this.levels.charCodeAt(idx) - 48 : 2;
      const score = this.scores ? this.scores[idx] : 35;
      return {
        level: this.levelNames[lvlNum] || 'medio',
        levelNumber: lvlNum || 2,
        label: this.levelLabels[lvlNum] || this.levelLabels[2],
        score
      };
    }

    // Se for flexão morfológica, busca a base
    const base = this.findBaseWord(norm);
    if (base && this.wordIndexMap.has(base)) {
      const baseDiff = this.getWordDifficulty(base);
      const adjScore = Math.min(100, baseDiff.score + (norm.length > base.length ? 3 : 1));
      let lvlNum = 2;
      if (adjScore > 66 || norm.length >= 14) lvlNum = 4;
      else if (adjScore >= 48 || (norm.length >= 9 && adjScore >= 38)) lvlNum = 3;
      else if (adjScore <= 32 && norm.length <= 7) lvlNum = 1;

      return {
        level: this.levelNames[lvlNum],
        levelNumber: lvlNum,
        label: this.levelLabels[lvlNum],
        score: adjScore
      };
    }

    return { level: 'medio', levelNumber: 2, label: this.levelLabels[2], score: 40 };
  }

  /**
   * Verifica se a palavra existe no vocabulário ou é uma flexão válida do PT-BR.
   * @param {string} rawWord
   * @returns {{ valid: boolean, normalized: string, display: string, difficulty?: { level: string, levelNumber: number, label: string, score: number } }}
   */
  checkWord(rawWord) {
    if (!rawWord || typeof rawWord !== 'string') {
      return { valid: false, normalized: '', display: '' };
    }

    // Não aceita números em palavras
    if (/[0-9]/.test(rawWord)) {
      return { valid: false, normalized: '', display: '' };
    }

    // Remove pontuações acidentais nas extremidades (ex: "gato!", ".casa", "bola...")
    const cleaned = rawWord.trim().replace(/^[\s.,!?;:'"~^`]+|[\s.,!?;:'"~^`]+$/g, '');
    if (!cleaned) {
      return { valid: false, normalized: '', display: '' };
    }

    // Não aceita símbolos especiais no meio
    if (/[_#@!$%^&*()+=[\]{}|;:",.<>?/\\]/.test(cleaned)) {
      return { valid: false, normalized: '', display: '' };
    }

    const normalized = normalizeWord(cleaned);
    if (!normalized || normalized.length < 2) {
      return { valid: false, normalized: '', display: '' };
    }

    let valid = this.wordsSet.has(normalized);
    let display = this.displayMap.get(normalized) || cleaned;

    // Regras de flexão morfológica portuguesa (plurais regulares e flexões femininas)
    if (!valid && normalized.length >= 3) {
      valid = this.checkInflection(normalized);
      if (valid) {
        display = cleaned;
      }
    }

    const difficulty = valid ? this.getWordDifficulty(normalized) : null;

    return {
      valid,
      normalized,
      display,
      difficulty
    };
  }

  /**
   * Identifica a forma canônica/base para flexões regulares
   * @param {string} norm
   * @returns {string|null}
   */
  findBaseWord(norm) {
    if (norm.endsWith('s')) {
      const s1 = norm.slice(0, -1);
      if (this.wordsSet.has(s1)) return s1;
    }
    if (norm.endsWith('es')) {
      const s1 = norm.slice(0, -2);
      if (this.wordsSet.has(s1)) return s1;
      const sZ = norm.slice(0, -2) + 'z';
      if (this.wordsSet.has(sZ)) return sZ;
      const sR = norm.slice(0, -2) + 'r';
      if (this.wordsSet.has(sR)) return sR;
    }
    if (norm.endsWith('is')) {
      if (this.wordsSet.has(norm.slice(0, -2) + 'l')) return norm.slice(0, -2) + 'l';
      if (this.wordsSet.has(norm.slice(0, -2) + 'il')) return norm.slice(0, -2) + 'il';
    }
    if (norm.endsWith('ns')) {
      if (this.wordsSet.has(norm.slice(0, -2) + 'm')) return norm.slice(0, -2) + 'm';
    }
    if (norm.endsWith('oes') || norm.endsWith('aes') || norm.endsWith('aos')) {
      if (this.wordsSet.has(norm.slice(0, -3) + 'ao')) return norm.slice(0, -3) + 'ao';
    }
    if (norm.endsWith('as')) {
      if (this.wordsSet.has(norm.slice(0, -2) + 'o')) return norm.slice(0, -2) + 'o';
    }
    if (norm.endsWith('a')) {
      if (this.wordsSet.has(norm.slice(0, -1) + 'o')) return norm.slice(0, -1) + 'o';
    }
    if (norm.endsWith('ora')) {
      if (this.wordsSet.has(norm.slice(0, -1))) return norm.slice(0, -1);
    }
    return null;
  }

  /**
   * Valida plurais regulares e flexões de gênero comuns da língua portuguesa
   * @param {string} norm - palavra já normalizada em minúsculas sem acentos
   * @returns {boolean}
   */
  checkInflection(norm) {
    return this.findBaseWord(norm) !== null;
  }

  /**
   * Retorna todas as palavras normalizadas pertencentes a um determinado nível de dificuldade.
   * @param {'facil' | 'medio' | 'dificil' | 'mestre'} level
   * @returns {string[]}
   */
  getWordsByLevel(level) {
    return this.wordsByLevel[level] || [];
  }

  /**
   * Retorna estatísticas de distribuição do vocabulário
   * @returns {object}
   */
  getDifficultyStats() {
    return this.meta;
  }

  /**
   * Retorna exemplos de palavras válidas para uma determinada sílaba/prompt.
   * Prioriza palavras do cotidiano (Fácil e Médio) para não frustrar o jogador com termos bizarros.
   * @param {string} prompt
   * @param {number} limit
   * @returns {string[]}
   */
  getExamplesForPrompt(prompt, limit = 4) {
    const p = prompt.toLowerCase();
    const examples = [];
    const seen = new Set();

    // 1. Prioridade: palavras fáceis (cotidiano)
    for (const word of this.wordsByLevel.facil) {
      if (containsPrompt(word, p)) {
        const display = this.displayMap.get(word) || word;
        if (!seen.has(word)) {
          seen.add(word);
          examples.push(display);
          if (examples.length >= limit) return examples;
        }
      }
    }

    // 2. Segunda prioridade: palavras de nível médio (vocabulário comum)
    for (const word of this.wordsByLevel.medio) {
      if (containsPrompt(word, p)) {
        const display = this.displayMap.get(word) || word;
        if (!seen.has(word)) {
          seen.add(word);
          examples.push(display);
          if (examples.length >= limit) return examples;
        }
      }
    }

    // 3. Fallback: palavras difíceis / lista geral se o prompt for raro
    for (const word of this.wordsByLevel.dificil) {
      if (containsPrompt(word, p)) {
        const display = this.displayMap.get(word) || word;
        if (!seen.has(word)) {
          seen.add(word);
          examples.push(display);
          if (examples.length >= limit) return examples;
        }
      }
    }

    return examples;
  }

  /**
   * Retorna a lista completa de palavras normalizadas
   * @returns {string[]}
   */
  getAllWords() {
    return this.allWordsList;
  }
}

// Instância singleton para uso em todo o servidor
const dictionaryInstance = new Dictionary();

module.exports = dictionaryInstance;
