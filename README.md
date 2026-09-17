# 🥔💣 Batatoom! — Batata Quente de Palavras

<p align="center">
  <img src="public/favicon.ico" alt="Batatoom Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>O party game multiplayer em tempo real de vocabulário mais eletrizante do Brasil!</strong><br>
  Inspirado no clássico <em>Bomb Party</em>, reinventado com uma batata quente expressiva e um dicionário autêntico de <strong>mais de 400.000 palavras em Português do Brasil</strong>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Socket.IO-Real--Time-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/Express-Fast-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Dicionário-403k+_PT--BR-009c3b?style=for-the-badge" alt="Dicionário PT-BR" />
  <img src="https://img.shields.io/badge/Túnel-Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Tunnel" />
  <img src="https://img.shields.io/badge/Licença-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

---

## 🎯 O que é o Batatoom?

O **Batatoom!** é uma experiência rápida, divertida e sem complicação para jogar direto no navegador — seja no computador, no celular ou projetado na TV da sala.

A dinâmica é viciante: a batata quente cai na sua mão com uma combinação de letras (ex: **"TR"**). Você tem poucos segundos para digitar uma palavra válida que contenha essa sílaba (ex: *"e**str**ada"*, *"en**tr**ar"*, *"ve**tr**ô"*). Se acertar a tempo, a batata é passada adiante com alívio e bônus; se o tempo acabar... **BOOM!** Você perde uma vida!

---

## ✨ Principais Recursos e Diferenciais

### 📚 Dicionário PT-BR Rico e Autêntico (403.000+ Palavras)
Chega da frustração de jogar games de palavras com vocabulário truncado ou restrito a dicionários de Portugal:
- **Flexões completas**: verbos conjugados em todos os tempos morfológicos (*"cantávamos"*, *"fizeram"*, *"correríamos"*).
- **Plurais e variações**: diminutivos, aumentativos e formas femininas aceitas naturalmente.
- **Tolerância total a acentos**: digite com ou sem acento (*"maca"* ou *"maçã"*, *"coracao"* ou *"coração"*). O motor faz normalização inteligente e verificação instantânea em memória $O(1)$.
- **Sugestões pós-explosão**: quando a batata estoura, a tela exibe exemplos de palavras que serviam para aquela combinação, acabando com as dúvidas na roda!

---

### 🥔 Batata Quente Expressiva e Áudio Procedural
- **Física e expressões dinâmicas**: à medida que os segundos passam, a batata começa a chiar com vapor quente, a manteiga derrete, gotas de suor escorrem e o rostinho entra em pânico em 4 estágios de tensão (*Calmo*, *Atenção*, *Alerta* e *Pânico*).
- **Digitação ao vivo (Live Typing)**: todos na sala acompanham as letras sendo digitadas em tempo real pelo jogador da vez.
- **Áudio 100% Procedural**: efeitos sintetizados na hora via **Web Audio API** — sem arquivos `.mp3` para baixar, com tique-taque dinâmico e explosão realista com sub-bass.

---

### 🎮 Modos de Jogo

| Modo | Descrição |
| :--- | :--- |
| 👥 **Multiplayer em Grupo** | Crie ou entre em salas privadas. O Host define o ritmo, número de vidas, ordem da batata e estilo de cronômetro. |
| ⚔️ **Mata-Mata (Duelo Final)** | Ao restarem os **2 últimos sobreviventes** na arena, ativa-se o duelo final com ritmo acelerado e dificuldade dinâmica! |
| 🕹️ **Modo Solo (Desafio de Pontos)** | Jogue individualmente testando seus reflexos! Acerte sequências para somar combos, subir de nível, faturar bônus de tempo e bater recordes. |
| 📺 **Modo TV / Telão** | Ative o botão 📺 para transformar o computador em um painel gigante de sala enquanto todos jogam confortavelmente pelo celular. |

---

### ⚙️ Painel de Configurações da Sala (Host)

Quem cria a sala tem controle total sobre as regras da partida:
- **Dificuldade dos Prompts**:
  - `Dinâmica`: começa amigável e esquenta progressivamente com as rodadas.
  - `Fácil`: termos cotidianos e centenas de opções possíveis.
  - `Médio`: ótimo equilíbrio entre rapidez e repertório.
  - `Difícil`: desafiador para quem domina o vocabulário, com piso mínimo calibrado de respostas conhecidas.
- **Ordem da Batata**:
  - `Aleatória (Surpresa!)`: a batata pula imprevisivelmente de um jogador para outro.
  - `Em Círculo (Sequencial)`: turnos organizados em fila circular.
- **Temporizador da Batata**:
  - `Aleatório (Invisível)`: tempo secreto sorteado pelo servidor (12s a 22s), onde só a tensão da batata dá pistas do perigo.
  - `Normal (Fixo)`: contagem constante e previsível a cada rodada.

---

## 🚀 Como Executar

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado (versão 18 ou superior).

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/Shuralot/Batatoom.git
cd Batatoom
npm install
```

### 2. Jogar com Amigos pela Internet (Recomendado) 🌐
Inicia o jogo com hot-reload e abre um **túnel Cloudflare ultraestável** automaticamente, sem precisar abrir portas no roteador:

```bash
npm run dev
```

Ao iniciar, o terminal exibirá:
1. 💻 **Acesso Local (PC):** `http://localhost:3000`
2. 📱 **Acesso Celular (Wi-Fi):** `http://192.168.x.x:3000`
3. 🌐 **Link Público Cloudflare:** `https://xxxx-xxxx.trycloudflare.com` *(para qualquer amigo jogar de onde estiver!)*
4. 📲 **QR Code no Terminal:** aponte a câmera do celular para abrir o link na hora!

---

### 3. Jogar Apenas na Rede Local (Wi-Fi Doméstico) 🏠
Se preferir rodar apenas para os aparelhos conectados no mesmo Wi-Fi sem túnel de internet:

```bash
npm start
```

*(Opcional)* Se já iniciou com `npm start` e depois quiser gerar um link público Cloudflare avulso:
```bash
npm run tunnel
```

---

## 🧪 Testes Automatizados

O projeto conta com uma bateria de 13 testes cobrindo normalização, integridade das mais de 403 mil palavras, balanceamento de prompts, regras de sala e o Modo Solo:

```bash
npm test
```

---

## 📁 Estrutura do Projeto

```
Batatoom/
├── data/
│   └── dictionary.json        # Vocabulário compilado em JSON para carga rápida em memória
├── pt-br-master/              # Corpus linguístico autêntico PT-BR
│   ├── lexico                 # 145k+ palavras de referência
│   ├── conjugações            # 195k+ formas verbais flexionadas
│   ├── icf                    # 419k+ termos com índices de frequência
│   └── listas/                # Países, estados, gentílicos e termos regionais
├── public/                    # Frontend SPA servido pelo Node.js
│   ├── css/style.css          # Visual arcade moderno, responsivo e animações da batata
│   ├── js/app.js              # Cliente Socket.IO, controles de tela e feedback tátil (haptics)
│   ├── js/audio.js            # Sintetizador de efeitos sonoros procedural com Web Audio API
│   └── index.html             # Interface SPA completa (Lobby, Sala de Espera, Arena e TV)
├── scripts/
│   ├── build-dictionary.js    # Compilador e classificador do vocabulário por níveis
│   └── tunnel.js              # Script de túnel público Cloudflare autônomo
├── src/
│   ├── dictionary.js          # Gerenciador e validador do vocabulário em memória O(1)
│   ├── gameRoom.js            # Máquina de estados da partida, vidas, combos e Mata-Mata
│   ├── promptGenerator.js     # Indexador de sílabas e balanceador de dificuldade
│   ├── roomManager.js         # Gerenciamento de conexões, salas multiplayer e modo solo
│   └── utils.js               # Normalização semântica e gerador de códigos de sala
├── test/
│   └── test-game.js           # Bateria de testes automatizados
├── server.js                  # Servidor central Express + Socket.IO + QR Code
└── package.json               # Dependências e scripts de execução
```

---

## 💡 Dicas para uma Jogatina Perfeita

1. **Jogue na TV da Sala**: Abra o jogo no navegador da TV ou conecte seu notebook via HDMI e clique no botão **Modo TV (📺)** no cabeçalho.
2. **Entre pelo Celular**: Mostre o QR Code na tela da TV para seus amigos entrarem instantaneamente com os celulares na mão.
3. **Pense Rápido**: Não perca tempo procurando palavras mirabolantes — a primeira palavra simples do dia a dia que contiver as letras garante a batata fora da sua mão!

---

## 📜 Licença

Distribuído sob a licença **MIT**. Divirta-se jogando com seus amigos! 🥔🔥
