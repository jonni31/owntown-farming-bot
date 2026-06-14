// humanize.js v25 — Enhanced anti-detection with social behavior & fingerprint randomization
const crypto = require('crypto');

// ── Random helpers ──
function rand() { return crypto.randomInt(0, 2 ** 32) / 2 ** 32; }
function randInt(min, max) { return crypto.randomInt(min, max + 1); }
function gauss(mean = 0, stddev = 1) {
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * stddev + mean;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Jitter ──
function jitter(baseMs, variancePct = 0.15) {
  return Math.max(50, Math.round(gauss(baseMs, baseMs * variancePct)));
}
function maybeDelay(prob = 0.05, minMs = 500, maxMs = 3000) {
  return rand() < prob ? jitter(minMs + rand() * (maxMs - minMs), 0.3) : 0;
}
function humanDelay(baseMs, variancePct = 0.18, extraProb = 0.08) {
  return jitter(baseMs, variancePct) + maybeDelay(extraProb);
}

// ── Breaks ──
function microBreak() { return jitter(randInt(200, 1200), 0.4); }
function shortBreak(prob = 0.04) { return rand() < prob ? jitter(randInt(1000, 5000), 0.3) : 0; }
function longBreak(prob = 0.008) { return rand() < prob ? jitter(randInt(30000, 180000), 0.3) : 0; }

// ── Session management ──
let _cfg = { min: 20*60000, max: 4*3600000, mean: 90*60000, breakMin: 5*60000, breakMax: 90*60000, longBreakChance: 0.10 };
let sessionStart = Date.now();
let sessionLength = pickSessionLength();

function configureSession(opts) {
  if (opts.sessionMinMs) _cfg.min = opts.sessionMinMs;
  if (opts.sessionMaxMs) _cfg.max = opts.sessionMaxMs;
  if (opts.sessionMeanMs) _cfg.mean = opts.sessionMeanMs;
  if (opts.breakMinMs) _cfg.breakMin = opts.breakMinMs;
  if (opts.breakMaxMs) _cfg.breakMax = opts.breakMaxMs;
  if (opts.longBreakChance !== undefined) _cfg.longBreakChance = opts.longBreakChance;
}

function pickSessionLength() {
  // Gamma-like distribution: mix of short and long sessions
  const u = rand();
  const skewed = Math.pow(u, 1.3);
  const base = _cfg.min + skewed * (_cfg.max - _cfg.min);
  // Add gaussian noise ±15%
  return Math.max(_cfg.min, Math.round(gauss(base, base * 0.15)));
}

function sessionExpired() { return Date.now() - sessionStart >= sessionLength; }

function takeSessionBreak() {
  const dur = randInt(_cfg.breakMin, _cfg.breakMax);
  // Chance of "went to bed" long break
  if (rand() < _cfg.longBreakChance) {
    const hours = 2 + rand() * 6; // 2-8 hours
    return Math.round(hours * 3600000);
  }
  return dur;
}

function newSession() {
  sessionStart = Date.now();
  sessionLength = pickSessionLength();
  return sessionLength;
}

function getSessionInfo() {
  const elapsed = Date.now() - sessionStart;
  const remaining = Math.max(0, sessionLength - elapsed);
  return { elapsed, remaining, length: sessionLength, startedAt: sessionStart };
}

// ── Time-of-day ──
let _peakStart = 14, _peakEnd = 23, _nightFloor = 0.25;
function configureTimeOfDay(opts) {
  if (opts.peakStart !== undefined) _peakStart = opts.peakStart;
  if (opts.peakEnd !== undefined) _peakEnd = opts.peakEnd;
  if (opts.nightFloor !== undefined) _nightFloor = opts.nightFloor;
}

function timeOfDayMultiplier(hour) {
  if (hour === undefined) hour = getCurrentHour();
  if (hour >= _peakStart && hour <= _peakEnd) return 1.0;
  if (hour >= 7 && hour < _peakStart) return 0.6 + 0.4 * ((hour - 7) / (_peakStart - 7));
  if (hour > _peakEnd) return 0.5 + 0.5 * Math.max(0, (24 - hour) / (24 - _peakEnd));
  return _nightFloor + rand() * 0.15;
}

function getCurrentHour() { return new Date().getUTCHours(); }

// ── Movement ──
function reactionTime() { return jitter(180 + rand() * 470, 0.3); }
function pathJitter(amount = 1.5) { return { dx: gauss(0, amount), dz: gauss(0, amount) }; }
function speedVariance(baseSpeed) { return baseSpeed * (1 + gauss(0, 0.04)); }
function tickInterval(baseMs) { return Math.max(60, Math.round(gauss(baseMs, baseMs * 0.18))); }

// ── Shuffle ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Idle animations (expanded) ──
const ANIMS = ['idle', 'idle', 'idle', 'wave', 'sit', 'idle', 'look_around', 'stretch', 'dance'];
function randomIdleAnim() { return ANIMS[crypto.randomInt(0, ANIMS.length)]; }

// ── Enhanced fingerprint randomization ──
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
];

const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9',
  'en-US,en;q=0.9,id;q=0.8',
  'en-GB,en;q=0.9',
  'en-US,en;q=0.8',
  'id-ID,id;q=0.9,en;q=0.8',
];

const SCREEN_RESOLUTIONS = [
  { w: 1920, h: 1080 }, { w: 2560, h: 1440 }, { w: 1366, h: 768 },
  { w: 1440, h: 900 }, { w: 1536, h: 864 }, { w: 3840, h: 2160 },
];

// Sticky per-session fingerprint
let _fingerprint = null;
function generateFingerprint() {
  _fingerprint = {
    ua: USER_AGENTS[crypto.randomInt(0, USER_AGENTS.length)],
    lang: ACCEPT_LANGUAGES[crypto.randomInt(0, ACCEPT_LANGUAGES.length)],
    screen: SCREEN_RESOLUTIONS[crypto.randomInt(0, SCREEN_RESOLUTIONS.length)],
    timezone: ['Asia/Jakarta', 'Asia/Singapore', 'America/New_York', 'Europe/London', 'Asia/Tokyo'][crypto.randomInt(0, 5)],
    platform: ['Win32', 'MacIntel', 'Linux x86_64'][crypto.randomInt(0, 3)],
    sessionId: crypto.randomBytes(16).toString('hex'),
  };
  return _fingerprint;
}
function getFingerprint() { return _fingerprint || generateFingerprint(); }

function pickUA() { return getFingerprint().ua; }
function getHeaders(token) {
  const fp = getFingerprint();
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': fp.ua,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': fp.lang,
    'Origin': 'https://owntown.fun',
    'Referer': 'https://owntown.fun/',
    'Sec-Ch-Ua-Platform': `"${fp.platform}"`,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ── Social behavior (v25 NEW) ──
const SOCIAL_ACTIONS = [
  { type: 'check_ledger', weight: 3 },
  { type: 'check_bank', weight: 2 },
  { type: 'check_property', weight: 2 },
  { type: 'check_profile', weight: 1 },
  { type: 'idle_browse', weight: 3 },
  { type: 'browse_market', weight: 2 },
  { type: 'emote', weight: 2 },
  { type: 'look_around', weight: 3 },
  { type: 'check_leaderboard', weight: 1 },
];

const EMOTES = ['wave', 'dance', 'sit', 'flex', 'clap', 'laugh', 'shrug'];
const CHAT_MESSAGES = [
  'anyone mining?', 'gg', 'nice', 'lol', 'brb', 'sup', 'how much is iron?',
  'anyone wanna trade?', 'need party?', 'gl', 'back', 'o/',
];

function pickSocialAction(prob) {
  if (rand() > (prob || 0.05)) return null;
  const totalWeight = SOCIAL_ACTIONS.reduce((s, a) => s + a.weight, 0);
  let r = rand() * totalWeight;
  for (const action of SOCIAL_ACTIONS) {
    r -= action.weight;
    if (r <= 0) return action.type;
  }
  return SOCIAL_ACTIONS[0].type;
}

function pickEmote() { return EMOTES[crypto.randomInt(0, EMOTES.length)]; }
function pickChatMessage() { return CHAT_MESSAGES[crypto.randomInt(0, CHAT_MESSAGES.length)]; }

// ── Typing simulation ──
function typingDelay(message) {
  // ~150-300ms per character with variance
  const basePerChar = 150 + rand() * 150;
  const thinkTime = jitter(500, 0.5); // initial "think" pause
  return Math.round(thinkTime + message.length * basePerChar * (0.5 + rand() * 1.0));
}

// ── Enhanced human action patterns ──
function shouldSkipAction(skipChance) {
  return rand() < (skipChance || 0.02);
}

// Simulate "distraction" — player walks to random nearby spot then back
function distractionWalk() {
  if (rand() < 0.01) { // 1% per cycle
    return {
      offset: pathJitter(5),
      pauseMs: jitter(randInt(2000, 8000), 0.3),
    };
  }
  return null;
}

// ── Activity pattern (more realistic daily schedules) ──
function getActivityProfile(hour) {
  // Simulate a realistic player schedule
  const profiles = {
    sleep: { mult: 0, chance: 0 },      // not playing
    wakeup: { mult: 0.3, chance: 0.4 },  // just woke up, casual
    morning: { mult: 0.6, chance: 0.7 }, // moderate
    afternoon: { mult: 0.8, chance: 0.9 }, // active
    evening: { mult: 1.0, chance: 1.0 }, // peak gaming hours
    night: { mult: 0.7, chance: 0.8 },   // winding down
    latenight: { mult: 0.4, chance: 0.5 }, // dedicated gamer
  };

  if (hour >= 2 && hour < 7) return profiles.sleep;
  if (hour >= 7 && hour < 9) return profiles.wakeup;
  if (hour >= 9 && hour < 12) return profiles.morning;
  if (hour >= 12 && hour < 14) return profiles.afternoon;
  if (hour >= 14 && hour < 18) return profiles.afternoon;
  if (hour >= 18 && hour < 22) return profiles.evening;
  if (hour >= 22 || hour < 2) return profiles.latenight;
  return profiles.morning;
}

// ── Stats tracking ──
const stats = {
  microBreaks: 0, shortBreaks: 0, longBreaks: 0,
  humanActions: 0, socialActions: 0, skippedActions: 0,
  distractions: 0, sessionsCompleted: 0,
  fingerprintsGenerated: 0,
};
function bumpStat(name) { stats[name] = (stats[name] || 0) + 1; }
function getStats() { return { ...stats }; }

module.exports = {
  rand, randInt, gauss, clamp,
  jitter, maybeDelay, humanDelay,
  microBreak, shortBreak, longBreak,
  configureSession, pickSessionLength, sessionExpired, takeSessionBreak, newSession, getSessionInfo,
  configureTimeOfDay, timeOfDayMultiplier, getCurrentHour,
  reactionTime, pathJitter, speedVariance, tickInterval,
  shuffle, randomIdleAnim,
  // v25 new
  generateFingerprint, getFingerprint, pickUA, getHeaders,
  pickSocialAction, pickEmote, pickChatMessage, typingDelay,
  shouldSkipAction, distractionWalk, getActivityProfile,
  bumpStat, getStats, stats,
};
