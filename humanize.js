// humanize.js — Anti-detection helpers for owntown farming bot
// Provides Gaussian jitter, micro/macro breaks, session management,
// time-of-day gating, and human-like reaction delays.
// Uses crypto.randomInt for proper RNG (not Math.random which is fingerprintable).

const crypto = require('crypto');

// ---- Random helpers ----

function rand() {
  // crypto-grade uniform [0, 1)
  return crypto.randomInt(0, 2 ** 32) / 2 ** 32;
}

function randInt(min, max) {
  // inclusive both ends
  return crypto.randomInt(min, max + 1);
}

// Box-Muller transform for Gaussian distribution
function gauss(mean = 0, stddev = 1) {
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stddev + mean;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---- Jitter primitives ----

// Add Gaussian jitter to a base delay. e.g. jitter(3500, 0.18) -> ~3500ms ± 18%
function jitter(baseMs, variancePct = 0.15) {
  const stddev = baseMs * variancePct;
  const v = gauss(baseMs, stddev);
  return Math.max(50, Math.round(v));
}

// Occasionally add an extra delay. e.g. maybeDelay(0.06) -> 6% chance of 800-3500ms extra
function maybeDelay(prob = 0.05, minExtraMs = 500, maxExtraMs = 3000) {
  if (rand() < prob) {
    return jitter(minExtraMs + rand() * (maxExtraMs - minExtraMs), 0.3);
  }
  return 0;
}

// Combined: base + jitter + maybe extra
function humanDelay(baseMs, variancePct = 0.18, extraProb = 0.08) {
  return jitter(baseMs, variancePct) + maybeDelay(extraProb);
}

// ---- Breaks ----

// Tiny "thinking" pause 200-1200ms
function microBreak() {
  return jitter(randInt(200, 1200), 0.4);
}

// Short break 1-5s (looking around, eating, checking phone)
function shortBreak(prob = 0.04) {
  if (rand() < prob) return jitter(randInt(1000, 5000), 0.3);
  return 0;
}

// Long break 30-180s (AFK, dinner, etc.) — rare
function longBreak(prob = 0.008) {
  if (rand() < prob) return jitter(randInt(30000, 180000), 0.3);
  return 0;
}

// ---- Session management ----

const SESSION_MIN_MS = 20 * 60 * 1000;       // 20 min minimum
const SESSION_MAX_MS = 4 * 60 * 60 * 1000;    // 4 hour max
const SESSION_MEAN_MS = 90 * 60 * 1000;       // 90 min average
const BREAK_BETWEEN_MIN = 5 * 60 * 1000;      // 5 min min break between sessions
const BREAK_BETWEEN_MAX = 90 * 60 * 1000;     // 90 min max break

let sessionStart = Date.now();
let sessionLength = pickSessionLength();

function pickSessionLength() {
  // Right-skewed distribution: many short sessions, fewer long ones
  const u = rand();
  const skewed = Math.pow(u, 1.5);  // bias toward shorter
  return Math.round(SESSION_MIN_MS + skewed * (SESSION_MAX_MS - SESSION_MIN_MS));
}

function sessionExpired() {
  return Date.now() - sessionStart >= sessionLength;
}

function takeSessionBreak() {
  // Pick a break duration
  const dur = randInt(BREAK_BETWEEN_MIN, BREAK_BETWEEN_MAX);
  // 10% chance of a really long break (looks like user went to bed)
  const finalDur = rand() < 0.10 ? randInt(2, 8) * 60 * 60 * 1000 : dur;
  return finalDur;
}

function newSession() {
  sessionStart = Date.now();
  sessionLength = pickSessionLength();
}

// ---- Time-of-day gating ----

// Reduce intensity during "night hours" (00:00 - 07:00 UTC by default)
// Returns multiplier 0..1 for how much to slow down
function timeOfDayMultiplier(hour, peakStart = 14, peakEnd = 23, nightFloor = 0.25) {
  // Peak hours: peakStart..peakEnd = 1.0
  // Day shoulder: 07..peakStart and peakEnd..24 = linear 0.5..1
  // Night: 0..07 = nightFloor
  if (hour >= peakStart && hour <= peakEnd) return 1.0;
  if (hour >= 7 && hour < peakStart) {
    // ramp up from 0.6 to 1.0
    return 0.6 + 0.4 * ((hour - 7) / (peakStart - 7));
  }
  if (hour > peakEnd) {
    // ramp down from 1.0 to 0.5
    return 0.5 + 0.5 * Math.max(0, (24 - hour) / (24 - peakEnd));
  }
  return nightFloor + rand() * 0.15;  // small jitter at night
}

function getCurrentHour() {
  return new Date().getUTCHours();
}

// ---- Reaction time ----

// Human reaction time 180-650ms with skew toward faster
function reactionTime() {
  const base = 180 + rand() * 470;
  return jitter(base, 0.3);
}

// ---- Walking variance ----

// Add small random offset to target position to look human (not pixel-perfect pathing)
function pathJitter(amount = 1.5) {
  return {
    dx: gauss(0, amount),
    dz: gauss(0, amount),
  };
}

// Per-step speed variance (±5%) so movement isn't mathematically perfect
function speedVariance(baseSpeed) {
  return baseSpeed * (1 + gauss(0, 0.04));
}

// Per-step emit timing variance (humans don't tick at exactly 100ms)
function tickInterval(baseMs) {
  return Math.max(60, Math.round(gauss(baseMs, baseMs * 0.18)));
}

// ---- Cycle order shuffling ----

// Fisher-Yates shuffle with crypto RNG
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Idle animations ----

const ANIMS = ['idle', 'idle', 'idle', 'wave', 'sit', 'idle', 'look_around'];

function randomIdleAnim() {
  return ANIMS[crypto.randomInt(0, ANIMS.length)];
}

// ---- "Human" actions queue ----

// Probability-weighted list of "human" actions to occasionally do
// Returns null or an event name to emit
function maybeHumanAction(prob = 0.03) {
  if (rand() > prob) return null;
  const actions = [
    'check_ledger', 'check_ledger',         // weight: 2x
    'check_bank',
    'check_property',
    'check_profile',
    'idle_browse',
  ];
  return actions[crypto.randomInt(0, actions.length)];
}

// ---- Stats ----

const stats = {
  microBreaks: 0,
  shortBreaks: 0,
  longBreaks: 0,
  humanActions: 0,
  jitterSamples: [],
};

function bumpStat(name) { stats[name] = (stats[name] || 0) + 1; }
function getStats() { return { ...stats }; }

module.exports = {
  rand,
  randInt,
  gauss,
  clamp,
  jitter,
  maybeDelay,
  humanDelay,
  microBreak,
  shortBreak,
  longBreak,
  pickSessionLength,
  sessionExpired,
  takeSessionBreak,
  newSession,
  timeOfDayMultiplier,
  getCurrentHour,
  reactionTime,
  pathJitter,
  speedVariance,
  tickInterval,
  shuffle,
  randomIdleAnim,
  maybeHumanAction,
  bumpStat,
  getStats,
  stats,
};
