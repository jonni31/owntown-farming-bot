# 🏭 Owntown Profit Farmer v25.0

Full-featured automated farming bot for [Owntown.fun](https://owntown.fun) — a Solana-based MMO economy game.

## ✨ What's New in v25

| Feature | Description |
|---------|-------------|
| 🧠 **Smart Market AI** | EMA price tracking, trend analysis (linear regression), volume-weighted sell decisions, auto-hold on uptrends |
| 🎯 **Priority Farming** | Auto-switches to most profitable activity (mining/fishing/combat) based on real-time OTWN/hour data |
| 🛡️ **Enhanced Anti-Ban** | Fingerprint randomization per session (UA, language, screen, timezone), social behavior (emotes, leaderboard checks, idle browsing), typing simulation, distraction walks |
| 📊 **Telegram/Webhook** | Profit reports, error alerts, session break notifications, milestone alerts (level up, earning goals) |
| 💾 **State Persistence** | Auto-saves stats + market data every 60s. Resume seamlessly after restart |
| 🔧 **Config-Driven** | All settings in `.env` — no code edits needed |
| 🔄 **PM2 Watchdog** | Auto-restart on crash, memory cap, log rotation |
| 🐛 **Bug Fixes** | Proper session break disconnect (v23.3 memory leak), socket cleanup, atomic state writes |

## 📁 File Structure

```
├── bot.js              # Main bot logic
├── config.js           # Configuration loader (.env → typed config)
├── humanize.js         # Anti-detection engine (jitter, sessions, fingerprints, social)
├── market-ai.js        # Market intelligence (EMA, trends, flip detection, priority farming)
├── state.js            # State persistence manager (auto-save/load)
├── notifier.js         # Telegram + Webhook notification system
├── ecosystem.config.js # PM2 auto-restart config
├── package.json
├── .env.example        # All configurable settings
└── .gitignore
```

## 🚀 Quick Start

### 1. Install

```bash
git clone <this-repo>
cd owntown-farmer-v25
npm install
```

### 2. Configure

```bash
cp .env.example .env
nano .env
```

Required settings:
- `WALLET_PRIVATE_KEY` — Your Solana wallet private key (base58)
- `WALLET_ADDRESS` — Your Solana wallet address
- `PLAYER_ID` — Your in-game player ID

Optional but recommended:
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` — For profit notifications
- `WEBHOOK_URL` — Discord/custom webhook

### 3. Wallet Setup

Create wallet JSON at the path specified in `WALLET_FILE` (default: `/root/.hermes/owntown-attack-wallet.json`):

```json
{
  "private_key": "your_base58_private_key"
}
```

### 4. Run

```bash
# Direct
node bot.js

# With PM2 (recommended for VPS)
npm install -g pm2
npm run pm2

# Check status
npm run pm2:status

# View logs
npm run pm2:logs
```

## 🧠 Market AI

The Market AI module tracks prices using Exponential Moving Averages and makes smart decisions:

- **HOLD** — Price is trending up (predicted to rise further)
- **MARKETPLACE** — List at optimal price (undercuts market by 8%, respects price floor)
- **QUICKSELL** — Fast sell for common/low-value items

Flip detection finds underpriced listings (>60% below market, >30% ROI) and auto-buys them for resale.

## 🎯 Priority Farming

After 10+ cycles, the bot analyzes OTWN/hour by activity type and automatically weights the cycle order toward the most profitable:

```
🎯 Priority: mining:245/h fishing:180/h combat:120/h
→ Cycle order: [sell, mining, mining, mining, fishing, combat, pvp, mining]
```

## 🛡️ Anti-Detection

- **Fingerprint rotation** — New UA, language, screen res, timezone per session
- **Gaussian jitter** — Every action timing follows a bell curve (never fixed intervals)
- **Session breaks** — 20min–4hr play, 5–90min breaks (10% chance of 2–8hr "sleep")
- **Social behavior** — Random emotes, leaderboard checks, market browsing, idle animations
- **Action skip** — 2% miss rate (looks like real player mistakes)
- **Time-of-day scaling** — Slower at night, faster during peak hours
- **Distraction walks** — 1% chance of random nearby walk per cycle

## 📊 Notifications

### Telegram Setup

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
3. Set in `.env`:
   ```
   TELEGRAM_ENABLED=true
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_CHAT_ID=your_chat_id
   ```

### Webhook (Discord)

```
WEBHOOK_ENABLED=true
WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## ⚠️ Requirements

- **Node.js 18+**
- **Solana wallet** with private key
- **Min 5,000 OTWN** tokens in wallet (server token gate)
- VPS recommended for 24/7 operation

## 📄 License

MIT
