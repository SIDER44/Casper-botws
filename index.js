const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

// Express server to keep bot alive
const app = express();
const PORT = process.env.PORT || 3000;

let isConnected = false;

app.get('/', (req, res) => {
  res.send('🤖 Casper2 WhatsApp Bot is running!');
});

app.get('/status', (req, res) => {
  res.json({
    status: isConnected ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// WhatsApp Bot
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('📱 Scan this QR code with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      isConnected = false;
      
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
      isConnected = true;
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Message handler
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    
    if (!msg.message || msg.key.fromMe) return;
    
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    console.log(`📩 Message from ${from}: ${text}`);

    // Commands
    if (text.toLowerCase() === '!ping') {
      await sock.sendMessage(from, { text: '🏓 Pong! Casper2 is online!' });
    }
    
    if (text.toLowerCase() === '!help') {
      const helpText = `*Casper2 WhatsApp Bot* 🤖

Available Commands:
• !ping - Check if bot is online
• !help - Show this message
• !info - Bot information
• !time - Current server time`;
      
      await sock.sendMessage(from, { text: helpText });
    }
    
    if (text.toLowerCase() === '!info') {
      await sock.sendMessage(from, { 
        text: `*Casper2 Bot Info* ℹ️\n\nStatus: Online ✅\nUptime: ${Math.floor(process.uptime())}s\nVersion: 1.0.0` 
      });
    }
    
    if (text.toLowerCase() === '!time') {
      await sock.sendMessage(from, { 
        text: `🕐 Current time: ${new Date().toLocaleString()}` 
      });
    }
  });
}

// Start bot
connectToWhatsApp().catch(err => console.error('Error:', err));
