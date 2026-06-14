// market-ai.js v25 — Smart market intelligence with EMA, volume analysis, profit optimization
const cfg = require('./config');

class MarketAI {
  constructor() {
    this.prices = {};          // current best prices per item
    this.ema = {};             // exponential moving averages
    this.volume = {};          // listing count history
    this.history = [];         // timestamped price snapshots
    this.salesLog = [];        // our sales history
    this.profitByActivity = { mining: 0, fishing: 0, combat: 0 };
    this.timeByActivity = { mining: 0, fishing: 0, combat: 0 };
    this.activityStartTime = {};

    this.alpha = cfg.marketAi.emaAlpha;
    this.maxHistory = cfg.marketAi.historyWindow;
    this.minSamples = cfg.marketAi.minSamples;
    this.holdTrendPct = cfg.marketAi.holdTrendPct;
  }

  // ── Price scanning ──
  scanListings(listings) {
    const best = {};
    const counts = {};
    const totalVolume = {};

    for (const l of listings) {
      if (l.status !== 'active') continue;
      const ppu = Math.round(l.price / (l.qty || 1));
      if (!best[l.defId] || ppu < best[l.defId]) best[l.defId] = ppu;
      counts[l.defId] = (counts[l.defId] || 0) + 1;
      totalVolume[l.defId] = (totalVolume[l.defId] || 0) + (l.qty || 1);
    }

    // Update EMA prices
    for (const [defId, price] of Object.entries(best)) {
      if (!this.ema[defId]) {
        this.ema[defId] = price;
      } else {
        this.ema[defId] = this.alpha * price + (1 - this.alpha) * this.ema[defId];
      }
    }

    this.prices = best;
    this.volume = counts;
    this.history.push({
      time: Date.now(),
      prices: { ...best },
      counts: { ...counts },
      totalVolume: { ...totalVolume },
    });

    if (this.history.length > this.maxHistory) this.history.shift();
    return best;
  }

  // ── Price trend analysis ──
  getTrend(defId) {
    if (this.history.length < this.minSamples) return { direction: 'unknown', strength: 0, confidence: 0 };

    const recent = this.history.slice(-this.minSamples);
    const prices = recent.map(h => h.prices[defId]).filter(Boolean);
    if (prices.length < 3) return { direction: 'unknown', strength: 0, confidence: 0 };

    // Linear regression
    const n = prices.length;
    const xMean = (n - 1) / 2;
    const yMean = prices.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (prices[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den ? num / den : 0;
    const normalizedSlope = yMean ? slope / yMean : 0;

    // Volatility (std dev)
    const variance = prices.reduce((s, p) => s + (p - yMean) ** 2, 0) / n;
    const volatility = Math.sqrt(variance) / yMean;

    // Confidence based on sample count and consistency
    const confidence = Math.min(1, prices.length / 10) * (1 - Math.min(1, volatility * 2));

    let direction;
    if (normalizedSlope > 0.02) direction = 'rising';
    else if (normalizedSlope < -0.02) direction = 'falling';
    else direction = 'stable';

    return {
      direction,
      strength: Math.abs(normalizedSlope),
      confidence,
      slope,
      volatility,
      ema: this.ema[defId],
      currentPrice: this.prices[defId],
      samples: prices.length,
    };
  }

  // ── Market depth analysis ──
  getDepth(defId) {
    const last = this.history[this.history.length - 1];
    if (!last) return { listings: 0, volume: 0, liquidity: 'unknown' };
    const listings = last.counts[defId] || 0;
    const volume = last.totalVolume?.[defId] || 0;
    let liquidity;
    if (listings > 20) liquidity = 'high';
    else if (listings > 8) liquidity = 'medium';
    else if (listings > 0) liquidity = 'low';
    else liquidity = 'none';
    return { listings, volume, liquidity };
  }

  // ── Smart sell decision ──
  getSellDecision(defId, qty, priceFloor, quicksellPrice, isMarketOnly = false) {
    const mktPrice = this.prices[defId];
    const trend = this.getTrend(defId);
    const depth = this.getDepth(defId);
    const ema = this.ema[defId];
    const floor = priceFloor || 1;
    const qsPrice = quicksellPrice || 1;

    // Marketplace-only items
    if (isMarketOnly) {
      if (!mktPrice || mktPrice < floor) {
        return { action: 'HOLD', reason: `market ${mktPrice || 0} < floor ${floor}`, floor, trend };
      }
      // Hold if price is rising with good confidence
      if (cfg.marketAi.enabled && trend.direction === 'rising' && trend.confidence > 0.5 && trend.strength > 0.03) {
        return { action: 'HOLD', reason: `rising trend (${(trend.strength * 100).toFixed(1)}%, conf ${(trend.confidence * 100).toFixed(0)}%)`, floor, trend };
      }
      // Don't sell into falling market with high supply
      if (trend.direction === 'falling' && depth.listings > 10 && qty > 3) {
        return { action: 'HOLD', reason: `falling market, ${depth.listings} listings`, floor, trend };
      }
      const undercut = Math.max(floor, Math.floor(mktPrice * (1 - cfg.undercutPct)));
      return { action: 'MARKETPLACE', price: undercut, marketBest: mktPrice, depth, trend };
    }

    // Use EMA for smarter pricing if available
    const referencePrice = (cfg.marketAi.enabled && ema) ? Math.round(ema) : mktPrice;

    // Rising trend → hold for better price
    if (cfg.marketAi.enabled && trend.direction === 'rising' && trend.confidence > 0.6 && trend.strength > this.holdTrendPct) {
      return { action: 'HOLD', reason: `strong uptrend (${(trend.strength * 100).toFixed(1)}%)`, floor, trend };
    }

    // Market price significantly above quicksell → list on marketplace
    if (mktPrice && mktPrice > qsPrice * 3) {
      const price = Math.max(floor, Math.floor(mktPrice * (1 - cfg.undercutPct)));
      return { action: 'MARKETPLACE', price, marketBest: mktPrice, depth, trend };
    }

    // EMA above floor and good liquidity → marketplace
    if (referencePrice && referencePrice > floor && depth.liquidity !== 'none') {
      const price = Math.max(floor, Math.floor(referencePrice * (1 - cfg.undercutPct)));
      return { action: 'MARKETPLACE', price, marketBest: mktPrice, depth, trend };
    }

    // No market data → quicksell safe items, hold valuable ones
    if (!mktPrice && floor > qsPrice * 2) {
      return { action: 'HOLD', reason: 'no market data, value item', floor, trend };
    }

    return { action: 'QUICKSELL', price: qsPrice, trend };
  }

  // ── Flip opportunity detection ──
  findFlipOpportunities(listings, balance, myPlayerId) {
    const opportunities = [];

    for (const l of listings) {
      if (l.sellerPlayerId === myPlayerId || l.status !== 'active') continue;
      if (!l.qty || l.qty < 1) continue;

      const marketPrice = this.prices[l.defId];
      if (!marketPrice || marketPrice < 5) continue;

      const ppu = l.price / l.qty;
      const listingFee = Math.max(5, Math.round(l.price * 0.05));
      const resaleRevenue = Math.round(marketPrice * l.qty * 0.92);
      const totalCost = l.price + listingFee;
      const profit = resaleRevenue - totalCost;
      const roi = totalCost > 0 ? profit / totalCost : 0;

      // Tighter criteria with ROI check
      if (ppu < marketPrice * 0.4 && l.price <= cfg.flipMaxCost && profit >= cfg.flipMinProfit && balance >= totalCost && roi > 0.3) {
        const trend = this.getTrend(l.defId);
        // Don't flip items with falling prices
        if (trend.direction === 'falling' && trend.confidence > 0.5) continue;

        opportunities.push({
          listing: l,
          ppu,
          marketPrice,
          profit,
          roi,
          totalCost,
          trend,
        });
      }
    }

    // Sort by ROI (best first)
    opportunities.sort((a, b) => b.roi - a.roi);
    return opportunities;
  }

  // ── Activity profit tracking ──
  startActivity(type) {
    this.activityStartTime[type] = Date.now();
  }

  endActivity(type, earned) {
    const start = this.activityStartTime[type];
    if (start) {
      const elapsed = (Date.now() - start) / 3600000; // hours
      this.timeByActivity[type] = (this.timeByActivity[type] || 0) + elapsed;
      this.profitByActivity[type] = (this.profitByActivity[type] || 0) + (earned || 0);
      delete this.activityStartTime[type];
    }
  }

  recordSale(defId, qty, method, price, fromActivity) {
    this.salesLog.push({
      time: Date.now(),
      defId, qty, method, price,
      activity: fromActivity,
    });
    if (this.salesLog.length > 500) this.salesLog.shift();

    if (fromActivity && this.profitByActivity[fromActivity] !== undefined) {
      this.profitByActivity[fromActivity] += price * qty;
    }
  }

  // ── Priority farming recommendation ──
  getBestActivity() {
    if (!cfg.priorityFarming.enabled) return null;

    const rates = {};
    for (const [type, profit] of Object.entries(this.profitByActivity)) {
      const time = this.timeByActivity[type] || 0;
      rates[type] = time > 0.05 ? profit / time : 0; // OTWN/hour, need at least 3 min data
    }

    // If not enough data, return null
    const withData = Object.entries(rates).filter(([, r]) => r > 0);
    if (withData.length < 2) return null;

    // Sort by profit rate
    withData.sort((a, b) => b[1] - a[1]);
    return {
      recommended: withData[0][0],
      rates,
      ranking: withData.map(([type, rate]) => ({ type, rate: Math.round(rate) })),
    };
  }

  // ── Market report ──
  getReport() {
    const items = Object.entries(this.prices).map(([defId, price]) => {
      const trend = this.getTrend(defId);
      const depth = this.getDepth(defId);
      return { defId, price, ema: Math.round(this.ema[defId] || price), trend: trend.direction, strength: trend.strength, listings: depth.listings };
    });
    items.sort((a, b) => b.price - a.price);

    const priority = this.getBestActivity();

    return { items, priority, salesCount: this.salesLog.length, profitByActivity: { ...this.profitByActivity } };
  }

  // ── State save/load ──
  getState() {
    return {
      ema: { ...this.ema },
      profitByActivity: { ...this.profitByActivity },
      timeByActivity: { ...this.timeByActivity },
      salesLog: this.salesLog.slice(-100),
      history: this.history.slice(-20),
    };
  }

  loadState(state) {
    if (!state) return;
    if (state.ema) this.ema = state.ema;
    if (state.profitByActivity) this.profitByActivity = state.profitByActivity;
    if (state.timeByActivity) this.timeByActivity = state.timeByActivity;
    if (state.salesLog) this.salesLog = state.salesLog;
    if (state.history) this.history = state.history;
  }
}

module.exports = MarketAI;
