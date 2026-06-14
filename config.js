// config.js — Centralized configuration from .env
require('dotenv').config();

const e = process.env;
const int = (k, d) => parseInt(e[k]) || d;
const float = (k, d) => parseFloat(e[k]) || d;
const bool = (k, d) => e[k] !== undefined ? e[k] === 'true' : d;
const str = (k, d) => e[k] || d;

module.exports = {
  // Wallet
  walletPrivateKey: str('WALLET_PRIVATE_KEY', ''),
  walletAddress: str('WALLET_ADDRESS', ''),
  walletFile: str('WALLET_FILE', '/root/.hermes/owntown-attack-wallet.json'),
  tokenFile: str('TOKEN_FILE', './token.txt'),

  // Player
  playerId: str('PLAYER_ID', ''),
  playerName: str('PLAYER_NAME', 'Elaina'),

  // Server
  serverUrl: str('SERVER_URL', 'https://owntown.fun'),
  apiBase: str('API_BASE', 'https://owntown.fun'),

  // Farming
  mining: { count: int('MINING_ACTION_COUNT', 15), interval: int('MINING_INTERVAL_MS', 3500) },
  fishing: { count: int('FISHING_ACTION_COUNT', 5), interval: int('FISHING_INTERVAL_MS', 25000), timeout: int('FISHING_TIMEOUT_MS', 35000) },
  combat: { count: int('COMBAT_ACTION_COUNT', 5), interval: int('COMBAT_INTERVAL_MS', 3000) },
  pvp: { count: int('PVP_ACTION_COUNT', 3), interval: int('PVP_INTERVAL_MS', 5000), minLevel: int('PVP_MIN_LEVEL', 5), minStamina: int('PVP_MIN_STAMINA', 30) },

  // Economy
  dailyEarnCap: int('DAILY_EARN_CAP', 5000),
  carryCap: int('CARRY_CAP', 56),
  undercutPct: float('UNDERCUT_PCT', 0.08),
  flipCooldownMs: int('FLIP_COOLDOWN_MS', 60000),
  flipMaxCost: int('FLIP_MAX_COST', 200),
  flipMinProfit: int('FLIP_MIN_PROFIT', 50),
  healHp: int('HEAL_HP_THRESHOLD', 40),
  lowHp: int('LOW_HP_THRESHOLD', 25),

  // Market AI
  marketAi: {
    enabled: bool('MARKET_AI_ENABLED', true),
    historyWindow: int('MARKET_HISTORY_WINDOW', 50),
    minSamples: int('MARKET_MIN_SAMPLES', 5),
    holdTrendPct: float('MARKET_HOLD_TREND_PCT', 0.15),
    emaAlpha: float('MARKET_EMA_ALPHA', 0.15),
  },

  // Priority farming
  priorityFarming: {
    enabled: bool('PRIORITY_FARMING_ENABLED', true),
    recalcCycles: int('PRIORITY_RECALC_CYCLES', 4),
  },

  // Anti-detection
  antiDetect: {
    sessionMinMs: int('SESSION_MIN_MS', 1200000),
    sessionMaxMs: int('SESSION_MAX_MS', 14400000),
    sessionMeanMs: int('SESSION_MEAN_MS', 5400000),
    breakMinMs: int('BREAK_MIN_MS', 300000),
    breakMaxMs: int('BREAK_MAX_MS', 5400000),
    longBreakChance: float('LONG_BREAK_CHANCE', 0.10),
    socialEnabled: bool('SOCIAL_BEHAVIOR_ENABLED', true),
    socialChance: float('SOCIAL_ACTION_CHANCE', 0.05),
    actionSkipChance: float('ACTION_SKIP_CHANCE', 0.02),
    chatEnabled: bool('CHAT_ENABLED', false),
    peakStart: int('PEAK_HOUR_START', 14),
    peakEnd: int('PEAK_HOUR_END', 23),
    nightFloor: float('NIGHT_FLOOR_MULTIPLIER', 0.25),
  },

  // State persistence
  state: {
    file: str('STATE_FILE', './state.json'),
    saveInterval: int('STATE_SAVE_INTERVAL_MS', 60000),
    resume: bool('STATE_RESUME', true),
  },

  // Notifications
  notify: {
    telegram: {
      enabled: bool('TELEGRAM_ENABLED', false),
      botToken: str('TELEGRAM_BOT_TOKEN', ''),
      chatId: str('TELEGRAM_CHAT_ID', ''),
    },
    webhook: {
      enabled: bool('WEBHOOK_ENABLED', false),
      url: str('WEBHOOK_URL', ''),
    },
    intervalMs: int('NOTIFY_INTERVAL_MS', 600000),
    onError: bool('NOTIFY_ON_ERROR', true),
    onSessionBreak: bool('NOTIFY_ON_SESSION_BREAK', true),
  },

  // Logging
  log: {
    file: str('LOG_FILE', './bot.log'),
    maxSizeMb: int('LOG_MAX_SIZE_MB', 50),
    level: str('LOG_LEVEL', 'info'),
  },
};
