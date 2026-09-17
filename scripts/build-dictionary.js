/**
 * Script de compilação, limpeza e classificação de dificuldade do vocabulário PT-BR
 * Lê os arquivos do diretório pt-br-master:
 * - lexico (145k palavras)
 * - conjugações (195k verbos flexionados)
 * - icf (419k termos com score empírico de frequência)
 * - listas (verbos, países, municípios, etc.)
 *
 * Classifica todas as palavras em 4 níveis de dificuldade:
 * - Nível 1: Fácil (Cotidiano)
 * - Nível 2: Médio (Intermediário)
 * - Nível 3: Difícil (Avançado)
 * - Nível 4: Mestre (Complexo / Raro)
 *
 * Baseado em:
 * 1. Frequência no cotidiano (pontuação ICF do corpus PT-BR)
 * 2. Tamanho da palavra (extensão e tempo de digitação)
 * 3. Complexidade ortográfica e fonética (consoantes raras, dígrafos, encontros complexos)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { normalizeWord } = require('../src/utils');

const PT_BR_DIR = path.join(__dirname, '..', 'pt-br-master');
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'dictionary.json');

const RARE_LETTERS = { k: 0.25, w: 0.25, y: 0.25, x: 0.12, z: 0.10 };
const COMPLEX_CLUSTERS = [
  'gn', 'ps', 'pt', 'mn', 'tm', 'ct', 'ft', 'dj', 'bs', 'bd', 'dv', 'xc', 'sc', 'sç'
];

// Palavras de 2 letras legítimas do português
const VALID_2_LETTER_WORDS = new Set([
  'ai', 'ao', 'ar', 'as', 'ca', 'da', 'de', 'do', 'em', 'eu', 'ha', 'ia', 'ir',
  'ja', 'la', 'me', 'na', 'ne', 'no', 'nu', 'os', 'ou', 'pa', 'pe', 'po', 're',
  'se', 'si', 'so', 'te', 'ti', 'tu', 'um', 'va', 've', 'vi'
]);

async function processFileLines(filePath, lineHandler) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Arquivo não encontrado: ${filePath}`);
    return;
  }
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    lineHandler(line);
  }
}

/**
 * Calcula o fator de complexidade ortográfica e fonética (0.0 a 1.0)
 */
function calculateComplexity(norm, display = '') {
  let score = 0;

  // Consoantes e letras raras no português
  for (const ch of norm) {
    if (RARE_LETTERS[ch]) score += RARE_LETTERS[ch];
  }

  // Cedilha
  if (display.includes('ç') || display.includes('Ç')) score += 0.08;

  // Encontros consonantais mudos/complexos
  for (const cl of COMPLEX_CLUSTERS) {
    if (norm.includes(cl)) score += 0.15;
  }

  // Três ou mais consoantes seguidas (ex: nstr, spl, rpr)
  if (/[bcdfghjklmnpqrstvwxyz]{3,}/.test(norm)) {
    score += 0.15;
  }

  // Alta razão consoante / vogal
  const vowels = (norm.match(/[aeiou]/g) || []).length;
  if (norm.length > 3 && (norm.length - vowels) > vowels * 1.5) {
    score += 0.12;
  }

  return Math.min(1.0, score);
}

/**
 * Avalia uma palavra segundo frequência no cotidiano, tamanho e complexidade
 * Retorna { score: number (0-100), levelNumber: 1..4, level: string, label: string }
 */
function evaluateWordDifficulty(norm, icf, display = '') {
  const len = norm.length;

  // 1. Fator Frequência no Cotidiano (ICF varia de ~3.0 a ~24.5)
  // Palavras não catalogadas no ICF assumem valor médio-alto (~18.0)
  const clampedIcf = Math.max(3.0, Math.min(24.5, icf !== undefined ? icf : 18.0));
  const freqFactor = (clampedIcf - 3.0) / 21.5; // 0.0 (máxima frequência) a 1.0 (mínima)

  // 2. Fator Tamanho da Palavra
  let lengthFactor = 0;
  if (len <= 4) lengthFactor = 0.05;
  else if (len <= 6) lengthFactor = 0.20;
  else if (len <= 8) lengthFactor = 0.40;
  else if (len <= 10) lengthFactor = 0.65;
  else if (len <= 13) lengthFactor = 0.85;
  else lengthFactor = 1.0;

  // 3. Fator Complexidade Ortográfica/Fonética
  const complexityFactor = calculateComplexity(norm, display);

  // Média Ponderada:
  // - Uso cotidiano (Frequência): 50%
  // - Tamanho: 25%
  // - Complexidade ortográfica/fonética: 25%
  const total = (freqFactor * 0.50) + (lengthFactor * 0.25) + (complexityFactor * 0.25);
  const scoreInt = Math.min(100, Math.max(1, Math.round(total * 100)));

  // Classificação em 4 faixas perfeitamente equilibradas:
  // Nível 1: Fácil (Cotidiano) - score <= 32 e até 7 letras (ex: casa, amigo, tempo, porta, comida)
  // Nível 2: Médio (Intermediário) - score padrão ou palavras acessíveis (ex: computador, borboleta, bicicleta)
  // Nível 3: Difícil (Avançado) - vocabulário rico, formal, longas ou encontros complexos (ex: perspicaz, subsídio, exuberante)
  // Nível 4: Mestre (Complexo / Raro) - 14+ letras, jargões, arcaísmos ou altíssima complexidade (ex: inconstitucionalidade, paralelepípedo, otorrinolaringologista)
  let levelNumber = 2;
  let level = 'medio';
  let label = 'Médio (Intermediário)';

  if (scoreInt > 66 || len >= 14 || (len >= 12 && freqFactor >= 0.65)) {
    levelNumber = 4;
    level = 'mestre';
    label = 'Mestre (Complexo / Raro)';
  } else if (scoreInt >= 48 || (len >= 9 && scoreInt >= 38) || complexityFactor >= 0.35) {
    levelNumber = 3;
    level = 'dificil';
    label = 'Difícil (Avançado)';
  } else if (scoreInt <= 32 && len <= 7) {
    levelNumber = 1;
    level = 'facil';
    label = 'Fácil (Cotidiano)';
  }

  return {
    score: scoreInt,
    levelNumber,
    level,
    label
  };
}

async function buildDictionary() {
  console.log('--- Compilando e Classificando Dicionário PT-BR com Níveis de Dificuldade ---');
  const startTime = Date.now();

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Carrega pontuações empíricas ICF (419k termos)
  console.log('1. Carregando pontuações empíricas de frequência (ICF)...');
  const icfMap = new Map();
  await processFileLines(path.join(PT_BR_DIR, 'icf'), (line) => {
    const commaIndex = line.indexOf(',');
    if (commaIndex !== -1) {
      const raw = line.slice(0, commaIndex).trim();
      const score = parseFloat(line.slice(commaIndex + 1));
      const norm = normalizeWord(raw);
      if (norm && !isNaN(score)) {
        // Mantém a menor pontuação ICF (maior frequência) se houver variantes
        if (!icfMap.has(norm) || score < icfMap.get(norm)) {
          icfMap.set(norm, score);
        }
      }
    }
  });
  console.log(`   Total de termos com frequência indexados: ${icfMap.size}`);

  // 2. Mapa de palavras: normalizada -> melhor representação com acento
  const wordsMap = new Map();

  const addWord = (raw) => {
    if (!raw) return;
    const cleanRaw = raw.trim();
    if (cleanRaw.length < 2) return;

    // Normalização sem acentos, apenas [a-z]
    const normalized = normalizeWord(cleanRaw);
    if (normalized.length < 2 || normalized.length > 28) return;

    // Remove caracteres especiais
    if (/[0-9_#@!$%^&*()+=[\]{}|;:",.<>?/\\]/.test(cleanRaw)) return;

    // Ignora 3 letras repetidas (ex: 'aaaa', 'kkk', 'zzz')
    if (/(.)\1\1/.test(normalized)) return;

    // Se tiver 2 letras, aceita apenas palavras válidas da língua
    if (normalized.length === 2 && !VALID_2_LETTER_WORDS.has(normalized)) return;

    if (!wordsMap.has(normalized)) {
      wordsMap.set(normalized, cleanRaw.toLowerCase());
    } else {
      // Se a versão atual não tem acento mas a nova tem, preferimos a nova
      const current = wordsMap.get(normalized);
      if (current === normalized && cleanRaw.toLowerCase() !== normalized) {
        wordsMap.set(normalized, cleanRaw.toLowerCase());
      }
    }
  };

  // 3. Lê Léxico
  console.log('2. Lendo léxico...');
  await processFileLines(path.join(PT_BR_DIR, 'lexico'), (line) => {
    addWord(line);
  });
  console.log(`   Total acumulado: ${wordsMap.size} palavras`);

  // 4. Lê Conjugações Verbais
  console.log('3. Lendo conjugações verbais...');
  await processFileLines(path.join(PT_BR_DIR, 'conjugações'), (line) => {
    addWord(line);
  });
  console.log(`   Total acumulado: ${wordsMap.size} palavras`);

  // 5. Adiciona termos válidos do ICF
  console.log('4. Integrando termos do corpus ICF...');
  for (const [norm] of icfMap.entries()) {
    addWord(norm);
  }
  console.log(`   Total acumulado: ${wordsMap.size} palavras`);

  // 6. Lê Listas Especiais
  const listasDir = path.join(PT_BR_DIR, 'listas');
  if (fs.existsSync(listasDir)) {
    const listFiles = fs.readdirSync(listasDir);
    for (const file of listFiles) {
      console.log(`5. Lendo lista: ${file}...`);
      await processFileLines(path.join(listasDir, file), (line) => {
        addWord(line);
      });
    }
  }

  console.log(`\nProcessamento léxico concluído! Total de palavras únicas: ${wordsMap.size}`);

  // 7. Ordena e calcula níveis de dificuldade para todas as palavras
  console.log('6. Calculando níveis de dificuldade para todas as palavras...');
  const normalizedWords = Array.from(wordsMap.keys()).sort();
  const displayMap = Object.fromEntries(wordsMap);

  const levelsArray = [];
  const scoresBuffer = Buffer.alloc(normalizedWords.length);

  const counts = { facil: 0, medio: 0, dificil: 0, mestre: 0 };

  for (let i = 0; i < normalizedWords.length; i++) {
    const norm = normalizedWords[i];
    const disp = displayMap[norm] || norm;
    const icf = icfMap.get(norm);

    const evaluated = evaluateWordDifficulty(norm, icf, disp);
    levelsArray.push(evaluated.levelNumber);
    scoresBuffer[i] = evaluated.score;
    counts[evaluated.level]++;
  }

  const levelsString = levelsArray.join('');
  const scoresBase64 = scoresBuffer.toString('base64');

  const meta = {
    totalWords: normalizedWords.length,
    counts,
    percentages: {
      facil: ((counts.facil / normalizedWords.length) * 100).toFixed(1) + '%',
      medio: ((counts.medio / normalizedWords.length) * 100).toFixed(1) + '%',
      dificil: ((counts.dificil / normalizedWords.length) * 100).toFixed(1) + '%',
      mestre: ((counts.mestre / normalizedWords.length) * 100).toFixed(1) + '%'
    }
  };

  console.log('\n--- Estatísticas de Dificuldade ---');
  console.log(`Fácil (Cotidiano):       ${counts.facil.toLocaleString('pt-BR')} (${meta.percentages.facil})`);
  console.log(`Médio (Intermediário):   ${counts.medio.toLocaleString('pt-BR')} (${meta.percentages.medio})`);
  console.log(`Difícil (Avançado):      ${counts.dificil.toLocaleString('pt-BR')} (${meta.percentages.dificil})`);
  console.log(`Mestre (Complexo/Raro):  ${counts.mestre.toLocaleString('pt-BR')} (${meta.percentages.mestre})`);

  const payload = {
    count: normalizedWords.length,
    words: normalizedWords,
    display: displayMap,
    levels: levelsString,
    scores: scoresBase64,
    meta
  };

  console.log(`\nSalvando em ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload));

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const fileSizeMb = (fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`Dicionário gerado e indexado com sucesso em ${duration}s! Tamanho: ${fileSizeMb} MB`);
}

if (require.main === module) {
  buildDictionary().catch((err) => {
    console.error('Erro ao construir dicionário:', err);
    process.exit(1);
  });
}

module.exports = { buildDictionary, evaluateWordDifficulty };
