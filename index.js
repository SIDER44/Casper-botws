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
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
          }
          .container { 
            background: rgba(255,255,255,0.95); 
            padding: 30px; 
            border-radius: 15px; 
            max-width: 900px; 
            margin: 20px auto;
            color: #333;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          }
          .status { 
            font-size: 28px; 
            margin: 20px 0; 
            font-weight: bold;
          }
          .qr-container {
            background: white;
            padding: 20px;
            border-radius: 10px;
            display: inline-block;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          }
          #qrcode {
            margin: 0 auto;
            display: block;
          }
          .instructions {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #2196f3;
          }
          h1 { color: #667eea; }
          .center { text-align: center; }
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
              <li>Open <strong>WhatsApp</strong> on your phone</li>
              <li>Go to <strong>Settings → Linked Devices</strong></li>
              <li>Tap <strong>"Link a Device"</strong></li>
              <li>Scan the QR code below ⬇️</li>
            </ol>
          </div>

          <div class="center">
            <h2>📱 Scan This QR Code:</h2>
            ${qrCodeText && qrCodeText.length > 50 && !isConnected ? `
              <div class="qr-container">
                <div id="qrcode"></div>
              </div>
              <script>
                var qrcode = new QRCode(document.getElementById("qrcode"), {
                  text: "${qrCodeText.replace(/"/g, '\\"')}",
                  width: 300,
                  height: 300,
                  colorDark : "#000000",
                  colorLight : "#ffffff",
                  correctLevel : QRCode.CorrectLevel.H
                });
              </script>
            ` : `
              <p style="font-size: 20px; color: ${isConnected ? 'green' : 'orange'};">
                ${isConnected ? '✅ Bot Connected!' : '⏳ Generating QR code...'}
              </p>
            `}
          </div>
          
          <p style="text-align: center;"><small>⚠️ Page auto-refreshes every 10 seconds</small></p>
          
          ${isConnected ? '<p style="color: green; font-size: 18px; text-align: center;">✅ Bot is ready! Send <strong>!help</strong> anywhere in WhatsApp to test!</p>' : ''}
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📱 Visit your Render URL to see status`);
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
      printQRInTerminal: false,
      browser: ['Casper2 Bot', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      emitOwnEvents: false,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      getMessage: async (key) => {
        return { conversation: '' }
      }
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
        
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('⚠️ Logged out! Need to scan QR again');
          qrCodeText = '⚠️ Logged out - restart service to get new QR';
          return;
        }
        
        console.log('🔄 Reconnecting in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
        
      } else if (connection === 'open') {
        console.log('✅✅✅ WHATSAPP CONNECTED SUCCESSFULLY! ✅✅✅');
        console.log('📱 Bot is now online and ready!');
        console.log('💬 Send !help anywhere in WhatsApp to test\n');
        isConnected = true;
        qrCodeText = '✅ Connected! Bot is online and ready!';
      } else if (connection === 'connecting') {
        console.log('⏳ Connecting to WhatsApp...');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Message handler - IMPROVED VERSION
    sock.ev.on('messages.upsert', async (m) => {
      console.log('\n========================================');
      console.log('📥 NEW MESSAGE EVENT RECEIVED!');
      console.log('========================================');
      
      try {
        const msg = m.messages[0];
        
        console.log('Message keys:', Object.keys(msg));
        console.log('Has message?', !!msg.message);
        
        if (!msg.message) {
          console.log('⚠️ No message content - skipping');
          return;
        }
        
        const messageType = Object.keys(msg.message)[0];
        console.log('Message type:', messageType);
        
        // Get text from different message types
        let text = '';
        if (msg.message.conversation) {
          text = msg.message.conversation;
        } else if (msg.message.extendedTextMessage) {
          text = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage && msg.message.imageMessage.caption) {
          text = msg.message.imageMessage.caption;
        } else if (msg.message.videoMessage && msg.message.videoMessage.caption) {
          text = msg.message.videoMessage.caption;
        }
        
        text = text.toLowerCase().trim();
        const from = msg.key.remoteJid;
        const fromMe = msg.key.fromMe;
        
        console.log(`📞 FROM: ${from}`);
        console.log(`📝 TEXT: "${text}"`);
        console.log(`🔑 From Me: ${fromMe}`);
        
        // Don't respond to own messages
        if (fromMe) {
          console.log('⚠️ Skipping - message is from me');
          return;
        }
        
        if (!text) {
          console.log('⚠️ No text found in message');
          return;
        }
        
        // Commands - using includes for better detection
        if (text.includes('!ping') || text === 'ping') {
          console.log('🎯 PING COMMAND DETECTED!');
          await sock.sendMessage(from, { text: '🏓 Pong! Casper2 is online and working!' });
          console.log('✅ Sent pong response!');
        }
        
        else if (text.includes('!help') || text === 'help') {
          console.log('🎯 HELP COMMAND DETECTED!');
          const help = `*🤖 Casper2 WhatsApp Bot*

*Available Commands:*
• !ping - Check if bot is online
• !help - Show this help menu
• !info - Bot information
• !time - Current server time
• !status - Connection status

Send any command to interact with Casper2!`;
          
          await sock.sendMessage(from, { text: help });
          console.log('✅ Sent help message!');
        }
        
        else if (text.includes('!info') || text === 'info') {
          console.log('🎯 INFO COMMAND DETECTED!');
          const info = `*Casper2 Bot Information* ℹ️

✅ Status: Online
⏱️ Uptime: ${Math.floor(process.uptime())} seconds
📦 Version: 1.0.0
🌐 Platform: Render
🔧 Library: Baileys`;
          
          await sock.sendMessage(from, { text: info });
          console.log('✅ Sent info message!');
        }
        
        else if (text.includes('!time') || text === 'time') {
          console.log('🎯 TIME COMMAND DETECTED!');
          const time = `🕐 *Current Server Time*\n\n${new Date().toLocaleString('en-US', { 
            dateStyle: 'full', 
            timeStyle: 'long' 
          })}`;
          
          await sock.sendMessage(from, { text: time });
          console.log('✅ Sent time message!');
        }
        
        else if (text.includes('!status') || text === 'status') {
          console.log('🎯 STATUS COMMAND DETECTED!');
          await sock.sendMessage(from, { text: '✅ Bot is connected and working perfectly!' });
          console.log('✅ Sent status message!');
        }
        
        else {
          console.log('⚠️ Unknown command or not a command');
        }
        
        console.log('========================================\n');
        
      } catch (error) {
        console.error('❌ ERROR IN MESSAGE HANDLER:', error);
        console.error('Error stack:', error.stack);
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
