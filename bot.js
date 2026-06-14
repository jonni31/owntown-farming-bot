#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// OWNTOWN PROFIT FARMER v25.0 — FULLY UPGRADED
// Features: Smart Market AI, Priority Farming, Enhanced Anti-Detection,
//           Social Behavior, State Persistence, Telegram/Webhook Notifs,
//           Fingerprint Randomization, Auto-Restart Watchdog
// ════════════════════════════════════════════════════════════════

const io = require('socket.io-client');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const fs = require('fs');
const https = require('https');

const cfg = require('./config');
const H = require('./humanize');
const MarketAI = require('./market-ai');
const StateManager = require('./state');
const Notifier = require('./notifier');

// ── Init modules ──
const market = new MarketAI();
const state = new StateManager();
const notifier = new Notifier();

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  // Append to log file
  try {
    fs.appendFileSync(cfg.log.file, line + '\n');
    // Rotate if too big
    const stat = fs.statSync(cfg.log.file);
    if (stat.size > cfg.log.maxSizeMb * 1024 * 1024) {
      fs.renameSync(cfg.log.file, cfg.log.file + '.old');
    }
  } catch {}
}

log('=== OWNTOWN PROFIT FARMER v25.0 ===');
log('UPGRADED: Market AI + Priority Farming + Anti-Detect + Social + Notifs + State Persistence');

// ── Configure humanize from config ──
H.configureSession(cfg.antiDetect);
H.configureTimeOfDay(cfg.antiDetect);
H.generateFingerprint();
log(`🎭 Fingerprint: ${H.getFingerprint().ua.substring(0, 50)}... | ${H.getFingerprint().timezone}`);

// ════════════════════════════════════════════
// GAME DATA
// ════════════════════════════════════════════

const WALK_SPEED = 2.5;
const MAX_WALK_STEPS = 200;

const QUICKSELL = {
  'mat_iron': 2, 'mat_copper': 3, 'mat_gold': 8, 'mat_crystal': 15, 'mat_obsidian': 20,
  'fish_bass': 3, 'fish_trout': 5, 'fish_salmon': 8, 'fish_tuna': 12, 'fish_swordfish': 20,
  'fish_shark': 30, 'mat_stone': 1, 'mat_wood': 1, 'mat_coal': 2,
  'loot_fang': 4, 'loot_scale': 6, 'loot_claw': 8, 'loot_horn': 12, 'loot_gem': 25,
  'loot_relic': 50,
};

const PRICE_FLOOR = {
  'mat_iron': 3, 'mat_copper': 5, 'mat_gold': 12, 'mat_crystal': 22, 'mat_obsidian': 30,
  'fish_bass': 4, 'fish_trout': 7, 'fish_salmon': 12, 'fish_tuna': 18, 'fish_swordfish': 28,
  'fish_shark': 45, 'loot_fang': 6, 'loot_scale': 9, 'loot_claw': 12, 'loot_horn': 18,
  'loot_gem': 35, 'loot_relic': 70,
};

const SAFE_QUICKSELL = new Set(['mat_stone', 'mat_wood', 'mat_coal', 'mat_iron', 'fish_bass']);
const MARKETPLACE_ONLY = new Set(['mat_crystal', 'mat_obsidian', 'loot_gem', 'loot_relic', 'fish_shark', 'fish_swordfish']);
const FOOD_ITEMS = new Set(['food_ember_skewer', 'food_volt_noodles', 'food_ocean_stew', 'med_patch']);

const GEAR_RECIPES = {
  'gear_iron_pick': { needs: { 'mat_iron': 5, 'mat_wood': 3 }, fee: 20 },
  'gear_gold_pick': { needs: { 'mat_gold': 3, 'mat_iron': 5 }, fee: 50 },
  'gear_iron_rod': { needs: { 'mat_iron': 3, 'mat_wood': 2 }, fee: 15 },
  'gear_iron_sword': { needs: { 'mat_iron': 5, 'mat_wood': 2 }, fee: 25 },
  'gear_gold_sword': { needs: { 'mat_gold': 3, 'mat_iron': 5, 'mat_crystal': 1 }, fee: 75 },
};

// ── Map data ──
const MINING_NODES = [
  { id: 'node_dw_1', pos: {x:75,z:-95} }, { id: 'node_dw_2', pos: {x:95,z:-110} },
  { id: 'node_dw_3', pos: {x:120,z:-90} }, { id: 'node_dw_4', pos: {x:140,z:-120} },
  { id: 'node_dw_5', pos: {x:110,z:-145} }, { id: 'node_dw_6', pos: {x:80,z:-155} },
  { id: 'node_dw_7', pos: {x:150,z:-150} }, { id: 'node_dw_8', pos: {x:135,z:-165} },
];

const MONSTERS = [
  { id: 'mob_rat', pos: {x:-100,z:-120}, lvl: 1 }, { id: 'mob_spider', pos: {x:-110,z:-130}, lvl: 3 },
  { id: 'mob_wolf', pos: {x:-120,z:-140}, lvl: 5 }, { id: 'mob_bandit', pos: {x:-130,z:-145}, lvl: 8 },
  { id: 'mob_golem', pos: {x:-115,z:-155}, lvl: 12 }, { id: 'mob_drake', pos: {x:-140,z:-160}, lvl: 15 },
];

const ZONE_TARGETS = {
  deepworks: {x:75, z:-95}, pond: {x:-148.5, z:0}, redline_a: {x:-100, z:-120},
  residential: {x:-75, z:0}, spawn_plaza: {x:0, z:0}, clinic: {x:-60, z:-30},
  food_row: {x:20, z:55}, market: {x:25, z:-15}, garage: {x:45, z:-30},
  arena: {x:194, z:-185}, property: {x:30, z:40},
};

const WAYPOINTS_BASE = { fishing: [{x:0,z:0},{x:-80,z:0},{x:-148.5,z:0}] };

const EXPECTED_ZONE = {
  mining: 'deepworks', fishing: 'pond', combat: 'redline_a', pvp: 'arena',
};

const MY_PLAYER_ID = cfg.playerId;
const WALLET_ADDR = cfg.walletAddress;
const TOKEN_PATH = cfg.tokenFile;
const WALLET_FILE = cfg.walletFile;

// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════

let stats = {
  mined:0, fished:0, fought:0, kills:0, xp:0, items:0,
  soldQuick:0, soldMarket:0, earnedQuick:0, earnedMarket:0,
  listed:0, canceled:0, crafted:0, repaired:0, errors:0,
  consecutiveErrors:0, startTime:Date.now(), cycles:0,
  wrongZone:0, fishingTimeouts:0, fatigueDrops:0, restCount:0,
  currentNodeIdx:0, currentMonsterIdx:0, foodEaten:0,
  bossFights:0, bossClaims:0, worldBossActive:false,
  pvpQueued:0, pvpFights:0, pvpWins:0, pvpClaims:0, pvpEarnings:0,
  propertyBought:0, propertySold:0, propertyEarnings:0,
  bankDeposits:0, bankWithdrawals:0, bankBalance:0,
  gearCrafted:0, vehiclesBought:0, notifications:0,
  itemsBought:0, itemsFlipped:0, flipProfit:0,
  clinicHeals:0, portalEntries:0,
  totalRevenue:0, totalItemsSold:0,
  holdCount:0, holdValue:0,
  socialActions:0, chatsSent:0,
  level: 1, balance: 0, hp: 100, maxHp: 100, stamina: 100,
};

let balance=0, level=1, stamina=100, hp=100, dailyEarned=0, maxHp=100;
let inventory=[], inventoryReady=false, connected=false;
let pos={x:0,z:0}, zone='unknown', fishingActive=false;
let myActiveListings=[];
let fatigueMultiplier = 1.0;
let worldBossState = null;
let bankInfo = null;
let pvpState = null;
let economyLedger = [];
let notifications = [];
let _cycleCount = 0;
let _currentActivity = null;

// ── Load saved state ──
if (cfg.state.resume) {
  const saved = state.load();
  if (saved && saved.stats) {
    // Merge saved stats (keep startTime from saved)
    const keepKeys = ['startTime', 'mined', 'fished', 'fought', 'kills', 'xp', 'items',
      'soldQuick', 'soldMarket', 'earnedQuick', 'earnedMarket', 'totalRevenue', 'totalItemsSold',
      'pvpWins', 'pvpEarnings', 'propertyEarnings', 'flipProfit', 'cycles',
      'currentNodeIdx', 'currentMonsterIdx', 'socialActions', 'chatsSent'];
    for (const k of keepKeys) {
      if (saved.stats[k] !== undefined) stats[k] = saved.stats[k];
    }
    log(`📂 Resumed: ${stats.cycles} cycles, ${stats.totalRevenue} OTWN earned previously`);
  }
  if (saved && saved.marketAi) {
    market.loadState(saved.marketAi);
    log(`📂 Market AI state restored (${Object.keys(market.ema).length} price EMAs)`);
  }
}

// ════════════════════════════════════════════
// REST API (with fingerprint headers)
// ════════════════════════════════════════════

function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = H.getHeaders(token);
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request({
      hostname: 'owntown.fun', path, method, headers
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function apiGet(path, token) { return apiRequest('GET', path, null, token); }
async function apiPost(path, body, token) { return apiRequest('POST', path, body, token); }

// ════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════

async function authenticate() {
  const wallet = JSON.parse(fs.readFileSync(WALLET_FILE));
  const secretKey = bs58.decode(wallet.private_key);
  const challenge = await apiPost('/api/auth/challenge', { wallet: WALLET_ADDR });
  const nonce = challenge.data.nonce || challenge.data.challenge;
  const message = challenge.data.message || ('owntown_auth:' + nonce);
  const sig = nacl.sign.detached(Buffer.from(message), secretKey);
  const result = await apiPost('/api/auth/verify', { wallet: WALLET_ADDR, nonce, signature: bs58.encode(sig) });
  if (!result.data.token) throw new Error('Auth failed: ' + JSON.stringify(result.data));
  fs.writeFileSync(TOKEN_PATH, result.data.token);
  log('🔑 Authenticated! Token valid until ' + new Date(JSON.parse(Buffer.from(result.data.token.split('.')[1],'base64')).exp*1000).toISOString());
  return result.data.token;
}

function getToken() {
  try { return fs.readFileSync(TOKEN_PATH, 'utf-8').trim(); } catch { return null; }
}

function isTokenExpired(tok) {
  try {
    const payload = JSON.parse(Buffer.from(tok.split('.')[1], 'base64'));
    return Date.now() >= (payload.exp * 1000 - 60000);
  } catch { return true; }
}

let token = getToken();

// ════════════════════════════════════════════
// CRAFTING
// ════════════════════════════════════════════

function tryCraft(sock) {
  for (const [recipeId, recipe] of Object.entries(GEAR_RECIPES)) {
    let canCraft = true;
    for (const [mat, qty] of Object.entries(recipe.needs)) {
      if (!inventory.find(i => i.defId === mat && i.qty >= qty)) { canCraft = false; break; }
    }
    if (canCraft && balance >= recipe.fee) {
      sock.emit('inventory:craft', { recipeId });
      stats.crafted++;
      log(`🔨 Crafting ${recipeId} (fee: ${recipe.fee} OTWN)`);
      return true;
    }
  }
  return false;
}

// ════════════════════════════════════════════
// FOOD / HEALING
// ════════════════════════════════════════════

function tryEatFood(sock) {
  const food = inventory.find(i => i.defId === 'med_patch') ||
               inventory.find(i => i.defId === 'food_ember_skewer') ||
               inventory.find(i => i.defId === 'food_volt_noodles') ||
               inventory.find(i => FOOD_ITEMS.has(i.defId));
  if (food) {
    sock.emit('inventory:use', { instanceId: food.instanceId });
    stats.foodEaten++;
    log(`🍖 Used ${food.defId} for healing`);
    return true;
  }
  return false;
}

function tryClinicHeal(sock) {
  if (zone === 'clinic' && hp < cfg.healHp && balance >= 10) {
    sock.emit('shop:clinicHeal');
    stats.clinicHeals++;
    log(`🏥 Clinic heal at HP:${hp}`);
    return true;
  }
  return false;
}

function tryBuyFood(sock) {
  if (balance >= 50 && zone === 'food_row') {
    const foodCount = inventory.filter(i => FOOD_ITEMS.has(i.defId)).reduce((s,i) => s + i.qty, 0);
    if (foodCount < 5) {
      sock.emit('shop:foodBuy', { defId: 'food_ember_skewer', qty: Math.min(5, Math.floor(balance / 10)) });
      stats.itemsBought++;
      log(`🛒 Buying food from shop`);
      return true;
    }
  }
  return false;
}

// ════════════════════════════════════════════
// BANK
// ════════════════════════════════════════════

async function checkBank(tok) {
  try {
    const res = await apiGet('/api/bank/status', tok);
    if (res.status === 200 && res.data) {
      bankInfo = res.data;
      stats.bankBalance = res.data.withdrawable || 0;
      log(`🏦 Bank: ${res.data.withdrawable?.toFixed(2)} OTWN (min: ${res.data.minWithdraw}, fee: ${res.data.feePercent}%)`);
      return res.data;
    }
  } catch(e) { log(`🏦 Bank check failed: ${e.message}`); }
  return null;
}

async function bankDeposit(sock, amount) {
  if (balance > amount && amount >= 100) {
    sock.emit('bank:deposit', { amount });
    stats.bankDeposits++;
    log(`🏦 Depositing ${amount} OTWN to bank`);
  }
}

async function bankWithdraw(sock, amount) {
  if (bankInfo && bankInfo.withdrawable >= amount && amount >= (bankInfo.minWithdraw || 5000)) {
    sock.emit('bank:withdraw', { amount });
    stats.bankWithdrawals++;
    log(`🏦 Withdrawing ${amount} OTWN from bank`);
  }
}

function checkLedger(sock) { sock.emit('economy:ledger'); }

// ════════════════════════════════════════════
// PvP ARENA
// ════════════════════════════════════════════

function pvpQueue(sock) {
  if (level >= cfg.pvp.minLevel && stamina >= cfg.pvp.minStamina) {
    sock.emit('pvp:queue');
    stats.pvpQueued++;
    log(`⚔️ PvP: Queued for arena`);
    return true;
  }
  log(`⚔️ PvP: Need Lv${cfg.pvp.minLevel}+ and ${cfg.pvp.minStamina}+ stamina (Lv${level} STA:${stamina})`);
  return false;
}

function pvpAttack(sock) { sock.emit('pvp:attack'); stats.pvpFights++; log(`⚔️ PvP: Attacking!`); }
function pvpClaim(sock) { sock.emit('pvp:claim'); log(`⚔️ PvP: Claiming rewards`); }
function pvpLeave(sock) { sock.emit('pvp:leave'); log(`⚔️ PvP: Left arena`); }

// ════════════════════════════════════════════
// PROPERTY / VEHICLE / WORLD BOSS / PORTAL
// ════════════════════════════════════════════

function checkProperty(sock) { sock.emit('property:info', {}); }
function propertyBuy(sock, propertyId) { sock.emit('property:buy', { propertyId }); stats.propertyBought++; log(`🏠 Buying property ${propertyId}`); }
function propertySell(sock, propertyId, price) { sock.emit('property:sell', { propertyId, price }); log(`🏠 Listing property ${propertyId} @${price}`); }

function vehicleBuy(sock, defId) {
  if (balance >= 500) { sock.emit('vehicle:buy', { defId }); stats.vehiclesBought++; log(`🚗 Buying vehicle ${defId}`); }
}

function handleWorldBoss(sock) {
  if (worldBossState && worldBossState.phase === 'active' && !stats.worldBossActive) {
    stats.worldBossActive = true;
    log(`👹 WORLD BOSS ACTIVE! Entering...`);
    sock.emit('worldboss:enter');
  }
}

function claimBoss(sock) { sock.emit('worldboss:claim'); stats.bossClaims++; log(`🏆 Claiming world boss reward`); }
function leaveBoss(sock) { sock.emit('worldboss:leave'); stats.worldBossActive = false; log(`👹 Left world boss`); }
function enterPortal(sock) { sock.emit('portal:enter'); stats.portalEntries++; log(`🌀 Entering portal`); }

async function updateProfile(tok) {
  try {
    const res = await apiPost('/api/profile', { name: cfg.playerName }, tok);
    if (res.status === 200) log(`👤 Profile updated`);
  } catch {}
}

// ════════════════════════════════════════════
// WALKING (ANTI-DETECT ENHANCED)
// ════════════════════════════════════════════

function walkStaged(sock, wps, idx, cb) {
  if (!connected) return;
  if (idx >= wps.length) { cb(); return; }
  const wp = wps[idx];
  const jit = H.pathJitter(1.2);
  const targetX = wp.x + jit.dx;
  const targetZ = wp.z + jit.dz;
  log(`  WP${idx+1}/${wps.length}:(${wp.x},${wp.z}) from(${pos.x.toFixed(1)},${pos.z.toFixed(1)})`);
  let step = 0;
  function stepOnce() {
    if (!connected) return;
    const dx = targetX - pos.x, dz = targetZ - pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 2 || step >= MAX_WALK_STEPS) {
      if (step > 0) log(`  Arrived WP${idx+1} zone:${zone} steps:${step}`);
      const idleCount = H.randInt(1, 3);
      for (let i = 0; i < idleCount; i++) {
        sock.emit('player:input', {pos:{x:targetX,y:0,z:targetZ},rotY:H.gauss(0, 0.3),anim:H.randomIdleAnim()});
      }
      const pause = H.humanDelay(800, 0.4, 0.1);
      setTimeout(() => walkStaged(sock, wps, idx+1, cb), pause);
      return;
    }
    const speed = H.speedVariance(WALK_SPEED);
    pos.x += (dx/dist) * speed;
    pos.z += (dz/dist) * speed;
    const anim = (H.rand() < 0.04) ? 'idle' : 'walk';
    sock.emit('player:input', {pos:{x:pos.x,y:0,z:pos.z},rotY:Math.atan2(dx,dz) + H.gauss(0, 0.05),anim});
    step++;
    setTimeout(stepOnce, H.tickInterval(100));
  }
  stepOnce();
}

function walkToZone(sock, zoneName, cb) {
  const target = ZONE_TARGETS[zoneName];
  if (!target) { cb(); return; }
  const jit = H.pathJitter(2.0);
  const targetX = target.x + jit.dx;
  const targetZ = target.z + jit.dz;
  log(`  Walk to ${zoneName}:(${target.x},${target.z})`);
  let step = 0;
  function stepOnce() {
    if (!connected) return;
    const dx = targetX - pos.x, dz = targetZ - pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 3 || step >= MAX_WALK_STEPS) {
      if (step > 0) log(`  Arrived ${zoneName} zone:${zone} steps:${step}`);
      const idleCount = H.randInt(1, 3);
      for (let i = 0; i < idleCount; i++) {
        sock.emit('player:input', {pos:{x:targetX,y:0,z:targetZ},rotY:H.gauss(0, 0.3),anim:H.randomIdleAnim()});
      }
      setTimeout(cb, H.humanDelay(600, 0.3, 0.1));
      return;
    }
    const speed = H.speedVariance(WALK_SPEED);
    pos.x += (dx/dist) * speed;
    pos.z += (dz/dist) * speed;
    const anim = (H.rand() < 0.04) ? 'idle' : 'walk';
    sock.emit('player:input', {pos:{x:pos.x,y:0,z:pos.z},rotY:Math.atan2(dx,dz) + H.gauss(0, 0.05),anim});
    step++;
    setTimeout(stepOnce, H.tickInterval(100));
  }
  stepOnce();
}

// ════════════════════════════════════════════
// SELL LOGIC (Market AI integrated)
// ════════════════════════════════════════════

function sellPhase(sock, cb) {
  log(`🏪 SELL PHASE — inv:${inventory.length}/${cfg.carryCap}`);
  sock.emit('marketplace:list');

  setTimeout(() => {
    let acted = false;
    const toSell = inventory.filter(i => QUICKSELL[i.defId] || PRICE_FLOOR[i.defId]);

    for (const item of toSell) {
      const isMarketOnly = MARKETPLACE_ONLY.has(item.defId);
      const decision = market.getSellDecision(
        item.defId, item.qty,
        PRICE_FLOOR[item.defId], QUICKSELL[item.defId],
        isMarketOnly
      );

      if (decision.action === 'QUICKSELL') {
        sock.emit('marketplace:quickSell', { instanceId: item.instanceId });
        acted = true;
      } else if (decision.action === 'MARKETPLACE') {
        const existingListing = myActiveListings.find(l => l.defId === item.defId);
        if (existingListing) {
          sock.emit('marketplace:cancel', { listingId: existingListing.id });
          stats.canceled++;
        }
        sock.emit('marketplace:listItem', { instanceId: item.instanceId, price: decision.price * item.qty });
        stats.listed++;
        acted = true;
      } else if (decision.action === 'HOLD') {
        stats.holdCount++;
        stats.holdValue += (PRICE_FLOOR[item.defId] || 1) * item.qty;
        if (cfg.log.level === 'debug') log(`  📦 HOLD ${item.defId} x${item.qty}: ${decision.reason}`);
      }
    }

    // Try crafting with remaining mats
    tryCraft(sock);

    // Check flip opportunities
    if (Date.now() - lastFlipTime > cfg.flipCooldownMs) {
      // Flip check happens on marketplace:list response
    }

    setTimeout(cb, H.humanDelay(acted ? 3000 : 1000, 0.3, 0.1));
  }, H.humanDelay(2000, 0.3, 0.1));
}

let lastFlipTime = 0;

// ════════════════════════════════════════════
// ACTIONS (HUMANIZED + PRIORITY FARMING)
// ════════════════════════════════════════════

function doActions(sock, type) {
  const cfgKey = type === 'mining' ? cfg.mining :
                 type === 'fishing' ? cfg.fishing :
                 type === 'combat' ? cfg.combat : cfg.pvp;

  const currentNode = MINING_NODES[stats.currentNodeIdx % MINING_NODES.length];
  const currentMon = MONSTERS[stats.currentMonsterIdx % MONSTERS.length];

  let count = 0;
  stats.cycles++;

  // Track activity for priority farming
  market.startActivity(type);

  // Time-of-day intensity scaling
  const todMult = H.timeOfDayMultiplier(H.getCurrentHour());
  const baseMult = todMult * (0.9 + H.rand() * 0.2);

  log(`Start ${type} (max ${cfgKey.count}) zone:${zone} ${type==='combat'?'mon:'+currentMon.id:''} ${type==='mining'?'node:'+currentNode.id:''} (intensity:${baseMult.toFixed(2)})`);

  function actionTick() {
    if (!connected) return;
    if (count >= cfgKey.count) {
      if (type === 'mining') {
        stats.currentNodeIdx = (stats.currentNodeIdx + 1) % MINING_NODES.length;
        log(`⛏ Rotated to node: ${MINING_NODES[stats.currentNodeIdx].id}`);
      }
      if (type === 'combat') {
        stats.currentMonsterIdx = (stats.currentMonsterIdx + 1) % MONSTERS.length;
        log(`⚔ Rotated to monster: ${MONSTERS[stats.currentMonsterIdx].id}`);
      }
      market.endActivity(type, 0); // actual earnings tracked via recordSale
      setTimeout(() => {
        log(`📊 ${type}:⛏${stats.mined} 🎣${stats.fished} ⚔${stats.kills} +${stats.xp}XP Lv${level} Bal:${balance.toFixed(2)}`);
        setTimeout(() => runNextCycle(sock), H.humanDelay(2500, 0.3, 0.1));
      }, H.humanDelay(1500, 0.3, 0.1));
      return;
    }

    if (stats.consecutiveErrors >= 3) {
      log(`⚠️ err skip`);
      stats.consecutiveErrors = 0;
      market.endActivity(type, 0);
      setTimeout(() => runNextCycle(sock), H.humanDelay(2000, 0.3, 0.1));
      return;
    }

    count++;

    // Fatigue check
    if (stamina <= 10) {
      stats.fatigueDrops++;
      log(`😴 Low stamina (${stamina}), resting...`);
      stats.restCount++;
      market.endActivity(type, 0);
      setTimeout(() => runNextCycle(sock), H.humanDelay(30000, 0.3, 0.1));
      return;
    }

    // HP check — eat food if low (with reaction time)
    if (hp < cfg.healHp) {
      setTimeout(() => tryEatFood(sock), H.reactionTime());
    }

    // Critical HP — abort
    if (hp < cfg.lowHp && type === 'combat') {
      market.endActivity(type, 0);
      log(`❤️ Critical HP! Aborting combat.`);
      walkToZone(sock, 'clinic', () => { tryClinicHeal(sock); setTimeout(() => runNextCycle(sock), H.humanDelay(3000, 0.3, 0.1)); });
      return;
    }

    if (type === 'mining') {
      // Occasional miss: skip the action to look human
      if (!H.shouldSkipAction(cfg.antiDetect.actionSkipChance)) {
        sock.emit('mining:start', { nodeId: currentNode.id });
      } else {
        H.bumpStat('skippedActions');
      }
    } else if (type === 'fishing') {
      if (!fishingActive) {
        sock.emit('fishing:cast');
        fishingActive = true;
        setTimeout(() => {
          if (fishingActive) { fishingActive = false; stats.fishingTimeouts++; }
        }, cfg.fishing.timeout);
      }
    } else if (type === 'combat') {
      if (!H.shouldSkipAction(cfg.antiDetect.actionSkipChance)) {
        sock.emit('combat:attack', { monsterId: currentMon.id });
      } else {
        H.bumpStat('skippedActions');
      }
    }

    // Humanized next-interval: base * time-of-day * Gaussian jitter
    let nextInterval = H.humanDelay(cfgKey.interval, 0.22, 0.06) * baseMult;
    nextInterval += H.shortBreak(0.03);
    // Rare long break
    if (H.rand() < 0.015) {
      nextInterval += H.jitter(H.randInt(1000, 3000), 0.3);
      H.bumpStat('longBreaks');
    }
    setTimeout(actionTick, Math.max(200, Math.round(nextInterval)));
  }
  actionTick();
}

// ════════════════════════════════════════════
// CYCLE (PRIORITY FARMING + SOCIAL BEHAVIOR)
// ════════════════════════════════════════════

function runNextCycle(sock) {
  if (!connected) return;
  if (!token || isTokenExpired(token)) {
    log('🔑 Token expired, re-authenticating...');
    authenticate().then(t => { token = t; setTimeout(() => runNextCycle(sock), 5000); }).catch(e => { log(`Auth failed: ${e.message}`); setTimeout(startBot, 5000); });
    return;
  }

  // Session break check — disconnect and come back later (fixed bug from v23.3)
  if (H.sessionExpired()) {
    const breakMs = H.takeSessionBreak();
    const sessionInfo = H.getSessionInfo();
    log(`💤 Session expired. Taking break for ${Math.round(breakMs/60000)} min...`);
    H.bumpStat('sessionsCompleted');
    notifier.sendSessionBreak(breakMs, sessionInfo);
    // Actually disconnect (v25 fix: proper session break)
    sock.disconnect();
    H.newSession();
    H.generateFingerprint(); // New fingerprint per session!
    log(`🎭 New fingerprint: ${H.getFingerprint().ua.substring(0, 40)}...`);
    setTimeout(startBot, breakMs);
    return;
  }

  // Healing checks with reaction time
  if (hp < cfg.healHp) {
    setTimeout(() => tryEatFood(sock), H.reactionTime());
  }
  if (hp < cfg.lowHp) {
    walkToZone(sock, 'clinic', () => {
      setTimeout(() => tryClinicHeal(sock), H.reactionTime());
      setTimeout(() => runNextCycle(sock), H.humanDelay(3000, 0.3, 0.1));
    });
    return;
  }

  // World boss check
  handleWorldBoss(sock);

  _cycleCount++;

  // ── Social behavior (v25 NEW) ──
  if (cfg.antiDetect.socialEnabled) {
    const socialAction = H.pickSocialAction(cfg.antiDetect.socialChance);
    if (socialAction) {
      stats.socialActions++;
      H.bumpStat('socialActions');

      if (socialAction === 'check_ledger') {
        log(`👀 [Social] Checking ledger`);
        checkLedger(sock);
      } else if (socialAction === 'check_bank') {
        log(`👀 [Social] Checking bank`);
        checkBank(token).catch(() => {});
      } else if (socialAction === 'check_property') {
        log(`👀 [Social] Checking property`);
        checkProperty(sock);
      } else if (socialAction === 'check_profile') {
        log(`👀 [Social] Updating profile`);
        updateProfile(token).catch(() => {});
      } else if (socialAction === 'browse_market') {
        log(`👀 [Social] Browsing market`);
        sock.emit('marketplace:list');
      } else if (socialAction === 'check_leaderboard') {
        log(`👀 [Social] Checking leaderboard`);
        sock.emit('leaderboard:get', { type: 'earnings' });
      } else if (socialAction === 'emote') {
        const emote = H.pickEmote();
        log(`👀 [Social] Emote: ${emote}`);
        sock.emit('player:input', { pos:{x:pos.x,y:0,z:pos.z}, rotY:H.gauss(0, 0.5), anim: emote });
      } else if (socialAction === 'look_around') {
        log(`👀 [Social] Looking around`);
        // Send a few idle inputs with rotation
        for (let i = 0; i < H.randInt(2, 4); i++) {
          setTimeout(() => {
            sock.emit('player:input', { pos:{x:pos.x,y:0,z:pos.z}, rotY:H.gauss(0, 1.5), anim:H.randomIdleAnim() });
          }, i * H.jitter(800, 0.3));
        }
      } else if (socialAction === 'idle_browse') {
        log(`👀 [Social] Idle browsing`);
        sock.emit('player:input', { pos:{x:pos.x,y:0,z:pos.z}, rotY:H.gauss(0, 0.5), anim:'idle' });
      }

      // Chat simulation (rare, configurable)
      if (cfg.antiDetect.chatEnabled && H.rand() < 0.02) {
        const msg = H.pickChatMessage();
        const typingMs = H.typingDelay(msg);
        log(`💬 [Social] Typing "${msg}" (${typingMs}ms)`);
        setTimeout(() => {
          sock.emit('chat:send', { message: msg });
          stats.chatsSent++;
        }, typingMs);
      }
    }

    // Distraction walk (very rare — walk to random nearby spot)
    const distraction = H.distractionWalk();
    if (distraction) {
      H.bumpStat('distractions');
      log(`🚶 [Social] Distraction walk`);
      const dx = pos.x + distraction.offset.dx;
      const dz = pos.z + distraction.offset.dz;
      walkStaged(sock, [{ x: dx, z: dz }, { x: pos.x, z: pos.z }], 0, () => {
        setTimeout(() => runNextCycle(sock), distraction.pauseMs);
      });
      return;
    }
  }

  // ── Priority farming (v25 NEW) ──
  let order;
  const priority = market.getBestActivity();

  if (cfg.priorityFarming.enabled && priority && _cycleCount > 10) {
    // Weight cycle order toward most profitable activity
    const best = priority.recommended;
    log(`🎯 Priority: ${priority.ranking.map(r => `${r.type}:${r.rate}/h`).join(' ')}`);

    // Build weighted order: best activity appears 3x
    order = ['sell', best, best, best, 'fishing', 'combat', 'pvp', 'mining'];
    // Reshuffle non-sell portion every 8 cycles
    if (_cycleCount % 8 === 0) {
      const nonSell = H.shuffle(order.slice(1));
      order = ['sell', ...nonSell];
    }
  } else {
    // Default balanced order, reshuffle periodically
    if (_cycleCount % 8 === 0) {
      order = ['sell', ...H.shuffle(['mining', 'fishing', 'combat', 'pvp', 'mining', 'fishing', 'combat'])];
    } else {
      order = ['sell', 'mining', 'fishing', 'combat', 'pvp', 'mining', 'fishing', 'combat'];
    }
  }

  const type = order[(_cycleCount - 1) % order.length];

  // Sell phase
  if (type === 'sell') {
    if (inventory.length >= cfg.carryCap * 0.75 || _cycleCount % 8 === 1) {
      sellPhase(sock, () => runNextCycle(sock));
      return;
    }
    // Skip sell if inventory not full enough
    setTimeout(() => runNextCycle(sock), H.humanDelay(500, 0.3, 0.1));
    return;
  }

  // PvP
  if (type === 'pvp') {
    if (level >= cfg.pvp.minLevel) {
      walkToZone(sock, 'arena', () => {
        if (pvpQueue(sock)) {
          setTimeout(() => {
            pvpAttack(sock);
            setTimeout(() => {
              pvpClaim(sock);
              setTimeout(() => {
                pvpLeave(sock);
                setTimeout(() => runNextCycle(sock), H.humanDelay(2000, 0.3, 0.1));
              }, H.humanDelay(2000, 0.3, 0.1));
            }, H.humanDelay(3000, 0.3, 0.1));
          }, H.humanDelay(2000, 0.3, 0.1));
        } else {
          setTimeout(() => runNextCycle(sock), H.humanDelay(2000, 0.3, 0.1));
        }
      });
      return;
    }
    // Skip PvP if level too low
    setTimeout(() => runNextCycle(sock), H.humanDelay(500, 0.3, 0.1));
    return;
  }

  // Navigate to zone
  const expectedZone = EXPECTED_ZONE[type];
  if (expectedZone && zone !== expectedZone) {
    stats.wrongZone++;
    const target = type === 'mining' ? MINING_NODES[stats.currentNodeIdx % MINING_NODES.length].pos :
                   type === 'fishing' ? { x: -148.5, z: 0 } :
                   type === 'combat' ? MONSTERS[stats.currentMonsterIdx % MONSTERS.length].pos :
                   ZONE_TARGETS[expectedZone];

    if (type === 'fishing') {
      const wps = WAYPOINTS_BASE.fishing;
      walkStaged(sock, wps, 0, () => {
        _currentActivity = type;
        doActions(sock, type);
      });
    } else {
      walkToZone(sock, expectedZone, () => {
        _currentActivity = type;
        doActions(sock, type);
      });
    }
    return;
  }

  _currentActivity = type;
  doActions(sock, type);
}

// ════════════════════════════════════════════
// SOCKET EVENTS
// ════════════════════════════════════════════

function recordSale(defId, qty, method, price) {
  const total = price * qty;
  stats.totalRevenue += total;
  stats.totalItemsSold += qty;
  if (method === 'quickSell') { stats.soldQuick += qty; stats.earnedQuick += total; }
  else { stats.soldMarket += qty; stats.earnedMarket += total; }
  market.recordSale(defId, qty, method, price, _currentActivity);
  log(`💰 ${method==='quickSell'?'QS':'MKT'} ${defId} x${qty} @${price} = ${total} OTWN`);
}

function getProfitSummary() {
  const mins = Math.floor((Date.now() - stats.startTime) / 60000);
  const hours = mins / 60;
  const totalEarned = stats.earnedQuick + stats.earnedMarket + stats.pvpEarnings + stats.propertyEarnings;
  const rate = hours > 0 ? Math.round(totalEarned / hours) : 0;
  let heldValue = 0;
  for (const item of inventory) {
    const floor = PRICE_FLOOR[item.defId] || QUICKSELL[item.defId] || 1;
    heldValue += floor * item.qty;
  }
  const priority = market.getBestActivity();
  return { totalEarned, rate, heldValue, qsEarned: stats.earnedQuick, mktEarned: stats.earnedMarket, itemsSold: stats.totalItemsSold, holdCount: stats.holdCount, hours: hours.toFixed(1), priority };
}

function startBot() {
  log('🚀 Starting bot...');
  (async () => {
    try {
      if (!token || isTokenExpired(token)) {
        token = await authenticate();
      }
    } catch(e) {
      log(`❌ Auth error: ${e.message}`);
      notifier.sendError(`Auth failed: ${e.message}`);
      setTimeout(startBot, H.humanDelay(10000, 0.3, 0.1));
      return;
    }

    // Cleanup old socket
    if (global._activeSocket) {
      try { global._activeSocket.removeAllListeners(); global._activeSocket.disconnect(); } catch {}
      global._activeSocket = null;
    }

    const fp = H.getFingerprint();
    const socket = io(cfg.serverUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: {
        'User-Agent': fp.ua,
        'Accept-Language': fp.lang,
      },
    });
    global._activeSocket = socket;

    // ── Game events ──
    socket.on('player:state', (d) => {
      if (d.balance !== undefined) { balance = d.balance; stats.balance = balance; }
      if (d.level !== undefined) {
        const oldLevel = level;
        level = d.level;
        stats.level = level;
        if (level > oldLevel) notifier.sendMilestone('level', level);
      }
      if (d.stamina !== undefined) { stamina = d.stamina; stats.stamina = stamina; }
      if (d.hp !== undefined) { hp = d.hp; stats.hp = hp; }
      if (d.maxHp !== undefined) { maxHp = d.maxHp; stats.maxHp = maxHp; }
      if (d.zone) zone = d.zone;
      if (d.dailyEarned !== undefined) dailyEarned = d.dailyEarned;
      if (d.fatigue !== undefined) fatigueMultiplier = d.fatigue;
    });

    socket.on('player:correction', (d) => {
      if (d.pos) { pos.x = d.pos.x; pos.z = d.pos.z; }
      if (d.zone) zone = d.zone;
    });

    socket.on('inventory:update', (d) => {
      if (d.items) { inventory = d.items; inventoryReady = true; stats.invCount = inventory.length; }
    });

    socket.on('mining:result', (d) => {
      if (d.ok) { stats.mined++; stats.xp += d.xp || 0; if (d.item) stats.items++; }
      else stats.errors++;
    });

    socket.on('fishing:result', (d) => {
      fishingActive = false;
      if (d.ok) { stats.fished++; stats.xp += d.xp || 0; if (d.item) stats.items++; }
    });

    socket.on('combat:result', (d) => {
      stats.fought++;
      if (d.killed) { stats.kills++; stats.xp += d.xp || 0; if (d.loot) stats.items += d.loot.length || 0; }
      if (d.damage) { hp = Math.max(0, hp - (d.damageTaken || 0)); }
    });

    socket.on('pvp:result', (d) => {
      if (d.won) { stats.pvpWins++; }
      if (d.reward) { stats.pvpClaims++; stats.pvpEarnings += d.reward; }
    });

    socket.on('worldboss:result', (d) => {
      if (d.phase) worldBossState = d;
      if (d.reward) { stats.bossClaims++; }
    });

    socket.on('property:result', (d) => {
      if (d.sold && d.price) { stats.propertySold++; stats.propertyEarnings += d.price; }
    });

    socket.on('economy:ledger', (d) => {
      if (d.entries) economyLedger = d.entries;
    });

    socket.on('bank:result', (d) => {
      if (d.balance !== undefined) stats.bankBalance = d.balance;
    });

    socket.on('notification:new', (d) => {
      notifications.push(d);
      stats.notifications++;
      if (d.type === 'pvp_challenge' || d.type === 'boss_spawn') {
        log(`🔔 Notif: ${d.type} — ${d.message || ''}`);
      }
    });

    socket.on('ads:update', (d) => {
      if (d.ads) log(`📢 Ads update: ${d.ads.length} ads`);
    });

    socket.on('chat:message', () => {}); // Silent
    socket.on('chat:history', (d) => {
      if (d.messages) log(`💬 Chat history: ${d.messages.length} messages`);
    });

    socket.on('inventory:craft', (d) => { stats.crafted++; log(`🔨 Crafted: ${JSON.stringify(d).substring(0, 100)}`); });
    socket.on('inventory:repair', () => { log('🔧 Repaired!'); });

    // Marketplace results
    socket.on('marketplace:result', (d) => {
      if (d.ok) {
        if (d.action === 'cancel') { stats.canceled++; }
        else if (d.credited) {
          const defId = d.defId || d.itemId || 'quicksell';
          const qty = d.count || d.qty || 1;
          recordSale(defId, qty, 'quickSell', d.credited);
        }
        if (d.action === 'buy' && d.listingId) {
          stats.itemsBought++;
          log(`🛒 Bought listing ${d.listingId}`);
        }
      } else {
        log(`💰 Fail: ${d.code || d.message}`);
      }

      // Market AI: scan listings for prices + flip opportunities
      if (d.listings) {
        market.scanListings(d.listings);
        myActiveListings = d.listings.filter(l => l.sellerPlayerId === MY_PLAYER_ID);

        // Check flip opportunities
        if (Date.now() - lastFlipTime > cfg.flipCooldownMs) {
          const flips = market.findFlipOpportunities(d.listings, balance, MY_PLAYER_ID);
          if (flips.length > 0) {
            const best = flips[0];
            log(`🔄 FLIP: ${best.listing.defId} x${best.listing.qty} @${best.listing.price} (profit:${best.profit} ROI:${(best.roi*100).toFixed(0)}%)`);
            socket.emit('marketplace:buy', { listingId: best.listing.id });
            stats.itemsFlipped++;
            stats.flipProfit += best.profit;
            lastFlipTime = Date.now();
          }
        }
      }
    });

    socket.on('marketplace:quickSell:result', (d) => {
      if (d.credited) {
        const defId = d.defId || d.itemId || 'quicksell';
        const qty = d.count || d.qty || 1;
        recordSale(defId, qty, 'quickSell', d.credited);
      }
    });

    ['marketplace:list:result', 'marketplace:listed'].forEach(evt => {
      socket.on(evt, (d) => { stats.listed++; log(`📋 Listed! ${JSON.stringify(d).substring(0, 100)}`); });
    });

    socket.on('marketplace:sellAll:result', (d) => {
      if (d.credited) recordSale('sellAll-bulk', d.count || d.items || 1, 'quickSell', d.credited);
      if (d.items && Array.isArray(d.items)) {
        for (const item of d.items) {
          if (item.credited) recordSale(item.defId || 'item', item.qty || 1, 'quickSell', item.credited);
        }
      }
    });

    // Toast tracker
    socket.on('toast', (d) => {
      if (d.kind === 'success') {
        const msg = (d.message || '').toLowerCase();
        if (msg.includes('sold') || msg.includes('received')) {
          const m = d.message.match(/(\d[\d,]*)\s*\$?OTWN/);
          if (m) {
            const amount = parseInt(m[1].replace(/,/g, ''));
            if (amount > 0) recordSale('toast-sale', 1, 'marketplace', amount);
          }
        }
        if (msg.includes('pvp') || msg.includes('arena')) log(`⚔️ PvP toast: ${d.message}`);
        if (msg.includes('property') || msg.includes('house')) log(`🏠 Property toast: ${d.message}`);
      }
    });

    // ── Connection ──
    let disconnectTimer = null;
    let lastConnectTime = 0;
    let disconnectCount = 0;

    socket.on('connect', () => {
      connected = true;
      const now = Date.now();
      const timeSinceLastConnect = now - lastConnectTime;
      lastConnectTime = now;
      disconnectCount = 0;
      if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
      log('✅ Connected!');

      const connectDelay = timeSinceLastConnect < 10000 ? H.humanDelay(5000, 0.4, 0.1) : H.humanDelay(1000, 0.5, 0.1);

      setTimeout(() => {
        let started = false;
        socket.on('player:correction', function onCorr(d) {
          if (!started && d.pos) {
            pos.x = d.pos.x; pos.z = d.pos.z; started = true;
            socket.removeListener('player:correction', onCorr);
            log(`Pos:(${pos.x.toFixed(1)},${pos.z.toFixed(1)}) zone:${zone}`);
            waitForInventory(socket, () => {
              checkLedger(socket);
              checkBank(token);
              runNextCycle(socket);
            });
          }
        });
        setTimeout(() => {
          if (!started) {
            started = true;
            waitForInventory(socket, () => runNextCycle(socket));
          }
        }, 3000);
      }, connectDelay);
    });

    socket.on('disconnect', () => {
      log('⚠️ Disconnected!');
      connected = false;
      disconnectCount++;
      try { socket.removeAllListeners(); } catch {}
      const baseDelay = Math.min(30000, 5000 * Math.pow(2, disconnectCount - 1));
      const delay = Math.round(H.humanDelay(baseDelay, 0.3, 0.05));
      log(`⚠️ Reconnecting in ${Math.round(delay/1000)}s (attempt ${disconnectCount})...`);
      notifier.sendError(`Disconnected (attempt ${disconnectCount})`);
      disconnectTimer = setTimeout(() => { startBot(); }, delay);
    });

    socket.on('connect_error', (err) => {
      if (err.message === 'BAD_TOKEN' || err.message === 'NO_TOKEN') {
        log('🔑 Token invalid, re-authenticating...');
        token = null;
        socket.disconnect();
        setTimeout(startBot, H.humanDelay(2000, 0.3, 0.1));
      }
    });

    function waitForInventory(sock, cb) {
      if (inventoryReady) { cb(); return; }
      log('⏳ Wait inv...');
      let w = 0;
      const iv = setInterval(() => {
        w += 500;
        if (inventoryReady || w > 5000) { clearInterval(iv); cb(); }
      }, 500);
    }
  })();
}

// ════════════════════════════════════════════
// STATE PERSISTENCE + AUTO-SAVE
// ════════════════════════════════════════════

function getFullState() {
  return {
    stats: { ...stats },
    marketAi: market.getState(),
    session: H.getSessionInfo(),
    humanize: H.getStats(),
    fingerprint: H.getFingerprint().sessionId,
    pos: { ...pos },
    zone,
    balance,
    level,
  };
}

state.startAutoSave(getFullState, cfg.state.saveInterval);

// ════════════════════════════════════════════
// PROFIT REPORT (10 min interval)
// ════════════════════════════════════════════

setInterval(() => {
  const p = getProfitSummary();
  const fishItems = inventory.filter(i => i.defId.startsWith('fish_'));
  const matItems = inventory.filter(i => i.defId.startsWith('mat_'));
  const fishValue = fishItems.reduce((s,i) => s + (PRICE_FLOOR[i.defId]||1) * i.qty, 0);
  const matValue = matItems.reduce((s,i) => s + (PRICE_FLOOR[i.defId]||1) * i.qty, 0);

  log(`\n📊 ══ [${p.hours}h] PROFIT REPORT v25 ══`);
  log(`⛏${stats.mined} 🎣${stats.fished} ⚔${stats.kills} | Lv${level} XP${stats.xp}`);
  log(`💰 QS:+${stats.earnedQuick} MKT:+${stats.earnedMarket} PvP:+${stats.pvpEarnings} Total:${p.totalEarned}`);
  log(`💵 Rate: ${p.rate}/h | Sold: ${p.itemsSold} items`);
  log(`📦 ${inventory.length}/${cfg.carryCap} stacks`);
  log(`🐟 Fish: ${fishItems.length} (~${fishValue}) | 🧱 Mats: ${matItems.length} (~${matValue})`);
  log(`⏸️ Held: ${stats.holdCount} (~${stats.holdValue})`);
  log(`💰 Bal:${balance.toFixed(2)} | Daily:${dailyEarned}/${cfg.dailyEarnCap}`);
  log(`❤️ HP:${hp}/${maxHp} | STA:${stamina}`);
  log(`⚔️ PvP: ${stats.pvpFights}f ${stats.pvpWins}w ${stats.pvpClaims}c +${stats.pvpEarnings}`);
  log(`🏠 Prop: ${stats.propertyBought}b ${stats.propertySold}s +${stats.propertyEarnings}`);
  log(`🏦 Bank: bal:${stats.bankBalance} dep:${stats.bankDeposits} wd:${stats.bankWithdrawals}`);
  log(`👹 Boss:${stats.bossClaims} | 🔨 Craft:${stats.crafted} | 🍖 Food:${stats.foodEaten} | 🏥 Heal:${stats.clinicHeals}`);
  log(`🛒 Flip: ${stats.itemsFlipped} (+${stats.flipProfit}) | 🔔 Notif:${stats.notifications}`);
  log(`🔧 Zone:${stats.wrongZone} FishTO:${stats.fishingTimeouts} Fatigue:${stats.fatigueDrops} Rests:${stats.restCount}`);
  log(`📍 Node:${MINING_NODES[stats.currentNodeIdx%MINING_NODES.length].id} | Mon:${MONSTERS[stats.currentMonsterIdx%MONSTERS.length].id}`);

  // Market AI report
  if (cfg.marketAi.enabled) {
    const report = market.getReport();
    const priceLog = report.items.slice(0, 10).map(i => {
      const icon = i.trend === 'rising' ? '📈' : i.trend === 'falling' ? '📉' : '➡️';
      return `${i.defId.replace('mat_','').replace('fish_','')}:${i.price}(ema:${i.ema})${icon}`;
    }).join(' ');
    log(`📈 Market AI: ${priceLog}`);
    if (report.priority) {
      log(`🎯 Priority: ${report.priority.ranking.map(r => `${r.type}:${r.rate}/h`).join(' ')}`);
    }
  }

  const hs = H.getStats();
  log(`🎭 Anti-detect: social=${stats.socialActions} skip=${hs.skippedActions||0} sessions=${hs.sessionsCompleted||0} fp=${H.getFingerprint().sessionId.substring(0,8)}`);
  log(`══════════════════\n`);

  // Send notification
  notifier.sendProfitReport(
    { ...stats, balance, level, hp, maxHp, stamina, invCount: inventory.length },
    p
  );
}, 600000);

// ════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ════════════════════════════════════════════

function shutdown(signal) {
  log(`\n🛑 Shutting down (${signal})...`);
  state.shutdown(getFullState);
  notifier.send(`Bot stopped (${signal})`, 'warning');
  if (global._activeSocket) {
    try { global._activeSocket.disconnect(); } catch {}
  }
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  log(`❌ Uncaught: ${err.message}\n${err.stack}`);
  notifier.sendError(`Uncaught: ${err.message}`);
  state.save(getFullState());
});
process.on('unhandledRejection', (reason) => {
  log(`❌ Unhandled rejection: ${reason}`);
});

// ════════════════════════════════════════════
// START
// ════════════════════════════════════════════

log('🚀 Starting v25 — Full Featured + Smart Market AI + Priority Farming + Enhanced Anti-Detect...');
startBot();
