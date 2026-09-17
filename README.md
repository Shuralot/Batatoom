# 🥔💣 Batatoom! - Batata Quente de Palavras (PT-BR)

Um party game multiplayer em tempo real inspirado no clássico *Bomb Party* (JKLM), projetado e lapidado especificamente para o **Português do Brasil (PT-BR)** de altíssima qualidade.

A aplicação é **100% autônoma e centralizada**: um único servidor Node.js com Express e Socket.IO gerencia o jogo, o dicionário em memória e serve a interface web tanto para computadores quanto para celulares.

---

## ✨ Destaques e Recursos

### 1. Dicionário PT-BR Rico e Autêntico (400.000+ Palavras)
- **Resolvendo o problema crônico do JKLM**: o jogo reconhece o vocabulário real falado no Brasil, incluindo:
  - Todas as formas flexionadas de verbos (ex: *"cantávamos"*, *"fizeram"*, *"correríamos"*).
  - Plurais, diminutivos, aumentativos e formas femininas (ex: *"maçãs"*, *"cães"*, *"portinhas"*).
  - Nomes geográficos e léxico da língua portuguesa.
- **Normalização Inteligente e Tolerância a Acentos**:
  - Aceita digitação tanto **com acento** quanto **sem acento** (*"maca"* ou *"maçã"*, *"coracao"* ou *"coração"*, *"cafe"* ou *"café"*).
  - Checagem flexível de substrings: se o prompt for **"CA"**, palavras como *"maçã"*, *"cão"* e *"café"* são aceitas; se for **"AO"**, *"coração"* é aceito.
- **Controle de Repetição**: impede que a mesma palavra seja reutilizada na mesma rodada.

### 2. A Bomba agora é uma BATATA QUENTE 🥔🔥
- Visual personalizado de **Batata Quente**, com vapor quente saindo, manteiga derretendo e rostinho expressivo que vai suando e entrando em pânico conforme a temperatura sobe!
- **Jogadores Espalhados com Seta Indicadora**: avatares dispostos em cards amplos e confortáveis, com uma seta animada brilhante apontando diretamente para quem está com a batata!

### 3. Painel de Configurações da Sala (Definido pelo Host)
Quem cria a sala tem controle total sobre as regras antes de iniciar:
- **Dificuldade**:
  - **Dinâmica**: começa amigável e esquenta conforme os turnos avançam.
  - **Fácil**: prompts amplos e com centenas de opções.
  - **Médio**: equilíbrio entre agilidade e raciocínio.
  - **Difícil**: desafiador, **mas sem combinações impossíveis** (piso mínimo calibrado de 60 a 180 palavras reais conhecidas).
- **Vez da Batata**:
  - **Aleatória (Surpresa!)**: a batata pula imprevisivelmente de um jogador para outro, elevando a adrenalina.
  - **Em Círculo (Sequencial)**: turnos organizados em fila circular.
- **Tipo de Tempo da Batata**:
  - **Aleatório (Invisível)**: tempo secreto sorteado pelo servidor (entre 12 e 22s), onde só a tensão avisa quando vai explodir.
  - **Normal (Fixo 15s)**: tempo padrão constante a cada rodada.

### 4. Interface Arcade Responsiva (Celular + Telão / TV)
- **Modo Celular (Mobile-First)**:
  - Foco automático de teclado quando chega a sua vez de digitar.
  - Feedback tátil com vibração (`navigator.vibrate`) em acertos, erros e explosões.
  - Indicador claro de erro com animação de tremor e motivo (*"Não contém as letras"*, *"Já usada nesta rodada"*, *"Não existe no dicionário"*).
- **Modo Host / Telão (TV da Sala)**:
  - Botão de alternância para **Modo TV (📺)** com elementos aumentados, bomba gigante animada e visual cinema para projetar na sala enquanto amigos jogam pelo celular.
- **QR Code no Browser e no Terminal**:
  - A sala gera um QR Code na tela e no terminal para amigos apontarem a câmera do celular e entrarem instantaneamente.

### 5. Áudio 100% Procedural (Web Audio API)
- **Zero arquivos de áudio externos**: sem requisições `.mp3` ou problemas de carregamento 404.
- Tique-taque com pitch e frequência dinâmicos.
- Efeito de explosão realista (ruído branco + filtro passa-baixas + sub-bass).
- Chimes alegres de acerto e buzina grave de erro.

---

## 🚀 Como Executar

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado (versão 18 ou superior).

### Iniciar com Túnel Público Automático (Recomendado para Jogar com Amigos)
Executa o jogo e abre o túnel de internet seguro simultaneamente:

```bash
npm run dev
```

Ao iniciar, o terminal exibirá:
1. 💻 **Acesso Local (PC):** `http://localhost:3000`
2. 📱 **Acesso Celular (Wi-Fi):** `http://192.168.x.x:3000`
3. 🌐 **Link Público da Internet:** `https://xxxx-xxxx.loca.lt` (para amigos em qualquer lugar do mundo!)
4. 📲 **QR Code no Terminal** gerado diretamente para o link público!

---

### Iniciar Apenas Localmente (Rede Wi-Fi Doméstica)
Se quiser jogar apenas com quem está no mesmo Wi-Fi sem túnel de internet:

```bash
npm start
```

---

## 🌐 Como Jogar pela Internet com Amigos (Sem Abrir Portas no Roteador)

Para jogar com amigos que não estão na sua casa (fora da sua rede Wi-Fi), você pode gerar um link público seguro em segundos:

### Opção 1: Usando Localtunnel (Recomendado no Windows - Zero Configuração)
Com o servidor do Batatoom rodando em um terminal, abra outro terminal e execute:

```bash
npm run tunnel
```
ou:
```bash
npx localtunnel --port 3000
```
*(Ele gerará na hora uma URL pública HTTPS como `https://sua-sala.loca.lt` para você enviar aos seus amigos!)*

### Opção 2: Usando Cloudflare (`cloudflared`)
Se tiver o binário oficial do Cloudflare instalado:
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 🧪 Testes Automatizados

Para executar a suíte de testes de vocabulário, normalização de caracteres e lógica de turnos:

```bash
npm test
```

---

## 📁 Estrutura do Projeto

```
Kbum/
├── package.json               # Dependências e scripts de execução
├── server.js                  # Servidor Express + Socket.IO + IP local & QR Code
├── pt-br-master/              # Corpus linguístico autêntico PT-BR
│   ├── lexico                 # 145.744 palavras de referência
│   ├── conjugações            # 195.751 formas verbais flexionadas
│   ├── icf                    # 419.486 termos com frequência
│   └── listas/                # Países, estados, municípios, verbos
├── src/
│   ├── dictionary.js          # Gerenciador e validador do vocabulário em memória O(1)
│   ├── promptGenerator.js     # Indexador de sílabas e balanceador de dificuldade
│   ├── gameRoom.js            # Máquina de estados do jogo, vidas e tempo invisível
│   ├── roomManager.js         # Gerenciamento de salas e desconexões
│   └── utils.js               # Normalização sem acentos e gerador de códigos
├── scripts/
│   └── build-dictionary.js    # Compilador e otimizador do vocabulário
├── test/
│   └── test-game.js           # Bateria de testes automatizados
└── public/                    # Frontend servido pelo servidor
    ├── index.html             # Interface SPA completa (Lobby, Sala, Arena, TV)
    ├── css/
    │   └── style.css          # Tema arcade moderno, responsivo e animações
    └── js/
        ├── audio.js           # Sintetizador procedural com Web Audio API
        └── app.js             # Cliente Socket.IO, haptics e interatividade
```

---

## 📜 Licença
MIT. Divirta-se jogando com seus amigos! 💣🔥
