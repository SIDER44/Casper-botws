# Casper2 WhatsApp Bot 📱

A WhatsApp bot using Baileys library that runs 24/7 on Render.

## ⚠️ Disclaimer
This bot uses unofficial WhatsApp API. Your number might get banned. Use at your own risk!

## Features
- ✅ 24/7 online on Render
- 🤖 Auto-responds to commands
- 📱 QR code authentication
- 💾 Session saved (no re-scan needed)

## Commands
- `!ping` - Check bot status
- `!help` - Show all commands
- `!info` - Bot information
- `!time` - Current server time

## Deploy to Render

1. Push this code to GitHub
2. Go to Render.com and create Web Service
3. Connect your repository
4. Set:
   - Build: `npm install`
   - Start: `npm start`
   - Instance: Free
5. Check logs for QR code
6. Scan QR with WhatsApp
7. Bot is online!

## Important Notes
- You need to scan QR code from Render logs (first time only)
- Keep the service running (Free tier may sleep after 15 mins inactivity)
- Session is saved so you don't need to re-scan
