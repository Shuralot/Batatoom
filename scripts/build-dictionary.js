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
  'ai', 'ao', 'ar', 'as', 'ca', 'da', 'de', 'do', 'em', 'eu', 'fe', 'ha', 'ia', 'ir',
  'ja', 'la', 'me', 'na', 'ne', 'no', 'nu', 'os', 'ou', 'pa', 'pe', 'po', 're',
  'se', 'si', 'so', 'te', 'ti', 'tu', 'um', 'va', 've', 'vi', 'ze'
]);

// Lista negra curada de palavras estrangeiras, abreviações, siglas e termos inexistentes
const STOPWORDS = new Set([
  // Termos comuns em inglês que vazam de textos e corpora da web
  'look', 'looks', 'looking', 'game', 'games', 'play', 'plays', 'playing',
  'food', 'foods', 'boy', 'boys', 'girl', 'girls', 'book', 'books',
  'door', 'doors', 'run', 'running', 'drink', 'drinks', 'drinking',
  'dog', 'dogs', 'cat', 'cats', 'tree', 'trees', 'house', 'houses',
  'water', 'waters', 'how', 'slow', 'wow', 'view', 'views', 'know',
  'fast', 'open', 'opened', 'opening', 'close', 'closed', 'closing',
  'break', 'breaks', 'breaking', 'stop', 'stops', 'stopping',
  'start', 'starts', 'starting', 'life', 'love', 'loves', 'loving',
  'work', 'works', 'working', 'city', 'phone', 'phones', 'car', 'cars',
  'bus', 'train', 'trains', 'plane', 'planes', 'boat', 'boats',
  'window', 'windows', 'table', 'tables', 'chair', 'chairs',
  'bed', 'beds', 'room', 'rooms', 'walk', 'walks', 'walking',
  'eat', 'eats', 'eating', 'read', 'reads', 'reading',
  'write', 'writes', 'writing', 'speak', 'speaks', 'speaking',
  'listen', 'listens', 'listening', 'watch', 'watches', 'watching',
  'see', 'sees', 'seeing', 'hear', 'hears', 'hearing',
  'smell', 'smells', 'taste', 'tastes', 'touch', 'touches',
  'feel', 'feels', 'feeling', 'think', 'thinks', 'thinking',
  'understand', 'remember', 'forget', 'learn', 'teach',
  'buy', 'buys', 'buying', 'sell', 'sells', 'selling',
  'pay', 'pays', 'paying', 'cost', 'costs', 'help', 'helps',
  'ask', 'asks', 'asking', 'answer', 'answers', 'wait', 'waits',
  'stay', 'stays', 'leave', 'leaves', 'arrive', 'arrives',
  'return', 'returns', 'finish', 'begin', 'end', 'ends',
  'win', 'wins', 'winning', 'lose', 'loses', 'losing',
  'fall', 'falls', 'rise', 'rises', 'fix', 'build',
  'black', 'baby', 'babies', 'background', 'backgrounds',
  'backbone', 'backhand', 'backlight', 'backside',
  'basketball', 'audiobook', 'audiobooks', 'blackjack',
  'benchmark', 'benchmarks', 'benchmarking',
  'night', 'nights', 'morning', 'mornings', 'mother', 'mothers',
  'father', 'fathers', 'brother', 'brothers', 'sister', 'sisters',
  'friend', 'friends', 'death', 'money', 'people', 'world', 'school',
  'good', 'bad', 'small', 'big', 'great', 'long', 'short',
  'high', 'low', 'young', 'old', 'new', 'right', 'left', 'next',
  'about', 'after', 'again', 'all', 'also', 'always', 'any',
  'because', 'before', 'best', 'better', 'between', 'both',
  'call', 'calls', 'can', 'change', 'changes', 'child', 'children',
  'come', 'comes', 'could', 'day', 'days', 'did', 'does', 'down',
  'each', 'even', 'every', 'few', 'find', 'first', 'from',
  'get', 'gets', 'getting', 'give', 'gives', 'got', 'had',
  'has', 'have', 'having', 'here', 'him', 'his', 'into', 'its',
  'just', 'keep', 'keeps', 'kind', 'kinds', 'last', 'let',
  'like', 'likes', 'little', 'make', 'makes', 'making',
  'many', 'may', 'might', 'more', 'most', 'much', 'must',
  'name', 'names', 'never', 'now', 'off', 'often', 'only',
  'other', 'others', 'our', 'ours', 'out', 'over', 'own',
  'place', 'places', 'point', 'points', 'put', 'puts',
  'same', 'say', 'says', 'said', 'she', 'should', 'since',
  'some', 'something', 'still', 'such', 'take', 'takes', 'taking',
  'tell', 'tells', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'then', 'there', 'these', 'they', 'thing', 'things',
  'this', 'those', 'thought', 'thoughts', 'three', 'through',
  'too', 'under', 'until', 'up', 'upon', 'us', 'use', 'used',
  'very', 'want', 'wants', 'way', 'ways', 'well', 'went',
  'were', 'what', 'when', 'where', 'which', 'while',
  'white', 'who', 'whole', 'why', 'will', 'with', 'without',
  'word', 'words', 'would', 'year', 'years', 'you', 'your', 'yours',
  'red', 'green', 'blue', 'yellow', 'brown', 'pink', 'orange',
  'head', 'arm', 'arms', 'eye', 'eyes', 'mouth', 'leg', 'legs',
  'foot', 'feet', 'body', 'heart', 'blood', 'sun', 'moon',
  'star', 'stars', 'sky', 'sea', 'river', 'rivers', 'mountain',
  'stone', 'stones', 'fire', 'wind', 'rain', 'snow', 'ice',
  'king', 'kings', 'queen', 'queens',
  'bellend', 'bollok', 'bullshit', 'fuck', 'shit', 'asshole', 'bitch', 'dick', 'cunt',

  // Termos em espanhol que não pertencem ao português
  'perro', 'perros', 'malo', 'malos', 'nino', 'ninos', 'nina', 'ninas',
  'gracias', 'adios', 'hombre', 'hombres', 'mujer', 'mujeres',
  'noche', 'noches', 'hoy', 'ayer', 'siempre',
  'donde', 'quien', 'pero', 'arriba', 'abajo',
  'lejos', 'bienvenido', 'bienvenidos',

  // Arcanismos bizarros, OCR e corruptelas do lexico antigo
  'abachuchu', 'ababaloalo', 'aabora', 'aavora', 'abafanetico', 'abajurdio',
  'ababangai', 'ababoni', 'abacatuxia', 'abagacado', 'abago', 'abagum',
  'abalu', 'abambulante', 'aa', 'ãã', 'aal', 'aaru', 'ãatá',

  // Abreviações gramaticais, técnicas e siglas
  'adj', 'adv', 'conj', 'interj', 'pej', 'prov', 'senv', 'cosv', 'dra', 'prof',
  'etc', 'sta', 'sto', 'sr', 'sra', 'apt', 'apto', 'ltda', 'cia',
  'km', 'kg', 'cm', 'mm', 'ml', 'mg', 'kb', 'mb', 'gb', 'hz', 'khz', 'mhz', 'ghz',
  'pdf', 'html', 'css', 'php', 'sql', 'xml', 'jpg', 'png', 'gif', 'mp3', 'mp4', 'avi',
  'vlw', 'flw', 'tmj', 'fdp', 'mds', 'vc', 'pq', 'tb', 'tbm', 'hj', 'obg', 'blz',
  'agr', 'eh', 'td', 'msg', 'zap', 'https', 'http', 'www', 'vhs', 'rpm', 'bpm', 'bps',
  'csc', 'ctg', 'cpf', 'cnpj', 'rg', 'cep', 'cnh', 'ipva', 'iptu', 'inss', 'fgts'
]);

// Vocabulário de termos modernos e populares dicionarizados no Brasil
const MODERN_PT_WORDS = [
  'site', 'sites', 'blog', 'blogs', 'mouse', 'mouses',
  'software', 'softwares', 'hardware', 'hardwares',
  'email', 'emails', 'link', 'links', 'login', 'logins',
  'download', 'downloads', 'upload', 'uploads',
  'online', 'offline', 'wifi', 'pix', 'app', 'apps',
  'post', 'posts', 'postar', 'postou', 'postado', 'postada', 'postando',
  'deletar', 'deletou', 'deletado', 'deletada', 'deletando',
  'print', 'prints', 'printar', 'printou', 'printado', 'printando',
  'meme', 'memes', 'hacker', 'hackers',
  'feed', 'feeds', 'feedback', 'feedbacks', 'backup', 'backups',
  'podcast', 'podcasts', 'spoiler', 'spoilers', 'crush', 'crushes',
  'selfie', 'selfies', 'gamer', 'gamers',
  'streaming', 'streamer', 'streamers', 'setup', 'setups',
  'tuite', 'tuites', 'tuitar', 'tuitou', 'tuitando',
  'emoji', 'emojis', 'fake', 'fakes', 'live', 'lives',
  'status', 'bug', 'bugs', 'bugar', 'bugou', 'bugado', 'bugada',
  'shopping', 'shoppings', 'marketing', 'marketings',
  'design', 'designs', 'designer', 'designers',
  'bullying', 'delivery', 'deliveries', 'homeoffice',
  'pandemia', 'pandemias', 'covid', 'quarentena',
  'shampoo', 'shampoos', 'show', 'shows', 'bar', 'bares',
  'pub', 'pubs', 'rock', 'pop', 'jazz', 'rap', 'funk',
  'skate', 'skates', 'surf', 'surfar', 'surfou', 'surfando',
  'pizza', 'pizzas', 'hamburguer', 'hambúrguer', 'hamburgueres', 'hambúrgueres',
  'bacon', 'chopp', 'chope', 'chopes', 'croissant', 'croissants',
  'buffet', 'buffets', 'sushi', 'sushis', 'sashimi', 'sashimis',
  'yakisoba', 'yakisobas', 'ketchup', 'maionese',
  'lingerie', 'lingeries', 'sutiã', 'sutiãs', 'jeans',
  'short', 'shorts', 'blazer', 'blazers', 'top', 'tops'
];

// Vocabulário de comidas brasileiras típicas, culinária regional, frutas nativas e expressões regionais
const BRAZILIAN_FOODS_AND_REGIONAL = [
  // Culinária Nordestina (ingredientes, pratos e petiscos)
  'macaxeira', 'macaxeiras', 'aipim', 'aipins', 'mandioca', 'mandiocas',
  'jerimum', 'jerinuns', 'jerimums', 'quiabo', 'quiabos', 'maxixe', 'maxixes',
  'chuchu', 'chuchus', 'jiló', 'jilos', 'jilós', 'inhame', 'inhames', 'cará', 'caras',
  'cuscuz', 'cuscuzes', 'tapioca', 'tapiocas', 'beiju', 'beijus', 'goma', 'gomas',
  'polvilho', 'fécula', 'farinha de mandioca', 'farofa', 'farofas',
  'acarajé', 'acarajés', 'acaraje', 'acarajes', 'abará', 'abarás', 'abara', 'abaras',
  'vatapá', 'vatapás', 'vatapa', 'vatapas', 'caruru', 'carurus',
  'bobó de camarão', 'bobo de camarao', 'bobó', 'bobos', 'bobo',
  'moqueca', 'moquecas', 'moqueca baiana', 'moqueca de peixe',
  'baião de dois', 'baiao de dois', 'baião', 'baiao',
  'sarapatel', 'sarapateis', 'buchada de bode', 'buchada', 'buchadas',
  'panelada', 'paneladas', 'dobradinha', 'dobradinhas', 'mocotó', 'mocoto',
  'rabada', 'rabadas', 'pirão', 'pirões', 'pirao', 'piros',
  'carne de sol', 'carne de charque', 'charque', 'charques', 'jabá', 'jabas',
  'manteiga de garrafa', 'manteiga da terra', 'queijo de coalho', 'queijo coalho', 'coalho',
  'requeijão do sertão', 'requeijão de corte',
  'cartola', 'bolo de rolo', 'bolo souza leão', 'bolo sousa leao',
  'rapadura', 'rapaduras', 'melado de cana', 'melado', 'melaço',
  'canjica', 'canjicas', 'curau', 'curaus', 'pamonha', 'pamonhas',
  'mungunzá', 'mungunzas', 'mungunza', 'mugunza',
  'cocada', 'cocadas', 'cocada preta', 'cocada branca',
  'quebra-queixo', 'quebra queixo', 'alfenim', 'alfenins',
  'cajuína', 'cajuina', 'umbuzada', 'umbuzadas',

  // Culinária Nortista e Amazônica
  'tacacá', 'tacacas', 'tacaca', 'maniçoba', 'manicoba',
  'tucupi', 'jambu', 'jambus', 'pato no tucupi',
  'pirarucu', 'pirarucus', 'pirarucu de casaca',
  'tambaqui', 'tambaquis', 'costela de tambaqui',
  'surubim', 'surubins', 'filhote', 'filhotes', 'tucunaré', 'tucunares',
  'dourada', 'douradas', 'pescada amarela',
  'farinha d agua', 'farinha de uarini', 'farinha do acre',
  'beiju de tapioca', 'chibé', 'chibe', 'mujica',
  'açaí', 'acai', 'acais', 'cupuaçu', 'cupuacu', 'cupuacus',
  'bacuri', 'bacuris', 'buriti', 'buritis', 'pupunha', 'pupunhas',
  'camu-camu', 'camucamu', 'biribá', 'biriba', 'murici', 'muricis',
  'taperebá', 'tapereba', 'castanha do pará', 'castanha do brasil',
  'castanha de caju', 'guaraná', 'guarana',

  // Culinária Centro-Oeste
  'pequi', 'pequis', 'arroz com pequi', 'galinhada', 'galinhadas',
  'empadão goiano', 'empadao goiano', 'guariroba', 'gueroba',
  'chica doida', 'mojica de pintado', 'pintado', 'pintados',
  'pacu', 'pacus', 'pacu assado', 'piraputanga', 'caldo de piranha',
  'traíra', 'traira', 'trairas', 'chipa', 'chipas', 'sopa paraguaia',
  'pastelão', 'pastelao',

  // Culinária Mineira, Paulista, Carioca e Capixaba (Sudeste)
  'pão de queijo', 'pao de queijo', 'feijão tropeiro', 'feijao tropeiro',
  'tutu de feijão', 'tutu', 'tutus', 'virado à paulista', 'virado a paulista', 'virado',
  'frango com quiabo', 'frango ao molho pardo', 'leitão à pururuca', 'pururuca', 'pururucas',
  'torresmo', 'torresmos', 'torresminho', 'torresminhos',
  'costelinha de porco', 'costelinha', 'costelinhas',
  'angu', 'angus', 'couve refogada', 'couve',
  'queijo minas', 'queijo canastra', 'queijo do serro', 'queijo prato',
  'doce de leite', 'goiabada', 'goiabadas', 'romeu e julieta',
  'broa de milho', 'broa de fubá', 'broa', 'broas', 'fubá', 'fuba',
  'coxinha', 'coxinhas', 'coxinha de frango', 'coxinha com catupiry',
  'pastel de feira', 'pastel', 'pasteis', 'pastéis',
  'esfirra', 'esfirras', 'esfiha', 'esfihas',
  'quibe', 'quibes', 'kibe', 'kibes',
  'empada', 'empadas', 'empadão', 'empadao', 'empadões',
  'rissole', 'rissoles', 'croquete', 'croquetes',
  'bolinho de bacalhau', 'bolinho de chuva', 'bolinho de arroz',
  'bauru', 'sanduíche de mortadela', 'pizza paulistana',
  'picadinho carioca', 'picadinho', 'filé com fritas', 'caldo verde',
  'biscoito globo', 'biscoito de polvilho', 'sequilho', 'sequilhos',
  'moqueca capixaba', 'torta capixaba', 'caranguejada', 'peroá frito',

  // Culinária Sulista
  'churrasco', 'churrascos', 'churrascaria', 'costela no bafo',
  'picanha', 'picanhas', 'alcatra', 'alcatras', 'maminha', 'maminhas',
  'cupim', 'cupins', 'fraldinha', 'fraldinhas', 'vazio', 'matambre',
  'entrevero', 'barreado', 'marreco recheado', 'eisbein',
  'cuca de banana', 'cuca alemã', 'cuca', 'cucas',
  'chimia', 'chimias', 'galeto al primo canto', 'galeto', 'galetos',
  'sopa de capeletti', 'capeletti', 'capeleti',
  'polenta frita', 'polenta', 'polentas',
  'pinhão', 'pinhao', 'pinhões', 'pinhoes',
  'arroz carreteiro', 'arroz de carreteiro', 'carreteiro',
  'tainha assada', 'tainha', 'tainhas',
  'sagu com creme', 'sagu de vinho', 'sagu', 'sagus',

  // Carnes, Cortes e Embutidos Típicos
  'calabresa', 'calabresas', 'linguiça', 'linguica', 'linguiças', 'linguicas',
  'paio', 'paios', 'lombo', 'lombos', 'pernil', 'pernis',
  'panceta', 'pancetas', 'bacon', 'presunto', 'presuntos',
  'mortadela', 'mortadelas', 'salame', 'salames', 'copa',
  'coração de frango', 'coracao de frango', 'asa de frango', 'tulipa',
  'espetinho', 'espetinhos',

  // Queijos e Laticínios do Brasil
  'catupiry', 'requeijão', 'requeijao', 'requeijões', 'requeijoes',
  'mussarela', 'muçarela', 'mozzarella', 'provolone', 'gorgonzola',
  'ricota', 'parmesão', 'parmesao', 'parmezão', 'coalhada',

  // Doces e Sobremesas Clássicas Brasileiras
  'brigadeiro', 'brigadeiros', 'beijinho', 'beijinhos',
  'cajuzinho', 'cajuzinhos', 'bicho de pé', 'olho de sogra',
  'quindim', 'quindins', 'quindão', 'quindao',
  'pé de moleque', 'pe de moleque', 'pé de moça', 'pe de moca',
  'paçoca de amendoim', 'paçoca', 'pacoca', 'paçocas', 'pacocas',
  'doce de abóbora', 'doce de batata doce', 'marmelada', 'bananada',
  'maria mole', 'maria-mole', 'suspiro', 'suspiros',
  'churros', 'sonho de padaria', 'sonho', 'sonhos',
  'pudim de leite', 'pudim', 'pudins', 'manjar branco', 'manjar',
  'arroz doce', 'canjiquinha',

  // Frutas Brasileiras Nativas e Tradicionais
  'jabuticaba', 'jabuticabas', 'pitanga', 'pitangas',
  'acerola', 'acerolas', 'caju', 'cajus', 'cajá', 'caja', 'cajás', 'cajas',
  'cajarana', 'graviola', 'graviolas', 'mangaba', 'mangabas',
  'umbu', 'umbus', 'imbú', 'imbu',
  'seriguela', 'seriguelas', 'ciriguela', 'ciriguelas', 'siriguela', 'siriguelas',
  'jenipapo', 'jenipapos', 'pitomba', 'pitombas',
  'sapoti', 'sapotis', 'tamarindo', 'tamarindos', 'atemoia', 'atemoias',
  'maracujá', 'maracuja', 'maracujás', 'maracujas',
  'jaca', 'jacas', 'goiaba', 'goiabas', 'goiabada cascão',
  'carambola', 'carambolas', 'abacaxi', 'abacaxis',
  'manga espada', 'manga rosa', 'manga tommy',
  'banana da terra', 'banana prata', 'banana nanica', 'banana maçã',
  'mamão papaia', 'mamão formosa', 'mamão', 'mamao',
  'melancia', 'melancias', 'melão', 'melao',
  'bergamota', 'bergamotas', 'mexerica', 'mexericas', 'poncã', 'ponca', 'tangerina', 'tangerinas',
  'araçá', 'araca', 'uvaia', 'uvaias', 'cambuci', 'grumixama',

  // Bebidas Populares e Tradicionais
  'caipirinha', 'caipirinhas', 'caipiroska', 'caipivodka',
  'cachaça', 'cachaca', 'cachaças', 'cachacas', 'pinga', 'pingas', 'aguardente',
  'caldo de cana', 'garapa', 'garapas',
  'catuaba', 'catuabas', 'jurubeba', 'jurubebas',
  'chimarrão', 'chimarrao', 'tereré', 'terere', 'tererê', 'mate gelado', 'erva-mate',
  'quentão', 'quentao', 'choconhaque', 'batida de coco', 'batida de maracujá',

  // Regionalismos, Gírias e Expressões Populares
  'oxe', 'oxente', 'vixe', 'visse', 'eita', 'eitcha', 'eita nóis',
  'arretado', 'arretada', 'arretados', 'arretadas',
  'avexado', 'avexada', 'avexados', 'avexadas',
  'aperreado', 'aperreada', 'aperreados', 'aperreadas', 'aperreio',
  'mofino', 'mofina', 'troncho', 'troncha', 'abestalhado', 'abestalhados',
  'bichinho', 'bichinha', 'cabra da peste', 'cabra', 'cabras',
  'fulô', 'xodó', 'xodos', 'dengo', 'dengos', 'dengoso', 'dengosa',
  'chamego', 'chamegos', 'borogodó', 'borogodo', 'munganga', 'mungangas',
  'arriado', 'arriada', 'estribado', 'baita',
  'égua', 'egua', 'paidégua', 'pai d égua', 'maninho', 'maninha',
  'teba', 'curumim', 'curumins', 'caboclo', 'cabocla', 'caboclos', 'caboclas',
  'igarapé', 'igarape', 'igarapés', 'igarapeis',
  'uai', 'sô', 'so', 'trem bão', 'trem', 'bão', 'bao',
  'truta', 'parça', 'parca', 'rolê', 'role', 'zica', 'caraca', 'mermão', 'mermao',
  'tchê', 'tche', 'bah', 'guri', 'guria', 'guris', 'gurias', 'piá', 'pias', 'pia',
  'cacetinho', 'gaudério', 'gauderio', 'bagual', 'baguais', 'vivente', 'viventes',

  // Manifestações Culturais, Folclore e Brasilidades
  'forró', 'forro', 'frevo', 'frevos', 'maracatu', 'maracatus',
  'baião', 'baiao', 'xote', 'xotes', 'xaxado', 'xaxados',
  'samba', 'sambas', 'pagode', 'pagodes', 'axé', 'axe', 'bossa nova',
  'choro', 'chorinho', 'chorões', 'choroes', 'tropicália', 'tropicalia',
  'bumba meu boi', 'boi bumbá', 'boi bumba', 'ciranda', 'cirandas',
  'capoeira', 'capoeiras', 'berimbau', 'berimbaus', 'atabaque', 'atabaques',
  'pandeiro', 'pandeiros', 'agogô', 'agogo', 'cuíca', 'cuica', 'cavaquinho', 'cavaquinhos',
  'cordel', 'cordéis', 'cordeis', 'repente', 'repentes', 'repentista', 'repentistas',
  'cangaço', 'cangaco', 'cangaceiro', 'cangaceiros', 'lampião', 'lampiao',
  'sertão', 'sertao', 'sertões', 'sertoes', 'caatinga', 'cerrado', 'agreste', 'pampa', 'pantanal',
  'candango', 'candangos', 'capixaba', 'capixabas', 'carioca', 'cariocas',
  'paulista', 'paulistas', 'paulistano', 'paulistanos',
  'mineiro', 'mineiros', 'gaúcho', 'gaucho', 'gaúchos', 'gauchos',
  'potiguar', 'potiguares', 'paraibano', 'paraibanos', 'pernambucano', 'pernambucanos',
  'cearense', 'cearenses', 'maranhense', 'maranhenses', 'piauiense', 'piauienses',
  'sergipano', 'sergipanos', 'alagoano', 'alagoanos', 'baiano', 'baianos',
  'goiano', 'goianos', 'matogrossense', 'paraense', 'paraenses', 'amazonense', 'amazonenses',
  'nordestino', 'nordestinos', 'nordestina', 'nordestinas',
  'nortista', 'nortistas', 'sulista', 'sulistas', 'sudestino', 'sudestinos'
];

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

    // Descarta linhas com espaços, hífens ou caracteres especiais
    if (/[\s\-_./0-9#@!$%^&*()+=[\]{}|;:",<>?\\]/.test(cleanRaw)) return;

    // Normalização sem acentos, apenas [a-z]
    const normalized = normalizeWord(cleanRaw);
    if (normalized.length < 2 || normalized.length > 28) return;

    // EXIGÊNCIA DE VOGAL: toda palavra genuína do português deve conter [aeiou]
    if (!/[aeiou]/.test(normalized)) return;

    // Ignora 3 letras repetidas (ex: 'aaaa', 'kkk', 'zzz')
    if (/(.)\1\1/.test(normalized)) return;

    // Se tiver 2 letras, aceita apenas palavras válidas da língua
    if (normalized.length === 2 && !VALID_2_LETTER_WORDS.has(normalized)) return;

    // Rejeita termos da blacklist (inglês, espanhol, corruptelas e siglas)
    if (STOPWORDS.has(normalized)) return;

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

  const addProperName = (raw) => {
    if (!raw) return;
    const cleanRaw = raw.trim();
    if (cleanRaw.length < 2) return;

    // Descarta linhas com números ou caracteres inválidos
    if (/[0-9#@!$%^&*()+=[\]{}|;:",.<>?/\\]/.test(cleanRaw)) return;

    // Normalização sem acentos, apenas [a-z]
    const normalized = normalizeWord(cleanRaw);
    if (normalized.length < 2 || normalized.length > 35) return;

    // Exigência de vogal
    if (!/[aeiou]/.test(normalized)) return;

    // Ignora 3 letras repetidas consecutivas
    if (/(.)\1\1/.test(normalized)) return;

    // Rejeita termos da blacklist
    if (STOPWORDS.has(normalized)) return;

    // Armazena a forma completa
    const displayLower = cleanRaw.toLowerCase();
    if (!wordsMap.has(normalized)) {
      wordsMap.set(normalized, displayLower);
    } else {
      const current = wordsMap.get(normalized);
      if (current === normalized && displayLower !== normalized) {
        wordsMap.set(normalized, displayLower);
      }
    }

    // Se for nome composto por múltiplas palavras, indexa também partes individuais significativas
    const parts = cleanRaw.split(/[\s\-]+/);
    if (parts.length > 1) {
      for (const part of parts) {
        const pNorm = normalizeWord(part);
        // Ignora preposições curtas (de, do, da, e, dos, das)
        if (pNorm.length < 3 || ['dos', 'das'].includes(pNorm)) continue;
        if (!/[aeiou]/.test(pNorm)) continue;
        if (STOPWORDS.has(pNorm)) continue;

        const partLower = part.toLowerCase();
        if (!wordsMap.has(pNorm)) {
          wordsMap.set(pNorm, partLower);
        } else {
          const cur = wordsMap.get(pNorm);
          if (cur === pNorm && partLower !== pNorm) {
            wordsMap.set(pNorm, partLower);
          }
        }
      }
    }
  };

  // 3. Lê base oficial IME-USP (261k palavras autênticas com acentuação e flexões completas)
  const uspPath = path.join(PT_BR_DIR, 'usp');
  if (fs.existsSync(uspPath)) {
    console.log('2. Lendo base oficial IME-USP...');
    await processFileLines(uspPath, (line) => {
      addWord(line);
    });
    console.log(`   Total acumulado: ${wordsMap.size} palavras`);
  }

  // 3. Lê Léxico PT-BR (145k palavras autênticas da língua portuguesa e vocabulário brasileiro)
  const lexicoPath = path.join(PT_BR_DIR, 'lexico');
  if (fs.existsSync(lexicoPath)) {
    console.log('3. Lendo léxico amplo PT-BR...');
    await processFileLines(lexicoPath, (line) => {
      addWord(line);
    });
    console.log(`   Total acumulado: ${wordsMap.size} palavras`);
  }

  // 4. Lê Conjugações Verbais do corpus PT-BR (183k formas legítimas)
  console.log('4. Lendo conjugações verbais completas...');
  await processFileLines(path.join(PT_BR_DIR, 'conjugações'), (line) => {
    addWord(line);
  });
  console.log(`   Total acumulado: ${wordsMap.size} palavras`);

  // 5. Adiciona vocabulário regional brasileiro e nomes de comida típica
  console.log('5. Integrando culinária brasileira e vocabulário regional...');
  for (const item of BRAZILIAN_FOODS_AND_REGIONAL) {
    addProperName(item);
    addWord(item);
  }
  console.log(`   Total acumulado: ${wordsMap.size} palavras`);

  // 6. Adiciona termos modernos de tecnologia e cultura dicionarizados
  console.log('6. Integrando termos modernos da língua portuguesa...');
  for (const w of MODERN_PT_WORDS) {
    addWord(w);
  }
  console.log(`   Total acumulado: ${wordsMap.size} palavras`);

  // 7. Lê verbos infinitivos
  const verbosPath = path.join(PT_BR_DIR, 'listas', 'verbos');
  if (fs.existsSync(verbosPath)) {
    console.log('7. Lendo lista de verbos infinitivos...');
    await processFileLines(verbosPath, (line) => {
      addWord(line);
    });
    console.log(`   Total acumulado: ${wordsMap.size} palavras`);
  }

  // 8. Lê lista de países
  const paisesPath = path.join(PT_BR_DIR, 'listas', 'paises');
  if (fs.existsSync(paisesPath)) {
    console.log('8. Lendo lista de países...');
    await processFileLines(paisesPath, (line) => {
      addProperName(line);
    });
    console.log(`   Total acumulado: ${wordsMap.size} palavras`);
  }

  // 9. Lê estados do Brasil
  const estadosPath = path.join(PT_BR_DIR, 'listas', 'estados-br');
  if (fs.existsSync(estadosPath)) {
    console.log('9. Lendo estados do Brasil...');
    await processFileLines(estadosPath, (line) => {
      addProperName(line);
    });
    console.log(`   Total acumulado: ${wordsMap.size} palavras`);
  }

  // 10. Lê capitais dos estados brasileiros
  const capitaisPath = path.join(PT_BR_DIR, 'listas', 'capitais-br');
  if (fs.existsSync(capitaisPath)) {
    console.log('10. Lendo capitais dos estados brasileiros...');
    await processFileLines(capitaisPath, (line) => {
      addProperName(line);
    });
    console.log(`   Total acumulado: ${wordsMap.size} palavras`);
  }

  // 11. Lê continentes
  const continentesPath = path.join(PT_BR_DIR, 'listas', 'continentes');
  if (fs.existsSync(continentesPath)) {
    console.log('11. Lendo continentes...');
    await processFileLines(continentesPath, (line) => {
      addProperName(line);
    });
    console.log(`   Total acumulado: ${wordsMap.size} palavras`);
  }

  console.log(`\nProcessamento léxico concluído! Total de palavras únicas limpas: ${wordsMap.size}`);

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

module.exports = { buildDictionary, evaluateWordDifficulty, STOPWORDS, VALID_2_LETTER_WORDS };
