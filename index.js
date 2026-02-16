const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

// Express server
const app = express();
const PORT = process.env.PORT || 3000;

let isConnected = false;
let qrCodeText = 'Waiting for connection...';

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Casper2 WhatsApp Bot</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: Arial; padding: 20px; background: #f5f5f5; }
          .container { background: white; padding: 20px; border-radius: 10px; max-width: 800px; margin: 0 auto; }
          .status { font-size: 24px; margin: 20px 0; }
          .qr { background: #000; color: #fff; padding: 20px; font-family: monospace; overflow: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 Casper2 WhatsApp Bot</h1>
          <div class="status">
            Status: ${isConnected ? '✅ Connected' : '⏳ Waiting for QR scan'}
          </div>
          <p>Uptime: ${Math.floor(process.uptime())} seconds</p>
          <h2>📱 Scan QR Code:</h2>
          <div class="qr">${qrCodeText}</div>
          <p><small>Open WhatsApp → Settings → Linked Devices → Scan QR Code</small></p>
          <p><small>Page auto-refreshes every 5 seconds</small></p>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// WhatsApp Connection
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n📱 QR CODE GENERATED!\n');
      qrcode.generate(qr, { small: true });
      qrCodeText = qr;
      console.log('\n✅ QR saved! Visit your Render URL to scan it\n');
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      isConnected = false;
      
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 3000);
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp Connected!');
      isConnected = true;
      qrCodeText = '✅ Connected Successfully!';
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    
    const from = msg.key.remoteJid;
    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase();
    
    console.log(`📩 ${from}: ${text}`);

    try {
      if (text === '!ping') {
        await sock.sendMessage(from, { text: '🏓 Pong! Casper2 online!' });
      } else if (text === '!help') {
        await sock.sendMessage(from, { 
          text: '*Casper2 Commands:*\n\n!ping - Check status\n!help - This message\n!info - Bot info\n!time - Server time' 
        });
      } else if (text === '!info') {
        await sock.sendMessage(from, { 
          text: `*Casper2* ✅\nUptime: ${Math.floor(process.uptime())}s\nVersion: 1.0` 
        });
      } else if (text === '!time') {
        await sock.sendMessage(from, { 
          text: `🕐 ${new Date().toLocaleString()}` 
        });
      }
    } catch (err) {
      console.error('Error:', err);
    }
  });
}

console.log('🚀 Starting Casper2...');
connectToWhatsApp();
