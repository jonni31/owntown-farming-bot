// notifier.js v25 — Telegram + Webhook notifications
const https = require('https');
const http = require('http');
const cfg = require('./config');

class Notifier {
  constructor() {
    this.lastNotify = 0;
    this.queue = [];
    this.errorCount = 0;
  }

  // ── Telegram ──
  async sendTelegram(text) {
    if (!cfg.notify.telegram.enabled || !cfg.notify.telegram.botToken || !cfg.notify.telegram.chatId) return;

    const payload = JSON.stringify({
      chat_id: cfg.notify.telegram.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${cfg.notify.telegram.botToken}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const r = JSON.parse(d);
            if (r.ok) resolve(r);
            else reject(new Error(r.description || 'Telegram error'));
          } catch { resolve(d); }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  // ── Webhook (Discord / custom) ──
  async sendWebhook(data) {
    if (!cfg.notify.webhook.enabled || !cfg.notify.webhook.url) return;

    const url = new URL(cfg.notify.webhook.url);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const payload = JSON.stringify(typeof data === 'string' ? { content: data } : data);

    return new Promise((resolve, reject) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(d));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  // ── Unified send ──
  async send(message, type = 'info') {
    const prefix = {
      info: 'ℹ️', profit: '💰', error: '🚨', warning: '⚠️',
      session: '🎮', milestone: '🏆',
    }[type] || 'ℹ️';

    const text = `${prefix} <b>OWNTOWN BOT</b>\n${message}`;

    const promises = [];
    if (cfg.notify.telegram.enabled) promises.push(this.sendTelegram(text).catch(e => console.error(`[NOTIF] Telegram error: ${e.message}`)));
    if (cfg.notify.webhook.enabled) promises.push(this.sendWebhook({ content: `${prefix} **OWNTOWN BOT**\n${message}` }).catch(e => console.error(`[NOTIF] Webhook error: ${e.message}`)));

    if (promises.length > 0) await Promise.allSettled(promises);
  }

  // ── Throttled profit report ──
  async sendProfitReport(stats, summary) {
    const now = Date.now();
    if (now - this.lastNotify < cfg.notify.intervalMs) return;
    this.lastNotify = now;

    const msg = [
      `<b>📊 Profit Report (${summary.hours}h)</b>`,
      `⛏${stats.mined} 🎣${stats.fished} ⚔${stats.kills} | Lv${stats.level}`,
      `💰 Total: ${summary.totalEarned} OTWN (${summary.rate}/h)`,
      `  QS: +${stats.earnedQuick} | MKT: +${stats.earnedMarket}`,
      `  PvP: +${stats.pvpEarnings} | Prop: +${stats.propertyEarnings}`,
      `💵 Balance: ${stats.balance?.toFixed(2)}`,
      `📦 Inventory: ${stats.invCount}/${cfg.carryCap}`,
      `❤️ HP: ${stats.hp}/${stats.maxHp} | STA: ${stats.stamina}`,
      summary.priority ? `🎯 Best: ${summary.priority.recommended} (${summary.priority.rates[summary.priority.recommended]}/h)` : '',
    ].filter(Boolean).join('\n');

    await this.send(msg, 'profit');
  }

  // ── Error notification ──
  async sendError(error) {
    if (!cfg.notify.onError) return;
    this.errorCount++;
    // Throttle error notifications (max 1 per 5 min)
    if (this.errorCount > 1 && Date.now() - this.lastNotify < 300000) return;
    await this.send(`Error #${this.errorCount}: ${error}`, 'error');
  }

  // ── Session break notification ──
  async sendSessionBreak(breakMs, sessionInfo) {
    if (!cfg.notify.onSessionBreak) return;
    const breakMin = Math.round(breakMs / 60000);
    const sessionMin = Math.round(sessionInfo.elapsed / 60000);
    await this.send(`Session ended (${sessionMin}min). Break: ${breakMin}min`, 'session');
  }

  // ── Milestone notifications ──
  async sendMilestone(type, value) {
    const messages = {
      level: `Level up! Now Lv${value}`,
      earned: `Earned ${value} OTWN total!`,
      kills: `${value} kills reached!`,
      flip: `Flip profit: +${value} OTWN!`,
    };
    await this.send(messages[type] || `Milestone: ${type} = ${value}`, 'milestone');
  }
}

module.exports = Notifier;
