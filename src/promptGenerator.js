/**
 * Gerador de Prompts (Sílabas e Combinações de Letras) para KBUM
 * Indexa substrings de 2 e 3 letras a partir do dicionário.
 * Classifica a dificuldade de cada prompt com base na acessibilidade real:
 * - Fácil: Rico em palavras cotidianas (Fácil / Cotidiano)
 * - Médio: Quantidade equilibrada de termos cotidianos e intermediários
 * - Difícil: Pouquíssimas palavras cotidianas, dependendo de vocabulário culto/técnico
 * - Mestre: Combinações desafiadoras exclusivas de termos complexos
 */

const dictionary = require('./dictionary');

class PromptGenerator {
  constructor() {
    this.promptMap = new Map(); // prompt -> count
    this.promptStats = new Map(); // prompt -> { total, facil, medio, dificil, mestre }
    this.easyPrompts = [];
    this.mediumPrompts = [];
    this.hardPrompts = [];
    this.mestrePrompts = [];
    this.isReady = false;
  }

  /**
   * Inicializa o gerador utilizando a organização e níveis de dificuldade do dicionário.
   * @param {string[]} wordsList
   */
  initialize(wordsList = null) {
    if (this.isReady) return;
    console.log('Indexando combinações de letras (prompts) com base na nova organização do vocabulário...');
    const start = Date.now();

    const words = wordsList || dictionary.getAllWords();
    const hasLevels = dictionary.levels && dictionary.levels.length === words.length;

    const statsMap = new Map();

    for (let idx = 0; idx < words.length; idx++) {
      const word = words[idx];
      const lvlNum = hasLevels ? (dictionary.levels.charCodeAt(idx) - 48) : 2;
      const len = word.length;
      const seenInWord = new Set();

      // Substrings de 2 letras
      for (let i = 0; i <= len - 2; i++) {
        seenInWord.add(word.substring(i, i + 2));
      }

      // Substrings de 3 letras
      for (let i = 0; i <= len - 3; i++) {
        seenInWord.add(word.substring(i, i + 3));
      }

      for (const sub of seenInWord) {
        let entry = statsMap.get(sub);
        if (!entry) {
          entry = { total: 0, facil: 0, medio: 0, dificil: 0, mestre: 0 };
          statsMap.set(sub, entry);
        }
        entry.total++;
        if (lvlNum === 1) entry.facil++;
        else if (lvlNum === 2) entry.medio++;
        else if (lvlNum === 3) entry.dificil++;
        else entry.mestre++;
      }
    }

    // Classificação baseada na facilidade de evocação humana de palavras cotidianas
    for (const [sub, stat] of statsMap.entries()) {
      // Mínimo de 40 palavras totais para NUNCA ser uma combinação impossível
      if (stat.total < 40) continue;

      const upperSub = sub.toUpperCase();
      this.promptMap.set(upperSub, stat.total);
      this.promptStats.set(upperSub, stat);

      const commonSolutions = stat.facil + stat.medio;

      // 1. FÁCIL: Abundância de palavras no cotidiano (ao menos 14 no fácil e 38 nas faixas comuns)
      if (stat.facil >= 14 && commonSolutions >= 38) {
        this.easyPrompts.push({
          prompt: upperSub,
          count: stat.total,
          difficulty: 'facil',
          stats: stat
        });
      }
      // 2. MÉDIO: Presença moderada de palavras cotidianas/médias
      else if (stat.facil >= 4 || commonSolutions >= 14) {
        this.mediumPrompts.push({
          prompt: upperSub,
          count: stat.total,
          difficulty: 'medio',
          stats: stat
        });
      }
      // 3. DIFÍCIL / MESTRE: Soluções raras no cotidiano, exige vocabulário avançado
      else {
        const item = {
          prompt: upperSub,
          count: stat.total,
          difficulty: 'dificil',
          stats: stat
        };
        this.hardPrompts.push(item);

        if (stat.facil === 0 && stat.medio <= 8) {
          this.mestrePrompts.push({
            prompt: upperSub,
            count: stat.total,
            difficulty: 'mestre',
            stats: stat
          });
        }
      }
    }

    this.isReady = true;
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(
      `Prompts indexados em ${duration}s! Total de combinações viáveis: ${this.promptMap.size} ` +
      `(Fácil: ${this.easyPrompts.length}, Médio: ${this.mediumPrompts.length}, ` +
      `Difícil: ${this.hardPrompts.length}, Mestre: ${this.mestrePrompts.length})`
    );
  }

  /**
   * Sorteia um prompt baseado no modo configurado e no turno
   * @param {string} mode - 'facil' | 'medio' | 'dificil' | 'mestre' | 'dinamico'
   * @param {number} turnNumber
   * @param {Set<string>|Array<string>} recentPrompts
   * @returns {{ prompt: string, difficulty: string, count: number, stats?: object }}
   */
  getPrompt(mode = 'dinamico', turnNumber = 1, recentPrompts = []) {
    let pool;
    const recentSet = new Set(Array.isArray(recentPrompts) ? recentPrompts : Array.from(recentPrompts));

    if (mode === 'facil') {
      pool = this.easyPrompts;
    } else if (mode === 'medio') {
      pool = this.mediumPrompts;
    } else if (mode === 'dificil') {
      // 85% difícil e 15% médio para manter ritmo fluído e estimulante
      pool = Math.random() < 0.85 ? this.hardPrompts : this.mediumPrompts;
    } else if (mode === 'mestre') {
      pool = (this.mestrePrompts.length > 0 && Math.random() < 0.70)
        ? this.mestrePrompts
        : this.hardPrompts;
    } else {
      // Modo Dinâmico Progressivo:
      // Turnos 1 a 6: Fácil (85%) e Médio (15%)
      // Turnos 7 a 15: Médio (65%), Fácil (15%), Difícil (20%)
      // Turnos 16+: Difícil (60%), Médio (30%), Fácil (10%)
      const rand = Math.random();
      if (turnNumber <= 6) {
        pool = rand < 0.85 ? this.easyPrompts : this.mediumPrompts;
      } else if (turnNumber <= 15) {
        if (rand < 0.15) pool = this.easyPrompts;
        else if (rand < 0.80) pool = this.mediumPrompts;
        else pool = this.hardPrompts;
      } else {
        if (rand < 0.60) pool = this.hardPrompts;
        else if (rand < 0.90) pool = this.mediumPrompts;
        else pool = this.easyPrompts;
      }
    }

    if (!pool || pool.length === 0) {
      pool = this.easyPrompts.length > 0 ? this.easyPrompts : this.mediumPrompts;
    }

    // 1. Filtra candidatos disponíveis que ainda não foram sorteados nesta partida
    const available = pool.filter(candidate => !recentSet.has(candidate.prompt));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }

    // 2. Fallback caso todos os prompts daquela categoria já tenham sido esgotados na partida
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getPromptForTurn(turnNumber = 1, recentPrompts = []) {
    return this.getPrompt('dinamico', turnNumber, recentPrompts);
  }

  /**
   * Retorna a contagem total de palavras válidas para um prompt
   * @param {string} prompt
   * @returns {number}
   */
  getCount(prompt) {
    return this.promptMap.get(prompt.toUpperCase()) || 0;
  }

  /**
   * Retorna estatísticas de distribuição para um determinado prompt
   * @param {string} prompt
   * @returns {{ total: number, facil: number, medio: number, dificil: number, mestre: number }|null}
   */
  getStats(prompt) {
    return this.promptStats.get(prompt.toUpperCase()) || null;
  }
}

const promptGeneratorInstance = new PromptGenerator();
module.exports = promptGeneratorInstance;
