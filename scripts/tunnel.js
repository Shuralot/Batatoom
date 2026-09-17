/**
 * Script de Túnel Público Batatoom! (Sem restrições do PowerShell)
 * Executado diretamente com: node scripts/tunnel.js
 */

const qrcode = require('qrcode-terminal');

const PORT = process.env.PORT || 3000;

async function startTunnel() {
  console.log('\n======================================================');
  console.log('   🌐 CONECTANDO TÚNEL SEGURO CLOUDFLARE...          ');
  console.log('======================================================\n');

  try {
    const { startTunnel: untunStart } = await import('untun');
    const tunnel = await untunStart({ port: PORT });
    const url = await tunnel.getURL();

    console.log('✅ Túnel Cloudflare conectado com sucesso! (Sem 502)');
    console.log('------------------------------------------------------');
    console.log(`🔗 Link para enviar aos seus amigos:`);
    console.log(`👉 ${url}`);
    console.log('------------------------------------------------------');
    console.log('📱 Ou aponte a câmera do celular para este QR Code:\n');

    qrcode.generate(url, { small: true }, (qr) => {
      console.log(qr);
      console.log('------------------------------------------------------');
      console.log('Mantenha este terminal aberto enquanto estiver jogando.');
      console.log('Pressione CTRL+C para encerrar o túnel.');
      console.log('======================================================\n');
    });

    tunnel.on('close', () => {
      console.log('Túnel público encerrado.');
    });

    tunnel.on('error', (err) => {
      console.error('Erro no túnel:', err.message);
    });

  } catch (err) {
    console.error('Falha ao abrir o túnel:', err.message);
    console.log('\nDica: Certifique-se de que o jogo já está rodando em outro terminal (node server.js).');
  }
}

startTunnel();
