const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

// Express server
const app = express();
const PORT = process.env.PORT || 3000;

let isConnected = false;
let qrCodeText = 'Starting bot... Please wait';
let sock = null;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Casper2 WhatsApp Bot</title>
        <meta http-equiv="refresh" content="10">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container { 
            background: rgba(255,255,255,0.95); 
            padding: 30px; 
            border-radius: 15px; 
            max-width: 900px; 
            margin: 0 auto;
            color: #333;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          }
          .status { 
            font-size: 28px; 
            margin: 20px 0; 
            font-weight: bold;
          }
          .qr { 
            background: #000; 
            color: #0f0; 
            padding: 20px; 
            font-family: 'Courier New', monospace; 
            overflow: auto;
            border-radius: 8px;
            font-size: 12px;
            line-height: 1;
          }
          .instructions {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #2196f3;
          }
          h1 { color: #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 Casper2 WhatsApp Bot</h1>
          <div class="status">
            ${isConnected ? '✅ Connected & Online' : '⏳ Waiting for QR Scan'}
          </div>
          <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
          
          <div class="instructions">
            <h3>📱 How to Connect:</h3>
            <ol>
              <li>Open WhatsApp on your phone</li>
              <li>Go to <strong>Settings → Linked Devices</strong></li>
              <li>Tap <strong>"Link a Device"</strong></li>
              <li>Scan the QR code below</li>
            </ol>
          </div>

          <h2>QR Code:</h2>
          <div class="qr">${qrCodeText}</div>
          <p><small>⚠️ Page refreshes every 10 seconds</small></p>
          
          ${isConnected ? '<p style="color: green; font-size: 18px;">✅ Bot is connected! Send <strong>!help</strong> to your WhatsApp number to see commands.</p>' : ''}
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📱 Visit: https://casper-botws-1ss.onrender.com`);
});

// Main connection function
async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      emitOwnEvents: true,
      markOnlineOnConnect: true
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n========================================');
        console.log('📱 NEW QR CODE GENERATED!');
        console.log('========================================\n');
        
        qrcode.generate(qr, { small: true });
        qrCodeText = qr;
        
        console.log('\n✅ Visit your Render URL to scan the QR code!');
        console.log('========================================\n');
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.output?.payload?.error;
        
        console.log('❌ Connection closed:', reason || 'Unknown reason');
        console.log('Status code:', statusCode);
        
        isConnected = false;
        
        // Don't reconnect if logged out
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('⚠️ Logged out! Need to scan QR again');
          qrCodeText = '⚠️ Logged out - restart service to get new QR';
          return;
        }
        
        // Wait before reconnecting
        console.log('🔄 Reconnecting in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
        
      } else if (connection === 'open') {
        console.log('✅✅✅ WHATSAPP CONNECTED SUCCESSFULLY! ✅✅✅');
        console.log('📱 Bot is now online and ready!');
        console.log('💬 Send !help to your number to test\n');
        isConnected = true;
        qrCodeText = '✅ Connected! Bot is online and ready!';
      } else if (connection === 'connecting') {
        console.log('⏳ Connecting to WhatsApp...');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Message handler
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;
      
      const from = msg.key.remoteJid;
      const text = (
        msg.message.conversation || 
        msg.message.extendedTextMessage?.text || 
        ''
      ).toLowerCase().trim();
      
      if (!text) return;
      
      console.log(`📩 Message from ${from}: ${text}`);

      try {
        if (text === '!ping') {
          await sock.sendMessage(from, { 
            text: '🏓 Pong! Casper2 is online and ready!' 
          });
          console.log('✅ Sent ping response');
        }
        
        else if (text === '!help') {
          const help = `*🤖 Casper2 WhatsApp Bot*

*Available Commands:*
• !ping - Check if bot is online
• !help - Show this help menu
• !info - Bot information
• !time - Current server time
• !status - Connection status

Send any command to interact with Casper2!`;
          
          await sock.sendMessage(from, { text: help });
          console.log('✅ Sent help message');
        }
        
        else if (text === '!info') {
          const info = `*Casper2 Bot Information* ℹ️

✅ Status: Online
⏱️ Uptime: ${Math.floor(process.uptime())} seconds
📦 Version: 1.0.0
🌐 Platform: Render
🔧 Library: Baileys`;
          
          await sock.sendMessage(from, { text: info });
          console.log('✅ Sent info message');
        }
        
        else if (text === '!time') {
          const time = `🕐 *Current Server Time*\n\n${new Date().toLocaleString('en-US', { 
            dateStyle: 'full', 
            timeStyle: 'long' 
          })}`;
          
          await sock.sendMessage(from, { text: time });
          console.log('✅ Sent time message');
        }
        
        else if (text === '!status') {
          await sock.sendMessage(from, { 
            text: '✅ Bot is connected and working perfectly!' 
          });
          console.log('✅ Sent status message');
        }
        
      } catch (err) {
        console.error('❌ Error handling message:', err.message);
      }
    });
    
  } catch (error) {
    console.error('❌ Error in connectToWhatsApp:', error);
    qrCodeText = `Error: ${error.message}`;
    setTimeout(connectToWhatsApp, 10000);
  }
}

// Start
console.log('🚀 Starting Casper2 WhatsApp Bot...');
console.log('📱 Initializing connection...\n');
connectToWhatsApp();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  if (sock) {
    await sock.logout();
  }
  process.exit(0);
});
